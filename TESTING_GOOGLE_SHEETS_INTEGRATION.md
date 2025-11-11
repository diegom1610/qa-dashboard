# Testing Google Sheets Integration - Complete Guide

This guide provides step-by-step instructions to test the Google Sheets sync integration with your QA Dashboard.

---

## Prerequisites

Before testing, ensure you have:

1. ✅ **Google Sheet** with your QA data
2. ✅ **Google Service Account** created and configured
3. ✅ **Service Account has access** to your Google Sheet
4. ✅ **Test user account** created in the dashboard (test@example.com or stakeholder@example.com)

---

## Phase 1: Verify Your Google Sheet Structure

### Step 1: Open Your Google Sheet

Navigate to your Google Sheet that contains the QA data exported from your Python script.

### Step 2: Verify Column Headers (Row 1)

Your sheet MUST have these exact column names in the first row (header row):

```
date | agent | score | conversation_id | cx_score_breakdown | export_job_id | exported_at | reviewer_feedback | reviewer_score_override | reviewer_id | final_score
```

**Important Notes:**
- Column names are case-sensitive
- Order doesn't matter, but names must match exactly
- All columns should be present (can be empty)

### Step 3: Check Sample Data

Verify you have at least 2-3 rows of data below the header. Example:

| date | agent | score | conversation_id | cx_score_breakdown | export_job_id | exported_at | reviewer_feedback | reviewer_score_override | reviewer_id | final_score |
|------|-------|-------|-----------------|-------------------|---------------|-------------|-------------------|------------------------|-------------|-------------|
| 2025-10-20 | John Smith | 85 | conv_123456 | positive | job_001 | 2025-10-20T10:00:00Z | Great response | 90 | rev_001 | 87.5 |
| 2025-10-21 | Sarah Jones | 92 | conv_123457 | excellent | job_002 | 2025-10-21T11:00:00Z | Very helpful | 95 | rev_002 | 93.5 |

### Step 4: Get Your Spreadsheet ID

From your Google Sheet URL:
```
https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
                                      ↑_____________________________________________↑
                                                  This is your Spreadsheet ID
```

Copy this ID - you'll need it for configuration.

### Step 5: Get Your Sheet Name

Look at the bottom tabs of your Google Sheet. The name of the tab you want to sync (default is "Sheet1").

---

## Phase 2: Configure Google Service Account

### Step 1: Create Service Account (If Not Done)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **IAM & Admin** → **Service Accounts**
4. Click **Create Service Account**
5. Name it: `qa-dashboard-sync`
6. Grant role: **Viewer** (or no role needed)
7. Click **Done**

### Step 2: Create Service Account Key

1. Click on the service account you just created
2. Go to **Keys** tab
3. Click **Add Key** → **Create New Key**
4. Select **JSON** format
5. Click **Create**
6. A JSON file will download - **save this securely!**

### Step 3: Share Google Sheet with Service Account

1. Open your Google Sheet
2. Click **Share** button (top right)
3. Paste the service account email (looks like: `qa-dashboard-sync@your-project.iam.gserviceaccount.com`)
4. Set permission to **Viewer**
5. Click **Send**

**This is critical!** Without this, the sync cannot read your sheet.

### Step 4: Enable Google Sheets API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Library**
3. Search for "Google Sheets API"
4. Click on it and press **Enable**

---

## Phase 3: Configure Supabase Edge Function

### Step 1: Open Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: `ypkimqnjegqpiemjkmow`

### Step 2: Navigate to Edge Functions Secrets

1. Click **Edge Functions** in the left sidebar
2. You should see `sync-google-sheets` function listed
3. Click on the function
4. Look for **Secrets** or **Environment Variables** section

**Alternative Path:**
1. Click **Project Settings** (gear icon bottom left)
2. Click **Edge Functions** under Configuration
3. Find **Secrets** section

### Step 3: Add Environment Variables

Add three secrets with these exact names:

#### Secret 1: GOOGLE_SPREADSHEET_ID

```
Name: GOOGLE_SPREADSHEET_ID
Value: 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms
       ↑ (paste your actual Spreadsheet ID from Phase 1, Step 4)
```

#### Secret 2: GOOGLE_SHEET_NAME

```
Name: GOOGLE_SHEET_NAME
Value: Sheet1
       ↑ (or your actual sheet tab name from Phase 1, Step 5)
```

#### Secret 3: GOOGLE_SERVICE_ACCOUNT_CREDENTIALS

