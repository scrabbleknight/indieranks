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

function renderHome(dataset) {
  const sections = document.querySelector("#homeSections");

  if (sections) {
    sections.innerHTML = [
      renderLeaderboardSection("legend", dataset.sections.legends),
      renderLeaderboardSection("contender", dataset.sections.contenders),
      renderLeaderboardSection("rookie", dataset.sections.rookies),
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

async function init() {
  initSiteShell();

  const sections = document.querySelector("#homeSections");
  if (sections) {
    sections.innerHTML = renderHomeSkeleton();
  }

  bindSearch();

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
