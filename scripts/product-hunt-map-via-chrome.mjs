import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const candidatesPath = path.join(cwd, "data", "dev-candidates.json");
const mapPath = path.join(cwd, "data", "product-hunt-project-map.json");

function normalizeHandle(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "");
}

function parseArgs(argv) {
  const options = {
    write: false,
    delaySeconds: 5,
    limit: 0,
    pools: [],
    handles: [],
    onlyUnmapped: true,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--write") {
      options.write = true;
      continue;
    }

    if (value === "--delay") {
      options.delaySeconds = Math.max(1, Number(argv[index + 1]) || 5);
      index += 1;
      continue;
    }

    if (value === "--limit") {
      options.limit = Math.max(0, Number(argv[index + 1]) || 0);
      index += 1;
      continue;
    }

    if (value === "--pool") {
      options.pools.push(String(argv[index + 1] || "").trim().toLowerCase());
      index += 1;
      continue;
    }

    if (value === "--all") {
      options.onlyUnmapped = false;
      continue;
    }

    options.handles.push(value);
  }

  options.pools = Array.from(new Set(options.pools.filter(Boolean)));
  options.handles = Array.from(new Set(options.handles.map(normalizeHandle).filter(Boolean)));
  return options;
}

async function loadCandidates() {
  const raw = JSON.parse(await readFile(candidatesPath, "utf8"));
  return Array.isArray(raw.candidates) ? raw.candidates : [];
}

async function loadMap() {
  const raw = JSON.parse(await readFile(mapPath, "utf8"));
  return {
    updatedAt: String(raw.updatedAt || "").trim(),
    mappings: Array.isArray(raw.mappings) ? raw.mappings : [],
  };
}

function getTargets(candidates, mapData, options) {
  const mappedHandles = new Set(
    mapData.mappings
      .map((entry) => normalizeHandle(entry.handle))
      .filter(Boolean)
  );

  let rows = candidates.filter((candidate) => candidate && candidate.approved !== false);

  if (options.pools.length) {
    const poolSet = new Set(options.pools);
    rows = rows.filter((candidate) => poolSet.has(String(candidate.pool || "").trim().toLowerCase()));
  }

  if (options.handles.length) {
    const handleSet = new Set(options.handles);
    rows = rows.filter((candidate) => handleSet.has(normalizeHandle(candidate.handle)));
  }

  if (options.onlyUnmapped) {
    rows = rows.filter((candidate) => !mappedHandles.has(normalizeHandle(candidate.handle)));
  }

  if (options.limit > 0) {
    rows = rows.slice(0, options.limit);
  }

  return rows;
}

function buildAppleScript(handle, delaySeconds) {
  const url = `https://www.producthunt.com/@${handle}`;
  return `
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then make new window
  set t to active tab of front window
  set URL of t to "${url}"
  delay ${delaySeconds}
  tell t
    set pageTitle to execute javascript "document.title"
    set pageUrl to execute javascript "window.location.href"
    set bodyText to execute javascript "document.body ? document.body.innerText.slice(0,4000) : ''"
  end tell
  return pageTitle & "\\nURL: " & pageUrl & "\\n---\\n" & bodyText
end tell
`;
}

function buildUserSearchAppleScript(query, delaySeconds) {
  const encodedQuery = encodeURIComponent(String(query || "").trim());
  const url = `https://www.producthunt.com/search/users?q=${encodedQuery}`;
  return `
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then make new window
  set t to active tab of front window
  set URL of t to "${url}"
  delay ${delaySeconds}
  tell t
    set pageTitle to execute javascript "document.title"
    set pageUrl to execute javascript "window.location.href"
    set bodyText to execute javascript "document.body ? document.body.innerText.slice(0,5000) : ''"
    set hrefs to execute javascript "Array.from(document.querySelectorAll('a')).map((a) => { try { return a.href || ''; } catch (error) { return ''; } }).filter((href) => href.includes('/@')).join('\\n')"
  end tell
  return pageTitle & "\\nURL: " & pageUrl & "\\nHREFS:\\n" & hrefs & "\\n---\\n" & bodyText
end tell
`;
}

