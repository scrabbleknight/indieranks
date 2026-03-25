import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FieldPath } from "firebase-admin/firestore";
import rankingConfig from "../../shared/indie-ranks-config.mjs";
import {
  buildRankingsFromRecords,
  getSnapshotDate,
  mergeFirestoreCollections,
  toFirestorePayloads,
} from "../../shared/ranking-engine.mjs";
import { cleanupLegacyHandleDocs } from "./handle-cleanup.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultSeedPath = path.resolve(currentDirectory, "../../data/dev-seed.json");

function mapQuerySnapshot(snapshot) {
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function readSeedFile(seedPath = defaultSeedPath) {
  const resolvedPath = path.isAbsolute(seedPath) ? seedPath : path.resolve(process.cwd(), seedPath);
  const raw = await readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);
  const seededAt = parsed.seededAt || new Date().toISOString();

  return {
    seededAt,
    records: (parsed.devs || []).map((dev) => ({
      ...dev,
      createdAt: dev.createdAt || seededAt,
      updatedAt: dev.updatedAt || seededAt,
    })),
  };
}

async function loadLatestSnapshotRows(db) {
  const snapshotCollection = await db.collection("rankSnapshots").orderBy(FieldPath.documentId(), "desc").limit(1).get();

  if (snapshotCollection.empty) {
    return {
      rows: [],
    };
  }

  const latestDoc = snapshotCollection.docs[0];
  const rows = await latestDoc.ref.collection("rows").get();

  return {
    rows: mapQuerySnapshot(rows),
  };
}

export async function loadRecordsFromFirestore(db) {
  const [devSnapshot, metricSnapshot, latestSnapshot, projectSnapshot] = await Promise.all([
    db.collection("devs").get(),
    db.collection("devMetrics").get(),
    loadLatestSnapshotRows(db),
    db.collection("projects").get(),
  ]);

  return mergeFirestoreCollections(
    mapQuerySnapshot(devSnapshot),
    mapQuerySnapshot(metricSnapshot),
    latestSnapshot.rows,
    mapQuerySnapshot(projectSnapshot)
  );
}

async function commitOperations(db, payloads) {
  const snapshotRef = db.collection("rankSnapshots").doc(payloads.snapshotDoc.id);
  const operations = [
    { ref: snapshotRef, data: payloads.snapshotDoc.data },
    ...payloads.devDocs.map((doc) => ({ ref: db.collection("devs").doc(doc.id), data: doc.data })),
    ...payloads.metricDocs.map((doc) => ({ ref: db.collection("devMetrics").doc(doc.id), data: doc.data })),
    ...payloads.snapshotRows.map((row) => ({ ref: snapshotRef.collection("rows").doc(row.id), data: row.data })),
  ];

  for (let index = 0; index < operations.length; index += 400) {
    const batch = db.batch();
    operations.slice(index, index + 400).forEach((operation) => {
      batch.set(operation.ref, operation.data, { merge: false });
    });
    await batch.commit();
  }
}

export async function importSeedData(db, seedPath = defaultSeedPath) {
  await cleanupLegacyHandleDocs(db);
  const seed = await readSeedFile(seedPath);
  const rankings = buildRankingsFromRecords(seed.records, rankingConfig, {
    snapshotDate: getSnapshotDate(seed.seededAt),
  });

  await commitOperations(db, toFirestorePayloads(rankings, rankings.snapshotDate));
  return rankings;
}

export async function refreshRankingsFromFirestore(db, snapshotDate = getSnapshotDate()) {
  await cleanupLegacyHandleDocs(db);
  const records = await loadRecordsFromFirestore(db);
  const rankings = buildRankingsFromRecords(records, rankingConfig, {
    snapshotDate,
  });

  await commitOperations(db, toFirestorePayloads(rankings, rankings.snapshotDate));
  return rankings;
}
