const X_API_BASE_URL = "https://api.x.com/2";
const DEFAULT_TIMELINE_PAGE_SIZE = 100;
const DEFAULT_TIMELINE_MAX_PAGES = 10;

function getBearerToken() {
  const token = process.env.X_BEARER_TOKEN || process.env.TWITTER_BEARER_TOKEN || "";
  if (!token) {
    throw new Error("Missing X bearer token. Set X_BEARER_TOKEN or TWITTER_BEARER_TOKEN.");
  }
  return token;
}

function chunk(values = [], size = 100) {
  const items = Array.isArray(values) ? values.filter(Boolean) : [];
  const groups = [];

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }

  return groups;
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(toNumber(value, minimum), minimum), maximum);
}

function getTime(value) {
  const date = new Date(value);
  const time = date.getTime();
  return Number.isFinite(time) ? time : 0;
}

async function requestX(pathname, searchParams = {}) {
  const url = new URL(`${X_API_BASE_URL}${pathname}`);

  Object.entries(searchParams).forEach(([key, value]) => {
    if (value == null || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${getBearerToken()}`,
      Accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail =
      payload &&
      (payload.detail ||
        payload.title ||
        payload.error ||
        (Array.isArray(payload.errors) && payload.errors[0] && payload.errors[0].message));
    throw new Error(`X API request failed (${response.status}) for ${pathname}${detail ? `: ${detail}` : ""}`);
  }

  return payload;
}

async function lookupSingleUserByUsername(username) {
  try {
    const payload = await requestX(`/users/by/username/${encodeURIComponent(username)}`, {
      "user.fields": "created_at,description,profile_image_url,public_metrics,url,username,name",
    });

    return payload && payload.data ? payload.data : null;
  } catch (error) {
    const message = String(error && error.message || "");
    if (
      message.includes("(404)") ||
      message.includes("(400)") ||
      /not found/i.test(message) ||
      /user.*invalid/i.test(message)
    ) {
      return null;
    }

    throw error;
  }
}

export async function lookupUsersByUsernames(usernames = []) {
  const usersByHandle = new Map();
  const requestedHandles = Array.from(
    new Set(
      (usernames || [])
        .map((value) => String(value || "").trim().toLowerCase().replace(/^@+/, ""))
        .filter(Boolean)
    )
  );

  for (const group of chunk(requestedHandles, 100)) {
    const payload = await requestX("/users/by", {
      usernames: group.join(","),
      "user.fields": "created_at,description,profile_image_url,public_metrics,url,username,name",
    });

    (payload.data || []).forEach((user) => {
      const handle = String(user.username || "").trim().toLowerCase();
      if (handle) {
        usersByHandle.set(handle, user);
      }
    });

    const groupMissingHandles = group.filter((handle) => !usersByHandle.has(handle));
    for (const handle of groupMissingHandles) {
      const user = await lookupSingleUserByUsername(handle);
      if (user && user.username) {
        usersByHandle.set(String(user.username).trim().toLowerCase(), user);
      }
    }
  }

  const missingHandles = requestedHandles.filter((handle) => !usersByHandle.has(handle));

  return {
    usersByHandle,
    missingHandles,
  };
}

export async function getTweetsByUserId(userId, options = {}) {
  const stopAtTime = options.stopAt ? getTime(options.stopAt) : 0;
  const maxResults = clamp(options.maxResults || DEFAULT_TIMELINE_PAGE_SIZE, 5, 100);
  const maxPages = clamp(options.maxPages || DEFAULT_TIMELINE_MAX_PAGES, 1, 50);
  const tweets = [];
  let paginationToken = "";
  let pagesFetched = 0;
  let truncated = false;

  while (pagesFetched < maxPages) {
    const payload = await requestX(`/users/${encodeURIComponent(userId)}/tweets`, {
      max_results: maxResults,
      pagination_token: paginationToken || undefined,
      exclude: "retweets",
      "tweet.fields": "created_at,public_metrics,in_reply_to_user_id,referenced_tweets,text",
    });
    const pageTweets = Array.isArray(payload.data) ? payload.data : [];
    const nextToken = String(payload.meta && payload.meta.next_token || "").trim();

    tweets.push(...pageTweets);
    pagesFetched += 1;

    const oldestTweet = pageTweets.length ? pageTweets[pageTweets.length - 1] : null;
    const coveredStopAt = stopAtTime > 0 && oldestTweet && getTime(oldestTweet.created_at) <= stopAtTime;

    if (!nextToken || coveredStopAt) {
      break;
    }

    paginationToken = nextToken;
  }

  if (paginationToken && pagesFetched >= maxPages) {
    truncated = true;
  }

  const filteredTweets = stopAtTime > 0
    ? tweets.filter((tweet) => getTime(tweet.created_at) >= stopAtTime)
    : tweets;

  if (options.includeMeta) {
    return {
      tweets: filteredTweets,
      pagesFetched,
      truncated,
      fetchedTweets: filteredTweets.length,
    };
  }

  return filteredTweets;
}

export async function getXUsage(options = {}) {
  const usageFields = Array.isArray(options.fields) && options.fields.length
    ? options.fields.join(",")
    : "cap_reset_day,project_cap,project_id,project_usage";
  const payload = await requestX("/usage/tweets", {
    days: clamp(options.days || 30, 1, 90),
    "usage.fields": usageFields,
  });
  const data = payload.data || {};

  return {
    capResetDay: data.cap_reset_day ?? null,
    projectCap: toNumber(data.project_cap),
    projectId: data.project_id || "",
    projectUsage: toNumber(data.project_usage),
    dailyProjectUsage: Array.isArray(data.daily_project_usage && data.daily_project_usage.usage)
      ? data.daily_project_usage.usage
      : [],
    raw: data,
  };
}
