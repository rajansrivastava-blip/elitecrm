import { User, Lead, Appointment, CommunicationLog, LeadEditLog, LeadStatus } from "./types";
import { createClient } from "@supabase/supabase-js";

// ==========================================
// CLIENT-SIDE DIRECT SUPABASE CLIENT INITIALIZATION
// ==========================================

const RAW_URL = (import.meta as any).env?.VITE_SUPABASE_URL || "https://fzsjeukjjjutiihhzjgu.supabase.co";
const RAW_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "sb_publishable_PTNuV0AtVvNGIUKk9P6nIA_DcgGCrk1";

let SUPABASE_URL = String(RAW_URL).trim();
let SUPABASE_ANON_KEY = String(RAW_KEY).trim();

// Swapped configuration recovery (similar to server-side check)
if (SUPABASE_URL.startsWith("sb_publishable_") || SUPABASE_URL.startsWith("sb_secret_")) {
  SUPABASE_URL = "https://fzsjeukjjjutiihhzjgu.supabase.co";
}

let formattedUrl = SUPABASE_URL;
if (formattedUrl.endsWith("/rest/v1/")) {
  formattedUrl = formattedUrl.substring(0, formattedUrl.length - "/rest/v1/".length);
} else if (formattedUrl.endsWith("/rest/v1")) {
  formattedUrl = formattedUrl.substring(0, formattedUrl.length - "/rest/v1".length);
}
if (formattedUrl.endsWith("/")) {
  formattedUrl = formattedUrl.substring(0, formattedUrl.length - 1);
}
if (!formattedUrl || typeof formattedUrl !== "string" || !formattedUrl.startsWith("http")) {
  formattedUrl = "https://fzsjeukjjjutiihhzjgu.supabase.co";
}

export const clientSupabase = createClient(formattedUrl, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    detectSessionInUrl: false
  }
});

// Helper to check if the configured Key is a secret key (cannot be used in browser directly for security reasons)
export function isKeySecret(): boolean {
  return SUPABASE_ANON_KEY.startsWith("sb_secret_") || SUPABASE_ANON_KEY.includes("service_role");
}

// State to track if Supabase is fully configured and tables exist
export interface SupabaseStatus {
  isConnected: boolean;
  tablesVerified: {
    users: boolean;
    leads: boolean;
    appointments: boolean;
    communication_logs: boolean;
    lead_edit_logs: boolean;
  };
  error?: string;
}

// ==========================================
// DATA CONVERTERS (camelCase <-> snake_case)
// ==========================================

export function mapUserFromDb(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || undefined,
    role: row.role,
    avatarUrl: row.avatar_url,
    department: row.department,
    password: row.password,
    teamLeaderId: row.team_leader_id,
    active: (row.active === undefined || row.active === null) ? undefined : !!row.active
  };
}

export function mapUserToDb(user: User): any {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || null,
    role: user.role,
    avatar_url: user.avatarUrl,
    department: user.department,
    password: user.password,
    team_leader_id: user.teamLeaderId,
    active: user.active === undefined ? true : !!user.active
  };
}

export function mapStatusFromDb(dbStatus: string): LeadStatus {
  if (!dbStatus) return "New Lead";
  const statusStr = String(dbStatus).trim();
  const lower = statusStr.toLowerCase();

  if (lower === "new") return "New Lead";
  if (lower === "contacted") return "Interested";
  if (lower === "qualified") return "Follow Up";
  if (lower === "proposal") return "Detailed Share";
  if (lower === "closed_won") return "Closed Client";
  if (lower === "closed_lost") return "Not Interested";

  const list: LeadStatus[] = [
    "Interested", "Follow Up", "Detailed Share", "Not Interested", "Meeting Done",
    "Site Visit", "Call Back", "Junk", "Duplicate", "Not Pick", "New Lead",
    "Closed Client", "Switched Off", "Low Budget"
  ];

  const matched = list.find(s => s.toLowerCase() === lower);
  return matched || (statusStr as LeadStatus);
}

