/*
  # QA Dashboard Database Schema

  ## Purpose
  This migration creates the complete database structure for the Intercom QA Performance Dashboard.
  It separates automated metrics (from Google Sheets) and human feedback (from stakeholders) to prevent
  data conflicts while enabling real-time collaboration.

  ## Tables Created

  ### 1. agents
  Stores information about customer service agents.
  - `id`: Unique identifier for each agent record
  - `agent_id`: The agent's ID from Intercom (used for matching with Google Sheets data)
  - `agent_name`: Display name of the agent
  - `email`: Agent's email address
  - `active`: Whether the agent is currently active (for filtering)
  - `created_at`: When this record was created

  ### 2. qa_metrics
  Stores QA performance data synced from Google Sheets (read-only for dashboard users).
  This is the "single source of truth" that comes from your Python script.
  - `id`: Unique identifier
  - `conversation_id`: Intercom conversation ID (used for filtering and linking feedback)
  - `agent_id`: Links to the agent who handled this conversation
  - `agent_name`: Agent's name (denormalized for faster queries)
  - `metric_date`: When this conversation occurred
  - `response_time_seconds`: How long the agent took to respond
  - `resolution_status`: Whether the issue was resolved (e.g., "resolved", "pending")
  - `customer_satisfaction_score`: CSAT score if available (1-5 scale)
  - `conversation_tags`: JSON array of tags from Intercom (e.g., ["billing", "urgent"])
  - `raw_data`: Complete JSON of all data from Google Sheets (flexibility for future)
  - `synced_at`: When this data was last synced from Google Sheets

  ### 3. human_feedback
  Stores qualitative reviews from stakeholders who evaluate agent performance.
  This data is created directly in the dashboard and never goes back to Google Sheets.
  - `id`: Unique identifier
  - `conversation_id`: Links to qa_metrics to associate feedback with specific conversations
  - `reviewer_id`: Links to auth.users to track who gave the feedback
  - `reviewer_name`: Display name of the reviewer
  - `rating`: Numerical rating (1-5 scale)
  - `feedback_text`: Detailed written feedback
  - `categories`: JSON array of review categories (e.g., ["tone", "accuracy"])
  - `created_at`: When feedback was originally submitted
  - `updated_at`: When feedback was last modified

  ## Security (Row Level Security)

  ### Why RLS is Critical
  RLS ensures that even if someone gets database credentials, they can only access data
  according to rules we define. Think of it like building-level security vs apartment-level security.

  ### Policies Created
  1. **qa_metrics**: All authenticated users can READ metrics (they need to see performance data)
  2. **agents**: All authenticated users can READ agent info (needed for filters)
  3. **human_feedback**: 
     - All authenticated users can READ all feedback (transparency)
     - Users can only CREATE feedback with their own user ID (prevents impersonation)
     - Users can only UPDATE/DELETE their own feedback (ownership)

  ## Indexes for Performance

  ### Why Indexes Matter
  Indexes are like a book's index - they help find data fast. Without them, the database
  would scan every row (slow). With them, it jumps directly to relevant data (fast).

  We create indexes on:
  - Fields used in filters (agent_id, conversation_id)
  - Fields used in sorting (metric_date)
  - Foreign keys (for joins between tables)
*/

-- =====================================================
-- AGENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text UNIQUE NOT NULL,
  agent_name text NOT NULL,
  email text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view agents (needed for filters)
CREATE POLICY "Authenticated users can view agents"
  ON agents FOR SELECT
  TO authenticated
  USING (true);

-- Index for fast lookups by agent_id (used when syncing data)
CREATE INDEX IF NOT EXISTS idx_agents_agent_id ON agents(agent_id);

-- Index for filtering active agents
CREATE INDEX IF NOT EXISTS idx_agents_active ON agents(active);

-- =====================================================
-- QA_METRICS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS qa_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL,
  agent_id text NOT NULL,
  agent_name text NOT NULL,
  metric_date timestamptz NOT NULL,
  response_time_seconds numeric,
  resolution_status text,
  customer_satisfaction_score numeric,
  conversation_tags jsonb DEFAULT '[]'::jsonb,
  raw_data jsonb DEFAULT '{}'::jsonb,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(conversation_id)
);

-- Enable Row Level Security
ALTER TABLE qa_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view metrics
CREATE POLICY "Authenticated users can view metrics"
  ON qa_metrics FOR SELECT
  TO authenticated
  USING (true);

-- Indexes for fast filtering and sorting
CREATE INDEX IF NOT EXISTS idx_qa_metrics_conversation_id ON qa_metrics(conversation_id);
CREATE INDEX IF NOT EXISTS idx_qa_metrics_agent_id ON qa_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_qa_metrics_metric_date ON qa_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_qa_metrics_synced_at ON qa_metrics(synced_at DESC);

-- GIN index for searching within JSON tags (advanced filtering)
CREATE INDEX IF NOT EXISTS idx_qa_metrics_tags ON qa_metrics USING gin(conversation_tags);

-- =====================================================
-- HUMAN_FEEDBACK TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS human_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text NOT NULL,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id),
  reviewer_name text NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback_text text,
  categories jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE human_feedback ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can read all feedback (transparency)
CREATE POLICY "Authenticated users can view all feedback"
  ON human_feedback FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Users can create feedback with their own reviewer_id
CREATE POLICY "Users can create their own feedback"
  ON human_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- Policy: Users can update only their own feedback
CREATE POLICY "Users can update their own feedback"
  ON human_feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() = reviewer_id)
  WITH CHECK (auth.uid() = reviewer_id);

-- Policy: Users can delete only their own feedback
CREATE POLICY "Users can delete their own feedback"
  ON human_feedback FOR DELETE
  TO authenticated
  USING (auth.uid() = reviewer_id);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_human_feedback_conversation_id ON human_feedback(conversation_id);
CREATE INDEX IF NOT EXISTS idx_human_feedback_reviewer_id ON human_feedback(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_human_feedback_created_at ON human_feedback(created_at DESC);

-- GIN index for searching within categories
CREATE INDEX IF NOT EXISTS idx_human_feedback_categories ON human_feedback USING gin(categories);

-- =====================================================
-- HELPER FUNCTION: Update timestamp on feedback edits
-- =====================================================
-- This function automatically sets updated_at whenever feedback is modified
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Automatically update updated_at when feedback is modified
CREATE TRIGGER update_human_feedback_updated_at
  BEFORE UPDATE ON human_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();