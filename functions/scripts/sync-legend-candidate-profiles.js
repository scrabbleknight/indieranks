import { getDb } from "../lib/admin.js";
import { syncLegendCandidateProfilesFromX } from "../lib/x-sync.js";

const handles = process.argv.slice(2);
const result = await syncLegendCandidateProfilesFromX(getDb(), { handles });

console.log(`Snapshot: ${result.snapshotDate}`);
console.log(`Profile-synced legend candidates: ${result.syncedHandles.join(", ")}`);
if (result.cachedHandles && result.cachedHandles.length) {
  console.log(`Restored from cached profile data: ${result.cachedHandles.join(", ")}`);
}
if (result.missingHandles.length) {
  console.log(`Missing on X: ${result.missingHandles.join(", ")}`);
}
console.log(`Legends: ${result.rankings.counts.legends}`);
console.log(`Contenders: ${result.rankings.counts.contenders}`);
console.log(`Rookies: ${result.rankings.counts.rookies}`);