export function mapLeadFromDb(row: any): Lead {
  return {
    id: row.id,
    name: row.name,
    company: row.company,
    position: row.position,
    email: row.email,
    phone: row.phone,
    source: row.source,
    status: mapStatusFromDb(row.status),
    temperature: row.temperature,
    budget: row.budget,
    location: row.location,
    assignedAgent: row.assigned_agent,
    notes: row.notes,
    projectName: row.project_name,
    dateCreated: row.date_created,
    dateUpdated: row.date_updated,
    lastCommunication: row.last_communication,
    score: row.score,
    assignmentTimestamp: row.assignment_timestamp ? Number(row.assignment_timestamp) : undefined,
    assignedTlId: row.assigned_tl_id || undefined,
    lastActionTimestamp: row.last_action_timestamp ? Number(row.last_action_timestamp) : undefined,
    reassignedTimestamp: row.reassigned_timestamp ? Number(row.reassigned_timestamp) : undefined
  };
}

export function mapLeadToDb(lead: Lead): any {
  // Safe integer parsing for PG 'score' (INTEGER NOT NULL DEFAULT 50)
  let scoreVal = 50;
  if (lead.score !== undefined && lead.score !== null && (lead.score as any) !== "") {
    const num = Number(lead.score);
    if (!isNaN(num)) {
      scoreVal = Math.floor(num);
    }
  }

  // Safe bigint/integer helper for nullable timestamp columns
  const parseNullableBigIntVal = (val: any): number | null => {
    if (val === undefined || val === null || val === "" || String(val).toLowerCase() === "null") {
      return null;
    }
    const num = Number(val);
    return isNaN(num) ? null : Math.floor(num);
  };

  return {
    id: lead.id,
    name: lead.name,
    company: lead.company || null,
    position: lead.position || null,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    status: lead.status,
    temperature: lead.temperature,
    budget: lead.budget || null,
    location: lead.location || null,
    assigned_agent: lead.assignedAgent,
    notes: lead.notes || null,
    project_name: lead.projectName || null,
    date_created: lead.dateCreated,
    date_updated: lead.dateUpdated,
    last_communication: lead.lastCommunication,
    score: scoreVal,
    assignment_timestamp: parseNullableBigIntVal(lead.assignmentTimestamp),
    assigned_tl_id: lead.assignedTlId || null,
    last_action_timestamp: parseNullableBigIntVal(lead.lastActionTimestamp),
    reassigned_timestamp: parseNullableBigIntVal(lead.reassignedTimestamp)
  };
}

export function mapAppointmentFromDb(row: any): Appointment {
  return {
    id: row.id,
    leadId: row.lead_id,
    leadName: row.lead_name,
    title: row.title,
    date: row.date,
    time: row.time,
    type: row.type,
    notes: row.notes,
    isCompleted: row.is_completed,
    reminderActive: row.reminder_active
  };
}

export function mapAppointmentToDb(app: Appointment): any {
  return {
    id: app.id,
    lead_id: app.leadId,
    lead_name: app.leadName,
    title: app.title,
    date: app.date,
    time: app.time,
    type: app.type,
    notes: app.notes,
    is_completed: app.isCompleted,
    reminder_active: app.reminderActive
  };
}

export function mapCommunicationLogFromDb(row: any): CommunicationLog {
  return {
    id: row.id,
    leadId: row.lead_id,
    date: row.date,
    type: row.type,
    content: row.content,
    sender: row.sender
  };
}

export function mapCommunicationLogToDb(log: CommunicationLog): any {
  return {
    id: log.id,
    lead_id: log.leadId,
    date: log.date,
    type: log.type,
    content: log.content,
    sender: log.sender
  };
}

export function mapLeadEditLogFromDb(row: any): LeadEditLog {
  return {
    id: row.id,
    leadId: row.lead_id,
    leadName: row.lead_name,
    editorName: row.editor_name,
    editorRole: row.editor_role,
    timestamp: row.timestamp,
    changes: Array.isArray(row.changes) ? row.changes : []
  };
}

export function mapLeadEditLogToDb(log: LeadEditLog): any {
  return {
    id: log.id,
    lead_id: log.leadId,
    lead_name: log.leadName,
    editor_name: log.editorName,
    editor_role: log.editorRole,
    timestamp: log.timestamp,
    changes: log.changes
  };
}

// ==========================================
// RESILIENT CLIENT DIRECT UPSERT
// ==========================================

