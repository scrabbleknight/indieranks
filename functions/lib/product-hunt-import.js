import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSnapshotDate, normalizeHandle } from "../shared/ranking-engine.mjs";
import { refreshRankingsFromFirestore } from "./dev-rankings.js";
import { getProductHuntAccessToken, getProductHuntPostBySlug, listProductHuntPosts } from "./product-hunt-api.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultProductHuntMapPath = path.resolve(currentDirectory, "../../data/product-hunt-project-map.json");

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(toNumber(value, minimum), minimum), maximum);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function truncate(value, maxLength, fallback = "") {
  const text = String(value || fallback || "").trim();
  if (!text) {
    return fallback;
  }
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function isRecent(value, days = 365) {
  const date = new Date(value);
  const time = date.getTime();
  if (!Number.isFinite(time)) {
    return false;
  }

  return Date.now() - time <= days * 86400000;
}

function isValidUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return /^https?:$/i.test(url.protocol) ? url.toString() : "";
  } catch (error) {
    return "";
  }
}

function normalizeDate(value, fallback) {
  const date = new Date(value || fallback || Date.now());
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}

function chunk(items, size) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function dedupeProjectDocs(projectDocs = []) {
  const docsById = new Map();

  (projectDocs || []).forEach((doc) => {
    if (!doc || !doc.id) {
      return;
    }
    docsById.set(doc.id, doc);
  });

  return Array.from(docsById.values());
}

async function readProductHuntMap(mapPath = defaultProductHuntMapPath) {
  const resolvedPath = path.isAbsolute(mapPath) ? mapPath : path.resolve(process.cwd(), mapPath);
  const raw = await readFile(resolvedPath, "utf8");
  const parsed = JSON.parse(raw);
  const mappings = Array.isArray(parsed.mappings) ? parsed.mappings : [];

  return mappings
    .map((entry) => ({
      handle: normalizeHandle(entry.handle),
      profileUsername: String(entry.profileUsername || "").trim(),
      profileLaunchCount: Math.max(0, toNumber(entry.profileLaunchCount)),
      researchStatus: String(entry.researchStatus || (entry.profileUsername ? "verified_profile" : "")).trim(),
      postSlugs: Array.from(
        new Set(
          (Array.isArray(entry.postSlugs) ? entry.postSlugs : [])
            .map((slug) => String(slug || "").trim())
            .filter(Boolean)
        )
      ),
      notes: String(entry.notes || "").trim(),
    }))
    .filter((entry) => entry.handle && (entry.postSlugs.length || entry.profileUsername || entry.researchStatus === "none_found" || entry.profileLaunchCount >= 0));
}

function isRedactedMaker(maker = {}) {
  return (
    String(maker.id || "") === "0" &&
    String(maker.name || "").trim() === "[REDACTED]" &&
    String(maker.username || "").trim() === "[REDACTED]" &&
    !String(maker.twitterUsername || "").trim()
  );
}

function buildTinyWins(post, launchDate) {
  const wins = [];
  const votesCount = toNumber(post.votesCount);
  const commentsCount = toNumber(post.commentsCount);
  const reviewsCount = toNumber(post.reviewsCount);
  const reviewsRating = clamp(post.reviewsRating, 0, 5);
  const dailyRank = toNumber(post.dailyRank);

  if (post.featuredAt) {
    wins.push({
      label: "Featured on Product Hunt",
      note: "Official Product Hunt launch",
      badge: "Product Hunt",
      date: normalizeDate(post.featuredAt, launchDate),
    });
  }

  if (dailyRank > 0) {
    wins.push({
      label: `#${dailyRank} Product of the Day`,
      note: "Captured from Product Hunt rank data",
      badge: "Ranked",
      date: launchDate,
    });
  }

  if (votesCount > 0) {
    wins.push({
      label: `${votesCount} Product Hunt votes`,
      note: "Public Product Hunt vote count",
      badge: "Votes",
      date: launchDate,
    });
  }

  if (commentsCount > 0) {
    wins.push({
      label: `${commentsCount} Product Hunt comments`,
      note: "Public discussion count",
      badge: "Comments",
      date: launchDate,
    });
  }

  if (reviewsCount > 0 && reviewsRating > 0) {
    wins.push({
      label: `${reviewsRating.toFixed(1)}/5 from ${reviewsCount} reviews`,
      note: "Public Product Hunt review score",
      badge: "Reviews",
      date: launchDate,
    });
  }

  return wins.slice(0, 5);
}

function inferCategory(post = {}) {
  if (post.featuredAt) {
    return "Product Hunt launch";
  }

  return "Launch";
}

