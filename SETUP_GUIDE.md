# QA Dashboard Setup Guide

## Overview

You now have a complete, production-ready QA performance dashboard. This guide will walk you through:
1. Understanding what was built
2. Setting up user accounts
3. Integrating with your Google Sheets (see separate guide)
4. Testing the system
5. Deploying for stakeholder access

---

## What Was Built

### Database (Supabase)
Three tables were created to store your data:

1. **agents** - List of customer service agents
   - Automatically populated when sync function runs
   - Used for filtering conversations

2. **qa_metrics** - Performance data synced from Google Sheets
   - Conversation details, response times, CSAT scores
   - Read-only for dashboard users (only sync function writes here)

3. **human_feedback** - Reviews from stakeholders
   - Ratings (1-5 stars)
   - Categories (tone, accuracy, efficiency, etc.)
   - Detailed text feedback
   - Users can create, edit, and delete their own feedback

### Authentication System
- Email/password login for stakeholders
- Secure session management
- Row-level security prevents unauthorized access

### Dashboard Features

**Filters:**
- Filter by agent (multi-select)
- Search by conversation ID
- Date range selection
- Resolution status filter

**Metrics Display:**
- Total conversations count
- Average response time
- Average CSAT score
- Resolution rate percentage

**Conversation Table:**
- Sortable columns
- Expandable rows to view/add feedback
- Real-time updates when data changes

**Feedback System:**
- Star rating (1-5)
- Category selection (6 predefined categories)
- Detailed text comments
- Edit/delete own feedback
- View all feedback from other reviewers

---

## Step 1: Create User Accounts

Stakeholders need accounts to access the dashboard.

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to "Authentication" → "Users"
3. Click "Add User" → "Create New User"
4. Enter:
   - Email: stakeholder@yourcompany.com
   - Password: (generate secure password)
   - Auto-confirm user: ✓ (check this box)
5. Click "Create User"
6. Share credentials with stakeholder via secure channel

**Important**: Email confirmation is disabled, so users can log in immediately.

### Option B: Using SQL (Bulk Creation)

If you need to create many users at once:

1. Go to "SQL Editor" in Supabase
2. Run this query for each user:

```sql
INSERT INTO auth.users (
  id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
)
VALUES (
  gen_random_uuid(),
  'user@company.com',
  crypt('temporary_password', gen_salt('bf')),
  now(),
  now(),
  now()
);
```

3. Users should change their password after first login

### User Roles

All users have the same permissions:
- View all QA metrics
- View all feedback from other reviewers
- Add, edit, and delete their own feedback

**Future Enhancement**: Add admin role with ability to:
- Manage agents (activate/deactivate)
- Delete any feedback
- View analytics on reviewer activity

---

## Step 2: Integrate Google Sheets

**See `GOOGLE_SHEETS_INTEGRATION_GUIDE.md` for complete instructions.**

Quick checklist:
- [ ] Get Google Spreadsheet ID
- [ ] Get Sheet name
- [ ] List column headers
- [ ] Create Google Service Account
- [ ] Share sheet with service account email
- [ ] Add environment variables to Supabase
- [ ] Test manual sync
- [ ] Set up scheduled sync (every 15 minutes)

---

## Step 3: Test the System

### 3.1 Test Login

1. Open the dashboard URL (or run locally: `npm run dev`)
2. Try logging in with a test account
3. Verify you see the dashboard (not an error)

**Expected Result**: Dashboard loads with empty state ("No conversations found")

### 3.2 Add Sample Data

Since your Google Sheets sync isn't set up yet, add sample data manually:

1. Go to Supabase Dashboard → "Table Editor"
2. Select "agents" table → "Insert row"
3. Add sample agent:
   - agent_id: `agent_01`
   - agent_name: `John Smith`
   - active: `true`
4. Select "qa_metrics" table → "Insert row"
5. Add sample metric:
   - conversation_id: `conv_12345`
   - agent_id: `agent_01`
   - agent_name: `John Smith`
   - metric_date: `2025-10-20T10:00:00Z`
   - response_time_seconds: `120`
   - resolution_status: `resolved`
   - customer_satisfaction_score: `4.5`
   - conversation_tags: `["billing", "urgent"]`

