# QA Dashboard - User Guide

## Getting Started

### Logging In

1. Visit the dashboard URL provided by your administrator
2. Enter your email address
3. Enter your password
4. Click "Sign In"

**Forgot your password?** Contact your administrator to reset it.

---

## Understanding the Dashboard

### Header

Located at the top of every page:
- **Logo**: QA Dashboard branding
- **Refresh Button**: Manually refresh data
- **Your Email**: Shows who you're logged in as
- **Logout Button**: Sign out when finished

### Filters Section

Control what data you see:

**Agent Filter**
- Select one or more agents from the list
- Hold Ctrl (Windows) or Cmd (Mac) to select multiple
- Leave empty to see all agents

**Conversation ID Search**
- Type a specific conversation ID
- Press X icon to clear search

**Date Range**
- **Start Date**: Show conversations from this date onward
- **End Date**: Show conversations up to this date
- Leave empty to see all dates

**Status Filter**
- Select a resolution status
- Options: Resolved, Pending, Escalated, Unknown
- Select "All Statuses" to see everything

**Clear All Button**
- Remove all filters at once
- Returns to showing all data

### Summary Cards

Four key metrics displayed prominently:

**Total Conversations**
- Count of conversations matching your filters
- Updates as you adjust filters

**Avg Response Time**
- Average time agents took to respond
- Shown in seconds (or minutes if > 60s)
- Lower is better

**Avg CSAT Score**
- Average customer satisfaction rating
- Scale of 1.0 to 5.0
- Higher is better

**Resolution Rate**
- Percentage of conversations successfully resolved
- Higher is better

### Conversation Table

Detailed view of each conversation:

**Columns:**
- **Conversation ID**: Unique identifier from Intercom
- **Agent**: Name of the agent who handled it
- **Date**: When the conversation occurred
- **Response Time**: How long until first response
- **CSAT**: Customer satisfaction score (if available)
- **Status**: Resolution status with color coding
  - 🟢 Green: Resolved
  - 🟡 Yellow: Pending
  - 🔴 Red: Escalated
  - ⚫ Gray: Unknown

**Sorting:**
- Click any column header to sort
- Click again to reverse sort direction

**Expanding Rows:**
- Click any row to expand it
- Shows feedback section below
- Click again to collapse

---

## Adding Feedback

### Step 1: Find the Conversation

1. Use filters to narrow down conversations
2. Or search by conversation ID
3. Click the row to expand it

### Step 2: Check Existing Feedback

Look at "Previous Reviews" section:
- See what others have said
- Avoid duplicating feedback
- Build on existing comments

### Step 3: Add Your Review

**Rating (Required)**
- Click 1-5 stars
- 1 star = Poor
- 5 stars = Excellent
- Hover to preview rating

**Categories (Required)**
- Check at least one box
- Multiple selections allowed
- Options:
  - Tone & Empathy
  - Accuracy
  - Efficiency
  - Product Knowledge
  - Problem Resolution
  - Communication Skills

**Detailed Feedback (Optional)**
- Add specific observations
- Provide examples
- Suggest improvements
- Be constructive

**Submit Button**
- Click to save your feedback
- Success message will appear
- Form will clear for next review

---

## Editing Your Feedback

### When to Edit
- Found a typo
- Want to change rating
- Need to add more detail
- Realized you misunderstood something

### How to Edit

1. Find your feedback in "Previous Reviews"
2. Click the pencil (Edit) icon
3. Modify the rating or text
4. Click checkmark (Save) icon
5. Or click X icon to cancel

**Note**: You can only edit your own feedback, not others'.

---

## Deleting Your Feedback

### When to Delete
- Reviewed wrong conversation
- Feedback no longer relevant
- Made duplicate review by mistake

### How to Delete

1. Find your feedback in "Previous Reviews"
2. Click the trash (Delete) icon
3. Confirm deletion in popup
4. Feedback will be removed immediately

**Warning**: Deletion is permanent and cannot be undone.

---

## Best Practices

### Writing Effective Feedback

**Do:**
- ✅ Be specific with examples
- ✅ Focus on observable behaviors
- ✅ Provide context for your rating
- ✅ Suggest improvements when rating low
- ✅ Acknowledge what was done well

**Don't:**
- ❌ Make it personal or attack the agent
- ❌ Be vague ("It was bad")
- ❌ Compare agents against each other
- ❌ Use all caps or excessive punctuation
- ❌ Include sensitive customer information

### Example Good Feedback

> **Rating**: ⭐⭐⭐⭐⭐ (5 stars)
>
> **Categories**: Tone & Empathy, Problem Resolution
>
> **Comments**: "Agent demonstrated excellent active listening by repeating the customer's concern back to them. Provided clear step-by-step instructions that resolved the issue on first contact. Tone remained professional and friendly throughout, even when customer was frustrated."

### Example Poor Feedback

> **Rating**: ⭐⭐ (2 stars)
>
> **Categories**: Communication Skills
>
> **Comments**: "Not good."

**Why poor?** No specific examples, no context, no actionable feedback.

---

## Understanding the Data

### Where Does the Data Come From?

```
Intercom
   ↓ (Your Python script extracts data)
Google Sheets
   ↓ (Synced every 15 minutes)
Dashboard Database
   ↓ (You see it here)
```

### Data Freshness

**QA Metrics:**
- Updated every 15 minutes
- Click refresh button to check for new data
- Last sync time shown in browser console

**Human Feedback:**
- Updated instantly when anyone submits
- You'll see new feedback appear automatically
- No refresh needed

### What If Data Looks Wrong?

1. Check if filters are applied
2. Try clicking "Clear All" filters
3. Click refresh button in header
4. If still wrong, contact your administrator

---

## Keyboard Shortcuts

