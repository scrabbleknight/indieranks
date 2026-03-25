const PRODUCT_HUNT_GRAPHQL_URL = "https://api.producthunt.com/v2/api/graphql";
const PRODUCT_HUNT_TOKEN_URL = "https://api.producthunt.com/v2/oauth/token";
const DEFAULT_POSTED_AFTER = "2013-01-01T00:00:00.000Z";
const DEFAULT_PAGE_SIZE = 50;
const DEFAULT_MAX_PAGES = 500;
const DEFAULT_MAX_RETRIES = 4;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(toNumber(value, minimum), minimum), maximum);
}

function readEnv(...names) {
  for (const name of names) {
    const value = String(process.env[name] || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function getRetryDelayMilliseconds(response, attempt) {
  const retryAfterSeconds = Number(response.headers.get("retry-after"));
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return retryAfterSeconds * 1000;
  }

  return Math.min(15000, 1000 * 2 ** Math.max(0, attempt - 1));
}

async function requestClientCredentialsToken() {
  const clientId = readEnv("PRODUCT_HUNT_CLIENT_ID", "PH_CLIENT_ID");
  const clientSecret = readEnv("PRODUCT_HUNT_CLIENT_SECRET", "PH_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Product Hunt credentials. Set PRODUCT_HUNT_BEARER_TOKEN or PRODUCT_HUNT_CLIENT_ID and PRODUCT_HUNT_CLIENT_SECRET."
    );
  }

  const response = await fetch(PRODUCT_HUNT_TOKEN_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    payload = null;
  }

  if (!response.ok || !payload || !payload.access_token) {
    const message =
      payload && payload.error_description
        ? payload.error_description
        : payload && payload.error
          ? payload.error
          : "Product Hunt token request failed.";
    throw new Error(message);
  }

  return payload.access_token;
}

export async function getProductHuntAccessToken() {
  const directToken = readEnv("PRODUCT_HUNT_BEARER_TOKEN", "PRODUCT_HUNT_ACCESS_TOKEN", "PH_BEARER_TOKEN");
  if (directToken) {
    return directToken;
  }

  return requestClientCredentialsToken();
}

export async function runProductHuntGraphQL(query, variables = {}, accessToken, options = {}) {
  const token = accessToken || (await getProductHuntAccessToken());
  const maxRetries = clamp(options.maxRetries || DEFAULT_MAX_RETRIES, 0, 10);

  for (let attempt = 1; attempt <= maxRetries + 1; attempt += 1) {
    const response = await fetch(PRODUCT_HUNT_GRAPHQL_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch (error) {
      payload = null;
    }

    if (response.ok) {
      if (!payload || Array.isArray(payload.errors) && payload.errors.length) {
        const message = payload && payload.errors && payload.errors[0] ? payload.errors[0].message : "Product Hunt returned an unknown GraphQL error.";
        throw new Error(message);
      }

      return payload.data || {};
    }

    const shouldRetry = (response.status === 429 || response.status >= 500) && attempt <= maxRetries;
    if (shouldRetry) {
      await delay(getRetryDelayMilliseconds(response, attempt));
      continue;
    }

    const message =
      payload && Array.isArray(payload.errors) && payload.errors[0] && payload.errors[0].message
        ? payload.errors[0].message
        : `Product Hunt API request failed with ${response.status}.`;
    throw new Error(message);
  }

  throw new Error("Product Hunt API request failed after retries.");
}

const POSTS_QUERY = `
  query ProductHuntPosts(
    $first: Int!
    $after: String
    $postedAfter: DateTime
    $postedBefore: DateTime
    $order: PostsOrder
  ) {
    posts(
      first: $first
      after: $after
      postedAfter: $postedAfter
      postedBefore: $postedBefore
      order: $order
    ) {
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        slug
        name
        tagline
        description
        createdAt
        featuredAt
        url
        website
        votesCount
        commentsCount
        reviewsCount
        reviewsRating
        dailyRank
        weeklyRank
        monthlyRank
        yearlyRank
        thumbnail {
          url
        }
        makers {
          id
          name
          username
          twitterUsername
          headline
          websiteUrl
          url
          isMaker
        }
      }
    }
  }
`;

const POST_QUERY = `
  query ProductHuntPost($slug: String!) {
    post(slug: $slug) {
      id
      slug
      name
      tagline
      description
      createdAt
      featuredAt
      url
      website
      votesCount
      commentsCount
      reviewsCount
      reviewsRating
      dailyRank
      weeklyRank
      monthlyRank
      yearlyRank
      thumbnail {
        url
      }
    }
  }
`;

export async function getProductHuntPostBySlug(slug, accessToken) {
  const normalizedSlug = String(slug || "").trim();
  if (!normalizedSlug) {
    throw new Error("Product Hunt post slug is required.");
  }

  const data = await runProductHuntGraphQL(
    POST_QUERY,
    {
      slug: normalizedSlug,
    },
    accessToken
  );

  return data.post || null;
}

export async function listProductHuntPosts(options = {}) {
  const accessToken = options.accessToken || (await getProductHuntAccessToken());
  const first = clamp(options.pageSize || options.first || DEFAULT_PAGE_SIZE, 1, 50);
  const maxPages = clamp(options.maxPages || DEFAULT_MAX_PAGES, 1, 5000);
  const postedAfter = options.postedAfter || DEFAULT_POSTED_AFTER;
  const postedBefore = options.postedBefore || new Date().toISOString();
  const order = options.order || "NEWEST";

  let after = null;
  let totalCount = 0;
  let pagesFetched = 0;
  let truncated = false;
  const posts = [];

  while (pagesFetched < maxPages) {
    const data = await runProductHuntGraphQL(
      POSTS_QUERY,
      {
        first,
        after,
        postedAfter,
        postedBefore,
        order,
      },
      accessToken
    );
    const connection = data.posts || {};
    const nodes = Array.isArray(connection.nodes) ? connection.nodes : [];
    const pageInfo = connection.pageInfo || {};

    posts.push(...nodes);
    totalCount = toNumber(connection.totalCount, totalCount);
    pagesFetched += 1;

    if (!pageInfo.hasNextPage || !pageInfo.endCursor) {
      return {
        posts,
        totalCount,
        pagesFetched,
        truncated,
      };
    }

    after = pageInfo.endCursor;
  }

  truncated = true;
  return {
    posts,
    totalCount,
    pagesFetched,
    truncated,
  };
}

export { DEFAULT_MAX_PAGES, DEFAULT_PAGE_SIZE, DEFAULT_POSTED_AFTER };