function buildProjectId(postId, handle) {
  return `ph-${String(postId || "").trim()}-${normalizeHandle(handle)}`.slice(0, 80);
}

function buildImportedProject(post, dev, maker = {}, importedAt) {
  const profileLaunchCount = Math.max(0, toNumber(dev.productHuntProfileLaunchesTotal));
  const profileUsername = String(dev.productHuntProfileUsername || "").trim();
  const handle = normalizeHandle(dev.handle || maker.twitterUsername);
  const launchDate = normalizeDate(post.featuredAt || post.createdAt, importedAt);
  const websiteUrl = isValidUrl(post.website) || isValidUrl(post.url) || dev.website || "https://www.producthunt.com/";
  const tagline = truncate(post.tagline, 220, "Product Hunt launch");
  const description = truncate(post.description || post.tagline, 320, tagline);
  const founderName = truncate(dev.displayName || maker.name || handle || "Anonymous builder", 120, "Anonymous builder");
  const founderSlug = slugify(founderName || handle);
  const tinyWins = buildTinyWins(post, launchDate);

  return {
    id: buildProjectId(post.id, handle),
    data: {
      slug: buildProjectId(post.id, handle),
      name: truncate(post.name, 120, "Untitled Product Hunt launch"),
      founderName,
      founderSlug,
      founderXUsername: handle,
      category: inferCategory(post),
      tagline,
      description,
      primaryMetricKey: "users",
      metricType: "Users",
      metricValue: 0,
      metricLabel: "Users",
      growthPercent: 0,
      timeframe: "allTime",
      verificationType: "Product Hunt",
      verificationReference: isValidUrl(post.url) || "https://www.producthunt.com/",
      verified: false,
      websiteUrl,
      logoUrl: isValidUrl(post.thumbnail && post.thumbnail.url),
      createdAt: launchDate,
      tinyWins,
      featured: Boolean(post.featuredAt),
      recent: isRecent(post.featuredAt || post.createdAt),
      momentum: 1,
      metrics: {
        mrr: 0,
        users: 0,
        downloads: 0,
        githubStars: 0,
      },
      history: [],
      importSource: "product_hunt",
      importedAt,
      productHuntPostId: String(post.id || ""),
      productHuntSlug: String(post.slug || ""),
      productHuntUrl: isValidUrl(post.url),
      productHuntWebsite: isValidUrl(post.website),
      productHuntVotesCount: toNumber(post.votesCount),
      productHuntCommentsCount: toNumber(post.commentsCount),
      productHuntReviewsCount: toNumber(post.reviewsCount),
      productHuntReviewsRating: clamp(post.reviewsRating, 0, 5),
      productHuntDailyRank: toNumber(post.dailyRank),
      productHuntWeeklyRank: toNumber(post.weeklyRank),
      productHuntMonthlyRank: toNumber(post.monthlyRank),
      productHuntYearlyRank: toNumber(post.yearlyRank),
      productHuntFeaturedAt: post.featuredAt ? normalizeDate(post.featuredAt, launchDate) : "",
      productHuntMakerId: String(maker.id || ""),
      productHuntMakerUsername: String(maker.username || ""),
      productHuntMakerProfileUrl: isValidUrl(maker.url),
      productHuntProfileLaunchesTotal: profileLaunchCount,
      productHuntProfileUsername: profileUsername,
    },
  };
}

async function loadTrackedDevs(db, requestedHandles = []) {
  const normalizedRequested = Array.from(
    new Set(
      (requestedHandles || [])
        .flatMap((value) => String(value || "").split(","))
        .map((value) => normalizeHandle(value))
        .filter(Boolean)
    )
  );

  if (normalizedRequested.length) {
    const snapshots = await Promise.all(normalizedRequested.map((handle) => db.collection("devs").doc(handle).get()));
    const tracked = new Map();

    snapshots.forEach((snapshot) => {
      if (snapshot.exists) {
        tracked.set(snapshot.id, {
          handle: snapshot.id,
          ...snapshot.data(),
        });
      }
    });

    if (!tracked.size) {
      throw new Error("None of the requested handles were found in Firestore devs.");
    }

    return tracked;
  }

  const snapshot = await db.collection("devs").get();
  if (snapshot.empty) {
    throw new Error("No Firestore devs were found. Run npm run seed:devs first.");
  }

  return new Map(
    snapshot.docs.map((doc) => [
      doc.id,
      {
        handle: doc.id,
        ...doc.data(),
      },
    ])
  );
}

