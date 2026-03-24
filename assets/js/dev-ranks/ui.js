const CATEGORY_META = {
  legend: {
    label: "Legend",
    sectionLabel: "Legends",
    toneClass: "is-legend",
    eyebrow: "Established names",
    copy: "Well-known indie developers with proven product output, reach, and a long shipping history.",
  },
  contender: {
    label: "Contender",
    sectionLabel: "Contenders",
    toneClass: "is-contender",
    eyebrow: "Rising fast",
    copy: "Indie developers pairing recent launches with strong engagement, consistency, and visibility.",
  },
  rookie: {
    label: "Rookie",
    sectionLabel: "Rookies",
    toneClass: "is-rookie",
    eyebrow: "Early but high signal",
    copy: "Low-follower accounts already shipping real products and looking stronger than their audience size.",
  },
};

const SCORE_EXPLAINERS = {
  legend:
    "Score blends shipping, reach, reaction volume, consistency, per-post engagement quality, and 7-day momentum. Legends lean most on shipping and reach, and established audiences add a small legacy bonus.",
  contender:
    "Score blends shipping, reach, reaction volume, consistency, per-post engagement quality, and 7-day momentum. Contenders lean most on shipping, while consistency and engagement quality matter more than raw reach.",
  rookie:
    "Score blends shipping, reaction volume, consistency, per-post engagement quality, and 7-day momentum. Reach is intentionally left out so smaller accounts can still break through on product output and signal quality.",
};

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatNumber(value) {
  return new Intl.NumberFormat("en-GB").format(Math.round(Number(value) || 0));
}

export function formatCompactNumber(value) {
  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
}

export function formatScore(value) {
  return (Math.round((Number(value) || 0) * 10) / 10).toFixed(1);
}

export function formatPercentRatio(value) {
  return `${(Math.round((Number(value) || 0) * 1000) / 10).toFixed(1)}%`;
}

export function formatSignedPercent(value) {
  const amount = Math.round((Number(value) || 0) * 10) / 10;
  if (amount > 0) {
    return `+${amount.toFixed(1)}%`;
  }
  return `${amount.toFixed(1)}%`;
}

export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function renderAvatar(dev, sizeClass) {
  return `
    <span class="avatar-badge ${escapeHtml(sizeClass || "h-11 w-11")} shrink-0 rounded-2xl overflow-hidden">
      <img src="${escapeHtml(dev.avatarUrl)}" alt="${escapeHtml(dev.displayName)} avatar" class="avatar-badge__image" />
    </span>
  `;
}

function renderCategoryBadge(category) {
  const meta = CATEGORY_META[category] || CATEGORY_META.rookie;
  return `<span class="indie-category-badge ${meta.toneClass}">${meta.label}</span>`;
}

function renderMovementPill(movement) {
  const delta = movement && typeof movement.delta === "number" ? movement.delta : 0;
  const label = movement && movement.label ? movement.label : "-";
  const toneClass = delta > 0 ? "is-up" : delta < 0 ? "is-down" : "is-flat";
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "•";

  return `
    <span class="indie-movement ${toneClass}">
      <span class="indie-movement__arrow" aria-hidden="true">${arrow}</span>
      <span>${escapeHtml(label)}</span>
    </span>
  `;
}

function renderRankBadge(rank) {
  const podiumMedal = {
    1: "🥇",
    2: "🥈",
    3: "🥉",
  }[rank];

  if (podiumMedal) {
    return `
      <span class="indie-rank-chip indie-rank-chip--podium">
        <span class="indie-rank-chip__medal" aria-hidden="true">${podiumMedal}</span>
        <span>${rank}</span>
      </span>
    `;
  }

  return `<span class="indie-rank-chip">${rank}</span>`;
}

function formatProductSummary(productSignals) {
  const signals = productSignals || {};
  return {
    primary: `${formatNumber(signals.productsShipped)} shipped`,
    secondary: `${formatNumber(signals.activeProducts)} live now`,
  };
}

function formatEngagementSummary(metrics) {
  return {
    primary: formatPercentRatio(metrics.engagementRate),
    secondary: "avg per-post engagement",
  };
}

function formatCadenceSummary(metrics) {
  return {
    primary: `${formatNumber(metrics.postsLast7d)} posts this week`,
    secondary: `${formatNumber(metrics.repliesLast7d)} replies this week`,
  };
}

