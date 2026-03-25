import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeHandle } from "../../shared/ranking-engine.mjs";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultCandidatePath = path.resolve(currentDirectory, "../../data/dev-candidates.json");

function stringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeCandidate(raw = {}, seededAt = new Date().toISOString(), defaultPool = "legend") {
  const handle = normalizeHandle(raw.handle || raw.xHandle || raw.username);
  if (!handle) {
    return null;
  }

  return {
    handle,
    displayName: stringValue(raw.displayName, `@${handle}`),
    approved: raw.approved !== false,
    pool: stringValue(raw.pool, defaultPool || "legend") || "legend",
    confidence: stringValue(raw.confidence, "medium"),
    sourceLabel: stringValue(raw.sourceLabel, "Manual research"),
    sourceUrl: stringValue(raw.sourceUrl),
    notes: stringValue(raw.notes),
    submittedVia: stringValue(raw.submittedVia, "seed"),
    createdAt: stringValue(raw.createdAt, seededAt),
    updatedAt: stringValue(raw.updatedAt, seededAt),
  };
}

export async function readCandidateSeed(candidatePath = defaultCandidatePath) {
  const resolvedPath = path.isAbsolute(candidatePath) ? candidatePath : path.resolve(process.cwd(), candidatePath);
  const raw = await readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);
  const seededAt = stringValue(parsed.seededAt, new Date().toISOString());
  const defaultPool = stringValue(parsed.pool, "legend");

  return {
    seededAt,
    pool: defaultPool,
    notes: stringValue(parsed.notes),
    candidates: (parsed.candidates || [])
      .map((candidate) => normalizeCandidate(candidate, seededAt, defaultPool))
      .filter(Boolean),
  };
}

export async function importCandidatePool(db, candidatePath = defaultCandidatePath) {
  const seed = await readCandidateSeed(candidatePath);
  const allowedHandles = new Set(seed.candidates.map((candidate) => candidate.handle));
  const existingSnapshot = await db.collection("devCandidates").get();

  for (let index = 0; index < seed.candidates.length; index += 400) {
    const batch = db.batch();
    seed.candidates.slice(index, index + 400).forEach((candidate) => {
      batch.set(
        db.collection("devCandidates").doc(candidate.handle),
        {
          ...candidate,
          importSource: "seed",
          seedNotes: seed.notes,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    });
    await batch.commit();
  }

  const staleSeedDocs = existingSnapshot.docs.filter((doc) => {
    const handle = normalizeHandle(doc.id);
    const data = doc.data() || {};
    return data.importSource === "seed" && handle && !allowedHandles.has(handle);
  });

  for (let index = 0; index < staleSeedDocs.length; index += 400) {
    const batch = db.batch();
    staleSeedDocs.slice(index, index + 400).forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
  }

  return seed;
}

export async function loadCandidatePool(db) {
  const snapshot = await db.collection("devCandidates").get();
  return snapshot.docs.map((doc) => ({
    handle: normalizeHandle(doc.id),
    ...doc.data(),
  }));
}

export async function loadApprovedCandidates(db, options = {}) {
  const requestedHandles = Array.from(
    new Set((options.handles || []).map((handle) => normalizeHandle(handle)).filter(Boolean))
  );
  const requestedHandleSet = new Set(requestedHandles);
  const requestedPool = stringValue(options.pool, "");
  const candidates = await loadCandidatePool(db);

  return candidates.filter((candidate) => {
    if (candidate.approved === false) {
      return false;
    }
    if (requestedPool && stringValue(candidate.pool).toLowerCase() !== requestedPool.toLowerCase()) {
      return false;
    }
    if (requestedHandleSet.size > 0 && !requestedHandleSet.has(normalizeHandle(candidate.handle))) {
      return false;
    }
    return true;
  });
}

export { defaultCandidatePath };
