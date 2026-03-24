import rankingConfig from "../../../shared/indie-ranks-config.mjs";
import { initSiteShell } from "./shell.js";
import { getHomeDataset, searchDevs } from "./store.js";
import {
  formatDate,
  renderHomeSkeleton,
  renderLeaderboardSection,
  renderSearchResults,
} from "./ui.js";

const state = {
  dataset: null,
  query: "",
  pages: {
    legend: 1,
    contender: 1,
    rookie: 1,
  },
};

const PAGE_SIZES = {
  legend: Number(rankingConfig.leaderboardSizes.legends) || 8,
  contender: Number(rankingConfig.leaderboardSizes.contenders) || 10,
  rookie: Number(rankingConfig.leaderboardSizes.rookies) || 12,
};

function setText(selector, text) {
  const node = document.querySelector(selector);
  if (node) {
    node.textContent = text;
  }
}

function renderSearchPanel(results) {
  const container = document.querySelector("#homeSearchResults");
  if (!container) {
    return;
  }

  container.innerHTML = renderSearchResults(results, state.query);
}

function getSectionPage(dataset, category) {
  const allItems = (dataset.groups && dataset.groups[category]) || [];
  const pageSize = PAGE_SIZES[category] || allItems.length || 1;
  const pageCount = Math.max(1, Math.ceil(allItems.length / pageSize));
  const currentPage = Math.min(Math.max(Number(state.pages[category]) || 1, 1), pageCount);
  const start = (currentPage - 1) * pageSize;

  state.pages[category] = currentPage;

  return {
    items: allItems.slice(start, start + pageSize),
    totalItems: allItems.length,
    page: currentPage,
    pageCount,
    pageSize,
  };
}

function renderHome(dataset) {
  const sections = document.querySelector("#homeSections");
  const legendPage = getSectionPage(dataset, "legend");
  const contenderPage = getSectionPage(dataset, "contender");
  const rookiePage = getSectionPage(dataset, "rookie");

  if (sections) {
    sections.innerHTML = [
      renderLeaderboardSection("legend", legendPage.items, legendPage),
      renderLeaderboardSection("contender", contenderPage.items, contenderPage),
      renderLeaderboardSection("rookie", rookiePage.items, rookiePage),
    ].join("");
  }

  setText("#homeSnapshotDate", formatDate(dataset.snapshotDate));
  setText("#homeSourceLabel", dataset.source === "firestore" ? "Live Firestore data" : "Seeded mock data");
}

async function handleSearchInput(event) {
  state.query = event.target.value.trim();

  if (!state.query) {
    renderSearchPanel([]);
    return;
  }

  const results = await searchDevs(state.query);
  renderSearchPanel(results);
}

function bindSearch() {
  const searchInput = document.querySelector("#homeSearch");
  if (!searchInput) {
    return;
  }

  searchInput.addEventListener("input", handleSearchInput);
  searchInput.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") {
      return;
    }

    const results = await searchDevs(state.query || searchInput.value.trim());
    if (results.length > 0) {
      window.location.href = `/dev.html?handle=${encodeURIComponent(results[0].handle)}`;
    }
  });
}

function bindSectionPagination() {
  const sections = document.querySelector("#homeSections");
  if (!sections || sections.dataset.paginationBound === "true") {
    return;
  }

  sections.dataset.paginationBound = "true";
  sections.addEventListener("click", (event) => {
    const button = event.target.closest("[data-home-section][data-home-page]");
    if (!button || !state.dataset) {
      return;
    }

    const category = button.getAttribute("data-home-section");
    const nextPage = Number(button.getAttribute("data-home-page"));

    if (!category || !Number.isFinite(nextPage) || nextPage < 1) {
      return;
    }

    state.pages[category] = nextPage;
    renderHome(state.dataset);

    const section = document.querySelector(`[data-category-section="${category}"]`);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
}

async function init() {
  initSiteShell();

  const sections = document.querySelector("#homeSections");
  if (sections) {
    sections.innerHTML = renderHomeSkeleton();
  }

  bindSearch();
  bindSectionPagination();

  try {
    state.dataset = await getHomeDataset();
    renderHome(state.dataset);
  } catch (error) {
    console.error("Could not load homepage data", error);
    if (sections) {
      sections.innerHTML = `
        <section class="panel rounded-[2rem] p-6 text-center">
          <p class="indie-note-label">Could not load it</p>
          <p class="mt-3 text-[var(--leaderboard-copy)]">The IndieRanks directory could not be loaded right now.</p>
        </section>
      `;
    }
  }
}

init();
