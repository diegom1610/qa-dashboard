#!/usr/bin/env python3
"""
check_conversation_tags.py - Debug tool to see what tags a conversation has in Intercom
"""

import os
import requests
from dotenv import load_load_dotenv()

INTERCOM_TOKEN = os.environ.get("INTERCOM_TOKEN")
conversation_id = "215472836676271"

url = f"https://api.intercom.io/conversations/{conversation_id}"
headers = {
    "Authorization": f"Bearer {INTERCOM_TOKEN}",
    "Accept": "application/json",
    "Intercom-Version": "2.14"
}

response = requests.get(url, headers=headers, timeout=30)

if response.status_code == 200:
    data = response.json()
    
    print(f"Conversation ID: {conversation_id}")
    print(f"State: {data.get('state')}")
    print(f"Created: {data.get('created_at')}")
    print("\n--- TAGS ---")
    
    tags = data.get("tags", {}).get("tags", [])
    if tags:
        for tag in tags:
            print(f"  - {tag.get('name')}")
    else:
        print("  (No tags)")
    
    print("\n--- RAW TAG DATA ---")
    print(data.get("tags"))
else:
    print(f"Error: {response.status_code}")
    print(response.text)