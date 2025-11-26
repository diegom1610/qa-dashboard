#!/usr/bin/env python3
"""
fetch_conversation_thread.py

Fetches full conversation threads (messages) from Intercom Conversations API
Stores in Supabase conversation_threads and conversation_messages tables

Usage:
  python fetch_conversation_thread.py <conversation_id>
  python fetch_conversation_thread.py 215471253297267
"""

import os
import sys
import json
import logging
import requests
from datetime import datetime, timezone
from supabase import create_client, Client
from dotenv import load_dotenv
import os
load_dotenv()  # will load .env in current working directory
print("INTERCOM_TOKEN in env:", bool(os.environ.get("INTERCOM_TOKEN")))


# -----------------------------
# Configuration
# -----------------------------
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

# -----------------------------
# Supabase Client
# -----------------------------
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# -----------------------------
# Fetch Full Conversation
# -----------------------------
def fetch_conversation_from_intercom(conversation_id: str):
    """Fetch full conversation thread from Intercom API"""
    url = f"{INTERCOM_BASE}/conversations/{conversation_id}"
    headers = {
        "Authorization": f"Bearer {INTERCOM_TOKEN}",
        "Accept": "application/json",
        "Intercom-Version": INTERCOM_API_VERSION
    }

    logger.info("Fetching conversation %s from Intercom...", conversation_id)
    response = requests.get(url, headers=headers, timeout=30)

    if response.status_code != 200:
        logger.error("Failed to fetch conversation: %s %s", response.status_code, response.text)
        response.raise_for_status()

    conversation = response.json()
    logger.info("✅ Fetched conversation successfully")
    return conversation

# -----------------------------
# Skip Non-Message Events
# -----------------------------
def should_skip_part(part: dict) -> bool:
    """
    Skip conversation events that aren't actual messages.
    These are internal events like tag additions, assignments, etc.
    """
    part_type = part.get("part_type", "")

    # Check if part has meaningful content first
    has_content = (
        part.get("body", "").strip() or
        part.get("text", "").strip() or
        part.get("message", "").strip() or
        (part.get("blocks") and isinstance(part.get("blocks"), list) and len(part.get("blocks", [])) > 0)
    )

    # Event types that are usually just metadata (skip even if they have content)
    always_skip_types = [
        "tag_added",
        "tag_removed",
        "close",
        "open",
        "snoozed",
        "unsnoozed",
        "state_change",
        "priority_change",
        "language_detection_details",
        "custom_answer_applied",
        "operator_workflow_event",
        "quick_reply",
        "conversation_tags_updated",
        "conversation_attribute_updated_by_admin",
        "default_assignment"
    ]

    if part_type in always_skip_types:
        return True

    # Assignment events: skip ONLY if they don't have content
    # Sometimes agents send a message along with an assignment
    if part_type == "assignment":
        if not has_content:
            return True  # Skip empty assignment events
        # Keep assignment events that have message content
        return False

    # Skip if no meaningful content exists
    if not has_content:
        logger.debug("Skipping part with no content: %s (type: %s)", part.get("id"), part_type)
        return True

    return False

# -----------------------------
# Extract Message Body Helper
# -----------------------------
def extract_message_body(part: dict) -> str:
    """
    Extract message body from various Intercom message formats.
    Bot messages, Fin AI, and regular messages have different structures.
    """
    # 1. Standard body field (HTML or text)
    if part.get("body") and str(part.get("body")).strip():
        return str(part.get("body"))

    # 2. Text content for bots/automated messages
    if part.get("text") and str(part.get("text")).strip():
        return str(part.get("text"))

    # 3. Message content field
    if part.get("message") and isinstance(part.get("message"), str) and part.get("message").strip():
        return part.get("message")

    # 4. Blocks content (structured content like cards, buttons)
    if part.get("blocks") and isinstance(part.get("blocks"), list):
        block_texts = []
        for block in part.get("blocks", []):
            if block.get("text"):
                block_texts.append(block.get("text"))
            elif block.get("paragraph"):
                block_texts.append(block.get("paragraph"))
            elif block.get("heading"):
                block_texts.append(block.get("heading"))
        if block_texts:
            return "\n\n".join(block_texts)

    # If we get here, no content was extracted
    logger.warning("No body found for part %s (type: %s)",
                   part.get("id"), part.get("part_type"))
    logger.debug("Available fields: %s", list(part.keys()))

    return ""