async function loadMappedPostsForTrackedDevs(trackedDevs, options = {}) {
  const allMappings = await readProductHuntMap(options.mapPath);
  const mappingByHandle = new Map(
    allMappings
      .filter((entry) => trackedDevs.has(entry.handle))
      .map((entry) => [entry.handle, entry])
  );

  if (!mappingByHandle.size) {
    return {
      mappedProjectDocs: [],
      mappedHandles: [],
      unmappedHandles: Array.from(trackedDevs.keys()).sort(),
      mappedSlugsMissing: [],
    };
  }

  const accessToken = await getProductHuntAccessToken();
  const mappedProjectDocs = [];
  const mappedHandles = new Set(mappingByHandle.keys());
  const mappedLaunchHandles = new Set();
  const mappedSlugsMissing = [];

  for (const [handle, entry] of mappingByHandle.entries()) {
    const dev = {
      ...(trackedDevs.get(handle) || {}),
      productHuntProfileLaunchesTotal: entry.profileLaunchCount,
      productHuntProfileUsername: entry.profileUsername,
      productHuntResearchStatus: entry.researchStatus,
    };

    for (const slug of entry.postSlugs) {
      const post = await getProductHuntPostBySlug(slug, accessToken);
      if (!post) {
        mappedSlugsMissing.push({
          handle,
          slug,
        });
        continue;
      }

      mappedProjectDocs.push(buildImportedProject(post, dev, {}, options.importedAt || new Date().toISOString()));
      mappedLaunchHandles.add(handle);
    }
  }

  return {
    mappedProjectDocs,
    mappedHandles: Array.from(mappedHandles).sort(),
    mappedLaunchHandles: Array.from(mappedLaunchHandles).sort(),
    unmappedHandles: Array.from(trackedDevs.keys()).filter((handle) => !mappingByHandle.has(handle)).sort(),
    mappedSlugsMissing,
    profileSignalsByHandle: new Map(
      Array.from(mappingByHandle.entries()).map(([handle, entry]) => [
        handle,
        {
          productHuntLaunchesTotal: entry.profileLaunchCount,
          productHuntProfileUsername: entry.profileUsername,
          productHuntResearchStatus: entry.researchStatus || "",
        },
      ])
    ),
  };
}

async function writeProductHuntProfileSignals(db, trackedHandles = [], profileSignalsByHandle = new Map()) {
  const handles = Array.from(new Set((trackedHandles || []).map((handle) => normalizeHandle(handle)).filter(Boolean)));

  for (let index = 0; index < handles.length; index += 200) {
    const batch = db.batch();

    handles.slice(index, index + 200).forEach((handle) => {
      const signal = profileSignalsByHandle.get(handle) || {};
      batch.set(
        db.collection("devMetrics").doc(handle),
        {
          productHuntLaunchesTotal: Math.max(0, toNumber(signal.productHuntLaunchesTotal)),
          productHuntProfileUsername: String(signal.productHuntProfileUsername || "").trim(),
          productHuntResearchStatus: String(signal.productHuntResearchStatus || "").trim(),
        },
        { merge: true }
      );
    });

    await batch.commit();
  }
}

function collectMatches(posts, trackedDevs, importedAt) {
  const projectDocs = [];
  const matchedHandles = new Set();
  const matchedPostIds = new Set();
  const importedByHandle = new Map();
  let makerCount = 0;
  let redactedMakerCount = 0;

  for (const post of posts || []) {
    const makers = Array.isArray(post.makers) ? post.makers : [];
    const matchedOnPost = new Map();

    for (const maker of makers) {
      makerCount += 1;
      if (isRedactedMaker(maker)) {
        redactedMakerCount += 1;
      }
      const handle = normalizeHandle(maker.twitterUsername);
      if (!handle || !trackedDevs.has(handle)) {
        continue;
      }
      matchedOnPost.set(handle, maker);
    }

    for (const [handle, maker] of matchedOnPost.entries()) {
      const dev = trackedDevs.get(handle);
      projectDocs.push(buildImportedProject(post, dev, maker, importedAt));
      matchedHandles.add(handle);
      matchedPostIds.add(String(post.id || ""));
      importedByHandle.set(handle, (importedByHandle.get(handle) || 0) + 1);
    }
  }

  return {
    projectDocs,
    matchedHandles: Array.from(matchedHandles).sort(),
    matchedPostIds: Array.from(matchedPostIds).sort(),
    importedByHandle,
    makerCount,
    redactedMakerCount,
  };
}

async function loadExistingProductHuntProjects(db) {
  const snapshot = await db.collection("projects").get();
  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter((project) => String(project.importSource || "").trim() === "product_hunt");
}

