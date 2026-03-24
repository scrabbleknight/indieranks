import * as logger from "firebase-functions/logger";
import { onRequest } from "firebase-functions/v2/https";
import { getSnapshotDate } from "../shared/ranking-engine.mjs";
import { getDb } from "./lib/admin.js";
import { refreshRankingsFromFirestore } from "./lib/dev-rankings.js";

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
