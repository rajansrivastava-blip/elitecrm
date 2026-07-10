import * as fs from "fs";
import * as path from "path";

interface Change {
  field: string;
  newValue: any;
  oldValue: any;
}

interface EditLog {
  id: string;
  leadId: string;
  leadName: string;
  editorName: string;
  editorRole: string;
  timestamp: string;
  changes: Change[];
}

interface Lead {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status: string;
  temperature?: string;
  budget?: string;
  location?: string;
  assignedAgent?: string;
  notes?: string | null;
  projectName?: string;
  dateCreated?: string;
  assignedTlId?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  teamLeaderId?: string | null;
}

function runBackup60() {
  const cachePath = path.join(process.cwd(), "crm_data_cache.json");
  if (!fs.existsSync(cachePath)) {
    console.error("crm_data_cache.json file not found!");
    return;
  }

  const raw = fs.readFileSync(cachePath, "utf8");
  const data = JSON.parse(raw);

  const leads: Lead[] = data.leads || [];
  const editLogs: EditLog[] = data.leadEditLogs || [];
  const users: User[] = data.users || [];

  // Group edit logs by leadId, sorted chronologically by timestamp/IDs to ensure reliable step-by-step reconstruction
  const logsByLead: { [leadId: string]: EditLog[] } = {};
  editLogs.forEach(log => {
    if (!logsByLead[log.leadId]) {
      logsByLead[log.leadId] = [];
    }
    logsByLead[log.leadId].push(log);
  });

  const reconstructedLeads = leads.map(lead => {
    const leadLogs = logsByLead[lead.id] || [];

    // Chronological changes to reconstruct original states before random auto-transfers on June 12
    const agentChanges = leadLogs.flatMap(log => 
      log.changes
        .filter(c => c.field === "assignedAgent")
        .map(c => ({
          timestamp: log.timestamp,
          editor: log.editorName,
          oldValue: c.oldValue,
          newValue: c.newValue
        }))
    );

    // Initial human assignment determination
    let originalAgent = "Pending Assignment";
    if (lead.assignedAgent && lead.assignedAgent !== "Pending Assignment" && lead.assignedAgent !== "Dummy") {
      originalAgent = lead.assignedAgent;
    }

    // Try tracing back through change history for the first actual assignee before auto-transfers
    if (agentChanges.length > 0) {
      const firstOldVal = agentChanges[0].oldValue;
      if (firstOldVal && firstOldVal !== "Pending Assignment" && firstOldVal !== "Dummy") {
        originalAgent = firstOldVal;
      } else {
        const firstNewVal = agentChanges[0].newValue;
        if (firstNewVal && firstNewVal !== "Pending Assignment" && firstNewVal !== "Dummy") {
          originalAgent = firstNewVal;
        }
      }
    }

    // If tracing back further shows a human edit assigned to someone else initially, use that
    const humanAssignLogs = agentChanges.filter(ch => ch.editor !== "System Auto-Transfer Agent");
    if (humanAssignLogs.length > 0 && originalAgent === "Pending Assignment") {
      originalAgent = humanAssignLogs[0].newValue || humanAssignLogs[0].oldValue;
    }

    // Capture first notes written by a team leader or sales agent (non-empty)
    let originalNotes = "";
    // Trace through change logs to capture the notes change that was not empty
    const notesLogs = leadLogs.filter(log => log.editorName !== "System Auto-Transfer Agent");
    for (const log of notesLogs) {
      const notesChange = log.changes.find(c => c.field === "notes");
      if (notesChange && notesChange.newValue) {
        originalNotes = notesChange.newValue;
        break;
      }
    }
    if (!originalNotes && lead.notes) {
      originalNotes = lead.notes;
    }

    // Capture first status written
    let originalStatus = lead.status;
    for (const log of notesLogs) {
      const statusChange = log.changes.find(c => c.field === "status");
      if (statusChange && statusChange.newValue) {
        originalStatus = statusChange.newValue;
        break;
      }
    }

    // Trace all transfer sequence steps for this lead
    const transferHistory = agentChanges.map(ch => ({
      timestamp: ch.timestamp,
      transferredBy: ch.editor,
      fromAgent: ch.oldValue || "Unassigned",
      toAgent: ch.newValue || "Unassigned"
    }));

    return {
      leadId: lead.id,
      leadName: lead.name,
      phone: lead.phone || "N/A",
      email: lead.email || "N/A",
      projectName: lead.projectName || "N/A",
      location: lead.location || "N/A",
      budget: lead.budget || "N/A",
      source: lead.source || "N/A",
      originalState: {
        assignedAgent: originalAgent,
        status: originalStatus,
        notes: originalNotes || "No notes originally captured"
      },
      currentState: {
        assignedAgent: lead.assignedAgent || "Unassigned",
        status: lead.status,
        notes: lead.notes || "No notes currently"
      },
      totalTransfersCount: transferHistory.length,
      isAutoTransferred: leadLogs.some(log => log.editorName === "System Auto-Transfer Agent"),
      transferHistory
    };
  });

  // Organize output by Teams
  const teamLeaders = users.filter(u => u.role === "team_leader");
  const salesTeam = users.filter(u => u.role === "sales_team");

  const teamsBackup = teamLeaders.map(tl => {
    // Lead assignments initially made to this Team Leader
    const originalTLLeads = reconstructedLeads.filter(r => r.originalState.assignedAgent === tl.name);
    // Lead assignments currently active under this TL
    const currentTLLeads = reconstructedLeads.filter(r => r.currentState.assignedAgent === tl.name);

    return {
      tlId: tl.id,
      tlName: tl.name,
      tlEmail: tl.email,
      department: tl.department,
      summary: {
        originalCount: originalTLLeads.length,
        currentCount: currentTLLeads.length,
        transferredAway: originalTLLeads.filter(l => l.currentState.assignedAgent !== tl.name).length
      },
      originalLeads: originalTLLeads.map(l => ({
        leadId: l.leadId,
        leadName: l.leadName,
        phone: l.phone,
        email: l.email,
        projectName: l.projectName,
        originalStatus: l.originalState.status,
        originalNotes: l.originalState.notes,
        currentAgent: l.currentState.assignedAgent,
        currentStatus: l.currentState.status,
        isAutoTransferred: l.isAutoTransferred,
        transferHistory: l.transferHistory
      }))
    };
  });

  const salesBackup = salesTeam.map(st => {
    const originalSalesLeads = reconstructedLeads.filter(r => r.originalState.assignedAgent === st.name);
    const currentSalesLeads = reconstructedLeads.filter(r => r.currentState.assignedAgent === st.name);

    return {
      agentId: st.id,
      agentName: st.name,
      agentEmail: st.email,
      department: st.department,
      teamLeaderId: st.teamLeaderId,
      summary: {
        originalCount: originalSalesLeads.length,
        currentCount: currentSalesLeads.length,
        transferredAway: originalSalesLeads.filter(l => l.currentState.assignedAgent !== st.name).length
      },
      originalLeads: originalSalesLeads.map(l => ({
        leadId: l.leadId,
        leadName: l.leadName,
        phone: l.phone,
        email: l.email,
        projectName: l.projectName,
        originalStatus: l.originalState.status,
        originalNotes: l.originalState.notes,
        currentAgent: l.currentState.assignedAgent,
        currentStatus: l.currentState.status,
        isAutoTransferred: l.isAutoTransferred,
        transferHistory: l.transferHistory
      }))
    };
  });

  const finalBackup60 = {
    backupName: "Elite Pro June 12 2026 Core Recovery",
    backupTimestamp: new Date().toISOString(),
    totalLeadsInSystem: leads.length,
    autoTransferredLeadsCount: reconstructedLeads.filter(l => l.isAutoTransferred).length,
    all60LeadsChronology: reconstructedLeads,
    teamLeadersBackup: teamsBackup,
    salesAgentsBackup: salesBackup
  };

  const outputPath = path.join(process.cwd(), "original_assigned_leads_backup_june_12.json");
  fs.writeFileSync(outputPath, JSON.stringify(finalBackup60, null, 2), "utf8");
  console.log(`[RECOVERY BACKUP COMPLETE] Rebuilt original June 12 assignment states for all ${leads.length} leads successfully!`);
}

runBackup60();
