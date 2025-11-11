# QA Dashboard Architecture Documentation

## System Overview

This dashboard is built to display Intercom QA metrics and collect human feedback while maintaining your existing Python script workflow without disruption.

```
┌─────────────┐
│   Intercom  │ (Your CX Platform)
└──────┬──────┘
       │
       ▼
┌─────────────────────────┐
│   Python Script         │ (Your Existing Script)
│   - Extracts QA data    │
│   - Calculates metrics  │
└──────┬──────────────────┘
       │
       ▼
┌─────────────────────────┐
│   Google Sheets         │ (Source of Truth for Metrics)
│   - Conversation data   │
│   - Agent performance   │
│   - CSAT scores         │
└──────┬──────────────────┘
       │
       │ (Synced every 15 min)
       ▼
┌─────────────────────────┐
│   Supabase Edge Func    │ (Sync Function)
│   - Reads Google Sheets │
│   - Transforms data     │
│   - Upserts to DB       │
└──────┬──────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│   Supabase PostgreSQL Database   │
├──────────────┬───────────────────┤
│ qa_metrics   │ human_feedback    │
│ (automated)  │ (user-generated)  │
└──────┬───────┴───────────────────┘
       │
       │ (Real-time subscriptions)
       ▼
┌─────────────────────────┐
│   React Dashboard       │
│   - Filters             │
│   - Metrics display     │
│   - Feedback forms      │
└─────────────────────────┘
       │
       ▼
┌─────────────────────────┐
│   Stakeholders          │
│   - View metrics        │
│   - Add feedback        │
└─────────────────────────┘
```

---

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety and developer experience
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library

**Why These Choices:**
- React: Industry standard, huge ecosystem, great for interactive UIs
- TypeScript: Catches bugs at compile time, improves maintainability
- Vite: Much faster than Create React App, modern tooling
- Tailwind: Rapid UI development without writing custom CSS
- Lucide: Lightweight, consistent icon set

### Backend & Database
- **Supabase** - Backend-as-a-Service
  - PostgreSQL database
  - Row Level Security (RLS)
  - Real-time subscriptions
  - Authentication
  - Edge Functions

**Why Supabase:**
- No server management required
- Built-in auth and security
- Real-time out of the box
- PostgreSQL (reliable, powerful)
- Edge Functions for Google Sheets integration

### External Integrations
- **Google Sheets API** - Read QA metrics
- **Google Service Account** - Automated authentication

---

## Database Schema

### Table: agents

**Purpose:** Store agent information for filtering and display.

| Column      | Type      | Description                    |
|-------------|-----------|--------------------------------|
| id          | uuid      | Primary key                    |
| agent_id    | text      | Agent ID from Intercom (unique)|
| agent_name  | text      | Display name                   |
| email       | text      | Agent's email (optional)       |
| active      | boolean   | Whether agent is still active  |
| created_at  | timestamp | When record was created        |

**Indexes:**
- agent_id (unique)
- active (for filtering)

**RLS Policy:**
- All authenticated users can SELECT

### Table: qa_metrics

**Purpose:** Store QA performance data synced from Google Sheets.

| Column                      | Type      | Description                       |
|-----------------------------|-----------|-----------------------------------|
| id                          | uuid      | Primary key                       |
| conversation_id             | text      | Intercom conversation ID (unique) |
| agent_id                    | text      | Agent who handled conversation    |
| agent_name                  | text      | Agent display name                |
| metric_date                 | timestamp | When conversation occurred        |
| response_time_seconds       | numeric   | Time to first response            |
| resolution_status           | text      | Status (resolved, pending, etc.)  |
| customer_satisfaction_score | numeric   | CSAT rating (1-5)                 |
| conversation_tags           | jsonb     | Array of tags from Intercom       |
| raw_data                    | jsonb     | Complete original data            |
| synced_at                   | timestamp | When last synced                  |

