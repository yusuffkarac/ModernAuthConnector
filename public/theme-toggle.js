(() => {
  const STORAGE = "mac-theme";
  const root = document.documentElement;

  function applyResolved(mode) {
    let resolved = "light";
    if (mode === "dark") resolved = "dark";
    else if (mode === "light") resolved = "light";
    else if (mode === "system" || !mode) {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    root.setAttribute("data-theme", resolved);
  }

  function getMode() {
    try {
      return localStorage.getItem(STORAGE) || "system";
    } catch {
      return "system";
    }
  }

  function setMode(mode) {
    try {
      localStorage.setItem(STORAGE, mode);
    } catch {
      /* ignore */
    }
    applyResolved(mode);
    updateToggleIcon();
  }

  function updateToggleIcon() {
    const btn = document.getElementById("mac-theme-toggle");
    if (!btn) return;
    const icon = btn.querySelector(".material-symbols-outlined");
    const m = getMode();
    let sym = "brightness_auto";
    if (m === "light") sym = "dark_mode";
    if (m === "dark") sym = "light_mode";
    if (icon) icon.textContent = sym;
    btn.title = m === "light" ? "Açık tema (tıkla: koyu)" : m === "dark" ? "Koyu tema (tıkla: sistem)" : "Sistem teması (tıkla: açık)";
  }

  function cycle() {
    const order = ["system", "light", "dark"];
    const cur = getMode();
    const i = order.indexOf(cur);
    const next = order[(i + 1) % order.length];
    setMode(next);
  }

  const initial = getMode();
  applyResolved(initial);
  updateToggleIcon();

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (getMode() === "system") {
      applyResolved("system");
      updateToggleIcon();
    }
  });

  document.getElementById("mac-theme-toggle")?.addEventListener("click", cycle);
})();