### 3.3 Test Filtering

1. Refresh dashboard
2. You should see 1 conversation in the table
3. Try filtering:
   - Select "John Smith" in agent filter
   - Type "conv_12345" in conversation ID search
   - Set date range to include today
4. Conversation should remain visible
5. Clear filters
6. Conversation should still be visible

### 3.4 Test Feedback

1. Click on the conversation row to expand it
2. You should see "No feedback yet" message
3. Fill out feedback form:
   - Select 5 stars
   - Check 2-3 categories
   - Type some text
   - Click "Submit Feedback"
4. Success message should appear
5. Form should clear
6. Your feedback should now appear in "Previous Reviews"

### 3.5 Test Edit/Delete

1. Click Edit icon on your feedback
2. Change rating to 4 stars
3. Click Save
4. Feedback should update
5. Click Delete icon
6. Confirm deletion
7. Feedback should disappear

### 3.6 Test Multi-User

1. Open dashboard in incognito window
2. Log in with different user account
3. Navigate to same conversation
4. Add different feedback
5. In original window, new feedback should appear automatically (real-time)

---

## Step 4: Deploy for Production

### Option A: Deploy to Vercel (Recommended)

1. Push code to GitHub repository
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repo
5. Configure:
   - Framework: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables:
     - `VITE_SUPABASE_URL`: (from your .env)
     - `VITE_SUPABASE_ANON_KEY`: (from your .env)
6. Click "Deploy"
7. Vercel will provide a URL like `https://qa-dashboard.vercel.app`

### Option B: Deploy to Netlify

