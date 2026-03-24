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

const MOCK_PAGE_COUNT = 5;
const MOCK_TARGET_COUNTS = {
  legend: (Number(rankingConfig.leaderboardSizes.legends) || 8) * MOCK_PAGE_COUNT,
  contender: (Number(rankingConfig.leaderboardSizes.contenders) || 10) * MOCK_PAGE_COUNT,
  rookie: (Number(rankingConfig.leaderboardSizes.rookies) || 12) * MOCK_PAGE_COUNT,
};
const MOCK_HANDLE_SUFFIXES = {
  legend: ["studio", "capital", "works", "collective", "atlas", "signal", "foundry", "hq"],
  contender: ["builds", "launch", "forge", "stack", "studio", "ops", "flow", "lab"],
  rookie: ["weekend", "tiny", "spark", "garage", "maker", "builds", "craft", "solo"],
};
const MOCK_BIO_SUFFIXES = {
  legend: [
    "Still shipping new bets, internet businesses, and hard-won lessons from long cycles in public.",
    "Known for durable products, sharp distribution takes, and a habit of turning experiments into real businesses.",
    "Posting shipping notes, growth observations, and operating lessons from years of building online.",
    "Veteran indie operator sharing launches, systems, and what still compounds after the hype fades.",
  ],
  contender: [
    "Shipping steadily, testing distribution, and turning audience attention into real product momentum.",
    "Building in public with clear launch cadence, practical growth notes, and sharper product positioning.",
    "Combining regular launches with transparent updates, audience feedback, and consistent product iteration.",
    "Sharing experiments, customer learnings, and repeatable systems while stacking visible momentum.",
  ],
  rookie: [
    "Early but already shipping real products, posting honest progress, and building audience through signal.",
    "Low-follower builder with tangible launches, steady updates, and a surprisingly sticky niche audience.",
    "Still small on paper, but already shipping useful tools and sharing sharp lessons from the work.",
    "Quietly stacking launches, product notes, and consistent progress before the bigger breakout.",
  ],
};
const MOCK_MOVEMENTS = ["+2", "+1", "-", "-1", "-", "+1"];
const FOLLOWER_RANGES = {
  legend: { min: 52000, max: 280000, step: 1800 },
  contender: { min: 6000, max: 48000, step: 700 },
  rookie: { min: 350, max: 4900, step: 140 },
};

function clampNumber(value, minimum, maximum) {
  return Math.min(Math.max(Number(value) || 0, minimum), maximum);
}

