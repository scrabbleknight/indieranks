import { initSiteShell } from "./shell.js";
import { getDevProfile } from "./store.js";
import { getUserPosts } from "./xApi.js";
import { renderProfile, renderProfileEmpty, renderProfileSkeleton } from "./ui.js";

function getRequestedHandle() {
  return new URLSearchParams(window.location.search).get("handle") || "";
}

async function init() {
  initSiteShell();

  const container = document.querySelector("#devProfileRoot");
  if (!container) {
    return;
  }

  container.innerHTML = renderProfileSkeleton();

  const handle = getRequestedHandle();

  if (!handle) {
    container.innerHTML = renderProfileEmpty("unknown");
    return;
  }

  const viewModel = await getDevProfile(handle);

  if (!viewModel) {
    container.innerHTML = renderProfileEmpty(handle);
    return;
  }

  const topPosts = await getUserPosts(viewModel.dev.handle);
  document.title = `${viewModel.dev.displayName} | IndieRanks`;
  container.innerHTML = renderProfile(viewModel, topPosts);
}

init();