function renderMetricSummary(primary, secondary) {
  return `
    <span class="indie-dev-row__value">${escapeHtml(primary)}</span>
    ${secondary ? `<span class="indie-dev-row__subvalue">${escapeHtml(secondary)}</span>` : ""}
  `;
}

function getScoreExplainer(category) {
  return SCORE_EXPLAINERS[category] || SCORE_EXPLAINERS.rookie;
}

function renderLeaderboardRow(dev) {
  const productSummary = formatProductSummary(dev.productSignals);
  const engagementSummary = formatEngagementSummary(dev.metrics);
  const cadenceSummary = formatCadenceSummary(dev.metrics);

  return `
    <a href="/dev.html?handle=${encodeURIComponent(dev.handle)}" class="indie-dev-row ${dev.rank <= 3 ? "indie-dev-row--podium" : ""}">
      <div class="indie-dev-row__rank">
        ${renderRankBadge(dev.rank)}
      </div>
      <div class="indie-dev-row__identity">
        ${renderAvatar(dev, "h-12 w-12")}
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="indie-dev-row__name">@${escapeHtml(dev.handle)}</span>
          </div>
          <p class="indie-dev-row__bio">${escapeHtml(dev.bio)}</p>
        </div>
      </div>
      <div class="indie-dev-row__metric">
        <span class="indie-mobile-label">Category</span>
        ${renderCategoryBadge(dev.overallCategory)}
      </div>
      <div class="indie-dev-row__metric">
        <span class="indie-mobile-label">Score</span>
        <span class="indie-dev-row__value">${escapeHtml(formatScore(dev.totalScore))}</span>
      </div>
      <div class="indie-dev-row__metric">
        <span class="indie-mobile-label">Shipping</span>
        ${renderMetricSummary(productSummary.primary, productSummary.secondary)}
      </div>
      <div class="indie-dev-row__metric">
        <span class="indie-mobile-label">Engagement</span>
        ${renderMetricSummary(engagementSummary.primary, engagementSummary.secondary)}
      </div>
      <div class="indie-dev-row__metric">
        <span class="indie-mobile-label">Activity</span>
        ${renderMetricSummary(cadenceSummary.primary, cadenceSummary.secondary)}
      </div>
      <div class="indie-dev-row__metric">
        <span class="indie-mobile-label">Move</span>
        ${renderMovementPill(dev.movement)}
      </div>
    </a>
  `;
}

export function renderLeaderboardSection(category, items) {
  const meta = CATEGORY_META[category] || CATEGORY_META.rookie;
  const scoreExplainer = getScoreExplainer(category);

  return `
    <section class="panel leaderboard-panel indie-section indie-section--${escapeHtml(category)} rounded-[2rem] p-5 sm:p-6">
      <div class="indie-section__header">
        <div>
          <p class="indie-hand-note indie-section__eyebrow">${escapeHtml(meta.eyebrow)}</p>
          <h2 class="indie-section__title">${escapeHtml(meta.sectionLabel)}</h2>
          <p class="indie-section__copy">${escapeHtml(meta.copy)}</p>
          <p class="indie-section__score-note"><strong>How scoring works:</strong> ${escapeHtml(scoreExplainer)}</p>
        </div>
        <div class="indie-section__meta">
          ${renderCategoryBadge(category)}
          <span class="indie-section__count">${escapeHtml(formatNumber(items.length))} ranked</span>
        </div>
      </div>
      <div class="indie-dev-table-head">
        <span>Rank</span>
        <span>Who</span>
        <span>Bucket</span>
        <span>Score</span>
        <span>Shipping</span>
        <span>Engagement</span>
        <span>Activity</span>
        <span>Move</span>
      </div>
      <div class="indie-dev-table-body mt-2">
        ${items.map((item) => renderLeaderboardRow(item)).join("")}
      </div>
    </section>
  `;
}

