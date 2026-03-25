import { getDb } from "../lib/admin.js";

const handle = String(process.argv[2] || "").trim().toLowerCase().replace(/^@+/, "");

if (!handle) {
  throw new Error("Usage: npm run inspect:dev -- <x-handle>");
}

const db = getDb();
const [devDoc, metricDoc, snapshotDocs] = await Promise.all([
  db.collection("devs").doc(handle).get(),
  db.collection("devMetrics").doc(handle).get(),
  db.collection("rankSnapshots").orderBy("__name__", "desc").limit(1).get(),
]);

let latestSnapshotRow = null;
let latestSnapshotId = "";

if (!snapshotDocs.empty) {
  latestSnapshotId = snapshotDocs.docs[0].id;
  const rowDoc = await snapshotDocs.docs[0].ref.collection("rows").doc(handle).get();
  if (rowDoc.exists) {
    latestSnapshotRow = rowDoc.data();
  }
}

console.log(`Handle: @${handle}`);
console.log(`Latest snapshot: ${latestSnapshotId || "none"}`);
console.log("");
console.log("devs");
console.log(JSON.stringify(devDoc.exists ? devDoc.data() : null, null, 2));
console.log("");
console.log("devMetrics");
console.log(JSON.stringify(metricDoc.exists ? metricDoc.data() : null, null, 2));
console.log("");
console.log("latestSnapshotRow");
console.log(JSON.stringify(latestSnapshotRow, null, 2));
