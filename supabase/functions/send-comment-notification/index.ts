import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface NotificationRequest {
  comment_id: string;
  mentions: Array<{ email: string; user_id: string }>;
  comment_text: string;
  commenter_name: string;
  conversation_id: string;
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  if (!resendApiKey) throw new Error('RESEND_API_KEY is not configured');

  const fromAddress = Deno.env.get('EMAIL_FROM') || 'QA Dashboard <notifications@qadashboard-eight.vercel.app>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromAddress, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend API error ${res.status}: ${err}`);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const appUrl = Deno.env.get('APP_URL') || 'https://qadashboard-eight.vercel.app';

    const body: NotificationRequest = await req.json();
    const { mentions, comment_text, commenter_name, conversation_id } = body;

    console.log('Processing notifications for mentions:', mentions);

    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const mention of mentions) {
      const subject = `You were mentioned in a QA review — Conversation ${conversation_id}`;
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
          <div style="background: #1e40af; padding: 24px 32px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">QA Dashboard</h1>
          </div>
          <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
            <h2 style="margin-top: 0; color: #111827;">You were mentioned in a feedback comment</h2>
            <p style="color: #374151;"><strong>${commenter_name}</strong> mentioned you while reviewing conversation <strong>${conversation_id}</strong>:</p>
            <blockquote style="border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 20px 0; background: white; border-radius: 0 4px 4px 0; color: #374151;">
              ${comment_text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
            </blockquote>
            <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">
              View in Dashboard
            </a>
            <p style="margin-top: 32px; color: #9ca3af; font-size: 13px;">
              You received this email because you were @mentioned in QA Dashboard feedback.
            </p>
          </div>
        </div>
      `;

      try {
        await sendEmail(mention.email, subject, html);
        results.push({ email: mention.email, success: true });
        console.log('Email sent to:', mention.email);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ email: mention.email, success: false, error: message });
        console.error('Failed to send email to', mention.email, ':', message);
      }
    }

    const notifiedUserIds = results.filter((r) => r.success).map((r) => {
      const match = mentions.find((m) => m.email === r.email);
      return match?.user_id;
    }).filter(Boolean) as string[];

    if (notifiedUserIds.length > 0) {
      await supabase
        .from('comment_mentions')
        .update({ notified: true })
        .in('mentioned_user_id', notifiedUserIds);
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified_count: results.filter((r) => r.success).length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending notifications:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});