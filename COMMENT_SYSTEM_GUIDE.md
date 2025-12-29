# Feedback Comment System - User Guide

## Overview

The QA Dashboard now includes a comprehensive comment system that allows agents and evaluators to have discussions about feedback evaluations. This system includes role-based access control, @ mentions, and email notifications.

## User Roles

### Three Role Types:

1. **Agent** (Default)
   - Can view all feedback and evaluations
   - Can add comments to feedback
   - Can @ mention other users
   - **Cannot submit new feedback evaluations**

2. **Evaluator**
   - Can submit feedback evaluations
   - Can view all feedback
   - Can add comments
   - Can @ mention other users

3. **Administrator**
   - Full access to all features
   - Can submit feedback evaluations
   - Can manage all discussions

## Setting Your Role

1. Click the hamburger menu (☰) in the top-left corner
2. Navigate to the **Settings** tab
3. Select your role from the dropdown:
   - Agent
   - Evaluator
   - Administrator
4. Click **Save Settings**

## How Comments Work

### Viewing Comments

- Each feedback evaluation has a "Discussion" section below it
- All comments are displayed chronologically
- Each comment shows:
  - Commenter's email
  - Their role (badge)
  - Timestamp
  - Comment text

### Adding Comments

1. Navigate to a conversation with feedback
2. Expand the feedback in "Previous Reviews"
3. Scroll to the "Discussion" section
4. Type your comment in the text area
5. Use `@` to mention someone (see below)
6. Click **Send**

### @ Mentions

The system supports mentioning other users to notify them:

1. Type `@` in the comment box
2. Start typing an email address
3. A dropdown will appear with matching users
4. Click on a user to insert their mention
5. Mentioned users will be highlighted in the suggestions

**Example:**
```
@diego@skyprivate.com can you review this evaluation?
```

### Role Badges

Comments display colored badges indicating the commenter's role:
- **Blue**: Evaluator
- **Red**: Administrator
- **Gray**: Agent

## Email Notifications

When you mention someone using `@`:
- The system extracts all @ mentions from your comment
- Email notifications are prepared for each mentioned user
- The notification includes:
  - Who mentioned them
  - The comment text
  - The conversation ID
  - A link to view in the dashboard

**Note:** Email notifications are logged and tracked in the database.

## Access Control

### Evaluator-Only Features

Only **Evaluators** and **Administrators** can:
- Submit new feedback evaluations
- Rate conversations using the star system
- Fill out the detailed evaluation form

### What Agents Can Do

**Agents** can:
- View all feedback and evaluations
- Add comments to any feedback
- @ mention evaluators or admins
- Dispute evaluations through comments
- Request re-evaluation

### Restriction Message

If an agent tries to submit feedback, they'll see:
```
⚠️ Evaluator Access Required
Only evaluators and administrators can submit feedback evaluations.
You can view existing feedback and add comments below.
Current role: agent
```

## Best Practices

### For Agents

1. **Review Feedback Thoroughly**: Read all evaluations carefully
2. **Use Comments to Clarify**: Ask questions or provide context
3. **@ Mention Evaluators**: Tag the evaluator who reviewed your conversation
4. **Be Professional**: Maintain a constructive tone in discussions

### For Evaluators

1. **Be Detailed**: Provide clear, specific feedback
2. **Respond to Comments**: Address agent questions promptly
3. **Use @ Mentions**: Tag agents for important updates
4. **Document Decisions**: Use comments to explain scoring decisions

### For Administrators

1. **Monitor Discussions**: Keep track of feedback conversations
2. **Resolve Disputes**: Step in when disagreements occur
3. **Provide Guidance**: Help both agents and evaluators improve

## Real-Time Updates

The comment system uses real-time subscriptions:
- New comments appear automatically without refresh
- Multiple users can collaborate simultaneously
- Changes sync across all open browser tabs

## Privacy & Security

- All comments are visible to authenticated users
- Users can only edit/delete their own comments
- @ mentions are tracked in the database
- Row Level Security (RLS) ensures data integrity
- Comments are permanently linked to feedback

## Troubleshooting

### Can't Submit Feedback

**Issue**: "Evaluator Access Required" message appears

**Solution**:
1. Go to Settings (☰ menu)
2. Change role to "Evaluator" or "Administrator"
3. Save settings
4. Refresh the page

### @ Mentions Not Working

**Issue**: Users don't appear in the dropdown

**Solution**:
1. Ensure you're typing a valid email address
2. The user must have an account in the system
3. Wait a moment for the search to load

### Comments Not Appearing

**Issue**: Comments don't show up after posting

**Solution**:
1. Check your internet connection
2. Refresh the page
3. Ensure you clicked "Send"
4. Check browser console for errors

## Database Tables

The system uses three main tables:

1. **feedback_comments**: Stores all comments
2. **comment_mentions**: Tracks @ mentions
3. **user_settings**: Stores user roles and preferences

## Future Enhancements

Potential features for future releases:
- Edit comment functionality
- Comment threading/replies
- Comment reactions (like, agree, etc.)
- Advanced notification preferences
- Comment search and filtering
- File attachments in comments
