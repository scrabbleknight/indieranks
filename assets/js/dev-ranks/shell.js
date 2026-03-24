const THEME_KEY = "indieranks-theme-override";

function getStoredTheme() {
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === "dark" || stored === "light") {
      return stored;
    }
  } catch (error) {
    return null;
  }

  return null;
}

function getSystemTheme() {
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function getTheme() {
  return document.documentElement.getAttribute("data-theme") || getStoredTheme() || getSystemTheme();
}

function applyTheme(theme, source) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  const nextSource = source || (getStoredTheme() ? "manual" : "system");

  document.documentElement.setAttribute("data-theme", nextTheme);
  document.documentElement.setAttribute("data-theme-source", nextSource);
  document.documentElement.classList.toggle("dark", nextTheme === "dark");
  document.documentElement.style.colorScheme = nextTheme;
}

function setTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  applyTheme(nextTheme, "manual");

  try {
    window.localStorage.setItem(THEME_KEY, nextTheme);
  } catch (error) {
    return;
  }
}

function renderThemeIcon(theme) {
  if (theme === "dark") {
    return `
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3.75v2.5M12 17.75v2.5M5.64 5.64l1.77 1.77M16.59 16.59l1.77 1.77M3.75 12h2.5M17.75 12h2.5M5.64 18.36l1.77-1.77M16.59 7.41l1.77-1.77M15.5 12a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.5 3.75c-3.59 1.04-6 4.28-6 8.03c0 4.66 3.45 8.47 7.92 8.97A8.76 8.76 0 0 1 12 21.95C7.05 21.95 3 17.9 3 12.95c0-4.33 3.08-7.97 7.17-8.84c1.4-.3 2.88-.18 4.33.34Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

function syncThemeButtons() {
  const currentTheme = getTheme();
  const label = currentTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    button.setAttribute("aria-label", label);
    button.setAttribute("title", label);
    button.innerHTML = `<span class="theme-toggle__icon">${renderThemeIcon(currentTheme)}</span>`;
  });
}

function syncYear() {
  const year = new Date().getFullYear();
  document.querySelectorAll("[data-current-year]").forEach((node) => {
    node.textContent = String(year);
  });
}

function bindThemeToggle() {
  document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
    if (button.dataset.themeBound === "true") {
      return;
    }

    button.dataset.themeBound = "true";
    button.addEventListener("click", () => {
      setTheme(getTheme() === "dark" ? "light" : "dark");
      syncThemeButtons();
    });
  });

  if (window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", () => {
      if (!getStoredTheme()) {
        applyTheme(getSystemTheme(), "system");
        syncThemeButtons();
      }
    });
  }
}

export function initSiteShell() {
  bindThemeToggle();
  syncThemeButtons();
  syncYear();
}
