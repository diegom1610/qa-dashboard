/*
  # Add AI Score Fields to QA Metrics (Safe Version)

  ## Summary
  Adds dedicated columns for AI-generated evaluation data from Google Sheets.
  Handles non-numeric values gracefully during data migration.

  ## Changes Made

  ### 1. New Columns in `qa_metrics` Table
  - **ai_score** (numeric): AI-generated rating (1-5 scale) from Google Sheets `score` column
    - Nullable: Some conversations may not have AI scores yet
    - Used in weighted average: 30% of final score
  
  - **ai_feedback** (text): AI's detailed explanation from Google Sheets `cx_score_breakdown` column
    - Nullable: AI may provide scores without explanations
    - Displayed separately from human feedback in UI

  ### 2. Data Migration
  - Safely extracts existing AI data from `raw_data` JSONB column
  - Handles non-numeric values (e.g., "No", empty strings)
  - Only migrates valid numeric scores

  ## Impact
  - AI scores will be properly tracked and displayed
  - Enables weighted average calculation (70% human + 30% AI)
  - Improves data queryability
*/

-- Add AI score and feedback columns
DO $$
BEGIN
  -- Add ai_score column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qa_metrics' AND column_name = 'ai_score'
  ) THEN
    ALTER TABLE qa_metrics ADD COLUMN ai_score numeric;
    
    -- Migrate existing data from raw_data.score (safely handle non-numeric values)
    UPDATE qa_metrics
    SET ai_score = CASE
      WHEN raw_data->>'score' ~ '^\d+(\.\d+)?$' THEN CAST(raw_data->>'score' AS numeric)
      ELSE NULL
    END
    WHERE raw_data->>'score' IS NOT NULL
      AND raw_data->>'score' != '';
  END IF;

  -- Add ai_feedback column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qa_metrics' AND column_name = 'ai_feedback'
  ) THEN
    ALTER TABLE qa_metrics ADD COLUMN ai_feedback text;
    
    -- Migrate existing data from raw_data.cx_score_breakdown
    UPDATE qa_metrics
    SET ai_feedback = raw_data->>'cx_score_breakdown'
    WHERE raw_data->>'cx_score_breakdown' IS NOT NULL
      AND raw_data->>'cx_score_breakdown' != '';
  END IF;
END $$;

-- Add index for AI score filtering
CREATE INDEX IF NOT EXISTS idx_qa_metrics_ai_score ON qa_metrics(ai_score);

-- Add comments
COMMENT ON COLUMN qa_metrics.ai_score IS 'AI-generated rating (1-5) from Google Sheets, weighted at 30% in final score';
COMMENT ON COLUMN qa_metrics.ai_feedback IS 'AI explanation from Google Sheets cx_score_breakdown column';