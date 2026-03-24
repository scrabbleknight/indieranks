import { getDb } from "../lib/admin.js";
import { importSeedData } from "../lib/dev-rankings.js";

const seedPath = process.argv[2];
const rankings = seedPath
  ? await importSeedData(getDb(), seedPath)
  : await importSeedData(getDb());

console.log(`Seeded ${rankings.counts.total} devs.`);
console.log(`Legends: ${rankings.counts.legends}`);
console.log(`Contenders: ${rankings.counts.contenders}`);
console.log(`Rookies: ${rankings.counts.rookies}`);
console.log(`Snapshot date: ${rankings.snapshotDate}`);
