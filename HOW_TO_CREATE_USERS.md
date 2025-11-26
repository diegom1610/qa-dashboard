# How to Create User Accounts

Since the Supabase UI doesn't show the "Add User" option, I've created **two simple methods** for you to create user accounts.

---

## Method 1: User Creation Tool (Easiest)

I've created a simple HTML tool that you can use to create users with a nice interface.

### Steps:

1. **Open the tool:**
   - Navigate to your project folder
   - Open the file `create-user.html` in your web browser
   - (You can double-click it or right-click → Open With → Chrome/Firefox)

2. **Fill in the form:**
   - Enter the stakeholder's email address
   - Enter a temporary password (minimum 6 characters)
   - Click "Create User Account"

3. **Share credentials:**
   - The tool will display the email and password
   - Copy and send to the stakeholder securely
   - They can change the password after first login

4. **Track created users:**
   - The tool remembers the last 10 users you created
   - You can copy credentials again if needed

**That's it!** The user can now log in to the dashboard immediately.

---

## Method 2: Using curl (Command Line)

If you prefer command line or need to automate user creation:

### For Mac/Linux:

```bash
curl -X POST "https://cpmohzeoweeckkflspft.supabase.co/functions/v1/create-user" \
  -H "Content-Type: application/json" \
  -d '{"email":"stakeholder@company.com","password":"TempPass123!"}'
```

### For Windows PowerShell:

```powershell
$body = @{
    email = "stakeholder@company.com"
    password = "TempPass123!"
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://cpmohzeoweeckkflspft.supabase.co/functions/v1/create-user" `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

### Success Response:

```json
{
  "success": true,
  "message": "User created successfully",
  "user": {
    "id": "067f73c0-50e8-42c5-8d79-a1b104676c46",
    "email": "stakeholder@company.com",
    "created_at": "2025-10-21T18:44:51.467838+00:00"
  }
}
```

### Error Response:

```json
{
  "error": "Failed to create user",
  "message": "User already registered"
}
```

---

## Method 3: Direct SQL (If Everything Else Fails)

If for some reason the Edge Function doesn't work, you can still create users via SQL.

### Steps:

1. Go to Supabase Dashboard
2. Click "SQL Editor" in left sidebar
3. Paste this query (change email and password):

```sql
-- Create a new user
SELECT
  auth.uid() as current_user,
  supabase_auth.create_user(
    email := 'stakeholder@company.com',
    password := 'TempPass123!',
    email_confirmed := true
  ) as new_user;
```

If that doesn't work, use this alternative:

```sql
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'stakeholder@company.com', -- Change this
  crypt('TempPass123!', gen_salt('bf')), -- Change this
  NOW(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  NOW(),
  NOW()
);
```

4. Click "Run" to execute
5. User is created instantly

---

## Bulk User Creation

Need to create multiple users at once? Use this bash script:

### Create a file called `create-users.sh`:

```bash
#!/bin/bash

# Array of users (email:password)
USERS=(
  "john@company.com:Password123!"
  "sarah@company.com:Password456!"
  "mike@company.com:Password789!"
)

# Supabase Edge Function URL
URL="https://cpmohzeoweeckkflspft.supabase.co/functions/v1/create-user"

# Loop through users and create accounts
for user in "${USERS[@]}"; do
  IFS=':' read -r email password <<< "$user"

  echo "Creating user: $email"

  response=$(curl -s -X POST "$URL" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}")

  echo "Response: $response"
  echo "---"
done

echo "All users created!"
```

### Run it:

```bash
chmod +x create-users.sh
./create-users.sh
```

---

## Verifying Users Were Created

To check if users exist, run this SQL query:

```sql
SELECT
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;
```

---

## Password Requirements

- Minimum 6 characters
- No maximum length
- Can include letters, numbers, symbols
- Case sensitive

**Recommended format:**
- Capital letter + lowercase + numbers + symbol
- Example: `Welcome2024!`

---

## Troubleshooting

### Error: "User already registered"

**Solution:** This email is already in use. Either:
1. Use a different email
2. Delete the existing user first
3. Have the user reset their password

### Error: "Invalid email format"

**Solution:** Check that email:
- Contains @ symbol
- Has domain (e.g., .com, .org)
- No spaces or special characters (except @, ., -)

### Error: "Password too short"

**Solution:** Password must be at least 6 characters. Use a longer password.

### Error: "Failed to create user"

**Possible causes:**
1. Network connection issue
2. Supabase service temporarily down
3. Edge Function not deployed correctly

**Solution:** Try again in a few minutes. If persists, use Method 3 (Direct SQL).

---

## Security Best Practices

1. **Generate Strong Passwords:**
   - Use a password generator
   - Minimum 12 characters recommended
   - Include uppercase, lowercase, numbers, symbols

2. **Share Credentials Securely:**
   - Don't send via regular email
   - Use encrypted messaging (Signal, WhatsApp)
   - Or use a password manager share feature
   - Or tell them in person

3. **Temporary Passwords:**
   - Inform users to change password after first login
   - Set up password change flow in dashboard (future enhancement)

4. **Track User Creation:**
   - Keep a record of when and who created accounts
   - The HTML tool stores last 10 in browser localStorage
   - Or maintain a spreadsheet

---

## Creating Your First Test Account

After fixing the Supabase URL, create a test account using the HTML tool or command line to verify everything works correctly.

---

## Next Steps

1. **Create accounts for your stakeholders** using Method 1 (HTML tool)
2. **Share credentials** with them securely
3. **Have them log in** and test the dashboard
4. **Complete Google Sheets integration** (see GOOGLE_SHEETS_INTEGRATION_GUIDE.md)
5. **Deploy to production** when ready

---

## Need Help?

If you encounter any issues:

1. Check this document first
2. Try a different method
3. Check browser console (F12) for errors
4. Verify Supabase URL is correct in `create-user.html`
5. Ask me for help!

---

## Quick Reference

**User Creation Tool:** Open `create-user.html` in browser

**Command Line:**
```bash
curl -X POST "https://cpmohzeoweeckkflspft.supabase.co/functions/v1/create-user" \
  -H "Content-Type: application/json" \
  -d '{"email":"EMAIL","password":"PASSWORD"}'
```

**Verify Users:**
```sql
SELECT email, created_at FROM auth.users ORDER BY created_at DESC;
```

---

**Last Updated:** October 21, 2025
