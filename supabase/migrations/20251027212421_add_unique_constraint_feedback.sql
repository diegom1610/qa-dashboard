/*
  # Prevent Duplicate Ratings

  ## Summary
  Adds a unique constraint to prevent users from rating the same conversation multiple times.
  This ensures data integrity and improves the quality assurance process.

  ## Changes Made
  1. **Unique Constraint**: Add constraint to `human_feedback` table
     - Combines `conversation_id` and `reviewer_id` as unique pair
     - Prevents duplicate feedback submissions
     - Database will reject attempts to rate same conversation twice

  ## Impact
  - Users can only submit ONE rating per conversation
  - Attempting duplicate submission will fail with error
  - Users can still EDIT their existing feedback
  - Different users CAN rate the same conversation

  ## Security Notes
  - Works in conjunction with existing RLS policies
  - Frontend will check for existing feedback before showing form
  - Backend constraint provides fail-safe protection
*/

-- Add unique constraint to prevent duplicate ratings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_reviewer_per_conversation'
  ) THEN
    ALTER TABLE human_feedback 
    ADD CONSTRAINT unique_reviewer_per_conversation 
    UNIQUE (conversation_id, reviewer_id);
  END IF;
END $$;