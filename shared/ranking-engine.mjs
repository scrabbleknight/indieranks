import rankingConfig from "./indie-ranks-config.mjs";
import { getSeedProductSignals } from "./dev-product-signals.mjs";

const CATEGORY_META = {
  legend: {
    label: "Legend",
    scoreKey: "legendScore",
    sectionKey: "legends",
  },
  contender: {
    label: "Contender",
    scoreKey: "contenderScore",
    sectionKey: "contenders",
  },
  rookie: {
    label: "Rookie",
    scoreKey: "rookieScore",
    sectionKey: "rookies",
  },
};

const BREAKDOWN_LABELS = {
  reachScore: "Reach",
  engagementScore: "Engagement",
  consistencyScore: "Consistency",
  qualityScore: "Quality",
  momentumScore: "Momentum",
  shippingScore: "Shipping",
};

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, precision = 2) {
  const factor = 10 ** precision;
  return Math.round(safeNumber(value) * factor) / factor;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(safeNumber(value), minimum), maximum);
}

function formatHandleFallback(handle) {
  return String(handle || "indieranks")
    .replace(/^@+/, "")
    .replace(/[^a-zA-Z0-9_]/g, "")
    .toLowerCase();
}

function buildAvatarUrl(handle) {
  return `https://api.dicebear.com/9.x/glass/svg?seed=${encodeURIComponent(formatHandleFallback(handle) || "indieranks")}`;
}

function getMetrics(raw = {}) {
  const metrics = raw.metrics || {};

  return {
    postsLast7d: safeNumber(raw.postsLast7d ?? metrics.postsLast7d),
    repliesLast7d: safeNumber(raw.repliesLast7d ?? metrics.repliesLast7d),
    avgLikesPerPost: safeNumber(raw.avgLikesPerPost ?? metrics.avgLikesPerPost),
    avgRepliesPerPost: safeNumber(raw.avgRepliesPerPost ?? metrics.avgRepliesPerPost),
    avgRepostsPerPost: safeNumber(raw.avgRepostsPerPost ?? metrics.avgRepostsPerPost),
    avgQuotesPerPost: safeNumber(raw.avgQuotesPerPost ?? metrics.avgQuotesPerPost),
    engagementRate: safeNumber(raw.engagementRate ?? metrics.engagementRate),
    accountAgeDays: safeNumber(raw.accountAgeDays ?? metrics.accountAgeDays),
    momentum7d: safeNumber(raw.momentum7d ?? metrics.momentum7d),
  };
}

function getProductSignals(raw = {}) {
  const metrics = raw.metrics || {};
  const rootSignals = raw.productSignals || {};
  const metricSignals = metrics.productSignals || {};
  const seededSignals = getSeedProductSignals(raw.handle || raw.id);
  const productsShipped = Math.max(
    0,
    safeNumber(
      raw.productsShipped ??
        rootSignals.productsShipped ??
        metrics.productsShipped ??
        metricSignals.productsShipped ??
        (seededSignals && seededSignals.productsShipped)
    )
  );
  const activeProducts = Math.max(
    0,
    safeNumber(
      raw.activeProducts ??
        rootSignals.activeProducts ??
        metrics.activeProducts ??
        metricSignals.activeProducts ??
        (seededSignals && seededSignals.activeProducts)
    )
  );
  const launchesLast12m = Math.max(
    0,
    safeNumber(
      raw.launchesLast12m ??
        rootSignals.launchesLast12m ??
        metrics.launchesLast12m ??
        metricSignals.launchesLast12m ??
        (seededSignals && seededSignals.launchesLast12m)
    )
  );
  const productImpactScore = clamp(
    raw.productImpactScore ??
      rootSignals.productImpactScore ??
      metrics.productImpactScore ??
      metricSignals.productImpactScore ??
      (seededSignals && seededSignals.productImpactScore),
    0,
    100
  );

  return {
    productsShipped,
    activeProducts,
    launchesLast12m,
    productImpactScore: round(productImpactScore, 2),
  };
}

function hasPositiveMetric(projectMetrics = {}) {
  return ["mrr", "users", "downloads", "githubStars"].some((key) => safeNumber(projectMetrics[key]) > 0);
}

