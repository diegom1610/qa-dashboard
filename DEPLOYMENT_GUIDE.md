# Deployment Guide - QA Dashboard

This guide will walk you through deploying your QA Dashboard so stakeholders can access it via email login.

## Overview

**Good News:** You don't need to buy hosting! Your project uses:
- **Supabase** for database + authentication + hosting
- **Vercel/Netlify** for free frontend hosting (recommended)

Total cost: **FREE** for moderate usage (perfect for internal tools)

---

## Option 1: Deploy to Vercel (Recommended - Easiest)

### Step 1: Push Code to GitHub

1. **Create a GitHub account** (if you don't have one): https://github.com/signup

2. **Create a new repository**:
   - Go to https://github.com/new
   - Name it: `qa-dashboard`
   - Choose: Private (recommended for internal tools)
   - Click "Create repository"

3. **Push your code to GitHub**:
   ```bash
   # In your project directory
   git init
   git add .
   git commit -m "Initial commit - QA Dashboard"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/qa-dashboard.git
   git push -u origin main
   ```

### Step 2: Deploy to Vercel

1. **Sign up for Vercel**: https://vercel.com/signup
   - Sign up with your GitHub account (easiest)

2. **Import your project**:
   - Click "Add New Project"
   - Select your `qa-dashboard` repository
   - Vercel will auto-detect it's a Vite project

3. **Configure Environment Variables**:
   Click "Environment Variables" and add these from your `.env` file:
   ```
   VITE_SUPABASE_URL=your_supabase_url_here
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

4. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes
   - Your app will be live at: `https://your-project-name.vercel.app`

5. **Custom Domain (Optional)**:
   - In Vercel dashboard → Settings → Domains
   - Add your custom domain (e.g., `qa-dashboard.yourcompany.com`)
   - Follow DNS setup instructions

---

## Option 2: Deploy to Netlify (Alternative)

### Step 1: Push to GitHub (same as above)

### Step 2: Deploy to Netlify

1. **Sign up for Netlify**: https://app.netlify.com/signup
   - Sign up with GitHub

2. **Import project**:
   - Click "Add new site" → "Import an existing project"
   - Choose GitHub → Select `qa-dashboard` repository

3. **Build settings**:
   ```
   Build command: npm run build
   Publish directory: dist
   ```

4. **Environment Variables**:
   - Go to Site settings → Environment variables
   - Add:
     ```
     VITE_SUPABASE_URL=your_supabase_url_here
     VITE_SUPABASE_ANON_KEY=your_anon_key_here
     ```

5. **Deploy**:
   - Click "Deploy site"
   - Your app will be live at: `https://random-name.netlify.app`

---

## Option 3: Keep in Bolt Environment

### Pros:
- ✅ No setup needed
- ✅ Already working
- ✅ Easy to make changes

### Cons:
- ❌ Requires Bolt subscription
- ❌ URL might change if you restart
- ❌ Not recommended for production/stakeholder access

**Recommendation:** Deploy to Vercel/Netlify for stakeholder access. It's free and more reliable.

---

## Creating Stakeholder Accounts

### Option A: Using the Edge Function (Recommended)

1. **Access the create-user page**:
   ```
   https://your-deployed-url.vercel.app/create-user.html
   ```

2. **Fill in the form**:
   - Email: stakeholder@company.com
   - Password: (create a secure password)
   - Role: (select appropriate role)

3. **Send credentials to stakeholder**:
   ```
   Dashboard URL: https://your-deployed-url.vercel.app
   Email: stakeholder@company.com
   Password: [password you created]

   Please change your password after first login.
   ```

### Option B: Using Supabase Dashboard

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard

2. **Navigate to Authentication**:
   - Click your project
   - Go to "Authentication" → "Users"
   - Click "Add user" → "Create new user"

3. **Create user**:
   - Email: stakeholder@company.com
   - Password: (create a secure password)
   - Auto Confirm User: ✅ (check this)
   - Click "Create user"

4. **Send credentials** (same as above)

### Option C: Bulk User Creation (For Multiple Stakeholders)

Create a CSV file with users:
```csv
email,password,role
john@company.com,SecurePass123!,reviewer
sarah@company.com,SecurePass456!,agent
mike@company.com,SecurePass789!,reviewer
```

Then use the Supabase API or create a simple script to bulk import.

---

## Email Invitations (Professional Approach)

### Template Email for Stakeholders:

```
Subject: Access to QA Dashboard - Your Credentials

Hi [Name],

You now have access to our QA Dashboard for reviewing agent performance.

🔗 Dashboard URL: https://your-dashboard.vercel.app
📧 Email: your.email@company.com
🔑 Password: [temporary_password]

⚠️ Please change your password after your first login.

Dashboard Features:
- Review agent conversations
- View performance metrics
- Filter by date, workspace, and team
- Track quality scores (IQS)

Need help? Reply to this email or contact IT support.

Best regards,
[Your Name]
```

---

## Post-Deployment Checklist

### ✅ Immediate Tasks:

1. **Test the deployment**:
   - [ ] Visit the deployed URL
   - [ ] Try logging in with a test account
   - [ ] Test all features (filters, dashboards, etc.)
   - [ ] Test on mobile devices

2. **Create user accounts**:
   - [ ] Create accounts for all stakeholders
   - [ ] Document credentials securely
   - [ ] Send invitation emails

3. **Configure Supabase**:
   - [ ] Add deployed URL to Supabase "Allowed URLs"
   - [ ] Go to: Authentication → URL Configuration
   - [ ] Add: `https://your-app.vercel.app`

### ✅ Security Tasks:

1. **Password Policy**:
   - [ ] Enforce password changes on first login
   - [ ] Set password requirements in Supabase

2. **Row Level Security**:
   - [ ] Verify RLS is enabled (already done)
   - [ ] Test that users can only see their data

3. **Backup Plan**:
   - [ ] Enable Supabase automated backups
   - [ ] Document recovery procedures

### ✅ Maintenance Tasks:

1. **Monitoring**:
   - [ ] Set up Vercel/Netlify alerts
   - [ ] Monitor Supabase usage

2. **Updates**:
   - [ ] Document how to push updates (git push → auto-deploy)
   - [ ] Train someone on the team

---

## Costs Breakdown

### Free Tier Limits:

**Vercel Free:**
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Custom domains
- Perfect for internal tools

**Netlify Free:**
- ✅ 100GB bandwidth/month
- ✅ 300 build minutes/month
- ✅ Custom domains

**Supabase Free:**
- ✅ 500MB database
- ✅ 2GB file storage
- ✅ 50,000 monthly active users
- ✅ 2GB edge functions invocations

### When You Need to Pay:

**Typical usage for 10-20 users:** Still FREE

**If you exceed free limits:**
- Vercel Pro: $20/month
- Supabase Pro: $25/month
- Total: ~$45/month (only if you grow significantly)

---

## Quick Start Commands

### Update Deployment (After Making Changes):

```bash
# Make your changes
git add .
git commit -m "Description of changes"
git push

# Vercel/Netlify will auto-deploy in 2-3 minutes
```

### View Deployment Logs:

**Vercel:**
```
https://vercel.com/your-username/qa-dashboard/deployments
```

**Netlify:**
```
https://app.netlify.com/sites/your-site-name/deploys
```

---

## Troubleshooting

### Users Can't Log In:

1. **Check Supabase URL Configuration**:
   - Authentication → URL Configuration
   - Add your deployed URL

2. **Check Email Confirmation**:
   - If emails aren't arriving, disable email confirmation:
   - Authentication → Settings → Enable Email Confirmations: OFF

3. **Check User Status**:
   - Authentication → Users
   - Ensure user is "Confirmed"

### App Not Loading:

1. **Check Environment Variables**:
   - Vercel: Settings → Environment Variables
   - Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set
   - Redeploy after adding variables

2. **Check Build Logs**:
   - Look for errors in deployment logs
   - Most common: missing environment variables

### Database Connection Issues:

1. **Check Supabase Status**: https://status.supabase.com
2. **Verify API Keys** in Supabase Dashboard → Settings → API

---

## Recommended Setup for Your Organization

### Phase 1: Initial Deployment (Day 1)
1. Deploy to Vercel (30 minutes)
2. Create 2-3 test accounts
3. Test all features

### Phase 2: User Onboarding (Day 2-3)
1. Create all stakeholder accounts
2. Send invitation emails
3. Provide brief training/demo

### Phase 3: Monitoring (Week 1)
1. Check daily for issues
2. Gather user feedback
3. Make necessary adjustments

### Phase 4: Ongoing (Monthly)
1. Review usage metrics
2. Update as needed
3. Create new accounts when needed

---

## Need Help?

### Common Questions:

**Q: Do I need to pay for hosting?**
A: No! Free tier is sufficient for most internal tools.

**Q: Can I use a custom domain?**
A: Yes! Both Vercel and Netlify support free custom domains.

**Q: How do I update the app?**
A: Just push to GitHub, it auto-deploys in minutes.

**Q: Can stakeholders see each other's data?**
A: No! Row Level Security ensures data isolation.

**Q: What if I want to add more features?**
A: Make changes locally → test → git push → auto-deploy

---

## Next Steps

1. **Choose deployment platform**: Vercel (recommended) or Netlify
2. **Push code to GitHub**: Follow Step 1 above
3. **Deploy**: Follow Steps 2-5 for your chosen platform
4. **Create user accounts**: Use one of the three methods above
5. **Send invitations**: Use the email template
6. **Test thoroughly**: Before sending to stakeholders
7. **Monitor**: Check for issues in the first week

**You're ready to deploy! Let me know if you need help with any step.**
