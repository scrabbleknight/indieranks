import * as logger from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import { getSnapshotDate } from "../shared/ranking-engine.mjs";
import { getDb } from "./lib/admin.js";
import { importCandidatePool } from "./lib/candidate-pool.js";
import { refreshRankingsFromFirestore } from "./lib/dev-rankings.js";
import { syncProjectsFromProductHunt } from "./lib/product-hunt-import.js";
import { syncLegendCandidateProfilesFromX, syncLegendRosterFromX, syncLegendShortlistFromX } from "./lib/x-sync.js";

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