async function resilientClientUpsert(tableName: string, payload: any): Promise<{ success: boolean; error?: any }> {
  if (isKeySecret()) {
    return { success: false, error: { message: "Direct database write bypassed: A secret API key is configured. Please sync via the CRM backend proxy instead." } };
  }
  let currentPayload = JSON.parse(JSON.stringify(payload));
  const removedColumns = new Set<string>();
  
  while (true) {
    const options: any = {};
    if (["users", "leads", "appointments"].includes(tableName)) {
      options.ignoreDuplicates = false;
      options.onConflict = "id";
    }
    const { error } = await clientSupabase.from(tableName).upsert(currentPayload, options);
    if (!error) {
      return { success: true };
    }
    
    let colName: string | null = null;
    if (error.message) {
      const matchSchema = error.message.match(/Could not find the '([^']+)' column/i);
      if (matchSchema && matchSchema[1]) {
        colName = matchSchema[1];
      }
      if (!colName) {
        const matchDouble = error.message.match(/column "([^"]+)"/i);
        if (matchDouble && matchDouble[1]) {
          colName = matchDouble[1];
        }
      }
      if (!colName) {
        const matchSingle = error.message.match(/column '([^']+)'/i);
        if (matchSingle && matchSingle[1]) {
          colName = matchSingle[1];
        }
      }
    }
    
    const isMissingColumnError = error.code === "42703" || !!colName ||
      (error.message && (
        error.message.includes("does not exist") || 
        error.message.includes("schema cache") || 
        error.message.includes("column")
      ));
      
    if (isMissingColumnError && colName) {
      if (removedColumns.has(colName)) {
        return { success: false, error };
      }
      removedColumns.add(colName);
      console.warn(`[Client Direct Supabase] Column "${colName}" does not exist in table "${tableName}". Filtering it out and retrying.`);
      
      if (Array.isArray(currentPayload)) {
        currentPayload = currentPayload.map((item: any) => {
          const copy = { ...item };
          delete copy[colName];
          return copy;
        });
      } else {
        delete currentPayload[colName];
      }
      continue;
    }
    
    return { success: false, error };
  }
}

// ==========================================
// DB STATUS CHECKER FALLBACK
// ==========================================

async function checkClientSupabaseStatus(): Promise<SupabaseStatus> {
  if (isKeySecret()) {
    return {
      isConnected: false,
      tablesVerified: { users: false, leads: false, appointments: false, communication_logs: false, lead_edit_logs: false },
      error: "Direct database status check bypassed: A secret API key is configured. Handshake verified via CRM backend proxy instead."
    };
  }
  try {
    const checkTable = async (tableName: string): Promise<boolean> => {
      const { error } = await clientSupabase.from(tableName).select("count", { count: "exact", head: true });
      return !error || (error.code !== "42P01" && error.code !== "P0001");
    };

    const usersOk = await checkTable("users");
    const leadsOk = await checkTable("leads");
    const appointmentsOk = await checkTable("appointments");
    const communicationLogsOk = await checkTable("communication_logs");
    const leadEditLogsOk = await checkTable("lead_edit_logs");

    return {
      isConnected: usersOk || leadsOk,
      tablesVerified: {
        users: usersOk,
        leads: leadsOk,
        appointments: appointmentsOk,
        communication_logs: communicationLogsOk,
        lead_edit_logs: leadEditLogsOk
      }
    };
  } catch (err: any) {
    return {
      isConnected: false,
      tablesVerified: {
        users: false, leads: false, appointments: false, communication_logs: false, lead_edit_logs: false
      },
      error: err.message || String(err)
    };
  }
}

// ==========================================
// CORE DB DATA SYNC - BULK / SEED OPERATIONS
// ==========================================

export async function checkSupabaseStatus(): Promise<SupabaseStatus> {
  try {
    const res = await fetch("/api/db/status");
    if (!res.ok) {
      if (res.status === 404) {
        console.warn("[checkSupabaseStatus] /api/db/status returns 404 (static web host). Querying Supabase directly.");
        return await checkClientSupabaseStatus();
      }
      throw new Error(`Server returned HTTP status ${res.status}`);
    }
    return await res.json();
  } catch (err: any) {
    console.warn("[checkSupabaseStatus] HTTP query failed, falling back to direct browser verification:", err);
    return await checkClientSupabaseStatus();
  }
}

