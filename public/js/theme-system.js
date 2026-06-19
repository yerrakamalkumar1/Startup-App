(function () {
  "use strict";

  const STORAGE_KEY = "connecthub_theme";

  const ConnectHubTheme = {
    _theme: "system",
    _resolved: "light",
    _mediaQuery: null,
    _onChangeCallbacks: [],

    get theme() {
      return this._theme;
    },

    get resolved() {
      return this._resolved;
    },

    init() {
      const saved = localStorage.getItem(STORAGE_KEY) || "system";
      this._theme = saved;

      this._mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

      this._apply(saved);
      this._listenSystem();

      document.documentElement.dataset.themeReady = "true";
      document.dispatchEvent(new CustomEvent("connecthub:theme-ready", { detail: { theme: this._theme, resolved: this._resolved } }));

      return this;
    },

    _resolve(theme) {
      if (theme === "system") {
        return this._mediaQuery.matches ? "dark" : "light";
      }
      return theme;
    },

    _apply(theme) {
      const resolved = this._resolve(theme);
      this._resolved = resolved;
      document.documentElement.dataset.theme = resolved;
      document.documentElement.classList.toggle("dark", resolved === "dark");

      if (theme !== "system") {
        document.documentElement.dataset.themeMode = theme;
      } else {
        delete document.documentElement.dataset.themeMode;
      }

      this._updateToggleButton();
      this._notify();
    },

    _listenSystem() {
      this._mediaQuery.addEventListener("change", (e) => {
        if (this._theme === "system") {
          this._apply("system");
        }
      });
    },

    setTheme(mode) {
      if (!["light", "dark", "system"].includes(mode)) return;
      this._theme = mode;
      localStorage.setItem(STORAGE_KEY, mode);
      this._apply(mode);
    },

    toggle() {
      const next = this._resolved === "light" ? "dark" : "light";
      this.setTheme(next);
    },

    onThemeChange(callback) {
      if (typeof callback === "function") {
        this._onChangeCallbacks.push(callback);
      }
    },

    _notify() {
      this._onChangeCallbacks.forEach((cb) => {
        try {
          cb({ theme: this._theme, resolved: this._resolved });
        } catch (e) {
          console.warn("[ConnectHubTheme] callback error:", e);
        }
      });
    },

    _getSvgIcon() {
      return this._resolved === "light"
        ? `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z"/></svg>`
        : `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.293 1.707a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zm2.828 2.828a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zm2.828 2.829a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm2.657-1.293a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM10 18a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zm-4.293-1.707a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zm-2.828-2.829a1 1 0 010 1.414l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 0zM3 11a1 1 0 100-2H2a1 1 0 100 2h1zm-2.657-1.293a1 1 0 011.414 0l.707.707a1 1 0 11-1.414 1.414l-.707-.707a1 1 0 010-1.414zM10 5a5 5 0 100 10 5 5 0 000-10z" clip-rule="evenodd"/></svg>`;
    },

    _updateToggleButton() {
      document.querySelectorAll("[data-theme-toggle]").forEach((btn) => {
        btn.innerHTML = this._getSvgIcon();
        btn.setAttribute("aria-label", `Switch to ${this._resolved === "light" ? "dark" : "light"} mode`);
        btn.title = `Switch to ${this._resolved === "light" ? "dark" : "light"} mode`;
      });
    },

    createToggleButton(options) {
      options = options || {};
      const btn = document.createElement("button");
      btn.setAttribute("data-theme-toggle", "");
      btn.className = options.className || "btn btn-ghost";
      btn.setAttribute("aria-label", "Toggle theme");
      btn.innerHTML = this._getSvgIcon();
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        this.toggle();
      });
      return btn;
    },

    injectToggle(selector) {
      const parent = document.querySelector(selector);
      if (!parent) return null;
      const btn = this.createToggleButton({ className: parent.dataset.themeToggleClass || "btn btn-ghost" });
      parent.appendChild(btn);
      return btn;
    }
  };

  window.ConnectHubTheme = ConnectHubTheme;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => ConnectHubTheme.init());
  } else {
    ConnectHubTheme.init();
  }
})();
