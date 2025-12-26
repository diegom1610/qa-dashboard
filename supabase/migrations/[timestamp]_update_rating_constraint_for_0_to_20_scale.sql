/*
  # Update Rating Constraint for 0-20 Scale

  1. Changes
    - Drop existing rating check constraint (1-5 scale)
    - Add new rating check constraint (0-20 scale)
    - This supports the new rating system where each of 5 categories can be rated 0-4 stars
    - Total possible rating: 0 (all categories at 0) to 20 (all categories at 4)

  2. Why This Change
    - Previous system: 1-5 star rating (checkbox based)
    - New system: 0-4 stars per category × 5 categories = 0-20 total
    - Database constraint must match the application logic

  3. Important Notes
    - Ratings of 0 are now valid (indicating all categories rated at 0)
    - Maximum rating increased from 5 to 20
    - This change is backward compatible with existing data if all ratings are between 1-5
*/

-- Drop the old constraint
ALTER TABLE human_feedback 
DROP CONSTRAINT IF EXISTS human_feedback_rating_check;

-- Add new constraint for 0-20 scale
ALTER TABLE human_feedback 
ADD CONSTRAINT human_feedback_rating_check 
CHECK (rating >= 0 AND rating <= 20);
