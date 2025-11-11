/*
  # Add Workspaces and Groups for Agent Organization

  1. New Tables
    - `workspaces` - Different platforms/brands (CamModelDirectory, SkyPrivate)
    - `agent_groups` - Team groupings for agents
    - `agent_workspace_mapping` - Many-to-many relationship between agents and workspaces
    - `agent_group_mapping` - Many-to-many relationship between agents and groups
    
  2. Changes to Existing Tables
    - Add `workspace` column to qa_metrics to track which platform each conversation belongs to
    
  3. Security
    - Enable RLS on all new tables
    - Add appropriate policies for authenticated users
    
  4. Notes
    - Workspaces are identified by conversation tags (e.g., #CMD, #SkyPrivate)
    - Groups allow filtering by team (e.g., EU TEAM)
    - This enables performance tracking per platform and per team
*/

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  tag_identifiers text[] NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create agent_groups table
CREATE TABLE IF NOT EXISTS agent_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create agent_workspace_mapping table
CREATE TABLE IF NOT EXISTS agent_workspace_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, workspace_id)
);

-- Create agent_group_mapping table
CREATE TABLE IF NOT EXISTS agent_group_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id text NOT NULL REFERENCES agents(agent_id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES agent_groups(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(agent_id, group_id)
);

-- Add workspace column to qa_metrics if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qa_metrics' AND column_name = 'workspace'
  ) THEN
    ALTER TABLE qa_metrics ADD COLUMN workspace text;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_workspace_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_group_mapping ENABLE ROW LEVEL SECURITY;

-- Policies for workspaces
CREATE POLICY "Authenticated users can read workspaces"
  ON workspaces FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage workspaces"
  ON workspaces FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for agent_groups
CREATE POLICY "Authenticated users can read agent groups"
  ON agent_groups FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage agent groups"
  ON agent_groups FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for agent_workspace_mapping
CREATE POLICY "Authenticated users can read agent workspace mappings"
  ON agent_workspace_mapping FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage agent workspace mappings"
  ON agent_workspace_mapping FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for agent_group_mapping
CREATE POLICY "Authenticated users can read agent group mappings"
  ON agent_group_mapping FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage agent group mappings"
  ON agent_group_mapping FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default workspaces
INSERT INTO workspaces (name, display_name, tag_identifiers, description)
VALUES 
  ('cammodeldirectory', 'CamModelDirectory', ARRAY['CMD', 'CamModelDirectory'], 'CamModelDirectory platform conversations'),
  ('skyprivate', 'SkyPrivate', ARRAY['SkyPrivate', 'SP'], 'SkyPrivate platform conversations')
ON CONFLICT (name) DO NOTHING;

-- Insert default groups
INSERT INTO agent_groups (name, display_name, description)
VALUES 
  ('eu_team', 'EU TEAM', 'European team agents'),
  ('us_team', 'US TEAM', 'United States team agents'),
  ('asia_team', 'ASIA TEAM', 'Asia team agents')
ON CONFLICT (name) DO NOTHING;

-- Create function to auto-assign workspace based on tags
CREATE OR REPLACE FUNCTION assign_workspace_from_tags()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for CMD tags
  IF NEW.conversation_tags::text ILIKE '%CMD%' OR 
     NEW.conversation_tags::text ILIKE '%CamModelDirectory%' THEN
    NEW.workspace := 'cammodeldirectory';
  -- Check for SkyPrivate tags
  ELSIF NEW.conversation_tags::text ILIKE '%SkyPrivate%' OR 
        NEW.conversation_tags::text ILIKE '%SP%' THEN
    NEW.workspace := 'skyprivate';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-assignment
DROP TRIGGER IF EXISTS assign_workspace_trigger ON qa_metrics;
CREATE TRIGGER assign_workspace_trigger
  BEFORE INSERT OR UPDATE ON qa_metrics
  FOR EACH ROW
  EXECUTE FUNCTION assign_workspace_from_tags();