# -----------------------------
# Parse Conversation Data
# -----------------------------
def parse_conversation_thread(conversation: dict):
    """Parse Intercom conversation into database format"""

    conv_id = conversation.get("id") or conversation.get("conversation_id")

    # Extract metadata
    state = conversation.get("state", "unknown")
    subject = (
        conversation.get("title") or
        conversation.get("conversation_message", {}).get("subject") or
        "No subject"
    )

    created_at = None
    if conversation.get("created_at"):
        created_at = datetime.fromtimestamp(conversation["created_at"], tz=timezone.utc).isoformat()

    updated_at = None
    if conversation.get("updated_at"):
        updated_at = datetime.fromtimestamp(conversation["updated_at"], tz=timezone.utc).isoformat()

    # Extract customer info
    customer = conversation.get("contacts", {}).get("contacts", [{}])[0] if conversation.get("contacts") else {}
    customer_name = customer.get("name") or customer.get("email") or "Unknown"
    customer_email = customer.get("email")

    # Tags
    tags = conversation.get("tags", {}).get("tags", [])
    tag_list = [tag.get("name") for tag in tags if tag.get("name")]

    # Priority
    priority = conversation.get("priority", "normal")

    thread_data = {
        "conversation_id": conv_id,
        "state": state,
        "subject": subject,
        "created_at": created_at,
        "updated_at": updated_at,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "tags": json.dumps(tag_list),
        "priority": priority,
        "full_data": json.dumps(conversation),
        "synced_at": datetime.now(timezone.utc).isoformat()
    }

    return thread_data

