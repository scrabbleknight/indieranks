(function () {
  var THEME_KEY = "indieranks-theme-override";

  function getStoredTheme() {
    try {
      var stored = window.localStorage.getItem(THEME_KEY);
      if (stored === "dark" || stored === "light") {
        return stored;
      }
    } catch (error) {}

    return null;
  }

  function getSystemTheme() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  var theme = getStoredTheme() || getSystemTheme();

  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-theme-source", getStoredTheme() ? "manual" : "system");
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
})();
