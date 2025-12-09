import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface IntercomExportJob {
  job_identifier?: string;
  id?: string;
  jobId?: string;
  status?: string;
  state?: string;
  download_url?: string;
}

interface ConversationRow {
  conversation_id?: string;
  conversation_last_closed_at?: string;
  conversation_started_at?: string;
  conversation_state?: string;
  currently_assigned_teammate_id?: string;
  currently_assigned_teammate_raw_id?: string;
  assignee_id?: string;
  ai_cx_score_rating?: string;
  conversation_rating?: string;
  fin_ai_agent_rating?: string;
  ai_cx_score_explanation?: string;
  [key: string]: string | undefined;
}

// ============================================
// WORKSPACE & 360 QUEUE TAG DEFINITIONS
// ============================================

// Workspace keywords - uses CONTAINS logic (not exact match)
const WORKSPACE_KEYWORDS = {
  SKYPRIVATE: ['skyprivate', 'sky private', 'sky-private'],
  CMD: ['cmd', 'cammodeldirectory', 'cam model directory', 'cam-model-directory'],
};

// 360 Queue keywords - uses CONTAINS logic
const BILLING_360_KEYWORDS = [
  'payment',
  'billing',
  'top-up',
  'topup',
  'top up',
  'verification',
];

const CEQ_360_KEYWORDS = [
  'report',
  'scammer',
  'ceq',
  'publicprofile',
  'public profile',
];

/**
 * FIXED: Determine workspace from tags using CONTAINS logic
 * Tags may have prefixes like "# SkyPrivate" or "1 - Member"
 */
function determineWorkspace(tags: string[]): string {
  // Join all tags into one string for easier searching
  const allTagsLower = tags.map(t => t.toLowerCase()).join(' ');
  
  // Check for SkyPrivate keywords
  for (const keyword of WORKSPACE_KEYWORDS.SKYPRIVATE) {
    if (allTagsLower.includes(keyword)) {
      return 'SkyPrivate';
    }
  }
  
  // Check for CMD keywords
  for (const keyword of WORKSPACE_KEYWORDS.CMD) {
    if (allTagsLower.includes(keyword)) {
      return 'CamModelDirectory';
    }
  }
  
  return 'Unknown';
}

/**
 * FIXED: Determine if conversation is a 360 queue conversation using CONTAINS logic
 */
