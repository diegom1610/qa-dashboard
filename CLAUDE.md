# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server at http://localhost:5173
npm run build      # TypeScript compile + Vite bundle to dist/
npm run preview    # Serve production build locally
npm run lint       # ESLint on all .ts/.tsx files
npm run typecheck  # tsc --noEmit (type-check only)
```

There are no tests — no testing framework is installed.

## Architecture

**Stack**: React 18 + TypeScript + Vite + Tailwind CSS, backed by Supabase (PostgreSQL + Auth + Realtime + Edge Functions), deployed on Vercel.

### Views and Routing

There is no router. `App.tsx` renders either `<Dashboard />` (reviewer view) or `<AgentDashboard />` (agent view) based on a `viewMode` state variable. Auth state comes from `AuthContext.tsx`.

### Data Flow

```
Intercom API → Python script / Edge Function → qa_metrics (Supabase)
                                                     ↓
                                          useMetrics hook (Realtime)
                                                     ↓
                                          Dashboard / AgentDashboard
                                                     ↓
                          human_feedback ←→ FeedbackPanel / FeedbackHistory
                          feedback_comments ←→ FeedbackComments
```

### Key Hooks (in `src/components/`)

Hooks live alongside components in `src/components/`, not in `src/hooks/`:

- `useMetrics(filters)` — queries `qa_metrics`, applies filters, subscribes to Realtime
- `useFeedback(conversationId?)` — full CRUD on `human_feedback`, Realtime subscription
- `useAgents(activeOnly)` — read-only agent list, Realtime subscription

### AgentDashboard vs Dashboard

`AgentDashboard.tsx` (~857 lines) is self-contained: it does NOT use `useMetrics`. Instead it runs three parallel Supabase queries (recent metrics, human-reviewed metrics, 360-queue metrics), deduplicates by `conversation_id`, and applies client-side filtering via an internal `applyFilters()` function. It also hardcodes specific email addresses for workspace remapping business rules (Diego/Anna vs Nicholas → different workspace assignments).

### Database Tables

- `qa_metrics` — conversations synced from Intercom (unique on `conversation_id`)
- `human_feedback` — reviewer ratings (5 categories × 0–4 stars = 0–20 total)
- `feedback_comments` + `comment_mentions` — threaded comments with @mention notifications
- `agents`, `workspaces`, `agent_groups`, `agent_group_mapping`, `agent_workspace_mapping` — agent directory and team structure
- `user_settings` — per-user timezone and role (`agent` / `evaluator` / `admin`)

### Scoring (`src/utils/scoring.ts`)

Human rating: 0–20 scale (5 categories × 4 stars). If human feedback exists, it takes precedence over the AI score. AI score is on a 0–5 scale and is only used as fallback. Both are converted to percentage for display.

### Supabase Edge Functions (`supabase/functions/`)

| Function | Purpose |
|---|---|
| `sync-intercom-conversations` | Triggered from UI; calls Intercom export API, processes CSV, upserts to `qa_metrics` |
| `sync-google-sheets` | Legacy path; reads Google Sheets, upserts to `qa_metrics` |
| `fetch-conversation-thread` | Used by `ConversationViewer` to load Intercom messages |
| `create-user` | Admin creates new Supabase Auth users |
| `send-feedback-notification` | Email on feedback submission |
| `send-comment-notification` | Email on @mention in comments |

### Environment Variables

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

Both must be set in `.env` for local dev. Vercel hosts the production deployment.
