# 🚀 Intercom Integration - Quick Start Guide

## ✅ What's Been Implemented

You now have a **complete Intercom conversation preview system** that writes directly to Supabase (no Google Sheets needed!).

### New Features

1. **✅ Direct Supabase Integration** - Python scripts write directly to database
2. **✅ Conversation Preview** - View full Intercom message threads in dashboard
3. **✅ Three-Panel Layout** - Left (list), Middle (messages), Right (ratings)
4. **✅ On-Demand Fetching** - Edge Function caches conversations for fast loading
5. **✅ Visual Indicators** - Green checkmarks show which conversations have human feedback
6. **✅ Weighted Scoring** - Final scores now display correctly (70% human + 30% AI)

---

## 🎯 Getting Started (5 Minutes)

### Step 1: Install Python Dependencies

```bash
pip install supabase requests
```

### Step 2: Add Intercom Credentials

Add to your `.env` file (in project root):

```bash
# Intercom API Token
INTERCOM_TOKEN=your_intercom_access_token_here
INTERCOM_APP_ID=b37vb7kt
```

**How to get your Intercom token:**
1. Go to https://app.intercom.com/
2. Click Settings (⚙️) → Developers → Developer Hub
3. Create a new app or select existing
4. Copy the **Access Token**
5. Required permissions: `Read conversations`, `Read admins`

### Step 3: Run Initial Sync

```bash
# Sync last 30 days of conversations
python scripts/intercom/intercom_supabase_sync.py --days 30
```

This will:
- ✅ Fetch conversations from Intercom
- ✅ Resolve agent names
- ✅ Extract AI scores
- ✅ Write directly to Supabase `qa_metrics` table

**Expected output:**
```
2025-01-15 14:30:22 [INFO] Fetching admin/teammate names...
2025-01-15 14:30:23 [INFO] Fetched 25 admin/teammate records
2025-01-15 14:30:23 [INFO] Enqueueing Intercom export...
2025-01-15 14:30:31 [INFO] ✅ Sync complete! Processed 150 conversations
```

### Step 4: Open Dashboard

```bash
npm run dev
```

Navigate to your dashboard and you should see:
- ✅ Conversations populated in the table
- ✅ Green checkmarks on rated conversations
- ✅ "View" buttons to see full threads

---

## 🎨 How to Use the Dashboard

### Viewing Conversations

1. **Find a conversation** in the table
2. **Click the "View" button** in the Actions column
3. **See the full message thread** with:
   - Customer messages
   - Agent replies
   - Internal notes (yellow background)
   - Timestamps
   - Message metadata

### Rating Conversations

1. **Expand a conversation** by clicking the row
2. **See AI Analysis** (purple section) with score and explanation
3. **Add Human Feedback** using the rating panel
4. **Final Score** updates automatically (70% human + 30% AI)

### Filtering & Searching

- **Filter by agent** using the dropdown
- **Search by conversation ID** in the search box
- **Filter by date range** using date pickers
- **Filter by status** (completed, pending, etc.)

---

## 🔄 Data Sync Options

### Option 1: Manual Sync (Testing)

Run whenever you need fresh data:

```bash
python scripts/intercom/intercom_supabase_sync.py --days 7
```

### Option 2: Scheduled Cron Job (Recommended)

Add to your crontab:

```bash
# Daily at 2 AM
0 2 * * * cd /path/to/project && python scripts/intercom/intercom_supabase_sync.py --days 1
```

### Option 3: GitHub Actions (Automated)

Create `.github/workflows/sync-intercom.yml`:

```yaml
name: Daily Intercom Sync

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
      - run: pip install supabase requests
      - run: python scripts/intercom/intercom_supabase_sync.py --days 1
        env:
          INTERCOM_TOKEN: ${{ secrets.INTERCOM_TOKEN }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        INTERCOM API                           │
│  • Conversations metadata (bulk)                             │
│  • Full message threads (on-demand)                          │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│              PYTHON SCRIPTS (Local/Cron)                      │
│  • intercom_supabase_sync.py → Bulk metadata sync            │
│  • fetch_conversation_thread.py → Individual threads         │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                   SUPABASE DATABASE                           │
│  Tables:                                                      │
│  • qa_metrics (conversation metadata)                        │
│  • conversation_threads (full conversation data)             │
│  • conversation_messages (individual messages)               │
│  • human_feedback (QA ratings)                               │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│              EDGE FUNCTION (On-Demand)                        │
│  • fetch-conversation-thread                                 │
│  • Checks cache first (60 min TTL)                           │
│  • Fetches from Intercom if stale                            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌──────────────────────────────────────────────────────────────┐
│                  REACT DASHBOARD                              │
│  Left Panel: Conversation list with filters                  │
│  Middle Panel: Full message thread viewer                    │
│  Right Panel: Rating interface                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 📊 Database Schema

### New Tables Created

1. **`conversation_threads`**
   - Stores conversation metadata
   - Includes subject, state, customer info, tags
   - Links to messages via `conversation_id`

2. **`conversation_messages`**
   - Individual messages within conversations
   - Includes author, body, timestamps
   - Supports notes, attachments, different message types

### Existing Tables Enhanced

- **`qa_metrics`** - Now populated by Python script (not Google Sheets)
- **`human_feedback`** - Already working, unchanged

---

## 🎯 Key Benefits

### Before (Old System)
- ❌ Python → Google Sheets → Supabase (2 hops)
- ❌ Manual Google Sheets configuration required
- ❌ No conversation preview
- ❌ No message threads visible
- ❌ Complex setup with service accounts

### After (New System)
- ✅ Python → Supabase (direct!)
- ✅ No Google Sheets needed
- ✅ Full conversation preview in dashboard
- ✅ Complete message threads with formatting
- ✅ Simple setup with just API tokens

---

## 🔍 Troubleshooting

### "No conversations appearing"

**Solution:**
1. Check you ran the sync: `python scripts/intercom/intercom_supabase_sync.py --days 30`
2. Verify data in Supabase: Go to Table Editor → `qa_metrics`
3. Check date range - try wider range if needed

### "View button shows error"

**Solution:**
1. Check INTERCOM_TOKEN is in Supabase secrets
2. Verify Edge Function is deployed: Check Supabase Dashboard → Edge Functions
3. Try manual fetch: `python scripts/intercom/fetch_conversation_thread.py <conversation_id>`

### "Final Score showing N/A"

**Solution:**
- This is now fixed! The weighted score should display correctly
- If still showing N/A: No AI score + no human feedback = nothing to calculate
- Add either AI score or human feedback to see a final score

### "Green checkmark not showing"

**Solution:**
- Checkmark only appears after you submit human feedback
- Click row → expand → submit rating → checkmark appears

---

## 📝 Scripts Reference

### `intercom_supabase_sync.py`

**Purpose:** Bulk sync of conversation metadata

**Usage:**
```bash
# Last 7 days (default)
python scripts/intercom/intercom_supabase_sync.py

# Last 30 days
python scripts/intercom/intercom_supabase_sync.py --days 30

# Specific date range
python scripts/intercom/intercom_supabase_sync.py --start 2025-01-01 --end 2025-01-31
```

**What it syncs:**
- Conversation IDs
- Agent names
- AI scores and explanations
- Dates and timestamps
- Resolution status

**Run frequency:** Daily or weekly

### `fetch_conversation_thread.py`

**Purpose:** Fetch individual conversation thread

**Usage:**
```bash
python scripts/intercom/fetch_conversation_thread.py 215471253297267
```

**What it syncs:**
- Full conversation metadata
- All messages (customer + agent)
- Internal notes
- Attachments metadata
- Timestamps

**Run frequency:** On-demand (automatic via Edge Function)

---

## 🎉 Next Steps

1. **Set up automated sync** - Use cron job or GitHub Actions
2. **Customize date ranges** - Adjust sync frequency based on your needs
3. **Train your team** - Show them how to use the View button and rating system
4. **Monitor performance** - Check Supabase dashboard for query performance
5. **Add more agents** - The system auto-detects all Intercom agents

---

## 📚 Additional Resources

- **Full Documentation:** See `scripts/intercom/README.md`
- **Database Schema:** See migration file in `supabase/migrations/`
- **User Guide:** See `USER_GUIDE.md` in project root
- **Architecture Details:** See `ARCHITECTURE.md`

---

## 🆘 Need Help?

If you encounter issues:

1. Check the logs - both scripts output detailed logging
2. Verify environment variables are set correctly
3. Test Intercom API access manually
4. Check Supabase table data directly
5. Review Edge Function logs in Supabase Dashboard

**Common Issues Solved:**
- ✅ Final Score displaying correctly
- ✅ Green checkmarks showing on rated conversations
- ✅ Direct Supabase writing (no Google Sheets)
- ✅ Full conversation threads visible
- ✅ On-demand fetching with caching

---

**You're all set! 🎉**

Run the sync, open the dashboard, and start previewing conversations!