async function writeImportedProjects(db, projectDocs, staleProjectIds) {
  const upserts = (projectDocs || []).map((doc) => ({
    ref: db.collection("projects").doc(doc.id),
    type: "set",
    data: doc.data,
  }));
  const deletes = (staleProjectIds || []).map((id) => ({
    ref: db.collection("projects").doc(id),
    type: "delete",
  }));
  const operations = upserts.concat(deletes);

  for (const group of chunk(operations, 350)) {
    const batch = db.batch();
    group.forEach((operation) => {
      if (operation.type === "delete") {
        batch.delete(operation.ref);
      } else {
        batch.set(operation.ref, operation.data, { merge: false });
      }
    });
    await batch.commit();
  }
}

export async function syncProjectsFromProductHunt(db, options = {}) {
  const now = new Date();
  const importedAt = now.toISOString();
  const snapshotDate = options.snapshotDate || getSnapshotDate(now);
  const trackedDevs = await loadTrackedDevs(db, options.handles);
  const trackedHandles = Array.from(trackedDevs.keys()).sort();
  const manualResult = await loadMappedPostsForTrackedDevs(trackedDevs, {
    importedAt,
    mapPath: options.mapPath,
  });
  let projectDocs = manualResult.mappedProjectDocs;
  let matchedHandles = manualResult.mappedLaunchHandles;
  let importedByHandle = new Map(
    manualResult.mappedHandles.map((handle) => [
      handle,
      manualResult.mappedProjectDocs.filter((doc) => doc.data.founderXUsername === handle).length,
    ])
  );
  let makerCount = 0;
  let redactedMakerCount = 0;
  let postResult = {
    posts: [],
    totalCount: 0,
    pagesFetched: 0,
    truncated: false,
  };

  if (manualResult.unmappedHandles.length) {
    postResult = await listProductHuntPosts({
      postedAfter: options.postedAfter,
      postedBefore: options.postedBefore,
      pageSize: options.pageSize,
      maxPages: options.maxPages,
      order: options.order,
    });
    const autoResult = collectMatches(
      postResult.posts,
      new Map(manualResult.unmappedHandles.map((handle) => [handle, trackedDevs.get(handle)])),
      importedAt
    );
    makerCount = autoResult.makerCount;
    redactedMakerCount = autoResult.redactedMakerCount;
    projectDocs = projectDocs.concat(autoResult.projectDocs);
    matchedHandles = Array.from(new Set(matchedHandles.concat(autoResult.matchedHandles))).sort();
    autoResult.importedByHandle.forEach((count, handle) => {
      importedByHandle.set(handle, (importedByHandle.get(handle) || 0) + count);
    });
  }

  if (!projectDocs.length && makerCount > 0 && redactedMakerCount === makerCount) {
    throw new Error(
      "Product Hunt is redacting maker identities for this token, so automatic X-handle matching cannot run yet. Add verified post slugs to data/product-hunt-project-map.json for the handles you want to import."
    );
  }

  projectDocs = dedupeProjectDocs(projectDocs);
  matchedHandles = Array.from(new Set(projectDocs.map((doc) => normalizeHandle(doc.data && doc.data.founderXUsername)).filter(Boolean))).sort();
  importedByHandle = new Map(
    matchedHandles.map((handle) => [
      handle,
      projectDocs.filter((doc) => normalizeHandle(doc.data && doc.data.founderXUsername) === handle).length,
    ])
  );

  await writeProductHuntProfileSignals(db, trackedHandles, manualResult.profileSignalsByHandle);

  const existingProjects = await loadExistingProductHuntProjects(db);
  const nextIds = new Set(projectDocs.map((doc) => doc.id));
  const staleProjectIds = existingProjects
    .filter((project) => trackedDevs.has(normalizeHandle(project.founderXUsername)))
    .map((project) => project.id)
    .filter((id) => !nextIds.has(id));

  await writeImportedProjects(db, projectDocs, staleProjectIds);
  const rankings = await refreshRankingsFromFirestore(db, snapshotDate);

  return {
    snapshotDate,
    scannedPosts: postResult.posts.length,
    totalPostsAvailable: postResult.totalCount,
    pagesFetched: postResult.pagesFetched,
    truncated: postResult.truncated,
    importedProjects: projectDocs.length,
    deletedProjects: staleProjectIds,
    matchedHandles,
    mappedLaunchHandles: manualResult.mappedLaunchHandles,
    unmatchedHandles: trackedHandles.filter((handle) => !manualResult.mappedHandles.includes(handle) && !matchedHandles.includes(handle)),
    importedByHandle: trackedHandles.map((handle) => ({
      handle,
      projectsImported: importedByHandle.get(handle) || 0,
    })),
    mappedSlugsMissing: manualResult.mappedSlugsMissing,
    mappedHandles: manualResult.mappedHandles,
    unmappedHandlesUsingDiscovery: manualResult.unmappedHandles,
    rankings,
  };
}