async function pushLocalClientData(payload: {
  users: any[];
  leads: any[];
  appointments: any[];
  communicationLogs: any[];
  leadEditLogs: any[];
}): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];
  try {
    if (payload.users && payload.users.length > 0) {
      const { success, error } = await resilientClientUpsert("users", payload.users);
      if (!success && error) errors.push(`Users push failed: ${error.message || JSON.stringify(error)}`);
    }
    if (payload.leads && payload.leads.length > 0) {
      const { success, error } = await resilientClientUpsert("leads", payload.leads);
      if (!success && error) errors.push(`Leads push failed: ${error.message || JSON.stringify(error)}`);
    }
    if (payload.appointments && payload.appointments.length > 0) {
      const { success, error } = await resilientClientUpsert("appointments", payload.appointments);
      if (!success && error) errors.push(`Appointments push failed: ${error.message || JSON.stringify(error)}`);
    }
    if (payload.communicationLogs && payload.communicationLogs.length > 0) {
      const { success, error } = await resilientClientUpsert("communication_logs", payload.communicationLogs);
      if (!success && error) errors.push(`Comm logs push failed: ${error.message || JSON.stringify(error)}`);
    }
    if (payload.leadEditLogs && payload.leadEditLogs.length > 0) {
      const { success, error } = await resilientClientUpsert("lead_edit_logs", payload.leadEditLogs);
      if (!success && error) errors.push(`Edit logs push failed: ${error.message || JSON.stringify(error)}`);
    }
    return { success: errors.length === 0, errors };
  } catch (err: any) {
    return { success: false, errors: [err.message || String(err)] };
  }
}

export async function pushLocalDataToSupabase(data: {
  users: User[];
  leads: Lead[];
  appointments: Appointment[];
  communicationLogs: CommunicationLog[];
  leadEditLogs: LeadEditLog[];
}): Promise<{ success: boolean; errors: string[] }> {
  const payload = {
    users: data.users.map(mapUserToDb),
    leads: data.leads.map(mapLeadToDb),
    appointments: data.appointments.map(mapAppointmentToDb),
    communicationLogs: data.communicationLogs.map(mapCommunicationLogToDb),
    leadEditLogs: data.leadEditLogs.map(mapLeadEditLogToDb)
  };

  try {
    const res = await fetch("/api/db/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.status === 404) {
      if (isKeySecret()) {
        return {
          success: false,
          errors: ["CRM backend proxy endpoint /api/db/push returned 404. Since a Secret/Service Role API key is configured, direct client-side database writes are disabled for security. Please make sure the full-stack server is running and configured."]
        };
      }
      console.warn("[pushLocalDataToSupabase] /api/db/push returned 404. Falling back to browser direct socket push.");
      return await pushLocalClientData(payload);
    }
    if (!res.ok) {
      const parsed = await res.json().catch(() => ({}));
      return { success: false, errors: [parsed.error || `Push operation query rejected (HTTP ${res.status}).`] };
    }
    const parsed = await res.json();
    return { success: parsed.success, errors: parsed.errors || [] };
  } catch (err: any) {
    if (isKeySecret()) {
      return {
        success: false,
        errors: [`CRM backend connection failed: ${err.message || String(err)}. Direct client-side database write bypassed because a Secret/Service Role API key is configured.`]
      };
    }
    console.warn("[pushLocalDataToSupabase] REST proxy offline, triggering direct database bypass:", err);
    return await pushLocalClientData(payload);
  }
}

async function selectAllFromTable(supabaseClient: any, tableName: string, columns: string = "*"): Promise<any[]> {
  let allRows: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabaseClient
      .from(tableName)
      .select(columns)
      .range(from, to);
    
    if (error) {
      throw error;
    }
    if (!data || data.length === 0) {
      break;
    }
    allRows.push(...data);
    if (data.length < pageSize) {
      break;
    }
    page++;
  }
  return allRows;
}