function buildXProfileAppleScript(handle, delaySeconds) {
  const url = `https://x.com/${handle}`;
  return `
tell application "Google Chrome"
  activate
  if (count of windows) = 0 then make new window
  set t to active tab of front window
  set URL of t to "${url}"
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
  const script = buildAppleScript(handle, delaySeconds);
  const result = spawnSync("osascript", ["-"], {
    input: script,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 4,
  });

  if (result.status !== 0) {
    return {
      handle,
      ok: false,
      reason: (result.stderr || result.stdout || "").trim() || "osascript_failed",
    };
  }

  return {
    handle,
    ok: true,
    raw: result.stdout || "",
  };
}

function probeUserSearch(query, delaySeconds) {
  const script = buildUserSearchAppleScript(query, delaySeconds);
  const result = spawnSync("osascript", ["-"], {
    input: script,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 4,
  });

  if (result.status !== 0) {
    return {
      query,
      ok: false,
      reason: (result.stderr || result.stdout || "").trim() || "osascript_failed",
    };
  }

  return {
    query,
    ok: true,
    raw: result.stdout || "",
  };
}

function probeXProfile(handle, delaySeconds) {
  const script = buildXProfileAppleScript(handle, delaySeconds);
  const result = spawnSync("osascript", ["-"], {
    input: script,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 4,
  });

  if (result.status !== 0) {
    return {
      handle,
      ok: false,
      reason: (result.stderr || result.stdout || "").trim() || "osascript_failed",
    };
  }

  return {
    handle,
    ok: true,
    raw: result.stdout || "",
  };
}

function parseProbeResult(result) {
  if (!result.ok) {
    return {
      handle: result.handle,
      found: false,
      reason: result.reason,
    };
  }

  const raw = String(result.raw || "");
  const [titleLine = ""] = raw.split("\n");
  const urlMatch = raw.match(/^URL:\s*(.+)$/m);
  const body = raw.includes("\n---\n") ? raw.split("\n---\n").slice(1).join("\n---\n") : "";
  const pageUrl = String(urlMatch && urlMatch[1] ? urlMatch[1] : "").trim();

  if (/Verifying you are human|Performing security verification|Just a moment/i.test(raw)) {
    return {
      handle: result.handle,
      found: false,
      reason: "challenge",
      title: titleLine,
      pageUrl,
    };
  }

  if (/We seem to have lost this page/i.test(body) || /\n404\n/i.test(body)) {
    return {
      handle: result.handle,
      found: false,
      reason: "not_found",
      title: titleLine,
      pageUrl,
    };
  }

  const profileTitleMatch = titleLine.match(/^(.*?)'s profile on Product Hunt \| Product Hunt$/i);
  if (!profileTitleMatch) {
    return {
      handle: result.handle,
      found: false,
      reason: "not_profile",
      title: titleLine,
      pageUrl,
    };
  }

  const usernameFromUrl = normalizeHandle(pageUrl.replace(/^https?:\/\/www\.producthunt\.com\/@/i, ""));
  const huntedMatch = body.match(/(\d+)\s+Hunted/i);
  const launchCount = huntedMatch ? Number(huntedMatch[1]) : 0;

  return {
    handle: result.handle,
    found: true,
    profileUsername: usernameFromUrl || result.handle,
    profileLaunchCount: Number.isFinite(launchCount) ? launchCount : 0,
    researchStatus: "verified_profile",
    title: titleLine,
    pageUrl,
  };
}

function parseUserSearchResult(result) {
  if (!result.ok) {
    return {
      query: result.query,
      found: false,
      reason: result.reason,
      usernames: [],
    };
  }

  const raw = String(result.raw || "");
  const [titleLine = ""] = raw.split("\n");
  const urlMatch = raw.match(/^URL:\s*(.+)$/m);
  const hrefSection = raw.includes("\nHREFS:\n") ? raw.split("\nHREFS:\n")[1].split("\n---\n")[0] : "";
  const body = raw.includes("\n---\n") ? raw.split("\n---\n").slice(1).join("\n---\n") : "";
  const pageUrl = String(urlMatch && urlMatch[1] ? urlMatch[1] : "").trim();

  if (/No users found for/i.test(body)) {
    return {
      query: result.query,
      found: false,
      reason: "no_users",
      title: titleLine,
      pageUrl,
      usernames: [],
    };
  }

  const usernames = Array.from(
    new Set(
      String(hrefSection || "")
        .split("\n")
        .map((href) => {
          const match = String(href || "").match(/producthunt\.com\/@([^/?#]+)/i);
          return normalizeHandle(match && match[1]);
        })
        .filter((username) => username && username !== "_arbio")
    )
  );

  return {
    query: result.query,
    found: usernames.length > 0,
    reason: usernames.length ? "" : "no_users",
    title: titleLine,
    pageUrl,
    usernames,
  };
}

function scoreCandidateUsername(query, username) {
  const normalizedQuery = normalizeHandle(query);
  const normalizedUsername = normalizeHandle(username);
  const looseQuery = normalizedQuery.replace(/_/g, "");
  const looseUsername = normalizedUsername.replace(/_/g, "");

  if (!normalizedQuery || !normalizedUsername) {
    return -999;
  }

  let score = 0;

  if (normalizedUsername === normalizedQuery) {
    score += 100;
  }
  if (looseUsername === looseQuery) {
    score += 80;
  }
  if (normalizedUsername.startsWith(normalizedQuery) || normalizedQuery.startsWith(normalizedUsername)) {
    score += 40;
  }
  if (looseUsername.includes(looseQuery) || looseQuery.includes(looseUsername)) {
    score += 20;
  }

  score -= Math.abs(normalizedUsername.length - normalizedQuery.length);
  return score;
}

function chooseBestUsername(query, usernames = []) {
  return (usernames || [])
    .map((username) => ({
      username,
      score: scoreCandidateUsername(query, username),
    }))
    .sort((left, right) => right.score - left.score || left.username.localeCompare(right.username))[0];
}

function extractDisplayNameFromX(raw) {
  const title = String(raw || "").split("\n", 1)[0].trim();
  const titleMatch = title.match(/^(.*?)\s+\(@[^)]+\)\s*\/\s*X$/i);
  if (!titleMatch) {
    return "";
  }

  return String(titleMatch[1] || "").trim();
}

function mergeMappings(existingMappings, discoveries) {
  const byHandle = new Map();

  for (const entry of existingMappings) {
    const normalized = normalizeHandle(entry.handle);
    if (!normalized) {
      continue;
    }
    byHandle.set(normalized, {
      handle: normalized,
      profileUsername: String(entry.profileUsername || "").trim(),
      profileLaunchCount: Math.max(0, Number(entry.profileLaunchCount) || 0),
      postSlugs: Array.isArray(entry.postSlugs) ? entry.postSlugs : [],
      researchStatus: String(entry.researchStatus || (entry.profileUsername ? "verified_profile" : "")).trim(),
      notes: String(entry.notes || "").trim(),
    });
  }

  for (const discovery of discoveries) {
    const normalized = normalizeHandle(discovery.handle);
    const existing = byHandle.get(normalized);
    byHandle.set(normalized, {
      handle: normalized,
      profileUsername: discovery.found ? discovery.profileUsername : "",
      profileLaunchCount: discovery.found ? discovery.profileLaunchCount : 0,
      postSlugs: existing && Array.isArray(existing.postSlugs) ? existing.postSlugs : [],
      researchStatus: discovery.found ? "verified_profile" : "none_found",
      notes: discovery.found
        ? `Profile count verified from public Product Hunt user profile via live Chrome session on ${new Date().toISOString().slice(0, 10)}.`
        : `No public Product Hunt user profile could be verified via direct handle and user-search lookup on ${new Date().toISOString().slice(0, 10)}.`,
    });
  }

  return Array.from(byHandle.values()).sort((left, right) => left.handle.localeCompare(right.handle));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const [candidates, mapData] = await Promise.all([
    loadCandidates(),
    loadMap(),
  ]);
  const targets = getTargets(candidates, mapData, options);

  console.log(`Targets: ${targets.length}`);
  if (!targets.length) {
    return;
  }

  const discoveries = [];

  for (let index = 0; index < targets.length; index += 1) {
    const candidate = targets[index];
    const handle = normalizeHandle(candidate.handle);
    console.log(`[${index + 1}/${targets.length}] probing @${handle}`);
    const rawResult = probeHandle(handle, options.delaySeconds);
    let parsed = parseProbeResult(rawResult);

    if (!parsed.found) {
      const searchResult = parseUserSearchResult(probeUserSearch(handle, options.delaySeconds));
      if (searchResult.usernames.length) {
        const match = chooseBestUsername(handle, searchResult.usernames);
        if (match && match.username) {
          const profileResult = parseProbeResult(probeHandle(match.username, options.delaySeconds));
          if (profileResult.found) {
            parsed = {
              ...profileResult,
              handle,
            };
          }
        }
      }
    }

    if (!parsed.found) {
      const xProfile = probeXProfile(handle, 3);
      const displayName = xProfile.ok ? extractDisplayNameFromX(xProfile.raw) : "";
      if (displayName) {
        const searchResult = parseUserSearchResult(probeUserSearch(displayName, options.delaySeconds));
        if (searchResult.usernames.length === 1) {
          const profileResult = parseProbeResult(probeHandle(searchResult.usernames[0], options.delaySeconds));
          if (profileResult.found) {
            parsed = {
              ...profileResult,
              handle,
            };
          }
        }
      }
    }

    if (!parsed.found) {
      parsed = {
        handle,
        found: false,
        reason: parsed.reason || "no_public_profile_found",
        researchStatus: "none_found",
      };
    }

    discoveries.push(parsed);

    if (parsed.found) {
      console.log(`  found -> @${parsed.profileUsername} (${parsed.profileLaunchCount} hunted)`);
    } else {
      console.log(`  none -> ${parsed.reason}`);
    }
  }

  const found = discoveries.filter((entry) => entry.found);
  const misses = discoveries.filter((entry) => !entry.found);

  console.log(`Found: ${found.length}`);
  console.log(`Misses: ${misses.length}`);

  if (options.write && discoveries.length) {
    const mergedMappings = mergeMappings(mapData.mappings, discoveries);
    await writeFile(
      mapPath,
      `${JSON.stringify(
        {
          updatedAt: new Date().toISOString(),
          mappings: mergedMappings,
        },
        null,
        2
      )}\n`,
      "utf8"
    );
    console.log(`Updated ${path.relative(cwd, mapPath)} with ${found.length} verified profile mapping(s) and ${misses.length} researched no-profile result(s).`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
