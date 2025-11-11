#!/usr/bin/env python3
"""
intercom_cx_export_run.py (patched)

- Enqueue Intercom reporting export for conversation dataset
- Requests CX score and CX explanation fields
- Auto-detects returned score & explanation columns
- Sanitizes (redacts) explanation text before storing
- Appends canonical rows to RawData sheet:
    date, agent, score, conversation_id, cx_score_breakdown, export_job_id, exported_at, reviewer_feedback, reviewer_score_override, reviewer_id, final_score
- Resolves teammate/admin IDs => friendly names and updates agent column
- Uses environment variables for all secrets
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
import requests
from collections import defaultdict
from datetime import datetime, timezone
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

# -----------------------------
# Configuration (from env vars)
# -----------------------------
INTERCOM_TOKEN = os.environ.get("INTERCOM_TOKEN")
INTERCOM_APP_ID = os.environ.get("INTERCOM_APP_ID", os.environ.get("APP_ID", "b37vb7kt"))
SA_PATH = os.environ.get("GOOGLE_SA_FILE_PATH", os.environ.get("SA_PATH"))
SPREADSHEET_ID = os.environ.get("SHEETS_SPREADSHEET_ID", os.environ.get("SPREADSHEET_ID"))

if not INTERCOM_TOKEN:
    raise SystemExit("Set INTERCOM_TOKEN environment variable before running.")
if not SA_PATH:
    raise SystemExit("Set GOOGLE_SA_FILE_PATH or SA_PATH environment variable before running.")
if not SPREADSHEET_ID:
    raise SystemExit("Set SHEETS_SPREADSHEET_ID or SPREADSHEET_ID environment variable before running.")

INTERCOM_BASE = "https://api.intercom.io"
INTERCOM_API_VERSION = "2.14"
SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# -----------------------------
# Utility: PII redaction for explanations
# -----------------------------
def anonymize_text(text: str) -> str:
    """
    Basic PII redaction for explanation text:
    - redact emails
    - redact long digit strings (possible account/cc)
    - redact phone-like sequences
    - collapse whitespace
    Note: this is heuristic-only. Use org-approved PII tooling for strict compliance.
    """
    if not text:
        return text
    s = str(text)
    # redact emails
    s = re.sub(r'[\w\.-]+@[\w\.-]+\.\w+', '[REDACTED_EMAIL]', s)
    # redact credit-card-like sequences (13-19 digits)
    s = re.sub(r'\b\d{13,19}\b', '[REDACTED_NUMBER]', s)
    # redact sequences of 6+ digits (account numbers)
    s = re.sub(r'\b\d{6,}\b', '[REDACTED_NUMBER]', s)
    # redact phone numbers (very permissive)
    s = re.sub(r'(\+?\d[\d\-\s\(\)]{6,}\d)', '[REDACTED_PHONE]', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# -----------------------------
# Google Sheets helpers
# -----------------------------
def get_sheets_service():
    creds = Credentials.from_service_account_file(SA_PATH, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)

def ensure_rawdata_sheet(sheet_service):
    sheets_api = sheet_service.spreadsheets()
    spreadsheet = sheets_api.get(spreadsheetId=SPREADSHEET_ID).execute()
    sheet_titles = [s["properties"]["title"] for s in spreadsheet.get("sheets", [])]
    if "RawData" not in sheet_titles:
        requests_body = {"requests": [{"addSheet": {"properties": {"title": "RawData"}}}]}
        sheets_api.batchUpdate(spreadsheetId=SPREADSHEET_ID, body=requests_body).execute()
        logger.info("Created sheet 'RawData'.")
        header = [
            "date", "agent", "score", "conversation_id", "cx_score_breakdown",
            "export_job_id", "exported_at", "reviewer_feedback",
            "reviewer_score_override", "reviewer_id", "final_score"
        ]
        sheets_api.values().update(
            spreadsheetId=SPREADSHEET_ID,
            range="RawData!A1:K1",
            valueInputOption="RAW",
            body={"values": [header]}
        ).execute()
        logger.info("Header row set in RawData (A1:K1).")
    else:
        logger.info("'RawData' sheet already exists.")

def load_existing_conversation_ids(sheet_service):
    try:
        res = sheet_service.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="RawData!D2:D1000000").execute()
        vals = res.get("values", [])
        return set(r[0] for r in vals if r and r[0])
    except Exception as e:
        logger.warning("Failed to load existing conversation IDs: %s", e)
        return set()

def append_rows(sheet_service, rows):
    if not rows:
        logger.info("No rows to append.")
        return
    sheet_service.spreadsheets().values().append(
        spreadsheetId=SPREADSHEET_ID,
        range="RawData!A2",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body={"values": rows}
    ).execute()
    logger.info("Appended %d rows to RawData.", len(rows))

# -----------------------------
# Intercom reporting export helpers
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
        logger.error("Enqueue failed. status=%s body=%s", r.status_code, r.text)
        r.raise_for_status()
    resp = r.json()
    job_id = resp.get("job_identifier") or resp.get("id") or resp.get("jobId")
    if not job_id:
        logger.error("No job_identifier in enqueue response: %s", json.dumps(resp)[:2000])
        raise RuntimeError("No job_identifier returned from Intercom enqueue")
    logger.info("Enqueued job %s (status=%s)", job_id, resp.get("status"))
    return job_id, resp

def poll_export(job_identifier: str, max_wait_seconds: int = 600):
    url = f"{INTERCOM_BASE}/export/reporting_data/{job_identifier}"
    headers = {"Authorization": f"Bearer {INTERCOM_TOKEN}", "Intercom-Version": INTERCOM_API_VERSION, "Accept": "application/json"}
    start = time.time()
    delay = 5
    while True:
        params = {"app_id": INTERCOM_APP_ID} if INTERCOM_APP_ID else None
        r = requests.get(url, headers=headers, params=params, timeout=30)
        if r.status_code != 200:
            logger.error("Poll status failed: %s %s", r.status_code, r.text)
            r.raise_for_status()
        data = r.json()
        status = data.get("status") or data.get("state") or ""
        logger.info("Job %s status=%s", job_identifier, status)
        if data.get("download_url"):
            return data
        if status and status.lower() in ("complete", "completed", "success"):
            return data
        if status and status.lower() in ("failed", "error"):
            logger.error("Job %s failed: %s", job_identifier, json.dumps(data)[:2000])
            raise RuntimeError("Export job failed: " + str(data))
        if time.time() - start > max_wait_seconds:
            logger.error("Timed out waiting for job %s after %s seconds", job_identifier, max_wait_seconds)
            raise TimeoutError("Timed out waiting for export job")
        time.sleep(delay)
        delay = min(60, delay * 2)

def download_export(job_response: dict, job_identifier: str):
    """
    Robust download:
      1) Try job_response['download_url'] with application/octet-stream + Authorization
      2) Retry download_url with Accept: */* and no Authorization (some presigned URLs require this)
      3) Fallback to /download/reporting_data/{job_identifier}?app_id=...
    """
    def try_get(url, headers=None, params=None, allow_redirects=True):
        try:
            r = requests.get(url, headers=headers or {}, params=params, timeout=120, allow_redirects=allow_redirects)
            return r.status_code, r
        except Exception as e:
            return None, e

    download_url = job_response.get("download_url")
    if download_url:
        logger.info("Attempting download_url with application/octet-stream")
        headers = {"Authorization": f"Bearer {INTERCOM_TOKEN}", "Accept": "application/octet-stream"}
        status, resp = try_get(download_url, headers=headers)
        if isinstance(resp, requests.models.Response) and resp.status_code == 200:
            logger.info("Downloaded from download_url (application/octet-stream).")
            return resp.content
        if isinstance(resp, requests.models.Response):
            logger.warning("download_url returned status=%s. Trying permissive fallback...", resp.status_code)
        else:
            logger.warning("download_url attempt raised: %s", resp)

        logger.info("Retrying download_url with Accept: */* and no Authorization header")
        headers2 = {"Accept": "*/*"}
        status2, resp2 = try_get(download_url, headers=headers2)
        if isinstance(resp2, requests.models.Response) and resp2.status_code == 200:
            logger.info("Downloaded from download_url (fallback headers).")
            return resp2.content
        if isinstance(resp2, requests.models.Response):
            logger.warning("Fallback download_url attempt returned status=%s", resp2.status_code)
        else:
            logger.warning("Fallback download_url attempt error: %s", resp2)

    logger.info("Falling back to /download/reporting_data/{job_id} endpoint with app_id param")
    download_endpoint = f"{INTERCOM_BASE}/download/reporting_data/{job_identifier}"
    headers3 = {"Authorization": f"Bearer {INTERCOM_TOKEN}", "Accept": "application/octet-stream", "Intercom-Version": INTERCOM_API_VERSION}
    params = {"app_id": INTERCOM_APP_ID, "job_identifier": job_identifier}
    status3, resp3 = try_get(download_endpoint, headers=headers3, params=params)
    if isinstance(resp3, requests.models.Response) and resp3.status_code == 200:
        logger.info("Downloaded from /download/reporting_data endpoint.")
        return resp3.content

    logger.error("All download attempts failed. Job response: %s", json.dumps(job_response, indent=2)[:4000])
    if isinstance(resp3, requests.models.Response):
        logger.error("Final download attempt returned %s: %s", resp3.status_code, resp3.text[:2000])
        resp3.raise_for_status()
    raise RuntimeError("Download failed and no usable HTTP response available.")