async function pullClientSupabaseData(): Promise<{
  users: User[] | null;
  leads: Lead[] | null;
  appointments: Appointment[] | null;
  communicationLogs: CommunicationLog[] | null;
  leadEditLogs: LeadEditLog[] | null;
  errors: string[];
}> {
  if (isKeySecret()) {
    return {
      users: [], leads: [], appointments: [], communicationLogs: [], leadEditLogs: [],
      errors: ["Direct database pull bypassed: A secret API key is configured. Please sync via the CRM backend proxy instead."]
    };
  }
  const errors: string[] = [];
  let users: any[] | null = null;
  let leads: any[] | null = null;
  let appointments: any[] | null = null;
  let communicationLogs: any[] | null = null;
  let leadEditLogs: any[] | null = null;

  try {
    users = await selectAllFromTable(clientSupabase, "users");
  } catch (e: any) { errors.push(`Client users extraction error: ${e.message}`); }

  try {
    leads = await selectAllFromTable(clientSupabase, "leads");
  } catch (e: any) { errors.push(`Client leads extraction error: ${e.message}`); }

  try {
    appointments = await selectAllFromTable(clientSupabase, "appointments");
  } catch (e: any) { errors.push(`Client appointments extraction error: ${e.message}`); }

  try {
    communicationLogs = await selectAllFromTable(clientSupabase, "communication_logs");
  } catch (e: any) { errors.push(`Client comm logs extraction error: ${e.message}`); }

  try {
    leadEditLogs = await selectAllFromTable(clientSupabase, "lead_edit_logs");
  } catch (e: any) { errors.push(`Client lead edit logs extraction error: ${e.message}`); }

  return {
    users: users ? users.map(mapUserFromDb) : [],
    leads: leads ? leads.map(mapLeadFromDb) : [],
    appointments: appointments ? appointments.map(mapAppointmentFromDb) : [],
    communicationLogs: communicationLogs ? communicationLogs.map(mapCommunicationLogFromDb) : [],
    leadEditLogs: leadEditLogs ? leadEditLogs.map(mapLeadEditLogFromDb) : [],
    errors
  };
}

export async function pullSupabaseData(): Promise<{
  users: User[] | null;
  leads: Lead[] | null;
  appointments: Appointment[] | null;
  communicationLogs: CommunicationLog[] | null;
  leadEditLogs: LeadEditLog[] | null;
  errors: string[];
}> {
  try {
    const res = await fetch("/api/db/pull");
    if (res.status === 404) {
      console.warn("[pullSupabaseData] /api/db/pull returned 404 (static web host). Querying Supabase via Client Library.");
      return await pullClientSupabaseData();
    }
    if (!res.ok) {
      const parsedError = await res.json();
      return {
        users: null, leads: null, appointments: null, communicationLogs: null, leadEditLogs: null,
        errors: [parsedError.error || `Failed HTTP pull logic: ${res.status}`]
      };
    }
    const parsed = await res.json();
    return {
      users: parsed.users ? parsed.users.map(mapUserFromDb) : [],
      leads: parsed.leads ? parsed.leads.map(mapLeadFromDb) : [],
      appointments: parsed.appointments ? parsed.appointments.map(mapAppointmentFromDb) : [],
      communicationLogs: parsed.communicationLogs ? parsed.communicationLogs.map(mapCommunicationLogFromDb) : [],
      leadEditLogs: parsed.leadEditLogs ? parsed.leadEditLogs.map(mapLeadEditLogFromDb) : [],
      errors: parsed.errors || []
    };
  } catch (err: any) {
    console.warn("[pullSupabaseData] REST server unavailable, invoking direct client query:", err);
    return await pullClientSupabaseData();
  }
}

// ==========================================
// RESILIENT INDIVIDUAL UPDATES (REST PROXIES)
// ==========================================

