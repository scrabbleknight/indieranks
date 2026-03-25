import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import rankingConfig from "../shared/indie-ranks-config.mjs";
import {
  buildRankingsFromRecords,
  buildProductSignalsFromProjects,
  getSnapshotDate,
  isLegendEligible,
  normalizeHandle,
} from "../shared/ranking-engine.mjs";
import { loadApprovedCandidates, readCandidateSeed } from "./candidate-pool.js";
import { loadRecordsFromFirestore, refreshRankingsFromFirestore } from "./dev-rankings.js";
import { getTweetsByUserId, lookupUsersByUsernames } from "./x-api.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultSeedPath = path.resolve(currentDirectory, "../../data/dev-seed.json");

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(toNumber(value) * factor) / factor;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(toNumber(value), minimum), maximum);
}

function getNow() {
  return new Date();
}

function daysAgoIso(now, days) {
  return new Date(now.getTime() - days * 86400000).toISOString();
}

function getTime(value) {
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

function isRetweet(tweet = {}) {
  return Array.isArray(tweet.referenced_tweets)
    ? tweet.referenced_tweets.some((reference) => reference && reference.type === "retweeted")
    : false;
}

function isReply(tweet = {}) {
  if (tweet.in_reply_to_user_id) {
    return true;
  }

  return Array.isArray(tweet.referenced_tweets)
    ? tweet.referenced_tweets.some((reference) => reference && reference.type === "replied_to")
    : false;
}

function isWithinRange(value, startMs, endMs) {
  const time = getTime(value);
  return time >= startMs && time < endMs;
}

function getTweetMetric(tweet = {}, key) {
  return toNumber(tweet.public_metrics && tweet.public_metrics[key]);
}

function averageMetric(tweets = [], key) {
  if (!tweets.length) {
    return 0;
  }

  return tweets.reduce((sum, tweet) => sum + getTweetMetric(tweet, key), 0) / tweets.length;
}

function averageEngagementCount(tweets = []) {
  if (!tweets.length) {
    return 0;
  }

  return (
    tweets.reduce((sum, tweet) => {
      return (
        sum +
        getTweetMetric(tweet, "like_count") +
        getTweetMetric(tweet, "reply_count") +
        getTweetMetric(tweet, "retweet_count") +
        getTweetMetric(tweet, "quote_count")
      );
    }, 0) / tweets.length
  );
}

function summarizeTweets(tweets = [], followers = 0, now = getNow()) {
  const nowMs = now.getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const currentStart = nowMs - sevenDaysMs;
  const previousStart = currentStart - sevenDaysMs;
  const nonRetweets = (tweets || []).filter((tweet) => !isRetweet(tweet));
  const currentWindow = nonRetweets.filter((tweet) => isWithinRange(tweet.created_at, currentStart, nowMs + 1));
  const previousWindow = nonRetweets.filter((tweet) => isWithinRange(tweet.created_at, previousStart, currentStart));
  const currentPosts = currentWindow.filter((tweet) => !isReply(tweet));
  const previousPosts = previousWindow.filter((tweet) => !isReply(tweet));
  const postsForAverages = currentPosts.length ? currentPosts : currentWindow;
  const previousPostsForMomentum = previousPosts.length ? previousPosts : previousWindow;
  const currentAverageEngagement = averageEngagementCount(postsForAverages);
  const previousAverageEngagement = averageEngagementCount(previousPostsForMomentum);
  const momentum7d =
    previousAverageEngagement > 0
      ? ((currentAverageEngagement - previousAverageEngagement) / previousAverageEngagement) * 100
      : 0;

  return {
    postsLast7d: currentPosts.length,
    repliesLast7d: currentWindow.filter((tweet) => isReply(tweet)).length,
    avgLikesPerPost: round(averageMetric(postsForAverages, "like_count")),
    avgRepliesPerPost: round(averageMetric(postsForAverages, "reply_count")),
    avgRepostsPerPost: round(averageMetric(postsForAverages, "retweet_count")),
    avgQuotesPerPost: round(averageMetric(postsForAverages, "quote_count")),
    engagementRate: round(followers > 0 ? currentAverageEngagement / followers : 0, 4),
    momentum7d: round(clamp(momentum7d, -100, 100), 1),
  };
}

function normalizeWebsite(url) {
  const value = String(url || "").trim();
  return /^https?:\/\//i.test(value) ? value : "";
}

function normalizeAvatarUrl(url) {
  return String(url || "").replace("_normal", "");
}

function getRecordLegendPool(record = {}, fallback = "") {
  return String(record.leaderboardPool || record.pool || fallback)
    .trim()
    .toLowerCase();
}

function mapCandidateToRosterRecord(candidate = {}) {
  const handle = normalizeHandle(candidate.handle);
  if (!handle) {
    return null;
  }

  const updatedAt = candidate.updatedAt || candidate.createdAt || new Date().toISOString();

  return {
    handle,
    displayName: candidate.displayName || `@${handle}`,
    bio: candidate.bio || candidate.notes || "Approved indie-dev candidate for the leaderboard.",
    avatarUrl: candidate.avatarUrl || "",
    followers: toNumber(candidate.followers),
    website: candidate.websiteUrl || candidate.website || "",
    createdAt: candidate.createdAt || updatedAt,
    updatedAt,
    xUserId: candidate.xUserId || "",
    isLegendOverride: false,
    leaderboardPool: candidate.dynamicPool ? "" : getRecordLegendPool(candidate, rankingConfig.candidatePool.defaultLegendPool),
    candidatePool: getRecordLegendPool(candidate, rankingConfig.candidatePool.defaultLegendPool),
    dynamicPool: Boolean(candidate.dynamicPool),
    sourceLabel: candidate.sourceLabel || "",
    sourceUrl: candidate.sourceUrl || "",
    notes: candidate.notes || "",
    productHuntUsername: candidate.productHuntUsername || "",
  };
}

async function readSeedLegendRoster(seedPath = defaultSeedPath) {
  const raw = await readFile(seedPath, "utf8");
  const parsed = JSON.parse(raw);
  const seededAt = parsed.seededAt || new Date().toISOString();

  return (parsed.devs || [])
    .map((dev) => ({
      ...dev,
      handle: normalizeHandle(dev.handle),
      createdAt: dev.createdAt || seededAt,
      updatedAt: dev.updatedAt || seededAt,
    }))
    .filter((dev) => dev.handle && isLegendEligible(dev, rankingConfig));
}

async function loadExistingDevDocs(db, handles = []) {
  const uniqueHandles = Array.from(new Set((handles || []).map((handle) => normalizeHandle(handle)).filter(Boolean)));
  const snapshots = await Promise.all(uniqueHandles.map((handle) => db.collection("devs").doc(handle).get()));

  return snapshots.reduce((records, snapshot) => {
    if (snapshot.exists) {
      records[snapshot.id] = {
        handle: snapshot.id,
        ...snapshot.data(),
      };
    }
    return records;
  }, {});
}

async function loadExistingMetricDocs(db, handles = []) {
  const uniqueHandles = Array.from(new Set((handles || []).map((handle) => normalizeHandle(handle)).filter(Boolean)));
  const snapshots = await Promise.all(uniqueHandles.map((handle) => db.collection("devMetrics").doc(handle).get()));

  return snapshots.reduce((records, snapshot) => {
    if (snapshot.exists) {
      records[snapshot.id] = {
        handle: snapshot.id,
        ...snapshot.data(),
      };
    }
    return records;
  }, {});
}

function buildRequestedRoster(seedRoster, existingDocs, requestedHandles = []) {
  const requested = Array.from(new Set((requestedHandles || []).map((handle) => normalizeHandle(handle)).filter(Boolean)));
  const seedByHandle = seedRoster.reduce((records, record) => {
    records[record.handle] = record;
    return records;
  }, {});
  const handles = requested.length
    ? requested
    : Array.from(new Set(seedRoster.map((record) => record.handle).concat(Object.keys(existingDocs))));

  return handles
    .map((handle) => ({
      ...(seedByHandle[handle] || {}),
      ...(existingDocs[handle] || {}),
      handle,
      isLegendOverride: Boolean(
        (existingDocs[handle] && existingDocs[handle].isLegendOverride) ||
          (seedByHandle[handle] && seedByHandle[handle].isLegendOverride) ||
          rankingConfig.legendOverrides.includes(handle)
      ),
      leaderboardPool:
        getRecordLegendPool(seedByHandle[handle] || {}) ||
        getRecordLegendPool(existingDocs[handle] || {}),
    }))
    .filter((record) => record.handle);
}

async function loadCandidateRoster(
  db,
  requestedHandles = [],
  pool = rankingConfig.candidatePool.defaultLegendPool,
  candidatePath
) {
  const requestedPool = String(pool || rankingConfig.candidatePool.defaultLegendPool)
    .trim()
    .toLowerCase() || rankingConfig.candidatePool.defaultLegendPool;
  const requestedHandleSet = new Set(
    (requestedHandles || []).map((handle) => normalizeHandle(handle)).filter(Boolean)
  );
  const [dbCandidates, seed] = await Promise.all([
    loadApprovedCandidates(db, {
      pool: requestedPool,
      handles: requestedHandles,
    }),
    readCandidateSeed(candidatePath).catch(() => ({ candidates: [] })),
  ]);
  const seedCandidates = (seed.candidates || []).filter((candidate) => {
    if (candidate.approved === false) {
      return false;
    }
    if (String(candidate.pool || "").trim().toLowerCase() !== requestedPool) {
      return false;
    }
    if (requestedHandleSet.size > 0 && !requestedHandleSet.has(normalizeHandle(candidate.handle))) {
      return false;
    }
    return true;
  });
  const mergedByHandle = new Map();

  seedCandidates.forEach((candidate) => {
    mergedByHandle.set(candidate.handle, candidate);
  });

  dbCandidates.forEach((candidate) => {
    const handle = normalizeHandle(candidate.handle);
    if (!handle) {
      return;
    }

    mergedByHandle.set(handle, {
      ...(mergedByHandle.get(handle) || {}),
      ...candidate,
      handle,
      pool: candidate.pool || (mergedByHandle.get(handle) && mergedByHandle.get(handle).pool) || requestedPool,
    });
  });

  return Array.from(mergedByHandle.values()).map(mapCandidateToRosterRecord).filter(Boolean);
}

async function getCandidateRoster(db, options = {}) {
  const requestedHandles = Array.isArray(options.handles) ? options.handles : [];
  const requestedPool = String(options.pool || rankingConfig.candidatePool.defaultLegendPool)
    .trim()
    .toLowerCase() || rankingConfig.candidatePool.defaultLegendPool;
  const candidateRoster = await loadCandidateRoster(db, requestedHandles, requestedPool, options.candidatePath);
  const baseRoster = candidateRoster.length
    ? candidateRoster
    : requestedPool === rankingConfig.candidatePool.defaultLegendPool
      ? await readSeedLegendRoster(options.seedPath)
      : [];
  const existingDocs = await loadExistingDevDocs(
    db,
    requestedHandles.length ? requestedHandles : baseRoster.map((record) => record.handle)
  );

  return {
    roster: buildRequestedRoster(baseRoster, existingDocs, requestedHandles),
    usesCandidatePool: candidateRoster.length > 0,
    pool: requestedPool,
  };
}

async function writeLegendSync(db, syncedRecords, snapshotDate) {
  for (let index = 0; index < syncedRecords.length; index += 200) {
    const batch = db.batch();

    syncedRecords.slice(index, index + 200).forEach((record) => {
      batch.set(
        db.collection("devs").doc(record.handle),
        {
          handle: record.handle,
          displayName: record.displayName,
          avatarUrl: record.avatarUrl,
          bio: record.bio,
          followers: record.followers,
          category: "legend",
          isLegendOverride: record.isLegendOverride,
          xUserId: record.xUserId,
          website: record.website,
          leaderboardPool: record.leaderboardPool || rankingConfig.candidatePool.defaultLegendPool,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
        { merge: true }
      );

      batch.set(
        db.collection("devMetrics").doc(record.handle),
        {
          ...record.metrics,
          snapshotDate,
          updatedAt: record.updatedAt,
        },
        { merge: true }
      );

      batch.set(
        db.collection("devCandidates").doc(record.handle),
        {
          handle: record.handle,
          displayName: record.displayName,
          approved: true,
          pool: record.leaderboardPool || rankingConfig.candidatePool.defaultLegendPool,
          sourceLabel: record.sourceLabel || "",
          sourceUrl: record.sourceUrl || "",
          notes: record.notes || "",
          xUserId: record.xUserId,
          followers: record.followers,
          avatarUrl: record.avatarUrl,
          bio: record.bio,
          website: record.website,
          lastProfileSyncAt: record.updatedAt,
          lastTimelineSyncAt: record.updatedAt,
          lastSyncSnapshotDate: snapshotDate,
          lastLookupStatus: "ok",
          updatedAt: record.updatedAt,
        },
        { merge: true }
      );
    });

    await batch.commit();
  }
}

async function writeCandidateProfileSync(
  db,
  syncedRecords,
  missingHandles = [],
  snapshotDate,
  pool = rankingConfig.candidatePool.defaultLegendPool
) {
  for (let index = 0; index < syncedRecords.length; index += 200) {
    const batch = db.batch();

    syncedRecords.slice(index, index + 200).forEach((record) => {
      const explicitPool = String(record.leaderboardPool || "").trim().toLowerCase();
      const candidatePool = String(record.candidatePool || explicitPool || pool || rankingConfig.candidatePool.defaultLegendPool)
        .trim()
        .toLowerCase() || rankingConfig.candidatePool.defaultLegendPool;

      batch.set(
        db.collection("devs").doc(record.handle),
        {
          handle: record.handle,
          displayName: record.displayName,
          avatarUrl: record.avatarUrl,
          bio: record.bio,
          followers: record.followers,
          category: explicitPool,
          isLegendOverride: false,
          xUserId: record.xUserId,
          website: record.website,
          leaderboardPool: explicitPool,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
        { merge: true }
      );

      batch.set(
        db.collection("devCandidates").doc(record.handle),
        {
          handle: record.handle,
          displayName: record.displayName,
          approved: true,
          pool: candidatePool,
          dynamicPool: Boolean(record.dynamicPool),
          sourceLabel: record.sourceLabel || "",
          sourceUrl: record.sourceUrl || "",
          notes: record.notes || "",
          productHuntUsername: record.productHuntUsername || "",
          xUserId: record.xUserId,
          followers: record.followers,
          avatarUrl: record.avatarUrl,
          bio: record.bio,
          website: record.website,
          lastProfileSyncAt: record.updatedAt,
          lastSyncSnapshotDate: snapshotDate,
          lastLookupStatus: "ok",
          tweetCountTotal: record.metrics.tweetCountTotal,
          tweetCountDelta: record.metrics.tweetCountDelta,
          activityWindowDays: record.metrics.activityWindowDays,
          activitySource: record.metrics.activitySource,
          updatedAt: record.updatedAt,
        },
        { merge: true }
      );

      batch.set(
        db.collection("devMetrics").doc(record.handle),
        {
          ...record.metrics,
          snapshotDate,
          updatedAt: record.updatedAt,
        },
        { merge: true }
      );
    });

    await batch.commit();
  }

  if (missingHandles.length) {
    const nowIso = new Date().toISOString();
    for (let index = 0; index < missingHandles.length; index += 200) {
      const batch = db.batch();
      missingHandles.slice(index, index + 200).forEach((handle) => {
        batch.set(
          db.collection("devCandidates").doc(handle),
          {
            handle,
            pool,
            approved: true,
            lastProfileSyncAt: nowIso,
            lastSyncSnapshotDate: snapshotDate,
            lastLookupStatus: "missing_on_x",
            updatedAt: nowIso,
          },
          { merge: true }
        );
        batch.delete(db.collection("devs").doc(handle));
        batch.delete(db.collection("devMetrics").doc(handle));
      });
      await batch.commit();
    }
  }
}

function buildLegendShortlistScore(record = {}) {
  const followers = Math.max(1, toNumber(record.followers));
  const metrics = record.metrics || {};
  const productSignals = record.productSignals || {};
  const launches = Math.max(
    toNumber(productSignals.productHuntLaunchesTotal),
    toNumber(productSignals.productsShipped)
  );
  const outputPace = toNumber(metrics.postsLast7d);
  const momentum = toNumber(metrics.momentum7d);
  const reachScore = Math.log10(followers) * 18;
  const launchScore = Math.min(launches, 50) * 9;
  const activityScore = Math.min(outputPace, 140) * 1.1;
  const momentumScore = Math.max(0, momentum) * 0.3;

  return round(reachScore + launchScore + activityScore + momentumScore, 2);
}

function summarizeProfileMetrics(user = {}, previousMetrics = {}, now = getNow()) {
  const publicMetrics = user.public_metrics || {};
  const tweetCountTotal = Math.max(0, toNumber(publicMetrics.tweet_count));
  const accountAgeDays = Math.max(1, Math.round((now.getTime() - getTime(user.created_at)) / 86400000));
  const previousTweetCount = toNumber(previousMetrics.tweetCountTotal, NaN);
  const previousPace = Math.max(0, toNumber(previousMetrics.postsLast7d));
  const previousSnapshotAt = String(previousMetrics.profileSnapshotAt || previousMetrics.updatedAt || "").trim();
  const elapsedDaysRaw = previousSnapshotAt ? (now.getTime() - getTime(previousSnapshotAt)) / 86400000 : 0;
  const effectiveDays = clamp(elapsedDaysRaw || 0, 1, 30);
  let tweetCountDelta = 0;
  let postsLast7d = 0;
  let activityWindowDays = 0;
  let activitySource = "awaiting_delta";

  if (Number.isFinite(previousTweetCount) && previousTweetCount >= 0 && previousSnapshotAt) {
    tweetCountDelta = Math.max(0, tweetCountTotal - previousTweetCount);
    postsLast7d = round(tweetCountDelta * (7 / effectiveDays), 1);
    activityWindowDays = round(effectiveDays, 1);
    activitySource = "profile_delta";
  } else {
    postsLast7d = round((tweetCountTotal / accountAgeDays) * 7, 1);
    activitySource = "lifetime_average";
  }

  const momentum7d =
    previousPace > 0 && activitySource === "profile_delta"
      ? ((postsLast7d - previousPace) / previousPace) * 100
      : 0;

  return {
    postsLast7d,
    repliesLast7d: 0,
    avgLikesPerPost: 0,
    avgRepliesPerPost: 0,
    avgRepostsPerPost: 0,
    avgQuotesPerPost: 0,
    engagementRate: 0,
    accountAgeDays,
    momentum7d: round(clamp(momentum7d, -100, 100), 1),
    tweetCountTotal,
    tweetCountDelta,
    activityWindowDays,
    activitySource,
    profileSnapshotAt: now.toISOString(),
  };
}

function shortlistLegendHandles(records = [], limit = rankingConfig.candidatePool.shortlistSize || 10) {
  const maxHandles = Math.max(1, toNumber(limit, rankingConfig.candidatePool.shortlistSize || 10));

  return (records || [])
    .filter((record) => getRecordLegendPool(record) === rankingConfig.candidatePool.defaultLegendPool)
    .sort((left, right) => {
      const scoreDelta = buildLegendShortlistScore(right) - buildLegendShortlistScore(left);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return toNumber(right.followers) - toNumber(left.followers);
    })
    .slice(0, maxHandles)
    .map((record) => record.handle);
}

function buildCachedProfileSyncRecord(rosterRecord = {}, previousMetrics = {}, now = getNow()) {
  const handle = rosterRecord.handle;
  if (!handle) {
    return null;
  }

  const followers = Math.max(0, toNumber(rosterRecord.followers));
  const hasCachedProfile =
    followers > 0 ||
    Boolean(String(rosterRecord.avatarUrl || "").trim()) ||
    Boolean(String(rosterRecord.bio || "").trim()) ||
    Boolean(String(rosterRecord.website || "").trim()) ||
    Boolean(String(rosterRecord.xUserId || "").trim());
  const hasCachedMetrics =
    Object.keys(previousMetrics || {}).length > 0 &&
    [
      "postsLast7d",
      "tweetCountTotal",
      "tweetCountDelta",
      "activityWindowDays",
      "activitySource",
      "momentum7d",
    ].some((key) => previousMetrics[key] != null && previousMetrics[key] !== "");

  if (!hasCachedProfile && !hasCachedMetrics) {
    return null;
  }

  const updatedAt = now.toISOString();

  return {
    handle,
    displayName: rosterRecord.displayName || `@${handle}`,
    avatarUrl: normalizeAvatarUrl(rosterRecord.avatarUrl),
    bio: rosterRecord.bio || "Approved indie developer candidate.",
    followers,
    isLegendOverride: false,
    leaderboardPool: rosterRecord.leaderboardPool || rankingConfig.candidatePool.defaultLegendPool,
    sourceLabel: rosterRecord.sourceLabel || "",
    sourceUrl: rosterRecord.sourceUrl || "",
    notes: rosterRecord.notes || "",
    xUserId: String(rosterRecord.xUserId || handle),
    website: normalizeWebsite(rosterRecord.website),
    createdAt: rosterRecord.createdAt || updatedAt,
    updatedAt,
    metrics: {
      postsLast7d: toNumber(previousMetrics.postsLast7d),
      repliesLast7d: toNumber(previousMetrics.repliesLast7d),
      avgLikesPerPost: toNumber(previousMetrics.avgLikesPerPost),
      avgRepliesPerPost: toNumber(previousMetrics.avgRepliesPerPost),
      avgRepostsPerPost: toNumber(previousMetrics.avgRepostsPerPost),
      avgQuotesPerPost: toNumber(previousMetrics.avgQuotesPerPost),
      engagementRate: toNumber(previousMetrics.engagementRate),
      accountAgeDays: toNumber(previousMetrics.accountAgeDays),
      momentum7d: toNumber(previousMetrics.momentum7d),
      tweetCountTotal: toNumber(previousMetrics.tweetCountTotal),
      tweetCountDelta: toNumber(previousMetrics.tweetCountDelta),
      activityWindowDays: toNumber(previousMetrics.activityWindowDays),
      activitySource: String(previousMetrics.activitySource || "cached_profile").trim() || "cached_profile",
      profileSnapshotAt: String(
        previousMetrics.profileSnapshotAt ||
        previousMetrics.updatedAt ||
        rosterRecord.updatedAt ||
        updatedAt
      ).trim() || updatedAt,
    },
  };
}

export async function syncCandidateProfilesFromX(db, options = {}) {
  const now = getNow();
  const snapshotDate = options.snapshotDate || getSnapshotDate(now);
  const requestedPool = String(options.pool || rankingConfig.candidatePool.defaultLegendPool)
    .trim()
    .toLowerCase() || rankingConfig.candidatePool.defaultLegendPool;
  const { roster } = await getCandidateRoster(db, {
    ...options,
    pool: requestedPool,
  });

  if (!roster.length) {
    throw new Error(`No approved ${requestedPool} candidates were available to profile-sync.`);
  }

  const existingMetrics = await loadExistingMetricDocs(db, roster.map((record) => record.handle));
  const { usersByHandle, missingHandles } = await lookupUsersByUsernames(roster.map((record) => record.handle));
  const syncedRecords = [];

  for (const rosterRecord of roster) {
    const handle = rosterRecord.handle;
    const user = usersByHandle.get(handle);
    if (!user) {
      continue;
    }

    const updatedAt = now.toISOString();
    const metrics = summarizeProfileMetrics(user, existingMetrics[handle] || {}, now);
    syncedRecords.push({
      handle,
      displayName: user.name || rosterRecord.displayName || handle,
      avatarUrl: normalizeAvatarUrl(user.profile_image_url || rosterRecord.avatarUrl),
      bio: user.description || rosterRecord.bio || "Indie developer shipping in public on X.",
      followers: toNumber(user.public_metrics && user.public_metrics.followers_count, rosterRecord.followers),
      isLegendOverride: false,
      leaderboardPool: rosterRecord.leaderboardPool || requestedPool,
      sourceLabel: rosterRecord.sourceLabel || "",
      sourceUrl: rosterRecord.sourceUrl || "",
      notes: rosterRecord.notes || "",
      xUserId: String(user.id || rosterRecord.xUserId || handle),
      website: normalizeWebsite(rosterRecord.website || user.url),
      createdAt: rosterRecord.createdAt || updatedAt,
      updatedAt,
      metrics,
    });
  }

  if (!syncedRecords.length) {
    throw new Error(`X returned no syncable ${requestedPool} candidates for the requested handles.`);
  }

  const unresolvedMissingHandles = missingHandles;

  await writeCandidateProfileSync(db, syncedRecords, unresolvedMissingHandles, snapshotDate, requestedPool);
  const rankings = await refreshRankingsFromFirestore(db, snapshotDate);

  return {
    snapshotDate,
    pool: requestedPool,
    syncedHandles: syncedRecords.map((record) => record.handle),
    missingHandles: unresolvedMissingHandles,
    cachedHandles: [],
    rankings,
  };
}

export async function syncLegendCandidateProfilesFromX(db, options = {}) {
  return syncCandidateProfilesFromX(db, {
    ...options,
    pool: rankingConfig.candidatePool.defaultLegendPool,
  });
}

export async function syncContenderCandidateProfilesFromX(db, options = {}) {
  return syncCandidateProfilesFromX(db, {
    ...options,
    pool: "contender",
  });
}

export async function syncRookieCandidateProfilesFromX(db, options = {}) {
  return syncCandidateProfilesFromX(db, {
    ...options,
    pool: "rookie",
  });
}

function normalizeProductHuntUsername(value) {
  return String(value || "")
    .trim()
    .replace(/^@+/, "")
    .slice(0, 80);
}

function stringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

export async function syncSubmittedProfileFromX(db, options = {}) {
  const handle = normalizeHandle(options.handle);
  if (!handle) {
    throw new Error("A valid X handle is required.");
  }

  const now = getNow();
  const snapshotDate = options.snapshotDate || getSnapshotDate(now);
  const existingDevDocs = await loadExistingDevDocs(db, [handle]);
  const existingMetricDocs = await loadExistingMetricDocs(db, [handle]);
  const { usersByHandle } = await lookupUsersByUsernames([handle]);
  const user = usersByHandle.get(handle);

  if (!user) {
    throw new Error(`X did not return a user for @${handle}.`);
  }

  const existingDev = existingDevDocs[handle] || {};
  const existingMetrics = existingMetricDocs[handle] || {};
  const updatedAt = now.toISOString();
  const metrics = {
    ...summarizeProfileMetrics(user, existingMetrics, now),
    productsShipped: toNumber(existingMetrics.productsShipped),
    activeProducts: toNumber(existingMetrics.activeProducts),
    importedProjectRecords: toNumber(existingMetrics.importedProjectRecords),
    launchesLast12m: toNumber(existingMetrics.launchesLast12m),
    productImpactScore: toNumber(existingMetrics.productImpactScore),
    productHuntLaunchesTotal: toNumber(existingMetrics.productHuntLaunchesTotal),
    productHuntProfileUsername: normalizeProductHuntUsername(
      options.productHuntUsername ||
      existingMetrics.productHuntProfileUsername
    ),
  };
  const record = {
    handle,
    displayName: user.name || existingDev.displayName || `@${handle}`,
    avatarUrl: normalizeAvatarUrl(user.profile_image_url || existingDev.avatarUrl),
    bio: user.description || existingDev.bio || "Indie developer shipping in public on X.",
    followers: toNumber(user.public_metrics && user.public_metrics.followers_count, existingDev.followers),
    isLegendOverride: false,
    leaderboardPool: "",
    candidatePool: "",
    dynamicPool: true,
    sourceLabel: "Homepage add profile",
    sourceUrl: `https://x.com/${handle}`,
    notes: stringValue(options.note, stringValue(existingDev.notes)),
    productHuntUsername: metrics.productHuntProfileUsername,
    xUserId: String(user.id || existingDev.xUserId || handle),
    website: normalizeWebsite(options.websiteUrl || existingDev.website || user.url),
    createdAt: existingDev.createdAt || updatedAt,
    updatedAt,
    metrics,
  };

  await writeCandidateProfileSync(db, [record], [], snapshotDate, "");
  const rankings = await refreshRankingsFromFirestore(db, snapshotDate);
  const rankedRecord = rankings.byHandle[handle];

  if (!rankedRecord) {
    throw new Error(`@${handle} synced from X, but was not found in the refreshed rankings.`);
  }

  const rankedPool = String(rankedRecord.overallCategory || "rookie").trim().toLowerCase() || "rookie";
  await db.collection("devCandidates").doc(handle).set(
    {
      handle,
      approved: true,
      pool: rankedPool,
      dynamicPool: true,
      submittedVia: "homepage_add_profile",
      sourceLabel: "Homepage add profile",
      sourceUrl: `https://x.com/${handle}`,
      displayName: rankedRecord.displayName,
      xUserId: rankedRecord.xUserId,
      followers: rankedRecord.followers,
      avatarUrl: rankedRecord.avatarUrl,
      bio: rankedRecord.bio,
      website: rankedRecord.website || "",
      notes: record.notes || "",
      productHuntUsername: metrics.productHuntProfileUsername,
      lastProfileSyncAt: updatedAt,
      lastSyncSnapshotDate: snapshotDate,
      lastLookupStatus: "ok",
      updatedAt,
      createdAt: existingDev.createdAt || updatedAt,
    },
    { merge: true }
  );

  return {
    snapshotDate,
    handle,
    rankings,
    rankedRecord,
  };
}

export async function syncLegendRosterFromX(db, options = {}) {
  return syncLegendCandidateProfilesFromX(db, options);
}

export async function syncLegendShortlistFromX(db, options = {}) {
  const now = getNow();
  const snapshotDate = options.snapshotDate || getSnapshotDate(now);
  const requestedHandles = Array.isArray(options.handles) ? options.handles : [];

  if (options.refreshProfiles !== false) {
    await syncLegendCandidateProfilesFromX(db, {
      handles: requestedHandles,
      snapshotDate,
    });
  }

  let shortlistHandles = requestedHandles;
  if (!shortlistHandles.length) {
    const records = await loadRecordsFromFirestore(db);
    shortlistHandles = shortlistLegendHandles(
      records,
      options.limit || rankingConfig.candidatePool.shortlistSize
    );
  }

  if (!shortlistHandles.length) {
    throw new Error("No legend shortlist handles were available to sync.");
  }

  const result = await syncLegendRosterFromX(db, {
    handles: shortlistHandles,
    snapshotDate,
  });

  return {
    ...result,
    shortlistHandles,
  };
}

export async function auditLegendRosterAgainstX(db, options = {}) {
  const now = getNow();
  const snapshotDate = options.snapshotDate || getSnapshotDate(now);
  const timelineStopAt = daysAgoIso(now, 14);
  const records = await loadRecordsFromFirestore(db);
  const rankings = buildRankingsFromRecords(records, rankingConfig, {
    snapshotDate,
  });
  const legendRecords = (rankings.groups && rankings.groups.legend) || [];
  const projectSnapshot = await db.collection("projects").get();
  const projectSignalsByHandle = buildProductSignalsFromProjects(
    projectSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  );
  const { usersByHandle, missingHandles } = await lookupUsersByUsernames(legendRecords.map((record) => record.handle));
  const rows = [];

  for (const record of legendRecords) {
    const handle = record.handle;
    const user = usersByHandle.get(handle);
    if (!user) {
      rows.push({
        handle,
        status: "missing_on_x",
        shippingSource: projectSignalsByHandle[handle] ? "projects" : "none",
      });
      continue;
    }

    const tweets = await getTweetsByUserId(user.id, {
      maxResults: 100,
      maxPages: 10,
      stopAt: timelineStopAt,
    });
    const followersLive = toNumber(user.public_metrics && user.public_metrics.followers_count, record.followers);
    const metricsLive = summarizeTweets(tweets, followersLive, now);

    rows.push({
      handle,
      status: "ok",
      followersStored: record.followers,
      followersLive,
      postsStored: record.metrics.postsLast7d,
      postsLive: metricsLive.postsLast7d,
      repliesStored: record.metrics.repliesLast7d,
      repliesLive: metricsLive.repliesLast7d,
      engagementStored: record.metrics.engagementRate,
      engagementLive: metricsLive.engagementRate,
      momentumStored: record.metrics.momentum7d,
      momentumLive: metricsLive.momentum7d,
      shippingStored: record.productSignals.productsShipped,
      activeStored: record.productSignals.activeProducts,
      shippingSource: projectSignalsByHandle[handle] ? "projects" : "none",
      shippingFromX: false,
    });
  }

  return {
    snapshotDate,
    missingHandles,
    rows,
  };
}

export async function auditHandleActivityAgainstX(db, handle, options = {}) {
  const normalizedHandle = normalizeHandle(handle);
  if (!normalizedHandle) {
    throw new Error("An X handle is required.");
  }

  const now = getNow();
  const stopAt = daysAgoIso(now, 14);
  const timeline = await lookupUsersByUsernames([normalizedHandle]);
  const user = timeline.usersByHandle.get(normalizedHandle);

  if (!user) {
    throw new Error(`X did not return a user for @${normalizedHandle}.`);
  }

  const tweetsResult = await getTweetsByUserId(user.id, {
    maxResults: 100,
    maxPages: toNumber(options.maxPages, 10),
    stopAt,
    includeMeta: true,
  });
  const tweets = tweetsResult.tweets || [];
  const followers = toNumber(user.public_metrics && user.public_metrics.followers_count);
  const liveMetrics = summarizeTweets(tweets, followers, now);
  const devDoc = await db.collection("devs").doc(normalizedHandle).get();
  const metricDoc = await db.collection("devMetrics").doc(normalizedHandle).get();
  const storedRecord = {
    handle: normalizedHandle,
    ...(devDoc.exists ? devDoc.data() : {}),
    ...(metricDoc.exists ? metricDoc.data() : {}),
  };
  const currentWindowStart = now.getTime() - 7 * 86400000;
  const previousWindowStart = currentWindowStart - 7 * 86400000;
  const authoredTweetsLast7d = tweets.filter((tweet) => !isRetweet(tweet) && isWithinRange(tweet.created_at, currentWindowStart, now.getTime() + 1));
  const repliesLast7d = authoredTweetsLast7d.filter((tweet) => isReply(tweet));
  const postsLast7d = authoredTweetsLast7d.filter((tweet) => !isReply(tweet));
  const previousWindowTweets = tweets.filter((tweet) => !isRetweet(tweet) && isWithinRange(tweet.created_at, previousWindowStart, currentWindowStart));

  return {
    handle: normalizedHandle,
    followers,
    pagesFetched: tweetsResult.pagesFetched,
    truncated: tweetsResult.truncated,
    fetchedTweets: tweetsResult.fetchedTweets,
    stopAt,
    stored: {
      postsLast7d: toNumber(storedRecord.postsLast7d),
      repliesLast7d: toNumber(storedRecord.repliesLast7d),
      engagementRate: toNumber(storedRecord.engagementRate),
      momentum7d: toNumber(storedRecord.momentum7d),
    },
    live: {
      summarizedPostsLast7d: liveMetrics.postsLast7d,
      summarizedRepliesLast7d: liveMetrics.repliesLast7d,
      postsLast7d: postsLast7d.length,
      repliesLast7d: repliesLast7d.length,
      authoredTweetsLast7d: authoredTweetsLast7d.length,
      authoredTweetsPrevious7d: previousWindowTweets.length,
      engagementRate: liveMetrics.engagementRate,
      momentum7d: liveMetrics.momentum7d,
    },
  };
}

export { summarizeTweets };
