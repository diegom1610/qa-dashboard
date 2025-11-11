/*
  # Add Category-Based Scoring to Human Feedback

  1. Changes
    - Add new columns for category-based scoring system
    - Each category can be scored (present/absent = 1/0 points)
    - Total of 5 categories = maximum 5 stars
    
  2. New Columns
    - `logic_path` (boolean) - Logic path category score
    - `information` (boolean) - Information category score
    - `solution` (boolean) - Solution category score
    - `communication` (boolean) - Communication category score
    - `language_usage` (boolean) - Language usage category score
    
  3. Migration Strategy
    - Add new columns with default false
    - Keep existing `rating` and `categories` columns for backward compatibility
    - Future: Can deprecate old columns once all data is migrated
    
  4. Notes
    - New rating system: sum of checked categories = total stars (0-5)
    - Each category = 1 star when checked
    - Categories are ordered: Logic Path, Information, Solution, Communication, Language Usage
*/

-- Add new category score columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'human_feedback' AND column_name = 'logic_path'
  ) THEN
    ALTER TABLE human_feedback ADD COLUMN logic_path boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'human_feedback' AND column_name = 'information'
  ) THEN
    ALTER TABLE human_feedback ADD COLUMN information boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'human_feedback' AND column_name = 'solution'
  ) THEN
    ALTER TABLE human_feedback ADD COLUMN solution boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'human_feedback' AND column_name = 'communication'
  ) THEN
    ALTER TABLE human_feedback ADD COLUMN communication boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'human_feedback' AND column_name = 'language_usage'
  ) THEN
    ALTER TABLE human_feedback ADD COLUMN language_usage boolean DEFAULT false;
  END IF;
END $$;