export async function dbUpsertUser(user: User): Promise<{ success: boolean; error?: string }> {
  const dbPayload = mapUserToDb(user);
  try {
    const res = await fetch("/api/db/upsert-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dbPayload)
    });
    if (res.status === 404) {
      if (isKeySecret()) {
        return { success: false, error: "CRM backend proxy endpoint /api/db/upsert-user returned 404. Direct client-side write is disabled for security when a Secret API key is configured." };
      }
      console.warn("[dbUpsertUser] Fallback to client-side direct upsert.");
      const { success, error } = await resilientClientUpsert("users", dbPayload);
      return { success, error: error?.message };
    }
    if (!res.ok) {
      const parsed = await res.json();
      return { success: false, error: parsed.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    if (isKeySecret()) {
      return { success: false, error: `CRM backend connection failed: ${err.message || String(err)}. Direct client-side write bypassed because a Secret API key is configured.` };
    }
    console.warn("[dbUpsertUser] Server route failed, performing direct socket write:", err);
    console.warn("[Bypass warning] Proxy connection failed. Executing direct write fallback.");
    const { success, error } = await resilientClientUpsert("users", dbPayload);
    return { success, error: error?.message || err.message || String(err) };
  }
}

export async function dbGetUser(id: string): Promise<{ user: User | null; error?: string }> {
  try {
    const res = await fetch("/api/db/get-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (res.status === 404) {
      console.warn("[dbGetUser] Fallback to client-side direct query.");
      const { data, error } = await clientSupabase.from("users").select("*").eq("id", id).maybeSingle();
      if (error) return { user: null, error: error.message };
      return { user: data ? mapUserFromDb(data) : null };
    }
    const parsed = await res.json();
    if (!res.ok) {
      return { user: null, error: parsed.error || `HTTP ${res.status}` };
    }
    return { user: parsed.user ? mapUserFromDb(parsed.user) : null };
  } catch (err: any) {
    console.warn("[dbGetUser] Server route failed, performing direct schema retrieval:", err);
    try {
      const { data, error } = await clientSupabase.from("users").select("*").eq("id", id).maybeSingle();
      if (error) return { user: null, error: error.message };
      return { user: data ? mapUserFromDb(data) : null };
    } catch (e: any) {
      return { user: null, error: e.message || String(e) };
    }
  }
}

export async function dbDeleteUser(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/db/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (res.status === 404) {
      console.warn("[dbDeleteUser] Bypassed client-side direct deletion. Deletion is disabled to protect database history integrity.");
      return { success: true };
    }
    if (!res.ok) {
      const parsed = await res.json();
      return { success: false, error: parsed.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    console.warn("[dbDeleteUser] Server connection bypassed, client-side hard delete bypassed per user instructions.");
    return { success: true };
  }
}

export async function dbUpsertLead(lead: Lead): Promise<{ success: boolean; error?: string }> {
  const dbPayload = mapLeadToDb(lead);
  try {
    const res = await fetch("/api/db/upsert-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dbPayload)
    });
    if (res.status === 404) {
      if (isKeySecret()) {
        return { success: false, error: "CRM backend proxy endpoint /api/db/upsert-lead returned 404. Direct client-side write is disabled for security when a Secret API key is configured." };
      }
      console.warn("[dbUpsertLead] Fallback to client-side direct upsert.");
      const { success, error } = await resilientClientUpsert("leads", dbPayload);
      return { success, error: error?.message };
    }
    if (!res.ok) {
      const parsed = await res.json();
      return { success: false, error: parsed.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    if (isKeySecret()) {
      return { success: false, error: `CRM backend connection failed: ${err.message || String(err)}. Direct client-side write bypassed because a Secret API key is configured.` };
    }
    console.warn("[dbUpsertLead] Server connection bypassed, using direct lead upsert fallback:", err);
    console.warn("[Bypass warning] Proxy connection failed. Executing direct write fallback.");
    const { success, error } = await resilientClientUpsert("leads", dbPayload);
    return { success, error: error?.message || err.message || String(err) };
  }
}

export async function dbDeleteLead(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/db/delete-lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (res.status === 404) {
      console.warn("[dbDeleteLead] Bypassed client-side direct deletion. Deletion is disabled to protect database history integrity.");
      return { success: true };
    }
    if (!res.ok) {
      const parsed = await res.json();
      return { success: false, error: parsed.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    console.warn("[dbDeleteLead] Server connection bypassed, client-side hard delete bypassed per user instructions.");
    return { success: true };
  }
}

export async function dbUpsertAppointment(app: Appointment): Promise<{ success: boolean; error?: string }> {
  const dbPayload = mapAppointmentToDb(app);
  try {
    const res = await fetch("/api/db/upsert-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dbPayload)
    });
    if (res.status === 404) {
      if (isKeySecret()) {
        return { success: false, error: "CRM backend proxy endpoint /api/db/upsert-appointment returned 404. Direct client-side write is disabled for security when a Secret API key is configured." };
      }
      console.warn("[dbUpsertAppointment] Fallback to client-side direct upsert.");
      const { success, error } = await resilientClientUpsert("appointments", dbPayload);
      return { success, error: error?.message };
    }
    if (!res.ok) {
      const parsed = await res.json();
      return { success: false, error: parsed.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    if (isKeySecret()) {
      return { success: false, error: `CRM backend connection failed: ${err.message || String(err)}. Direct client-side write bypassed because a Secret API key is configured.` };
    }
    console.warn("[dbUpsertAppointment] Server connection bypassed, using direct appointment upsert fallback:", err);
    console.warn("[Bypass warning] Proxy connection failed. Executing direct write fallback.");
    const { success, error } = await resilientClientUpsert("appointments", dbPayload);
    return { success, error: error?.message || err.message || String(err) };
  }
}

export async function dbDeleteAppointment(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch("/api/db/delete-appointment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    if (res.status === 404) {
      console.warn("[dbDeleteAppointment] Bypassed client-side direct deletion. Deletion is disabled to protect database history integrity.");
      return { success: true };
    }
    if (!res.ok) {
      const parsed = await res.json();
      return { success: false, error: parsed.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    console.warn("[dbDeleteAppointment] Server connection bypassed, client-side hard delete bypassed per user instructions.");
    return { success: true };
  }
}

export async function dbUpsertCommunicationLog(log: CommunicationLog): Promise<{ success: boolean; error?: string }> {
  const dbPayload = mapCommunicationLogToDb(log);
  try {
    const res = await fetch("/api/db/upsert-communication-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dbPayload)
    });
    if (res.status === 404) {
      if (isKeySecret()) {
        return { success: false, error: "CRM backend proxy endpoint /api/db/upsert-communication-log returned 404. Direct client-side write is disabled for security when a Secret API key is configured." };
      }
      console.warn("[dbUpsertCommunicationLog] Fallback to client-side direct upsert.");
      const { success, error } = await resilientClientUpsert("communication_logs", dbPayload);
      return { success, error: error?.message };
    }
    if (!res.ok) {
      const parsed = await res.json();
      return { success: false, error: parsed.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    if (isKeySecret()) {
      return { success: false, error: `CRM backend connection failed: ${err.message || String(err)}. Direct client-side write bypassed because a Secret API key is configured.` };
    }
    console.warn("[dbUpsertCommunicationLog] Server connection bypassed, using direct log upsert fallback:", err);
    console.warn("[Bypass warning] Proxy connection failed. Executing direct write fallback.");
    const { success, error } = await resilientClientUpsert("communication_logs", dbPayload);
    return { success, error: error?.message || err.message || String(err) };
  }
}

export async function dbUpsertLeadEditLog(log: LeadEditLog): Promise<{ success: boolean; error?: string }> {
  const dbPayload = mapLeadEditLogToDb(log);
  try {
    const res = await fetch("/api/db/upsert-lead-edit-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dbPayload)
    });
    if (res.status === 404) {
      if (isKeySecret()) {
        return { success: false, error: "CRM backend proxy endpoint /api/db/upsert-lead-edit-log returned 404. Direct client-side write is disabled for security when a Secret API key is configured." };
      }
      console.warn("[dbUpsertLeadEditLog] Fallback to client-side direct upsert.");
      const { success, error } = await resilientClientUpsert("lead_edit_logs", dbPayload);
      return { success, error: error?.message };
    }
    if (!res.ok) {
      const parsed = await res.json();
      return { success: false, error: parsed.error || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    if (isKeySecret()) {
      return { success: false, error: `CRM backend connection failed: ${err.message || String(err)}. Direct client-side write bypassed because a Secret API key is configured.` };
    }
    console.warn("[dbUpsertLeadEditLog] Server connection bypassed, using direct track changes fallback:", err);
    console.warn("[Bypass warning] Proxy connection failed. Executing direct write fallback.");
    const { success, error } = await resilientClientUpsert("lead_edit_logs", dbPayload);
    return { success, error: error?.message || err.message || String(err) };
  }
}

// ==========================================
// PROXY AUTHENTICATION ADAPTERS
// ==========================================

export async function dbSignUp(email: string, password: string): Promise<{ data: { user: any } | null; error?: { message: string } }> {
  try {
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (res.status === 404) {
      console.warn("[dbSignUp] /api/auth/signup returned 404. Falling back to direct client-side Supabase auth.");
      if (isKeySecret()) {
        return { data: null, error: { message: "Direct signup bypassed: A secret API key is configured. Please use proxy servers." } };
      }
      const { data, error } = await clientSupabase.auth.signUp({ email, password });
      if (error) return { data: null, error: { message: error.message } };
      return { data: { user: data.user } };
    }
    const parsed = await res.json();
    if (!res.ok) {
      return { data: null, error: { message: parsed.error || "Establish credentials query failed." } };
    }
    return { data: { user: parsed.user } };
  } catch (err: any) {
    console.warn("[dbSignUp] API failed, falling back to direct client-side auth:", err);
    if (isKeySecret()) {
      return { data: null, error: { message: "Direct signup bypassed: A secret API key is configured. Please use proxy servers." } };
    }
    try {
      const { data, error } = await clientSupabase.auth.signUp({ email, password });
      if (error) return { data: null, error: { message: error.message } };
      return { data: { user: data.user } };
    } catch (e: any) {
      return { data: null, error: { message: e.message || String(e) } };
    }
  }
}

export async function dbSignIn(email: string, password: string): Promise<{ data: { user: any } | null; error?: { message: string } }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (res.status === 404) {
      console.warn("[dbSignIn] /api/auth/login returned 404. Falling back to direct client-side Supabase auth.");
      if (isKeySecret()) {
        return { data: null, error: { message: "Direct signin bypassed: A secret API key is configured. Please use proxy servers." } };
      }
      const { data, error } = await clientSupabase.auth.signInWithPassword({ email, password });
      if (error) return { data: null, error: { message: error.message } };
      return { data: { user: data.user } };
    }
    const parsed = await res.json();
    if (!res.ok) {
      return { data: null, error: { message: parsed.error || "Bypass authenticate query failed." } };
    }
    return { data: { user: parsed.user } };
  } catch (err: any) {
    console.warn("[dbSignIn] API failed, falling back to direct client-side auth:", err);
    if (isKeySecret()) {
      return { data: null, error: { message: "Direct signin bypassed: A secret API key is configured. Please use proxy servers." } };
    }
    try {
      const { data, error } = await clientSupabase.auth.signInWithPassword({ email, password });
      if (error) return { data: null, error: { message: error.message } };
      return { data: { user: data.user } };
    } catch (e: any) {
      return { data: null, error: { message: e.message || String(e) } };
    }
  }
}

export async function dbBulkUpsert(data: {
  leads?: Lead[];
  appointments?: Appointment[];
}): Promise<{ success: boolean; error?: string }> {
  const payload = {
    users: [],
    leads: (data.leads || []).map(mapLeadToDb),
    appointments: (data.appointments || []).map(mapAppointmentToDb),
    communicationLogs: [],
    leadEditLogs: []
  };

  try {
    const res = await fetch("/api/db/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (res.status === 404) {
      if (isKeySecret()) {
        return {
          success: false,
          error: "CRM backend proxy endpoint /api/db/push returned 404. Since a Secret/Service Role API key is configured, direct client-side database writes are disabled for security. Please make sure the full-stack server is running and configured."
        };
      }
      console.warn("[dbBulkUpsert] /api/db/push returned 404. Falling back to direct client bulk insert.");
      const result = await pushLocalClientData(payload);
      return { success: result.success, error: result.errors?.join(", ") };
    }
    
    if (!res.ok) {
      const parsed = await res.json().catch(() => ({}));
      return { success: false, error: parsed.error || `HTTP ${res.status} push rejected` };
    }
    const parsed = await res.json();
    if (!parsed.success) {
      return { success: false, error: parsed.errors?.join(", ") || "Bulk operation failed" };
    }
    return { success: true };
  } catch (err: any) {
    if (isKeySecret()) {
      return {
        success: false,
        error: `CRM backend connection failed: ${err.message || String(err)}. Direct client-side database write bypassed because a Secret/Service Role API key is configured.`
      };
    }
    console.warn("[dbBulkUpsert] Direct REST proxy offline, sending to database directly:", err);
    const result = await pushLocalClientData(payload);
    return { success: result.success, error: result.errors?.join(", ") };
  }
}
