import { getSnapshotDate } from "../shared/ranking-engine.mjs";
import { getDb } from "../lib/admin.js";
import { refreshRankingsFromFirestore } from "../lib/dev-rankings.js";

const snapshotDate = process.argv[2] || getSnapshotDate();
const rankings = await refreshRankingsFromFirestore(getDb(), snapshotDate);

console.log(`Refreshed rankings for snapshot ${rankings.snapshotDate}.`);
console.log(`Legends: ${rankings.counts.legends}`);
console.log(`Contenders: ${rankings.counts.contenders}`);
console.log(`Rookies: ${rankings.counts.rookies}`);
