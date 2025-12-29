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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: NotificationRequest = await req.json();
    const { mentions, comment_text, commenter_name, conversation_id } = body;

    console.log('Processing notifications for mentions:', mentions);

    for (const mention of mentions) {
      console.log(`Notification prepared for ${mention.email}`);

      const emailSubject = `New mention in conversation ${conversation_id}`;
      const emailBody = `
        <h2>You were mentioned in a conversation feedback</h2>
        <p><strong>${commenter_name}</strong> mentioned you in a comment:</p>
        <blockquote style="border-left: 4px solid #3b82f6; padding-left: 16px; margin: 16px 0;">
          ${comment_text}
        </blockquote>
        <p>Conversation ID: <strong>${conversation_id}</strong></p>
        <p><a href="${supabaseUrl}/dashboard" style="color: #3b82f6;">View in Dashboard</a></p>
      `;

      console.log('Email notification logged for:', mention.email);
    }

    await supabase
      .from('comment_mentions')
      .update({ notified: true })
      .in('mentioned_user_id', mentions.map((m) => m.user_id));

    return new Response(
      JSON.stringify({
        success: true,
        notified_count: mentions.length,
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
        error: error instanceof Error ? error.message : 'Unknown error',
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