**Indexes:**
- conversation_id (unique)
- agent_id (for filtering)
- metric_date DESC (for sorting)
- synced_at DESC (for debugging)
- GIN index on conversation_tags (for JSON queries)

**RLS Policy:**
- All authenticated users can SELECT
- Only service role can INSERT/UPDATE (via Edge Function)

**Why conversation_id is unique:**
- Prevents duplicate rows when sync runs multiple times
- Enables upsert (update if exists, insert if new)

### Table: human_feedback

**Purpose:** Store qualitative reviews from stakeholders.

| Column          | Type      | Description                     |
|-----------------|-----------|--------------------------------|
| id              | uuid      | Primary key                    |
| conversation_id | text      | Links to qa_metrics            |
| reviewer_id     | uuid      | Links to auth.users            |
| reviewer_name   | text      | Display name of reviewer       |
| rating          | integer   | 1-5 star rating                |
| feedback_text   | text      | Detailed comments (optional)   |
| categories      | jsonb     | Array of category IDs          |
| created_at      | timestamp | When feedback was submitted    |
| updated_at      | timestamp | When last modified             |

**Indexes:**
- conversation_id (for joins)
- reviewer_id (for user's own feedback)
- created_at DESC (for chronological display)
- GIN index on categories (for filtering)

**RLS Policies:**
- All authenticated users can SELECT (transparency)
- Users can INSERT with their own reviewer_id (security)
- Users can UPDATE/DELETE only their own feedback (ownership)

**Why separate from qa_metrics:**
- Different update frequency (real-time vs every 15 min)
- Different permissions (users write here, sync writes metrics)
- Prevents conflicts between automated sync and user input

**Trigger:**
- auto-update updated_at on every UPDATE

---

## Authentication Flow

### Initial Page Load

```
1. User visits dashboard URL
   ↓
2. App checks for existing session
   │
   ├─ Session exists → Show Dashboard
   │
   └─ No session → Show Login Page
```

### Login Process

```
1. User enters email + password
   ↓
2. Click "Sign In"
   ↓
3. supabase.auth.signInWithPassword()
   ↓
4. Supabase validates credentials
   │
   ├─ Valid → Create session, return user object
   │   ↓
   │   AuthContext updates user state
   │   ↓
   │   App re-renders, shows Dashboard
   │
   └─ Invalid → Return error
       ↓
       Display error message
```

### Session Management

```
User logged in
   ↓
Session stored in:
- localStorage (persistent across tabs)
- Memory (for current session)
   ↓
Automatic token refresh before expiry
   ↓
onAuthStateChange listener updates UI
   ↓
Session remains valid until:
- User logs out
- Token expires and refresh fails
```

### Logout Process

```
1. User clicks "Logout"
   ↓
2. supabase.auth.signOut()
   ↓
3. Supabase clears session
   ↓
4. AuthContext sets user to null
   ↓
5. App re-renders, shows Login Page
```

---

## Data Sync Architecture

### Google Sheets → Supabase

**Frequency:** Every 15 minutes (configurable)

**Process:**

```
1. Cron job triggers Edge Function
   ↓
2. Edge Function authenticates with Google
   ↓
3. Fetch all rows from Google Sheet
   │
   ├─ Headers in row 1
   └─ Data in rows 2+
   ↓
4. Transform to structured objects
   │
   ├─ Map column names to object keys
   ├─ Parse dates
   ├─ Convert numbers
   └─ Parse JSON for tags
   ↓
5. Extract unique agents
   ↓
6. Upsert agents table
   ↓
7. Upsert qa_metrics table
   │
   └─ Uses conversation_id as unique key
   ↓
8. Log results (rows synced, errors)
```

**Error Handling:**

```
Error occurs
   ↓
Log error details
   ↓
Return 500 status with error message
   ↓
Monitoring system alerts admins
   ↓
Next scheduled run retries
```

**Why Upsert Instead of Truncate + Insert:**

1. **Performance:** Only updates changed rows
2. **Safety:** Doesn't delete everything if sync fails
3. **History:** Keeps synced_at timestamps
4. **Consistency:** Dashboard never shows empty state during sync

---

## Real-Time Updates

### Supabase Realtime Architecture

```
Database change occurs
   ↓
PostgreSQL trigger fires
   ↓
Supabase broadcasts to all subscribers
   ↓
Dashboard receives event via WebSocket
   ↓
React component re-fetches data
   ↓
UI updates automatically
```

### Subscriptions in Dashboard

**1. QA Metrics Subscription**

```typescript
supabase
  .channel('qa_metrics_changes')
  .on('postgres_changes', {
    event: '*',        // INSERT, UPDATE, DELETE
    schema: 'public',
    table: 'qa_metrics',
  }, () => {
    refetchMetrics(); // Re-fetch filtered data
  })
  .subscribe();
```

**Use Case:** Sync function adds new data, dashboard updates immediately.

**2. Human Feedback Subscription**

```typescript
supabase
  .channel('human_feedback_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'human_feedback',
  }, () => {
    refetchFeedback(); // Re-fetch feedback for conversation
  })
  .subscribe();
```

**Use Case:** Another reviewer adds feedback, you see it without refreshing.

**3. Agents Subscription**

```typescript
supabase
  .channel('agents_changes')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'agents',
  }, () => {
    refetchAgents(); // Re-fetch agent list
  })
  .subscribe();
```

**Use Case:** New agent joins team, appears in filter dropdown automatically.

### Cleanup

```
Component unmounts
   ↓
supabase.removeChannel(channel)
   ↓
WebSocket connection closed
   ↓
No more updates received
```

**Why This Matters:**
- Prevents memory leaks
- Reduces server load
- Avoids errors from updating unmounted components

---

## Component Architecture

### Hierarchy

```
App
└── AuthProvider
    └── AppContent
        ├── LoginPage (if not authenticated)
        └── Dashboard (if authenticated)
            ├── Header
            │   ├── Logo
            │   ├── Refresh Button
            │   └── User Menu
            ├── FilterBar
            │   ├── Agent Filter
            │   ├── Conversation ID Search
            │   ├── Date Range Picker
            │   └── Status Filter
            ├── MetricsGrid
            │   └── Metric Cards (4x)
            └── ConversationTable
                └── For each conversation row:
                    ├── Metrics Display
                    └── Expanded Section
                        ├── FeedbackHistory
                        │   └── Feedback Items
                        └── FeedbackPanel
                            └── Submission Form
```

### Data Flow

```
User selects filter
   ↓
FilterBar calls onFiltersChange(newFilters)
   ↓
Dashboard updates filters state
   ↓
useMetrics hook detects change
   ↓
Re-fetch data with new filters
   ↓
Update metrics state
   ↓
MetricsGrid re-renders with new summary
   ↓
ConversationTable re-renders with filtered rows
```

### State Management

**Global State (via Context):**
- user (AuthContext)
- loading (AuthContext)
- signIn function (AuthContext)
- signOut function (AuthContext)

**Local State (via Hooks):**
- filters (Dashboard)
- metrics (useMetrics)
- feedback (useFeedback)
- agents (useAgents)

**Component State:**
- expandedRows (ConversationTable)
- sortColumn (ConversationTable)
- rating (FeedbackPanel)
- editingId (FeedbackHistory)

**Why This Distribution:**
- Context: Shared across entire app
- Hooks: Reusable data fetching logic
- Components: UI-specific temporary state

---

## Security Architecture

### Row Level Security (RLS)

**What It Is:**
PostgreSQL feature that filters rows based on user identity.

**How It Works:**

```
User makes query
   ↓
PostgreSQL checks RLS policies
   ↓
Automatically adds WHERE clause
   ↓
Only matching rows returned
```

**Example:**

```sql
-- User tries to read feedback
SELECT * FROM human_feedback;

-- RLS policy allows if authenticated
-- No additional WHERE needed

-- User tries to delete feedback
DELETE FROM human_feedback WHERE id = 'some-id';

-- RLS policy adds:
WHERE auth.uid() = reviewer_id

-- Only deletes if user owns the feedback
```

### API Security

**Supabase Client:**
- Uses ANON_KEY (safe to expose in frontend)
- All requests authenticated with user's JWT
- JWT contains user ID, email, role

**Edge Functions:**
- Use SERVICE_ROLE_KEY (server-only, elevated permissions)
- Can bypass RLS when needed (for sync)
- Environment variables never exposed to client

### Authentication Security

**Password Requirements:**
- Minimum 6 characters (configurable)
- Hashed with bcrypt (industry standard)
- Never stored in plain text

**Session Security:**
- JWT tokens expire after 1 hour
- Refresh tokens last 7 days (configurable)
- Auto-refresh before expiry
- Stored in httpOnly cookies (XSS protection)

**XSS Protection:**
- React escapes all user input by default
- No dangerouslySetInnerHTML used
- Content Security Policy headers

**CSRF Protection:**
- Supabase handles CSRF tokens automatically
- SameSite cookie attribute set

---

## Performance Optimization

### Database

**Indexes:**
- B-tree indexes on frequently filtered columns
- GIN indexes on JSONB columns
- Partial indexes for common queries

**Query Optimization:**
- Limit results (pagination)
- Only select needed columns
- Batch operations where possible

**Connection Pooling:**
- Supabase handles automatically
- Max connections configurable

### Frontend

**Code Splitting:**
- Components lazy-loaded where possible
- Vendor bundle separated from app code

**Asset Optimization:**
- CSS purged of unused classes
- Images lazy-loaded
- Icons tree-shaken (only used icons imported)

**Rendering:**
- React.memo for expensive components
- useMemo for expensive calculations
- useCallback for stable function references

**Caching:**
- Browser caches static assets
- Service worker for offline support (future enhancement)

---

## Monitoring & Logging

### Supabase Logs

**Available Logs:**
- Edge Function execution logs
- Database query logs
- Authentication events
- API request logs

**Access:**
Supabase Dashboard → Logs → Select log type

**What to Monitor:**
- Sync function success/failure
- Average response times
- Error rates
- Authentication attempts

### Application Logs

**Browser Console:**
- Error messages
- Network requests
- State changes (in development)

**Production Logging:**
- Consider adding Sentry, LogRocket, or similar
- Track JavaScript errors
- Monitor user interactions
- Record session replays

### Metrics to Track

**Usage:**
- Daily active users
- Page views
- Average session duration
- Filter usage patterns

**Performance:**
- Page load time
- Time to interactive
- API response times
- Real-time latency

**Quality:**
- Error rate
- Feedback submission rate
- Average feedback rating
- Feedback per conversation

---

## Deployment Architecture

### Production Setup

```
┌─────────────────┐
│   Vercel/       │ (Static file hosting)
│   Netlify       │
├─────────────────┤
│   - index.html  │
│   - bundled JS  │
│   - CSS         │
│   - assets      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Supabase      │ (Backend services)
├─────────────────┤
│   - PostgreSQL  │
│   - Auth        │
│   - Realtime    │
│   - Edge Funcs  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Google Sheets   │ (Data source)
└─────────────────┘
```

### Environment Variables

**Frontend (.env):**
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

**Backend (Supabase Secrets):**
```
GOOGLE_SPREADSHEET_ID=1Bxi...
GOOGLE_SHEET_NAME=QA Metrics
GOOGLE_SERVICE_ACCOUNT_CREDENTIALS={"type":"service_account"...}
```

### Build Process

```
1. npm run build
   ↓
2. Vite bundles code
   │
   ├─ TypeScript → JavaScript
   ├─ Tailwind CSS → Optimized CSS
   ├─ Tree-shake unused code
   └─ Minify and compress
   ↓
3. Output to dist/ directory
   │
   ├─ index.html
   ├─ assets/index-[hash].js
   └─ assets/index-[hash].css
   ↓
4. Deploy dist/ to hosting service
```

### CI/CD Pipeline (Optional)

```
Push to main branch
   ↓
GitHub Actions trigger
   ↓
1. Install dependencies
2. Run TypeScript checks
3. Run build
4. Deploy to Vercel/Netlify
   ↓
Deployment complete
   ↓
Slack notification
```

---

## Scalability Considerations

### Current Capacity

**Database:**
- Supabase Free: 500MB storage
- Handles ~10,000 conversations easily
- ~1,000 feedback entries

**Performance:**
- <100ms database queries
- <500ms page load
- Real-time latency <1s

### Scaling Strategy

**If You Grow Beyond Current Capacity:**

**Database Scaling:**
1. Upgrade Supabase plan (pro: 8GB+)
2. Add database indexes as needed
3. Partition qa_metrics by date (archive old data)

**Query Optimization:**
1. Implement pagination (load 50 rows at a time)
2. Add date range limits (don't load all history)
3. Consider materialized views for aggregations

**Frontend Scaling:**
1. Implement virtual scrolling for long tables
2. Lazy load feedback on demand
3. Cache frequent queries

**Sync Optimization:**
1. Only sync changed rows (check synced_at)
2. Batch upserts in chunks
3. Run sync more frequently but smaller batches

---

## Future Enhancements

### Short Term (1-3 months)

1. **CSV Export**
   - Export filtered data to CSV
   - Include feedback in export

2. **Search Enhancements**
   - Full-text search across feedback
   - Search by customer name/email

3. **Analytics Dashboard**
   - Trends over time (line charts)
   - Agent performance comparisons
   - Feedback category breakdown

### Medium Term (3-6 months)

1. **Email Notifications**
   - Notify agents of new feedback
   - Weekly summary reports

2. **Advanced Filtering**
   - Feedback rating filter
   - Tag-based filtering
   - Custom saved filter sets

3. **Admin Panel**
   - User management UI
   - Agent management
   - System health dashboard

### Long Term (6-12 months)

1. **AI Insights**
   - Sentiment analysis on feedback
   - Automated issue detection
   - Performance prediction

2. **Mobile App**
   - React Native app
   - Push notifications
   - Offline support

3. **Integrations**
   - Slack notifications
   - JIRA ticket creation
   - Zapier webhooks

---

## Maintenance Checklist

### Daily
- [ ] Check Edge Function logs for errors
- [ ] Verify data is syncing (check synced_at)

### Weekly
- [ ] Review feedback submission rate
- [ ] Check for slow database queries
- [ ] Monitor storage usage

### Monthly
- [ ] Archive old data (>6 months)
- [ ] Review and optimize indexes
- [ ] Update dependencies (npm update)
- [ ] Review user access list

### Quarterly
- [ ] Security audit (check RLS policies)
- [ ] Performance benchmarks
- [ ] User feedback session
- [ ] Plan new features

---

## Glossary

**RLS** - Row Level Security. PostgreSQL feature for access control.

**CSAT** - Customer Satisfaction Score. Typically 1-5 rating.

**Upsert** - Update if exists, insert if new. SQL operation.

**Edge Function** - Serverless function running on Supabase.

**JWT** - JSON Web Token. Used for authentication.

**Realtime** - Live data updates via WebSockets.

**GIN Index** - Generalized Inverted Index. For JSON queries.

**Service Role** - Elevated permissions, bypasses RLS.

**Anon Key** - Public API key for frontend use.

**Material View** - Cached query results. Faster than recalculating.

---

## Additional Resources

**Documentation:**
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

**Tutorials:**
- [Supabase Auth Tutorial](https://supabase.com/docs/guides/auth)
- [React Hooks Guide](https://react.dev/reference/react)
- [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

**Support:**
- Supabase Discord
- Stack Overflow (tag: supabase, react)
- GitHub Issues