function getPrimaryMetricKey(project = {}) {
  const candidate = String(project.primaryMetricKey || project.metricType || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  if (candidate.includes("mrr") || candidate.includes("revenue")) {
    return "mrr";
  }
  if (candidate.includes("user") || candidate.includes("launch")) {
    return "users";
  }
  if (candidate.includes("download")) {
    return "downloads";
  }
  if (candidate.includes("github") || candidate.includes("star")) {
    return "githubStars";
  }

  return "mrr";
}

function getProjectMetric(project = {}, key) {
  const metrics = project.metrics || project.stats || {};
  if (metrics && Object.prototype.hasOwnProperty.call(metrics, key)) {
    return safeNumber(metrics[key]);
  }

  return getPrimaryMetricKey(project) === key ? safeNumber(project.metricValue) : 0;
}

function isWithinLastDays(value, days) {
  if (!value) {
    return false;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return Date.now() - date.getTime() <= days * 86400000;
}

function getProjectFounderHandle(project = {}) {
  return normalizeHandle(
    project.founderXUsername ||
      project.xUsername ||
      project.founderHandle ||
      project.handle ||
      (project.founder && (project.founder.xUsername || project.founder.handle))
  );
}

function scoreProjectImpact(project = {}) {
  const mrr = getProjectMetric(project, "mrr");
  const users = getProjectMetric(project, "users");
  const downloads = getProjectMetric(project, "downloads");
  const githubStars = getProjectMetric(project, "githubStars");
  const growthPercent = clamp(project.growthPercent, -100, 300);
  const tinyWins = Array.isArray(project.tinyWins) ? project.tinyWins.length : 0;

  return (
    Math.log10(mrr + 1) * 14 +
    Math.log10(users + 1) * 8 +
    Math.log10(downloads + 1) * 6 +
    Math.log10(githubStars + 1) * 6 +
    Math.max(0, growthPercent) * 0.12 +
    (project.verified ? 6 : 0) +
    (project.recent ? 4 : 0) +
    Math.min(tinyWins, 5) * 2
  );
}

export function buildProductSignalsFromProjects(projectDocs = []) {
  return (projectDocs || []).reduce((byHandle, project) => {
    const handle = getProjectFounderHandle(project);
    if (!handle) {
      return byHandle;
    }

    const entry = byHandle[handle] || {
      productsShipped: 0,
      activeProducts: 0,
      launchesLast12m: 0,
      productImpactScore: 0,
    };
    const hasActiveSignal =
      Boolean(project.recent) ||
      Boolean(project.featured) ||
      Boolean(project.verified) ||
      hasPositiveMetric(project.metrics || project.stats || {}) ||
      safeNumber(project.metricValue) > 0;
    const recentLaunch = Boolean(project.recent) || isWithinLastDays(project.createdAt, 365) || isWithinLastDays(project.updatedAt, 365);

    entry.productsShipped += 1;
    if (hasActiveSignal) {
      entry.activeProducts += 1;
    }
    if (recentLaunch) {
      entry.launchesLast12m += 1;
    }
    entry.productImpactScore += scoreProjectImpact(project);

    byHandle[handle] = entry;
    return byHandle;
  }, {});
}

export function normalizeHandle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");
}

export function getSnapshotDate(dateValue = new Date()) {
  const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return date.toISOString().slice(0, 10);
}

export function calculateBaseScores(record) {
  const metrics = getMetrics(record);
  const productSignals = getProductSignals(record);
  const followers = Math.max(1, safeNumber(record.followers));

  const engagementScore =
    metrics.avgLikesPerPost * 1 +
    metrics.avgRepliesPerPost * 3 +
    metrics.avgRepostsPerPost * 2 +
    metrics.avgQuotesPerPost * 2.5;

  const consistencyScore =
    Math.min(metrics.postsLast7d, 14) * 2 +
    Math.min(metrics.repliesLast7d, 30) * 1.5;

  const reachScore = Math.log10(followers) * 20;
  const momentumScore = clamp(metrics.momentum7d, -100, 100) * 0.5;
  const qualityScore = metrics.engagementRate * 100;
  const shippingScore =
    Math.min(productSignals.productsShipped, 16) * 9 +
    Math.min(productSignals.activeProducts, 8) * 11 +
    Math.min(productSignals.launchesLast12m, 12) * 7 +
    clamp(productSignals.productImpactScore, 0, 100) * 2;

  return {
    engagementScore: round(engagementScore, 2),
    consistencyScore: round(consistencyScore, 2),
    reachScore: round(reachScore, 2),
    momentumScore: round(momentumScore, 2),
    qualityScore: round(qualityScore, 2),
    shippingScore: round(shippingScore, 2),
  };
}

export function getLegacyBonus(followers, config = rankingConfig) {
  const audience = safeNumber(followers);
  const matchedBonus = (config.legacyBonus || []).find((entry) => audience >= safeNumber(entry.minFollowers));
  return matchedBonus ? safeNumber(matchedBonus.points) : 0;
}

export function isLegendEligible(record, config = rankingConfig) {
  const handle = normalizeHandle(record.handle);
  return (
    safeNumber(record.followers) >= safeNumber(config.thresholds.legendMinFollowers) ||
    Boolean(record.isLegendOverride) ||
    (config.legendOverrides || []).includes(handle)
  );
}

export function isRookieEligible(record, config = rankingConfig) {
  return safeNumber(record.followers) <= safeNumber(config.thresholds.rookieMaxFollowers) && !isLegendEligible(record, config);
}

export function isContenderEligible(record, config = rankingConfig) {
  const followers = safeNumber(record.followers);
  return (
    followers > safeNumber(config.thresholds.rookieMaxFollowers) &&
    followers < safeNumber(config.thresholds.legendMinFollowers) &&
    !isLegendEligible(record, config)
  );
}

export function getOverallCategory(record, config = rankingConfig) {
  if (isLegendEligible(record, config)) {
    return "legend";
  }

  if (isContenderEligible(record, config)) {
    return "contender";
  }

  return "rookie";
}

function scoreFromWeights(baseScores, weights = {}) {
  return round(
    Object.entries(weights).reduce((sum, [key, multiplier]) => {
      return sum + safeNumber(baseScores[key]) * safeNumber(multiplier);
    }, 0),
    2
  );
}

function buildBreakdown(category, baseScores, followers, config) {
  const weights = config.scoreWeights[category] || {};
  const items = Object.entries(weights).map(([key, weight]) => {
    const raw = safeNumber(baseScores[key]);
    return {
      key,
      label: BREAKDOWN_LABELS[key] || key,
      raw: round(raw, 2),
      weight: safeNumber(weight),
      contribution: round(raw * safeNumber(weight), 2),
    };
  });

  if (category === "legend") {
    const legacyBonus = getLegacyBonus(followers, config);
    items.push({
      key: "legacyBonus",
      label: "Legacy Bonus",
      raw: legacyBonus,
      weight: 1,
      contribution: legacyBonus,
    });
  }

  return items;
}

function normalizeMovementValue(value, fallbackLabel) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 0) {
      return { delta: value, label: `+${value}` };
    }
    if (value < 0) {
      return { delta: value, label: String(value) };
    }
    return { delta: 0, label: fallbackLabel };
  }

  const text = String(value || "").trim();
  if (!text || text === fallbackLabel) {
    return { delta: 0, label: fallbackLabel };
  }

  const parsed = Number(text);
  if (Number.isFinite(parsed)) {
    return normalizeMovementValue(parsed, fallbackLabel);
  }

  return { delta: 0, label: fallbackLabel };
}

