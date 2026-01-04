# Email Integration Guide - FREE with Resend

Complete step-by-step guide to add email notifications to the QA Dashboard.

**FREE Tier**: 3,000 emails/month, 100 emails/day - Forever free, no credit card required

---

## Overview

This guide will help you:
1. Set up free email service with Resend
2. Configure Supabase Edge Functions
3. Send automatic notifications when agents receive feedback
4. Send notifications when users are mentioned in comments

**Total Time**: 15-30 minutes

---

## Step 1: Create Resend Account (2 minutes)

### 1.1 Sign Up
1. Go to: [https://resend.com](https://resend.com)
2. Click **"Sign Up"** (top right corner)
3. Choose sign-up method:
   - Email address
   - GitHub account (recommended)
4. Verify your email address

### 1.2 Verify Account
- Check your email inbox
- Click verification link
- You'll be redirected to Resend Dashboard

**No credit card required!**

---

## Step 2: Get API Key (1 minute)

### 2.1 Create API Key
1. In Resend Dashboard, go to: [https://resend.com/api-keys](https://resend.com/api-keys)
2. Click **"Create API Key"**
3. Enter details:
   - **Name**: `qa-dashboard-production`
   - **Permission**: Select "Sending access"
4. Click **"Add"**

### 2.2 Copy Your Key
- Your key will appear **once** (starts with `re_`)
- Example: `re_123abc456def789ghi012jkl345mno678`
- **IMPORTANT**: Copy it now - you won't see it again!
- Save it temporarily in a secure place

---

## Step 3: Configure Domain

You have two options:

### Option A: Use Resend Test Domain (Easiest - 0 minutes)

**Pros:**
- Works immediately, no setup
- Perfect for testing

**Cons:**
- Emails come from: `onboarding@resend.dev`
- Can only send to verified email addresses in Resend
- Not suitable for production

**How to use:**
- Skip to Step 4
- Change `from:` in code to: `onboarding@resend.dev`

---

### Option B: Use Your Own Domain (Recommended - 10 minutes)

**Pros:**
- Professional sender address: `qa-notifications@skyprivate.com`
- Send to anyone
- Production ready

**Setup:**

1. **Add Domain in Resend**
   - Go to: [https://resend.com/domains](https://resend.com/domains)
   - Click **"Add Domain"**
   - Enter: `skyprivate.com`

2. **Add DNS Records**

   Resend will show you 3 DNS records to add. You need to add them to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.).

   Example records:
   ```
   Type: TXT
   Name: @
   Value: v=spf1 include:_spf.resend.com ~all

   Type: CNAME
   Name: resend._domainkey
   Value: resend._domainkey.resend.com

   Type: CNAME
   Name: resend
   Value: feedback-smtp.resend.com
   ```

3. **Wait for Verification**
   - DNS changes take 5-15 minutes
   - Resend will automatically verify
   - You'll see a green checkmark when ready

---

## Step 4: Add API Key to Supabase (2 minutes)

### 4.1 Open Supabase Dashboard
1. Go to: [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click on your project name

### 4.2 Add Secret
1. Go to: **Project Settings** (bottom left gear icon)
2. Click: **Edge Functions** (in left sidebar)
3. Scroll to: **Environment Variables** section
4. Click: **"Add new secret"**
5. Enter:
   - **Name**: `RESEND_API_KEY`
   - **Value**: Paste your API key (from Step 2)
6. Click: **"Save"**

**Important**: The secret is now available to all your edge functions automatically.

---

## Step 5: Update Edge Functions (5 minutes)

You need to update two edge functions to send actual emails instead of just logging.

### 5.1 Update `send-feedback-notification`

Open: `supabase/functions/send-feedback-notification/index.ts`

Replace entire file with:

```typescript
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FeedbackNotificationRequest {
  agent_email: string;
  reviewer_email: string;
  rating: number;
  feedback_text: string | null;
  conversation_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const {
      agent_email,
      reviewer_email,
      rating,
      feedback_text,
      conversation_id,
    }: FeedbackNotificationRequest = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const emailBody = `
Hello,

You have received new feedback on conversation ${conversation_id}.

Reviewer: ${reviewer_email}
Rating: ${rating}/20 stars

${feedback_text ? `Feedback:\n${feedback_text}` : 'No detailed feedback provided.'}

---
Log in to view the full feedback and respond:
https://qadashboard-eight.vercel.app

This is an automated notification from the QA Dashboard.
    `.trim();

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'QA Dashboard <notifications@skyprivate.com>',
        to: [agent_email],
        reply_to: reviewer_email,
        subject: `New Feedback Received - ${rating}/20 stars`,
        text: emailBody,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const data = await res.json();

    console.log('Email sent successfully:', {
      id: data.id,
      to: agent_email,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email notification sent successfully',
        email_id: data.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to send notification',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
```

**IMPORTANT**: Change `from:` email to match your setup:
- If using Option A (test): `from: 'QA Dashboard <onboarding@resend.dev>'`
- If using Option B (your domain): `from: 'QA Dashboard <notifications@skyprivate.com>'`

---

### 5.2 Update `send-comment-notification`

Open: `supabase/functions/send-comment-notification/index.ts`

Replace entire file with:

```typescript
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CommentNotificationRequest {
  comment_id: string;
  mentions: Array<{ email: string; user_id: string }>;
  comment_text: string;
  commenter_name: string;
  conversation_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const {
      mentions,
      comment_text,
      commenter_name,
      conversation_id,
    }: CommentNotificationRequest = await req.json();

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const results = [];
    for (const mention of mentions) {
      const emailBody = `
Hello,

${commenter_name} mentioned you in a comment on conversation ${conversation_id}:

"${comment_text}"

---
Log in to view and respond:
https://qadashboard-eight.vercel.app

This is an automated notification from the QA Dashboard.
      `.trim();

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'QA Dashboard <notifications@skyprivate.com>',
          to: [mention.email],
          reply_to: commenter_name,
          subject: `${commenter_name} mentioned you in a comment`,
          text: emailBody,
        }),
      });

      if (!res.ok) {
        const error = await res.text();
        console.error(`Failed to send to ${mention.email}:`, error);
      } else {
        const data = await res.json();
        results.push({ email: mention.email, id: data.id });
      }
    }

    console.log('Emails sent:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Comment notifications sent',
        sent: results,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error sending notifications:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to send notifications',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
```

**IMPORTANT**: Change `from:` email to match your setup (same as above).

---

## Step 6: Deploy Functions

The functions will be automatically deployed when you save the changes in bolt.new.

To verify deployment:
1. Check Supabase Dashboard
2. Go to: **Edge Functions** (in left sidebar)
3. You should see:
   - `send-feedback-notification` (green dot = deployed)
   - `send-comment-notification` (green dot = deployed)

---

## Step 7: Test Email Notifications (5 minutes)

### Test 1: Feedback Notification

1. **As Evaluator (diego@skyprivate.com)**:
   - Log in to dashboard
   - Open any conversation by Manuel
   - Submit feedback with rating and comment
   - Click Submit

2. **Check Manuel's Email**:
   - Open inbox for: `juan.manuel@skyprivate.com`
   - Look for email: "New Feedback Received - X/20 stars"
   - From: QA Dashboard
   - Should arrive within 1-2 seconds

3. **Check Console**:
   - Open browser console (F12 → Console)
   - Should see: `Email sent successfully: { id: '...', to: '...' }`

---

### Test 2: Comment Mention

1. **As Evaluator**:
   - Open conversation with feedback
   - Add comment: "@manuel@skyprivate.com Great work!"
   - Click Post Comment

2. **Check Manuel's Email**:
   - Look for: "diego@skyprivate.com mentioned you in a comment"
   - Should include the comment text

3. **Check Console**:
   - Should see: `Emails sent: [{ email: '...', id: '...' }]`

---

## Troubleshooting

### Error: "RESEND_API_KEY not configured"

**Problem**: API key not set in Supabase

**Solution**:
1. Go to Supabase Dashboard
2. Project Settings → Edge Functions
3. Add secret: `RESEND_API_KEY` = your key
4. Redeploy functions

---

### Error: "550 Recipient address rejected"

**Problem**: Using test domain, recipient not verified

**Solution Option 1** (Quick):
1. Go to: [https://resend.com/emails](https://resend.com/emails)
2. Click "Verify Email"
3. Enter agent's email address
4. Agent confirms via email
5. Try again

**Solution Option 2** (Better):
- Set up your own domain (see Step 3, Option B)
- Change `from:` to your domain
- Can now send to anyone

---

### Emails Going to Spam

**Problem**: Emails landing in spam folder

**Solutions**:
1. **Use Your Domain**: Set up SPF/DKIM (Step 3, Option B)
2. **Whitelist Sender**: Add sender to contacts
3. **Check Spam Folder**: Move to inbox and mark "Not Spam"
4. **Professional From**: Use `notifications@yourdomain.com`

---

### Rate Limit Exceeded

**Problem**: "Too many requests"

**Resend Free Limits**:
- 100 emails/day
- 3,000 emails/month

**Solutions**:
1. **Monitor Usage**: [https://resend.com/emails](https://resend.com/emails)
2. **Upgrade if Needed**: Resend Pro = $20/month for 50,000 emails
3. **Optimize**: Only send on important events

---

## Cost Breakdown

### Resend Free Tier (Forever Free)
```
- 3,000 emails/month
- 100 emails/day
- No credit card required
- Perfect for: 10-20 users, ~150 feedbacks/month
```

### Resend Pro ($20/month)
```
- 50,000 emails/month
- No daily limit
- Multiple domains
- Priority support
- Perfect for: 50+ users, high volume
```

### Example Usage
```
Team size: 15 users
Feedbacks/day: 20
Mentions/day: 10
Total emails/day: 30
Total emails/month: 900 (well within free tier!)
```

---

## Monitoring & Logs

### View Email Logs in Resend
1. Go to: [https://resend.com/emails](https://resend.com/emails)
2. See all sent emails
3. Check delivery status
4. View error messages

### View Function Logs in Supabase
1. Supabase Dashboard → Edge Functions
2. Click function name
3. Click "Logs" tab
4. See real-time execution logs

### View Console Logs in Browser
1. Press F12 → Console tab
2. Look for:
   - `Email sent successfully: {...}`
   - `Resend API error: ...`

---

## Security Best Practices

1. **Never commit API keys to code**
   - Always use environment variables
   - Already configured in Supabase secrets

2. **Validate email addresses**
   - Frontend checks @ symbol
   - Backend validates format

3. **Rate limiting**
   - Resend has built-in limits
   - Prevents abuse

4. **Monitor usage**
   - Check Resend dashboard weekly
   - Set up usage alerts

---

## Alternative Email Services

If Resend doesn't work for you:

### SendGrid
- **Free**: 100 emails/day
- **Pros**: Well-established, good docs
- **Cons**: More complex setup
- Link: [sendgrid.com](https://sendgrid.com)

### Mailgun
- **Free**: 1,000 emails/month (3 months trial)
- **Pros**: Good deliverability
- **Cons**: Requires credit card
- Link: [mailgun.com](https://mailgun.com)

### Amazon SES
- **Cost**: $0.10 per 1,000 emails
- **Pros**: Extremely cheap at scale
- **Cons**: Complex AWS setup
- Link: [aws.amazon.com/ses](https://aws.amazon.com/ses)

---

## Complete Setup Checklist

- [ ] Create Resend account
- [ ] Get API key from Resend
- [ ] Choose domain option (test or own)
- [ ] If own domain: Add DNS records
- [ ] Add RESEND_API_KEY to Supabase
- [ ] Update send-feedback-notification function
- [ ] Update send-comment-notification function
- [ ] Change `from:` email in both functions
- [ ] Verify functions deployed (green dots)
- [ ] Test feedback notification
- [ ] Test mention notification
- [ ] Check email inbox
- [ ] Check console logs
- [ ] Verify emails not in spam
- [ ] Monitor Resend dashboard

**Estimated Time**: 15-30 minutes

---

## Support Resources

- **Resend Docs**: [resend.com/docs](https://resend.com/docs)
- **Resend Support**: support@resend.com
- **Supabase Docs**: [supabase.com/docs/guides/functions](https://supabase.com/docs/guides/functions)
- **This Dashboard**: Check console logs for errors

---

## What Happens After Setup

### When Evaluator Submits Feedback:
1. Feedback saved to database
2. System identifies agent from conversation
3. Edge function called: `send-feedback-notification`
4. Resend API sends email
5. Agent receives email within 1-2 seconds
6. Email includes: reviewer, rating, feedback text, link to dashboard

### When Someone Mentions a User:
1. Comment saved with @ mention
2. System extracts mentioned email
3. Edge function called: `send-comment-notification`
4. Resend API sends email
5. Mentioned user receives notification
6. Email includes: commenter, comment text, link to dashboard

---

## Success Indicators

You'll know it's working when:
- ✅ Console shows: "Email sent successfully"
- ✅ Resend dashboard shows sent emails
- ✅ Agent receives email in inbox (not spam)
- ✅ Email content is correct
- ✅ Links in email work
- ✅ No errors in Supabase function logs

---

## Maintenance

### Weekly
- Check Resend dashboard for usage
- Monitor delivery rates
- Review any bounced emails

### Monthly
- Review email templates for improvements
- Check spam reports
- Verify DNS records still valid

### As Needed
- Update edge function code
- Add new notification types
- Customize email templates

---

## Conclusion

After following this guide:
1. Your QA Dashboard sends real email notifications
2. Agents get notified when they receive feedback
3. Users get notified when mentioned in comments
4. All emails are free (up to 3,000/month)
5. Professional sender address (if using own domain)
6. Production-ready email system

**Total Cost**: $0/month (or $20/month for high volume)

**Next Steps**: Test thoroughly, monitor usage, enjoy automatic notifications!

---

Need help? Check console logs, Resend logs, and Supabase function logs for detailed error messages.
