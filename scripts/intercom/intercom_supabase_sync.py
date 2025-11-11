#!/usr/bin/env python3
"""
intercom_supabase_sync.py

Direct Supabase integration - NO Google Sheets needed!

Features:
- Fetches conversation metadata from Intercom Reporting API
- Writes directly to Supabase qa_metrics table
- Supports bulk import of historical data
- Resolves teammate IDs to friendly names
- Auto-detects AI scores and explanations

Usage:
  python intercom_supabase_sync.py --days 30  # Last 30 days
  python intercom_supabase_sync.py --start 2025-01-01 --end 2025-01-31
"""

import os
import io
import csv
import gzip
import zipfile
import json
import time
import re
import logging
import argparse
import requests
from datetime import datetime, timezone, timedelta
from supabase import create_client, Client

# -----------------------------
# Configuration
# -----------------------------
INTERCOM_TOKEN = os.environ.get("INTERCOM_TOKEN")
INTERCOM_APP_ID = os.environ.get("INTERCOM_APP_ID", "b37vb7kt")
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not INTERCOM_TOKEN:
    raise SystemExit("Set INTERCOM_TOKEN environment variable")
if not SUPABASE_URL:
    raise SystemExit("Set VITE_SUPABASE_URL environment variable")
if not SUPABASE_SERVICE_KEY:
    raise SystemExit("Set SUPABASE_SERVICE_ROLE_KEY environment variable")

INTERCOM_BASE = "https://api.intercom.io"
INTERCOM_API_VERSION = "2.14"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# -----------------------------
# Supabase Client
# -----------------------------
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# -----------------------------
# PII Redaction
# -----------------------------
def anonymize_text(text: str) -> str:
    if not text:
        return text
    s = str(text)
    s = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', '[REDACTED_EMAIL]', s)
    s = re.sub(r'\b\d{13,19}\b', '[REDACTED_NUMBER]', s)
    s = re.sub(r'\b\d{6,}\b', '[REDACTED_NUMBER]', s)
    s = re.sub(r'(\+?\d[\d\-\s\(\)]{6,}\d)', '[REDACTED_PHONE]', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# -----------------------------
# Intercom Export Helpers
# -----------------------------
def enqueue_export(start_time_unix: int, end_time_unix: int, attribute_ids: list):
    url = f"{INTERCOM_BASE}/export/reporting_data/enqueue"
    payload = {
        "dataset_id": "conversation",
        "attribute_ids": attribute_ids,
        "start_time": int(start_time_unix),
        "end_time": int(end_time_unix)
    }
    headers = {
        "Authorization": f"Bearer {INTERCOM_TOKEN}",
        "Content-Type": "application/json",
        "Intercom-Version": INTERCOM_API_VERSION,
        "Accept": "application/json"
    }
    r = requests.post(url, headers=headers, json=payload, timeout=60)
    if r.status_code != 200:
        logger.error("Enqueue failed: %s %s", r.status_code, r.text)
        r.raise_for_status()
    resp = r.json()
    job_id = resp.get("job_identifier") or resp.get("id") or resp.get("jobId")
    if not job_id:
        raise RuntimeError("No job_identifier in enqueue response")
    logger.info("Enqueued job %s", job_id)
    return job_id, resp

def poll_export(job_identifier: str, max_wait_seconds: int = 600):
    url = f"{INTERCOM_BASE}/export/reporting_data/{job_identifier}"
    headers = {
        "Authorization": f"Bearer {INTERCOM_TOKEN}",
        "Intercom-Version": INTERCOM_API_VERSION,
        "Accept": "application/json"
    }
    start = time.time()
    delay = 5
    while True:
        params = {"app_id": INTERCOM_APP_ID} if INTERCOM_APP_ID else None
        r = requests.get(url, headers=headers, params=params, timeout=30)
        if r.status_code != 200:
            logger.error("Poll failed: %s %s", r.status_code, r.text)
            r.raise_for_status()
        data = r.json()
        status = data.get("status") or data.get("state") or ""
        logger.info("Job %s status=%s", job_identifier, status)
        if data.get("download_url"):
            return data
        if status and status.lower() in ("complete", "completed", "success"):
            return data
        if status and status.lower() in ("failed", "error"):
            raise RuntimeError(f"Export job failed: {data}")
        if time.time() - start > max_wait_seconds:
            raise TimeoutError("Export job timeout")
        time.sleep(delay)
        delay = min(60, delay * 2)

def download_export(job_response: dict, job_identifier: str):
    download_url = job_response.get("download_url")
    if download_url:
        logger.info("Attempting download_url...")
        headers = {"Authorization": f"Bearer {INTERCOM_TOKEN}", "Accept": "application/octet-stream"}
        r = requests.get(download_url, headers=headers, timeout=120)
        if r.status_code == 200:
            logger.info("Downloaded successfully")
            return r.content
        logger.warning("download_url failed with status %s", r.status_code)

    logger.info("Trying fallback endpoint...")
    download_endpoint = f"{INTERCOM_BASE}/download/reporting_data/{job_identifier}"
    headers = {
        "Authorization": f"Bearer {INTERCOM_TOKEN}",
        "Accept": "application/octet-stream",
        "Intercom-Version": INTERCOM_API_VERSION
    }
    params = {"app_id": INTERCOM_APP_ID, "job_identifier": job_identifier}
    r = requests.get(download_endpoint, headers=headers, params=params, timeout=120)
    if r.status_code == 200:
        logger.info("Downloaded from fallback endpoint")
        return r.content

    logger.error("All download attempts failed")
    r.raise_for_status()

def parse_export_bytes(content_bytes: bytes):
    # Try gzip
    try:
        if content_bytes[:2] == b'\x1f\x8b':
            with gzip.GzipFile(fileobj=io.BytesIO(content_bytes)) as gz:
                text = gz.read().decode("utf-8")
                return list(csv.DictReader(io.StringIO(text)))
    except Exception:
        pass

    # Try zip
    try:
        if content_bytes[:4] == b'PK\x03\x04':
            z = zipfile.ZipFile(io.BytesIO(content_bytes))
            name = z.namelist()[0]
            with z.open(name) as f:
                text = f.read().decode("utf-8")
                return list(csv.DictReader(io.StringIO(text)))
    except Exception:
        pass

    # Plain CSV
    text = content_bytes.decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))

