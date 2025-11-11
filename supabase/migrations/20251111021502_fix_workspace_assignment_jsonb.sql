/*
  # Fix Workspace Assignment for JSONB Tags

  1. Improvements
    - Fix workspace assignment trigger to handle JSONB tags
    - Update existing records to assign workspaces
    - Add better tag matching logic for JSONB arrays
*/

-- Drop and recreate the trigger function with JSONB support
DROP FUNCTION IF EXISTS assign_workspace_from_tags CASCADE;

CREATE OR REPLACE FUNCTION assign_workspace_from_tags()
RETURNS TRIGGER AS $$
DECLARE
  tag_text text;
BEGIN
  -- Convert JSONB tags to text for easier searching
  IF NEW.conversation_tags IS NOT NULL THEN
    tag_text := NEW.conversation_tags::text;
    
    -- Check for CMD/CamModelDirectory tags (case insensitive)
    IF tag_text ~* '(CMD|CamModelDirectory)' THEN
      NEW.workspace := 'cammodeldirectory';
    -- Check for SkyPrivate tags (case insensitive)
    ELSIF tag_text ~* '(SkyPrivate|SP)' THEN
      NEW.workspace := 'skyprivate';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS assign_workspace_trigger ON qa_metrics;
CREATE TRIGGER assign_workspace_trigger
  BEFORE INSERT OR UPDATE ON qa_metrics
  FOR EACH ROW
  EXECUTE FUNCTION assign_workspace_from_tags();

-- Update existing records to assign workspaces
UPDATE qa_metrics
SET workspace = CASE
  WHEN conversation_tags::text ~* '(CMD|CamModelDirectory)' THEN 'cammodeldirectory'
  WHEN conversation_tags::text ~* '(SkyPrivate|SP)' THEN 'skyprivate'
  ELSE workspace
END
WHERE conversation_tags IS NOT NULL;