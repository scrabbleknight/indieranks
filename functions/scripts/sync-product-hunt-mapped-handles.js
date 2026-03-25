import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb } from "../lib/admin.js";
import { syncProjectsFromProductHunt } from "../lib/product-hunt-import.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDirectory, "../..");
const candidatesPath = path.join(repoRoot, "data", "dev-candidates.json");
const mapPath = path.join(repoRoot, "data", "product-hunt-project-map.json");

function normalizeHandle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");
}

function parseArgs(argv) {
  const options = {
    pools: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = String(argv[index] || "").trim().toLowerCase();
    if (!value) {
      continue;
    }

    if (value === "--pool") {
      const pool = String(argv[index + 1] || "").trim().toLowerCase();
      if (pool) {
        options.pools.push(pool);
      }
      index += 1;
      continue;
    }

    options.pools.push(value);
  }

  options.pools = Array.from(new Set(options.pools.filter(Boolean)));
  return options;
}

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

const options = parseArgs(process.argv.slice(2));
const candidatesData = await loadJson(candidatesPath);
const mapData = await loadJson(mapPath);
const candidates = Array.isArray(candidatesData.candidates) ? candidatesData.candidates : [];
const mappings = Array.isArray(mapData.mappings) ? mapData.mappings : [];
const mappedHandles = new Set(mappings.map((entry) => normalizeHandle(entry.handle)).filter(Boolean));

let handles = candidates
  .filter((candidate) => candidate && candidate.approved !== false)
  .filter((candidate) => !options.pools.length || options.pools.includes(String(candidate.pool || "").trim().toLowerCase()))
  .map((candidate) => normalizeHandle(candidate.handle))
  .filter((handle) => mappedHandles.has(handle));

handles = Array.from(new Set(handles));

if (!handles.length) {
  throw new Error("No mapped Product Hunt handles matched the requested pools.");
}

console.log(`Syncing mapped Product Hunt handles: ${handles.length}`);
if (options.pools.length) {
  console.log(`Pools: ${options.pools.join(", ")}`);
}

const result = await syncProjectsFromProductHunt(getDb(), {
  handles,
  mapPath,
});

console.log(`Snapshot: ${result.snapshotDate}`);
console.log(`Imported Product Hunt projects: ${result.importedProjects}`);
console.log(`Mapped handles: ${result.mappedHandles.join(", ")}`);
if (result.mappedLaunchHandles.length) {
  console.log(`Handles with imported mapped launches: ${result.mappedLaunchHandles.join(", ")}`);
}
if (result.unmatchedHandles.length) {
  console.log(`Still unmatched: ${result.unmatchedHandles.join(", ")}`);
}
console.log(`Contenders: ${result.rankings.counts.contenders}`);
console.log(`Rookies: ${result.rankings.counts.rookies}`);