def parse_export_bytes(content_bytes: bytes):
    """
    Try gzip, zip, then plain CSV. Return list of dicts.
    """
    # gzip
    try:
        if content_bytes[:2] == b'\x1f\x8b':
            with gzip.GzipFile(fileobj=io.BytesIO(content_bytes)) as gz:
                text = gz.read().decode("utf-8")
                return list(csv.DictReader(io.StringIO(text)))
    except Exception:
        pass
    # zip
    try:
        if content_bytes[:4] == b'PK\x03\x04':
            z = zipfile.ZipFile(io.BytesIO(content_bytes))
            name = z.namelist()[0]
            with z.open(name) as f:
                text = f.read().decode("utf-8")
                return list(csv.DictReader(io.StringIO(text)))
    except Exception:
        pass
    # plain CSV fallback
    text = content_bytes.decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))

# -----------------------------
# Map / normalize rows
# -----------------------------
def map_row_to_canonical(row: dict, attr_map: dict):
    """
    Return [date_iso, agent, final_score, conversation_id]
    """
    # Timestamp
    ts = None
    for tkey in ("conversation_last_closed_at", "conversation_started_at"):
        mapped = attr_map.get(tkey)
        if mapped and row.get(mapped):
            ts = row.get(mapped)
            break
    if not ts:
        ts = row.get("conversation_last_closed_at") or row.get("conversation_started_at") or ""

    date_iso = ""
    try:
        ts_i = int(ts)
        date_iso = datetime.fromtimestamp(ts_i, tz=timezone.utc).isoformat()
    except Exception:
        date_iso = ts or ""

    # Agent detection (teammate id or name)
    agent = None
    possible_agent_fields = [
        attr_map.get("assignee_name"),
        "currently_assigned_teammate_id", "currently_assigned_teammate_raw_id",
        "currently_assigned_team_id", "assignee_id", "assignee", "assignee_user_id",
        "last_rated_teammate_raw_id", "reply_participant_teammate_ids"
    ]
    keys_lower = {k.lower(): k for k in row.keys()}
    for f in possible_agent_fields:
        if not f:
            continue
        fk = f.lower()
        if fk in keys_lower:
            val = row.get(keys_lower[fk])
            if val not in (None, ""):
                agent = val
                break
    if not agent:
        for k in row.keys():
            kl = k.lower()
            if any(tok in kl for tok in ("assignee", "teammate", "agent", "owner")) and row.get(k):
                agent = row.get(k)
                break
    agent = agent or "Unknown"

    # Score detection
    candidates = [
        attr_map.get("cx_score"),
        "ai_cx_score_rating", "conversation_rating", "fin_ai_agent_rating",
        "lastRatingValue", "totalRatings", "last_teammate_rating"
    ]
    score = None
    for c in candidates:
        if not c:
            continue
        if c in row and row.get(c) not in (None, ""):
            score = row.get(c)
            break
        if c.lower() in keys_lower and row.get(keys_lower[c.lower()]) not in (None, ""):
            score = row.get(keys_lower[c.lower()])
            break
    if not score:
        for k in row.keys():
            if any(s in k.lower() for s in ("cx", "score", "rating")) and row.get(k) not in (None, ""):
                score = row.get(k)
                break

    def percent_to_1_5(v):
        try:
            f = float(v)
            if 0 <= f <= 100:
                return int(round(1 + 4 * (f / 100.0)))
        except Exception:
            pass
        return None

    final_score = ""
    if score not in (None, ""):
        try:
            f = float(score)
            if 1 <= f <= 5:
                final_score = round(f, 2)
            elif 0 <= f <= 100:
                conv = percent_to_1_5(f)
                final_score = conv if conv is not None else round(f, 2)
            else:
                final_score = round(f, 2)
        except Exception:
            final_score = str(score)

    conv_id = row.get(attr_map.get("conversation_id") or "conversation_id") or row.get("conversation_id") or ""
    return [date_iso, agent, final_score, conv_id]

