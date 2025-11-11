/*
  # Add Conversation Threads and Messages Tables

  1. New Tables
    - `conversation_threads`
      - Stores full conversation metadata from Intercom
      - `conversation_id` (text, primary key) - Intercom conversation ID
      - `state` (text) - open/closed/snoozed
      - `subject` (text) - Conversation title
      - `created_at` (timestamptz) - When conversation started
      - `updated_at` (timestamptz) - Last message time
      - `customer_name` (text) - Customer display name
      - `customer_email` (text) - Customer email
      - `tags` (jsonb) - Conversation tags
      - `priority` (text) - Priority level
      - `full_data` (jsonb) - Complete Intercom response
      - `synced_at` (timestamptz) - When we last fetched from Intercom
      - `last_viewed_at` (timestamptz) - When last viewed in dashboard
    
    - `conversation_messages`
      - Stores individual messages within conversations
      - `id` (uuid, primary key)
      - `conversation_id` (text, foreign key) - Links to conversation_threads
      - `part_id` (text, unique) - Intercom part ID
      - `part_type` (text) - comment/note/assignment/automated
      - `author_type` (text) - user/admin/bot
      - `author_id` (text) - Intercom author ID
      - `author_name` (text) - Display name
      - `body` (text) - Message text content
      - `body_html` (text) - HTML formatted content
      - `created_at` (timestamptz) - Message timestamp
      - `attachments` (jsonb) - Array of attachment metadata
      - `is_note` (boolean) - Internal note flag
      - `synced_at` (timestamptz) - When stored in database

  2. Security
    - Enable RLS on both tables
    - Authenticated users can read all conversation data
    - Only service role can insert/update conversation data

  3. Indexes
    - Index on conversation_id for fast message lookups
    - Index on created_at for chronological sorting
    - Index on synced_at for cache invalidation
*/

-- Create conversation_threads table
CREATE TABLE IF NOT EXISTS conversation_threads (
  conversation_id TEXT PRIMARY KEY,
  state TEXT,
  subject TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  customer_name TEXT,
  customer_email TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  priority TEXT,
  full_data JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  last_viewed_at TIMESTAMPTZ
);

-- Create conversation_messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL REFERENCES conversation_threads(conversation_id) ON DELETE CASCADE,
  part_id TEXT UNIQUE NOT NULL,
  part_type TEXT NOT NULL,
  author_type TEXT,
  author_id TEXT,
  author_name TEXT,
  body TEXT,
  body_html TEXT,
  created_at TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]'::jsonb,
  is_note BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conv_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created_at ON conversation_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_threads_synced_at ON conversation_threads(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_threads_state ON conversation_threads(state);

-- Enable Row Level Security
ALTER TABLE conversation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversation_threads
CREATE POLICY "Authenticated users can view all conversation threads"
  ON conversation_threads FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Service role can insert conversation threads"
  ON conversation_threads FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "Service role can update conversation threads"
  ON conversation_threads FOR UPDATE
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- RLS Policies for conversation_messages
CREATE POLICY "Authenticated users can view all conversation messages"
  ON conversation_messages FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Service role can insert conversation messages"
  ON conversation_messages FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

CREATE POLICY "Service role can update conversation messages"
  ON conversation_messages FOR UPDATE
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);
