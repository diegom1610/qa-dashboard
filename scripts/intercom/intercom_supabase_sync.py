#!/usr/bin/env python3
"""
intercom_supabase_sync.py

PRODUCTION SCRIPT - Replaces the Edge Function for Intercom sync

This script replicates the proven logic from intercom_cx_export_run.py
but writes directly to Supabase instead of Google Sheets.

Features:
- Fetches conversation data from Intercom Reporting Export API
- Parses timestamps correctly (handles seconds, milliseconds, ISO strings)
- Resolves teammate IDs to friendly names
- Enriches conversations with tags from individual conversation API
- Determines workspace from tags (SkyPrivate, CamModelDirectory)
- Detects 360 queue conversations (billing, CEQ)
- Writes directly to Supabase qa_metrics table
- Handles deduplication via upsert on conversation_id

Usage:
  python intercom_supabase_sync.py              # Default: last 1 day
  python intercom_supabase_sync.py --days 7     # Last 7 days
  python intercom_supabase_sync.py --days 30    # Last 30 days

Environment Variables Required:
  INTERCOM_TOKEN          - Intercom API token
  SUPABASE_URL            - Supabase project URL (or VITE_SUPABASE_URL)
  SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
  INTERCOM_APP_ID         - Optional, defaults to b37vb7kt
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
from typing import Optional, Dict, List, Any, Tuple

# -----------------------------
# Configuration
# -----------------------------
INTERCOM_TOKEN = os.environ.get("INTERCOM_TOKEN")
INTERCOM_APP_ID = os.environ.get("INTERCOM_APP_ID", "b37vb7kt")
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

# Validate required environment variables
missing_vars = []
if not INTERCOM_TOKEN:
    missing_vars.append("INTERCOM_TOKEN")
if not SUPABASE_URL:
    missing_vars.append("SUPABASE_URL or VITE_SUPABASE_URL")
if not SUPABASE_SERVICE_KEY:
    missing_vars.append("SUPABASE_SERVICE_ROLE_KEY")

if missing_vars:
    raise SystemExit(f"Missing required environment variables: {', '.join(missing_vars)}")

INTERCOM_BASE = "https://api.intercom.io"
INTERCOM_API_VERSION = "2.14"

# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# -----------------------------
# Supabase Client (using requests, no SDK dependency)
# -----------------------------
class SupabaseClient:
    """Simple Supabase client using REST API"""
    
    def __init__(self, url: str, service_key: str):
        self.url = url.rstrip('/')
        self.headers = {
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        }
    
    def upsert(self, table: str, data: List[Dict], on_conflict: str = "conversation_id") -> bool:
        """Upsert data to a table"""
        endpoint = f"{self.url}/rest/v1/{table}"
        headers = {
            **self.headers,
            "Prefer": f"resolution=merge-duplicates"
        }
        
        # Supabase expects on_conflict as a query parameter
        params = {"on_conflict": on_conflict}
        
        response = requests.post(
            endpoint,
            headers=headers,
            params=params,
            json=data,
            timeout=120
        )
        
        if response.status_code not in (200, 201, 204):
            logger.error(f"Upsert failed: {response.status_code} - {response.text}")
            raise RuntimeError(f"Supabase upsert failed: {response.status_code}")
        
        return True
    
    def select(self, table: str, columns: str = "*") -> List[Dict]:
        """Select data from a table"""
        endpoint = f"{self.url}/rest/v1/{table}"
        params = {"select": columns}
        
        response = requests.get(
            endpoint,
            headers=self.headers,
            params=params,
            timeout=60
        )
        
        if response.status_code != 200:
            logger.error(f"Select failed: {response.status_code} - {response.text}")
            return []
        
        return response.json()

# Initialize Supabase client
supabase = SupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# -----------------------------
# Workspace & 360 Queue Detection
# -----------------------------
WORKSPACE_KEYWORDS = {
    'SkyPrivate': ['skyprivate', 'sky private', 'sky-private'],
    'CamModelDirectory': ['cmd', 'cammodeldirectory', 'cam model directory', 'cam-model-directory'],
}

BILLING_360_KEYWORDS = ['payment', 'billing', 'top-up', 'topup', 'top up', 'verification']
CEQ_360_KEYWORDS = ['report', 'scammer', 'ceq', 'publicprofile', 'public profile']

def determine_workspace(tags: List[str]) -> str:
    """Determine workspace from tags using CONTAINS logic"""
    if not tags:
        return 'Unknown'
    
    all_tags_lower = ' '.join(t.lower() for t in tags)
    
    for workspace, keywords in WORKSPACE_KEYWORDS.items():
        for keyword in keywords:
            if keyword in all_tags_lower:
                return workspace
    
    return 'Unknown'

def determine_360_queue(tags: List[str]) -> Tuple[bool, Optional[str]]:
    """Determine if conversation is a 360 queue conversation"""
    if not tags:
        return False, None
    
    all_tags_lower = ' '.join(t.lower() for t in tags)
    
    is_billing = any(kw in all_tags_lower for kw in BILLING_360_KEYWORDS)
    is_ceq = any(kw in all_tags_lower for kw in CEQ_360_KEYWORDS)
    
    if is_billing and is_ceq:
        return True, 'both'
    elif is_billing:
        return True, 'billing'
    elif is_ceq:
        return True, 'ceq'
    
    return False, None

# -----------------------------
# PII Redaction
# -----------------------------
def anonymize_text(text: str) -> str:
    """Redact PII from text"""
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
# Timestamp Parsing (CRITICAL - Replicated from working script)
# -----------------------------
def parse_timestamp_to_date(ts: Any) -> Optional[str]:
    """
    Parse timestamp from Intercom - handles multiple formats.
    
    This is the CRITICAL function that was causing date issues.
    It handles:
    1. Unix seconds (e.g., 1731398400)
    2. Unix milliseconds (e.g., 1731398400000)
    3. ISO 8601 strings (e.g., "2025-11-12T00:00:00Z")
    4. Other date string formats
    """
    if ts is None:
        return None
    
    ts_str = str(ts).strip()
    
    if not ts_str or ts_str == "" or ts_str == "0":
        return None
    
    # Check for ISO date string first (contains '-' and is long enough)
    if '-' in ts_str and len(ts_str) >= 10:
        date_match = re.match(r'^(\d{4})-(\d{2})-(\d{2})', ts_str)
        if date_match:
            year, month, day = date_match.groups()
            result = f"{year}-{month}-{day}"
            logger.debug(f"Parsed ISO date: {ts_str} -> {result}")
            return result
    
    # Try parsing as Unix timestamp
    try:
        ts_num = float(ts_str)
        
        if ts_num <= 0:
            return None
        
        # Threshold to distinguish seconds from milliseconds
        SECONDS_THRESHOLD = 10_000_000_000  # 10 billion
        
        if ts_num > SECONDS_THRESHOLD:
            # Milliseconds
            date_obj = datetime.fromtimestamp(ts_num / 1000, tz=timezone.utc)
            logger.debug(f"Timestamp {ts} (milliseconds) -> {date_obj.date().isoformat()}")
        elif ts_num > 1_000_000_000:
            # Seconds
            date_obj = datetime.fromtimestamp(ts_num, tz=timezone.utc)
            logger.debug(f"Timestamp {ts} (seconds) -> {date_obj.date().isoformat()}")
        else:
            logger.warning(f"Timestamp {ts} too small to be valid")
            return None
        
        return date_obj.date().isoformat()
        
    except (ValueError, TypeError, OSError) as e:
        logger.debug(f"Failed to parse timestamp {ts}: {e}")
    
    # Try ISO format parsing
    try:
        date_obj = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
        return date_obj.date().isoformat()
    except (ValueError, TypeError):
        pass
    
    logger.warning(f"Could not parse timestamp: {ts}")
    return None

# -----------------------------
# Intercom Export API Helpers
# -----------------------------
def enqueue_export(start_time_unix: int, end_time_unix: int, attribute_ids: List[str]) -> Tuple[str, Dict]:
    """Enqueue an export job with Intercom"""
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
        logger.error(f"Enqueue failed: {r.status_code} {r.text}")
        r.raise_for_status()
    
    resp = r.json()
    job_id = resp.get("job_identifier") or resp.get("id") or resp.get("jobId")
    if not job_id:
        raise RuntimeError("No job_identifier in enqueue response")
    
    logger.info(f"Enqueued job {job_id} (status={resp.get('status')})")
    return job_id, resp

def poll_export(job_identifier: str, max_wait_seconds: int = 600) -> Dict:
    """Poll export job until complete"""
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
            logger.error(f"Poll failed: {r.status_code} {r.text}")
            r.raise_for_status()
        
        data = r.json()
        status = data.get("status") or data.get("state") or ""
        logger.info(f"Job {job_identifier} status={status}")
        
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

def download_export(job_response: Dict, job_identifier: str) -> bytes:
    """Download export data with multiple fallback methods"""
    
    def try_get(url: str, headers: Dict = None, params: Dict = None) -> Tuple[Optional[int], Any]:
        try:
            r = requests.get(url, headers=headers or {}, params=params, timeout=120)
            return r.status_code, r
        except Exception as e:
            return None, e
    
    # Method 1: Try download_url with authorization
    download_url = job_response.get("download_url")
    if download_url:
        logger.info("Attempting download_url with Authorization...")
        headers = {"Authorization": f"Bearer {INTERCOM_TOKEN}", "Accept": "application/octet-stream"}
        status, resp = try_get(download_url, headers=headers)
        if isinstance(resp, requests.Response) and resp.status_code == 200:
            logger.info("Downloaded from download_url")
            return resp.content
        logger.warning(f"download_url failed: {status}")
        
        # Method 2: Try without authorization (presigned URL)
        logger.info("Retrying download_url without Authorization...")
        headers2 = {"Accept": "*/*"}
        status2, resp2 = try_get(download_url, headers=headers2)
        if isinstance(resp2, requests.Response) and resp2.status_code == 200:
            logger.info("Downloaded from download_url (no auth)")
            return resp2.content
    
    # Method 3: Fallback endpoint
    logger.info("Trying fallback endpoint...")
    fallback_url = f"{INTERCOM_BASE}/download/reporting_data/{job_identifier}"
    headers3 = {
        "Authorization": f"Bearer {INTERCOM_TOKEN}",
        "Accept": "application/octet-stream",
        "Intercom-Version": INTERCOM_API_VERSION
    }
    params = {"app_id": INTERCOM_APP_ID, "job_identifier": job_identifier}
    status3, resp3 = try_get(fallback_url, headers=headers3, params=params)
    
    if isinstance(resp3, requests.Response) and resp3.status_code == 200:
        logger.info("Downloaded from fallback endpoint")
        return resp3.content
    
    raise RuntimeError("All download attempts failed")

def parse_export_bytes(content_bytes: bytes) -> List[Dict]:
    """Parse export content (gzip, zip, or plain CSV)"""
    
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
    
    # Plain CSV fallback
    text = content_bytes.decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))

# -----------------------------
# Admin/Teammate Resolution
# -----------------------------
def fetch_all_admins_map() -> Dict[str, str]:
    """Fetch all admin/teammate names from Intercom"""
    admins_map = {}
    url = f"{INTERCOM_BASE}/admins"
    headers = {"Authorization": f"Bearer {INTERCOM_TOKEN}", "Accept": "application/json"}
    params = {"per_page": 50}
    
    while True:
        r = requests.get(url, headers=headers, params=params, timeout=30)
        if r.status_code != 200:
            logger.warning(f"Failed to fetch admins: {r.status_code}")
            break
        
        data = r.json()
        admin_list = data.get("admins") or data.get("data") or []
        
        for a in admin_list:
            aid = a.get("id") or a.get("admin_id")
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
    
    logger.info(f"Fetched {len(admins_map)} admin/teammate records")
    return admins_map

def resolve_agent_name(agent_id: str, admins_map: Dict[str, str]) -> str:
    """Resolve agent ID to friendly name"""
    if not agent_id or agent_id == "Unknown":
        return "Unassigned"
    
    agent_str = str(agent_id).strip()
    
    # Check if already a name (not numeric or UUID-like)
    if not re.fullmatch(r"\d+", agent_str) and not re.fullmatch(r"[0-9a-fA-F\-]{8,}", agent_str):
        return agent_id
    
    return admins_map.get(agent_str, "Unassigned")

# -----------------------------
# Conversation Enrichment (Tags from Individual API)
# -----------------------------
def enrich_conversation_with_tags(conversation_id: str) -> Tuple[List[str], str, bool, Optional[str]]:
    """
    Fetch individual conversation to get tags.
    Returns: (tags, workspace, is_360_queue, queue_type_360)
    """
    try:
        url = f"{INTERCOM_BASE}/conversations/{conversation_id}"
        headers = {
            "Authorization": f"Bearer {INTERCOM_TOKEN}",
            "Accept": "application/json",
            "Intercom-Version": INTERCOM_API_VERSION
        }
        
        r = requests.get(url, headers=headers, timeout=30)
        
        if r.status_code != 200:
            logger.debug(f"Failed to fetch conversation {conversation_id}: {r.status_code}")
            return [], 'Unknown', False, None
        
        data = r.json()
        
        # Extract tags
        tags = []
        if data.get("tags") and data["tags"].get("tags"):
            tags = [t.get("name", "") for t in data["tags"]["tags"] if t.get("name")]
        
        # Determine workspace and 360 queue
        workspace = determine_workspace(tags)
        is_360, queue_type = determine_360_queue(tags)
        
        return tags, workspace, is_360, queue_type
        
    except Exception as e:
        logger.debug(f"Error enriching conversation {conversation_id}: {e}")
        return [], 'Unknown', False, None

# -----------------------------
# Parse Conversation Row
# -----------------------------
def parse_conversation_row(row: Dict, admins_map: Dict[str, str]) -> Dict:
    """
    Parse Intercom export row into qa_metrics format.
    
    CRITICAL: Uses conversation_started_at for the date (not closed_at).
    This matches the working Google Sheets script behavior.
    """
    
    # Get timestamps - prioritize started_at
    started_at = row.get("conversation_started_at") or ""
    closed_at = row.get("conversation_last_closed_at") or ""
    
    # CRITICAL: Use started_at first (when conversation actually began)
    metric_date = parse_timestamp_to_date(started_at)
    
    if not metric_date:
        metric_date = parse_timestamp_to_date(closed_at)
    
    if not metric_date:
        logger.warning(f"No valid timestamp for {row.get('conversation_id')}, using today")
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
            if 1 <= score_float <= 5:
                ai_score = round(score_float, 2)
            elif 0 <= score_float <= 100:
                # Convert percentage to 1-5 scale
                ai_score = round(1 + 4 * (score_float / 100.0), 2)
        except (ValueError, TypeError):
            pass
    
    # AI Explanation
    ai_explanation_raw = row.get("ai_cx_score_explanation") or ""
    ai_feedback = anonymize_text(ai_explanation_raw) if ai_explanation_raw else None
    
    # Resolution status
    resolution_status = row.get("conversation_state") or "completed"
    
    return {
        "conversation_id": conv_id,
        "agent_id": agent_raw,
        "agent_name": agent_name,
        "metric_date": metric_date,
        "ai_score": ai_score,
        "ai_feedback": ai_feedback,
        "resolution_status": resolution_status,
        "response_time_seconds": None,
        "customer_satisfaction_score": None,
        "rating_source": "ai" if ai_score else "none",
        # These will be populated by enrichment
        "tags": [],
        "workspace": "Unknown",
        "is_360_queue": False,
        "queue_type_360": None
    }

# -----------------------------
# Main Sync Function
# -----------------------------
def sync_conversations(start_unix: int, end_unix: int, enrich: bool = True) -> int:
    """
    Main sync workflow.
    
    Args:
        start_unix: Start timestamp (Unix seconds)
        end_unix: End timestamp (Unix seconds)
        enrich: Whether to fetch individual conversations for tags
    
    Returns:
        Number of conversations processed
    """
    
    # Step 1: Fetch admin/teammate map
    logger.info("Step 1: Fetching admin/teammate names...")
    admins_map = fetch_all_admins_map()
    
    # Step 2: Enqueue export
    logger.info("Step 2: Enqueueing Intercom export...")
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
    
    job_id, _ = enqueue_export(start_unix, end_unix, attribute_ids)
    
    # Step 3: Poll until complete
    logger.info("Step 3: Polling export job...")
    job_resp = poll_export(job_id)
    
    # Step 4: Download
    logger.info("Step 4: Downloading export data...")
    content = download_export(job_resp, job_id)
    
    # Step 5: Parse
    logger.info("Step 5: Parsing export data...")
    rows = parse_export_bytes(content)
    logger.info(f"Downloaded {len(rows)} rows from Intercom")
    
    if not rows:
        logger.info("No conversations to process")
        return 0
    
    # Step 6: Transform rows
    logger.info("Step 6: Transforming conversation data...")
    conversations = []
    for row in rows:
        conv_id = row.get("conversation_id")
        if not conv_id:
            continue
        
        parsed = parse_conversation_row(row, admins_map)
        conversations.append(parsed)
    
    logger.info(f"Parsed {len(conversations)} conversations")
    
    # Step 7: Enrich with tags (optional, can be slow for large batches)
    if enrich and conversations:
        logger.info("Step 7: Enriching conversations with tags...")
        batch_size = 10
        delay_between_batches = 0.5  # seconds
        
        enriched_count = 0
        failed_count = 0
        
        for i in range(0, len(conversations), batch_size):
            batch = conversations[i:i + batch_size]
            
            for conv in batch:
                tags, workspace, is_360, queue_type = enrich_conversation_with_tags(conv["conversation_id"])
                
                if tags or workspace != 'Unknown':
                    conv["tags"] = tags
                    conv["workspace"] = workspace
                    conv["is_360_queue"] = is_360
                    conv["queue_type_360"] = queue_type
                    enriched_count += 1
                    logger.debug(f"✓ {conv['conversation_id']}: {workspace} | 360={is_360}")
                else:
                    failed_count += 1
            
            # Rate limiting
            if i + batch_size < len(conversations):
                time.sleep(delay_between_batches)
        
        logger.info(f"Enrichment complete: {enriched_count} succeeded, {failed_count} failed")
    else:
        logger.info("Step 7: Skipping enrichment (disabled)")
    
    # Step 8: Prepare for Supabase (convert tags list to JSON string)
    for conv in conversations:
        if isinstance(conv.get("tags"), list):
            conv["tags"] = json.dumps(conv["tags"])
    
    # Step 9: Upsert to Supabase
    logger.info(f"Step 8: Upserting {len(conversations)} conversations to Supabase...")
    
    # Process in batches for reliability
    batch_size = 100
    for i in range(0, len(conversations), batch_size):
        batch = conversations[i:i + batch_size]
        supabase.upsert("qa_metrics", batch, on_conflict="conversation_id")
        logger.info(f"  Upserted batch {i//batch_size + 1}/{(len(conversations)-1)//batch_size + 1}")
    
    logger.info(f"✅ Sync complete! Processed {len(conversations)} conversations")
    return len(conversations)

# -----------------------------
# CLI Entry Point
# -----------------------------
def main():
    parser = argparse.ArgumentParser(
        description="Sync Intercom conversations to Supabase (replaces Edge Function)"
    )
    parser.add_argument(
        "--days",
        type=int,
        default=1,
        help="Number of days to look back (default: 1)"
    )
    parser.add_argument(
        "--no-enrich",
        action="store_true",
        help="Skip fetching individual conversations for tags (faster but no workspace info)"
    )
    
    args = parser.parse_args()
    
    now = int(time.time())
    start_unix = now - (args.days * 24 * 60 * 60)
    end_unix = now
    
    start_date = datetime.fromtimestamp(start_unix, tz=timezone.utc).date()
    end_date = datetime.fromtimestamp(end_unix, tz=timezone.utc).date()
    
    logger.info(f"=" * 60)
    logger.info(f"Intercom -> Supabase Sync")
    logger.info(f"Date range: {start_date} to {end_date} ({args.days} days)")
    logger.info(f"Enrichment: {'disabled' if args.no_enrich else 'enabled'}")
    logger.info(f"=" * 60)
    
    try:
        count = sync_conversations(start_unix, end_unix, enrich=not args.no_enrich)
        logger.info(f"✅ SUCCESS: Synced {count} conversations")
        return 0
    except Exception as e:
        logger.exception(f"❌ FAILED: {e}")
        return 1

if __name__ == "__main__":
    exit(main())