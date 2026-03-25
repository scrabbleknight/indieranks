import { getDb } from "../lib/admin.js";
import { loadApprovedCandidates } from "../lib/candidate-pool.js";
import { refreshRankingsFromFirestore } from "../lib/dev-rankings.js";

const db = getDb();
const approvedCandidates = await loadApprovedCandidates(db);

if (!approvedCandidates.length) {
  throw new Error("No approved candidates found in devCandidates. Run `npm run seed:candidates` first.");
}

const allowedHandles = new Set(
  approvedCandidates
    .map((candidate) => String(candidate.handle || "").trim().toLowerCase())
    .filter(Boolean)
);

const [devSnapshot, metricSnapshot] = await Promise.all([
  db.collection("devs").get(),
  db.collection("devMetrics").get(),
]);

const staleDevDocs = devSnapshot.docs.filter((doc) => !allowedHandles.has(String(doc.id || "").trim().toLowerCase()));
const staleMetricDocs = metricSnapshot.docs.filter((doc) => !allowedHandles.has(String(doc.id || "").trim().toLowerCase()));

for (let index = 0; index < staleDevDocs.length; index += 400) {
  const batch = db.batch();
  staleDevDocs.slice(index, index + 400).forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

for (let index = 0; index < staleMetricDocs.length; index += 400) {
  const batch = db.batch();
  staleMetricDocs.slice(index, index + 400).forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}

const rankings = await refreshRankingsFromFirestore(db);

console.log(`Approved candidates kept: ${allowedHandles.size}`);
console.log(`Deleted dev docs: ${staleDevDocs.length}`);
console.log(`Deleted metric docs: ${staleMetricDocs.length}`);
console.log(`Legends: ${rankings.counts.legends}`);
console.log(`Contenders: ${rankings.counts.contenders}`);
console.log(`Rookies: ${rankings.counts.rookies}`);
