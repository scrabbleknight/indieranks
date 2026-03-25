import { getDb } from "../lib/admin.js";
import { auditLegendRosterAgainstX } from "../lib/x-sync.js";

const result = await auditLegendRosterAgainstX(getDb());

console.log(`Snapshot: ${result.snapshotDate}`);
if (result.missingHandles.length) {
  console.log(`Missing on X: ${result.missingHandles.join(", ")}`);
}
console.table(result.rows);
