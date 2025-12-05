#!/usr/bin/env python3
"""
backfill_dates_and_workspace.py

Fetches the REAL created_at date and tags for all conversations from Intercom API
and updates the qa_metrics table with correct data.

This script fixes:
1. Incorrect metric_date (uses actual conversation created_at)
2. Missing workspace data (extracts from tags)
3. Missing is_360_queue data (detects 360 queue tags)

Usage:
  python backfill_dates_and_workspace.py
  python backfill_dates_and_workspace.py --limit 100
  python backfill_dates_and_workspace.py --conversation-id 215472047410898
"""

import os
import sys
import json
import time
import logging
import argparse
import requests
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Configuration
INTERCOM_TOKEN = os.environ.get("INTERCOM_TOKEN")
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

# Supabase Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Tag definitions for workspace and 360 queue detection
WORKSPACE_TAGS = {
    'SkyPrivate': ['skyprivate', 'SkyPrivate'],
    'CamModelDirectory': ['cmd', 'CMD', 'cammodeldirectory', 'CamModelDirectory'],
}

BILLING_360_TAGS = [
    'payments', 'billing-verifications', 'Billing - top-up-issue',
    'billing', 'top-up', 'billing-top-up-issue'
]

CEQ_360_TAGS = [
    'reports', 'scammers', 'ceq-verifications',
    'publicprofile', 'ceq'
]


def determine_workspace(tags: list) -> str:
    """Determine workspace from tags"""
    lower_tags = [t.lower() for t in tags]
    
    for workspace, identifiers in WORKSPACE_TAGS.items():
        if any(t.lower() in lower_tags for t in identifiers):
            return workspace
    
    return 'Unknown'


def determine_360_queue(tags: list) -> tuple:
    """Determine if conversation is 360 queue and what type"""
    lower_tags = [t.lower() for t in tags]
    
    is_billing = any(t.lower() in lower_tags for t in BILLING_360_TAGS)
    is_ceq = any(t.lower() in lower_tags for t in CEQ_360_TAGS)
    
    if is_billing and is_ceq:
        return True, 'both'
    elif is_billing:
        return True, 'billing'
    elif is_ceq:
        return True, 'ceq'
    
    return False, None


def fetch_conversation_from_intercom(conversation_id: str) -> dict | None:
    """Fetch full conversation details from Intercom API"""
    url = f"{INTERCOM_BASE}/conversations/{conversation_id}"
    headers = {
        "Authorization": f"Bearer {INTERCOM_TOKEN}",
        "Accept": "application/json",
        "Intercom-Version": INTERCOM_API_VERSION
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
        
        if response.status_code == 404:
            logger.warning(f"Conversation {conversation_id} not found in Intercom")
            return None
        
        if response.status_code != 200:
            logger.error(f"Failed to fetch conversation {conversation_id}: {response.status_code}")
            return None

        return response.json()
    except Exception as e:
        logger.error(f"Error fetching conversation {conversation_id}: {e}")
        return None


def extract_conversation_data(conversation: dict) -> dict:
    """Extract date, tags, workspace, and 360 queue info from conversation"""
    
    # Get the REAL created_at timestamp
    created_at = conversation.get('created_at')
    if created_at:
        real_date = datetime.fromtimestamp(created_at, tz=timezone.utc).date().isoformat()
    else:
        real_date = None
    
    # Extract tags
    tags_data = conversation.get('tags', {}).get('tags', [])
    tags = [tag.get('name', '') for tag in tags_data if tag.get('name')]
    
    # Determine workspace
    workspace = determine_workspace(tags)
    
    # Determine 360 queue
    is_360_queue, queue_type_360 = determine_360_queue(tags)
    
    return {
        'real_date': real_date,
        'tags': tags,
        'workspace': workspace,
        'is_360_queue': is_360_queue,
        'queue_type_360': queue_type_360,
    }


def update_qa_metric(conversation_id: str, data: dict) -> bool:
    """Update qa_metrics record with correct data"""
    try:
        update_data = {
            'workspace': data['workspace'],
            'is_360_queue': data['is_360_queue'],
            'queue_type_360': data['queue_type_360'],
            'tags': data['tags'],
        }
        
        # Only update date if we got a real date
        if data['real_date']:
            update_data['metric_date'] = data['real_date']
        
        response = supabase.table('qa_metrics').update(update_data).eq(
            'conversation_id', conversation_id
        ).execute()
        
        return True
    except Exception as e:
        logger.error(f"Failed to update {conversation_id}: {e}")
        return False


def get_conversations_to_update(limit: int = None, conversation_id: str = None) -> list:
    """Get list of conversation IDs to update"""
    try:
        query = supabase.table('qa_metrics').select('conversation_id, metric_date, workspace')
        
        if conversation_id:
            query = query.eq('conversation_id', conversation_id)
        elif limit:
            query = query.limit(limit)
        
        response = query.execute()
        return response.data
    except Exception as e:
        logger.error(f"Failed to fetch conversations: {e}")
        return []


def main():
    parser = argparse.ArgumentParser(description="Backfill dates and workspace data from Intercom")
    parser.add_argument("--limit", type=int, help="Limit number of conversations to process")
    parser.add_argument("--conversation-id", type=str, help="Process a specific conversation ID")
    parser.add_argument("--dry-run", action="store_true", help="Don't update, just show what would be done")
    
    args = parser.parse_args()
    
    logger.info("Starting backfill process...")
    
    # Get conversations to process
    conversations = get_conversations_to_update(
        limit=args.limit,
        conversation_id=args.conversation_id
    )
    
    logger.info(f"Found {len(conversations)} conversations to process")
    
    updated = 0
    failed = 0
    skipped = 0
    
    for i, conv in enumerate(conversations):
        conv_id = conv['conversation_id']
        current_date = conv.get('metric_date')
        current_workspace = conv.get('workspace')
        
        logger.info(f"[{i+1}/{len(conversations)}] Processing {conv_id}...")
        
        # Fetch from Intercom
        intercom_data = fetch_conversation_from_intercom(conv_id)
        
        if not intercom_data:
            skipped += 1
            continue
        
        # Extract data
        extracted = extract_conversation_data(intercom_data)
        
        # Log changes
        date_changed = extracted['real_date'] and extracted['real_date'] != current_date
        workspace_changed = extracted['workspace'] != current_workspace
        
        if date_changed:
            logger.info(f"  Date: {current_date} -> {extracted['real_date']}")
        if workspace_changed:
            logger.info(f"  Workspace: {current_workspace} -> {extracted['workspace']}")
        if extracted['is_360_queue']:
            logger.info(f"  360 Queue: {extracted['queue_type_360']}")
        
        # Update if not dry run
        if not args.dry_run:
            if update_qa_metric(conv_id, extracted):
                updated += 1
            else:
                failed += 1
        else:
            updated += 1
        
        # Rate limit: 100ms between requests
        time.sleep(0.1)
    
    logger.info("=" * 50)
    logger.info(f"Backfill complete!")
    logger.info(f"  Updated: {updated}")
    logger.info(f"  Failed: {failed}")
    logger.info(f"  Skipped: {skipped}")
    
    if args.dry_run:
        logger.info("  (DRY RUN - no changes made)")


if __name__ == "__main__":
    main()