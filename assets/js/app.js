(function () {
  var IndieRanks = (window.IndieRanks = window.IndieRanks || {});
  var ui = IndieRanks.ui;
  var store = IndieRanks.store;
  var CATEGORY_OPTIONS = [
    "SaaS",
    "AI",
    "Dev Tools",
    "Productivity",
    "Marketing",
    "Consumer",
    "Games",
    "Ecommerce",
    "Finance",
    "Education",
    "Health",
    "Security",
    "Open Source",
    "Other",
  ];
  var METRIC_OPTIONS = [
    { value: "mrr", label: "MRR" },
  ];

  if (!ui || !store) {
    return;
  }

  var body = document.body;
  var page = body.getAttribute("data-page") || "home";
  var THEME_KEY = "indieranks-theme-override";
  var APP_ICON_MAX_BYTES = 512 * 1024;
  var authState = {
    ready: false,
    readyPromise: null,
    readyResolver: null,
    user: null,
  };
  var authGateModalState = {
    busy: false,
    onSignedIn: null,
    returnFocus: null,
    root: null,
    view: "gate",
    authMode: "signup",
    emailFormVisible: false,
    errorMessage: "",
  };

  function $(selector) {
    return document.querySelector(selector);
  }

  function setHtml(target, html) {
    if (target) {
      target.innerHTML = html;
    }
  }

  function setText(target, text) {
    if (target) {
      target.textContent = text;
    }
  }

  function queryParams() {
    return new URLSearchParams(window.location.search);
  }

  function resolveAuthReady(user) {
    if (typeof authState.readyResolver === "function") {
      authState.readyResolver(user || null);
      authState.readyResolver = null;
    }
  }

  function ensureAuthReady() {
    if (authState.readyPromise) {
      return authState.readyPromise;
    }

    authState.readyPromise = new Promise(function (resolve) {
      authState.readyResolver = resolve;
    });

    var authHooks = IndieRanks.authHooks;
    if (!authHooks || typeof authHooks.onChange !== "function") {
      authState.ready = true;
      resolveAuthReady(null);
      return authState.readyPromise;
    }

    try {
      authHooks.onChange(function (user) {
        authState.user = user || null;
        if (!authState.ready) {
          authState.ready = true;
          resolveAuthReady(authState.user);
        }
      });
    } catch (error) {
      console.error("Auth state subscription failed", error);
      authState.ready = true;
      resolveAuthReady(null);
    }

    return authState.readyPromise;
  }

  async function getCurrentUser() {
    await ensureAuthReady();
    return authState.user;
  }

  function renderAuthGateError(extraClassName) {
    var className = "auth-gate-modal__error";
    if (extraClassName) {
      className += " " + extraClassName;
    }

    return (
      '<p class="' +
      className +
      '" data-auth-gate-error' +
      (authGateModalState.errorMessage ? "" : " hidden") +
      ">" +
      ui.escapeHtml(authGateModalState.errorMessage || "") +
      "</p>"
    );
  }

  function renderBracketGateDialog() {
    return (
      '<div class="auth-gate-modal__dialog auth-gate-modal__dialog--gate panel" role="dialog" aria-modal="true" aria-labelledby="authGateModalMessage">' +
        '<div class="auth-gate-modal__hero">' +
          '<div class="auth-gate-modal__hero-badge">' +
            '<span class="auth-gate-modal__hero-dot"></span>' +
            '<span>Bracket View</span>' +
          "</div>" +
          '<div class="auth-gate-modal__hero-stack" aria-hidden="true">' +
            '<span class="auth-gate-modal__hero-chip">Trending</span>' +
            '<span class="auth-gate-modal__hero-card auth-gate-modal__hero-card--back"></span>' +
            '<span class="auth-gate-modal__hero-card auth-gate-modal__hero-card--mid"></span>' +
            '<span class="auth-gate-modal__hero-card auth-gate-modal__hero-card--front">' +
              '<span class="auth-gate-modal__hero-rank">#12</span>' +
              '<span class="auth-gate-modal__hero-lines">' +
                '<span></span>' +
                '<span></span>' +
                '<span></span>' +
              "</span>" +
            "</span>" +
          "</div>" +
        "</div>" +
        '<div class="auth-gate-modal__copy">' +
          '<p class="auth-gate-modal__eyebrow">Personalized leaderboard</p>' +
          '<p id="authGateModalMessage" class="auth-gate-modal__message">In order to see your own bracket, you need to sign in.</p>' +
          '<p class="auth-gate-modal__subcopy">Once auth is live, this view will filter the board to builders at your level.</p>' +
        "</div>" +
        renderAuthGateError() +
        '<div class="auth-gate-modal__actions">' +
          '<button type="button" class="auth-gate-modal__button chip-link" data-auth-gate-stay>Stay anonymous</button>' +
          '<button type="button" class="auth-gate-modal__button theme-cta" data-auth-gate-signin>Sign in</button>' +
        "</div>" +
      "</div>"
    );
  }

  function renderAuthEntryForm() {
    var isSignIn = authGateModalState.authMode === "signin";

    if (!isSignIn && !authGateModalState.emailFormVisible) {
      return (
        '<button type="button" class="auth-entry-modal__provider auth-entry-modal__provider--email" data-auth-modal-email>' +
          "Email" +
        "</button>"
      );
    }

    return (
      '<form class="auth-entry-modal__form" data-auth-modal-form novalidate>' +
        (isSignIn
          ? ""
          : '<input data-auth-modal-input-primary name="firstName" type="text" autocomplete="given-name" placeholder="First name" class="auth-entry-modal__input" />' +
            '<input name="lastName" type="text" autocomplete="family-name" placeholder="Last name" class="auth-entry-modal__input" />') +
        '<input ' +
          (isSignIn ? 'data-auth-modal-input-primary ' : "") +
          'name="email" type="email" autocomplete="email" placeholder="Email" class="auth-entry-modal__input" />' +
        '<input name="password" type="password" autocomplete="' +
          (isSignIn ? "current-password" : "new-password") +
          '" placeholder="Password" class="auth-entry-modal__input" />' +
        (isSignIn
          ? ""
          : '<input name="confirmPassword" type="password" autocomplete="new-password" placeholder="Confirm Password" class="auth-entry-modal__input" />') +
        '<button type="submit" class="auth-entry-modal__submit ' +
          (isSignIn ? "auth-entry-modal__submit--signin" : "auth-entry-modal__submit--signup") +
          '" data-auth-modal-submit>' +
          (isSignIn ? "Sign In" : "Sign Up") +
        "</button>" +
      "</form>"
    );
  }

  function renderAuthEntryDialog() {
    var isSignIn = authGateModalState.authMode === "signin";

    return (
      '<div class="auth-gate-modal__dialog auth-gate-modal__dialog--auth panel" role="dialog" aria-modal="true" aria-labelledby="authEntryTitle">' +
        '<button type="button" class="auth-entry-modal__close" aria-label="Close sign-in modal" data-auth-modal-close>' +
          '<svg class="auth-entry-modal__close-icon" viewBox="0 0 24 24" role="img" aria-hidden="true">' +
            '<path d="M6 6L18 18M18 6L6 18"></path>' +
          '</svg>' +
        '</button>' +
        '<div class="auth-entry-modal__header">' +
          '<h2 id="authEntryTitle" class="auth-entry-modal__title">Join IndieRanks</h2>' +
          '<p class="auth-entry-modal__subtitle">🤫 It\'s free to sign up.</p>' +
        "</div>" +
        '<div class="auth-entry-modal__segmented" role="tablist" aria-label="Authentication mode">' +
          '<button type="button" class="auth-entry-modal__tab' +
            (isSignIn ? " is-active" : "") +
            '" role="tab" aria-selected="' +
            (isSignIn ? "true" : "false") +
            '" data-auth-modal-tab="signin">Sign In</button>' +
          '<button type="button" class="auth-entry-modal__tab' +
            (!isSignIn ? " is-active" : "") +
            '" role="tab" aria-selected="' +
            (!isSignIn ? "true" : "false") +
            '" data-auth-modal-tab="signup">Sign Up</button>' +
        "</div>" +
        '<div class="auth-entry-modal__providers">' +
          '<button type="button" class="auth-entry-modal__provider" data-auth-modal-google>' +
            '<span class="auth-entry-modal__provider-icon auth-entry-modal__provider-icon--google" aria-hidden="true">' +
              '<svg viewBox="0 0 48 48" role="img" aria-hidden="true">' +
                '<path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.95 3.05l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path>' +
                '<path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 12 24 12c3.059 0 5.842 1.154 7.95 3.05l5.657-5.657C34.046 6.053 29.268 4 24 4c-7.682 0-14.41 4.337-17.694 10.691z"></path>' +
                '<path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.152 35.091 26.676 36 24 36c-5.202 0-9.621-3.323-11.283-7.946l-6.522 5.025C9.435 39.556 16.546 44 24 44z"></path>' +
                '<path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.084 5.571l6.19 5.238C36.971 39.206 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"></path>' +
              '</svg>' +
            "</span>" +
            '<span data-auth-modal-google-label>Continue with Google</span>' +
          "</button>" +
          '<button type="button" class="auth-entry-modal__provider" data-auth-modal-x>' +
            '<span class="auth-entry-modal__provider-icon auth-entry-modal__provider-icon--x" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24" role="img" aria-hidden="true">' +
                '<path fill="currentColor" d="M18.244 2h3.308l-7.227 8.261L22.8 22h-6.638l-5.196-6.769L5.04 22H1.73l7.73-8.835L1.2 2h6.806l4.696 6.231L18.244 2Zm-1.161 18h1.833L7.012 3.902H5.046L17.083 20Z"></path>' +
              '</svg>' +
            "</span>" +
            "<span>Continue with X</span>" +
          "</button>" +
        "</div>" +
        '<div class="auth-entry-modal__divider" aria-hidden="true">' +
          '<span class="auth-entry-modal__divider-line"></span>' +
          '<span class="auth-entry-modal__divider-copy">OR CONTINUE WITH</span>' +
          '<span class="auth-entry-modal__divider-line"></span>' +
        "</div>" +
        renderAuthEntryForm() +
        renderAuthGateError("auth-gate-modal__error--auth") +
        '<p class="auth-entry-modal__legal">By continuing you agree to our <span class="auth-entry-modal__legal-link">Terms of Service</span>, <span class="auth-entry-modal__legal-link">Privacy Policy</span> and <span class="auth-entry-modal__legal-link">Cookies</span>.</p>' +
      "</div>"
    );
  }

  function renderAuthGateModal() {
    return (
      '<div class="auth-gate-modal__scrim" data-auth-gate-dismiss></div>' +
      (authGateModalState.view === "auth" ? renderAuthEntryDialog() : renderBracketGateDialog())
    );
  }

  function syncAuthGateModal() {
    var modal = authGateModalState.root;
    if (!modal) {
      return;
    }
    modal.innerHTML = renderAuthGateModal();
  }

  function focusAuthGateModalPrimary() {
    var modal = authGateModalState.root;
    if (!modal || modal.hidden) {
      return;
    }

    var selector = "[data-auth-gate-signin]";
    if (authGateModalState.view === "auth") {
      selector =
        authGateModalState.authMode === "signin" || authGateModalState.emailFormVisible
          ? "[data-auth-modal-input-primary]"
          : "[data-auth-modal-google]";
    }

    var target =
      modal.querySelector(selector) ||
      modal.querySelector("[data-auth-modal-close]") ||
      modal.querySelector("[data-auth-gate-stay]");

    if (target && typeof target.focus === "function") {
      window.requestAnimationFrame(function () {
        target.focus();
      });
    }
  }

  function setAuthGateError(message) {
    var modal = authGateModalState.root;
    var text = String(message || "").trim();
    authGateModalState.errorMessage = text;

    if (!modal) {
      return;
    }

    var errorNode = modal.querySelector("[data-auth-gate-error]");
    if (!errorNode) {
      return;
    }

    setText(errorNode, text);
    errorNode.hidden = !text;
  }

  function setAuthGateBusy(isBusy) {
    var modal = authGateModalState.root;
    authGateModalState.busy = !!isBusy;
    if (!modal) {
      return;
    }

    Array.prototype.forEach.call(modal.querySelectorAll("button, input"), function (node) {
      node.disabled = authGateModalState.busy;
    });

    var signInButton = modal.querySelector("[data-auth-gate-signin]");
    if (signInButton) {
      signInButton.textContent = authGateModalState.busy ? "Loading..." : "Sign in";
    }

    var googleLabel = modal.querySelector("[data-auth-modal-google-label]");
    if (googleLabel) {
      googleLabel.textContent = authGateModalState.busy ? "Connecting..." : "Continue with Google";
    }
  }

  function hideAuthGateModal() {
    var modal = authGateModalState.root;
    if (!modal) {
      return;
    }

    authGateModalState.onSignedIn = null;
    authGateModalState.view = "gate";
    authGateModalState.authMode = "signup";
    authGateModalState.emailFormVisible = false;
    setAuthGateBusy(false);
    setAuthGateError("");
    modal.hidden = true;
    body.classList.remove("auth-gate-open");

    if (authGateModalState.returnFocus && typeof authGateModalState.returnFocus.focus === "function") {
      authGateModalState.returnFocus.focus();
    }
    authGateModalState.returnFocus = null;
  }

  function openAuthEntryModal() {
    authGateModalState.view = "auth";
    authGateModalState.authMode = "signup";
    authGateModalState.emailFormVisible = false;
    setAuthGateBusy(false);
    setAuthGateError("");
    syncAuthGateModal();
    focusAuthGateModalPrimary();
  }

  function switchAuthEntryMode(mode) {
    authGateModalState.authMode = mode === "signin" ? "signin" : "signup";
    authGateModalState.emailFormVisible = false;
    setAuthGateBusy(false);
    setAuthGateError("");
    syncAuthGateModal();
    focusAuthGateModalPrimary();
  }

  function openAuthEmailForm() {
    authGateModalState.emailFormVisible = true;
    setAuthGateBusy(false);
    setAuthGateError("");
    syncAuthGateModal();
    focusAuthGateModalPrimary();
  }

  async function handleAuthGateGoogleSignIn() {
    if (authGateModalState.busy) {
      return;
    }

    var authHooks = IndieRanks.authHooks;
    if (!authHooks || typeof authHooks.signInWithGoogle !== "function") {
      setAuthGateError("Sign-in is not available yet.");
      return;
    }

    setAuthGateError("");
    setAuthGateBusy(true);

    try {
      var result = await authHooks.signInWithGoogle();
      var user = (result && result.user) || (await getCurrentUser());
      if (!user) {
        throw new Error("Sign-in was canceled.");
      }

      authState.user = user;
      var onSignedIn = authGateModalState.onSignedIn;
      hideAuthGateModal();
      if (typeof onSignedIn === "function") {
        onSignedIn(user);
      }
    } catch (error) {
      console.error(error);
      var code = error && error.code;
      setAuthGateError(
        code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request"
          ? "Sign-in was canceled."
          : (error && error.message) || "Could not sign you in yet. Try again."
      );
      setAuthGateBusy(false);
    }
  }

  function handleAuthProviderX() {
    setAuthGateError("X sign-in is not wired yet.");
  }

  function handleAuthEmailSubmit(form) {
    if (!form) {
      return;
    }

    var values = new FormData(form);
    var isSignIn = authGateModalState.authMode === "signin";
    var email = String(values.get("email") || "").trim();
    var password = String(values.get("password") || "").trim();

    if (isSignIn) {
      if (!email || !password) {
        setAuthGateError("Enter your email and password to continue.");
        return;
      }

      setAuthGateError("Email sign-in is not wired yet.");
      return;
    }

    var firstName = String(values.get("firstName") || "").trim();
    var lastName = String(values.get("lastName") || "").trim();
    var confirmPassword = String(values.get("confirmPassword") || "").trim();

    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      setAuthGateError("Fill out every field to continue.");
      return;
    }

    if (password !== confirmPassword) {
      setAuthGateError("Passwords do not match.");
      return;
    }

    setAuthGateError("Email sign-up is not wired yet.");
  }

  function ensureAuthGateModal() {
    if (authGateModalState.root) {
      return authGateModalState.root;
    }

    var modal = document.createElement("div");
    modal.className = "auth-gate-modal";
    modal.hidden = true;
    syncAuthGateModal();
    modal.addEventListener("click", function (event) {
      var dismissTrigger = event.target.closest("[data-auth-gate-dismiss]");
      var stayTrigger = event.target.closest("[data-auth-gate-stay]");
      var signInTrigger = event.target.closest("[data-auth-gate-signin]");
      var authCloseTrigger = event.target.closest("[data-auth-modal-close]");
      var authTabTrigger = event.target.closest("[data-auth-modal-tab]");
      var authGoogleTrigger = event.target.closest("[data-auth-modal-google]");
      var authXTrigger = event.target.closest("[data-auth-modal-x]");
      var authEmailTrigger = event.target.closest("[data-auth-modal-email]");

      if (authGoogleTrigger) {
        handleAuthGateGoogleSignIn();
        return;
      }

      if (authXTrigger) {
        handleAuthProviderX();
        return;
      }

      if (authTabTrigger && !authGateModalState.busy) {
        switchAuthEntryMode(authTabTrigger.getAttribute("data-auth-modal-tab"));
        return;
      }

      if (authEmailTrigger && !authGateModalState.busy) {
        openAuthEmailForm();
        return;
      }

      if (signInTrigger && !authGateModalState.busy) {
        openAuthEntryModal();
        return;
      }

      if (authGateModalState.busy) {
        return;
      }

      if (dismissTrigger || stayTrigger || authCloseTrigger) {
        hideAuthGateModal();
      }
    });

    modal.addEventListener("submit", function (event) {
      var form = event.target.closest("[data-auth-modal-form]");
      if (!form) {
        return;
      }

      event.preventDefault();
      handleAuthEmailSubmit(form);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !modal.hidden && !authGateModalState.busy) {
        event.preventDefault();
        hideAuthGateModal();
      }
    });

    body.appendChild(modal);
    authGateModalState.root = modal;
    syncAuthGateModal();
    return modal;
  }

  function showAuthGateModal(options) {
    var modal = ensureAuthGateModal();
    authGateModalState.onSignedIn = options && options.onSignedIn;
    authGateModalState.returnFocus = document.activeElement;
    authGateModalState.view = "gate";
    authGateModalState.authMode = "signup";
    authGateModalState.emailFormVisible = false;
    setAuthGateError("");
    setAuthGateBusy(false);
    syncAuthGateModal();
    modal.hidden = false;
    body.classList.add("auth-gate-open");
    focusAuthGateModalPrimary();
  }

  async function normalizeBracketScopeForAuth(toggle, state, syncLabel) {
    if (!toggle || !state.onlyMyBracket) {
      if (typeof syncLabel === "function") {
        syncLabel();
      }
      return;
    }

    var user = await getCurrentUser();
    if (!user) {
      state.onlyMyBracket = false;
      toggle.checked = false;
    }

    if (typeof syncLabel === "function") {
      syncLabel();
    }
  }

  async function handleProtectedBracketToggle(toggle, state, syncLabel, updateFn) {
    if (!toggle) {
      if (typeof updateFn === "function") {
        updateFn();
      }
      return;
    }

    if (!toggle.checked) {
      if (typeof updateFn === "function") {
        updateFn();
      }
      return;
    }

    var user = await getCurrentUser();
    if (user) {
      if (typeof updateFn === "function") {
        updateFn();
      }
      return;
    }

    toggle.checked = false;
    state.onlyMyBracket = false;
    if (typeof syncLabel === "function") {
      syncLabel();
    }
    if (typeof updateFn === "function") {
      updateFn();
    }

    showAuthGateModal({
      onSignedIn: function () {
        toggle.checked = true;
        state.onlyMyBracket = true;
        if (typeof syncLabel === "function") {
          syncLabel();
        }
        if (typeof updateFn === "function") {
          updateFn();
        }
      },
    });
  }

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

  function getTheme() {
    var theme = document.documentElement.getAttribute("data-theme");
    if (theme === "dark" || theme === "light") {
      return theme;
    }
    return getStoredTheme() || getSystemTheme();
  }

  function applyTheme(theme, source) {
    var nextTheme = theme === "dark" ? "dark" : "light";
    var nextSource = source || (getStoredTheme() ? "manual" : "system");
    document.documentElement.setAttribute("data-theme", nextTheme);
    document.documentElement.setAttribute("data-theme-source", nextSource);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    document.documentElement.style.colorScheme = nextTheme;
    body.setAttribute("data-theme", nextTheme);
    body.setAttribute("data-theme-source", nextSource);
  }

  function setTheme(theme) {
    var nextTheme = theme === "dark" ? "dark" : "light";
    applyTheme(nextTheme, "manual");

    try {
      window.localStorage.setItem(THEME_KEY, nextTheme);
    } catch (error) {}

    ensureThemeToggle();
    window.dispatchEvent(
      new CustomEvent("indieranks:themechange", {
        detail: { theme: nextTheme },
      })
    );
  }

  function syncThemeWithSystem() {
    if (getStoredTheme()) {
      return;
    }

    var nextTheme = getSystemTheme();
    applyTheme(nextTheme, "system");
    ensureThemeToggle();
    window.dispatchEvent(
      new CustomEvent("indieranks:themechange", {
        detail: { theme: nextTheme },
      })
    );
  }

  function renderThemeToggle() {
    var isDark = getTheme() === "dark";
    var label = isDark ? "Switch to light mode" : "Switch to dark mode";
    var icon = isDark
      ? '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3.75v2.5M12 17.75v2.5M5.64 5.64l1.77 1.77M16.59 16.59l1.77 1.77M3.75 12h2.5M17.75 12h2.5M5.64 18.36l1.77-1.77M16.59 7.41l1.77-1.77M15.5 12a3.5 3.5 0 1 1-7 0a3.5 3.5 0 0 1 7 0Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.5 3.75c-3.59 1.04-6 4.28-6 8.03c0 4.66 3.45 8.47 7.92 8.97A8.76 8.76 0 0 1 12 21.95C7.05 21.95 3 17.9 3 12.95c0-4.33 3.08-7.97 7.17-8.84c1.4-.3 2.88-.18 4.33.34Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    return (
      '<button type="button" class="theme-toggle" data-theme-toggle-button aria-label="' +
      ui.escapeHtml(label) +
      '" title="' +
      ui.escapeHtml(label) +
      '">' +
      '<span class="theme-toggle__icon">' +
      icon +
      "</span>" +
      "</button>"
    );
  }

  function ensureThemeToggle() {
    var target = $("[data-theme-toggle]");
    var isFloating = !target;
    if (!target) {
      target = document.createElement("div");
      target.setAttribute("data-theme-toggle", "");
      body.appendChild(target);
    }

    if (target.getAttribute("data-theme-toggle-bound") !== "true") {
      target.addEventListener("click", function (event) {
        var button = event.target.closest("[data-theme-toggle-button]");
        if (!button) {
          return;
        }
        setTheme(getTheme() === "dark" ? "light" : "dark");
      });
      target.setAttribute("data-theme-toggle-bound", "true");
    }

    target.className = "theme-toggle-wrap " + (isFloating ? "theme-toggle-wrap--floating" : "theme-toggle-wrap--inline");
    target.innerHTML = renderThemeToggle();
  }

  function buildUrl(path, state) {
    var params = new URLSearchParams();
    var includeMetricParams = !state || state.includeMetricParams !== false;
    if (state && state.query) {
      params.set("q", state.query);
    }
    if (includeMetricParams && state && state.metric) {
      params.set("metric", ui.normalizeMetricKey(state.metric));
    }
    if (includeMetricParams && state && state.timeframe) {
      params.set("timeframe", ui.normalizeTimeframe(state.timeframe));
    }
    if (state && state.bracket) {
      params.set("bracket", ui.normalizeMrrBracket(state.bracket));
    }
    if (state && state.sort) {
      params.set("sort", ui.normalizeSortMode(state.sort));
    }
    if (state && typeof state.onlyMyBracket === "boolean") {
      params.set("scope", state.onlyMyBracket ? "bracket" : "all");
    }

    var query = params.toString();
    return query ? path + "?" + query : path;
  }

  function renderHeader() {
    var target = $("[data-site-header]");
    if (!target) {
      return;
    }

    if (page === "home" || page === "leaderboard") {
      setHtml(target, "");
      return;
    }

    var headerActions =
      '<a href="./index.html" class="chip-link rounded-full px-4 py-2 text-sm text-white/62">Leaderboard</a>';

    if (page !== "submit") {
      headerActions +=
        '<a href="./submit.html" class="theme-cta shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition hover:scale-[1.02]">+ Add Project</a>';
    }

    headerActions += '<div data-theme-toggle aria-live="polite"></div>';

    setHtml(
      target,
      '<header class="sticky-shell sticky top-0 z-50 border-b border-white/6">' +
        '<div class="mx-auto flex max-w-shell flex-wrap items-center justify-between gap-3 px-4 py-4 sm:flex-nowrap sm:gap-4 sm:px-6">' +
          '<a href="./index.html" class="flex shrink-0 items-center gap-3">' +
            '<span class="logo-mark flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5">' +
              '<img src="./favicon/web-app-manifest-192x192.png" alt="" class="logo-mark__image">' +
            "</span>" +
            '<div>' +
              '<p class="text-[11px] uppercase tracking-[0.16em] text-white/45 brand-pill__text">IndieRanks</p>' +
              '<p class="text-sm text-white/70 header-subtitle">Tiny app leaderboard</p>' +
            "</div>" +
          "</a>" +
          '<div class="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">' +
            headerActions +
          "</div>" +
        "</div>" +
      "</header>"
    );
  }

  function renderFooter() {
    var target = $("[data-site-footer]");
    if (!target) {
      return;
    }

    setHtml(target, "");
  }

  function setSelectOptions(select, items, selectedValue) {
    if (!select) {
      return;
    }
    select.innerHTML = ui.renderSelectOptions(items, selectedValue);
  }

  function metricOptions() {
    return METRIC_OPTIONS.slice();
  }

  function verificationOptionsByMetric() {
    return {
      mrr: [
        { value: "Stripe", label: "Stripe" },
        { value: "Lemon Squeezy", label: "Lemon Squeezy" },
        { value: "Paddle", label: "Paddle" },
      ],
      users: [
        { value: "GitHub verified", label: "GitHub verified" },
        { value: "Firebase verified", label: "Firebase verified" },
      ],
      downloads: [
        { value: "GitHub verified", label: "GitHub verified" },
        { value: "Firebase verified", label: "Firebase verified" },
      ],
      githubStars: [{ value: "GitHub verified", label: "GitHub verified" }],
    };
  }

  function getVerificationOptions(metricType) {
    var metricKey = ui.normalizeMetricKey(metricType);
    return verificationOptionsByMetric()[metricKey] || verificationOptionsByMetric().mrr;
  }

  function getDefaultVerificationType(metricType) {
    var options = getVerificationOptions(metricType);
    return options[0] ? options[0].value : "Stripe";
  }

  function getVerificationHelpText(metricType) {
    return "";
  }

  function getVerificationReferenceConfig(metricType, verificationType) {
    var metricKey = ui.normalizeMetricKey(metricType);
    var source = String(verificationType || getDefaultVerificationType(metricType)).toLowerCase();

    if (metricKey === "mrr") {
      if (source.indexOf("lemon") >= 0) {
        return {
          label: "Lemon Squeezy API key",
          placeholder: "Paste your Lemon Squeezy API key",
          helpText: "Frontend only for now. Later backend wiring can use a read-only Lemon Squeezy key.",
          inputType: "text",
        };
      }

      if (source.indexOf("paddle") >= 0) {
        return {
          label: "Paddle API key",
          placeholder: "Paste your Paddle API key",
          helpText: "Frontend only for now. Later backend wiring can use a restricted Paddle key.",
          inputType: "text",
        };
      }

      return {
        label: "Stripe API key",
        placeholder: "rk_live_...",
        helpText: "Frontend only for now. Later backend wiring should use a restricted read-only Stripe key.",
        inputType: "text",
      };
    }

    if (metricKey === "githubStars") {
      return {
        label: "GitHub repo URL",
        placeholder: "https://github.com/owner/repo",
        helpText: "We can verify GitHub stars from the repo URL later.",
        inputType: "url",
      };
    }

    if (source.indexOf("github") >= 0) {
      return {
        label: metricKey === "users" ? "GitHub repo or app URL" : "GitHub repo URL",
        placeholder: "https://github.com/owner/repo",
        helpText:
          metricKey === "users"
            ? "Reasonable only if the product's user signal comes from GitHub itself, like a GitHub App or OSS install surface."
            : "Use the repo URL if downloads are tied to GitHub releases.",
        inputType: "url",
      };
    }

    return {
      label: "Firebase project / GA4 property ID",
      placeholder: "my-firebase-project or 123456789",
      helpText:
        metricKey === "users"
          ? "Project ID is fine for now. Real verification later will likely need Firebase Auth admin access for registered users, or GA4/BigQuery if you mean active users."
          : "Project ID is fine for now. Real verification later will likely use GA4/Firebase Analytics first_open or a custom install/download event via GA4 or BigQuery.",
      inputType: "text",
    };
  }

  function leaderboardBracketOptions() {
    return ui.getMrrBracketOptions();
  }

  function leaderboardSortOptions() {
    return ui.getLeaderboardSortOptions();
  }

  function isBracketScoped(state) {
    return state && state.onlyMyBracket !== false && ui.normalizeMrrBracket(state.bracket) !== "all";
  }

  function fairLeaderboardEmptyMessage(state) {
    if (isBracketScoped(state)) {
      return "No projects in " + ui.getMrrBracketLabel(state.bracket) + " yet. Submit the first one.";
    }

    return "No projects listed yet. Submit the first one.";
  }

  function fairLeaderboardCount(projects, state) {
    if (isBracketScoped(state)) {
      return projects.length + " projects in " + ui.getMrrBracketLabel(state.bracket);
    }

    return projects.length + " projects in view";
  }

  function fairLeaderboardSummary(projects, state) {
    if (!projects.length) {
      return fairLeaderboardEmptyMessage(state);
    }

    var topProject = projects[0];
    var bracketContext = isBracketScoped(state) ? " in " + ui.getMrrBracketLabel(state.bracket) : "";
    var sortMode = ui.normalizeSortMode(state.sort);

    if (sortMode === "mrr") {
      return topProject.name + " leads" + bracketContext + " with " + ui.formatCurrency(ui.getProjectMrr(topProject)) + " MRR.";
    }

    if (sortMode === "newest") {
      return topProject.name + " is the newest" + bracketContext + ", added " + ui.relativeDate(topProject.createdAt) + ".";
    }

    return (
      topProject.name +
      " is trending" +
      bracketContext +
      " at " +
      ui.formatPercent(ui.getNumericGrowthPercent(topProject.growthPercent), true) +
      "."
    );
  }

  function competitionBracketLabel(state) {
    var bracket = ui.normalizeMrrBracket(state && state.bracket);
    if (bracket === "all") {
      return "You're competing in: all builders";
    }

    return "You're competing in: " + ui.getMrrBracketLabel(bracket) + " builders";
  }

  function renderLeaderboardInto(container, projects, state, config) {
    var options = config || {};
    var filtered = ui.filterAndSortProjects(projects, state);
    var theme = options.theme || getTheme();

    setHtml(
      container,
      ui.renderLeaderboardHeader(state.metric, state.timeframe, theme) +
        ui.renderLeaderboardRows(filtered, {
          metric: state.metric,
          timeframe: state.timeframe,
          limit: options.limit || filtered.length,
          emptyMessage: options.emptyMessage,
          highlightTop: !!options.highlightTop,
          theme: theme,
        })
    );

    if (options.countTarget) {
      setText(options.countTarget, options.countFormatter ? options.countFormatter(filtered, state) : filtered.length + " projects in view");
    }

    if (options.summaryTarget) {
      if (options.summaryBuilder) {
        setText(options.summaryTarget, options.summaryBuilder(filtered, state));
      } else if (filtered[0]) {
        var topMetric = ui.getDisplayMetric(filtered[0], state.metric, state.timeframe);
        setText(options.summaryTarget, filtered[0].name + " leads with " + topMetric.label + ".");
      } else {
        setText(options.summaryTarget, "No projects match this filter.");
      }
    }

    if (options.linkTarget) {
      options.linkTarget.href = buildUrl("./leaderboard.html", state);
    }

    return filtered;
  }

  async function initHomePage() {
    var leaderboardRoot = $("#homeLeaderboard");
    var heroSearch = $("#homeSearch");
    var leaderboardCount = $("#homeLeaderboardCount");
    var leaderboardSummary = $("#homeLeaderboardSummary");
    var competitionLabel = $("#homeCompetitionLabel");
    var bracketSelect = $("#homeBracketFilter");
    var sortSelect = $("#homeSortFilter");
    var bracketToggle = $("#homeBracketToggle");
    var bracketToggleLabel = $("#homeBracketToggleLabel");
    var params = queryParams();
    var state = {
      query: params.get("q") || "",
      metric: "mrr",
      timeframe: "allTime",
      bracket: params.get("bracket") || "under-100",
      sort: params.get("sort") || "trending",
      onlyMyBracket: params.get("scope") === "bracket",
    };

    if (leaderboardRoot) {
      setHtml(leaderboardRoot, ui.buildLeaderboardSkeleton(12, getTheme()));
    }

    var projects = await store.getProjects();

    if (heroSearch) {
      heroSearch.value = state.query;
    }

    setSelectOptions(bracketSelect, leaderboardBracketOptions(), ui.normalizeMrrBracket(state.bracket));
    setSelectOptions(sortSelect, leaderboardSortOptions(), ui.normalizeSortMode(state.sort));

    if (bracketToggle) {
      bracketToggle.checked = state.onlyMyBracket;
    }

    function syncBracketToggleLabel() {
      if (!bracketToggleLabel || !bracketToggle) {
        return;
      }

      setText(bracketToggleLabel, bracketToggle.checked ? "Only my bracket" : "Show all projects");
    }

    await normalizeBracketScopeForAuth(bracketToggle, state, syncBracketToggleLabel);

    function updateHomeLeaderboard() {
      state.query = heroSearch ? heroSearch.value.trim() : "";
      state.bracket = bracketSelect ? bracketSelect.value : state.bracket;
      state.sort = sortSelect ? sortSelect.value : state.sort;
      state.onlyMyBracket = bracketToggle ? bracketToggle.checked : state.onlyMyBracket;
      syncBracketToggleLabel();

      renderLeaderboardInto(leaderboardRoot, projects, state, {
        countTarget: leaderboardCount,
        summaryTarget: leaderboardSummary,
        countFormatter: fairLeaderboardCount,
        summaryBuilder: fairLeaderboardSummary,
        emptyMessage: fairLeaderboardEmptyMessage(state),
        highlightTop: true,
        theme: getTheme(),
      });

      if (competitionLabel) {
        setText(competitionLabel, competitionBracketLabel(state));
      }
    }

    updateHomeLeaderboard();

    if (heroSearch) {
      heroSearch.addEventListener("input", updateHomeLeaderboard);
    }

    if (bracketSelect) {
      bracketSelect.addEventListener("change", updateHomeLeaderboard);
    }

    if (sortSelect) {
      sortSelect.addEventListener("change", updateHomeLeaderboard);
    }

    if (bracketToggle) {
      bracketToggle.addEventListener("change", function () {
        handleProtectedBracketToggle(bracketToggle, state, syncBracketToggleLabel, updateHomeLeaderboard);
      });
    }

    window.addEventListener("indieranks:themechange", updateHomeLeaderboard);
  }

  async function initLeaderboardPage() {
    var searchInput = $("#leaderboardSearch");
    var bracketSelect = $("#leaderboardBracketFilter");
    var sortSelect = $("#leaderboardSortFilter");
    var bracketToggle = $("#leaderboardBracketToggle");
    var bracketToggleLabel = $("#leaderboardBracketToggleLabel");
    var resultsCount = $("#leaderboardResultsCount");
    var leaderboardRoot = $("#leaderboardRows");
    var summary = $("#leaderboardSummary");
    var competitionLabel = $("#leaderboardCompetitionLabel");
    var params = queryParams();
    var state = {
      query: params.get("q") || "",
      metric: "mrr",
      timeframe: "allTime",
      includeMetricParams: false,
      bracket: params.get("bracket") || "under-100",
      sort: params.get("sort") || "trending",
      onlyMyBracket: params.get("scope") === "bracket",
    };

    if (leaderboardRoot) {
      setHtml(leaderboardRoot, ui.buildLeaderboardSkeleton(14, getTheme()));
    }

    var projects = await store.getProjects();

    if (searchInput) {
      searchInput.value = state.query;
    }
    setSelectOptions(bracketSelect, leaderboardBracketOptions(), ui.normalizeMrrBracket(state.bracket));
    setSelectOptions(sortSelect, leaderboardSortOptions(), ui.normalizeSortMode(state.sort));

    if (bracketToggle) {
      bracketToggle.checked = state.onlyMyBracket;
    }

    function syncBracketToggleLabel() {
      if (!bracketToggleLabel || !bracketToggle) {
        return;
      }

      setText(bracketToggleLabel, bracketToggle.checked ? "Only my bracket" : "Show all projects");
    }

    await normalizeBracketScopeForAuth(bracketToggle, state, syncBracketToggleLabel);

    function syncUrl() {
      var url = buildUrl("./leaderboard.html", state);
      window.history.replaceState({}, "", url);
    }

    function updateLeaderboard() {
      state.query = searchInput ? searchInput.value.trim() : "";
      state.bracket = bracketSelect ? bracketSelect.value : state.bracket;
      state.sort = sortSelect ? sortSelect.value : state.sort;
      state.onlyMyBracket = bracketToggle ? bracketToggle.checked : state.onlyMyBracket;
      syncBracketToggleLabel();

      renderLeaderboardInto(leaderboardRoot, projects, state, {
        countTarget: resultsCount,
        summaryTarget: summary,
        countFormatter: fairLeaderboardCount,
        summaryBuilder: fairLeaderboardSummary,
        emptyMessage: fairLeaderboardEmptyMessage(state),
        highlightTop: true,
        theme: getTheme(),
      });

      if (competitionLabel) {
        setText(competitionLabel, competitionBracketLabel(state));
      }

      syncUrl();
    }

    updateLeaderboard();

    if (searchInput) {
      searchInput.addEventListener("input", updateLeaderboard);
    }
    if (bracketSelect) {
      bracketSelect.addEventListener("change", updateLeaderboard);
    }
    if (sortSelect) {
      sortSelect.addEventListener("change", updateLeaderboard);
    }
    if (bracketToggle) {
      bracketToggle.addEventListener("change", function () {
        handleProtectedBracketToggle(bracketToggle, state, syncBracketToggleLabel, updateLeaderboard);
      });
    }

    window.addEventListener("indieranks:themechange", updateLeaderboard);
  }

  function readFormValues(form) {
    var formData = new FormData(form);
    return {
      projectName: formData.get("projectName"),
      founderName: formData.get("founderName"),
      category: formData.get("category"),
      tagline: formData.get("tagline"),
      metricType: formData.get("metricType"),
      currentMetricValue: formData.get("currentMetricValue"),
      growthPercent: formData.get("growthPercent"),
      websiteUrl: formData.get("websiteUrl"),
      verificationType: formData.get("verificationType"),
      verificationReference: formData.get("verificationReference"),
    };
  }

  function formatFileSize(bytes) {
    var value = Number(bytes) || 0;
    if (value >= 1024 * 1024) {
      return (value / (1024 * 1024)).toFixed(1) + " MB";
    }
    return Math.max(1, Math.round(value / 1024)) + " KB";
  }

  function renderSubmitPreviewIdentity(values) {
    if (values.logoUrl) {
      return (
        '<span class="submit-preview-card__logo logo-mark flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5">' +
          '<img src="' + ui.escapeHtml(values.logoUrl) + '" alt="" class="submit-preview-card__logo-image">' +
        "</span>"
      );
    }

    return ui.renderInitialsBadge(values.projectName || "IndieRanks", "h-12 w-12");
  }

  function renderSubmitPreview(values) {
    var metricKey = ui.normalizeMetricKey(values.metricType || "mrr");
    var value = Number(values.currentMetricValue) || 0;
    var growthValue = Number(values.growthPercent) || 0;
    var growthTone = growthValue > 0 ? "up" : growthValue < 0 ? "down" : "flat";
    var websiteLabel = values.websiteUrl ? String(values.websiteUrl).replace(/^https?:\/\//, "") : "yourapp.com";
    var metricLabel = ui.getDisplayMetric(
      {
        metrics: {
          mrr: metricKey === "mrr" ? value : 0,
          users: metricKey === "users" ? value : 0,
          downloads: metricKey === "downloads" ? value : 0,
          githubStars: metricKey === "githubStars" ? value : 0,
        },
        momentum: 1,
        growthPercent: growthValue,
      },
      metricKey,
      metricKey === "mrr" ? "allTime" : "month"
    );

    return (
      '<div class="panel submit-preview-card rounded-[1.75rem] p-5">' +
        '<div class="submit-preview-card__top">' +
          '<p class="section-kicker">Live preview</p>' +
          ui.renderBadge("Draft", "flat") +
        "</div>" +
        '<div class="submit-preview-card__identity">' +
          renderSubmitPreviewIdentity(values) +
          '<div class="min-w-0">' +
            '<p class="submit-preview-card__name">' +
              ui.escapeHtml(values.projectName || "Your project") +
            "</p>" +
            '<p class="submit-preview-card__meta">' +
              ui.escapeHtml(values.category || "Category") +
            "</p>" +
          "</div>" +
        "</div>" +
        '<p class="submit-preview-card__tagline">' +
          ui.escapeHtml(values.tagline || "Add a plain one-line summary so the leaderboard row reads instantly.") +
        "</p>" +
        '<dl class="submit-preview-card__stats">' +
          '<div><dt>Metric</dt><dd>' + ui.escapeHtml(metricLabel.label) + "</dd></div>" +
          '<div><dt>Growth</dt><dd data-tone="' + growthTone + '">' + ui.escapeHtml(ui.formatPercent(growthValue, true)) + "</dd></div>" +
          '<div><dt>Founder</dt><dd>' + ui.escapeHtml(values.founderName || "Founder name") + "</dd></div>" +
          '<div><dt>Verification</dt><dd>' + ui.escapeHtml(values.verificationType || getDefaultVerificationType(metricKey)) + "</dd></div>" +
        "</dl>" +
        '<p class="submit-preview-card__footer">' + ui.escapeHtml(websiteLabel) + "</p>" +
      "</div>"
    );
  }

  async function initSubmitPage() {
    var form = $("#submitForm");
    var preview = $("#submitPreview");
    var status = $("#submitStatus");
    var submitButton = $("#submitButton");
    var appIconInput = $("#appIconInput");
    var appIconButton = $("#appIconButton");
    var appIconThumbImage = $("#appIconThumbImage");
    var appIconThumbPlaceholder = $("#appIconThumbPlaceholder");
    var appIconButtonLabel = $("#appIconButtonLabel");
    var appIconFileLabel = $("#appIconFileLabel");
    var appIconRemove = $("#appIconRemove");
    var metricSelect = null;
    var verificationSelect = null;
    var verificationHelp = $("#verificationHelp");
    var verificationReferenceInput = $("#verificationReferenceInput");
    var verificationReferenceLabel = $("#verificationReferenceLabel");
    var verificationReferenceHelp = $("#verificationReferenceHelp");
    var params = queryParams();
    var claimSlug = params.get("claim");
    var submitState = {
      logoUrl: "",
      logoFileName: "",
    };

    if (!form) {
      return;
    }

    metricSelect = form.querySelector('[name="metricType"]');
    verificationSelect = form.querySelector('[name="verificationType"]');

    setSelectOptions(
      form.querySelector('[name="category"]'),
      CATEGORY_OPTIONS.map(function (category) {
        return { value: category, label: category };
      }),
      "SaaS"
    );
    setSelectOptions(metricSelect, metricOptions(), "mrr");

    function syncVerificationReferenceField(metricType, verificationType) {
      var config = getVerificationReferenceConfig(metricType, verificationType);

      if (verificationReferenceLabel) {
        setText(verificationReferenceLabel, config.label);
      }

      if (verificationReferenceInput) {
        verificationReferenceInput.type = config.inputType || "text";
        verificationReferenceInput.placeholder = config.placeholder || "";
      }

      if (verificationReferenceHelp) {
        setText(verificationReferenceHelp, config.helpText || "");
      }
    }

    function syncVerificationOptions(selectedVerificationValue) {
      var nextMetric = metricSelect ? metricSelect.value : "mrr";
      var options = getVerificationOptions(nextMetric);
      var selectedValue = selectedVerificationValue;
      var isAllowed = options.some(function (item) {
        return item.value === selectedValue;
      });
      var nextVerification = isAllowed ? selectedValue : getDefaultVerificationType(nextMetric);

      setSelectOptions(verificationSelect, options, nextVerification);

      if (verificationHelp) {
        setText(verificationHelp, getVerificationHelpText(nextMetric));
      }

      syncVerificationReferenceField(nextMetric, nextVerification);
    }

    syncVerificationOptions();

    function updateAppIconThumb() {
      if (!appIconThumbImage || !appIconThumbPlaceholder || !appIconRemove) {
        return;
      }

      if (submitState.logoUrl) {
        appIconThumbImage.src = submitState.logoUrl;
        appIconThumbImage.hidden = false;
        appIconThumbPlaceholder.hidden = true;
        appIconRemove.hidden = false;
        return;
      }

      appIconThumbImage.hidden = true;
      appIconThumbImage.removeAttribute("src");
      appIconThumbPlaceholder.hidden = false;
      appIconRemove.hidden = true;
    }

    function setAppIconMeta(text, state) {
      if (!appIconFileLabel) {
        return;
      }
      setText(appIconFileLabel, text);
      if (state) {
        appIconFileLabel.setAttribute("data-state", state);
      } else {
        appIconFileLabel.removeAttribute("data-state");
      }
    }

    function resetAppIconPicker() {
      submitState.logoUrl = "";
      submitState.logoFileName = "";
      if (appIconInput) {
        appIconInput.value = "";
      }
      if (appIconButtonLabel) {
        setText(appIconButtonLabel, "Add app icon");
      }
      setAppIconMeta("Choose PNG, JPG, WebP, or SVG up to 512 KB");
      updateAppIconThumb();
    }

    function getSubmitValues() {
      return Object.assign(readFormValues(form), {
        logoUrl: submitState.logoUrl,
        logoFileName: submitState.logoFileName,
      });
    }

    function updatePreview() {
      setHtml(preview, renderSubmitPreview(getSubmitValues()));
    }

    resetAppIconPicker();
    updatePreview();
    form.addEventListener("input", updatePreview);
    form.addEventListener("change", updatePreview);

    if (metricSelect) {
      metricSelect.addEventListener("change", function () {
        syncVerificationOptions(verificationSelect ? verificationSelect.value : "");
        updatePreview();
      });
    }

    if (verificationSelect) {
      verificationSelect.addEventListener("change", function () {
        syncVerificationReferenceField(metricSelect ? metricSelect.value : "mrr", verificationSelect.value);
      });
    }

    if (appIconButton && appIconInput) {
      appIconButton.addEventListener("click", function () {
        appIconInput.click();
      });

      appIconButton.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        appIconInput.click();
      });

      appIconInput.addEventListener("change", function () {
        var file = appIconInput.files && appIconInput.files[0];
        if (!file) {
          return;
        }

        if (!/^image\//.test(file.type || "") && !/\.svg$/i.test(file.name || "")) {
          setAppIconMeta("Use an image file: PNG, JPG, WebP, GIF, or SVG.", "error");
          appIconInput.value = "";
          return;
        }

        if (file.size > APP_ICON_MAX_BYTES) {
          setAppIconMeta("App icon must be 512 KB or smaller.", "error");
          appIconInput.value = "";
          return;
        }

        var reader = new FileReader();
        reader.onload = function () {
          submitState.logoUrl = typeof reader.result === "string" ? reader.result : "";
          submitState.logoFileName = file.name || "";
          if (appIconButtonLabel) {
            setText(appIconButtonLabel, "Change app icon");
          }
          setAppIconMeta((file.name || "Selected image") + " • " + formatFileSize(file.size));
          updateAppIconThumb();
          updatePreview();
        };
        reader.onerror = function () {
          setAppIconMeta("Could not read that image. Try a different file.", "error");
          appIconInput.value = "";
        };
        reader.readAsDataURL(file);
      });
    }

    if (appIconRemove) {
      appIconRemove.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();
        resetAppIconPicker();
        updatePreview();
      });
    }

    if (claimSlug) {
      setHtml(
        status,
        '<div class="rounded-[1.5rem] border border-signal/20 bg-signal/10 px-4 py-3 text-sm text-white/75">Claim flow starter: this submission can be used to claim <span class="font-mono text-white">' +
          ui.escapeHtml(claimSlug) +
          "</span> and attach a better founder profile later.</div>"
      );
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!form.reportValidity()) {
        return;
      }

      var values = getSubmitValues();
      submitButton.disabled = true;
      submitButton.textContent = "Listing...";
      setHtml(
        status,
        '<div class="rounded-[1.5rem] border border-white/8 bg-white/4 px-4 py-3 text-sm text-white/65">Saving your submission and creating a project profile.</div>'
      );

      try {
        var result = await store.submitProject(values);
        setHtml(
          status,
          '<div class="panel success-ring rounded-[1.5rem] p-5">' +
            '<div class="flex items-start gap-4">' +
              '<div class="logo-mark flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5">' +
                '<img src="./favicon/web-app-manifest-192x192.png" alt="" class="logo-mark__image">' +
              "</div>" +
              '<div>' +
                '<p class="text-lg font-semibold text-white">Project listed</p>' +
                '<p class="mt-2 text-sm leading-6 text-white/70">' +
                  "Saved to Firestore and mirrored into the live project and founder collections." +
                "</p>" +
                '<div class="mt-4 flex flex-wrap gap-3">' +
                  '<a href="./project.html?id=' + encodeURIComponent(result.project.slug) + '" class="rounded-full bg-white px-4 py-2 text-sm font-medium text-black hover:bg-accent">View project</a>' +
                  '<a href="./leaderboard.html?q=' + encodeURIComponent(result.project.name) + '" class="chip-link rounded-full px-4 py-2 text-sm">See it on the leaderboard</a>' +
                "</div>" +
              "</div>" +
            "</div>" +
          "</div>"
        );
        form.reset();
        resetAppIconPicker();
        updatePreview();
      } catch (error) {
        console.error(error);
        var message =
          error && error.message === "Projects at $20k MRR or above are not eligible for IndieRanks."
            ? error.message + " Once a project hits $20k MRR, it graduates off the leaderboard."
            : (error && error.message) || "Submission failed. Check your Firebase rules and connection, then try again.";
        setHtml(
          status,
          '<div class="rounded-[1.5rem] border border-rose/20 bg-rose/10 px-4 py-3 text-sm text-white/80">' +
            ui.escapeHtml(message) +
          "</div>"
        );
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "List project";
      }
    });
  }

  function metricCard(project, key, timeframe) {
    var display = ui.getDisplayMetric(project, key, timeframe);
    return (
      '<div class="panel rounded-3xl px-5 py-5">' +
        '<p class="text-[11px] font-mono uppercase tracking-[0.2em] text-white/45">' +
          ui.escapeHtml(display.shortLabel) +
        "</p>" +
        '<p class="mt-3 text-2xl font-semibold tracking-tight text-white">' +
          ui.escapeHtml(display.label) +
        "</p>" +
      "</div>"
    );
  }

  async function initProjectPage() {
    var root = $("#projectDetail");
    if (!root) {
      return;
    }

    setHtml(
      root,
      '<div class="panel rounded-3xl p-8"><div class="skeleton h-10 rounded-2xl"></div><div class="mt-4 skeleton h-40 rounded-3xl"></div><div class="mt-4 grid gap-4 md:grid-cols-3"><div class="skeleton h-24 rounded-3xl"></div><div class="skeleton h-24 rounded-3xl"></div><div class="skeleton h-24 rounded-3xl"></div></div></div>'
    );

    var slug = queryParams().get("id");
    var project = await store.getProjectBySlug(slug);

    if (!project) {
      setHtml(
        root,
        '<div class="empty-panel rounded-3xl px-6 py-12 text-center text-white/60">No project found yet.</div>'
      );
      return;
    }

    var founder = await store.getFounderBySlug(project.founderSlug);
    var allProjects = await store.getProjects();
    var relatedProjects = allProjects.filter(function (item) {
      return item.founderSlug === project.founderSlug && item.slug !== project.slug;
    });
    var growth = ui.getGrowthValue(project, "allTime");
    var growthTone = growth >= 0 ? "up" : "down";

    setHtml(
      root,
      '<div class="grid gap-6 lg:grid-cols-[1.45fr,0.85fr]">' +
        '<section class="space-y-6">' +
          '<div class="panel rounded-[2rem] p-6 sm:p-8">' +
            '<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">' +
              '<div class="flex items-start gap-4">' +
                ui.renderInitialsBadge(project.name, "h-16 w-16", project.logoUrl) +
                '<div class="min-w-0">' +
                  '<div class="flex flex-wrap items-center gap-2">' +
                    '<h1 class="text-3xl font-semibold tracking-tight text-white sm:text-4xl">' + ui.escapeHtml(project.name) + "</h1>" +
                    ui.renderBadge(project.category, "flat") +
                    (project.verified ? ui.renderBadge("VERIFIED", "up") : "") +
                  "</div>" +
                  '<p class="mt-3 max-w-2xl text-base leading-7 text-white/72">' + ui.escapeHtml(project.description) + "</p>" +
                  '<div class="mt-4 flex flex-wrap items-center gap-3 text-sm text-white/65">' +
                    '<a href="./founder.html?id=' + encodeURIComponent(project.founderSlug) + '" class="hover:text-white">By ' + ui.escapeHtml(project.founderName) + "</a>" +
                    '<span class="h-1 w-1 rounded-full bg-white/20"></span>' +
                    '<span>' + ui.escapeHtml(ui.relativeDate(project.createdAt)) + "</span>" +
                    '<span class="h-1 w-1 rounded-full bg-white/20"></span>' +
                    '<a href="' + ui.escapeHtml(project.websiteUrl) + '" target="_blank" rel="noreferrer" class="hover:text-white">Visit website</a>' +
                  "</div>" +
                "</div>" +
              "</div>" +
              '<div class="panel rounded-3xl px-5 py-5 lg:min-w-[250px]">' +
                '<p class="text-[11px] font-mono uppercase tracking-[0.2em] text-white/45">Current traction</p>' +
                '<p class="mt-3 text-3xl font-semibold tracking-tight text-white">' + ui.escapeHtml(ui.getDisplayMetric(project, project.primaryMetricKey, project.primaryMetricKey === "mrr" ? "allTime" : "month").label) + "</p>" +
                '<div class="mt-4 flex items-center gap-2">' + ui.renderBadge(ui.formatPercent(growth, true), growthTone) + ui.renderBadge(project.verificationType, "flat") + "</div>" +
              "</div>" +
            "</div>" +
            '<div class="sparkline-wrap mt-8 rounded-[1.75rem] p-4 sm:p-5">' +
              '<div class="flex items-center justify-between gap-4 text-sm">' +
                '<div>' +
                  '<p class="text-[11px] font-mono uppercase tracking-[0.22em] text-white/40">Momentum</p>' +
                  '<p class="mt-1 text-white/70">A scrappy 14-point sparkline for the current headline metric.</p>' +
                "</div>" +
                '<a href="./submit.html?claim=' + encodeURIComponent(project.slug) + '" class="chip-link rounded-full px-4 py-2 text-sm">Claim this project</a>' +
              "</div>" +
              '<canvas id="projectSparkline" class="mt-5 h-56 w-full"></canvas>' +
            "</div>" +
          "</div>" +
          '<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">' +
            metricCard(project, "mrr", "allTime") +
            metricCard(project, "users", "month") +
            metricCard(project, "downloads", "month") +
            metricCard(project, "githubStars", "allTime") +
            '<div class="panel rounded-3xl px-5 py-5">' +
              '<p class="text-[11px] font-mono uppercase tracking-[0.2em] text-white/45">Primary growth</p>' +
              '<p class="mt-3 text-2xl font-semibold tracking-tight text-white">' + ui.escapeHtml(ui.formatPercent(project.growthPercent, true)) + "</p>" +
            "</div>" +
          "</div>" +
          '<div class="panel rounded-[2rem] p-6 sm:p-8">' +
            '<div class="flex items-center justify-between gap-4">' +
              '<div>' +
                '<p class="section-kicker">Tiny wins history</p>' +
                '<h2 class="mt-2 text-2xl font-semibold tracking-tight text-white">Milestones worth caring about</h2>' +
              "</div>" +
              '<span class="rounded-full border border-white/8 bg-white/4 px-3 py-2 text-[11px] font-mono uppercase tracking-[0.18em] text-white/50">' + project.tinyWins.length + " wins</span>" +
            "</div>" +
            '<div class="mt-6 space-y-3">' +
              project.tinyWins.map(function (win) {
                return (
                  '<div class="rounded-3xl border border-white/8 bg-white/[0.025] px-5 py-4">' +
                    '<div class="flex flex-wrap items-center justify-between gap-3">' +
                      '<div class="flex flex-wrap items-center gap-2">' +
                        ui.renderBadge(win.badge || win.label, win.badge === "NEW" ? "up" : "flat") +
                        '<p class="font-medium text-white">' + ui.escapeHtml(win.label) + "</p>" +
                      "</div>" +
                      '<span class="text-[11px] font-mono uppercase tracking-[0.18em] text-white/40">' + ui.escapeHtml(ui.relativeDate(win.date)) + "</span>" +
                    "</div>" +
                    '<p class="mt-2 text-sm leading-6 text-white/68">' + ui.escapeHtml(win.note || "Quiet progress, recorded.") + "</p>" +
                  "</div>"
                );
              }).join("") +
            "</div>" +
          "</div>" +
        "</section>" +
        '<aside class="space-y-6">' +
          '<div class="panel rounded-[2rem] p-6">' +
            '<p class="section-kicker">Founder</p>' +
            '<div class="mt-4 flex items-start gap-4">' +
              ui.renderInitialsBadge(founder ? founder.name : project.founderName, "h-14 w-14") +
              '<div>' +
                '<a href="./founder.html?id=' + encodeURIComponent(project.founderSlug) + '" class="text-xl font-semibold tracking-tight text-white hover:text-accent">' + ui.escapeHtml(founder ? founder.name : project.founderName) + "</a>" +
                '<p class="mt-2 text-sm leading-6 text-white/68">' + ui.escapeHtml((founder && founder.bio) || "Claim this profile to add a real founder bio.") + "</p>" +
              "</div>" +
            "</div>" +
            '<div class="mt-5 flex flex-wrap gap-2">' +
              ((founder && founder.milestones) || []).slice(0, 4).map(function (milestone) {
                return ui.renderBadge(milestone, "flat");
              }).join("") +
            "</div>" +
          "</div>" +
          '<div class="panel rounded-[2rem] p-6">' +
            '<p class="section-kicker">Verification</p>' +
            '<h2 class="mt-2 text-xl font-semibold tracking-tight text-white">' + ui.escapeHtml(project.verificationType) + "</h2>" +
            '<p class="mt-3 text-sm leading-6 text-white/68">Verification is source-based for now: billing providers for MRR, GitHub for stars, and GitHub or Firebase for user and download metrics.</p>' +
          "</div>" +
          '<div class="panel rounded-[2rem] p-6">' +
            '<p class="section-kicker">Builder pack</p>' +
            '<div class="mt-4 powered-badge rounded-3xl px-4 py-4">' +
              '<p class="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">Powered by IndieRanks</p>' +
              '<p class="mt-2 text-sm leading-6 text-white/72">A future embeddable badge for showing traction on your own landing page.</p>' +
            "</div>" +
          "</div>" +
          '<div class="panel rounded-[2rem] p-6">' +
            '<div class="flex items-center justify-between gap-4">' +
              '<p class="section-kicker">More from this founder</p>' +
              '<span class="text-sm text-white/45">' + relatedProjects.length + " more</span>" +
            "</div>" +
            '<div class="mt-4 space-y-3">' +
              (relatedProjects.length
                ? relatedProjects.slice(0, 3).map(function (item) {
                    return (
                      '<a href="./project.html?id=' + encodeURIComponent(item.slug) + '" class="block rounded-3xl border border-white/8 bg-white/[0.025] px-4 py-4 hover:border-white/12 hover:bg-white/[0.04]">' +
                        '<div class="flex items-center justify-between gap-3">' +
                          '<span class="font-medium text-white">' + ui.escapeHtml(item.name) + "</span>" +
                          '<span class="font-mono text-xs text-white/50">' + ui.escapeHtml(ui.getDisplayMetric(item, item.primaryMetricKey, item.primaryMetricKey === "mrr" ? "allTime" : "month").label) + "</span>" +
                        "</div>" +
                        '<p class="mt-2 text-sm text-white/62">' + ui.escapeHtml(item.tagline) + "</p>" +
                      "</a>"
                    );
                  }).join("")
                : '<div class="empty-panel rounded-3xl px-4 py-5 text-sm text-white/58">No other listed projects from this founder yet.</div>') +
            "</div>" +
          "</div>" +
        "</aside>" +
      "</div>"
    );

    window.requestAnimationFrame(function () {
      ui.drawSparkline($("#projectSparkline"), project.history, growthTone);
    });
  }

  async function initFounderPage() {
    var root = $("#founderDetail");
    if (!root) {
      return;
    }

    setHtml(
      root,
      '<div class="panel rounded-3xl p-8"><div class="skeleton h-10 rounded-2xl"></div><div class="mt-4 skeleton h-48 rounded-3xl"></div></div>'
    );

    var slug = queryParams().get("id");
    var founder = await store.getFounderBySlug(slug);
    var allProjects = await store.getProjects();

    if (!founder) {
      setHtml(
        root,
        '<div class="empty-panel rounded-3xl px-6 py-12 text-center text-white/60">No founder found yet.</div>'
      );
      return;
    }

    var projects = allProjects.filter(function (project) {
      return project.founderSlug === founder.slug;
    });
    var combinedMrr = projects.reduce(function (sum, project) {
      return sum + (project.metrics.mrr || 0);
    }, 0);
    var totalMetricCount = projects.length * 4;
    var recentMilestones = projects
      .reduce(function (items, project) {
        project.tinyWins.forEach(function (win) {
          items.push({
            projectSlug: project.slug,
            projectName: project.name,
            label: win.label,
            note: win.note,
            date: win.date,
          });
        });
        return items;
      }, [])
      .sort(function (left, right) {
        return new Date(right.date).getTime() - new Date(left.date).getTime();
      })
      .slice(0, 6);

    setHtml(
      root,
      '<div class="space-y-6">' +
        '<section class="panel rounded-[2rem] p-6 sm:p-8">' +
          '<div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">' +
            '<div class="flex items-start gap-4">' +
              ui.renderInitialsBadge(founder.name, "h-16 w-16") +
              '<div class="max-w-2xl">' +
                '<p class="section-kicker">Founder profile</p>' +
                '<h1 class="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">' + ui.escapeHtml(founder.name) + "</h1>" +
                '<p class="mt-4 text-base leading-7 text-white/72">' + ui.escapeHtml(founder.bio) + "</p>" +
                '<div class="mt-4 flex flex-wrap gap-2">' +
                  founder.milestones.slice(0, 6).map(function (milestone) {
                    return ui.renderBadge(milestone, "flat");
                  }).join("") +
                "</div>" +
              "</div>" +
            "</div>" +
            '<div class="grid gap-3 sm:grid-cols-2 lg:w-[360px]">' +
              '<div class="panel rounded-3xl px-4 py-4"><p class="text-[11px] font-mono uppercase tracking-[0.2em] text-white/45">Projects</p><p class="mt-3 text-2xl font-semibold tracking-tight text-white">' + projects.length + "</p></div>" +
              '<div class="panel rounded-3xl px-4 py-4"><p class="text-[11px] font-mono uppercase tracking-[0.2em] text-white/45">Tracked metrics</p><p class="mt-3 text-2xl font-semibold tracking-tight text-white">' + totalMetricCount + "</p></div>" +
              '<div class="panel rounded-3xl px-4 py-4"><p class="text-[11px] font-mono uppercase tracking-[0.2em] text-white/45">Combined MRR</p><p class="mt-3 text-2xl font-semibold tracking-tight text-white">' + ui.escapeHtml(ui.formatCurrency(combinedMrr)) + "</p></div>" +
              '<div class="panel rounded-3xl px-4 py-4"><p class="text-[11px] font-mono uppercase tracking-[0.2em] text-white/45">Joined</p><p class="mt-3 text-2xl font-semibold tracking-tight text-white">' + ui.escapeHtml(ui.relativeDate(founder.createdAt)) + "</p></div>" +
            "</div>" +
          "</div>" +
        "</section>" +
        '<section class="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">' +
          '<div class="panel rounded-[2rem] p-6 sm:p-8">' +
            '<div class="flex items-center justify-between gap-4">' +
              '<div>' +
                '<p class="section-kicker">Projects</p>' +
                '<h2 class="mt-2 text-2xl font-semibold tracking-tight text-white">Everything this founder is tracking</h2>' +
              "</div>" +
              '<a href="./submit.html" class="chip-link rounded-full px-4 py-2 text-sm">Add another project</a>' +
            "</div>" +
            '<div class="mt-6 grid gap-4 xl:grid-cols-2">' +
              projects.map(function (project) {
                return ui.renderProjectCard(project);
              }).join("") +
            "</div>" +
          "</div>" +
          '<div class="space-y-6">' +
            '<div class="panel rounded-[2rem] p-6">' +
              '<p class="section-kicker">Recent milestones</p>' +
              '<div class="mt-4 space-y-3">' +
                (recentMilestones.length
                  ? recentMilestones.map(function (milestone) {
                      return (
                        '<a href="./project.html?id=' + encodeURIComponent(milestone.projectSlug) + '" class="block rounded-3xl border border-white/8 bg-white/[0.025] px-4 py-4 hover:border-white/12 hover:bg-white/[0.04]">' +
                          '<div class="flex items-center justify-between gap-3">' +
                            '<p class="font-medium text-white">' + ui.escapeHtml(milestone.label) + "</p>" +
                            '<span class="text-[11px] font-mono uppercase tracking-[0.18em] text-white/40">' + ui.escapeHtml(ui.relativeDate(milestone.date)) + "</span>" +
                          "</div>" +
                          '<p class="mt-2 text-sm text-white/62">' + ui.escapeHtml(milestone.note || milestone.projectName) + "</p>" +
                          '<p class="mt-2 text-sm font-medium text-accent">' + ui.escapeHtml(milestone.projectName) + "</p>" +
                        "</a>"
                      );
                    }).join("")
                  : '<div class="empty-panel rounded-3xl px-4 py-5 text-sm text-white/58">No milestones recorded yet.</div>') +
              "</div>" +
            "</div>" +
            '<div class="panel rounded-[2rem] p-6">' +
              '<p class="section-kicker">Why IndieRanks exists</p>' +
              '<p class="mt-3 text-sm leading-6 text-white/70">This profile sits inside a leaderboard designed for builders comparing themselves to peers with similar scale, not billion-dollar outliers.</p>' +
              '<div class="powered-badge mt-5 rounded-3xl px-4 py-4">' +
                '<p class="font-mono text-[11px] uppercase tracking-[0.2em] text-white/55">Small app status game</p>' +
                '<p class="mt-2 text-sm leading-6 text-white/72">Leaderboards, founder profiles, and tiny wins turn traction into something social without getting bloated.</p>' +
              "</div>" +
            "</div>" +
          "</div>" +
        "</section>" +
      "</div>"
    );
  }

  renderHeader();
  renderFooter();
  applyTheme(getTheme(), getStoredTheme() ? "manual" : "system");
  ensureThemeToggle();
  ensureAuthReady();

  if (window.matchMedia) {
    var themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    if (themeMediaQuery.addEventListener) {
      themeMediaQuery.addEventListener("change", syncThemeWithSystem);
    } else if (themeMediaQuery.addListener) {
      themeMediaQuery.addListener(syncThemeWithSystem);
    }
  }

  if (page === "home") {
    initHomePage();
  } else if (page === "leaderboard") {
    initLeaderboardPage();
  } else if (page === "submit") {
    initSubmitPage();
  } else if (page === "project") {
    initProjectPage();
  } else if (page === "founder") {
    initFounderPage();
  }
})();