export function renderSearchResults(results, query) {
  if (!query) {
    return "";
  }

  if (!results.length) {
    return `
      <div class="indie-search-results panel rounded-[1.5rem] p-4">
        <p class="text-sm text-[var(--leaderboard-copy)]">No builders matched "${escapeHtml(query)}" yet.</p>
      </div>
    `;
  }

  return `
    <div class="indie-search-results panel rounded-[1.5rem] p-3">
      <div class="mb-2 flex items-center justify-between gap-3 px-2 py-1">
        <p class="indie-note-label">Quick matches</p>
        <p class="text-xs text-[var(--leaderboard-label)]">${escapeHtml(formatNumber(results.length))} result${results.length === 1 ? "" : "s"}</p>
      </div>
      <div class="space-y-2">
        ${results
          .map(
            (dev) => `
              <a href="/dev.html?handle=${encodeURIComponent(dev.handle)}" class="indie-search-result">
                ${renderAvatar(dev, "h-10 w-10")}
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="indie-search-result__name">@${escapeHtml(dev.handle)}</span>
                    ${renderCategoryBadge(dev.overallCategory)}
                  </div>
                  <p class="indie-search-result__bio">${escapeHtml(dev.bio)}</p>
                </div>
                <span class="indie-search-result__score">${escapeHtml(formatScore(dev.totalScore))}</span>
              </a>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderBreakdownItems(items) {
  return items
    .map(
      (item) => `
        <div class="profile-breakdown-item">
          <div>
            <p class="profile-breakdown-item__label">${escapeHtml(item.label)}</p>
            <p class="profile-breakdown-item__meta">raw ${escapeHtml(formatScore(item.raw))} x ${escapeHtml(formatScore(item.weight))}</p>
          </div>
          <span class="profile-breakdown-item__value">${escapeHtml(formatScore(item.contribution))}</span>
        </div>
      `
    )
    .join("");
}

function renderNearbyPeers(dev, peers) {
  if (!peers.length) {
    return `<p class="text-sm text-[var(--leaderboard-copy)]">No nearby peers yet.</p>`;
  }

  return `
    <div class="space-y-2">
      ${peers
        .map(
          (peer) => `
            <a href="/dev.html?handle=${encodeURIComponent(peer.handle)}" class="profile-peer">
              <div class="flex items-center gap-3 min-w-0">
                <span class="indie-rank-chip">${peer.rank}</span>
                <div class="min-w-0">
                  <p class="profile-peer__name">${escapeHtml(peer.displayName)}</p>
                  <p class="profile-peer__meta">@${escapeHtml(peer.handle)}</p>
                </div>
              </div>
              <span class="profile-peer__score">${escapeHtml(formatScore(peer.totalScore))}</span>
            </a>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTopPosts(topPosts) {
  if (!topPosts.length) {
    return `<p class="text-sm text-[var(--leaderboard-copy)]">Mock top posts will appear here once the X layer is connected.</p>`;
  }

  return `
    <div class="space-y-3">
      ${topPosts
        .map(
          (post) => `
            <a href="${escapeHtml(post.url)}" target="_blank" rel="noreferrer" class="profile-post">
              <div class="flex items-center justify-between gap-3">
                <span class="profile-post__time">${escapeHtml(formatDate(post.postedAt))}</span>
                <span class="profile-post__metrics">${escapeHtml(formatCompactNumber(post.likes))} likes</span>
              </div>
              <p class="profile-post__body">${escapeHtml(post.text)}</p>
              <div class="profile-post__engagement">
                <span>${escapeHtml(formatCompactNumber(post.likes))} likes</span>
                <span>${escapeHtml(formatCompactNumber(post.replies))} replies</span>
                <span>${escapeHtml(formatCompactNumber(post.reposts))} reposts</span>
                <span>${escapeHtml(formatCompactNumber(post.quotes))} quotes</span>
              </div>
            </a>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderProfile(viewModel, topPosts) {
  const { dev, nearbyPeers } = viewModel;
  const scoreBreakdown = dev.scoreBreakdowns[dev.overallCategory] || [];
  const scoreExplainer = getScoreExplainer(dev.overallCategory);
  const engagementSummary = formatEngagementSummary(dev.metrics);
  const cadenceSummary = formatCadenceSummary(dev.metrics);

  return `
    <section class="panel leaderboard-panel profile-hero rounded-[2rem] p-6 sm:p-8">
      <div class="profile-hero__grid">
        <div>
          <a href="/index.html" class="chip-link inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm">
            Back home
          </a>
          <div class="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
            ${renderAvatar(dev, "h-24 w-24")}
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-3">
                <h1 class="text-4xl font-semibold tracking-tight text-[var(--leaderboard-title)] sm:text-5xl">${escapeHtml(dev.displayName)}</h1>
                ${renderCategoryBadge(dev.overallCategory)}
              </div>
              <p class="mt-2 text-lg text-[var(--leaderboard-copy)]">@${escapeHtml(dev.handle)}</p>
              <p class="mt-4 max-w-2xl text-base leading-7 text-[var(--leaderboard-copy)]">${escapeHtml(dev.bio)}</p>
              <div class="mt-5 flex flex-wrap items-center gap-3">
                <a href="https://x.com/${encodeURIComponent(dev.handle)}" target="_blank" rel="noreferrer" class="theme-cta inline-flex rounded-full px-5 py-3 text-sm font-medium">
                  See X profile
                </a>
                ${
                  dev.website
                    ? `<a href="${escapeHtml(dev.website)}" target="_blank" rel="noreferrer" class="chip-link inline-flex rounded-full px-5 py-3 text-sm">Website</a>`
                    : ""
                }
              </div>
            </div>
          </div>
        </div>
        <div class="profile-stat-grid">
          <div class="profile-stat">
            <p class="profile-stat__label">Current rank</p>
            <p class="profile-stat__value">#${escapeHtml(formatNumber(dev.rank))}</p>
          </div>
          <div class="profile-stat">
            <p class="profile-stat__label">Total score</p>
            <p class="profile-stat__value">${escapeHtml(formatScore(dev.totalScore))}</p>
          </div>
          <div class="profile-stat">
            <p class="profile-stat__label">Followers</p>
            <p class="profile-stat__value">${escapeHtml(formatCompactNumber(dev.followers))}</p>
          </div>
          <div class="profile-stat">
            <p class="profile-stat__label">Movement</p>
            <div class="mt-3">${renderMovementPill(dev.movement)}</div>
          </div>
        </div>
      </div>
    </section>

    <section class="profile-grid mt-6">
      <article class="panel rounded-[1.75rem] p-6">
        <p class="indie-note-label">Score breakdown</p>
        <h2 class="mt-3 text-2xl font-semibold tracking-tight text-[var(--leaderboard-title)]">${escapeHtml(CATEGORY_META[dev.overallCategory].label)} score</h2>
        <p class="mt-3 text-sm leading-6 text-[var(--leaderboard-copy)]">${escapeHtml(scoreExplainer)}</p>
        <div class="mt-5 space-y-3">
          ${renderBreakdownItems(scoreBreakdown)}
        </div>
      </article>

      <article class="panel rounded-[1.75rem] p-6">
        <p class="indie-note-label">Build signal</p>
        <h2 class="mt-3 text-2xl font-semibold tracking-tight text-[var(--leaderboard-title)]">What they actually ship</h2>
        <p class="mt-3 text-sm leading-6 text-[var(--leaderboard-copy)]">The board now looks at shipped product output as well as audience performance, so builders are rewarded for what they make, not just how loudly they post.</p>
        <div class="mt-5 space-y-4">
          <div class="profile-signal-card">
            <span class="profile-signal-card__label">Products shipped</span>
            <span class="profile-signal-card__value">${escapeHtml(formatNumber(dev.productSignals.productsShipped))}</span>
          </div>
          <div class="profile-signal-card">
            <span class="profile-signal-card__label">Still live</span>
            <span class="profile-signal-card__value">${escapeHtml(formatNumber(dev.productSignals.activeProducts))}</span>
          </div>
          <div class="profile-signal-card">
            <span class="profile-signal-card__label">Launches last 12m</span>
            <span class="profile-signal-card__value">${escapeHtml(formatNumber(dev.productSignals.launchesLast12m))}</span>
          </div>
          <div class="profile-signal-card">
            <span class="profile-signal-card__label">Product impact</span>
            <span class="profile-signal-card__value">${escapeHtml(formatScore(dev.productSignals.productImpactScore))}</span>
          </div>
          <div class="profile-signal-card">
            <span class="profile-signal-card__label">Momentum 7d</span>
            <span class="profile-signal-card__value">${escapeHtml(formatSignedPercent(dev.metrics.momentum7d))}</span>
          </div>
          <div class="profile-signal-card">
            <span class="profile-signal-card__label">Per-post engagement</span>
            <span class="profile-signal-card__value">${escapeHtml(engagementSummary.primary)} average rate</span>
          </div>
          <div class="profile-signal-card">
            <span class="profile-signal-card__label">Posts last 7 days</span>
            <span class="profile-signal-card__value">${escapeHtml(cadenceSummary.primary)}</span>
          </div>
          <div class="profile-signal-card">
            <span class="profile-signal-card__label">Replies last 7 days</span>
            <span class="profile-signal-card__value">${escapeHtml(cadenceSummary.secondary)}</span>
          </div>
        </div>
      </article>

      <article class="panel rounded-[1.75rem] p-6">
        <p class="indie-note-label">Top posts this week</p>
        <h2 class="mt-3 text-2xl font-semibold tracking-tight text-[var(--leaderboard-title)]">Mock X highlights</h2>
        <p class="mt-3 text-sm leading-6 text-[var(--leaderboard-copy)]">Served through the placeholder X service layer so it can be swapped for the real API later.</p>
        <div class="mt-5">
          ${renderTopPosts(topPosts)}
        </div>
      </article>

      <article class="panel rounded-[1.75rem] p-6">
        <p class="indie-note-label">Nearby in ${escapeHtml(CATEGORY_META[dev.overallCategory].sectionLabel)}</p>
        <h2 class="mt-3 text-2xl font-semibold tracking-tight text-[var(--leaderboard-title)]">Who sits around them</h2>
        <div class="mt-5">
          ${renderNearbyPeers(dev, nearbyPeers)}
        </div>
      </article>
    </section>
  `;
}

export function renderHomeSkeleton() {
  return `
    <div class="space-y-6">
      ${Array.from({ length: 3 })
        .map(
          () => `
            <section class="panel leaderboard-panel indie-section rounded-[2rem] p-6">
              <div class="skeleton h-4 w-24 rounded-full"></div>
              <div class="mt-4 skeleton h-11 w-52 rounded-[0.9rem]"></div>
              <div class="mt-3 skeleton h-4 w-full max-w-[26rem] rounded-full"></div>
              <div class="mt-8 space-y-0">
                ${Array.from({ length: 4 })
                  .map(
                    () => `
                      <div class="border-t border-[var(--leaderboard-line)] py-4 first:border-t-0 first:pt-0">
                        <div class="skeleton h-14 rounded-[1rem]"></div>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </section>
          `
        )
        .join("")}
    </div>
  `;
}

export function renderProfileSkeleton() {
  return `
    <section class="panel rounded-[2rem] p-6">
      <div class="skeleton h-8 w-32 rounded-full"></div>
      <div class="mt-6 skeleton h-24 rounded-[1.5rem]"></div>
    </section>
    <section class="mt-6 grid gap-6 lg:grid-cols-2">
      <div class="panel rounded-[1.75rem] p-6">
        <div class="skeleton h-8 w-44 rounded-full"></div>
        <div class="mt-5 space-y-3">
          ${Array.from({ length: 5 })
            .map(() => `<div class="skeleton h-14 rounded-[1rem]"></div>`)
            .join("")}
        </div>
      </div>
      <div class="panel rounded-[1.75rem] p-6">
        <div class="skeleton h-8 w-44 rounded-full"></div>
        <div class="mt-5 space-y-3">
          ${Array.from({ length: 5 })
            .map(() => `<div class="skeleton h-14 rounded-[1rem]"></div>`)
            .join("")}
        </div>
      </div>
    </section>
  `;
}

export function renderProfileEmpty(handle) {
  return `
    <section class="panel rounded-[2rem] p-8 text-center">
      <p class="indie-note-label">Profile missing</p>
      <h1 class="mt-3 text-3xl font-semibold tracking-tight text-[var(--leaderboard-title)]">No dev found for @${escapeHtml(handle || "unknown")}</h1>
      <p class="mt-4 text-[var(--leaderboard-copy)]">Try another handle from the homepage leaderboard or search results.</p>
      <a href="/index.html" class="theme-cta mt-6 inline-flex rounded-full px-5 py-3 text-sm font-medium">Back home</a>
    </section>
  `;
}