function determine360Queue(tags: string[]): { is360: boolean; queueType: string | null } {
  const allTagsLower = tags.map(t => t.toLowerCase()).join(' ');
  
  const isBilling = BILLING_360_KEYWORDS.some(keyword => allTagsLower.includes(keyword));
  const isCEQ = CEQ_360_KEYWORDS.some(keyword => allTagsLower.includes(keyword));
  
  if (isBilling && isCEQ) {
    return { is360: true, queueType: 'both' };
  } else if (isBilling) {
    return { is360: true, queueType: 'billing' };
  } else if (isCEQ) {
    return { is360: true, queueType: 'ceq' };
  }
  
  return { is360: false, queueType: null };
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const INTERCOM_TOKEN = Deno.env.get("INTERCOM_TOKEN");
    const INTERCOM_APP_ID = Deno.env.get("INTERCOM_APP_ID") || "b37vb7kt";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!INTERCOM_TOKEN) {
      throw new Error("INTERCOM_TOKEN not configured");
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase configuration missing");
    }

    const { days = 1 } = await req.json().catch(() => ({ days: 1 }));

    console.log(`Starting sync for last ${days} days...`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = Math.floor(Date.now() / 1000);
    const startUnix = now - (days * 24 * 60 * 60);
    const endUnix = now;

    console.log("Fetching admin/teammate names...");
    const adminsMap = await fetchAllAdmins(INTERCOM_TOKEN);
    console.log(`Fetched ${Object.keys(adminsMap).length} admin/teammate records`);

    console.log("Enqueueing Intercom export...");
    const attributeIds = [
      "conversation_id",
      "conversation_started_at",
      "conversation_last_closed_at",
      "conversation_state",
      "currently_assigned_teammate_id",
      "currently_assigned_teammate_raw_id",
      "currently_assigned_team_id",
      "ai_cx_score_rating",
      "conversation_rating",
      "fin_ai_agent_rating",
      "ai_cx_score_explanation"
    ];

    const jobId = await enqueueExport(INTERCOM_TOKEN, startUnix, endUnix, attributeIds);
    console.log(`Enqueued job ${jobId}`);

    console.log("Polling export job...");
    const jobResp = await pollExport(INTERCOM_TOKEN, INTERCOM_APP_ID, jobId);

    console.log("Downloading export data...");
    const content = await downloadExport(INTERCOM_TOKEN, INTERCOM_APP_ID, jobResp, jobId);

    console.log("Parsing export data...");
    const rows = await parseExportBytes(content);
    console.log(`Downloaded ${rows.length} rows`);

    if (rows.length > 0) {
      console.log("Sample row:", JSON.stringify(rows[0]));
    }

    // Parse conversations with basic data first
    let conversations = rows
      .filter((row: ConversationRow) => row.conversation_id)
      .map((row: ConversationRow) => parseConversationRow(row, adminsMap));

    // ============================================
    // CRITICAL: Enrich ALL conversations with real timestamps and tags
    // The Intercom Reporting Export API often returns incorrect or missing dates
    // We MUST fetch the actual conversation to get the real created_at date and tags
    // ============================================
    
    console.log("Enriching ALL conversations with real timestamps and tags...");
    
    // Process in batches to avoid rate limiting
    const BATCH_SIZE = 10;
    const DELAY_BETWEEN_BATCHES = 500; // ms
    
    let enrichedCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < conversations.length; i += BATCH_SIZE) {
      const batch = conversations.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (conv) => {
        const enrichedData = await enrichConversationWithDetails(
          INTERCOM_TOKEN,
          conv.conversation_id
        );

        if (enrichedData) {
          // FIXED: The Reporting Export API returns WRONG dates (export date, not conversation date)
          // The individual conversation API returns the CORRECT date
          // So we ALWAYS use the enrichment date if available
          if (enrichedData.realDate) {
            console.log(`  Date: export=${conv.metric_date} -> enriched=${enrichedData.realDate}`);
            conv.metric_date = enrichedData.realDate;
          }
          
          // Remove the flag before upserting (not a database column)
          delete conv.date_is_from_export;
          
          // Add tags and workspace info
          conv.tags = enrichedData.tags;
          conv.workspace = enrichedData.workspace;
          conv.is_360_queue = enrichedData.is360Queue;
          conv.queue_type_360 = enrichedData.queueType360;
          
          enrichedCount++;
          console.log(`✓ Enriched ${conv.conversation_id}: date=${conv.metric_date} | workspace=${conv.workspace} | tags=[${enrichedData.tags.slice(0,3).join(', ')}${enrichedData.tags.length > 3 ? '...' : ''}] | 360=${conv.is_360_queue}`);
        } else {
          // Remove the flag even on failure
          delete conv.date_is_from_export;
          failedCount++;
          console.warn(`✗ Failed to enrich ${conv.conversation_id}`);
        }
      }));
      
      // Delay between batches to respect rate limits
      if (i + BATCH_SIZE < conversations.length) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
      }
    }
    
    console.log(`Enrichment complete: ${enrichedCount} succeeded, ${failedCount} failed`);

    console.log(`Upserting ${conversations.length} conversations to Supabase...`);
    const { error } = await supabase
      .from("qa_metrics")
      .upsert(conversations, { onConflict: "conversation_id" });

    if (error) {
      throw new Error(`Failed to upsert: ${error.message}`);
    }

    // Update agents table
    const uniqueAgents = Array.from(
      new Set(
        conversations
          .filter(c => c.agent_name && c.agent_name !== "Unknown" && c.agent_name !== "Unassigned")
          .map(c => ({ agent_id: c.agent_id, agent_name: c.agent_name }))
          .map(a => JSON.stringify(a))
      )
    ).map(s => JSON.parse(s));

    if (uniqueAgents.length > 0) {
      console.log(`Upserting ${uniqueAgents.length} agents...`);
      const agentsToUpsert = uniqueAgents.map(agent => ({
        agent_id: agent.agent_id,
        agent_name: agent.agent_name,
        active: true,
      }));

      const { error: agentsError } = await supabase
        .from("agents")
        .upsert(agentsToUpsert, { onConflict: "agent_id" });

      if (agentsError) {
        console.error("Failed to upsert agents:", agentsError);
      }
    }

    console.log("✅ Sync complete!");

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${conversations.length} conversations`,
        conversations_processed: conversations.length,
        enrichment_results: {
          succeeded: enrichedCount,
          failed: failedCount,
        },
        date_range: {
          start: new Date(startUnix * 1000).toISOString(),
          end: new Date(endUnix * 1000).toISOString(),
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync failed:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ============================================
// ENRICHMENT FUNCTION - Gets real date and tags
// ============================================

interface EnrichedConversationData {
  realDate: string | null;
  tags: string[];
  workspace: string;
  is360Queue: boolean;
  queueType360: string | null;
}

async function enrichConversationWithDetails(
  token: string,
  conversationId: string
): Promise<EnrichedConversationData | null> {
  try {
    // Request conversation with display_as=plaintext to get conversation_parts
    const response = await fetch(
      `https://api.intercom.io/conversations/${conversationId}?display_as=plaintext`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
          "Intercom-Version": "2.14",
        },
      }
    );

    if (!response.ok) {
      console.warn(`Failed to fetch conversation ${conversationId}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // ============================================
    // FIXED: Extract the REAL conversation date
    // The first message's created_at is the true conversation start date
    // Priority order:
    // 1. source.created_at - the original message that started the conversation
    // 2. First conversation_part created_at
    // 3. created_at on conversation object
    // ============================================
    
    let realDate: string | null = null;
    let timestamp: number | null = null;
    let dateSource: string = '';
    
    // BEST: Use source.created_at - this is the original message
    if (data.source?.created_at) {
      timestamp = data.source.created_at;
      dateSource = 'source.created_at';
    }
    
    // Fallback: Try first conversation part
    if (!timestamp) {
      const conversationParts = data.conversation_parts?.conversation_parts || [];
      if (conversationParts.length > 0 && conversationParts[0]?.created_at) {
        timestamp = conversationParts[0].created_at;
        dateSource = 'conversation_parts[0]';
      }
    }
    
    // Fallback: Use conversation created_at
    if (!timestamp && data.created_at) {
      timestamp = data.created_at;
      dateSource = 'created_at';
    }
    
    if (timestamp) {
      realDate = parseTimestampToDate(timestamp);
      console.log(`  Date from ${dateSource}: ${timestamp} -> ${realDate}`);
    }
    
    // Extract tags - handle multiple possible formats
    let tags: string[] = [];
    
    if (data.tags?.tags && Array.isArray(data.tags.tags)) {
      tags = data.tags.tags.map((tag: { name?: string; id?: string }) => tag.name || '').filter(Boolean);
    } else if (data.tags && Array.isArray(data.tags)) {
      tags = data.tags.map((tag: { name?: string } | string) => 
        typeof tag === 'string' ? tag : (tag.name || '')
      ).filter(Boolean);
    }
    
    // Log tags for debugging
    if (tags.length > 0) {
      console.log(`  Tags for ${conversationId}: [${tags.join(', ')}]`);
    }
    
    // Determine workspace from tags using CONTAINS logic
    const workspace = determineWorkspace(tags);
    
    // Determine 360 queue status
    const { is360, queueType } = determine360Queue(tags);
    
    return {
      realDate,
      tags,
      workspace,
      is360Queue: is360,
      queueType360: queueType,
    };
  } catch (error) {
    console.error(`Error fetching conversation ${conversationId}:`, error);
    return null;
  }
}

// ============================================
// TIMESTAMP PARSING - Handles seconds, milliseconds, AND ISO strings
// ============================================

function parseTimestampToDate(ts: number | string): string | null {
  if (!ts) return null;
  
  const tsStr = String(ts).trim();
  
  // Check if it's an ISO date string (e.g., "2025-12-07T07:56:05Z" or "2025-12-07 07:56:05")
  if (tsStr.includes('-') && tsStr.length >= 10) {
    // Try to parse as ISO date
    const dateMatch = tsStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      console.log(`  Parsed ISO date: ${tsStr} -> ${year}-${month}-${day}`);
      return `${year}-${month}-${day}`;
    }
  }
  
  // Handle Unix timestamp (seconds or milliseconds)
  const tsNum = Number(tsStr);
  
  if (isNaN(tsNum) || tsNum <= 0) return null;
  
  // Threshold to distinguish seconds from milliseconds
  const SECONDS_THRESHOLD = 10_000_000_000; // 10 billion
  
  let dateMs: number;
  
  if (tsNum > SECONDS_THRESHOLD) {
    // This is in milliseconds
    dateMs = tsNum;
  } else if (tsNum > 1_000_000_000) {
    // This is in seconds
    dateMs = tsNum * 1000;
  } else {
    return null;
  }
  
  const date = new Date(dateMs);
  
  // Return ISO date string (YYYY-MM-DD) - this is UTC which is what we want
  return date.toISOString().split("T")[0];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function fetchAllAdmins(token: string): Promise<Record<string, string>> {
  const adminsMap: Record<string, string> = {};
  let url = "https://api.intercom.io/admins";

  while (url) {
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Intercom-Version": "2.14",
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch admins: ${response.status}`);
      break;
    }

    const data = await response.json();
    const admins = data.admins || [];

    for (const admin of admins) {
      const id = admin.id || admin.admin_id;
      const name = admin.name || admin.email || id;
      if (id) {
        adminsMap[String(id)] = name;
      }
    }

    const pages = data.pages || {};
    url = pages.next || "";
  }

  return adminsMap;
}

