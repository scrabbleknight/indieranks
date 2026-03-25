import rankingConfig from "../../../shared/indie-ranks-config.mjs";
import { normalizeHandle } from "../../../shared/ranking-engine.mjs";
import { submitCandidateSubmission } from "./candidate-submissions.js";
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
  candidateSubmission: {
    open: false,
    status: "idle",
    message: "",
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

function renderCandidatePanel() {
  const container = document.querySelector("#homeCandidatePanel");
  if (!container) {
    return;
  }

  if (!state.candidateSubmission.open) {
    container.hidden = true;
    container.innerHTML = "";
    return;
  }

  container.hidden = false;
  const statusClass =
    state.candidateSubmission.status === "success"
      ? "is-success"
      : state.candidateSubmission.status === "error"
        ? "is-error"
        : "";

  container.innerHTML = `
    <section class="panel dev-ranks-add-profile rounded-[1.75rem] p-5 sm:p-6">
      <div class="dev-ranks-add-profile__header">
        <div>
          <p class="indie-note-label">Add your profile</p>
          <h2 class="dev-ranks-add-profile__title">Join the candidate pool</h2>
        </div>
        <button type="button" class="dev-ranks-add-profile__close" data-close-add-profile aria-label="Close add profile panel">Close</button>
      </div>
      <p class="dev-ranks-add-profile__copy">
        This button itself does not cost X money. It just adds a profile to the review queue. We only spend X credits when we later sync approved candidates.
      </p>
      <form id="candidateSubmissionForm" class="dev-ranks-add-profile__form">
        <label class="dev-ranks-add-profile__field">
          <span>X handle</span>
          <input name="handle" type="text" inputmode="text" autocomplete="off" placeholder="@yourhandle" maxlength="15" required class="search-input rounded-2xl px-5 py-4 text-base" />
        </label>
        <label class="dev-ranks-add-profile__field">
          <span>Product Hunt username (optional)</span>
          <input name="productHuntUsername" type="text" inputmode="text" autocomplete="off" placeholder="@levelsio" maxlength="80" class="search-input rounded-2xl px-5 py-4 text-base" />
        </label>
        <label class="dev-ranks-add-profile__field">
          <span>Website (optional)</span>
          <input name="websiteUrl" type="url" inputmode="url" autocomplete="url" placeholder="https://yourdomain.com" maxlength="300" class="search-input rounded-2xl px-5 py-4 text-base" />
        </label>
        <label class="dev-ranks-add-profile__field">
          <span>Why should this profile be in IndieRanks? (optional)</span>
          <textarea name="note" rows="3" maxlength="400" placeholder="A quick note about what they build or ship." class="search-input rounded-2xl px-5 py-4 text-base"></textarea>
        </label>
        <div class="dev-ranks-add-profile__actions">
          <button type="submit" class="search-action search-action--primary" ${state.candidateSubmission.status === "submitting" ? "disabled" : ""}>
            ${state.candidateSubmission.status === "submitting" ? "Submitting..." : "Submit profile"}
          </button>
          <p class="dev-ranks-add-profile__meta">Approved legend candidates are refreshed cheaply from profile data, so adding a profile does not trigger a timeline-heavy X sync.</p>
        </div>
        <p class="dev-ranks-add-profile__status ${statusClass}" data-add-profile-status>${state.candidateSubmission.message || ""}</p>
      </form>
    </section>
  `;
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
  setText(
    "#homeSourceLabel",
    dataset.source === "firestore"
      ? "Live Firestore data"
      : dataset.source === "hybrid"
        ? "Live Firestore data + seed fallback"
        : "Seeded mock data"
  );
}

function setCandidateSubmissionState(nextState = {}) {
  state.candidateSubmission = {
    ...state.candidateSubmission,
    ...nextState,
  };
  renderCandidatePanel();
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

async function handleCandidateSubmit(event) {
  const form = event.target;
  if (!form || form.id !== "candidateSubmissionForm") {
    return;
  }

  event.preventDefault();
  const formData = new FormData(form);
  const handle = normalizeHandle(formData.get("handle"));

  if (!handle) {
    setCandidateSubmissionState({
      status: "error",
      message: "Add a valid X handle first.",
    });
    return;
  }

  if (state.dataset && state.dataset.byHandle && state.dataset.byHandle[handle]) {
    window.location.href = `/dev.html?handle=${encodeURIComponent(handle)}`;
    return;
  }

  setCandidateSubmissionState({
    status: "submitting",
    message: "",
  });

  try {
    await submitCandidateSubmission({
      handle,
      productHuntUsername: formData.get("productHuntUsername"),
      websiteUrl: formData.get("websiteUrl"),
      note: formData.get("note"),
    });

    form.reset();
    setCandidateSubmissionState({
      status: "success",
      message: `@${handle} is in the review queue. We will only spend X credits if the profile gets approved for ranking.`,
    });
  } catch (error) {
    setCandidateSubmissionState({
      status: "error",
      message: error instanceof Error ? error.message : "Could not submit the profile right now.",
    });
  }
}

function bindCandidateSubmission() {
  const button = document.querySelector("#homeAddProfileButton");
  const container = document.querySelector("#homeCandidatePanel");

  if (!button || !container) {
    return;
  }

  button.addEventListener("click", () => {
    const isOpen = !state.candidateSubmission.open;
    setCandidateSubmissionState({
      open: isOpen,
      status: isOpen ? state.candidateSubmission.status : "idle",
      message: isOpen ? state.candidateSubmission.message : "",
    });
  });

  container.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-close-add-profile]");
    if (!closeButton) {
      return;
    }

    setCandidateSubmissionState({
      open: false,
      status: "idle",
      message: "",
    });
  });

  container.addEventListener("submit", handleCandidateSubmit);
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
  bindCandidateSubmission();
  bindSectionPagination();
  renderCandidatePanel();

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
