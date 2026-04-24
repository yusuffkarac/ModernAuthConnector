(() => {
  const root = document.documentElement;
  const body = document.body;

  const paneConfig = {
    sidebar: {
      cssVar: "--sidebar-width",
      storageKey: "outlook.sidebarWidth",
      min: 180,
      max: 420,
      disabledAt: 860,
    },
    list: {
      cssVar: "--list-width",
      storageKey: "outlook.listWidth",
      min: 280,
      max: 560,
      disabledAt: 640,
    },
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const applyStoredWidths = () => {
    Object.values(paneConfig).forEach((config) => {
      const stored = Number(window.localStorage.getItem(config.storageKey));
      if (!Number.isFinite(stored) || stored <= 0) return;
      root.style.setProperty(config.cssVar, `${clamp(stored, config.min, config.max)}px`);
    });
  };

  const bindResizer = (resizer) => {
    const targetKey = resizer.dataset.resizeTarget;
    const config = paneConfig[targetKey];
    if (!config) return;

    const onPointerDown = (event) => {
      if (window.innerWidth <= config.disabledAt) return;

      event.preventDefault();
      resizer.classList.add("is-active");
      body.classList.add("is-resizing");

      const startX = event.clientX;
      const initialWidth = parseFloat(getComputedStyle(root).getPropertyValue(config.cssVar));

      const onPointerMove = (moveEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const nextWidth = clamp(initialWidth + deltaX, config.min, config.max);
        root.style.setProperty(config.cssVar, `${nextWidth}px`);
      };

      const onPointerUp = () => {
        const finalWidth = parseFloat(getComputedStyle(root).getPropertyValue(config.cssVar));
        window.localStorage.setItem(config.storageKey, String(Math.round(finalWidth)));
        resizer.classList.remove("is-active");
        body.classList.remove("is-resizing");
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
      };

      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp, { once: true });
    };

    resizer.addEventListener("pointerdown", onPointerDown);
  };

  applyStoredWidths();
  document.querySelectorAll(".pane-resizer").forEach(bindResizer);
})();
