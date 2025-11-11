# Workspace and Group Setup Guide

This guide explains how to set up workspaces, groups, and assign agents to them.

## Overview

The system now supports:
- **Workspaces**: Different platforms (CamModelDirectory, SkyPrivate)
- **Groups**: Team groupings (EU TEAM, US TEAM, ASIA TEAM)
- **Automatic workspace assignment**: Based on conversation tags

## Default Configuration

### Workspaces
- **CamModelDirectory**: Conversations with tags containing "CMD" or "CamModelDirectory"
- **SkyPrivate**: Conversations with tags containing "SkyPrivate" or "SP"

### Groups
- **EU TEAM**: European timezone agents
- **US TEAM**: United States timezone agents
- **ASIA TEAM**: Asia timezone agents

## Automatic Workspace Assignment

Workspaces are automatically assigned to conversations based on their tags:

```sql
-- Conversations with #CMD or #CamModelDirectory tags → workspace = 'cammodeldirectory'
-- Conversations with #SkyPrivate or #SP tags → workspace = 'skyprivate'
```

This happens automatically when QA metrics are inserted or updated.

## Manual Agent Assignment

To assign agents to workspaces and groups, use the following SQL commands:

### Assign Agent to Workspace

```sql
-- Get workspace IDs
SELECT id, display_name FROM workspaces;

-- Assign agent to CamModelDirectory
INSERT INTO agent_workspace_mapping (agent_id, workspace_id)
VALUES ('AGENT_ID_HERE', 'WORKSPACE_ID_HERE')
ON CONFLICT (agent_id, workspace_id) DO NOTHING;
```

### Assign Agent to Group

```sql
-- Get group IDs
SELECT id, display_name FROM agent_groups;

-- Assign agent to EU TEAM
INSERT INTO agent_group_mapping (agent_id, group_id)
VALUES ('AGENT_ID_HERE', 'GROUP_ID_HERE')
ON CONFLICT (agent_id, group_id) DO NOTHING;
```

### Bulk Assignment Example

```sql
-- Assign multiple agents to EU TEAM
WITH eu_group AS (
  SELECT id FROM agent_groups WHERE name = 'eu_team'
)
INSERT INTO agent_group_mapping (agent_id, group_id)
SELECT agent_id, eu_group.id
FROM agents, eu_group
WHERE agent_name IN ('Allan', 'Marius', 'Andreea')
ON CONFLICT (agent_id, group_id) DO NOTHING;
```

## Adding New Workspaces

```sql
INSERT INTO workspaces (name, display_name, tag_identifiers, description)
VALUES (
  'newplatform',
  'New Platform',
  ARRAY['NewPlatform', 'NP'],
  'New platform conversations'
)
ON CONFLICT (name) DO NOTHING;
```

## Adding New Groups

```sql
INSERT INTO agent_groups (name, display_name, description)
VALUES (
  'training_team',
  'TRAINING TEAM',
  'Agents currently in training'
)
ON CONFLICT (name) DO NOTHING;
```

## Querying Agent Assignments

```sql
-- View all agent-workspace assignments
SELECT
  a.agent_name,
  w.display_name as workspace
FROM agent_workspace_mapping awm
JOIN agents a ON a.agent_id = awm.agent_id
JOIN workspaces w ON w.id = awm.workspace_id
ORDER BY a.agent_name;

-- View all agent-group assignments
SELECT
  a.agent_name,
  g.display_name as group_name
FROM agent_group_mapping agm
JOIN agents a ON a.agent_id = agm.agent_id
JOIN agent_groups g ON g.id = agm.group_id
ORDER BY a.agent_name;
```

## Using Filters in the Dashboard

### Agent Dashboard Filters:

1. **Date Range**: Last 7 days, Last 30 days, Last 90 days, All time
2. **Workspace**: Filter by platform (CamModelDirectory, SkyPrivate)
3. **Reviewer**: Filter by specific reviewer
4. **Reviewee**: Filter by specific agent being reviewed
5. **Group**: Filter by team (EU TEAM, US TEAM, ASIA TEAM)

### Filter Combinations:

- **View EU TEAM performance on CamModelDirectory in last 30 days**:
  - Date: Last 30 days
  - Workspace: CamModelDirectory
  - Group: EU TEAM

- **View specific agent's reviews**:
  - Reviewee: Select agent name
  - Date: Last 30 days

- **View specific reviewer's activity**:
  - Reviewer: Select reviewer name
  - Workspace: Select workspace

## Performance Metrics

The Agent Dashboard shows:

- **IQS (Internal Quality Score)**: Weighted average of all ratings (0-100%)
- **Reviews**: Total number of reviews submitted
- **Reviewed conversations**: Number of unique conversations reviewed
- **Average review time**: Time spent per review
- **Reviewed agents**: Number of unique agents reviewed
- **Disputed reviews**: Reviews that are contested
- **Reviews with comments**: Percentage of reviews with detailed feedback
- **Unseen reviews**: Reviews that haven't been acknowledged

## Reviewee Performance Table

Displays per-agent statistics:

- **IQS**: Agent's quality score
- **Trend**: Performance trend (up/down/stable)
- **Reviews**: Number of reviews received
- **Reviews not seen**: Unacknowledged reviews
- **Comments**: Number of reviews with detailed feedback

The table is sortable by any column.