1. Push code to GitHub
2. Go to [netlify.com](https://netlify.com)
3. Click "Add New Site" → "Import from Git"
4. Select your repository
5. Configure:
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Environment variables: (same as Vercel)
6. Click "Deploy"

### Option C: Self-Host

If your company requires on-premise hosting:

1. Build production files: `npm run build`
2. Copy `dist/` folder to your web server
3. Configure web server to serve static files
4. Ensure environment variables are set at runtime

**Example Nginx config:**
```nginx
server {
    listen 80;
    server_name qa-dashboard.yourcompany.com;
    root /var/www/qa-dashboard/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## Step 5: Share with Stakeholders

### 5.1 Prepare Welcome Email

Send this to each stakeholder:

**Subject**: Access to QA Performance Dashboard

Hi [Name],

You now have access to our new QA Performance Dashboard. Here's what you need to know:

**Login Details:**
- URL: https://qa-dashboard.yourcompany.com
- Email: [their email]
- Password: [secure password]

**What You Can Do:**
- View all agent performance metrics
- Filter by agent, date, conversation ID, and status
- See summary statistics (response times, CSAT scores, resolution rates)
- Review individual conversations
- Add your feedback and ratings to conversations
- View feedback from other reviewers

**Getting Started:**
1. Visit the dashboard URL
2. Log in with your credentials
3. Use filters to narrow down conversations
4. Click any conversation row to expand details
5. Add your review with rating, categories, and comments

**Need Help?**
Contact [IT/Admin Contact] or reply to this email.

Best regards,
[Your Name]

### 5.2 Provide Training

**30-Minute Training Session Outline:**

1. **Introduction (5 min)**
   - Purpose of dashboard
   - How data flows from Intercom → Python → Sheets → Dashboard

2. **Navigation (10 min)**
   - Login process
   - Header overview (logo, refresh, logout)
   - Filter bar walkthrough
   - Metrics cards explanation

3. **Using Filters (5 min)**
   - Demo agent multi-select
   - Demo conversation ID search
   - Demo date range picker
   - Demo status filter
   - Show "Clear All" button

4. **Reviewing Conversations (5 min)**
   - Click to expand row
   - Explain metrics displayed
   - Show existing feedback

5. **Adding Feedback (5 min)**
   - Star rating selection
   - Category checkboxes
   - Text comments
   - Submit and success message
   - Edit/delete own feedback

**Q&A (remainder of time)**

---

## Troubleshooting

### Issue: "Error loading data"

**Possible Causes:**
1. Supabase is down (check status.supabase.com)
2. Network connectivity issue
3. Database tables not created

**Solution:**
1. Check browser console for errors
2. Verify environment variables are set correctly
3. Check Supabase logs in dashboard

### Issue: Can't log in

**Possible Causes:**
1. Incorrect password
2. User account not created
3. Email typo

**Solution:**
1. Verify email is correct (check Supabase → Authentication → Users)
2. Reset password via Supabase dashboard
3. Ensure "Auto-confirm" was checked when creating user

### Issue: No conversations showing

**Possible Causes:**
1. Google Sheets sync not configured
2. No data in qa_metrics table
3. Filters too restrictive

**Solution:**
1. Check if GOOGLE_SHEETS_INTEGRATION_GUIDE.md steps were completed
2. Verify data exists in Supabase → Table Editor → qa_metrics
3. Click "Clear All" filters button

### Issue: Feedback submission fails

**Possible Causes:**
1. User not authenticated
2. Database permissions issue
3. Rating not selected

**Solution:**
1. Log out and log back in
2. Check browser console for error details
3. Ensure both rating and category are selected

### Issue: Real-time updates not working

**Possible Causes:**
1. Supabase realtime disabled
2. Browser blocking WebSocket connections
3. Network firewall blocking realtime

**Solution:**
1. Check Supabase → Settings → API → Realtime is enabled
2. Try different network
3. Refresh page manually

---

## Maintenance

### Weekly Tasks
- Review sync function logs for errors
- Check for failed feedback submissions
- Monitor dashboard usage (page views)

### Monthly Tasks
- Review agent list, deactivate former employees
- Audit feedback for inappropriate content
- Check database size and performance

### Quarterly Tasks
- Update stakeholder list (add/remove access)
- Review filter categories, add new ones if needed
- Gather feedback on dashboard UX improvements

---

## Customization Guide

### Add New Feedback Category

1. Edit `src/components/FeedbackPanel.tsx`
2. Find `FEEDBACK_CATEGORIES` array
3. Add new category:
   ```typescript
   { id: 'your_category', label: 'Your Category Name' }
   ```
4. Edit `src/components/FeedbackHistory.tsx`
5. Add to `CATEGORY_LABELS`:
   ```typescript
   your_category: 'Your Category Name',
   ```
6. Rebuild and redeploy

### Add New Resolution Status

1. Edit `src/components/FilterBar.tsx`
2. Find status `<select>` element
3. Add new `<option>`:
   ```html
   <option value="your_status">Your Status</option>
   ```
4. Edit `src/components/ConversationTable.tsx`
5. Add color mapping in `getStatusColor()`:
   ```typescript
   case 'your_status':
     return 'bg-blue-100 text-blue-700 border-blue-200';
   ```
6. Rebuild and redeploy

### Modify Sync Frequency

1. Go to your cron job configuration
2. Change schedule:
   - Every 5 minutes: `*/5 * * * *`
   - Every 30 minutes: `*/30 * * * *`
   - Hourly: `0 * * * *`

### Add More Metrics to Summary Cards

1. Edit `src/components/MetricsGrid.tsx`
2. Add calculation in `calculateSummary()`:
   ```typescript
   const yourMetric = // calculate from metrics array
   ```
3. Add card to `cards` array:
   ```typescript
   {
     title: 'Your Metric',
     value: yourMetric.toString(),
     icon: YourIcon,
     color: 'blue',
     description: 'Description text',
   }
   ```
4. Import icon from lucide-react
5. Rebuild and redeploy

---

## Next Steps

Now that your dashboard is set up:

1. ✅ Complete Google Sheets integration (see other guide)
2. ✅ Create user accounts for all stakeholders
3. ✅ Add sample data and test thoroughly
4. ✅ Deploy to production
5. ✅ Conduct training session
6. ✅ Monitor usage and gather feedback
7. 🔮 Plan future enhancements:
   - Export feedback to CSV
   - Email notifications for new feedback
   - Advanced analytics (trends over time)
   - Agent performance comparisons
   - Automated insights and recommendations

---

## Support

If you encounter issues not covered in this guide:

1. Check browser console for error messages
2. Review Supabase logs in dashboard
3. Verify all environment variables are set
4. Ensure database tables have correct RLS policies
5. Test with a fresh user account

For technical assistance, contact your development team or refer to:
- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
