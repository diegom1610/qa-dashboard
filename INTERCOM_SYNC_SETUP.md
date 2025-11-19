# Intercom Sync Setup Guide

## Overview

Your Intercom data syncs automatically using a **Supabase Edge Function** that runs in the cloud. No service role key or Python scripts needed!

---

## ✅ What's Already Done

1. **Edge Function Deployed**: `sync-intercom-conversations`
2. **GitHub Actions Workflow**: Configured to run daily at 2 AM UTC
3. **Dashboard Integration**: Full conversation threads load automatically when clicking "View"

---

## 🔧 Setup Steps

### Step 1: Configure Intercom Token

You need to add your Intercom API token to Bolt's environment:

**Option A: Using Bolt's Environment Variables (Recommended)**

1. In Bolt, look for **"Environment Variables"** or **"Secrets"** in the settings
2. Add these variables:
   ```
   INTERCOM_TOKEN=your_intercom_access_token_here
   INTERCOM_APP_ID=b37vb7kt
   ```

**Option B: Direct Configuration**

If Bolt doesn't expose environment variable settings, the Edge Function will automatically use the Supabase Secrets that are configured during deployment.

**Where to Get Your Intercom Token:**

1. Go to [Intercom Dashboard](https://app.intercom.com)
2. Click **Settings** → **Developers** → **Developer Hub**
3. Select your app (or create a new one)
4. Go to **Authentication** section
5. Copy the **Access Token**
6. **Required permissions**:
   - ✅ Read conversations
   - ✅ Read admins

---

### Step 2: Configure GitHub Actions (Optional - For Automated Daily Sync)

If you want automated daily syncing via GitHub Actions:

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Add this secret:
   ```
   Name: VITE_SUPABASE_URL
   Value: https://cpmohzeoweeckkflspft.supabase.co
   ```

**That's it!** You don't need the service role key for GitHub Actions because the Edge Function handles authentication.

---

## 🚀 How to Use

### Manual Sync (Test It Now)

Trigger a sync manually using curl or your browser:

```bash
curl -X POST 'https://cpmohzeoweeckkflspft.supabase.co/functions/v1/sync-intercom-conversations' \
  -H "Content-Type: application/json" \
  -d '{"days": 1}'
```

**Parameters:**
- `days`: Number of days to sync (default: 1)

**Example responses:**

Success:
```json
{
  "success": true,
  "message": "Synced 45 conversations",
  "conversations_processed": 45,
  "date_range": {
    "start": "2025-11-18T00:00:00.000Z",
    "end": "2025-11-19T00:00:00.000Z"
  }
}
```

Error:
```json
{
  "success": false,
  "error": "INTERCOM_TOKEN not configured"
}
```

---

### Automated Sync (GitHub Actions)

Once you push the workflow file to GitHub:

1. **Automatic runs**: Daily at 2 AM UTC
2. **Manual trigger**:
   - Go to **Actions** tab in GitHub
   - Click **"Sync Intercom Data to Supabase"**
   - Click **"Run workflow"**
   - Watch it run in real-time

---

## 📊 How It Works

```
┌────────────────────────────────────────────────────────┐
│              GITHUB ACTIONS (Daily 2 AM)               │
│  Triggers Edge Function via HTTP POST                  │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│         SUPABASE EDGE FUNCTION (Cloud-Based)           │
│  Function: sync-intercom-conversations                 │
│  - Fetches conversations from Intercom API             │
│  - Resolves agent names                                │
│  - Extracts AI scores                                  │
│  - Writes to Supabase database                         │
└────────────────────────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────┐
│              SUPABASE DATABASE (qa_metrics)            │
│  Conversations appear in dashboard automatically       │
└────────────────────────────────────────────────────────┘
```

---

## 🔍 Monitoring

### Check Edge Function Logs

1. In Bolt, look for **"Functions"** or **"Edge Functions"** section
2. Click on **sync-intercom-conversations**
3. View execution logs and errors

### Check Database

Run this query in Supabase SQL Editor:

```sql
-- Check latest synced conversations
SELECT
  conversation_id,
  agent_name,
  ai_score,
  metric_date,
  created_at
FROM qa_metrics
ORDER BY created_at DESC
LIMIT 10;

-- Check sync freshness
SELECT
  COUNT(*) as total_conversations,
  MAX(metric_date) as latest_conversation_date,
  MAX(created_at) as last_sync_time
FROM qa_metrics;
```

### Check GitHub Actions

1. Go to your GitHub repository
2. Click **Actions** tab
3. See all past runs and their status
4. Click any run to see detailed logs

---

## ⚙️ Advanced Configuration

### Sync More Days

To sync the last 7 days instead of 1:

```bash
curl -X POST 'https://cpmohzeoweeckkflspft.supabase.co/functions/v1/sync-intercom-conversations' \
  -H "Content-Type: application/json" \
  -d '{"days": 7}'
```

Or update the GitHub Actions workflow:

```yaml
- name: Trigger Supabase Edge Function
  run: |
    curl -X POST '${{ secrets.VITE_SUPABASE_URL }}/functions/v1/sync-intercom-conversations' \
      -H "Content-Type: application/json" \
      -d '{"days": 7}' \
      --fail-with-body
```

### Change Sync Schedule

Edit `.github/workflows/sync-intercom.yml`:

```yaml
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours
    # OR
    - cron: '0 2 * * 1'    # Weekly (Monday 2 AM)
    # OR
    - cron: '0 2 1 * *'    # Monthly (1st day, 2 AM)
```

---

## 🆘 Troubleshooting

### "INTERCOM_TOKEN not configured"

**Solution**: Add `INTERCOM_TOKEN` to your Bolt environment variables or Supabase secrets.

### "Failed to fetch conversations"

**Causes:**
- Invalid Intercom token
- Token lacks required permissions
- No conversations in the date range

**Solution**:
1. Verify token at [Intercom Developer Hub](https://app.intercom.com/a/apps/_/developer-hub)
2. Check permissions: Read conversations, Read admins
3. Try syncing more days: `{"days": 7}`

### "Supabase configuration missing"

**Solution**: This should auto-configure. If it doesn't, contact Bolt support or manually add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge Function secrets.

### No data in dashboard

**Steps:**
1. Manually trigger the sync (see "Manual Sync" above)
2. Check Edge Function logs for errors
3. Run database query to verify data exists
4. Refresh dashboard (Ctrl+R)

---

## 📝 Summary

**You DO NOT need:**
- ❌ Service role key exposed in GitHub
- ❌ Python scripts running on your machine
- ❌ Manual intervention after setup

**You DO have:**
- ✅ Cloud-based Edge Function (always running)
- ✅ Automated daily sync via GitHub Actions
- ✅ Secure API token handling
- ✅ Real-time conversation thread fetching

**Next steps:**
1. Add `INTERCOM_TOKEN` to environment
2. Test manual sync with curl
3. Push workflow to GitHub
4. Verify automatic sync runs daily

Your dashboard is live at: **https://qadashboard-eight.vercel.app/**
