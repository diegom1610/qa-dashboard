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

function ratingBar(rating: number, max: number = 20): string {
  const pct = Math.round((rating / max) * 100);
  const color = pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
  return `
    <div style="background: #e5e7eb; border-radius: 4px; height: 10px; width: 100%; margin: 8px 0;">
      <div style="background: ${color}; width: ${pct}%; height: 10px; border-radius: 4px;"></div>
    </div>
    <p style="margin: 4px 0; color: ${color}; font-weight: 600;">${rating}/${max} (${pct}%)</p>
  `;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      agent_email,
      reviewer_email,
      rating,
      feedback_text,
      conversation_id,
    }: FeedbackNotificationRequest = await req.json();

    const appUrl = Deno.env.get('APP_URL') || 'https://qadashboard-eight.vercel.app';

    console.log('Sending feedback notification to:', agent_email);

    const subject = `New QA Feedback — Conversation ${conversation_id}`;
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: #1e40af; padding: 24px 32px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">QA Dashboard</h1>
        </div>
        <div style="background: #f9fafb; padding: 32px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
          <h2 style="margin-top: 0; color: #111827;">You received a new QA evaluation</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; color: #6b7280; width: 140px;">Conversation</td>
              <td style="padding: 8px 0; font-weight: 600;">${conversation_id}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280;">Reviewed by</td>
              <td style="padding: 8px 0;">${reviewer_email}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #6b7280; vertical-align: top;">Score</td>
              <td style="padding: 8px 0;">${ratingBar(rating)}</td>
            </tr>
          </table>
          ${
            feedback_text
              ? `<div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
                   <p style="margin: 0 0 8px 0; color: #6b7280; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Feedback</p>
                   <p style="margin: 0; color: #374151; white-space: pre-line;">${feedback_text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
                 </div>`
              : '<p style="color: #6b7280;">No written feedback was provided.</p>'
          }
          <a href="${appUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
            View Full Evaluation
          </a>
          <p style="margin-top: 32px; color: #9ca3af; font-size: 13px;">
            You received this email because a QA evaluator submitted feedback on one of your conversations.
          </p>
        </div>
      </div>
    `;

    await sendEmail(agent_email, subject, html);
    console.log('Feedback notification sent to:', agent_email);

    return new Response(
      JSON.stringify({ success: true, to: agent_email, conversation_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending notification:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Failed to send notification' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});