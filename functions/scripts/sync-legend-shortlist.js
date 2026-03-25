import { getDb } from "../lib/admin.js";
import { syncLegendShortlistFromX } from "../lib/x-sync.js";

const args = process.argv.slice(2);
const handles = [];
let limit;
let refreshProfiles = true;

for (let index = 0; index < args.length; index += 1) {
  const value = args[index];
  if (value === "--limit") {
    limit = Number(args[index + 1]);
    index += 1;
    continue;
  }
  if (value === "--skip-profiles") {
    refreshProfiles = false;
    continue;
  }
  handles.push(value);
}

const result = await syncLegendShortlistFromX(getDb(), {
  handles,
  limit,
  refreshProfiles,
});

console.log(`Snapshot: ${result.snapshotDate}`);
console.log(`Shortlist handles: ${result.shortlistHandles.join(", ")}`);
console.log(`Synced handles: ${result.syncedHandles.join(", ")}`);
if (result.missingHandles.length) {
  console.log(`Missing on X: ${result.missingHandles.join(", ")}`);
}
console.log(`Legends: ${result.rankings.counts.legends}`);
console.log(`Contenders: ${result.rankings.counts.contenders}`);
console.log(`Rookies: ${result.rankings.counts.rookies}`);
