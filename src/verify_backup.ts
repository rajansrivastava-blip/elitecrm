import * as fs from "fs";

const raw = fs.readFileSync("original_assigned_leads_backup_june_12.json", "utf8");
const data = JSON.parse(raw);

console.log("==================================================");
console.log("    JUNE 12 ORIGINAL RECOVERY VERIFICATION        ");
console.log("==================================================");
console.log("Backup Name:", data.backupName);
console.log("Timestamp:", data.backupTimestamp);
console.log("Total leads in backup file:", data.all60LeadsChronology.length);

console.log("\n--- RECOVERED PARDEEP SHARMA ORIGINAL LEADS ---");
const pardeepLeads = data.all60LeadsChronology.filter((l: any) => l.originalState.assignedAgent === "Pardeep Sharma");
pardeepLeads.forEach((l: any) => {
  console.log(`\nLead Name: ` + l.leadName + ` (` + l.leadId + `)`);
  console.log(`  Project: ` + l.projectName);
  console.log(`  Original Status: ` + l.originalState.status);
  console.log(`  Original Notes : ` + l.originalState.notes);
  console.log(`  Current Assigned Agent: ` + l.currentState.assignedAgent);
  console.log(`  Current Status: ` + l.currentState.status);
  console.log(`  Auto-Transferred: ` + l.isAutoTransferred);
});

console.log("\n==================================================");
