ALTER TABLE human_feedback
  ADD COLUMN IF NOT EXISTS evaluated_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS evaluated_agent_name TEXT;