function titleCase(value) {
  return String(value || "")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildMockHandle(baseHandle, suffix, sequence, usedHandles) {
  const root = normalizeHandle(`${baseHandle}_${suffix}_${sequence + 1}`);
  let handle = root;
  let collision = 2;

  while (usedHandles.has(handle)) {
    handle = `${root}_${collision}`;
    collision += 1;
  }

  usedHandles.add(handle);
  return handle;
}

function buildMockVariant(template, category, sequence, snapshotDate, usedHandles) {
  const suffixes = MOCK_HANDLE_SUFFIXES[category] || MOCK_HANDLE_SUFFIXES.rookie;
  const bioSuffixes = MOCK_BIO_SUFFIXES[category] || MOCK_BIO_SUFFIXES.rookie;
  const followerRange = FOLLOWER_RANGES[category] || FOLLOWER_RANGES.rookie;
  const suffix = suffixes[sequence % suffixes.length];
  const scale = [0.82, 0.9, 0.97, 1.03, 1.11, 1.19][sequence % 6];
  const swing = [-2, -1, 0, 1, 2, 3][sequence % 6];
  const engagementScale = [0.92, 0.97, 1, 1.05, 1.1][sequence % 5];
  const handle = buildMockHandle(template.handle, suffix, sequence, usedHandles);
  const metrics = template.metrics || {};
  const productSignals = template.productSignals || {};
  const baseBio = String(template.bio || "").trim().replace(/\s+/g, " ");
  const shipped = clampNumber(
    Math.round((productSignals.productsShipped || 1) * scale) + Math.max(swing, 0),
    1,
    category === "legend" ? 24 : category === "contender" ? 18 : 10
  );
  const liveNow = clampNumber(
    Math.round((productSignals.activeProducts || 1) * scale) + (sequence % 3 === 0 ? 1 : 0),
    1,
    shipped
  );
  const launchesLast12m = clampNumber(
    Math.round((productSignals.launchesLast12m || 1) * scale) + (sequence % 2),
    1,
    shipped
  );

  return {
    handle,
    displayName: `${template.displayName} ${titleCase(suffix)}`,
    bio: `${baseBio ? `${baseBio.replace(/[.!?]*$/, "")}. ` : ""}${bioSuffixes[sequence % bioSuffixes.length]}`,
    followers: clampNumber(
      Math.round((template.followers || followerRange.min) * scale) + ((sequence % 7) - 3) * followerRange.step,
      followerRange.min,
      followerRange.max
    ),
    website: `https://${handle.replace(/_/g, "-")}.example.com`,
    createdAt: template.createdAt || snapshotDate,
    updatedAt: template.updatedAt || snapshotDate,
    previousRanks: {},
    movement: MOCK_MOVEMENTS[(sequence + suffix.length) % MOCK_MOVEMENTS.length],
    metrics: {
      ...metrics,
      postsLast7d: clampNumber(
        Math.round((metrics.postsLast7d || 1) * scale) + (sequence % 3) - 1,
        category === "legend" ? 4 : 2,
        category === "legend" ? 14 : category === "contender" ? 13 : 10
      ),
      repliesLast7d: clampNumber(
        Math.round((metrics.repliesLast7d || 1) * scale) + swing,
        category === "rookie" ? 4 : 8,
        category === "legend" ? 30 : category === "contender" ? 26 : 20
      ),
      avgLikesPerPost: clampNumber(Math.round((metrics.avgLikesPerPost || 20) * scale), 20, 4000),
      avgRepliesPerPost: clampNumber(Math.round((metrics.avgRepliesPerPost || 4) * scale), 4, 240),
      avgRepostsPerPost: clampNumber(Math.round((metrics.avgRepostsPerPost || 2) * scale), 2, 180),
      avgQuotesPerPost: clampNumber(Math.round((metrics.avgQuotesPerPost || 1) * scale), 1, 90),
      engagementRate: clampNumber((metrics.engagementRate || 0.01) * engagementScale, 0.006, 0.06),
      momentum7d: clampNumber((metrics.momentum7d || 0) + [-9, -4, 0, 5, 10][sequence % 5], -25, 35),
      productsShipped: shipped,
      activeProducts: liveNow,
      launchesLast12m,
      productImpactScore: clampNumber(
        Math.round((productSignals.productImpactScore || 48) + [-8, -4, -1, 3, 6, 9][sequence % 6]),
        category === "legend" ? 62 : category === "contender" ? 48 : 36,
        99
      ),
    },
    productSignals: {
      productsShipped: shipped,
      activeProducts: liveNow,
      launchesLast12m,
      productImpactScore: clampNumber(
        Math.round((productSignals.productImpactScore || 48) + [-8, -4, -1, 3, 6, 9][sequence % 6]),
        category === "legend" ? 62 : category === "contender" ? 48 : 36,
        99
      ),
    },
  };
}

function expandMockRecords(records, rankings, snapshotDate) {
  if (!rankings || !rankings.groups) {
    return records;
  }

  const usedHandles = new Set(records.map((record) => normalizeHandle(record.handle)));
  const generated = [];

  ["legend", "contender", "rookie"].forEach((category) => {
    const templates = rankings.groups[category] || [];
    const target = Number(MOCK_TARGET_COUNTS[category]) || templates.length;
    const deficit = Math.max(0, target - templates.length);

    for (let index = 0; index < deficit; index += 1) {
      const template = templates[index % templates.length];
      if (!template) {
        break;
      }

      generated.push(buildMockVariant(template, category, index, snapshotDate, usedHandles));
    }
  });

  return records.concat(generated);
}

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
      const baseRankings = buildRankingsFromRecords(payload.records, rankingConfig, {
        snapshotDate: payload.snapshotDate,
      });
      const workingRecords =
        payload.source === "seed"
          ? expandMockRecords(payload.records, baseRankings, payload.snapshotDate)
          : payload.records;
      const rankings = buildRankingsFromRecords(workingRecords, rankingConfig, {
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
