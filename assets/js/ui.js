(function () {
  var IndieRanks = (window.IndieRanks = window.IndieRanks || {});

  var METRIC_META = {
    mrr: {
      label: "MRR",
      timeframeLabels: {
        today: "MRR",
        week: "MRR",
        month: "MRR",
        allTime: "MRR",
      },
      multipliers: {
        today: 1,
        week: 1,
        month: 1,
        allTime: 1,
      },
    },
    users: {
      label: "Users",
      timeframeLabels: {
        today: "daily users",
        week: "weekly users",
        month: "monthly users",
        allTime: "users",
      },
      multipliers: {
        today: 0.045,
        week: 0.16,
        month: 0.42,
        allTime: 1,
      },
    },
    downloads: {
      label: "Downloads",
      timeframeLabels: {
        today: "daily downloads",
        week: "weekly downloads",
        month: "monthly downloads",
        allTime: "downloads",
      },
      multipliers: {
        today: 0.06,
        week: 0.21,
        month: 0.58,
        allTime: 1,
      },
    },
    githubStars: {
      label: "GitHub Stars",
      timeframeLabels: {
        today: "new GitHub stars",
        week: "GitHub stars this week",
        month: "GitHub stars this month",
        allTime: "GitHub stars",
      },
      multipliers: {
        today: 0.012,
        week: 0.065,
        month: 0.27,
        allTime: 1,
      },
    },
  };

  var TIMEFRAME_META = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    allTime: "All Time",
  };

  var MRR_BRACKETS = [
    { value: "all", label: "All", min: -Infinity, max: Infinity },
    { value: "under-100", label: "<$100", min: 0, max: 100 },
    { value: "100-1000", label: "$100–$1k", min: 100, max: 1000 },
    { value: "1000-5000", label: "$1k–$5k", min: 1000, max: 5000 },
    { value: "5000-20000", label: "$5k–$20k", min: 5000, max: 20000 },
  ];

  var LEADERBOARD_SORT_OPTIONS = [
    {
      value: "mrr",
      label: "MRR",
      tooltip: "Ranks projects by current monthly recurring revenue, highest first.",
    },
    {
      value: "trending",
      label: "Trending",
      tooltip: "Ranked by momentum — combines growth rate, absolute MRR increase, and recency. Updated daily.",
    },
    { value: "newest", label: "Newest" },
    { value: "users", label: "User Count" },
    {
      value: "churn",
      label: "Churn Rate",
      tooltip: "Will rank projects by lowest customer churn rate once this metric launches.",
    },
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeMetricKey(value) {
    if (!value) {
      return "mrr";
    }

    if (METRIC_META[value]) {
      return value;
    }

    var key = String(value).toLowerCase().replace(/[^a-z]/g, "");
    if (key.indexOf("mrr") >= 0) {
      return "mrr";
    }
    if (key.indexOf("user") >= 0) {
      return "users";
    }
    if (key.indexOf("download") >= 0) {
      return "downloads";
    }
    if (key.indexOf("github") >= 0 || key.indexOf("star") >= 0) {
      return "githubStars";
    }

    return "mrr";
  }

  function normalizeTimeframe(value) {
    if (TIMEFRAME_META[value]) {
      return value;
    }

    var key = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
    if (key.indexOf("today") >= 0) {
      return "today";
    }
    if (key.indexOf("week") >= 0) {
      return "week";
    }
    if (key.indexOf("month") >= 0) {
      return "month";
    }

    return "allTime";
  }

  function normalizeSortMode(value) {
    var match = LEADERBOARD_SORT_OPTIONS.find(function (option) {
      return option.value === value;
    });

    if (match) {
      return match.value;
    }

    var key = String(value || "").toLowerCase().replace(/[^a-z]/g, "");
    if (key.indexOf("mrr") >= 0) {
      return "mrr";
    }
    if (key.indexOf("user") >= 0) {
      return "users";
    }
    if (key.indexOf("churn") >= 0) {
      return "churn";
    }
    if (key.indexOf("new") >= 0) {
      return "newest";
    }

    return "trending";
  }

  function normalizeMrrBracket(value) {
    var match = MRR_BRACKETS.find(function (bracket) {
      return bracket.value === value;
    });

    if (match) {
      return match.value;
    }

    return "all";
  }

  function getMrrBracketMeta(value) {
    var normalized = normalizeMrrBracket(value);
    return (
      MRR_BRACKETS.find(function (bracket) {
        return bracket.value === normalized;
      }) || MRR_BRACKETS[0]
    );
  }

  function getMrrBracketOptions() {
    return MRR_BRACKETS.map(function (bracket) {
      return {
        value: bracket.value,
        label: bracket.label,
      };
    });
  }

  function getLeaderboardSortOptions() {
    return LEADERBOARD_SORT_OPTIONS.map(function (option) {
      return {
        value: option.value,
        label: option.label,
        tooltip: option.tooltip || "",
      };
    });
  }

  function getLeaderboardSortOptionMeta(value) {
    var normalized = normalizeSortMode(value);
    return (
      LEADERBOARD_SORT_OPTIONS.find(function (option) {
        return option.value === normalized;
      }) || LEADERBOARD_SORT_OPTIONS[0]
    );
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-GB").format(Math.round(Number(value) || 0));
  }

  function formatCompactNumber(value) {
    return new Intl.NumberFormat("en-GB", {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: 1,
    }).format(Number(value) || 0);
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: value >= 1000 ? 0 : 0,
    }).format(Number(value) || 0);
  }

  function getNumericGrowthPercent(value) {
    if (typeof value === "string") {
      var normalized = value.replace(/,/g, "").replace(/%/g, "").trim();
      var parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function formatPercent(value, withSign) {
    var number = getNumericGrowthPercent(value);
    var rounded = Math.round(number * 10) / 10;
    if (withSign && rounded > 0) {
      return "+" + rounded + "%";
    }
    return rounded + "%";
  }

  function relativeDate(value) {
    if (!value) {
      return "just now";
    }

    var diff = Date.now() - new Date(value).getTime();
    var days = Math.max(0, Math.floor(diff / 86400000));

    if (days === 0) {
      return "today";
    }
    if (days === 1) {
      return "1 day ago";
    }
    if (days < 7) {
      return days + " days ago";
    }
    if (days < 30) {
      return Math.floor(days / 7) + " weeks ago";
    }
    return Math.floor(days / 30) + " months ago";
  }

  function getInitials(name) {
    return String(name || "IR")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function (part) {
        return part.charAt(0).toUpperCase();
      })
      .join("");
  }

  function renderInitialsBadge(name, sizeClass, imageUrl) {
    if (imageUrl) {
      return (
        '<div class="avatar-badge ' +
        escapeHtml(sizeClass || "h-10 w-10") +
        ' shrink-0 rounded-2xl overflow-hidden">' +
        '<img src="' + escapeHtml(imageUrl) + '" alt="" class="avatar-badge__image">' +
        "</div>"
      );
    }

    return (
      '<div class="avatar-badge ' +
      escapeHtml(sizeClass || "h-10 w-10") +
      ' shrink-0 rounded-2xl text-white/80">' +
      escapeHtml(getInitials(name)) +
      "</div>"
    );
  }

  function growthTone(value) {
    var growth = getNumericGrowthPercent(value);
    if (growth > 0) {
      return "up";
    }
    if (growth < 0) {
      return "down";
    }
    return "flat";
  }

  function renderBadge(text, tone) {
    if (!text) {
      return "";
    }

    var toneClass = tone || "flat";
    return (
      '<span class="metric-pill ' +
      escapeHtml(toneClass) +
      ' inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.18em]">' +
      escapeHtml(text) +
      "</span>"
    );
  }

  function renderGrowthText(value, theme) {
    var number = getNumericGrowthPercent(value);
    var tone = growthTone(number);
    var className =
      tone === "up"
        ? "text-emerald-500"
        : tone === "down"
          ? "text-rose-500"
          : theme === "light"
            ? "text-slate-500"
            : "text-white/42";
    var prefix = number > 0 ? "+" : "";

    return (
      '<span class="font-mono text-sm ' +
      className +
      '">' +
      escapeHtml(prefix + formatPercent(number, false)) +
      "</span>"
    );
  }

  function getProjectCreatedAt(project) {
    var timestamp = new Date(project && project.createdAt).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function getProjectMrr(project) {
    var primaryMetric = normalizeMetricKey(project && (project.metricType || project.primaryMetricKey));

    if (primaryMetric === "mrr") {
      return Math.max(0, Number(project && project.metricValue) || 0);
    }

    return Math.max(0, Number(project && project.metrics && project.metrics.mrr) || 0);
  }

  function getProjectUsers(project) {
    return Math.max(0, Number(project && project.metrics && project.metrics.users) || 0);
  }

  function getProjectChurnRate(project) {
    var candidates = [
      project && project.churnRate,
      project && project.churn,
      project && project.monthlyChurnRate,
      project && project.metrics && project.metrics.churnRate,
      project && project.metrics && project.metrics.churn,
      project && project.metrics && project.metrics.monthlyChurnRate,
    ];

    for (var index = 0; index < candidates.length; index += 1) {
      var value = candidates[index];
      if (value == null || value === "") {
        continue;
      }

      var parsed = getNumericGrowthPercent(value);
      if (Number.isFinite(parsed)) {
        return Math.max(0, parsed);
      }
    }

    return 0;
  }

  function getProjectTrendingScore(project) {
    var growthPercent = getNumericGrowthPercent(project && project.growthPercent);
    var mrr = getProjectMrr(project);
    var createdAt = getProjectCreatedAt(project);
    var ageDays = createdAt ? Math.max(0, (Date.now() - createdAt) / 86400000) : 365;
    var tinyWinsCount = Math.min(
      5,
      Array.isArray(project && project.tinyWins) ? project.tinyWins.length : 0
    );

    var growthScore = growthPercent;
    var scaleScore = Math.log10(mrr + 1) * 20;
    var recencyScore = (30 / (ageDays + 30)) * 20;
    var tinyWinsScore = tinyWinsCount * 5;

    return (
      growthScore * 0.5 +
      scaleScore * 0.25 +
      recencyScore * 0.15 +
      tinyWinsScore * 0.1
    );
  }

  function getProjectMrrBracket(project) {
    var mrr = getProjectMrr(project);
    var matchedBracket = MRR_BRACKETS.slice(1).find(function (bracket) {
      return mrr >= bracket.min && mrr < bracket.max;
    });

    return matchedBracket ? matchedBracket.value : "all";
  }

  function matchesMrrBracket(project, bracketKey) {
    var normalized = normalizeMrrBracket(bracketKey);

    if (normalized === "all") {
      return true;
    }

    return getProjectMrrBracket(project) === normalized;
  }

  function getProjectBadges(project) {
    var badges = [];
    var age = Date.now() - getProjectCreatedAt(project);

    if (age >= 0 && age < 7 * 86400000) {
      badges.push({ label: "🚀 New", tone: "up" });
    }

    if (getProjectMrr(project) < 100) {
      badges.push({ label: "💰 First $", tone: "flat" });
    }

    if (getNumericGrowthPercent(project && project.growthPercent) > 20) {
      badges.push({ label: "📈 Growing", tone: "up" });
    }

    return badges;
  }

  function renderLeaderboardBadge(badge) {
    if (!badge || !badge.label) {
      return "";
    }

    return (
      '<span class="leaderboard-inline-badge' +
      (badge.tone === "up" ? " up" : "") +
      '">' +
      escapeHtml(badge.label) +
      "</span>"
    );
  }

  function renderProjectBadges(project) {
    return getProjectBadges(project)
      .map(function (badge) {
        return renderLeaderboardBadge(badge);
      })
      .join("");
  }

  function getMetricValue(project, metricKey, timeframe) {
    var normalizedKey = normalizeMetricKey(metricKey);
    var normalizedTimeframe = normalizeTimeframe(timeframe);
    var meta = METRIC_META[normalizedKey];
    var baseValue = Number(project.metrics && project.metrics[normalizedKey]) || 0;
    var multiplier = meta.multipliers[normalizedTimeframe];
    var momentum = Number(project.momentum) || 1;

    if (normalizedTimeframe === "allTime" || normalizedKey === "mrr") {
      return Math.max(0, Math.round(baseValue));
    }

    return Math.max(0, Math.round(baseValue * multiplier * momentum));
  }

  function getGrowthValue(project, timeframe) {
    var normalizedTimeframe = normalizeTimeframe(timeframe);
    var base = getNumericGrowthPercent(project.growthPercent);
    var multiplier = {
      today: 0.3,
      week: 0.6,
      month: 1,
      allTime: 1.35,
    }[normalizedTimeframe];

    return Math.round(base * multiplier * 10) / 10;
  }

  function formatMetric(metricKey, value, timeframe) {
    var normalizedKey = normalizeMetricKey(metricKey);
    var normalizedTimeframe = normalizeTimeframe(timeframe);
    var meta = METRIC_META[normalizedKey];
    var safeValue = Number(value) || 0;

    if (normalizedKey === "mrr") {
      return formatCurrency(safeValue) + " " + meta.timeframeLabels[normalizedTimeframe];
    }

    return formatNumber(safeValue) + " " + meta.timeframeLabels[normalizedTimeframe];
  }

  function getDisplayMetric(project, metricKey, timeframe) {
    var normalizedKey = normalizeMetricKey(metricKey);
    var normalizedTimeframe = normalizeTimeframe(timeframe);
    var value = getMetricValue(project, normalizedKey, normalizedTimeframe);
    return {
      key: normalizedKey,
      value: value,
      label: formatMetric(normalizedKey, value, normalizedTimeframe),
      shortLabel: METRIC_META[normalizedKey].label,
    };
  }

  function searchProjects(projects, query) {
    var term = String(query || "").trim().toLowerCase();
    if (!term) {
      return projects.slice();
    }

    return projects.filter(function (project) {
      return [project.name, project.category, project.founderName, project.tagline]
        .join(" ")
        .toLowerCase()
        .indexOf(term) >= 0;
    });
  }

  function filterAndSortProjects(projects, state) {
    var list = searchProjects(projects, state.query);
    var bracket = normalizeMrrBracket(state && state.bracket);
    var sortMode = normalizeSortMode(state && state.sort);
    var metricKey = normalizeMetricKey(state.metric);
    var timeframe = normalizeTimeframe(state.timeframe);

    if (state && state.onlyMyBracket !== false && bracket !== "all") {
      list = list.filter(function (project) {
        return matchesMrrBracket(project, bracket);
      });
    }

    if (state && state.sort) {
      return list.sort(function (left, right) {
        if (sortMode === "mrr") {
          var mrrDelta = getProjectMrr(right) - getProjectMrr(left);
          if (mrrDelta !== 0) {
            return mrrDelta;
          }
        } else if (sortMode === "users") {
          var usersDelta = getProjectUsers(right) - getProjectUsers(left);
          if (usersDelta !== 0) {
            return usersDelta;
          }
        } else if (sortMode === "churn") {
          var churnDelta = getProjectChurnRate(left) - getProjectChurnRate(right);
          if (churnDelta !== 0) {
            return churnDelta;
          }
        } else if (sortMode === "newest") {
          var createdDelta = getProjectCreatedAt(right) - getProjectCreatedAt(left);
          if (createdDelta !== 0) {
            return createdDelta;
          }
        } else {
          var trendingDelta = getProjectTrendingScore(right) - getProjectTrendingScore(left);
          if (trendingDelta !== 0) {
            return trendingDelta;
          }
        }

        var tieGrowth = getNumericGrowthPercent(right.growthPercent) - getNumericGrowthPercent(left.growthPercent);
        if (tieGrowth !== 0) {
          return tieGrowth;
        }

        var tieMrr = getProjectMrr(right) - getProjectMrr(left);
        if (tieMrr !== 0) {
          return tieMrr;
        }

        var tieCreated = getProjectCreatedAt(right) - getProjectCreatedAt(left);
        if (tieCreated !== 0) {
          return tieCreated;
        }

        return left.name.localeCompare(right.name);
      });
    }

    return list.sort(function (left, right) {
      var rightMetric = getMetricValue(right, metricKey, timeframe);
      var leftMetric = getMetricValue(left, metricKey, timeframe);
      if (rightMetric !== leftMetric) {
        return rightMetric - leftMetric;
      }

      var growthDelta = getGrowthValue(right, timeframe) - getGrowthValue(left, timeframe);
      if (growthDelta !== 0) {
        return growthDelta;
      }

      return left.name.localeCompare(right.name);
    });
  }

  function getTopBadge(project) {
    if (project.highlightBadge) {
      return project.highlightBadge;
    }
    if (project.tinyWins && project.tinyWins.length > 0) {
      return project.tinyWins[0].label.toUpperCase();
    }
    return "";
  }

  function renderProjectCard(project) {
    var displayMetric = getDisplayMetric(project, project.primaryMetricKey, project.primaryMetricKey === "mrr" ? "allTime" : "month");
    var badge = getTopBadge(project);

    return (
      '<article class="panel panel-hover rounded-3xl p-5">' +
      '<div class="flex items-start justify-between gap-4">' +
      '<div class="flex items-start gap-3">' +
      renderInitialsBadge(project.name, "h-11 w-11", project.logoUrl) +
      '<div class="space-y-1">' +
      '<div class="flex flex-wrap items-center gap-2">' +
      '<a href="./project.html?id=' +
      encodeURIComponent(project.slug) +
      '" class="text-lg font-semibold tracking-tight text-white hover:text-accent">' +
      escapeHtml(project.name) +
      "</a>" +
      renderBadge(badge, badge.indexOf("FIRST") >= 0 || badge.indexOf("NEW") >= 0 ? "up" : "flat") +
      "</div>" +
      '<p class="text-sm text-white/60">' +
      escapeHtml(project.category) +
      "</p>" +
      "</div>" +
      "</div>" +
      '<span class="text-xs font-mono uppercase tracking-[0.18em] text-white/40">' +
      escapeHtml(relativeDate(project.createdAt)) +
      "</span>" +
      "</div>" +
      '<p class="mt-4 text-sm leading-6 text-white/70">' +
      escapeHtml(project.tagline) +
      "</p>" +
      '<div class="mt-5 flex items-center justify-between gap-4 text-sm">' +
      '<a href="./founder.html?id=' +
      encodeURIComponent(project.founderSlug) +
      '" class="font-medium text-white/75 hover:text-white">' +
      escapeHtml(project.founderName) +
      "</a>" +
      '<div class="flex items-center gap-2">' +
      '<span class="font-mono text-white">' +
      escapeHtml(displayMetric.label) +
      "</span>" +
      renderBadge(formatPercent(project.growthPercent, true), growthTone(project.growthPercent)) +
      "</div>" +
      "</div>" +
      "</article>"
    );
  }

  function renderTinyWinCard(win) {
    var badgeTone = win.badge === "NEW" ? "up" : "flat";
    return (
      '<article class="panel panel-hover rounded-3xl p-5">' +
      '<div class="flex items-center justify-between gap-3">' +
      '<span class="text-xs font-mono uppercase tracking-[0.18em] text-white/45">' +
      escapeHtml(relativeDate(win.date)) +
      "</span>" +
      renderBadge(win.badge || win.label, badgeTone) +
      "</div>" +
      '<div class="mt-4 space-y-2">' +
      '<a href="./project.html?id=' +
      encodeURIComponent(win.projectSlug) +
      '" class="text-lg font-semibold tracking-tight text-white hover:text-accent">' +
      escapeHtml(win.projectName) +
      "</a>" +
      '<p class="text-sm font-mono uppercase tracking-[0.16em] text-white/50">' +
      escapeHtml(win.category) +
      "</p>" +
      '<p class="text-sm leading-6 text-white/72">' +
      escapeHtml(win.note || win.label) +
      "</p>" +
      "</div>" +
      '<div class="mt-5 flex items-center justify-between gap-3 text-sm">' +
      '<span class="text-white">' +
      escapeHtml(win.label) +
      "</span>" +
      '<a href="./founder.html?id=' +
      encodeURIComponent(win.founderSlug) +
      '" class="text-white/65 hover:text-white">' +
      escapeHtml(win.founderName) +
      "</a>" +
      "</div>" +
      "</article>"
    );
  }

  function renderLeaderboardRows(projects, options) {
    var config = options || {};
    var metricKey = normalizeMetricKey(config.metric || "mrr");
    var timeframe = normalizeTimeframe(config.timeframe || "allTime");
    var limit = Number(config.limit) || projects.length;
    var isLight = config.theme === "light";
    var items = projects.slice(0, limit);

    if (!items.length) {
      return (
        '<div class="empty-panel rounded-3xl px-6 py-10 text-center ' +
        (isLight ? "text-slate-600" : "text-white/60") +
        '">' +
        escapeHtml(config.emptyMessage || "No projects match this filter yet.") +
        "</div>"
      );
    }

    return items
      .map(function (project, index) {
        var rank = index + 1;
        var displayMetric = getDisplayMetric(project, metricKey, timeframe);
        var growth = getGrowthValue(project, timeframe);
        var badges = renderProjectBadges(project);
        var isTopProject = !!config.highlightTop && rank <= 3;
        var medalClass = rank <= 3 ? " top-" + rank : "";
        var medalEmoji = {
          1: "🥇",
          2: "🥈",
          3: "🥉",
        }[rank] || "";
        var rankNode =
          rank <= 3
            ? '<span class="medal-rank' + medalClass + '">' + escapeHtml(String(rank)) + "</span>"
            : '<span class="leaderboard-rank-muted inline-flex h-9 w-9 items-center justify-center font-mono text-xs ' +
              (isLight ? "text-slate-500" : "text-white/48") +
              '">' +
              escapeHtml(String(rank)) +
              "</span>";

        return (
          '<div class="leaderboard-row grid gap-4 border-t py-4 md:grid-cols-[64px,1.9fr,1.2fr,1fr,120px] md:items-center ' +
          (isLight ? "border-slate-200/90" : "border-white/5") +
          " " +
          (index === 0 ? " border-t-0" : "") +
          (isTopProject ? " leaderboard-row-top" : "") +
          '">' +
          '<div class="flex items-center">' +
          rankNode +
          "</div>" +
          '<div class="flex items-start gap-3 min-w-0">' +
          renderInitialsBadge(project.name, "h-10 w-10", project.logoUrl) +
          '<div class="min-w-0">' +
          '<div class="flex flex-wrap items-center gap-2">' +
          '<a href="./project.html?id=' +
          encodeURIComponent(project.slug) +
          '" class="truncate text-[15px] font-semibold ' +
          (isLight ? "text-slate-900 hover:text-slate-700" : "text-white hover:text-white/80") +
          '">' +
          escapeHtml(project.name) +
          "</a>" +
          (isTopProject ? '<span class="leaderboard-medal" aria-hidden="true">' + escapeHtml(medalEmoji) + "</span>" : "") +
          badges +
          (project.verified
            ? '<span class="leaderboard-meta-label ' +
              (isLight ? "text-slate-400" : "text-white/32") +
              '">Verified</span>'
            : "") +
          "</div>" +
          '<p class="mt-1 truncate text-[13px] ' +
          (isLight ? "text-slate-500" : "text-white/42") +
          '">' +
          escapeHtml(project.tagline) +
          "</p>" +
          "</div>" +
          "</div>" +
          '<div class="flex items-center gap-3">' +
          renderInitialsBadge(project.founderName, "h-8 w-8") +
          '<div class="min-w-0">' +
          '<a href="./founder.html?id=' +
          encodeURIComponent(project.founderSlug) +
          '" class="block truncate text-sm ' +
          (isLight ? "text-slate-700 hover:text-slate-900" : "text-white/78 hover:text-white") +
          '">' +
          escapeHtml(project.founderName) +
          "</a>" +
          '<span class="leaderboard-meta-label text-xs ' +
          (isLight ? "text-slate-400" : "text-white/40") +
          '">' +
          escapeHtml(project.category) +
          "</span>" +
          "</div>" +
          "</div>" +
          '<div class="flex items-center justify-between gap-3 md:block md:text-right">' +
          '<span class="text-[10px] font-mono uppercase tracking-[0.2em] ' +
          (isLight ? "text-slate-400" : "text-white/40") +
          ' md:hidden">' +
          escapeHtml(displayMetric.shortLabel) +
          "</span>" +
          '<span class="block font-mono text-sm ' +
          (isLight ? "text-slate-900" : "text-white") +
          '">' +
          escapeHtml(displayMetric.label) +
          "</span>" +
          "</div>" +
          '<div class="flex items-center justify-between gap-3 md:justify-end">' +
          '<span class="text-[10px] font-mono uppercase tracking-[0.2em] ' +
          (isLight ? "text-slate-400" : "text-white/40") +
          ' md:hidden">Growth</span>' +
          renderGrowthText(growth, config.theme) +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderLeaderboardHeader(metricKey, timeframe, theme) {
    var isLight = theme === "light";
    return (
      '<div class="leaderboard-head hidden items-center gap-4 border-b pb-4 text-[11px] uppercase tracking-[0.12em] md:grid md:grid-cols-[64px,1.9fr,1.2fr,1fr,120px] ' +
      (isLight ? "border-slate-200 text-slate-400" : "border-transparent text-white/32") +
      '">' +
      "<span>Rank</span>" +
      "<span>Project</span>" +
      "<span>Founder</span>" +
      "<span>" +
      escapeHtml(METRIC_META[normalizeMetricKey(metricKey)].label) +
      "</span>" +
      "<span>Growth</span>" +
      "</div>"
    );
  }

  function renderStatsCards(stats) {
    var items = [
      { label: "Projects tracked", value: stats.trackedProjects },
      { label: "Founders mapped", value: stats.trackedFounders },
      { label: "Verified metrics", value: stats.verifiedMetrics },
      { label: "Tiny wins this week", value: stats.tinyWinsThisWeek },
    ];

    return items
      .map(function (item) {
        return (
          '<div class="stat-card rounded-3xl px-5 py-5">' +
          '<p class="text-2xl font-semibold tracking-tight text-white sm:text-3xl">' +
          escapeHtml(formatNumber(item.value)) +
          "</p>" +
          '<p class="mt-2 text-sm text-white/55">' +
          escapeHtml(item.label) +
          "</p>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderSelectOptions(items, selectedValue) {
    return items
      .map(function (item) {
        return (
          '<option value="' +
          escapeHtml(item.value) +
          '"' +
          (item.value === selectedValue ? " selected" : "") +
          ">" +
          escapeHtml(item.label) +
          "</option>"
        );
      })
      .join("");
  }

  function drawSparkline(canvas, points, tone) {
    if (!canvas || !canvas.getContext) {
      return;
    }

    var context = canvas.getContext("2d");
    var width = canvas.clientWidth;
    var height = canvas.clientHeight;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    context.scale(dpr, dpr);
    context.clearRect(0, 0, width, height);

    var safePoints = Array.isArray(points) && points.length ? points : [2, 3, 4, 5, 6];
    var min = Math.min.apply(null, safePoints);
    var max = Math.max.apply(null, safePoints);
    var range = Math.max(max - min, 1);
    var padding = 12;
    var color = tone === "down" ? "rgba(251, 113, 133, 0.9)" : "rgba(110, 231, 183, 0.95)";
    var fill = tone === "down" ? "rgba(251, 113, 133, 0.1)" : "rgba(110, 231, 183, 0.12)";

    context.beginPath();
    safePoints.forEach(function (point, index) {
      var x = padding + (index / (safePoints.length - 1 || 1)) * (width - padding * 2);
      var y = height - padding - ((point - min) / range) * (height - padding * 2);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.lineWidth = 2;
    context.strokeStyle = color;
    context.stroke();

    context.lineTo(width - padding, height - padding);
    context.lineTo(padding, height - padding);
    context.closePath();
    context.fillStyle = fill;
    context.fill();

    context.beginPath();
    safePoints.forEach(function (point, index) {
      var x = padding + (index / (safePoints.length - 1 || 1)) * (width - padding * 2);
      var y = height - padding - ((point - min) / range) * (height - padding * 2);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });
    context.lineWidth = 2;
    context.strokeStyle = color;
    context.stroke();

    var lastX = padding + (width - padding * 2);
    var lastY = height - padding - ((safePoints[safePoints.length - 1] - min) / range) * (height - padding * 2);
    context.beginPath();
    context.arc(lastX, lastY, 3.5, 0, Math.PI * 2);
    context.fillStyle = color;
    context.fill();
  }

  function buildLeaderboardSkeleton(rows, theme) {
    var count = rows || 6;
    var isLight = theme === "light";
    var output = [];
    for (var index = 0; index < count; index += 1) {
      output.push(
        '<div class="grid gap-4 border-t py-4 md:grid-cols-[64px,1.9fr,1.2fr,1fr,120px] md:items-center ' +
          (isLight ? "border-slate-200/90" : "border-white/5") +
          (index === 0 ? " border-t-0" : "") +
          '">' +
          '<div class="skeleton h-8 rounded-full"></div>' +
          '<div class="skeleton h-12 rounded-2xl"></div>' +
          '<div class="skeleton h-10 rounded-2xl"></div>' +
          '<div class="skeleton h-8 rounded-2xl"></div>' +
          '<div class="skeleton h-8 rounded-2xl"></div>' +
          "</div>"
      );
    }
    return output.join("");
  }

  IndieRanks.ui = {
    metricMeta: METRIC_META,
    timeframeMeta: TIMEFRAME_META,
    escapeHtml: escapeHtml,
    normalizeMetricKey: normalizeMetricKey,
    normalizeTimeframe: normalizeTimeframe,
    normalizeSortMode: normalizeSortMode,
    normalizeMrrBracket: normalizeMrrBracket,
    formatNumber: formatNumber,
    formatCompactNumber: formatCompactNumber,
    formatCurrency: formatCurrency,
    formatPercent: formatPercent,
    relativeDate: relativeDate,
    getMrrBracketOptions: getMrrBracketOptions,
    getLeaderboardSortOptions: getLeaderboardSortOptions,
    getLeaderboardSortOptionMeta: getLeaderboardSortOptionMeta,
    getMrrBracketLabel: function (value) {
      return getMrrBracketMeta(value).label;
    },
    renderBadge: renderBadge,
    renderInitialsBadge: renderInitialsBadge,
    getDisplayMetric: getDisplayMetric,
    getMetricValue: getMetricValue,
    getGrowthValue: getGrowthValue,
    getNumericGrowthPercent: getNumericGrowthPercent,
    getProjectMrr: getProjectMrr,
    getProjectUsers: getProjectUsers,
    getProjectChurnRate: getProjectChurnRate,
    getProjectTrendingScore: getProjectTrendingScore,
    searchProjects: searchProjects,
    filterAndSortProjects: filterAndSortProjects,
    renderProjectCard: renderProjectCard,
    renderTinyWinCard: renderTinyWinCard,
    renderLeaderboardRows: renderLeaderboardRows,
    renderLeaderboardHeader: renderLeaderboardHeader,
    renderStatsCards: renderStatsCards,
    renderSelectOptions: renderSelectOptions,
    drawSparkline: drawSparkline,
    buildLeaderboardSkeleton: buildLeaderboardSkeleton,
    getInitials: getInitials,
    renderGrowthText: renderGrowthText,
  };
})();