# -----------------------------
# Admins resolution (enrichment)
# -----------------------------
def looks_like_teammate_id(s):
    if not s or s == "Unknown":
        return False
    s = str(s).strip()
    if re.fullmatch(r"\d+", s):
        return True
    if re.fullmatch(r"[0-9a-fA-F\-]{8,}", s):
        return True
    return False

def fetch_all_admins_map():
    admins_map = {}
    url = f"{INTERCOM_BASE}/admins"
    headers = {"Authorization": f"Bearer {INTERCOM_TOKEN}", "Accept": "application/json"}
    params = {"per_page": 50}
    while True:
        r = requests.get(url, headers=headers, params=params, timeout=30)
        if r.status_code != 200:
            logger.warning("Failed to fetch admins list: %s %s", r.status_code, r.text[:500])
            break
        data = r.json()
        admin_list = data.get("admins") or data.get("data") or []
        for a in admin_list:
            aid = a.get("id") or a.get("admin_id") or a.get("user_id")
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
    return admins_map

def resolve_teammate_ids_and_update_sheet():
    svc = get_sheets_service()
    res = svc.spreadsheets().values().get(spreadsheetId=SPREADSHEET_ID, range="RawData!A2:D10000").execute()
    rows = res.get("values", [])
    if not rows:
        logger.info("No rows in RawData to resolve.")
        return

    id_to_rows = defaultdict(list)
    for i, row in enumerate(rows, start=2):
        while len(row) < 4:
            row.append("")
        agent_val = row[1]
        if looks_like_teammate_id(agent_val):
            id_to_rows[str(agent_val)].append(i)

    if not id_to_rows:
        logger.info("No teammate IDs detected to resolve.")
        return

    logger.info("Need to resolve %d unique teammate IDs", len(id_to_rows))
    admins_map = fetch_all_admins_map()

    updates = []
    for tid, row_nums in id_to_rows.items():
        name = admins_map.get(tid)
        if not name:
            try:
                r = requests.get(f"{INTERCOM_BASE}/admins/{tid}", headers={"Authorization": f"Bearer {INTERCOM_TOKEN}", "Accept": "application/json"}, timeout=10)
                if r.status_code == 200:
                    jr = r.json()
                    name = jr.get("name") or jr.get("email") or tid
                    admins_map[tid] = name
                else:
                    logger.debug("GET /admins/%s returned %s", tid, r.status_code)
                    name = tid
            except Exception as e:
                logger.warning("Failed to fetch admin %s: %s", tid, e)
                name = tid

        for rnum in row_nums:
            updates.append({"range": f"RawData!B{rnum}", "values": [[name]]})

    if updates:
        svc.spreadsheets().values().batchUpdate(spreadsheetId=SPREADSHEET_ID, body={"valueInputOption":"RAW", "data": updates}).execute()
        logger.info("Updated %d agent name cells in RawData.", len(updates))
    else:
        logger.info("No updates needed for agent names.")

