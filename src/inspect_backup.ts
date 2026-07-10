import * as fs from "fs";
import * as path from "path";

const raw = fs.readFileSync("all_teams_original_leads_backup.json", "utf8");
const data = JSON.parse(raw);

console.log("=========================================");
console.log("       SYSTEM BACKUP INSPECTION          ");
console.log("=========================================");
console.log("Total Leads Processed:", data.totalLeadsProcessed);
console.log("Total Users Backed Up:", data.totalUsersProcessed);
console.log("Auto-Transferred Leads Count:", data.autoTransferredLeadsCount);

console.log("\n--- TEAM LEADERS ORIGINAL ASSIGNMENTS & AUTO-TRANSFERS ---");
data.teamLeaders.forEach((tl: any) => {
  const tot = tl.summary.totalOriginalCount;
  const edits = tl.summary.editsCount;
  if (tot > 0 || edits > 0) {
    console.log(`\nTL Name: ` + tl.userName + ` (` + tl.userEmail + `)`);
    console.log(`  - Current Assigned: ` + tl.summary.currentCount);
    console.log(`  - Transferred Away: ` + tl.summary.transferredAwayCount);
    console.log(`  - Total Original Base: ` + tot);
    console.log(`  - Total Edits Logged: ` + edits);
    if (tl.originallyAssignedTransferredAway.length > 0) {
      console.log("    Transferred Away Samples:");
      tl.originallyAssignedTransferredAway.slice(0, 3).forEach((l: any) => {
        console.log(`      * ` + l.leadName + ` (` + l.leadId + `) | Orig Status: ` + l.originalStatus + ` | -> to ` + l.transferredTo + ` (Current Status: ` + l.currentStatus + `)`);
      });
      if (tl.originallyAssignedTransferredAway.length > 3) {
        console.log(`      * ... and ` + (tl.originallyAssignedTransferredAway.length - 3) + ` more`);
      }
    }
  }
});

console.log("\n--- SALES TEAM ACTIVE RECOVERY ---");
let countPr = 0;
data.salesTeam.forEach((sales: any) => {
  const tot = sales.summary.totalOriginalCount;
  const edits = sales.summary.editsCount;
  if ((tot > 0 || edits > 0) && countPr < 6) {
    console.log(`\nAdvisor: ` + sales.userName + ` (` + sales.userEmail + `)`);
    console.log(`  - Current Assigned: ` + sales.summary.currentCount);
    console.log(`  - Transferred Away: ` + sales.summary.transferredAwayCount);
    console.log(`  - Total Original Base: ` + tot);
    console.log(`  - Total Edits Logged: ` + edits);
    if (sales.originallyAssignedTransferredAway.length > 0) {
      console.log("    Transferred Away Samples:");
      sales.originallyAssignedTransferredAway.slice(0, 2).forEach((l: any) => {
        console.log(`      * ` + l.leadName + ` (Current: ` + l.transferredTo + `)`);
      });
    }
    countPr++;
  }
});
