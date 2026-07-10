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

async function runBackup() {
  const cachePath = path.join(process.cwd(), "crm_data_cache.json");
  if (!fs.existsSync(cachePath)) {
    console.error("Cache file not found!");
    return;
  }

  const raw = fs.readFileSync(cachePath, "utf8");
  const data = JSON.parse(raw);

  const leads: Lead[] = data.leads || [];
  const users: User[] = data.users || [];
  const editLogs: EditLog[] = data.leadEditLogs || [];

  // Group edit logs by leadId, sorted chronologically.
  // Although leadEditLogs is usually sequential, let's process them.
  const logsByLead: { [leadId: string]: EditLog[] } = {};
  editLogs.forEach(log => {
    if (!logsByLead[log.leadId]) {
      logsByLead[log.leadId] = [];
    }
    logsByLead[log.leadId].push(log);
  });

  // Reconstruct lead histories to find:
  // - Original Assigned Agent (the first non-null agent assigned to this lead, or the first assignee before system auto-transfer)
  // - Original Notes (the first non-empty notes entered, or notes before auto-transfers)
  // - Original Status
  // - Logged history of transfers
  
  const reconstructedLeads = leads.map(lead => {
    const leadLogs = logsByLead[lead.id] || [];
    
    // Find first human assigned agent. Let's trace step-by-step
    // Current values from the main lead record
    let currentAgent = lead.assignedAgent || "Unassigned";
    let currentStatus = lead.status;
    let currentNotes = lead.notes || "";

    // Let's look at the chronological changes to reconstruct original states
    let originalAgent = "Unassigned";
    let originalStatus = currentStatus;
    let originalNotes = currentNotes;
    
    // Auto-transfer history for this specific lead
    const transferSteps: { timestamp: string; from: string; to: string; editor: string }[] = [];

    // Let's trace edits. 
    // We can find the very first human agent assignment.
    // If the lead was created with an agent, let's check its logs.
    // If we look at changes to 'assignedAgent' in chronological order:
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

    // Let's also see what the first status and notes were.
    // Let's find first edit of notes and status
    let firstNotesLog = leadLogs.find(log => log.changes.some(c => c.field === "notes"));
    if (firstNotesLog) {
      const notesChange = firstNotesLog.changes.find(c => c.field === "notes");
      originalNotes = notesChange ? notesChange.newValue : originalNotes;
    }

    let firstStatusLog = leadLogs.find(log => log.changes.some(c => c.field === "status"));
    if (firstStatusLog) {
      const statusChange = firstStatusLog.changes.find(c => c.field === "status");
      originalStatus = statusChange ? statusChange.newValue : originalStatus;
    }

    // Determine original agent
    if (agentChanges.length > 0) {
      // The old value of the very first assignment log is our initial state
      const initialOldValue = agentChanges[0].oldValue;
      if (initialOldValue && initialOldValue !== "Pending Assignment" && initialOldValue !== "Dummy") {
        originalAgent = initialOldValue;
      } else {
        // If it was unassigned initially, the first newValue is the first assignment
        originalAgent = agentChanges[0].newValue;
      }
      
      // If the first newValue was "Pardeep Sharma", or another agent, let's track it.
      // Let's list all steps
      agentChanges.forEach(ch => {
        transferSteps.push({
          timestamp: ch.timestamp,
          from: ch.oldValue || "Unassigned",
          to: ch.newValue || "Unassigned",
          editor: ch.editor
        });
      });
    } else {
      originalAgent = currentAgent;
    }

    // If original notes or status are empty, fallback to current
    if (!originalNotes && currentNotes) originalNotes = currentNotes;
    if (!originalStatus && currentStatus) originalStatus = currentStatus;

    return {
      leadId: lead.id,
      leadName: lead.name,
      projectName: lead.projectName || "N/A",
      originalAgent,
      originalStatus,
      originalNotes,
      currentAgent,
      currentStatus,
      currentNotes,
      transferSteps,
      isAutoTransferred: leadLogs.some(log => log.editorName === "System Auto-Transfer Agent")
    };
  });

  // Group by users (Team Leaders and Sales Team)
  // For each user, we will list:
  // 1. Leads currently assigned to them
  // 2. Leads originally assigned to them (but now transfered to someone else)
  // 3. Complete list of lead edits they performed
  const userBackups = users.map(user => {
    // Current assignments
    const currentlyAssignedLeads = reconstructedLeads.filter(r => r.currentAgent === user.name);
    
    // Original assignments that were transferred away
    const originallyAssignedTransferredAway = reconstructedLeads.filter(r => r.originalAgent === user.name && r.currentAgent !== user.name);

    // Edits made by this user
    const editsPerformed = editLogs
      .filter(log => log.editorName === user.name)
      .map(log => ({
        leadId: log.leadId,
        leadName: log.leadName,
        timestamp: log.timestamp,
        changes: log.changes
      }));

    return {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      role: user.role,
      department: user.department,
      teamLeaderId: user.teamLeaderId,
      summary: {
        currentCount: currentlyAssignedLeads.length,
        transferredAwayCount: originallyAssignedTransferredAway.length,
        totalOriginalCount: currentlyAssignedLeads.length + originallyAssignedTransferredAway.length,
        editsCount: editsPerformed.length
      },
      currentlyAssigned: currentlyAssignedLeads.map(l => ({
        leadId: l.leadId,
        leadName: l.leadName,
        projectName: l.projectName,
        status: l.currentStatus,
        notes: l.currentNotes,
        originalStatus: l.originalStatus,
        originalNotes: l.originalNotes
      })),
      originallyAssignedTransferredAway: originallyAssignedTransferredAway.map(l => ({
        leadId: l.leadId,
        leadName: l.leadName,
        projectName: l.projectName,
        originalStatus: l.originalStatus,
        originalNotes: l.originalNotes,
        transferredTo: l.currentAgent,
        currentStatus: l.currentStatus,
        currentNotes: l.currentNotes,
        transferHistory: l.transferSteps
      })),
      editsPerformed
    };
  });

  // Compile final report
  const report = {
    backupTimestamp: new Date().toISOString(),
    totalLeadsProcessed: leads.length,
    totalUsersProcessed: users.length,
    autoTransferredLeadsCount: reconstructedLeads.filter(l => l.isAutoTransferred).length,
    teamLeaders: userBackups.filter(u => u.role === "team_leader"),
    salesTeam: userBackups.filter(u => u.role === "sales_team"),
    rawReconstructedLeads: reconstructedLeads
  };

  const outputPath = path.join(process.cwd(), "all_teams_original_leads_backup.json");
  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`[BACKUP COMPLETED] Written backup of ${users.length} users and all their associated leads to: ${outputPath}`);
}

runBackup();