function getMovement(currentRank, previousRank, fallbackMovement, config) {
  const unchangedLabel = config.movement && config.movement.unchangedLabel ? config.movement.unchangedLabel : "-";

  if (Number.isFinite(previousRank) && previousRank > 0) {
    return normalizeMovementValue(previousRank - currentRank, unchangedLabel);
  }

  return normalizeMovementValue(fallbackMovement, unchangedLabel);
}

export function calculateScores(record, config = rankingConfig) {
  const baseScores = calculateBaseScores(record);
  const followers = safeNumber(record.followers);
  const legendScore = scoreFromWeights(baseScores, config.scoreWeights.legend) + getLegacyBonus(followers, config);
  const contenderScore = scoreFromWeights(baseScores, config.scoreWeights.contender);
  const rookieScore = scoreFromWeights(baseScores, config.scoreWeights.rookie);
  const overallCategory = getOverallCategory(record, config);
  const activeScoreKey = CATEGORY_META[overallCategory].scoreKey;

  return {
    baseScores,
    legendScore: round(legendScore, 2),
    contenderScore: round(contenderScore, 2),
    rookieScore: round(rookieScore, 2),
    overallCategory,
    totalScore: round(
      {
        legendScore,
        contenderScore,
        rookieScore,
      }[activeScoreKey],
      2
    ),
    scoreBreakdowns: {
      legend: buildBreakdown("legend", baseScores, followers, config),
      contender: buildBreakdown("contender", baseScores, followers, config),
      rookie: buildBreakdown("rookie", baseScores, followers, config),
    },
  };
}

