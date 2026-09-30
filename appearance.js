// Synchronous first paint, shared controls, separate device preferences for each area.
(() => {
  const scope = document.currentScript.dataset.appearanceScope;
  const preferenceScope = scope === "teacher" || new URLSearchParams(location.search).has("teacherPractice")
    ? "teacher" : "student";
  const storageKey = `lerndeck-${preferenceScope}-appearance-v1`;
  let mode = "dark";
  try {
    // Existing teacher variant preferences migrate by retaining their brightness.
    mode = JSON.parse(localStorage.getItem(storageKey))?.mode === "light" ? "light" : "dark";
  } catch {
    // An unavailable/invalid preference uses the established dark default.
  }

  function syncButton(button) {
    button.setAttribute("aria-checked", String(mode === "light"));
    button.querySelector("[data-appearance-label]").textContent = mode === "light" ? "Hell" : "Dunkel";
  }

  function apply() {
    document.documentElement.dataset.appearanceScope = scope;
    document.documentElement.dataset.appearanceMode = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = mode === "light" ? "#e3ebe5" : "#141b28";
    document.querySelectorAll("[data-appearance-switch]").forEach(syncButton);
  }

  function setMode(nextMode) {
    mode = nextMode === "light" ? "light" : "dark";
    apply();
    try { localStorage.setItem(storageKey, JSON.stringify({ mode })); } catch {
      // The switch still works for this visit when storage is blocked.
    }
  }

  window.LerndeckAppearance = {
    getMode: () => mode,
    setMode,
    createSwitch({ menuItem = false } = {}) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "appearance-switch";
      button.dataset.appearanceSwitch = "";
      button.setAttribute("role", menuItem ? "menuitemcheckbox" : "switch");
      button.setAttribute("aria-label", "Helles Design");
      button.innerHTML = '<span data-appearance-label></span><span class="appearance-switch__track" aria-hidden="true"></span>';
      syncButton(button);
      button.addEventListener("click", () => setMode(mode === "light" ? "dark" : "light"));
      return button;
    },
  };
  apply();
})();
