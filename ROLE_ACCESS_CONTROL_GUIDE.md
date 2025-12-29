# Role-Based Access Control - Implementation Guide

## Overview

The QA Dashboard now implements strict role-based access control where:
- **New users default to "agent" role**
- **Only administrators can change user roles**
- **@ mentions now show all existing users in the database**

---

## User Roles & Permissions

### Agent (Default Role)
- ✅ View all feedback and evaluations
- ✅ Add comments to discussions
- ✅ @ mention other users
- ✅ Participate in conversations
- ❌ **Cannot submit new feedback evaluations**
- ❌ **Cannot change user roles**

### Evaluator
- ✅ All agent permissions PLUS:
- ✅ Submit feedback evaluations
- ✅ Rate conversations with detailed scoring
- ❌ **Cannot change user roles**

### Administrator
- ✅ Full access to all features
- ✅ Submit feedback evaluations
- ✅ **Change user roles (exclusive permission)**
- ✅ Manage all system settings

---

## How @ Mentions Work Now

### Fixed Issue: Users Now Appear in Dropdown

Previously, the @ mention system wasn't showing users. This has been fixed:

**What Changed:**
- Now queries the `user_roles` view directly
- Shows all users in the database
- Displays up to 10 matching users
- Includes role badges for each user

**How to Use:**
1. Type `@` in the comment box
2. **All users immediately appear** in a dropdown
3. Start typing to filter by email
4. Click a user to insert their mention
5. User will receive notification

**Example:**
```
Type: @
See: All users with their roles
Type: @diego
See: diego@skyprivate.com (admin)
Click: Inserts @diego@skyprivate.com
```

---

## Role Management (Admin Only)

### Current Behavior

**For Admins:**
- Can see and change the "User Role" selector in Settings
- Can assign any role to themselves or others
- Dropdown shows: Agent, Evaluator, Administrator

**For Evaluators & Agents:**
- See their current role displayed (read-only)
- Message: "Only administrators can change user roles"
- Shows what permissions they have
- Cannot modify the role field

### Settings UI by Role

#### Admin View:
```
⚙️ Settings

🛡️ User Role
[Dropdown: Agent | Evaluator | Administrator]

Evaluators: Can submit feedback evaluations
Agents: Can only view and comment on evaluations
Admins: Full access to all features

🕐 Timezone
[Dropdown: UTC | America/New_York | ...]

[Save Settings]
```

#### Agent/Evaluator View:
```
⚙️ Settings

🛡️ Current Role: agent
Only administrators can change user roles.
Contact your admin if you need a role change.
✓ You can view and comment on evaluations

🕐 Timezone
[Dropdown: UTC | America/New_York | ...]

[Save Settings]
```

---

## Creating New Users

### Default Role Assignment

When a new user is created:
1. **Automatically assigned "agent" role**
2. User settings record created with default values:
   - Role: `agent`
   - Timezone: `UTC`
3. Only admins can later change the role

### Using the Create User Function

The `create-user` edge function has been updated:

```typescript
// POST to /functions/v1/create-user
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "role": "agent"  // Optional, defaults to "agent"
}
```

**Default behavior:**
- If `role` is omitted → defaults to "agent"
- Admins can specify role during creation
- User settings automatically created

---

## Technical Implementation

### Database Changes

**`user_settings` table:**
```sql
- role: text DEFAULT 'agent' CHECK (role IN ('evaluator', 'agent', 'admin'))
- Only admins can update role field
```

**`user_roles` view:**
```sql
- Combines auth.users with user_settings
- Returns: id, email, role, timezone
- Used for @ mentions and role checks
```

### Frontend Changes

**`FeedbackComments.tsx`:**
- ✅ Fixed: Now fetches from `user_roles` view
- ✅ Shows all users when typing @
- ✅ Filters by search term
- ✅ Displays role badges

**`Sidebar.tsx`:**
- ✅ Role selector only visible to admins
- ✅ Read-only display for non-admins
- ✅ Update function only saves role if user is admin

**`FeedbackPanel.tsx`:**
- ✅ Checks user role before allowing feedback submission
- ✅ Shows appropriate message for agents

---

## Security Model

### Row Level Security (RLS)

All tables have RLS enabled with policies:

**`user_settings`:**
- Users can view their own settings
- Users can update their own timezone
- **Only admins can update role field** (enforced in application)