function normalizeRecord(raw = {}) {
  const handle = normalizeHandle(raw.handle);
  const metrics = getMetrics(raw);
  const productSignals = getProductSignals({
    ...raw,
    handle,
    metrics,
  });

  return {
    handle,
    displayName: raw.displayName || handle || "Unknown Builder",
    avatarUrl: raw.avatarUrl || buildAvatarUrl(handle),
    bio: raw.bio || "Indie developer shipping in public on X.",
    followers: safeNumber(raw.followers),
    category: raw.category || "",
    isLegendOverride: Boolean(raw.isLegendOverride),
    xUserId: raw.xUserId || handle,
    website: raw.website || "",
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
    previousRanks: raw.previousRanks || {},
    movement: raw.movement || "",
    metrics,
    productSignals,
  };
}

function tieBreak(left, right) {
  const followerDelta = safeNumber(right.followers) - safeNumber(left.followers);
  if (followerDelta !== 0) {
    return followerDelta;
  }

  const shippingDelta = safeNumber(right.baseScores && right.baseScores.shippingScore) - safeNumber(left.baseScores && left.baseScores.shippingScore);
  if (shippingDelta !== 0) {
    return shippingDelta;
  }

  const engagementDelta = safeNumber(right.metrics.engagementRate) - safeNumber(left.metrics.engagementRate);
  if (engagementDelta !== 0) {
    return engagementDelta;
  }

  return left.displayName.localeCompare(right.displayName);
}

function rankCategory(records, category, config) {
  const meta = CATEGORY_META[category];
  const scoreKey = meta.scoreKey;

  const ranked = records
    .filter((record) => record.overallCategory === category)
    .sort((left, right) => {
      const scoreDelta = safeNumber(right[scoreKey]) - safeNumber(left[scoreKey]);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return tieBreak(left, right);
    })
    .map((record, index) => {
      const rank = index + 1;
      const previousRank = safeNumber(record.previousRanks && record.previousRanks[category], NaN);
      const movement = getMovement(rank, previousRank, record.movement, config);

      return {
        ...record,
        rank,
        previousRank: Number.isFinite(previousRank) ? previousRank : null,
        movement,
        categoryLabel: meta.label,
        totalScore: safeNumber(record[scoreKey]),
      };
    });

  return ranked;
}

export function buildRankingsFromRecords(records = [], config = rankingConfig, options = {}) {
  const preparedRecords = (records || [])
    .map(normalizeRecord)
    .filter((record) => record.handle)
    .map((record) => ({
      ...record,
      ...calculateScores(record, config),
    }));

  const legendRankings = rankCategory(preparedRecords, "legend", config);
  const contenderRankings = rankCategory(preparedRecords, "contender", config);
  const rookieRankings = rankCategory(preparedRecords, "rookie", config);

  const byHandle = {};
  const directory = [...legendRankings, ...contenderRankings, ...rookieRankings].sort((left, right) => {
    const scoreDelta = safeNumber(right.totalScore) - safeNumber(left.totalScore);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
    return tieBreak(left, right);
  });

  directory.forEach((record) => {
    byHandle[record.handle] = record;
  });

  return {
    snapshotDate: options.snapshotDate || getSnapshotDate(),
    counts: {
      total: directory.length,
      legends: legendRankings.length,
      contenders: contenderRankings.length,
      rookies: rookieRankings.length,
    },
    sections: {
      legends: legendRankings.slice(0, safeNumber(config.leaderboardSizes.legends) || legendRankings.length),
      contenders: contenderRankings.slice(0, safeNumber(config.leaderboardSizes.contenders) || contenderRankings.length),
      rookies: rookieRankings.slice(0, safeNumber(config.leaderboardSizes.rookies) || rookieRankings.length),
    },
    groups: {
      legend: legendRankings,
      contender: contenderRankings,
      rookie: rookieRankings,
    },
    directory,
    byHandle,
  };
}

