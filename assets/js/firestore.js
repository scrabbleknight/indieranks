(function () {
  var IndieRanks = (window.IndieRanks = window.IndieRanks || {});
  var LEADERBOARD_MAX_MRR = 20000;

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function coerceNumber(value) {
    if (typeof value === "string") {
      var normalized = value.replace(/[$,%\s]/g, "").replace(/,/g, "");
      var parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function normalizeXUsername(value) {
    var text = String(value || "").trim();
    if (!text) {
      return "";
    }

    text = text
      .replace(/^https?:\/\/(www\.)?(x|twitter)\.com\//i, "")
      .split(/[/?#]/)[0]
      .replace(/^@+/, "")
      .replace(/[^A-Za-z0-9_]/g, "");

    if (text.length > 15) {
      text = text.slice(0, 15);
    }

    return text;
  }

  function getProjectMrr(project) {
    return coerceNumber(project && project.metrics && project.metrics.mrr);
  }

  function isLeaderboardEligible(project) {
    return getProjectMrr(project) < LEADERBOARD_MAX_MRR;
  }

  function metricKeyFromType(metricType) {
    var value = String(metricType || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");

    if (!value) {
      return "mrr";
    }

    if (value.indexOf("mrr") >= 0) {
      return "mrr";
    }
    if (value.indexOf("user") >= 0) {
      return "users";
    }
    if (value.indexOf("download") >= 0) {
      return "downloads";
    }
    if (value.indexOf("github") >= 0 || value.indexOf("star") >= 0) {
      return "githubStars";
    }

    return "mrr";
  }

  function normalizePrimaryMetricKey(metricType) {
    var rawValue = String(metricType || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");

    if (rawValue.indexOf("launch") >= 0) {
      return "users";
    }

    var metricKey = metricKeyFromType(metricType);
    return metricKey;
  }

  function metricLabel(metricKey) {
    return {
      mrr: "MRR",
      users: "Users",
      downloads: "Downloads",
      githubStars: "GitHub Stars",
    }[metricKey] || "Metric";
  }

  function emptyMetrics() {
    return {
      mrr: 0,
      users: 0,
      downloads: 0,
      githubStars: 0,
    };
  }

  function verificationOptionsForMetric(metricType) {
    var metricKey = normalizePrimaryMetricKey(metricType);

    if (metricKey === "mrr") {
      return ["Stripe", "Lemon Squeezy", "RevenueCat"];
    }

    if (metricKey === "githubStars") {
      return ["GitHub"];
    }

    return ["GitHub", "Firebase / GA4"];
  }

  function normalizeVerificationType(metricType, verificationType) {
    var options = verificationOptionsForMetric(metricType);
    var current = String(verificationType || "").trim().toLowerCase();
    var exactMatch = options.find(function (item) {
      return item.toLowerCase() === current;
    });

    if (exactMatch) {
      return exactMatch;
    }

    if (current.indexOf("stripe") >= 0) {
      return "Stripe";
    }
    if (current.indexOf("lemon") >= 0) {
      return "Lemon Squeezy";
    }
    if (current.indexOf("revenuecat") >= 0 || current.indexOf("revenue cat") >= 0) {
      return "RevenueCat";
    }
    if (current.indexOf("firebase") >= 0 || current.indexOf("ga4") >= 0 || current.indexOf("analytic") >= 0) {
      return "Firebase / GA4";
    }
    if (current.indexOf("github") >= 0 || current.indexOf("star") >= 0) {
      return "GitHub";
    }

    return options[0];
  }

  function synthesizeMetrics(metricKey, metricValue, growthPercent) {
    var value = Math.max(coerceNumber(metricValue), 0);
    var growth = Math.abs(coerceNumber(growthPercent));
    var metrics = emptyMetrics();

    metrics[metricKey] = value;
    metrics.users =
      metricKey === "users" ? value : Math.max(40, Math.round(metricKey === "mrr" ? value * 0.42 : value * 0.72));
    metrics.downloads =
      metricKey === "downloads" ? value : Math.max(50, Math.round(metricKey === "githubStars" ? value * 5.5 : value * 1.4));
    metrics.githubStars =
      metricKey === "githubStars" ? value : Math.max(5, Math.round(Math.min(value * 0.08 + growth, 280)));
    metrics.mrr =
      metricKey === "mrr"
        ? value
        : Math.max(20, Math.round(metricKey === "users" ? value * 0.55 : metricKey === "downloads" ? value * 0.12 : value * 2.8));

    return metrics;
  }

  function normalizeMetrics(rawMetrics, metricType, metricValue, growthPercent) {
    var metricKey = normalizePrimaryMetricKey(metricType);
    var metrics = emptyMetrics();
    var hasRawMetrics = rawMetrics && typeof rawMetrics === "object";

    if (hasRawMetrics) {
      Object.keys(metrics).forEach(function (key) {
        metrics[key] = coerceNumber(rawMetrics[key]);
      });
    }

    if (Object.keys(metrics).every(function (key) { return metrics[key] === 0; })) {
      metrics = synthesizeMetrics(metricKey, metricValue, growthPercent);
    } else if (metricKey && metrics[metricKey] === 0 && coerceNumber(metricValue) > 0) {
      metrics[metricKey] = coerceNumber(metricValue);
    }

    return metrics;
  }

  function toIsoDate(value) {
    if (!value) {
      return new Date().toISOString();
    }
    if (typeof value === "string") {
      return value;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (value && typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }
    return new Date(value).toISOString();
  }

  function normalizeTinyWins(rawTinyWins) {
    if (!Array.isArray(rawTinyWins)) {
      return [];
    }

    return rawTinyWins
      .map(function (win, index) {
        if (typeof win === "string") {
          return {
            label: win,
            note: "",
            badge: "",
            date: toIsoDate(Date.now() - index * 86400000),
          };
        }

        return {
          label: win.label || "Small milestone",
          note: win.note || "",
          badge: win.badge || "",
          date: toIsoDate(win.date || Date.now() - index * 86400000),
        };
      })
      .sort(function (left, right) {
        return new Date(right.date).getTime() - new Date(left.date).getTime();
      });
  }

  function buildHistory(metrics, primaryMetricKey, growthPercent, existingHistory) {
    if (Array.isArray(existingHistory) && existingHistory.length >= 6) {
      return existingHistory.map(function (value) {
        return Math.max(1, coerceNumber(value));
      });
    }

    var base = Math.max(coerceNumber(metrics[primaryMetricKey]), 1);
    var series = [];
    var factor = 1 + coerceNumber(growthPercent) / 100;
    var start = base / Math.max(0.6, Math.min(1.45, factor || 1));

    for (var index = 0; index < 14; index += 1) {
      var progress = index / 13;
      var wobble = 1 + Math.sin(index * 1.1) * 0.05;
      series.push(Math.max(1, Math.round((start + (base - start) * progress) * wobble)));
    }

    return series;
  }

  function normalizeProject(rawProject) {
    var project = rawProject || {};
    var slug = project.slug || project.id || slugify(project.name || "untitled-project");
    var founderName = project.founderName || project.founder || "Anonymous builder";
    var founderSlug = project.founderSlug || slugify(founderName);
    var primaryMetricKey = normalizePrimaryMetricKey(project.primaryMetricKey || project.metricType);
    var growthPercent = coerceNumber(project.growthPercent);
    var metrics = normalizeMetrics(project.metrics || project.stats, primaryMetricKey, project.metricValue, growthPercent);

    if (!metrics[primaryMetricKey]) {
      primaryMetricKey = Object.keys(metrics).sort(function (left, right) {
        return metrics[right] - metrics[left];
      })[0] || "mrr";
    }

    return {
      slug: slug,
      name: project.name || "Untitled project",
      founderName: founderName,
      founderSlug: founderSlug,
      founderXUsername: normalizeXUsername(project.founderXUsername || project.xUsername),
      category: project.category || "SaaS",
      tagline: project.tagline || "Freshly listed indie project.",
      description: project.description || project.tagline || "Freshly listed indie project.",
      primaryMetricKey: primaryMetricKey,
      metricType: metricLabel(primaryMetricKey),
      metricValue: coerceNumber(project.metricValue || metrics[primaryMetricKey]),
      metricLabel: metricLabel(primaryMetricKey),
      growthPercent: growthPercent,
      timeframe: project.timeframe || "allTime",
      verificationType: normalizeVerificationType(primaryMetricKey, project.verificationType),
      verificationReference: String(project.verificationReference || "").trim(),
      verified: typeof project.verified === "boolean" ? project.verified : false,
      websiteUrl: project.websiteUrl || "#",
      logoUrl: project.logoUrl || "",
      createdAt: toIsoDate(project.createdAt),
      tinyWins: normalizeTinyWins(project.tinyWins),
      featured: !!project.featured,
      recent: !!project.recent,
      momentum: Math.max(0.82, Math.min(1.22, coerceNumber(project.momentum) || 1)),
      highlightBadge: project.highlightBadge || "",
      metrics: metrics,
      history: buildHistory(metrics, primaryMetricKey, growthPercent, project.history),
    };
  }

  function normalizeFounder(rawFounder) {
    var founder = rawFounder || {};
    return {
      slug: founder.slug || slugify(founder.name || "anonymous-builder"),
      name: founder.name || "Anonymous builder",
      bio: founder.bio || "Indie hacker building small software products with a tiny-team mindset.",
      xUsername: normalizeXUsername(founder.xUsername || founder.founderXUsername || founder.twitterUsername),
      avatarUrl: founder.avatarUrl || "",
      projectSlugs: Array.isArray(founder.projectSlugs) ? founder.projectSlugs : [],
      milestones: Array.isArray(founder.milestones) ? founder.milestones : [],
      createdAt: toIsoDate(founder.createdAt),
    };
  }

  function mergeProjects() {
    var map = {};

    Array.prototype.slice.call(arguments).forEach(function (list) {
      (list || []).forEach(function (project) {
        var normalized = normalizeProject(project);
        map[normalized.slug] = Object.assign({}, map[normalized.slug] || {}, normalized);
      });
    });

    return Object.keys(map)
      .map(function (slug) {
        return map[slug];
      })
      .sort(function (left, right) {
        var recent = new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        if (recent !== 0) {
          return recent;
        }

        var growthDelta = coerceNumber(right.growthPercent) - coerceNumber(left.growthPercent);
        if (growthDelta !== 0) {
          return growthDelta;
        }

        return getProjectMrr(right) - getProjectMrr(left);
      });
  }

  function deriveFounders(projects, founders) {
    var map = {};

    (founders || []).forEach(function (founder) {
      var normalized = normalizeFounder(founder);
      map[normalized.slug] = normalized;
    });

    (projects || []).forEach(function (project) {
      var slug = project.founderSlug;
      if (!map[slug]) {
        map[slug] = normalizeFounder({
          slug: slug,
          name: project.founderName,
          bio: "Indie hacker building small software products with a tiny-team mindset.",
          xUsername: project.founderXUsername,
          projectSlugs: [],
          milestones: [],
          createdAt: project.createdAt,
        });
      }

      map[slug].projectSlugs = Array.from(new Set(map[slug].projectSlugs.concat(project.slug)));
      map[slug].milestones = Array.from(
        new Set(
          map[slug].milestones.concat(
            project.tinyWins.slice(0, 3).map(function (win) {
              return win.label;
            })
          )
        )
      ).slice(0, 8);
    });

    return Object.keys(map)
      .map(function (slug) {
        return map[slug];
      })
      .sort(function (left, right) {
        return left.name.localeCompare(right.name);
      });
  }

  function deriveTinyWins(projects) {
    return (projects || [])
      .reduce(function (wins, project) {
        project.tinyWins.forEach(function (win) {
          wins.push({
            projectSlug: project.slug,
            projectName: project.name,
            founderName: project.founderName,
            founderSlug: project.founderSlug,
            category: project.category,
            label: win.label,
            note: win.note,
            badge: win.badge,
            date: win.date,
          });
        });
        return wins;
      }, [])
      .sort(function (left, right) {
        return new Date(right.date).getTime() - new Date(left.date).getTime();
      });
  }

  async function fetchCollection(name, limitValue) {
    var services = IndieRanks.getFirebaseServices ? IndieRanks.getFirebaseServices() : { db: null };
    if (!services.db) {
      return [];
    }

    try {
      var snapshot = await services.db.collection(name).limit(limitValue || 60).get();
      return snapshot.docs.map(function (doc) {
        return Object.assign({ id: doc.id }, doc.data());
      });
    } catch (error) {
      console.error("Failed to fetch collection", name, error);
      return [];
    }
  }

  async function fetchDocumentBySlug(name, slug) {
    var services = IndieRanks.getFirebaseServices ? IndieRanks.getFirebaseServices() : { db: null };
    if (!services.db || !slug) {
      return null;
    }

    try {
      var directDoc = await services.db.collection(name).doc(slug).get();
      if (directDoc.exists) {
        return Object.assign({ id: directDoc.id }, directDoc.data());
      }

      var snapshot = await services.db.collection(name).where("slug", "==", slug).limit(1).get();
      if (!snapshot.empty) {
        return Object.assign({ id: snapshot.docs[0].id }, snapshot.docs[0].data());
      }
    } catch (error) {
      console.error("Failed to fetch document", name, slug, error);
    }

    return null;
  }

  async function getProjects() {
    var remoteProjects = await fetchCollection("projects", 80);
    return mergeProjects(remoteProjects).filter(isLeaderboardEligible);
  }

  async function getProjectBySlug(slug) {
    if (!slug) {
      var projects = await getProjects();
      return projects[0] || null;
    }

    var remote = await fetchDocumentBySlug("projects", slug);
    if (remote) {
      var project = normalizeProject(remote);
      return isLeaderboardEligible(project) ? project : null;
    }

    var projects = await getProjects();
    return (
      projects.find(function (project) {
        return project.slug === slug;
      }) || null
    );
  }

  function mergeFounders() {
    var map = {};

    Array.prototype.slice.call(arguments).forEach(function (list) {
      (list || []).forEach(function (founder) {
        var normalized = normalizeFounder(founder);
        map[normalized.slug] = Object.assign({}, map[normalized.slug] || {}, normalized);
      });
    });

    return Object.keys(map).map(function (slug) {
      return map[slug];
    });
  }

  async function getFounderList(projects) {
    var projectList = projects || (await getProjects());
    var remoteFounders = await fetchCollection("founders", 80);
    return deriveFounders(projectList, mergeFounders(remoteFounders));
  }

  async function getFounderBySlug(slug) {
    var projects = await getProjects();
    if (!slug) {
      var founders = await getFounderList(projects);
      return founders[0] || null;
    }

    var remoteFounder = await fetchDocumentBySlug("founders", slug);
    var founders = deriveFounders(projects, mergeFounders(remoteFounder ? [remoteFounder] : []));
    return (
      founders.find(function (founder) {
        return founder.slug === slug;
      }) || null
    );
  }

  async function getTinyWins(projects) {
    var projectList = projects || (await getProjects());
    var remoteWins = await fetchCollection("tinyWins", 30);
    var derivedWins = deriveTinyWins(projectList);

    var merged = derivedWins.concat(
      (remoteWins || []).map(function (win) {
        return {
          projectSlug: win.projectSlug || slugify(win.projectName || "project"),
          projectName: win.projectName || "Project",
          founderName: win.founderName || "Builder",
          founderSlug: win.founderSlug || slugify(win.founderName || "builder"),
          category: win.category || "SaaS",
          label: win.label || "Small milestone",
          note: win.note || "",
          badge: win.badge || "",
          date: toIsoDate(win.date || win.createdAt),
        };
      })
    );

    var unique = {};
    merged.forEach(function (win) {
      var key = [win.projectSlug, win.label, win.date].join("|");
      unique[key] = win;
    });

    return Object.keys(unique)
      .map(function (key) {
        return unique[key];
      })
      .sort(function (left, right) {
        return new Date(right.date).getTime() - new Date(left.date).getTime();
      });
  }

  async function getOverviewStats(projects, founders, wins) {
    var projectList = projects || (await getProjects());
    var founderList = founders || (await getFounderList(projectList));
    var tinyWins = wins || (await getTinyWins(projectList));

    return {
      trackedProjects: projectList.length,
      trackedFounders: founderList.length,
      verifiedMetrics: projectList.filter(function (project) {
        return project.verified;
      }).length,
      tinyWinsThisWeek: tinyWins.filter(function (win) {
        return new Date(win.date).getTime() >= Date.now() - 7 * 86400000;
      }).length,
    };
  }

  function buildSubmittedProject(formData) {
    var projectName = String(formData.projectName || "").trim();
    var founderName = String(formData.founderName || "").trim();
    var metricType = formData.metricType || "mrr";
    var metricKey = normalizePrimaryMetricKey(metricType);
    var metricValue = coerceNumber(formData.currentMetricValue);
    var growthPercent = coerceNumber(formData.growthPercent);
    var projectSlug = slugify(projectName);
    var founderSlug = slugify(founderName);
    var nowIso = new Date().toISOString();
    var metrics = emptyMetrics();
    metrics[metricKey] = metricValue;

    return normalizeProject({
      slug: projectSlug,
      name: projectName,
      founderName: founderName,
      founderSlug: founderSlug,
      founderXUsername: normalizeXUsername(formData.founderXUsername),
      category: formData.category || "SaaS",
      tagline: String(formData.tagline || "").trim(),
      description: String(formData.tagline || "").trim(),
      primaryMetricKey: metricKey,
      metricType: metricLabel(metricKey),
      metricValue: metricValue,
      growthPercent: growthPercent,
      verificationType: normalizeVerificationType(metricKey, formData.verificationType),
      verificationReference: String(formData.verificationReference || "").trim(),
      verified: false,
      websiteUrl: String(formData.websiteUrl || "").trim(),
      logoUrl: String(formData.logoUrl || "").trim(),
      createdAt: nowIso,
      recent: true,
      featured: false,
      highlightBadge: "NEW",
      momentum: growthPercent >= 0 ? 1.08 : 0.95,
      metrics: metrics,
      tinyWins: [
        {
          label: "Listed on IndieRanks",
          note: "Fresh indie submission waiting for more traction.",
          badge: "NEW",
          date: nowIso,
        },
      ],
    });
  }

  async function submitProject(formData) {
    var project = buildSubmittedProject(formData);
    if (!isLeaderboardEligible(project)) {
      throw new Error("Projects at $20k MRR or above are not eligible for IndieRanks.");
    }

    var founder = normalizeFounder({
      slug: project.founderSlug,
      name: project.founderName,
      bio: "New IndieRanks founder profile. Add a better bio after claiming the project.",
      xUsername: project.founderXUsername,
      projectSlugs: [project.slug],
      milestones: project.tinyWins.map(function (win) {
        return win.label;
      }),
      createdAt: project.createdAt,
    });

    var services = IndieRanks.getFirebaseServices ? IndieRanks.getFirebaseServices() : { db: null, auth: null };
    if (!services.db || !window.firebase || !window.firebase.firestore) {
      throw new Error("Firestore is not available. Check your Firebase config and try again.");
    }
    if (!services.auth || !services.auth.currentUser) {
      throw new Error("Sign in before submitting. Public Firestore rules only allow authenticated writes.");
    }

    try {
      var projectRef = services.db.collection("projects").doc(project.slug);
      var founderRef = services.db.collection("founders").doc(founder.slug);
      var submissionRef = services.db.collection("submissions").doc();
      var existingRefs = await Promise.all([projectRef.get(), founderRef.get()]);
      var projectSnapshot = existingRefs[0];
      var founderSnapshot = existingRefs[1];

      if (projectSnapshot.exists) {
        throw new Error("A listing with this project name already exists. Rename it or claim the existing project.");
      }

      var batch = services.db.batch();
      var serverTimestamp = window.firebase.firestore.FieldValue.serverTimestamp();
      var currentUser = services.auth.currentUser;

      batch.set(projectRef, {
        slug: project.slug,
        name: project.name,
        founderName: project.founderName,
        founderSlug: project.founderSlug,
        founderXUsername: project.founderXUsername || "",
        category: project.category,
        tagline: project.tagline,
        description: project.description,
        primaryMetricKey: project.primaryMetricKey,
        metricType: project.metricType,
        metricValue: project.metricValue,
        metricLabel: project.metricLabel,
        growthPercent: project.growthPercent,
        timeframe: "allTime",
        verificationType: project.verificationType,
        verificationReference: project.verificationReference,
        verified: project.verified,
        websiteUrl: project.websiteUrl,
        logoUrl: project.logoUrl || "",
        createdAt: serverTimestamp,
        tinyWins: project.tinyWins,
        featured: false,
        recent: true,
        momentum: project.momentum,
        metrics: project.metrics,
        history: project.history,
      });

      if (!founderSnapshot.exists) {
        batch.set(founderRef, {
          slug: founder.slug,
          name: founder.name,
          bio: founder.bio,
          xUsername: founder.xUsername || "",
          avatarUrl: "",
          projectSlugs: [project.slug],
          milestones: founder.milestones,
          createdAt: serverTimestamp,
        });
      }

      batch.set(submissionRef, {
        projectSlug: project.slug,
        founderSlug: project.founderSlug,
        name: project.name,
        founderName: project.founderName,
        founderXUsername: project.founderXUsername || "",
        category: project.category,
        tagline: project.tagline,
        metricType: project.metricType,
        metricValue: project.metricValue,
        growthPercent: project.growthPercent,
        verificationType: project.verificationType,
        verificationReference: project.verificationReference,
        websiteUrl: project.websiteUrl,
        logoUrl: project.logoUrl || "",
        status: "received",
        submitterUid: currentUser.uid,
        createdAt: serverTimestamp,
      });

      await batch.commit();
    } catch (error) {
      console.error("Firestore submit failed.", error);
      if (error && error.code === "permission-denied") {
        throw new Error("Submission blocked by Firestore rules. Make sure you are signed in and deploying your own rules.");
      }
      throw error && error.message
        ? error
        : new Error("Could not save to Firestore. Check your Firebase rules and try again.");
    }

    return {
      ok: true,
      mode: "firestore",
      project: project,
      founder: founder,
    };
  }

  IndieRanks.store = {
    getProjects: getProjects,
    getProjectBySlug: getProjectBySlug,
    getFounderList: getFounderList,
    getFounderBySlug: getFounderBySlug,
    getTinyWins: getTinyWins,
    getOverviewStats: getOverviewStats,
    submitProject: submitProject,
    isLeaderboardEligible: isLeaderboardEligible,
    leaderboardMaxMrr: LEADERBOARD_MAX_MRR,
  };
})();