def parse_conversation_messages(conversation: dict):
    """Extract individual messages from conversation"""

    conv_id = conversation.get("id") or conversation.get("conversation_id")
    messages = []

    # First message (conversation starter - can be from user or bot)
    first_message = conversation.get("conversation_message") or conversation.get("source")
    if first_message and not should_skip_part(first_message):
        message_body = extract_message_body(first_message)
        logger.info("First message body length: %d", len(message_body))

        # Only add if we successfully extracted content
        if message_body and message_body.strip():
            # Use first_message created_at if available, otherwise fall back to conversation created_at
            if first_message.get("created_at"):
                message_created_at = datetime.fromtimestamp(first_message["created_at"], tz=timezone.utc).isoformat()
            elif conversation.get("created_at"):
                # Use conversation created_at as fallback for source messages
                message_created_at = datetime.fromtimestamp(conversation["created_at"], tz=timezone.utc).isoformat()
            else:
                message_created_at = None

            msg = {
                "conversation_id": conv_id,
                "part_id": first_message.get("id", f"{conv_id}_initial"),
                "part_type": "comment",
                "author_type": first_message.get("author", {}).get("type", "user"),
                "author_id": first_message.get("author", {}).get("id"),
                "author_name": first_message.get("author", {}).get("name") or first_message.get("author", {}).get("email") or "Customer",
                "body": message_body,
                "body_html": message_body,
                "created_at": message_created_at,
                "attachments": json.dumps(first_message.get("attachments", [])),
                "is_note": False,
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            messages.append(msg)
        else:
            logger.info("Skipped first message - no content extracted")

    # Conversation parts (replies, notes, etc.)
    parts = conversation.get("conversation_parts", {}).get("conversation_parts", [])
    logger.info("Processing %d conversation parts...", len(parts))

    skipped_count = 0
    for part in parts:
        # Skip conversation events and parts without content
        if should_skip_part(part):
            skipped_count += 1
            continue

        part_type = part.get("part_type", "comment")
        author = part.get("author", {})
        message_body = extract_message_body(part)

        # Double-check: skip if body extraction failed
        if not message_body or not message_body.strip():
            skipped_count += 1
            continue

        logger.info("Part: %s | Type: %s | Author: %s | Body length: %d",
                    part.get("id", "unknown"),
                    part_type,
                    author.get("name", "Unknown"),
                    len(message_body))

        # Check if this is an internal note (part_type is 'note' or starts with 'note_')
        is_note = part_type == "note" or part_type.startswith("note_")

        msg = {
            "conversation_id": conv_id,
            "part_id": part.get("id", f"{conv_id}_{len(messages)}"),
            "part_type": part_type,
            "author_type": author.get("type"),
            "author_id": author.get("id"),
            "author_name": author.get("name") or author.get("email") or "Unknown",
            "body": message_body,
            "body_html": message_body,
            "created_at": datetime.fromtimestamp(part["created_at"], tz=timezone.utc).isoformat() if part.get("created_at") else None,
            "attachments": json.dumps(part.get("attachments", [])),
            "is_note": is_note,
            "synced_at": datetime.now(timezone.utc).isoformat()
        }
        messages.append(msg)

    logger.info("Skipped %d conversation events/empty parts", skipped_count)

    logger.info("Parsed %d messages from conversation", len(messages))
    return messages

# -----------------------------
# Store in Supabase
# -----------------------------
def store_conversation_thread(thread_data: dict):
    """Store conversation metadata in conversation_threads table"""
    try:
        response = supabase.table("conversation_threads").upsert(
            thread_data,
            on_conflict="conversation_id"
        ).execute()
        logger.info("✅ Stored conversation thread metadata")
        return response
    except Exception as e:
        logger.error("Failed to store conversation thread: %s", e)
        raise

def store_conversation_messages(messages: list):
    """Store messages in conversation_messages table"""
    if not messages:
        logger.info("No messages to store")
        return

    try:
        response = supabase.table("conversation_messages").upsert(
            messages,
            on_conflict="part_id"
        ).execute()
        logger.info("✅ Stored %d messages", len(messages))
        return response
    except Exception as e:
        logger.error("Failed to store messages: %s", e)
        raise

# -----------------------------
# Main Function
# -----------------------------
def fetch_and_store_conversation(conversation_id: str):
    """Complete workflow: fetch from Intercom and store in Supabase"""

    # Step 1: Fetch from Intercom
    conversation = fetch_conversation_from_intercom(conversation_id)

    # Step 2: Parse thread metadata
    thread_data = parse_conversation_thread(conversation)

    # Step 3: Parse messages
    messages = parse_conversation_messages(conversation)

    # Step 4: Store in Supabase
    store_conversation_thread(thread_data)
    store_conversation_messages(messages)

    logger.info("✅ Successfully fetched and stored conversation %s", conversation_id)
    return {
        "conversation_id": conversation_id,
        "message_count": len(messages),
        "state": thread_data["state"],
        "subject": thread_data["subject"]
    }

# -----------------------------
# CLI Entry Point
# -----------------------------
def main():
    if len(sys.argv) < 2:
        print("Usage: python fetch_conversation_thread.py <conversation_id>")
        print("Example: python fetch_conversation_thread.py 215471253297267")
        sys.exit(1)

    conversation_id = sys.argv[1]

    try:
        result = fetch_and_store_conversation(conversation_id)
        print(f"\n✅ Success!")
        print(f"Conversation ID: {result['conversation_id']}")
        print(f"Messages: {result['message_count']}")
        print(f"State: {result['state']}")
        print(f"Subject: {result['subject']}")
    except Exception as e:
        logger.exception("Failed to fetch conversation: %s", e)
        sys.exit(1)

if __name__ == "__main__":
    main()
