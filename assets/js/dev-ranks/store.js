import rankingConfig from "../../../shared/indie-ranks-config.mjs";
import {
  buildRankingsFromRecords,
  getSnapshotDate,
  mergeFirestoreCollections,
  normalizeHandle,
  searchRankedRecords,
} from "../../../shared/ranking-engine.mjs";

const SEED_DATA_URL = "/data/dev-seed.json";
let cachedDatasetPromise = null;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json();
}

function mapQuerySnapshot(snapshot) {
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

async function loadLatestSnapshotRows(db) {
  if (!window.firebase || !window.firebase.firestore || !window.firebase.firestore.FieldPath) {
    return {
      snapshotDate: null,
      rows: [],
    };
  }

  const docId = window.firebase.firestore.FieldPath.documentId();
  const snapshotCollection = await db.collection("rankSnapshots").orderBy(docId, "desc").limit(1).get();

  if (snapshotCollection.empty) {
    return {
      snapshotDate: null,
      rows: [],
    };
  }

  const snapshotDoc = snapshotCollection.docs[0];
  const rowsSnapshot = await snapshotDoc.ref.collection("rows").get();

  return {
    snapshotDate: snapshotDoc.id,
    rows: mapQuerySnapshot(rowsSnapshot),
  };
}

async function loadFromFirestore() {
  const services =
    window.IndieRanks &&
    typeof window.IndieRanks.getFirebaseServices === "function" &&
    window.IndieRanks.getFirebaseServices();

  if (!services || !services.db) {
    return null;
  }

  try {
    const [devSnapshot, metricSnapshot, latestSnapshot, projectSnapshot] = await Promise.all([
      services.db.collection("devs").get(),
      services.db.collection("devMetrics").get(),
      loadLatestSnapshotRows(services.db),
      services.db.collection("projects").get(),
    ]);

    if (devSnapshot.empty) {
      return null;
    }

    const mergedRecords = mergeFirestoreCollections(
      mapQuerySnapshot(devSnapshot),
      mapQuerySnapshot(metricSnapshot),
      latestSnapshot.rows,
      mapQuerySnapshot(projectSnapshot)
    );

    if (!mergedRecords.length) {
      return null;
    }

    return {
      source: "firestore",
      records: mergedRecords,
      snapshotDate: latestSnapshot.snapshotDate || getSnapshotDate(),
    };
  } catch (error) {
    console.warn("Falling back to seed data", error);
    return null;
  }
}

async function loadFromSeed() {
  const seed = await fetchJson(SEED_DATA_URL);
  const seededAt = seed.seededAt || new Date().toISOString();
  const records = (seed.devs || []).map((dev) => ({
    ...dev,
    createdAt: dev.createdAt || seededAt,
    updatedAt: dev.updatedAt || seededAt,
  }));

  return {
    source: "seed",
    records,
    snapshotDate: getSnapshotDate(seededAt),
  };
}

async function loadDataset() {
  if (!cachedDatasetPromise) {
    cachedDatasetPromise = (async () => {
      const firestorePayload = await loadFromFirestore();
      const payload = firestorePayload || (await loadFromSeed());
      const rankings = buildRankingsFromRecords(payload.records, rankingConfig, {
        snapshotDate: payload.snapshotDate,
      });

      return {
        ...rankings,
        source: payload.source,
      };
    })();
  }

  return cachedDatasetPromise;
}

export async function getHomeDataset() {
  return loadDataset();
}

export async function searchDevs(query) {
  const dataset = await loadDataset();
  return searchRankedRecords(dataset.directory, query, rankingConfig);
}

export async function getDevProfile(handle) {
  const dataset = await loadDataset();
  const normalizedHandle = normalizeHandle(handle);
  const dev = dataset.byHandle[normalizedHandle];

  if (!dev) {
    return null;
  }

  const peerGroup = dataset.groups[dev.overallCategory] || [];
  const nearbyPeers = peerGroup.filter((peer) => Math.abs(peer.rank - dev.rank) <= 2 && peer.handle !== dev.handle);

  return {
    dev,
    nearbyPeers,
    dataset,
  };
}
