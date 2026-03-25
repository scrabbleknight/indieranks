import { getDb } from "../lib/admin.js";
import { syncLegendRosterFromX } from "../lib/x-sync.js";

const handles = process.argv.slice(2);
const result = await syncLegendRosterFromX(getDb(), { handles });

console.log(`Snapshot: ${result.snapshotDate}`);
console.log(`Synced legends: ${result.syncedHandles.join(", ")}`);
if (result.missingHandles.length) {
  console.log(`Missing on X: ${result.missingHandles.join(", ")}`);
}
console.log(`Legends: ${result.rankings.counts.legends}`);
console.log(`Contenders: ${result.rankings.counts.contenders}`);
console.log(`Rookies: ${result.rankings.counts.rookies}`);