# -----------------------------
# Teammate Resolution
# -----------------------------
def fetch_all_admins_map():
    admins_map = {}
    url = f"{INTERCOM_BASE}/admins"
    headers = {"Authorization": f"Bearer {INTERCOM_TOKEN}", "Accept": "application/json"}
    params = {"per_page": 50}

    while True:
        r = requests.get(url, headers=headers, params=params, timeout=30)
        if r.status_code != 200:
            logger.warning("Failed to fetch admins: %s", r.status_code)
            break
        data = r.json()
        admin_list = data.get("admins") or data.get("data") or []
        for a in admin_list:
            aid = a.get("id")
            name = a.get("name") or a.get("email") or str(aid)
            if aid:
                admins_map[str(aid)] = name

        pages = data.get("pages") or {}
        next_url = pages.get("next")
        if next_url:
            url = next_url
            params = None
            continue
        break

    logger.info("Fetched %d admin/teammate records", len(admins_map))
    return admins_map

def resolve_agent_name(agent_id: str, admins_map: dict) -> str:
    if not agent_id or agent_id == "Unknown":
        return "Unknown"

    # Already a name
    if not re.fullmatch(r"\d+", str(agent_id).strip()) and not re.fullmatch(r"[0-9a-fA-F\-]{8,}", str(agent_id).strip()):
        return agent_id

    return admins_map.get(str(agent_id), agent_id)

# -----------------------------
# Parse Conversation Row
# -----------------------------
def parse_conversation_row(row: dict, admins_map: dict):
    """Parse Intercom export row into qa_metrics format"""

    # Date
    ts = row.get("conversation_last_closed_at") or row.get("conversation_started_at") or ""
    metric_date = None
    try:
        ts_i = int(ts)
        metric_date = datetime.fromtimestamp(ts_i, tz=timezone.utc).date().isoformat()
    except Exception:
        metric_date = datetime.now(timezone.utc).date().isoformat()

    # Conversation ID
    conv_id = row.get("conversation_id") or ""

    # Agent
    agent_raw = (
        row.get("currently_assigned_teammate_id") or
        row.get("currently_assigned_teammate_raw_id") or
        row.get("assignee_id") or
        "Unknown"
    )
    agent_name = resolve_agent_name(agent_raw, admins_map)

    # AI Score
    ai_score_raw = (
        row.get("ai_cx_score_rating") or
        row.get("conversation_rating") or
        row.get("fin_ai_agent_rating") or
        ""
    )
    ai_score = None
    if ai_score_raw:
        try:
            score_float = float(ai_score_raw)
            if 0 <= score_float <= 100:
                ai_score = round(1 + 4 * (score_float / 100.0), 2)
            elif 1 <= score_float <= 5:
                ai_score = round(score_float, 2)
        except Exception:
            pass

    # AI Explanation
    ai_explanation_raw = row.get("ai_cx_score_explanation") or ""
    ai_explanation = anonymize_text(ai_explanation_raw) if ai_explanation_raw else None

    # Resolution status
    resolution_status = row.get("conversation_state") or "completed"

    return {
        "conversation_id": conv_id,
        "metric_date": metric_date,
        "agent_name": agent_name,
        "ai_score": ai_score,
        "ai_explanation": ai_explanation,
        "resolution_status": resolution_status,
        "response_time_minutes": None,
        "customer_satisfaction_score": None,
        "issue_complexity": None
    }