async function enqueueExport(
  token: string,
  startTime: number,
  endTime: number,
  attributeIds: string[]
): Promise<string> {
  const response = await fetch("https://api.intercom.io/export/reporting_data/enqueue", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Intercom-Version": "2.14",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      dataset_id: "conversation",
      attribute_ids: attributeIds,
      start_time: startTime,
      end_time: endTime,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Enqueue failed: ${response.status} ${text}`);
  }

  const data = await response.json() as IntercomExportJob;
  const jobId = data.job_identifier || data.id || data.jobId;
  if (!jobId) {
    throw new Error("No job_identifier in enqueue response");
  }

  return jobId;
}

async function pollExport(
  token: string,
  appId: string,
  jobId: string,
  maxWaitSeconds = 600
): Promise<IntercomExportJob> {
  const startTime = Date.now();
  let delay = 5000;

  while (true) {
    const url = new URL(`https://api.intercom.io/export/reporting_data/${jobId}`);
    if (appId) {
      url.searchParams.set("app_id", appId);
    }

    const response = await fetch(url.toString(), {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Intercom-Version": "2.14",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Poll failed: ${response.status} ${text}`);
    }

    const data = await response.json() as IntercomExportJob;
    const status = data.status || data.state || "";

    console.log(`Job ${jobId} status=${status}`);

    if (data.download_url) {
      return data;
    }

    if (status && ["complete", "completed", "success"].includes(status.toLowerCase())) {
      return data;
    }

    if (status && ["failed", "error"].includes(status.toLowerCase())) {
      throw new Error(`Export job failed: ${JSON.stringify(data)}`);
    }

    if (Date.now() - startTime > maxWaitSeconds * 1000) {
      throw new Error("Export job timeout");
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(60000, delay * 2);
  }
}

async function downloadExport(
  token: string,
  appId: string,
  jobResp: IntercomExportJob,
  jobId: string
): Promise<Uint8Array> {
  if (jobResp.download_url) {
    console.log("Attempting download_url...");
    const response = await fetch(jobResp.download_url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/octet-stream",
      },
    });

    if (response.ok) {
      console.log("Downloaded successfully");
      return new Uint8Array(await response.arrayBuffer());
    }
    console.warn(`download_url failed with status ${response.status}`);
  }

  console.log("Trying fallback endpoint...");
  const url = new URL(`https://api.intercom.io/download/reporting_data/${jobId}`);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("job_identifier", jobId);

  const response = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/octet-stream",
      "Intercom-Version": "2.14",
    },
  });

  if (!response.ok) {
    throw new Error(`All download attempts failed: ${response.status}`);
  }

  console.log("Downloaded from fallback endpoint");
  return new Uint8Array(await response.arrayBuffer());
}