**`feedback_comments`:**
- All authenticated users can view
- Users can create their own comments
- Users can edit/delete only their comments

**`comment_mentions`:**
- All authenticated users can view
- System can insert/update mentions

### Access Control Flow

```
User Action → Check Role → Grant/Deny Access

Submit Feedback:
  Agent → ❌ Denied (show message)
  Evaluator → ✅ Allowed
  Admin → ✅ Allowed

Change Role:
  Agent → ❌ Hidden (show current role)
  Evaluator → ❌ Hidden (show current role)
  Admin → ✅ Allowed (show dropdown)

Add Comment:
  Agent → ✅ Allowed
  Evaluator → ✅ Allowed
  Admin → ✅ Allowed

@ Mention:
  All → ✅ Allowed (see all users)
```

---

## Usage Examples

### Scenario 1: Agent Reviews Feedback

1. **Manuel** (agent) logs in
2. Views conversation with feedback from Diego
3. Clicks "Discussion (0)" to expand
4. Types: `@diego@skyprivate.com This score seems incorrect...`
5. Dropdown shows all users including Diego
6. Clicks Diego's email to insert mention
7. Writes full comment, clicks Send
8. Diego receives notification

### Scenario 2: Admin Changes User Role

1. **Diego** (admin) logs in
2. Opens Settings (☰ menu)
3. Sees "User Role" dropdown
4. Wants to promote Anna to evaluator:
   - Admin would need a user management interface (future feature)
   - For now, can use Supabase dashboard or SQL

### Scenario 3: Agent Tries to Submit Feedback

1. **Anna** (agent) views a conversation
2. Tries to submit feedback
3. Sees yellow warning:
   ```
   ⚠️ Evaluator Access Required
   Only evaluators and administrators can submit feedback evaluations.
   You can view existing feedback and add comments below.
   Current role: agent
   ```
4. Can still comment on existing feedback

---

## Admin Tasks

### Promoting a User to Evaluator

**Option 1: Using Supabase Dashboard**
1. Go to Table Editor
2. Open `user_settings` table
3. Find user by email in the `user_roles` view
4. Edit their `role` field
5. Change from `agent` to `evaluator`
6. Save

**Option 2: Using SQL**
```sql
UPDATE user_settings
SET role = 'evaluator'
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'anna@skyprivate.com'
);
```

**Option 3: Future Enhancement**
- Build admin panel in the dashboard
- List all users
- Change roles with dropdown
- Real-time updates

---

## Troubleshooting

### @ Mentions Not Showing Users

**Problem:** Dropdown empty when typing @

**Solution:**
1. ✅ Fixed: Now queries `user_roles` view
2. Ensure `user_roles` view exists in database
3. Check browser console for errors
4. Verify RLS policies allow reading `user_roles`

**Test Query:**
```sql
SELECT * FROM user_roles;
-- Should return all users with emails and roles
```

### Can't Change Role in Settings

**Expected Behavior:**
- Agents and Evaluators: Should NOT see dropdown
- Admins: Should see dropdown

**If admin can't change role:**
1. Check user's role in `user_settings` table
2. Ensure role is exactly `'admin'` (not 'administrator')
3. Refresh the page
4. Clear browser cache

### New Users Not Getting Agent Role

**Check:**
1. `user_settings` table has `DEFAULT 'agent'` on role column
2. `create-user` function is being used
3. User settings record was created

**Verify:**
```sql
SELECT u.email, COALESCE(us.role, 'MISSING') as role
FROM auth.users u
LEFT JOIN user_settings us ON u.id = us.user_id;
```

---

## Best Practices

### For Admins

1. **Create users with appropriate roles** from the start
2. **Monitor role assignments** regularly
3. **Document role changes** (use comments in Supabase)
4. **Review permissions** when promoting users

### For Evaluators

1. **Submit detailed feedback** with clear scoring
2. **Respond to agent comments** promptly
3. **Use @ mentions** to notify relevant stakeholders
4. **Document reasoning** in feedback text

### For Agents

1. **Use comments to ask questions** about evaluations
2. **@ mention evaluators** for clarification
3. **Be professional** in discussions
4. **Request role changes** through proper channels

---

## Future Enhancements

Potential improvements:
- [ ] Admin panel for user management
- [ ] Bulk role assignment
- [ ] Role change history/audit log
- [ ] Email notifications for role changes
- [ ] Permission groups/teams
- [ ] Custom role creation