# -----------------------------
# Supabase Operations
# -----------------------------
def load_existing_conversation_ids():
    """Get all conversation IDs already in database"""
    try:
        response = supabase.table("qa_metrics").select("conversation_id").execute()
        return set(row["conversation_id"] for row in response.data if row.get("conversation_id"))
    except Exception as e:
        logger.warning("Failed to load existing conversation IDs: %s", e)
        return set()

def upsert_conversations(conversations: list):
    """Batch upsert conversations to Supabase"""
    if not conversations:
        logger.info("No conversations to upsert")
        return

    try:
        response = supabase.table("qa_metrics").upsert(
            conversations,
            on_conflict="conversation_id"
        ).execute()
        logger.info("Upserted %d conversations to Supabase", len(conversations))
        return response
    except Exception as e:
        logger.error("Failed to upsert conversations: %s", e)
        raise

# -----------------------------
# Main Sync Function
# -----------------------------
def sync_conversations(start_unix: int, end_unix: int):
    """Main sync workflow"""

    # Step 1: Fetch admin/teammate map
    logger.info("Fetching admin/teammate names...")
    admins_map = fetch_all_admins_map()

    # Step 2: Enqueue export
    attribute_ids = [
        "conversation_id",
        "conversation_started_at",
        "conversation_last_closed_at",
        "conversation_state",
        "currently_assigned_teammate_id",
        "currently_assigned_teammate_raw_id",
        "currently_assigned_team_id",
        "ai_cx_score_rating",
        "conversation_rating",
        "fin_ai_agent_rating",
        "ai_cx_score_explanation"
    ]

    logger.info("Enqueueing Intercom export...")
    job_id, enqueue_resp = enqueue_export(start_unix, end_unix, attribute_ids)

    # Step 3: Poll until complete
    logger.info("Polling export job...")
    job_resp = poll_export(job_id)

    # Step 4: Download
    logger.info("Downloading export data...")
    content = download_export(job_resp, job_id)

    # Step 5: Parse
    logger.info("Parsing export data...")
    rows = parse_export_bytes(content)
    logger.info("Downloaded %d rows", len(rows))

    # Step 6: Filter and transform
    existing_ids = load_existing_conversation_ids()
    logger.info("Found %d existing conversations in database", len(existing_ids))

    conversations = []
    for row in rows:
        conv_id = row.get("conversation_id")
        if not conv_id:
            continue

        # Skip duplicates (optional - upsert will handle this)
        # if conv_id in existing_ids:
        #     continue

        parsed = parse_conversation_row(row, admins_map)
        conversations.append(parsed)

    # Step 7: Upsert to Supabase
    logger.info("Upserting %d conversations to Supabase...", len(conversations))
    upsert_conversations(conversations)

    logger.info("✅ Sync complete! Processed %d conversations", len(conversations))

# -----------------------------
# CLI Entry Point
# -----------------------------
def main():
    parser = argparse.ArgumentParser(description="Sync Intercom conversations to Supabase")
    parser.add_argument("--days", type=int, help="Number of days to look back (e.g., 30)")
    parser.add_argument("--start", type=str, help="Start date (YYYY-MM-DD)")
    parser.add_argument("--end", type=str, help="End date (YYYY-MM-DD)")

    args = parser.parse_args()

    now = int(time.time())

    if args.days:
        start_unix = now - (args.days * 24 * 60 * 60)
        end_unix = now
        logger.info("Syncing last %d days", args.days)
    elif args.start and args.end:
        start_dt = datetime.strptime(args.start, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end_dt = datetime.strptime(args.end, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        start_unix = int(start_dt.timestamp())
        end_unix = int(end_dt.timestamp())
        logger.info("Syncing from %s to %s", args.start, args.end)
    else:
        # Default: last 7 days
        start_unix = now - (7 * 24 * 60 * 60)
        end_unix = now
        logger.info("No date range specified. Syncing last 7 days (default)")

    try:
        sync_conversations(start_unix, end_unix)
    except Exception as e:
        logger.exception("Sync failed: %s", e)
        raise

if __name__ == "__main__":
    main()