export function searchRankedRecords(records = [], query = "", config = rankingConfig) {
  const term = String(query || "").trim().toLowerCase();
  if (!term) {
    return [];
  }

  return records
    .map((record) => {
      const handle = record.handle.toLowerCase();
      const displayName = String(record.displayName || "").toLowerCase();
      const bio = String(record.bio || "").toLowerCase();
      let matchScore = 0;

      if (handle === term || `@${handle}` === term) {
        matchScore += 12;
      } else if (handle.startsWith(term.replace(/^@/, ""))) {
        matchScore += 8;
      } else if (`@${handle}`.includes(term)) {
        matchScore += 5;
      }

      if (displayName.includes(term)) {
        matchScore += 6;
      }

      if (bio.includes(term)) {
        matchScore += 3;
      }

      return {
        record,
        matchScore,
      };
    })
    .filter((item) => item.matchScore > 0)
    .sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore;
      }
      const scoreDelta = safeNumber(right.record.totalScore) - safeNumber(left.record.totalScore);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }
      return tieBreak(left.record, right.record);
    })
    .slice(0, safeNumber(config.search.maxResults) || 8)
    .map((item) => item.record);
}

export function mergeFirestoreCollections(devDocs = [], metricDocs = [], snapshotRows = [], projectDocs = []) {
  const metricsByHandle = new Map(
    (metricDocs || []).map((doc) => [normalizeHandle(doc.handle || doc.id), doc])
  );
  const snapshotsByHandle = new Map(
    (snapshotRows || []).map((doc) => [normalizeHandle(doc.handle || doc.id), doc])
  );
  const projectSignalsByHandle = buildProductSignalsFromProjects(projectDocs);

  return (devDocs || []).map((doc) => {
    const handle = normalizeHandle(doc.handle || doc.id);
    const metrics = metricsByHandle.get(handle) || {};
    const snapshot = snapshotsByHandle.get(handle) || {};
    const previousCategory = snapshot.category || metrics.overallCategory || doc.category || "";
    const previousRanks =
      Number.isFinite(safeNumber(snapshot.rank, NaN)) && previousCategory
        ? { [previousCategory]: safeNumber(snapshot.rank) }
        : {};
    const derivedProductSignals = projectSignalsByHandle[handle] || {};
    const mergedMetrics = {
      ...metrics,
      ...derivedProductSignals,
    };

    return {
      ...doc,
      ...mergedMetrics,
      handle,
      previousRanks,
      movement: snapshot.movement || metrics.movement || "",
      metrics: mergedMetrics,
      productSignals: getProductSignals({
        ...doc,
        ...mergedMetrics,
        handle,
        metrics: mergedMetrics,
      }),
    };
  });
}

export function toFirestorePayloads(rankings, snapshotDate = getSnapshotDate()) {
  const directory = rankings && Array.isArray(rankings.directory) ? rankings.directory : [];

  return {
    snapshotDoc: {
      id: snapshotDate,
      data: {
        snapshotDate,
        totalDevs: directory.length,
        legends: rankings.counts.legends,
        contenders: rankings.counts.contenders,
        rookies: rankings.counts.rookies,
        updatedAt: new Date().toISOString(),
      },
    },
    devDocs: directory.map((record) => ({
      id: record.handle,
      data: {
        handle: record.handle,
        displayName: record.displayName,
        avatarUrl: record.avatarUrl,
        bio: record.bio,
        followers: record.followers,
        category: record.overallCategory,
        isLegendOverride: record.isLegendOverride,
        xUserId: record.xUserId,
        website: record.website,
        createdAt: record.createdAt,
        updatedAt: new Date().toISOString(),
      },
    })),
    metricDocs: directory.map((record) => ({
      id: record.handle,
      data: {
        postsLast7d: record.metrics.postsLast7d,
        repliesLast7d: record.metrics.repliesLast7d,
        avgLikesPerPost: record.metrics.avgLikesPerPost,
        avgRepliesPerPost: record.metrics.avgRepliesPerPost,
        avgRepostsPerPost: record.metrics.avgRepostsPerPost,
        avgQuotesPerPost: record.metrics.avgQuotesPerPost,
        engagementRate: record.metrics.engagementRate,
        momentum7d: record.metrics.momentum7d,
        productsShipped: record.productSignals.productsShipped,
        activeProducts: record.productSignals.activeProducts,
        launchesLast12m: record.productSignals.launchesLast12m,
        productImpactScore: record.productSignals.productImpactScore,
        legendScore: record.legendScore,
        contenderScore: record.contenderScore,
        rookieScore: record.rookieScore,
        overallCategory: record.overallCategory,
        movement: record.movement.label,
        snapshotDate,
      },
    })),
    snapshotRows: directory.map((record) => ({
      id: record.handle,
      data: {
        handle: record.handle,
        rank: record.rank,
        category: record.overallCategory,
        score: record.totalScore,
        previousRank: record.previousRank,
        movement: record.movement.label,
      },
    })),
  };
}

export { CATEGORY_META };
