/**
 * GOOGLE SHEETS SYNC EDGE FUNCTION
 * 
 * PURPOSE:
 * This function bridges your existing Python script workflow with the new dashboard.
 * It periodically reads data from Google Sheets and syncs it to Supabase.
 * 
 * WHY THIS APPROACH:
 * 1. Non-invasive: Your Python script continues working unchanged
 * 2. Reliable: Runs on schedule, handles errors gracefully
 * 3. Flexible: Easy to modify if your sheet structure changes
 * 
 * HOW IT WORKS:
 * 1. Authenticates with Google Sheets API using service account
 * 2. Fetches all rows from your specified sheet
 * 3. Transforms each row to match our database schema
 * 4. Upserts data (update if exists, insert if new) to prevent duplicates
 * 5. Logs sync results for monitoring
 * 
 * SETUP REQUIRED:
 * You'll need to provide:
 * 1. Google Sheets Spreadsheet ID (from the sheet URL)
 * 2. Google Service Account credentials (JSON key file)
 * 3. Sheet name (e.g., "QA Metrics")
 */

import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { google } from 'npm:googleapis@129.0.0';

// CORS headers - required for browser access if needed
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

/**
 * INTERFACE: Defines the structure of data from Google Sheets
 *
 * WHY: TypeScript interfaces help prevent errors by defining expected data shapes.
 * This matches YOUR actual Google Sheet columns.
 */
interface GoogleSheetRow {
  date: string;
  agent: string;
  score: string;
  conversation_id: string;
  cx_score_breakdown: string;
  export_job_id: string;
  exported_at: string;
  reviewer_feedback: string;
  reviewer_score_override: string;
  reviewer_id: string;
  final_score: string;
  resolution_status: string;
}

/**
 * FUNCTION: Fetch data from Google Sheets
 *
 * WHY GOOGLE SHEETS API:
 * The Google Sheets API lets us read sheets programmatically without downloading files.
 * We use a service account (robot user) so no human needs to stay logged in.
 *
 * AUTHENTICATION:
 * Uses OAuth 2.0 with a service account (more secure than API keys)
 *
 * @param spreadsheetId - The ID from your sheet URL
 * @param sheetName - The specific sheet/tab name
 * @param credentials - Service account JSON credentials
 */
async function fetchGoogleSheetData(
  spreadsheetId: string,
  sheetName: string,
  credentials: any
): Promise<GoogleSheetRow[]> {
  try {
    console.log('🔐 Authenticating with Google Sheets API...');

    // Step 1: Create authenticated Google Sheets client
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    console.log(`📖 Reading sheet "${sheetName}" from spreadsheet ${spreadsheetId}...`);

    // Step 2: Fetch data from the sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: spreadsheetId,
      range: sheetName,
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      console.log('⚠️ No data found in sheet');
      return [];
    }

    // Step 3: Transform rows to structured data
    const headers = rows[0] || [];
    const dataRows = rows.slice(1);

    console.log(`✅ Found ${dataRows.length} rows with ${headers.length} columns`);

    // Convert each row array to an object using headers as keys
    return dataRows.map((row: any[]) => {
      const obj: any = {};
      headers.forEach((header: string, index: number) => {
        obj[header] = row[index] || '';
      });
      return obj as GoogleSheetRow;
    });

  } catch (error) {
    console.error('❌ Error fetching Google Sheets data:', error);
    throw new Error(`Google Sheets API error: ${error.message}`);
  }
}

/**
 * FUNCTION: Transform and sync data to Supabase
 * 
 * WHY UPSERT:
 * Upsert means "update if exists, insert if new". This prevents duplicate rows
 * and keeps data fresh without manual cleanup.
 * 
 * HOW IT WORKS:
 * 1. For each row from Google Sheets
 * 2. Transform it to match our database structure
 * 3. Use conversation_id as the unique key
 * 4. Insert or update in qa_metrics table
 * 
 * @param rows - Data from Google Sheets
 * @param supabase - Supabase client instance
 */