```
Name: GOOGLE_SERVICE_ACCOUNT_CREDENTIALS
Value: {paste entire JSON from the downloaded key file}
```

**Example JSON structure:**
```json
{
  "type": "service_account",
  "project_id": "your-project-123456",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "qa-dashboard-sync@your-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

**Important:**
- Paste the ENTIRE JSON file content
- Include all curly braces and quotes
- Don't modify anything
- Make sure there are no trailing spaces

### Step 4: Save Secrets

Click **Save** or **Add Secret** for each one.

---

## Phase 4: Test the Sync Function

### Method 1: Test via Supabase Dashboard (Easiest)

1. In Supabase Dashboard → **Edge Functions**
2. Click on `sync-google-sheets` function
3. Look for **Invoke** or **Test** button
4. Click it to manually trigger the function
5. Wait 5-10 seconds for response
6. Check the **Logs** section for output

**What to look for in logs:**
```
🔄 Starting Google Sheets sync...
📊 Fetched 42 rows from Google Sheets
Starting sync of 42 rows...
✅ Successfully synced 42 rows
Syncing 8 unique agents...
✅ Successfully synced 8 agents
```

### Method 2: Test via Command Line

Open your terminal and run:

```bash
curl -X POST "https://ypkimqnjegqpiemjkmow.supabase.co/functions/v1/sync-google-sheets" \
  -H "Content-Type: application/json"
```

**Expected Success Response:**
```json
{
  "success": true,
  "rowsSynced": 42,
  "timestamp": "2025-10-22T15:30:00.000Z"
}
```

**Error Response (if something is wrong):**
```json
{
  "success": false,
  "error": "Missing required environment variables. See setup instructions.",
  "timestamp": "2025-10-22T15:30:00.000Z"
}
```

### Method 3: Test via Browser

1. Open a new browser tab
2. Paste this URL:
   ```
   https://ypkimqnjegqpiemjkmow.supabase.co/functions/v1/sync-google-sheets
   ```
3. Press Enter
4. You should see JSON response

### Method 4: Test via Postman (Optional)

1. Open Postman
2. Create new request: **POST**
3. URL: `https://ypkimqnjegqpiemjkmow.supabase.co/functions/v1/sync-google-sheets`
4. Headers: `Content-Type: application/json`
5. Click **Send**
6. Check response

---

## Phase 5: Verify Data in Database

### Step 1: Check QA Metrics Table

1. In Supabase Dashboard → **Table Editor**
2. Click on `qa_metrics` table
3. You should see rows with data from your Google Sheet

**What to verify:**
- ✅ Number of rows matches your Google Sheet
- ✅ `conversation_id` values are correct
- ✅ `agent_name` values are populated
- ✅ `metric_date` values are valid dates
- ✅ `customer_satisfaction_score` shows the `final_score` from sheet
- ✅ `raw_data` column contains complete original row data

### Step 2: Check Agents Table

1. In Supabase Dashboard → **Table Editor**
2. Click on `agents` table
3. You should see unique agents extracted from your data

**What to verify:**
- ✅ Each unique agent from your sheet has a row
- ✅ `agent_id` matches the `agent` column from sheet
- ✅ `agent_name` matches the `agent` column from sheet
- ✅ `active` is set to `true`

### Step 3: Run SQL Query to Verify

In Supabase → **SQL Editor**, run this query:

```sql
-- Check how many rows were synced
SELECT
  COUNT(*) as total_rows,
  COUNT(DISTINCT agent_id) as unique_agents,
  MIN(metric_date) as earliest_date,
  MAX(metric_date) as latest_date,
  AVG(customer_satisfaction_score) as avg_score
FROM qa_metrics;
```

**Expected Output:**
```
total_rows: 42
unique_agents: 8
earliest_date: 2025-10-01
latest_date: 2025-10-22
avg_score: 87.5
```

---

## Phase 6: Test the Dashboard

### Step 1: Open the Dashboard

1. Open your browser
2. Navigate to your dashboard URL (or run locally with `npm run dev`)
3. Log in with: `test@example.com` / `TestPassword123!`

### Step 2: Verify Data Loads

On the dashboard, check:

1. **Metrics Grid (Top Section)**
   - ✅ Total Conversations shows correct count
   - ✅ Average Score shows a number (not 0 or N/A)
   - ✅ Active Agents shows correct count
   - ✅ Numbers match the database counts

