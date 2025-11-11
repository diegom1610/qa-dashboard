# Google Sheets Integration Guide

## Overview
This guide explains EXACTLY how to connect your existing Python script + Google Sheets workflow to the new dashboard. By the end, data will automatically flow from Intercom → Python Script → Google Sheets → Supabase → Dashboard.

---

## Part 1: Understanding the Data Flow

### Current Setup (Before Dashboard)
```
Intercom → Python Script → Google Sheets
                            ↓
                      (Stakeholders view here)
```

### New Setup (With Dashboard)
```
Intercom → Python Script → Google Sheets
                            ↓
                      (Sync Function reads every 15 min)
                            ↓
                        Supabase Database
                            ↓
                      Interactive Dashboard
                            ↓
                    (Stakeholders add feedback here)
```

### Why This Approach?
1. **Non-Disruptive**: Your Python script doesn't change at all
2. **Reliable**: Google Sheets remains the "source of truth" for metrics
3. **Separation of Concerns**: Automated data (Sheets) stays separate from human feedback (Dashboard)
4. **Scalable**: Dashboard can handle filtering, real-time feedback without overloading Sheets

---

## Part 2: Preparing Your Google Sheet

### Step 1: Understand Your Sheet Structure

Your Python script already writes data to Google Sheets. We need to know the exact structure.

**Action Required**: Open your Google Sheet and answer these questions:

