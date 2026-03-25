import * as logger from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { getSnapshotDate } from "./shared/ranking-engine.mjs";
import { getAdminAuth, getDb } from "./lib/admin.js";
import { importCandidatePool } from "./lib/candidate-pool.js";
import { refreshRankingsFromFirestore } from "./lib/dev-rankings.js";
import { syncProjectsFromProductHunt } from "./lib/product-hunt-import.js";
import {
  syncLegendCandidateProfilesFromX,
  syncLegendRosterFromX,
  syncLegendShortlistFromX,
  syncSubmittedProfileFromX,
} from "./lib/x-sync.js";

const SUBMITTED_PROFILE_SYNC_COOLDOWN_MS = 15 * 60 * 1000;
const FUNCTION_REGION = "europe-west2";

setGlobalOptions({
  region: FUNCTION_REGION,
});

function normalizeHandle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");
}

function getBearerToken(request) {
  const authorization = String(request.headers.authorization || "").trim();
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

async function requireVerifiedUser(request) {
  const token = getBearerToken(request);
  if (!token) {
    const error = new Error("Sign in first, then try adding the profile again.");
    error.statusCode = 401;
    throw error;
  }

  try {
    return await getAdminAuth().verifyIdToken(token);
  } catch (error) {
    const authError = new Error("Could not verify your sign-in session. Refresh and try again.");
    authError.statusCode = 401;
    throw authError;
  }
}

function jsonBody(request) {
  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  if (typeof request.body === "string" && request.body.trim()) {
    try {
      return JSON.parse(request.body);
    } catch (error) {
      return {};
    }
  }

  return {};
}

function rankedPayload(record = {}) {
  return {
    handle: record.handle || "",
    category: record.overallCategory || "",
    rank: Number(record.rank) || 0,
    score: Number(record.totalScore) || 0,
    displayName: record.displayName || "",
  };
}

async function getCurrentRankedRecord(db, handle, snapshotDate = getSnapshotDate()) {
  const rankings = await refreshRankingsFromFirestore(db, snapshotDate);
  return {
    rankings,
    rankedRecord: rankings.byHandle[handle] || null,
  };
}

async function getRecentProfileSync(db, handle) {
  const [candidateDoc, metricDoc] = await Promise.all([
    db.collection("devCandidates").doc(handle).get(),
    db.collection("devMetrics").doc(handle).get(),
  ]);
  const candidateData = candidateDoc.exists ? candidateDoc.data() || {} : {};
  const metricData = metricDoc.exists ? metricDoc.data() || {} : {};
  const lastSyncAt = String(
    candidateData.lastProfileSyncAt ||
    metricData.profileSnapshotAt ||
    metricData.updatedAt ||
    ""
  ).trim();
  const lastSyncMs = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;

  return {
    candidateData,
    metricData,
    lastSyncMs: Number.isFinite(lastSyncMs) ? lastSyncMs : 0,
  };
}

export const refreshIndieDevRankings = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({
      ok: false,
      error: "Use POST to refresh IndieRanks developer rankings.",
    });
    return;
  }

  try {
    const snapshotDate = typeof request.query.snapshotDate === "string" ? request.query.snapshotDate : getSnapshotDate();
    const rankings = await refreshRankingsFromFirestore(getDb(), snapshotDate);

    response.json({
      ok: true,
      snapshotDate: rankings.snapshotDate,
      counts: rankings.counts,
    });
  } catch (error) {
    logger.error("Failed to refresh IndieRanks developer rankings", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export const syncLegendLeaderboardFromX = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({
      ok: false,
      error: "Use POST to sync IndieRanks legend data from X.",
    });
    return;
  }

  try {
    const handles =
      typeof request.query.handles === "string"
        ? request.query.handles
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
    const result = await syncLegendRosterFromX(getDb(), { handles });

    response.json({
      ok: true,
      snapshotDate: result.snapshotDate,
      syncedHandles: result.syncedHandles,
      missingHandles: result.missingHandles,
      counts: result.rankings.counts,
    });
  } catch (error) {
    logger.error("Failed to sync IndieRanks legends from X", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export const importLegendCandidatePool = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({
      ok: false,
      error: "Use POST to import the approved legend candidate pool.",
    });
    return;
  }

  try {
    const result = await importCandidatePool(getDb());
    response.json({
      ok: true,
      importedCandidates: result.candidates.length,
      pool: result.pool,
      seededAt: result.seededAt,
    });
  } catch (error) {
    logger.error("Failed to import the legend candidate pool", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export const syncLegendCandidateProfiles = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({
      ok: false,
      error: "Use POST to profile-sync approved legend candidates from X.",
    });
    return;
  }

  try {
    const handles =
      typeof request.query.handles === "string"
        ? request.query.handles
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
    const result = await syncLegendCandidateProfilesFromX(getDb(), { handles });

    response.json({
      ok: true,
      snapshotDate: result.snapshotDate,
      syncedHandles: result.syncedHandles,
      missingHandles: result.missingHandles,
      counts: result.rankings.counts,
    });
  } catch (error) {
    logger.error("Failed to profile-sync legend candidates from X", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export const syncLegendShortlist = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({
      ok: false,
      error: "Use POST to sync the legend shortlist from X.",
    });
    return;
  }

  try {
    const handles =
      typeof request.query.handles === "string"
        ? request.query.handles
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
    const limit = typeof request.query.limit === "string" ? Number(request.query.limit) : undefined;
    const refreshProfiles = request.query.refreshProfiles !== "false";
    const result = await syncLegendShortlistFromX(getDb(), {
      handles,
      limit,
      refreshProfiles,
    });

    response.json({
      ok: true,
      snapshotDate: result.snapshotDate,
      shortlistHandles: result.shortlistHandles,
      syncedHandles: result.syncedHandles,
      missingHandles: result.missingHandles,
      counts: result.rankings.counts,
    });
  } catch (error) {
    logger.error("Failed to sync the legend shortlist from X", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export const syncProjectsFromProductHuntSource = onRequest(async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({
      ok: false,
      error: "Use POST to sync Product Hunt project data.",
    });
    return;
  }

  try {
    const handles =
      typeof request.query.handles === "string"
        ? request.query.handles
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
        : [];
    const postedAfter = typeof request.query.postedAfter === "string" ? request.query.postedAfter : undefined;
    const postedBefore = typeof request.query.postedBefore === "string" ? request.query.postedBefore : undefined;
    const maxPages = typeof request.query.maxPages === "string" ? Number(request.query.maxPages) : undefined;
    const pageSize = typeof request.query.pageSize === "string" ? Number(request.query.pageSize) : undefined;
    const result = await syncProjectsFromProductHunt(getDb(), {
      handles,
      postedAfter,
      postedBefore,
      maxPages,
      pageSize,
    });

    response.json({
      ok: true,
      snapshotDate: result.snapshotDate,
      scannedPosts: result.scannedPosts,
      totalPostsAvailable: result.totalPostsAvailable,
      pagesFetched: result.pagesFetched,
      truncated: result.truncated,
      importedProjects: result.importedProjects,
      deletedProjects: result.deletedProjects.length,
      matchedHandles: result.matchedHandles,
      unmatchedHandles: result.unmatchedHandles,
      counts: result.rankings.counts,
    });
  } catch (error) {
    logger.error("Failed to sync Product Hunt projects", error);
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export const submitCandidateProfileAndRank = onRequest({ cors: true }, async (request, response) => {
  if (request.method !== "POST") {
    response.status(405).json({
      ok: false,
      error: "Use POST to add and rank a profile.",
    });
    return;
  }

  try {
    const verifiedUser = await requireVerifiedUser(request);
    const payload = jsonBody(request);
    const handle = normalizeHandle(payload.handle);
    if (!handle) {
      response.status(400).json({
        ok: false,
        error: "Add a valid X handle first.",
      });
      return;
    }

    const db = getDb();
    const snapshotDate = getSnapshotDate();
    const recentSync = await getRecentProfileSync(db, handle);
    const nowMs = Date.now();

    if (recentSync.lastSyncMs && nowMs - recentSync.lastSyncMs < SUBMITTED_PROFILE_SYNC_COOLDOWN_MS) {
      const { rankings, rankedRecord } = await getCurrentRankedRecord(db, handle, snapshotDate);
      if (!rankedRecord) {
        throw new Error(`@${handle} was recently synced, but is missing from the refreshed rankings.`);
      }

      response.json({
        ok: true,
        handle,
        snapshotDate: rankings.snapshotDate,
        cached: true,
        ranked: rankedPayload(rankedRecord),
        counts: rankings.counts,
      });
      return;
    }

    const syncResult = await syncSubmittedProfileFromX(db, {
      handle,
      websiteUrl: payload.websiteUrl,
      productHuntUsername: payload.productHuntUsername,
      note: payload.note,
    });

    await Promise.all([
      db.collection("candidateSubmissions").add({
        handle,
        note: String(payload.note || "").trim().slice(0, 400),
        websiteUrl: String(payload.websiteUrl || "").trim().slice(0, 300),
        productHuntUsername: String(payload.productHuntUsername || "").trim().replace(/^@+/, "").slice(0, 80),
        status: "synced",
        source: "homepage_add_profile",
        submitterUid: verifiedUser.uid,
        createdAt: new Date(),
        syncedAt: new Date(),
      }),
      db.collection("profileSyncRequests").doc(`${verifiedUser.uid}_${handle}`).set({
        handle,
        submitterUid: verifiedUser.uid,
        lastRequestedAt: new Date(),
      }, { merge: true }),
    ]);

    response.json({
      ok: true,
      handle,
      snapshotDate: syncResult.snapshotDate,
      cached: false,
      ranked: rankedPayload(syncResult.rankedRecord),
      counts: syncResult.rankings.counts,
    });
  } catch (error) {
    logger.error("Failed to add and rank submitted profile", error);
    response.status(error && error.statusCode ? error.statusCode : 500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});