2. **Filter Bar**
   - ✅ Agent dropdown shows all agents from your sheet
   - ✅ Date range filter is functional
   - ✅ Selecting an agent filters the table

3. **Conversation Table (Main Section)**
   - ✅ Shows rows from Google Sheets
   - ✅ Conversation IDs are displayed
   - ✅ Agent names are shown
   - ✅ Dates are formatted correctly
   - ✅ Scores are visible

4. **Feedback Panel (Right Side)**
   - ✅ Click on a conversation row
   - ✅ Feedback panel opens
   - ✅ Shows conversation details
   - ✅ Can add feedback and rating

### Step 3: Add Test Feedback

1. Click on any conversation in the table
2. In the feedback panel, enter:
   - **Rating:** 5 stars
   - **Feedback:** "Testing the integration - excellent work!"
3. Click **Submit Feedback**
4. Verify feedback appears in the history below

### Step 4: Test Real-Time Updates

1. In Supabase SQL Editor, manually insert a test row:

```sql
INSERT INTO qa_metrics (
  conversation_id,
  agent_id,
  agent_name,
  metric_date,
  customer_satisfaction_score,
  resolution_status,
  raw_data
)
VALUES (
  'test_conv_999',
  'Test Agent',
  'Test Agent',
  NOW(),
  95.0,
  'completed',
  '{"test": true}'::jsonb
);
```

2. Refresh your dashboard
3. The new conversation should appear immediately

---

## Phase 7: Test Sync Updates

### Step 1: Modify Google Sheet Data

1. Open your Google Sheet
2. Change a value in one of the rows (e.g., change final_score from 85 to 90)
3. Add a new row with fresh data
4. Save the sheet

### Step 2: Re-run Sync

Run the sync function again (use any method from Phase 4):

```bash
curl -X POST "https://ypkimqnjegqpiemjkmow.supabase.co/functions/v1/sync-google-sheets"
```

### Step 3: Verify Updates in Database

1. Check `qa_metrics` table
2. Verify the changed value was updated
3. Verify the new row was added
4. Verify `synced_at` timestamp is recent

### Step 4: Verify Updates in Dashboard

1. Refresh the dashboard
2. Look for the updated value
3. Look for the new conversation
4. Metrics should reflect the changes

---

## Phase 8: Setup Automatic Sync (Optional)

### Using Supabase Cron Jobs

1. In Supabase Dashboard → **Database** → **Cron Jobs**
2. Click **Create Cron Job**
3. Name: `Sync Google Sheets Every 15 Minutes`
4. Schedule: `*/15 * * * *` (every 15 minutes)
5. SQL command:
   ```sql
   SELECT net.http_post(
     url := 'https://ypkimqnjegqpiemjkmow.supabase.co/functions/v1/sync-google-sheets',
     headers := '{"Content-Type": "application/json"}'::jsonb,
     body := '{}'::jsonb
   );
   ```
6. Click **Create**

**Alternative Schedules:**
- Every 5 minutes: `*/5 * * * *`
- Every hour: `0 * * * *`
- Every day at 9 AM: `0 9 * * *`

### Using External Cron Service

