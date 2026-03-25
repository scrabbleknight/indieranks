import { getDb } from "../lib/admin.js";
import { refreshRankingsFromFirestore } from "../lib/dev-rankings.js";
import { cleanupLegacyHandleDocs, inspectLegacyHandleDocs } from "../lib/handle-cleanup.js";

const db = getDb();
const before = await inspectLegacyHandleDocs(db);
const cleanup = await cleanupLegacyHandleDocs(db);
const rankings = await refreshRankingsFromFirestore(db);
const after = await inspectLegacyHandleDocs(db);

console.log("Legacy handle cleanup");
console.log(`Before: ${before.devDocs.length} dev doc(s), ${before.metricDocs.length} metric doc(s), ${before.projectDocs.length} project doc(s), ${before.snapshotRows.length} snapshot row(s)`);
console.log(`Deleted dev docs: ${cleanup.deletedDevDocs.length}`);
console.log(`Deleted metric docs: ${cleanup.deletedMetricDocs.length}`);
console.log(`Deleted Product Hunt project docs: ${cleanup.deletedProjectDocs.length}`);
console.log(`Migrated project docs: ${cleanup.migratedProjectDocs.length}`);
console.log(`Deleted snapshot rows: ${cleanup.deletedSnapshotRows.length}`);
console.log(`Updated dev docs: ${cleanup.updatedDevDocs.length}`);
console.log(`After: ${after.devDocs.length} dev doc(s), ${after.metricDocs.length} metric doc(s), ${after.projectDocs.length} project doc(s), ${after.snapshotRows.length} snapshot row(s)`);
console.log(`Legends: ${rankings.counts.legends}`);
console.log(`Contenders: ${rankings.counts.contenders}`);
console.log(`Rookies: ${rankings.counts.rookies}`);