async function parseExportBytes(content: Uint8Array): Promise<ConversationRow[]> {
  let text: string;

  if (content[0] === 0x1f && content[1] === 0x8b) {
    const decompressed = await new Response(
      new Blob([content]).stream().pipeThrough(new DecompressionStream("gzip"))
    ).text();
    text = decompressed;
  } else {
    text = new TextDecoder().decode(content);
  }

  const lines = text.trim().split("\n");
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const rows: ConversationRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = parseCSVLine(lines[i]);
    const row: ConversationRow = {};

    headers.forEach((header: string, index: number) => {
      row[header] = values[index] || "";
    });

    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseConversationRow(row: ConversationRow, adminsMap: Record<string, string>) {
  // FIXED: Prioritize conversation_started_at (when chat began) over conversation_last_closed_at
  // The Reporting Export API provides the correct date here
  let metricDate: string;
  let dateIsFromExport = false;
  
  // Log raw date values for debugging
  console.log(`  Raw dates for ${row.conversation_id}: started_at=${row.conversation_started_at}, closed_at=${row.conversation_last_closed_at}`);
  
  // Use conversation_started_at first (this is when the conversation actually started)
  const ts = row.conversation_started_at || row.conversation_last_closed_at || "";

  if (ts && ts.trim() !== "" && ts.trim() !== "0") {
    const parsed = parseTimestampToDate(ts.trim());
    if (parsed) {
      metricDate = parsed;
      dateIsFromExport = true; // Mark that we got a valid date from export
      console.log(`  Export date for ${row.conversation_id}: ${metricDate} (from ${row.conversation_started_at ? 'started_at' : 'closed_at'})`);
    } else {
      metricDate = new Date().toISOString().split("T")[0];
      console.log(`  Failed to parse date from: ${ts}`);
    }
  } else {
    metricDate = new Date().toISOString().split("T")[0];
    console.log(`  No date found in export, using today`);
  }

  const agentRaw =
    row.currently_assigned_teammate_id ||
    row.currently_assigned_teammate_raw_id ||
    row.assignee_id ||
    "Unknown";

  const agentName = resolveAgentName(agentRaw, adminsMap);

  const aiScoreRaw =
    row.ai_cx_score_rating ||
    row.conversation_rating ||
    row.fin_ai_agent_rating ||
    "";

  let aiScore: number | null = null;
  if (aiScoreRaw) {
    try {
      const scoreFloat = parseFloat(aiScoreRaw);
      if (scoreFloat >= 1 && scoreFloat <= 5) {
        aiScore = Math.round(scoreFloat * 100) / 100;
      }
    } catch {
      // Invalid score
    }
  }

  const aiExplanation = row.ai_cx_score_explanation || null;

  let ratingSource: 'ai' | 'human' | 'both' | 'none' = 'none';
  if (aiScore !== null) {
    ratingSource = 'ai';
  }

  return {
    conversation_id: row.conversation_id,
    agent_id: agentRaw,
    agent_name: agentName,
    metric_date: metricDate,
    date_is_from_export: dateIsFromExport, // Flag to prevent overwriting valid dates
    ai_score: aiScore,
    ai_feedback: aiExplanation,
    resolution_status: row.conversation_state || "completed",
    response_time_seconds: null,
    customer_satisfaction_score: null,
    rating_source: ratingSource,
    // These will be populated by enrichment
    tags: [] as string[],
    workspace: 'Unknown',
    is_360_queue: false,
    queue_type_360: null as string | null,
  };
}

function resolveAgentName(agentId: string, adminsMap: Record<string, string>): string {
  if (!agentId || agentId === "Unknown") {
    return "Unassigned";
  }

  if (!/^\d+$/.test(String(agentId).trim()) && !/^[0-9a-fA-F-]{8,}$/.test(String(agentId).trim())) {
    return agentId;
  }
  
  return adminsMap[String(agentId)] || "Unassigned";
}