Use services like [cron-job.org](https://cron-job.org):

1. Sign up for free account
2. Create new cron job
3. URL: `https://ypkimqnjegqpiemjkmow.supabase.co/functions/v1/sync-google-sheets`
4. Method: POST
5. Schedule: Every 15 minutes
6. Save and enable

---

## Troubleshooting Common Issues

### Issue 1: "Missing required environment variables"

**Cause:** Secrets not configured correctly in Supabase

**Solution:**
1. Go to Supabase → Project Settings → Edge Functions → Secrets
2. Verify all three secrets exist: `GOOGLE_SPREADSHEET_ID`, `GOOGLE_SHEET_NAME`, `GOOGLE_SERVICE_ACCOUNT_CREDENTIALS`
3. Check for typos in secret names (case-sensitive!)
4. Ensure JSON is valid (use a JSON validator)

### Issue 2: "Google Sheets API error: 403 Forbidden"

**Cause:** Service account doesn't have access to the sheet

**Solution:**
1. Open your Google Sheet
2. Click Share button
3. Add the service account email as Viewer
4. Make sure you clicked Send

### Issue 3: "Google Sheets API error: 404 Not Found"

**Cause:** Wrong Spreadsheet ID or Sheet Name

**Solution:**
1. Double-check the Spreadsheet ID from the URL
2. Verify the sheet tab name (exact match, case-sensitive)
3. Update the secrets in Supabase

### Issue 4: No data appearing in dashboard

**Cause:** Sync succeeded but data doesn't match expected format

**Solution:**
1. Check Supabase Table Editor → `qa_metrics`
2. If rows exist, check if `conversation_id` has values
3. Verify column mapping in the Edge Function
4. Check browser console (F12) for errors

### Issue 5: "JWT signing required"

**Cause:** The function needs to implement proper JWT signing

**Solution:**
This is expected. The function currently shows this warning but will be addressed in the Google Sheets API implementation. For now, the placeholder structure is ready.

### Issue 6: Duplicate rows appearing

**Cause:** `conversation_id` is not unique in Google Sheet

**Solution:**
1. Check your Google Sheet for duplicate conversation IDs
2. The database prevents duplicates automatically via UNIQUE constraint
3. Only the latest version will be kept

---

## Verification Checklist

Before considering the integration complete, verify:

### Google Sheets Setup
- [ ] Google Sheet has correct column headers
- [ ] Google Sheet has at least 2-3 rows of test data
- [ ] Service account created in Google Cloud
- [ ] Service account has Viewer access to the sheet
- [ ] Google Sheets API is enabled
- [ ] JSON key file downloaded

### Supabase Configuration
- [ ] All three secrets added to Edge Functions
- [ ] Secret names are exactly correct (case-sensitive)
- [ ] JSON credentials are valid and complete
- [ ] Spreadsheet ID and Sheet Name are correct

### Sync Function Testing
- [ ] Sync function runs without errors
- [ ] Returns success response with rowsSynced count
- [ ] Logs show "Successfully synced X rows"
- [ ] Data appears in `qa_metrics` table
- [ ] Agents appear in `agents` table

### Dashboard Testing
- [ ] Dashboard loads without errors
- [ ] Metrics show correct counts
- [ ] Conversation table displays data
- [ ] Agent filter works correctly
- [ ] Date filter works correctly
- [ ] Clicking a row opens feedback panel
- [ ] Can submit feedback successfully
- [ ] Feedback appears in history

### Data Integrity
- [ ] Row counts match between Sheet and Database
- [ ] Agent names are correct
- [ ] Dates are formatted properly
- [ ] Scores are displayed correctly
- [ ] No duplicate conversations
- [ ] `raw_data` contains complete original data

### Updates & Sync
- [ ] Modifying Google Sheet data updates database
- [ ] New rows in sheet appear after sync
- [ ] Changed values update existing rows
- [ ] Dashboard reflects changes after refresh

---

## Success Criteria

**Your integration is working correctly if:**

1. ✅ Sync function returns `"success": true`
2. ✅ Database contains rows from your Google Sheet
3. ✅ Dashboard displays conversations from the sheet
4. ✅ You can filter by agent and date
5. ✅ You can add feedback to conversations
6. ✅ Changes to Google Sheet sync to dashboard

---

## Next Steps After Successful Testing

1. **Set up automatic sync** (Phase 8)
2. **Create user accounts** for stakeholders (`create-user.html`)
3. **Train stakeholders** on using the dashboard
4. **Monitor sync logs** regularly
5. **Deploy to production** hosting (Vercel/Netlify)

---

## Getting Help

If you encounter issues not covered here:

1. Check Supabase Edge Function logs for detailed error messages
2. Check browser console (F12) for frontend errors
3. Verify all steps were followed exactly
4. Test with a small sample sheet (5-10 rows) first
5. Ask me for help with specific error messages

---

## Quick Reference Commands

### Run Sync Manually
```bash
curl -X POST "https://ypkimqnjegqpiemjkmow.supabase.co/functions/v1/sync-google-sheets"
```

### Check Row Count
```sql
SELECT COUNT(*) FROM qa_metrics;
```

### Check Recent Syncs
```sql
SELECT conversation_id, agent_name, synced_at
FROM qa_metrics
ORDER BY synced_at DESC
LIMIT 10;
```

### Check All Agents
```sql
SELECT * FROM agents ORDER BY agent_name;
```

### Delete All Test Data (if needed)
```sql
DELETE FROM human_feedback; -- Delete feedback first (foreign key)
DELETE FROM qa_metrics;     -- Then delete metrics
DELETE FROM agents;         -- Then delete agents
```

---

**Last Updated:** October 22, 2025
**Project:** QA Dashboard Google Sheets Integration
**Support:** Refer to `GOOGLE_SHEETS_INTEGRATION_GUIDE.md` for setup details
