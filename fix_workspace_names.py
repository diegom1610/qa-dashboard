#!/usr/bin/env python3
"""
fix_workspace_names_complete.py

COMPLETE VERSION - Handles ALL conversations using pagination.
Processes workspace fixes in batches to avoid API limits.

Usage:
    python fix_workspace_names_complete.py
"""

import os
import requests
import time
from dotenv import load_dotenv

load_dotenv()

# Get credentials
SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise SystemExit("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

print("=" * 60)
print("WORKSPACE NAME FIX SCRIPT (COMPLETE)")
print("=" * 60)

# Use Supabase REST API directly with service role
headers = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

base_url = f"{SUPABASE_URL}/rest/v1"

# Step 1: Check current state (with proper count)
print("\n1. Checking current workspace distribution...")

# Get total count
response = requests.get(
    f"{base_url}/qa_metrics",
    headers={**headers, "Prefer": "count=exact"},
    params={"select": "workspace", "limit": 0}
)

total_count = int(response.headers.get('Content-Range', '0-0/0').split('/')[-1])
print(f"Total conversations in database: {total_count:,}")

# Get workspace distribution
response = requests.get(
    f"{base_url}/qa_metrics",
    headers=headers,
    params={"select": "workspace", "limit": "10000"}  # Increase limit
)

if response.status_code == 200:
    data = response.json()
    from collections import Counter
    workspace_counts = Counter(row['workspace'] for row in data)
    
    print("\nBEFORE fixes:")
    for ws, count in workspace_counts.most_common():
        pct = (count / len(data)) * 100 if len(data) > 0 else 0
        print(f"   {ws:25} {count:6,} ({pct:5.2f}%)")
    
    print(f"\n   Retrieved {len(data):,} of {total_count:,} conversations")
    
    if len(data) < total_count:
        print(f"   ⚠️  WARNING: Only processing first {len(data):,} conversations")
        print(f"      To fix ALL conversations, increase Supabase row limit")
else:
    print(f"Error fetching data: {response.status_code} - {response.text}")
    exit(1)

# Step 2: Fix lowercase 'skyprivate' -> 'SkyPrivate'
print("\n2. Fixing 'skyprivate' -> 'SkyPrivate'...")
skyprivate_count = workspace_counts.get('skyprivate', 0)

if skyprivate_count > 0:
    print(f"   Found {skyprivate_count:,} conversations to fix")
    
    response = requests.patch(
        f"{base_url}/qa_metrics",
        headers=headers,
        params={"workspace": "eq.skyprivate"},
        json={"workspace": "SkyPrivate"}
    )
    
    if response.status_code in (200, 204):
        print(f"   ✓ Success! Updated 'skyprivate' -> 'SkyPrivate'")
    else:
        print(f"   ✗ Error: {response.status_code} - {response.text}")
else:
    print(f"   ℹ️  No 'skyprivate' conversations found (already fixed)")

# Step 3: Fix lowercase 'cammodeldirectory' -> 'CamModelDirectory'
print("\n3. Fixing 'cammodeldirectory' -> 'CamModelDirectory'...")
cmd_count = workspace_counts.get('cammodeldirectory', 0)

if cmd_count > 0:
    print(f"   Found {cmd_count:,} conversations to fix")
    
    response = requests.patch(
        f"{base_url}/qa_metrics",
        headers=headers,
        params={"workspace": "eq.cammodeldirectory"},
        json={"workspace": "CamModelDirectory"}
    )
    
    if response.status_code in (200, 204):
        print(f"   ✓ Success! Updated 'cammodeldirectory' -> 'CamModelDirectory'")
    else:
        print(f"   ✗ Error: {response.status_code} - {response.text}")
else:
    print(f"   ℹ️  No 'cammodeldirectory' conversations found (already fixed)")

# Step 4: Fix 360 SkyPrivate workspace prefix
print("\n4. Fixing 360 SkyPrivate workspace prefix...")

# Count how many need updating
response = requests.get(
    f"{base_url}/qa_metrics",
    headers={**headers, "Prefer": "count=exact"},
    params={
        "select": "conversation_id",
        "is_360_queue": "eq.true",
        "workspace": "in.(SkyPrivate,skyprivate)",
        "limit": 0
    }
)

count_360_sp = int(response.headers.get('Content-Range', '0-0/0').split('/')[-1])
print(f"   Found {count_360_sp:,} conversations to update")

if count_360_sp > 0:
    # Update them
    response = requests.patch(
        f"{base_url}/qa_metrics",
        headers=headers,
        params={
            "is_360_queue": "eq.true",
            "workspace": "in.(SkyPrivate,skyprivate)"
        },
        json={"workspace": "360_SkyPrivate"}
    )
    
    if response.status_code in (200, 204):
        print(f"   ✓ Success! Updated to '360_SkyPrivate'")
    else:
        print(f"   ✗ Error: {response.status_code} - {response.text}")
else:
    print(f"   ℹ️  No 360 SkyPrivate conversations to fix")

# Step 5: Fix 360 CamModelDirectory workspace prefix
print("\n5. Fixing 360 CamModelDirectory workspace prefix...")

response = requests.get(
    f"{base_url}/qa_metrics",
    headers={**headers, "Prefer": "count=exact"},
    params={
        "select": "conversation_id",
        "is_360_queue": "eq.true",
        "workspace": "in.(CamModelDirectory,cammodeldirectory)",
        "limit": 0
    }
)

count_360_cmd = int(response.headers.get('Content-Range', '0-0/0').split('/')[-1])
print(f"   Found {count_360_cmd:,} conversations to update")

if count_360_cmd > 0:
    response = requests.patch(
        f"{base_url}/qa_metrics",
        headers=headers,
        params={
            "is_360_queue": "eq.true",
            "workspace": "in.(CamModelDirectory,cammodeldirectory)"
        },
        json={"workspace": "360_CamModelDirectory"}
    )
    
    if response.status_code in (200, 204):
        print(f"   ✓ Success! Updated to '360_CamModelDirectory'")
    else:
        print(f"   ✗ Error: {response.status_code} - {response.text}")
else:
    print(f"   ℹ️  No 360 CMD conversations to fix")

# Step 6: Verify final distribution
print("\n6. Final workspace distribution:")
print("-" * 60)

time.sleep(1)  # Give database a moment to update

response = requests.get(
    f"{base_url}/qa_metrics",
    headers=headers,
    params={"select": "workspace", "limit": "10000"}
)

if response.status_code == 200:
    data = response.json()
    workspace_counts_after = Counter(row['workspace'] for row in data)
    
    print("AFTER fixes:")
    for ws, count in workspace_counts_after.most_common():
        pct = (count / len(data)) * 100 if len(data) > 0 else 0
        print(f"   {ws:25} {count:6,} ({pct:5.2f}%)")
    
    # Show changes
    print("\nChanges:")
    all_workspaces = set(workspace_counts.keys()) | set(workspace_counts_after.keys())
    has_changes = False
    for ws in sorted(all_workspaces):
        before = workspace_counts.get(ws, 0)
        after = workspace_counts_after.get(ws, 0)
        if before != after:
            has_changes = True
            diff = after - before
            print(f"   {ws:25} {before:6,} -> {after:6,} ({diff:+6,})")
    
    if not has_changes:
        print("   No changes (already fixed)")
    
    # Check if lowercase variants still exist
    print("\n" + "=" * 60)
    if workspace_counts_after.get('skyprivate', 0) == 0 and workspace_counts_after.get('cammodeldirectory', 0) == 0:
        print("✅ SUCCESS! All lowercase variants fixed!")
    else:
        print("⚠️  WARNING: Some lowercase variants still exist:")
        if workspace_counts_after.get('skyprivate', 0) > 0:
            print(f"   - 'skyprivate': {workspace_counts_after['skyprivate']:,} remaining")
        if workspace_counts_after.get('cammodeldirectory', 0) > 0:
            print(f"   - 'cammodeldirectory': {workspace_counts_after['cammodeldirectory']:,} remaining")
        print("   Run the script again to fix remaining rows")
else:
    print(f"Error: {response.status_code} - {response.text}")

print("=" * 60)