1. **What is the Spreadsheet ID?**
   - Look at your sheet URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`
   - Copy the `SPREADSHEET_ID` part
   - Example: `1BxiMVs0XRA5nFMdKvBdBZjgmUaCxlNnNvQA9C6FYabc`

2. **What is the Sheet Name (tab name)?**
   - Look at the bottom of your Google Sheet for tab names
   - Example: "QA Metrics", "Sheet1", "Intercom Data"

3. **What are the column headers (first row)?**
   - Write down the EXACT names from row 1
   - Example: `Conversation ID | Agent ID | Agent Name | Date | Response Time | Status | CSAT`

**Example Sheet Structure**:
```
| Conversation ID | Agent ID | Agent Name    | Date       | Response Time | Status   | CSAT |
|-----------------|----------|---------------|------------|---------------|----------|------|
| conv_12345      | agent_01 | John Smith    | 2025-10-15 | 120           | resolved | 4    |
| conv_12346      | agent_02 | Jane Doe      | 2025-10-16 | 85            | pending  | 5    |
```

### Step 2: Standardize Column Names (Optional but Recommended)

If your column names are different from what we expect, you have two options:

**Option A**: Modify your Python script to use these column names:
- `conversation_id` (unique identifier for each conversation)
- `agent_id` (unique identifier for each agent)
- `agent_name` (display name of agent)
- `date` (when conversation occurred)
- `response_time` (in seconds)
- `status` (e.g., "resolved", "pending", "escalated")
- `csat_score` (1-5 rating, optional)
- `tags` (JSON array of tags, optional)

**Option B**: Keep your existing columns and modify the sync function (we'll do this together)

---

## Part 3: Setting Up Google Service Account

### Why Service Accounts?
A service account is like a "robot user" that can access Google Sheets without requiring a human to log in. This is essential for automated syncing.

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "New Project"
3. Name it: "QA Dashboard Integration"
4. Click "Create"

### Step 2: Enable Google Sheets API

1. In the Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Sheets API"
3. Click "Enable"

### Step 3: Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in:
   - Name: `qa-dashboard-sync`
   - Description: `Service account for syncing Sheets to Supabase`
4. Click "Create and Continue"
5. Skip optional steps, click "Done"

### Step 4: Generate Credentials Key

1. Click on the service account you just created
2. Go to "Keys" tab
3. Click "Add Key" → "Create New Key"
4. Choose "JSON" format
5. Click "Create" - a JSON file will download

**IMPORTANT**: Keep this file secure! It contains credentials to access your Sheets.

### Step 5: Share Your Google Sheet with the Service Account

1. Open the JSON file you downloaded
2. Find the `client_email` field (looks like: `qa-dashboard-sync@your-project.iam.gserviceaccount.com`)
3. Copy this email address
4. Open your Google Sheet
5. Click "Share" button
6. Paste the service account email
7. Set permission to "Viewer" (read-only)
8. Click "Share"

**Why Viewer Only?**: The sync function only needs to READ data. Your Python script continues to WRITE data.

---

## Part 4: Configuring the Sync Function

### Step 1: Add Environment Variables to Supabase

The sync function needs three pieces of information. We'll add them as "secrets" (encrypted environment variables).

**Where to Add These**:
1. Open your Supabase project dashboard
2. Go to "Project Settings" → "Edge Functions" → "Manage Secrets"

**What to Add**:

1. **GOOGLE_SPREADSHEET_ID**
   - Value: The ID from your sheet URL (from Part 2, Step 1)
   - Example: `1BxiMVs0XRA5nFMdKvBdBZjgmUaCxlNnNvQA9C6FYabc`

2. **GOOGLE_SHEET_NAME**
   - Value: The exact tab name from your sheet (from Part 2, Step 1)
   - Example: `QA Metrics`

3. **GOOGLE_SERVICE_ACCOUNT_CREDENTIALS**
   - Value: The ENTIRE contents of the JSON file you downloaded
   - Open the JSON file, copy everything from `{` to `}`
   - Paste as a single-line string

**Screenshot Reference**: [Link to Supabase secrets documentation]

### Step 2: Customize the Data Mapping

If your Google Sheet columns are different from the default mapping, we need to update the sync function.

**Current Mapping** (in `sync-google-sheets` Edge Function):
```typescript
{
  conversation_id: row.conversation_id,
  agent_id: row.agent_id,
  agent_name: row.agent_name,
  metric_date: new Date(row.date).toISOString(),
  response_time_seconds: row.response_time || 0,
  resolution_status: row.status || 'unknown',
  customer_satisfaction_score: row.csat_score || null,
  conversation_tags: row.tags ? JSON.parse(row.tags) : [],
}
```

**Your Mapping** (modify if needed):
```typescript
// Example: If your sheet uses "Conv_ID" instead of "conversation_id"
{
  conversation_id: row['Conv_ID'],          // Match your column name
  agent_id: row['Agent_ID'],
  agent_name: row['Agent_Name'],
  metric_date: new Date(row['Date']).toISOString(),
  response_time_seconds: parseFloat(row['Response_Time']) || 0,
  resolution_status: row['Status'] || 'unknown',
  customer_satisfaction_score: parseFloat(row['CSAT']) || null,
  conversation_tags: row['Tags'] ? JSON.parse(row['Tags']) : [],
}
```

**Action**: Tell me your exact column names, and I'll generate the correct mapping for you.

---

## Part 5: Testing the Integration

### Step 1: Manual Test

Let's test the sync function manually to ensure everything works:

1. **Invoke the Function**:
   ```bash
   curl -X POST https://YOUR_SUPABASE_URL/functions/v1/sync-google-sheets \
     -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
   ```

2. **Check the Response**:
   - Success: `{"success": true, "rowsSynced": 150}`
   - Error: `{"success": false, "error": "Missing required environment variables"}`

3. **Verify in Database**:
   - Go to Supabase Dashboard → "Table Editor"
   - Check `qa_metrics` table - should contain your data
   - Check `agents` table - should contain unique agents

### Step 2: Common Issues and Solutions

**Issue**: `"Missing required environment variables"`
- **Solution**: Verify you added all three secrets in Supabase (Part 4, Step 1)

**Issue**: `"Google Sheets API error: 403 Forbidden"`
- **Solution**: Verify you shared the sheet with the service account email (Part 3, Step 5)

**Issue**: `"Cannot read property 'conversation_id' of undefined"`
- **Solution**: Column names don't match. Update the data mapping (Part 4, Step 2)

**Issue**: Data appears but values are wrong (e.g., dates are numbers)
- **Solution**: Google Sheets date formatting. We'll add transformation logic.

### Step 3: Set Up Scheduled Sync

Once manual testing works, enable automatic syncing:

**Option A: Using Supabase Cron (Recommended)**
1. Go to Supabase Dashboard → "Database" → "Cron Jobs"
2. Create new job:
   ```sql
   SELECT net.http_post(
     url := 'https://YOUR_SUPABASE_URL/functions/v1/sync-google-sheets',
     headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
   ) AS request_id;
   ```
3. Schedule: `*/15 * * * *` (every 15 minutes)

**Option B: External Cron Service**
- Use services like cron-job.org, EasyCron, or AWS EventBridge
- Schedule: Every 15 minutes
- URL: Your Edge Function URL
- Method: POST

---

## Part 6: Verifying Data Quality

After the first sync, verify data accuracy:

### Checklist:

1. **Row Count Matches**
   - Count rows in Google Sheets (excluding header)
   - Count rows in Supabase `qa_metrics` table
   - Should match exactly

2. **Dates Are Correct**
   - Pick 3 random rows
   - Compare dates between Sheets and Supabase
   - Ensure timezone is preserved

3. **Numbers Are Accurate**
   - Check response times, CSAT scores
   - Ensure no corruption (e.g., "120" becoming "1.2")

4. **Agents Are Listed**
   - Check `agents` table
   - Should contain all unique agents from your data
   - Names should match exactly

5. **No Duplicates**
   - Check `qa_metrics` for duplicate `conversation_id` values
   - If found, our upsert logic needs adjustment

---

## Part 7: Ongoing Maintenance

### What to Do When Your Python Script Adds New Data

**Answer**: Nothing! The sync function automatically picks up new rows every 15 minutes.

### What to Do When You Add New Columns to Your Sheet

1. Decide if the dashboard needs this data
2. If yes:
   - Add column to `qa_metrics` table (via migration)
   - Update sync function data mapping
   - Redeploy Edge Function
3. If no: Data will be stored in `raw_data` JSON field (accessible if needed later)

### What to Do When Your Sheet Structure Changes Completely

1. Notify the development team (or yourself if self-managing)
2. Update the sync function mapping
3. Consider migrating existing data if schema changed significantly

---

## Part 8: Troubleshooting Reference

### Sync Function Logs

To view logs and debug issues:
1. Go to Supabase Dashboard → "Edge Functions"
2. Click "sync-google-sheets"
3. View "Logs" tab
4. Look for errors marked with ❌

### Common Log Messages

| Message | Meaning | Action |
|---------|---------|--------|
| `✅ Successfully synced X rows` | Success | None |
| `⚠️ JWT signing required` | OAuth setup incomplete | Complete Part 3 |
| `❌ Sync failed: 404` | Sheet not found | Check sheet name/ID |
| `❌ Supabase upsert error` | Database issue | Check data types match |

---

## Summary: What You Need to Provide

To complete the integration, I need from you:

1. **Google Sheet Spreadsheet ID** (from URL)
2. **Google Sheet Tab Name** (from bottom of sheet)
3. **Column Headers** (exact names from row 1)
4. **Sample Data Row** (one example row to test mapping)
5. **Google Service Account JSON** (after creating per Part 3)

Once you provide these, I'll:
1. Customize the sync function mapping
2. Help you test the first sync
3. Verify data accuracy
4. Set up the schedule

---

## Next Steps

After the sync is working:
1. ✅ Data flows automatically from Sheets to Supabase
2. 🔨 We build the dashboard UI (filters, metrics, feedback forms)
3. 👥 We set up authentication for stakeholders
4. 🚀 We deploy and give stakeholders access

**You are now ready to provide the information from the Summary section above!**
