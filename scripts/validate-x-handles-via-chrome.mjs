import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const candidatesPath = path.join(cwd, "data", "dev-candidates.json");

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
    handles: [],
    limit: 0,
    delaySeconds: 3,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--pool") {
      options.pools.push(String(argv[index + 1] || "").trim().toLowerCase());
      index += 1;
      continue;
    }

    if (value === "--limit") {
      options.limit = Math.max(0, Number(argv[index + 1]) || 0);
      index += 1;
      continue;
    }

    if (value === "--delay") {
      options.delaySeconds = Math.max(1, Number(argv[index + 1]) || 3);
      index += 1;
      continue;
    }

    options.handles.push(normalizeHandle(value));
  }

  options.pools = Array.from(new Set(options.pools.filter(Boolean)));
  options.handles = Array.from(new Set(options.handles.filter(Boolean)));
  return options;
}

async function loadCandidates() {
  const raw = JSON.parse(await readFile(candidatesPath, "utf8"));
  return Array.isArray(raw.candidates) ? raw.candidates : [];
}

function getTargets(candidates, options) {
  let rows = candidates.filter((candidate) => candidate && candidate.approved !== false);

  if (options.pools.length) {
    const poolSet = new Set(options.pools);
    rows = rows.filter((candidate) => poolSet.has(String(candidate.pool || "").trim().toLowerCase()));
  }

  if (options.handles.length) {
    const handleSet = new Set(options.handles);
    rows = rows.filter((candidate) => handleSet.has(normalizeHandle(candidate.handle)));
  }

  if (options.limit > 0) {
    rows = rows.slice(0, options.limit);
  }

  return rows.map((candidate) => ({
    handle: normalizeHandle(candidate.handle),
    pool: String(candidate.pool || "").trim().toLowerCase(),
  }));
}

function buildAppleScript(handle, delaySeconds) {
  return `
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then make new window
  set t to active tab of front window
  set URL of t to "https://x.com/${handle}"
  delay ${delaySeconds}
  tell t
    set pageTitle to execute javascript "document.title"
    set pageUrl to execute javascript "window.location.href"
    set bodyText to execute javascript "document.body ? document.body.innerText.slice(0,2500) : ''"
  end tell
  return pageTitle & "\\nURL: " & pageUrl & "\\n---\\n" & bodyText
end tell
`;
}

function probeHandle(handle, delaySeconds) {
  const result = spawnSync("osascript", ["-"], {
    input: buildAppleScript(handle, delaySeconds),
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 4,
  });

  if (result.status !== 0) {
    return {
      handle,
      status: "error",
      reason: (result.stderr || result.stdout || "").trim() || "osascript_failed",
    };
  }

  const raw = String(result.stdout || "");
  const title = raw.split("\n", 1)[0].trim();
  const urlMatch = raw.match(/^URL:\s*(.+)$/m);
  const pageUrl = String(urlMatch && urlMatch[1] ? urlMatch[1] : "").trim();
  const body = raw.includes("\n---\n") ? raw.split("\n---\n").slice(1).join("\n---\n") : "";
  const text = body.toLowerCase();

  if (text.includes("this account doesn’t exist") || text.includes("this account doesn't exist")) {
    return { handle, status: "missing", title, pageUrl };
  }

  if (title || body) {
    return { handle, status: "ok", title, pageUrl };
  }

  return { handle, status: "blank", title, pageUrl };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const candidates = await loadCandidates();
  const targets = getTargets(candidates, options);

  if (!targets.length) {
    console.log("No matching candidates found.");
    return;
  }

  const missing = [];
  const blank = [];
  const errors = [];

  for (const target of targets) {
    const result = probeHandle(target.handle, options.delaySeconds);
    console.log(`${target.pool || "candidate"} ${target.handle}: ${result.status}`);

    if (result.status === "missing") {
      missing.push(target.handle);
    } else if (result.status === "blank") {
      blank.push(target.handle);
    } else if (result.status === "error") {
      errors.push({ handle: target.handle, reason: result.reason });
    }
  }

  console.log("");
  console.log(`Checked: ${targets.length}`);
  console.log(`Missing: ${missing.length ? missing.join(", ") : "(none)"}`);
  console.log(`Blank: ${blank.length ? blank.join(", ") : "(none)"}`);

  if (errors.length) {
    console.log("Errors:");
    errors.forEach((entry) => {
      console.log(`- ${entry.handle}: ${entry.reason}`);
    });
  }
}

await main();
