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

    console.log('Sending feedback notification to:', agent_email);
    console.log('From reviewer:', reviewer_email);
    console.log('Rating:', rating);
    console.log('Conversation ID:', conversation_id);

    const emailBody = `
Hello,

You have received new feedback on conversation ${conversation_id}.

Reviewer: ${reviewer_email}
Rating: ${rating}/20 stars

${feedback_text ? `Feedback:\n${feedback_text}` : 'No detailed feedback provided.'}

---
This is an automated notification from the QA Dashboard.
Log in to view the full feedback and respond: ${Deno.env.get('VITE_APP_URL') || 'https://qadashboard-eight.vercel.app'}
    `.trim();

    console.log('Notification logged:', {
      to: agent_email,
      subject: `New Feedback Received - ${rating}/20 stars`,
      body: emailBody,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Notification logged successfully',
        notification: {
          to: agent_email,
          from: reviewer_email,
          rating,
          conversation_id,
        },
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