async function syncToSupabase(rows: GoogleSheetRow[], supabase: any) {
  console.log(`Starting sync of ${rows.length} rows...`);

  // Transform each row to match our database schema
  const transformedRows = rows.map(row => ({
    conversation_id: row.conversation_id,
    agent_id: row.agent || 'unknown',
    agent_name: row.agent || 'Unknown Agent',
    metric_date: row.date ? new Date(row.date).toISOString() : new Date().toISOString(),
    response_time_seconds: null,
    resolution_status: row.resolution_status ? row.resolution_status.toLowerCase() : 'completed',
    customer_satisfaction_score: row.final_score ? parseFloat(row.final_score) : null,
    ai_score: row.score && !isNaN(parseFloat(row.score)) ? parseFloat(row.score) : null,
    ai_feedback: row.cx_score_breakdown || null,
    conversation_tags: row.cx_score_breakdown ? [row.cx_score_breakdown] : [],
    raw_data: row,
    synced_at: new Date().toISOString(),
  }));

  // Upsert all rows at once (batch operation for speed)
  // WHY BATCH: Single database transaction is much faster than individual inserts
  const { data, error } = await supabase
    .from('qa_metrics')
    .upsert(transformedRows, {
      onConflict: 'conversation_id', // Use this field to detect duplicates
      ignoreDuplicates: false, // Update existing rows instead of skipping
    })
    .select();

  if (error) {
    console.error('Supabase upsert error:', error);
    throw error;
  }

  console.log(`✅ Successfully synced ${data?.length || 0} rows`);
  return data;
}

/**
 * FUNCTION: Extract unique agents and update agents table
 * 
 * WHY SEPARATE AGENTS TABLE:
 * Storing agents separately enables:
 * 1. Fast filtering without scanning all metrics
 * 2. Agent management (active/inactive status)
 * 3. Additional agent metadata (email, role, etc.)
 */
async function syncAgents(rows: GoogleSheetRow[], supabase: any) {
  // Get unique agents from the metrics data
  const uniqueAgents = Array.from(
    new Map(
      rows.map(row => [row.agent, { agent_id: row.agent, agent_name: row.agent }])
    ).values()
  );

  console.log(`Syncing ${uniqueAgents.length} unique agents...`);

  // Upsert agents (won't duplicate existing ones)
  const { data, error } = await supabase
    .from('agents')
    .upsert(
      uniqueAgents.map(agent => ({
        agent_id: agent.agent_id,
        agent_name: agent.agent_name,
        active: true,
      })),
      { onConflict: 'agent_id' }
    )
    .select();

  if (error) {
    console.error('Agent sync error:', error);
    throw error;
  }

  console.log(`✅ Successfully synced ${data?.length || 0} agents`);
}

/**
 * MAIN HANDLER: Entry point for the Edge Function
 * 
 * WHEN THIS RUNS:
 * 1. Manually via URL (for testing)
 * 2. On schedule via cron job (every 15 minutes in production)
 * 3. Triggered by webhook (if you want real-time sync)
 */
Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log('🔄 Starting Google Sheets sync...');
    
    // Initialize Supabase client
    // WHY SERVICE ROLE KEY: Edge functions need elevated permissions to write data
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get configuration from environment variables
    // WHY ENV VARS: Keeps sensitive data out of code
    const spreadsheetId = Deno.env.get('GOOGLE_SPREADSHEET_ID');
    const sheetName = Deno.env.get('GOOGLE_SHEET_NAME') || 'Sheet1';
    const credentialsJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_CREDENTIALS');

    // Validate configuration
    if (!spreadsheetId || !credentialsJson) {
      throw new Error('Missing required environment variables. See setup instructions.');
    }

    const credentials = JSON.parse(credentialsJson);

    // Step 1: Fetch data from Google Sheets
    const rows = await fetchGoogleSheetData(spreadsheetId, sheetName, credentials);
    console.log(`📊 Fetched ${rows.length} rows from Google Sheets`);

    // Step 2: Sync to database
    await syncToSupabase(rows, supabase);
    await syncAgents(rows, supabase);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        rowsSynced: rows.length,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});