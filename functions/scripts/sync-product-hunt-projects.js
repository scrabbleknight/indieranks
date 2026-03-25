import { getDb } from "../lib/admin.js";
import { syncProjectsFromProductHunt } from "../lib/product-hunt-import.js";

function parseArgs(argv) {
  const options = {
    handles: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--posted-after") {
      options.postedAfter = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--posted-before") {
      options.postedBefore = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--page-size") {
      options.pageSize = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === "--max-pages") {
      options.maxPages = Number(argv[index + 1]);
      index += 1;
      continue;
    }

    if (value === "--order") {
      options.order = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--map") {
      options.mapPath = argv[index + 1];
      index += 1;
      continue;
    }

    options.handles.push(value);
  }

  return options;
}

const options = parseArgs(process.argv.slice(2));
const result = await syncProjectsFromProductHunt(getDb(), options);

console.log(`Snapshot: ${result.snapshotDate}`);
console.log(`Scanned Product Hunt posts: ${result.scannedPosts}${result.totalPostsAvailable ? ` / ${result.totalPostsAvailable}` : ""}`);
console.log(`Pages fetched: ${result.pagesFetched}${result.truncated ? " (truncated)" : ""}`);
console.log(`Imported Product Hunt projects: ${result.importedProjects}`);
if (result.deletedProjects.length) {
  console.log(`Deleted stale Product Hunt projects: ${result.deletedProjects.length}`);
}
if (result.matchedHandles.length) {
  console.log(`Matched handles: ${result.matchedHandles.join(", ")}`);
}
if (result.mappedHandles.length) {
  console.log(`Mapped handles: ${result.mappedHandles.join(", ")}`);
}
if (result.mappedLaunchHandles.length) {
  console.log(`Handles with imported mapped launches: ${result.mappedLaunchHandles.join(", ")}`);
}
if (result.unmatchedHandles.length) {
  console.log(`No Product Hunt matches yet: ${result.unmatchedHandles.join(", ")}`);
}
if (result.mappedSlugsMissing.length) {
  result.mappedSlugsMissing.forEach((item) => {
    console.log(`Missing mapped slug for ${item.handle}: ${item.slug}`);
  });
}
result.importedByHandle
  .filter((item) => item.projectsImported > 0)
  .forEach((item) => {
    console.log(`${item.handle}: ${item.projectsImported} Product Hunt project(s)`);
  });
console.log(`Legends: ${result.rankings.counts.legends}`);
console.log(`Contenders: ${result.rankings.counts.contenders}`);
console.log(`Rookies: ${result.rankings.counts.rookies}`);
