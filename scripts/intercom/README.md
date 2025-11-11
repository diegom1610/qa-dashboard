# Intercom to Supabase Integration Scripts

This directory contains Python scripts for syncing Intercom conversation data directly to your Supabase database.

## 🎯 Overview

**NO MORE GOOGLE SHEETS!** These scripts write directly to Supabase, making your data pipeline simpler and faster.

### What's Included

1. **`intercom_supabase_sync.py`** - Bulk conversation metadata sync
2. **`fetch_conversation_thread.py`** - Individual conversation thread fetcher

## 📋 Prerequisites

### Required Packages

```bash
pip install supabase requests python-dotenv
```

### Environment Variables

Add these to your `.env` file (at project root):

```bash
# Intercom API
INTERCOM_TOKEN=your_intercom_access_token
INTERCOM_APP_ID=b37vb7kt

# Supabase (already configured)
VITE_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Where to find Intercom token:**
1. Go to Intercom Dashboard → Settings → Developers
2. Create a new app or use existing
3. Copy the Access Token
4. Required permissions: `Read conversations`, `Read admins`

## 🚀 Usage

### 1. Bulk Sync Conversation Metadata

Syncs conversation metadata (dates, agents, AI scores) from Intercom to `qa_metrics` table.

```bash
# Default: Last 7 days
python scripts/intercom/intercom_supabase_sync.py

# Last 30 days
python scripts/intercom/intercom_supabase_sync.py --days 30

# Specific date range
python scripts/intercom/intercom_supabase_sync.py --start 2025-01-01 --end 2025-01-31
```

**What it does:**
- Fetches conversations from Intercom Reporting API
- Resolves teammate IDs to friendly names
- Extracts AI scores and explanations
- Writes directly to Supabase `qa_metrics` table
- Handles duplicates automatically (upsert)

**Run frequency:** Daily or weekly (via cron job recommended)

### 2. Fetch Individual Conversation Thread

Fetches the complete message thread for a single conversation.

```bash
python scripts/intercom/fetch_conversation_thread.py 215471253297267
```

**What it does:**
- Fetches full conversation from Intercom Conversations API
- Parses all messages (customer + agent + internal notes)
- Stores in `conversation_threads` and `conversation_messages` tables
- Used by the dashboard's "View" button

**Run frequency:** On-demand (called by Edge Function automatically)

## 📊 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERCOM API                              │
│  - Conversations metadata                                    │
│  - Full message threads                                      │
│  - Agent/teammate info                                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│               PYTHON SCRIPTS (This directory)                │
│  1. intercom_supabase_sync.py → Bulk metadata                │
│  2. fetch_conversation_thread.py → Individual threads        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                         │
│  Tables:                                                     │
│  - qa_metrics (conversation metadata)                        │
│  - conversation_threads (conversation details)               │
│  - conversation_messages (individual messages)               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                   DASHBOARD FRONTEND                         │
│  - Display metrics                                           │
│  - View conversation threads                                 │
│  - Submit human feedback                                     │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Recommended Setup

### Option 1: Manual Runs
Good for testing or small-scale usage:

```bash
# Run bulk sync weekly
python scripts/intercom/intercom_supabase_sync.py --days 7
```

### Option 2: Cron Job (Recommended)
Automate the bulk sync:

```bash
# Add to crontab (run daily at 2 AM)
0 2 * * * cd /path/to/project && python scripts/intercom/intercom_supabase_sync.py --days 1

# Or run weekly (every Monday at 2 AM)
0 2 * * 1 cd /path/to/project && python scripts/intercom/intercom_supabase_sync.py --days 7
```

### Option 3: GitHub Actions (Cloud)
Create `.github/workflows/sync-intercom.yml`:

```yaml
name: Sync Intercom Data

on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM UTC
  workflow_dispatch:  # Manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - name: Install dependencies
        run: pip install supabase requests
      - name: Sync conversations
        env:
          INTERCOM_TOKEN: ${{ secrets.INTERCOM_TOKEN }}
          INTERCOM_APP_ID: ${{ secrets.INTERCOM_APP_ID }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: python scripts/intercom/intercom_supabase_sync.py --days 1
```

## 🎨 Dashboard Integration

The dashboard automatically uses these scripts through:

1. **Bulk Sync**: Run `intercom_supabase_sync.py` to populate conversation list
2. **View Button**: Clicking "View" on any conversation calls the Edge Function
3. **Edge Function**: Automatically calls the fetch logic (no manual script needed)

## 🔍 Troubleshooting

### "INTERCOM_TOKEN not found"
- Make sure `.env` file is in the project root
- Verify the variable name is exactly `INTERCOM_TOKEN`

### "Failed to fetch conversations"
- Check Intercom API token permissions
- Verify app has `Read conversations` scope
- Check if conversations exist in the date range

### "Supabase connection failed"
- Verify `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Make sure you're using SERVICE_ROLE_KEY (not anon key)

### "No data appearing in dashboard"
- Run bulk sync first: `python scripts/intercom/intercom_supabase_sync.py`
- Check Supabase database has data: `SELECT * FROM qa_metrics LIMIT 10;`
- Refresh dashboard (Ctrl+R)

## 📝 Logging

Both scripts log to console:

```bash
2025-01-15 14:30:22 [INFO] Fetching admin/teammate names...
2025-01-15 14:30:23 [INFO] Fetched 25 admin/teammate records
2025-01-15 14:30:23 [INFO] Enqueueing Intercom export...
2025-01-15 14:30:24 [INFO] Enqueued job abc123
2025-01-15 14:30:29 [INFO] Job abc123 status=complete
2025-01-15 14:30:30 [INFO] Downloaded 150 rows
2025-01-15 14:30:31 [INFO] Upserted 150 conversations to Supabase
2025-01-15 14:30:31 [INFO] ✅ Sync complete! Processed 150 conversations
```

## 🆘 Support

If you encounter issues:

1. Check logs for specific error messages
2. Verify environment variables are set correctly
3. Test Intercom API access: `curl -H "Authorization: Bearer $INTERCOM_TOKEN" https://api.intercom.io/admins`
4. Check Supabase connection: Visit Supabase dashboard → Table Editor → qa_metrics

## 🎉 Next Steps

After running the sync:

1. Open the dashboard
2. Click "View" on any conversation
3. See the full message thread
4. Add human feedback ratings
5. Watch the final score calculate automatically!
