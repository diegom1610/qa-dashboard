/**
 * FETCH CONVERSATION THREAD EDGE FUNCTION
 * 
 * PURPOSE:
 * On-demand fetcher for full Intercom conversation threads
 * Called when user clicks a conversation in the dashboard
 * 
 * FEATURES:
 * 1. Checks Supabase cache first (fast)
 * 2. If stale or missing, fetches from Intercom API
 * 3. Parses conversation messages and metadata
 * 4. Stores in database for future use
 * 5. Returns formatted conversation thread
 * 
 * USAGE:
 * POST /functions/v1/fetch-conversation-thread
 * Body: { "conversation_id": "215471253297267" }
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ConversationMessage {
  id: string;
  conversation_id: string;
  part_id: string;
  part_type: string;
  author_type: string;
  author_id: string;
  author_name: string;
  body: string;
  body_html: string;
  created_at: string;
  attachments: any[];
  is_note: boolean;
}

interface ConversationThread {
  conversation_id: string;
  state: string;
  subject: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string;
  tags: string[];
  priority: string;
  synced_at: string;
  messages: ConversationMessage[];
}

function shouldSkipPart(part: any): boolean {
  // Skip conversation events that aren't actual messages
  // These are internal events like tag additions, assignments, etc.
  const partType = part.part_type || '';

  // Check if part has meaningful content first
  const hasContent =
    part.body?.trim() ||
    part.text?.trim() ||
    part.message?.trim() ||
    (part.blocks && Array.isArray(part.blocks) && part.blocks.length > 0);

  // Event types that are usually just metadata (skip even if they have content)
  const alwaysSkipTypes = [
    'tag_added',
    'tag_removed',
    'close',
    'open',
    'snoozed',
    'unsnoozed',
    'state_change',
    'priority_change',
    'language_detection_details',
    'custom_answer_applied',
    'operator_workflow_event',
    'quick_reply',
    'conversation_tags_updated',
    'conversation_attribute_updated_by_admin',
    'default_assignment'
  ];

  if (alwaysSkipTypes.includes(partType)) {
    return true;
  }

  // Assignment events: skip ONLY if they don't have content
  // Sometimes agents send a message along with an assignment
  if (partType === 'assignment') {
    if (!hasContent) {
      return true; // Skip empty assignment events
    }
    // Keep assignment events that have message content
    return false;
  }

  // Skip if no meaningful content exists
  if (!hasContent) {
    console.log('Skipping part with no content:', {
      part_id: part.id,
      part_type: partType,
      author_type: part.author?.type,
      available_fields: Object.keys(part)
    });
    return true;
  }

  return false;
}

function extractMessageBody(part: any): string {
  // Try multiple possible body fields in Intercom response
  // Bot messages, Fin AI, and regular messages can have different structures

  // 1. Standard body field (HTML or text)
  if (part.body && part.body.trim()) {
    return part.body;
  }

  // 2. Text content for bots/automated messages
  if (part.text && part.text.trim()) {
    return part.text;
  }

  // 3. Message content field
  if (part.message && typeof part.message === 'string' && part.message.trim()) {
    return part.message;
  }

  // 4. Blocks content (structured content like cards, buttons)
  if (part.blocks && Array.isArray(part.blocks)) {
    const blockTexts = part.blocks
      .map((block: any) => {
        if (block.text) return block.text;
        if (block.paragraph) return block.paragraph;
        if (block.heading) return block.heading;
        return '';
      })
      .filter(Boolean);
    if (blockTexts.length > 0) {
      return blockTexts.join('\n\n');
    }
  }

  // If we get here, the message has no extractable content
  console.log('Warning: No body found for part', {
    part_id: part.id,
    part_type: part.part_type,
    author_type: part.author?.type,
    available_fields: Object.keys(part)
  });

  return '';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const intercomToken = Deno.env.get('INTERCOM_TOKEN');

    if (!intercomToken) {
      throw new Error('INTERCOM_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversation_id, force_refresh } = await req.json();

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching conversation ${conversation_id}...`);

    // Check cache first (unless force_refresh)
    if (!force_refresh) {
      const { data: cachedThread } = await supabase
        .from('conversation_threads')
        .select('*')
        .eq('conversation_id', conversation_id)
        .maybeSingle();

      if (cachedThread) {
        const syncedAt = new Date(cachedThread.synced_at);
        const ageMinutes = (Date.now() - syncedAt.getTime()) / (1000 * 60);

        // Cache valid for 60 minutes
        if (ageMinutes < 60) {
          console.log(`Using cached conversation (age: ${Math.round(ageMinutes)}m)`);

          // Fetch messages
          const { data: messages } = await supabase
            .from('conversation_messages')
            .select('*')
            .eq('conversation_id', conversation_id)
            .order('created_at', { ascending: true });

          return new Response(
            JSON.stringify({
              ...cachedThread,
              messages: messages || [],
              cached: true
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`Cache stale (${Math.round(ageMinutes)}m), fetching fresh data`);
      }
    }

    // Fetch from Intercom API
    console.log('Fetching from Intercom API...');
    const intercomResponse = await fetch(
      `https://api.intercom.io/conversations/${conversation_id}`,
      {
        headers: {
          'Authorization': `Bearer ${intercomToken}`,
          'Accept': 'application/json',
          'Intercom-Version': '2.14'
        }
      }
    );

    if (!intercomResponse.ok) {
      const errorText = await intercomResponse.text();
      console.error(`Intercom API error: ${intercomResponse.status} ${errorText}`);
      throw new Error(`Intercom API error: ${intercomResponse.status}`);
    }

    const conversation = await intercomResponse.json();
    console.log('✅ Fetched from Intercom');
    console.log(`Conversation has ${conversation.conversation_parts?.conversation_parts?.length || 0} parts`);

    // Parse thread metadata
    const state = conversation.state || 'unknown';
    const subject = conversation.title ||
      conversation.conversation_message?.subject ||
      'No subject';

    const createdAt = conversation.created_at
      ? new Date(conversation.created_at * 1000).toISOString()
      : null;

    const updatedAt = conversation.updated_at
      ? new Date(conversation.updated_at * 1000).toISOString()
      : null;

    const contacts = conversation.contacts?.contacts || [];
    const customer = contacts[0] || {};
    const customerName = customer.name || customer.email || 'Unknown';
    const customerEmail = customer.email || null;

    const tags = conversation.tags?.tags || [];
    const tagList = tags.map((tag: any) => tag.name).filter(Boolean);

    const priority = conversation.priority || 'normal';

    const threadData = {
      conversation_id,
      state,
      subject,
      created_at: createdAt,
      updated_at: updatedAt,
      customer_name: customerName,
      customer_email: customerEmail,
      tags: tagList,
      priority,
      full_data: conversation,
      synced_at: new Date().toISOString()
    };

    // Parse messages
    const messages: ConversationMessage[] = [];

    // First message (initial conversation starter - can be from user or bot)
    const firstMessage = conversation.conversation_message || conversation.source;
    if (firstMessage && !shouldSkipPart(firstMessage)) {
      const author = firstMessage.author || {};
      const messageBody = extractMessageBody(firstMessage);

      console.log('First message:', {
        part_id: firstMessage.id,
        author_type: author.type,
        author_name: author.name,
        has_body: !!firstMessage.body,
        body_length: messageBody.length
      });

      // Only add if we successfully extracted content
      if (messageBody && messageBody.trim()) {
        // Use firstMessage.created_at if available, otherwise fall back to conversation.created_at
        let messageCreatedAt: string;
        if (firstMessage.created_at) {
          messageCreatedAt = new Date(firstMessage.created_at * 1000).toISOString();
        } else if (createdAt) {
          // Use conversation created_at as fallback for source messages
          messageCreatedAt = createdAt;
        } else {
          messageCreatedAt = new Date().toISOString();
        }

        messages.push({
          id: crypto.randomUUID(),
          conversation_id,
          part_id: firstMessage.id || `${conversation_id}_initial`,
          part_type: 'comment',
          author_type: author.type || 'user',
          author_id: author.id || '',
          author_name: author.name || author.email || 'Customer',
          body: messageBody,
          body_html: messageBody,
          created_at: messageCreatedAt,
          attachments: firstMessage.attachments || [],
          is_note: false
        });
      } else {
        console.log('Skipped first message - no content extracted');
      }
    }

    // Conversation parts (replies)
    const parts = conversation.conversation_parts?.conversation_parts || [];
    console.log(`Processing ${parts.length} conversation parts...`);

    let skippedCount = 0;
    for (const part of parts) {
      // Skip conversation events and parts without content
      if (shouldSkipPart(part)) {
        skippedCount++;
        continue;
      }

      const author = part.author || {};
      const partType = part.part_type || 'comment';
      const messageBody = extractMessageBody(part);

      // Double-check: skip if body extraction failed
      if (!messageBody || messageBody.trim() === '') {
        skippedCount++;
        continue;
      }

      console.log('Processing part:', {
        part_id: part.id,
        part_type: partType,
        author_type: author.type,
        author_name: author.name,
        has_body: !!part.body,
        body_length: messageBody.length
      });

      // Check if this is an internal note (part_type starts with 'note')
      const isNote = partType === 'note' || partType.startsWith('note_');

      messages.push({
        id: crypto.randomUUID(),
        conversation_id,
        part_id: part.id || `${conversation_id}_${messages.length}`,
        part_type: partType,
        author_type: author.type || 'unknown',
        author_id: author.id || '',
        author_name: author.name || author.email || 'Unknown',
        body: messageBody,
        body_html: messageBody,
        created_at: part.created_at
          ? new Date(part.created_at * 1000).toISOString()
          : new Date().toISOString(),
        attachments: part.attachments || [],
        is_note: isNote
      });
    }

    console.log(`Skipped ${skippedCount} conversation events/empty parts`);

    console.log(`✅ Parsed ${messages.length} messages total`);
    console.log('Message body lengths:', messages.map(m => ({ name: m.author_name, length: m.body.length })));

    // Store in database
    await supabase.from('conversation_threads').upsert(threadData, {
      onConflict: 'conversation_id'
    });

    if (messages.length > 0) {
      await supabase.from('conversation_messages').upsert(messages, {
        onConflict: 'part_id'
      });
    }

    console.log('✅ Stored in database');

    // Return complete thread
    const result: ConversationThread = {
      ...threadData,
      messages,
    };

    return new Response(
      JSON.stringify({ ...result, cached: false }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching conversation:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