None currently available, but planned for future release:
- Enter to submit feedback
- Escape to cancel editing
- Arrow keys to navigate table
- Ctrl+F to focus search

---

## Mobile Access

The dashboard works on mobile browsers, but desktop is recommended for:
- Better table viewing
- Easier multi-select filtering
- More comfortable typing feedback

**Mobile Tips:**
- Rotate to landscape for wider view
- Use two fingers to scroll table horizontally
- Tap and hold to multi-select agents

---

## Privacy & Security

### Your Data

**What we track:**
- Your email address
- Your feedback ratings and comments
- When you submit/edit feedback

**What we don't track:**
- Your password (it's encrypted)
- Your browsing history
- Your location

### Who Can See What?

**Everyone can see:**
- All QA metrics
- All feedback from all reviewers

**You can only modify:**
- Your own feedback
- Your own account settings

**Admins can:**
- Create/delete user accounts
- Access database directly
- View all activity

### Session Security

- Your session expires after 1 hour of inactivity
- You'll be automatically logged out
- Just log in again to continue
- Sessions persist across browser tabs

---

## Troubleshooting

### Problem: Can't log in

**Solutions:**
1. Double-check email spelling
2. Try copying/pasting password
3. Clear browser cache and cookies
4. Try a different browser
5. Contact administrator to reset password

### Problem: Page is blank or won't load

**Solutions:**
1. Check your internet connection
2. Try refreshing the page (F5 or Ctrl+R)
3. Clear browser cache
4. Try a different browser
5. Contact your IT department

### Problem: Filters aren't working

**Solutions:**
1. Click "Clear All" and start over
2. Refresh the page
3. Check that data exists for your filter criteria
4. Try one filter at a time to isolate issue

### Problem: Can't submit feedback

**Solutions:**
1. Ensure you selected a rating (1-5 stars)
2. Ensure you checked at least one category
3. Check that conversation ID is valid
4. Try logging out and back in
5. Check browser console for error message

### Problem: Feedback disappeared

**Solutions:**
1. Check that you're viewing the right conversation
2. Another user might have deleted it (if it was theirs)
3. Try refreshing the page
4. Check "Previous Reviews" section carefully
5. Contact administrator if feedback is missing

### Problem: Can't see new data

**Solutions:**
1. Click refresh button in header
2. Check if sync function is running (ask administrator)
3. Verify data exists in Google Sheets
4. Wait 15 minutes for next sync cycle
5. Check "Clear All" filters button

---

## Getting Help

### Self-Service

1. **Check this user guide** - Most questions answered here
2. **Try the troubleshooting section** - Common issues covered
3. **Ask a colleague** - They might have encountered same issue
4. **Check browser console** - Press F12, look for error messages

### Contact Support

If you still need help:

**Email**: [support email]
**Slack**: [support channel]
**Phone**: [support number]

**When contacting support, include:**
- What you were trying to do
- What happened instead
- Error messages (if any)
- Screenshots showing the issue
- Your email address
- Date and time of issue

---

## FAQ

**Q: Why can't I see conversations from last week?**
A: Check your date range filter. Make sure it includes last week's dates.

**Q: Can I delete someone else's feedback?**
A: No, only your own. Contact an administrator if feedback violates policies.

**Q: How often should I review conversations?**
A: Check with your manager. Typically 5-10 per week is recommended.

**Q: Do I need to review every conversation?**
A: No, focus on conversations that are notable (very good or very bad).

**Q: Can I add feedback to old conversations?**
A: Yes, there's no time limit. Feedback can be added anytime.

**Q: Will the agent see my feedback?**
A: Check with your manager about feedback sharing policies.

**Q: Can I export my feedback?**
A: Not currently from the dashboard. Contact administrator for exports.

**Q: Why do I see feedback from other people?**
A: Transparency - all feedback is visible to all reviewers.

**Q: Can I filter by feedback rating?**
A: Not yet, but this feature is planned for a future update.

**Q: How do I change my password?**
A: Contact your administrator to reset your password.

---

## Tips for Power Users

### Efficient Reviewing

1. **Use date ranges** - Review one week at a time
2. **Filter by agent** - Focus on one agent per session
3. **Open multiple tabs** - Compare conversations side-by-side
4. **Keyboard shortcuts** - (Coming soon)

### Finding Issues Quickly

1. **Sort by CSAT score** - Low scores first
2. **Filter by "Pending" status** - Check unresolved issues
3. **Sort by response time** - Find slowest responses

### Adding Context-Rich Feedback

1. Reference specific messages in the conversation
2. Quote the agent's exact words
3. Note customer's emotional state
4. Suggest specific training topics
5. Link to related tickets (in comments)

### Staying Organized

1. Review conversations in batches
2. Set aside dedicated review time
3. Don't rush through feedback
4. Take breaks between batches

---

## Appendix: Rating Guidelines

Use these guidelines for consistent ratings across reviewers:

### 5 Stars - Exceptional
- Exceeded all expectations
- Proactive problem-solving
- Exceptional customer experience
- Worth highlighting as an example

### 4 Stars - Good
- Met all expectations
- Handled well with minor room for improvement
- Professional and effective
- No significant issues

### 3 Stars - Acceptable
- Met basic expectations
- Some areas for improvement
- Acceptable but not noteworthy
- Neither good nor bad

### 2 Stars - Needs Improvement
- Fell short of expectations
- Multiple areas needing work
- Customer likely not fully satisfied
- Training recommended

### 1 Star - Unacceptable
- Failed to meet basic standards
- Significant customer dissatisfaction
- Urgent intervention needed
- Escalate to management

---

**Have feedback on this user guide?** Contact [administrator] with suggestions for improvement.

**Last Updated**: October 20, 2025