# -----------------------------
# Main workflow
# -----------------------------
def run_window(start_unix: int, end_unix: int):
    svc = get_sheets_service()
    ensure_rawdata_sheet(svc)

    attribute_ids = [
        "conversation_id",
        "conversation_started_at",
        "conversation_last_closed_at",
        # teammate/admin assignment (IDs)
        "currently_assigned_teammate_id",
        "currently_assigned_teammate_raw_id",
        "currently_assigned_team_id",
        # CX/rating fields
        "ai_cx_score_rating",
        "conversation_rating",
        "fin_ai_agent_rating",
        "lastRatingValue",
        "totalRatings",
        # Request explanation/breakdown fields (likely names)
        "ai_cx_score_explanation"
        
    ]

    logger.info("Enqueue payload attribute_ids: %s", attribute_ids)
    job_id, enqueue_resp = enqueue_export(start_unix, end_unix, attribute_ids)

    job_resp = poll_export(job_id)

    content = download_export(job_resp, job_id)

    rows = parse_export_bytes(content)
    logger.info("Downloaded %d rows from Intercom export.", len(rows))

    # attr_map - allow auto-detection
    attr_map = {
        "conversation_id": "conversation_id",
        "conversation_started_at": "conversation_started_at",
        "conversation_last_closed_at": "conversation_last_closed_at",
        "assignee_name": None,
        "cx_score": None,
        "cx_explanation": None
    }

    # Auto-detect CX score & explanation columns (if present)
    if rows:
        headers = list(rows[0].keys())
        # detect score column
        if attr_map.get("cx_score") is None:
            for h in headers:
                hl = h.lower()
                if any(tok in hl for tok in ("ai_cx", "cx_score", "conversation_cx", "fin_ai", "lastrating", "rating")):
                    attr_map["cx_score"] = h
                    logger.info("Auto-detected CX score column: %s", h)
                    break
        # detect explanation column
        if attr_map.get("cx_explanation") is None:
            for h in headers:
                hl = h.lower()
                if any(tok in hl for tok in ("explain", "explanation", "breakdown", "reason", "ai_cx")):
                    # prefer fields with explanation/breakdown keywords
                    if "explain" in hl or "breakdown" in hl or "explanation" in hl:
                        attr_map["cx_explanation"] = h
                        logger.info("Auto-detected CX explanation column: %s", h)
                        break
            # if none matched explicit keywords, pick an ai_cx* field that remains (less likely)
            if attr_map.get("cx_explanation") is None:
                for h in headers:
                    hl = h.lower()
                    if "ai_cx" in hl and "explain" in hl:
                        attr_map["cx_explanation"] = h
                        logger.info("Auto-detected CX explanation column (fallback): %s", h)
                        break

    # Deduplicate by conversation_id and map rows
    existing_ids = load_existing_conversation_ids(svc)
    to_append = []
    for r in rows:
        conv_id = r.get("conversation_id") or r.get("id") or r.get(attr_map.get("conversation_id")) or ""
        if not conv_id:
            continue
        if conv_id in existing_ids:
            continue
        mapped = map_row_to_canonical(r, attr_map)
        exported_at = datetime.now(timezone.utc).isoformat()
        cx_breakdown = ""
        try:
            exp_key = attr_map.get("cx_explanation")
            if exp_key and r.get(exp_key):
                cx_breakdown = anonymize_text(r.get(exp_key))
            else:
                # fallback scan for explanation-like header
                for k in r.keys():
                    kl = k.lower()
                    if any(tok in kl for tok in ("explain", "explanation", "breakdown", "reason")) and r.get(k):
                        cx_breakdown = anonymize_text(r.get(k))
                        break
        except Exception:
            cx_breakdown = ""

        row_values = [
            mapped[0] or "",
            mapped[1] or "",
            mapped[2] if mapped[2] != "" else "",
            mapped[3] or "",
            cx_breakdown,
            job_id,
            exported_at,
            "", "", "", ""
        ]
        to_append.append(row_values)
        existing_ids.add(conv_id)

    append_rows(svc, to_append)

    # Resolve teammate IDs -> names (enrichment)
    try:
        resolve_teammate_ids_and_update_sheet()
    except Exception as e:
        logger.exception("Error during teammate resolution: %s", e)

    logger.info("Run complete. Appended %d new conversations.", len(to_append))


# -----------------------------
# Main entry - by default 10-min test (edit as needed)
# -----------------------------
if __name__ == "__main__":
    now = int(time.time())
    ten_minutes_ago = now - 600  # default test window
    logger.info("Running Intercom CX export for the last 10 minutes...")
    try:
        run_window(ten_minutes_ago, now)
    except Exception as e:
        logger.exception("Intercom export run failed: %s", e)
        raise
