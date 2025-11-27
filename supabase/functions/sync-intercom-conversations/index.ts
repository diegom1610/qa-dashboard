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
      console.log("First 5 rows with timestamps:");
      rows.slice(0, 5).forEach((row: ConversationRow) => {
        console.log(`  ID: ${row.conversation_id}, closed_at: "${row.conversation_last_closed_at}", started_at: "${row.conversation_started_at}"`);
      });
    }

    const conversations = rows
      .filter((row: ConversationRow) => row.conversation_id)
      .map((row: ConversationRow) => parseConversationRow(row, adminsMap));

    console.log(`Upserting ${conversations.length} conversations to Supabase...`);
    const { error } = await supabase
      .from("qa_metrics")
      .upsert(conversations, { onConflict: "conversation_id" });

    if (error) {
      throw new Error(`Failed to upsert: ${error.message}`);
    }

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

async function fetchAllAdmins(token: string): Promise<Record<string, string>> {
  const adminsMap: Record<string, string> = {};
  let url = "https://api.intercom.io/admins";

  while (url) {
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(`Failed to fetch admins: ${response.status}`);
      break;
    }

    const data = await response.json();
    const adminList = data.admins || data.data || [];

    for (const admin of adminList) {
      const aid = admin.id;
      const name = admin.name || admin.email || String(aid);
      if (aid) {
        adminsMap[String(aid)] = name;
      }
    }

    const nextUrl = data.pages?.next;
    url = nextUrl || "";
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
  const ts = row.conversation_last_closed_at || row.conversation_started_at || "";
  let metricDate: string;

  if (ts && ts.trim() !== "" && ts.trim() !== "0") {
    try {
      const tsNum = parseInt(ts.trim(), 10);
      if (!isNaN(tsNum) && tsNum > 1000000000) {
        metricDate = new Date(tsNum * 1000).toISOString().split("T")[0];
      } else {
        console.warn(`Invalid timestamp ${ts} for conversation ${row.conversation_id}, using today`);
        metricDate = new Date().toISOString().split("T")[0];
      }
    } catch (e) {
      console.warn(`Failed to parse timestamp ${ts} for conversation ${row.conversation_id}`);
      metricDate = new Date().toISOString().split("T")[0];
    }
  } else {
    console.warn(`No timestamp for conversation ${row.conversation_id}, using today`);
    metricDate = new Date().toISOString().split("T")[0];
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

  return {
    conversation_id: row.conversation_id,
    agent_id: agentRaw,
    agent_name: agentName,
    metric_date: metricDate,
    ai_score: aiScore,
    ai_feedback: aiExplanation,
    resolution_status: row.conversation_state || "completed",
    response_time_seconds: null,
    customer_satisfaction_score: null,
  };
}

function resolveAgentName(agentId: string, adminsMap: Record<string, string>): string {
  if (!agentId || agentId === "Unknown") {
    return "Unknown";
  }

  if (!/^\d+$/.test(String(agentId).trim()) && !/^[0-9a-fA-F-]{8,}$/.test(String(agentId).trim())) {
    return agentId;
  }
  
  return adminsMap[String(agentId)] || agentId;
}
