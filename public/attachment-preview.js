(() => {
  const ROOT_ID = "attachment-preview-root";
  let root;
  let captionEl;
  let bodyEl;
  let closeBtn;
  let backdropBtn;
  let lastFocus;

  function ensureDom() {
    if (root) {
      return;
    }
    root = document.getElementById(ROOT_ID);
    if (root) {
      captionEl = root.querySelector("[data-preview-caption]");
      bodyEl = root.querySelector("[data-preview-body]");
      closeBtn = root.querySelector("[data-preview-close]");
      backdropBtn = root.querySelector("[data-preview-backdrop]");
      bindRootEvents();
      return;
    }

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.className = "attachment-preview-modal";
    root.setAttribute("hidden", "");
    root.setAttribute("aria-hidden", "true");
    root.innerHTML = `
      <button type="button" class="attachment-preview-backdrop" data-preview-backdrop aria-label="Kapat"></button>
      <div class="attachment-preview-dialog" role="dialog" aria-modal="true" aria-labelledby="attachment-preview-caption">
        <div class="attachment-preview-toolbar">
          <span id="attachment-preview-caption" class="attachment-preview-caption" data-preview-caption></span>
          <button type="button" class="attachment-preview-close" data-preview-close aria-label="Kapat">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
        <div class="attachment-preview-body" data-preview-body></div>
      </div>
    `;
    document.body.appendChild(root);
    captionEl = root.querySelector("[data-preview-caption]");
    bodyEl = root.querySelector("[data-preview-body]");
    closeBtn = root.querySelector("[data-preview-close]");
    backdropBtn = root.querySelector("[data-preview-backdrop]");
    bindRootEvents();
  }

  function bindRootEvents() {
    const close = () => closePreview();
    closeBtn.addEventListener("click", close);
    backdropBtn.addEventListener("click", close);
  }

  function onKeydown(e) {
    if (e.key === "Escape") {
      closePreview();
    }
  }

  function openPreview(url, title, kind) {
    ensureDom();
    lastFocus = document.activeElement;
    captionEl.textContent = title || "Önizleme";
    bodyEl.innerHTML = "";

    if (kind === "image") {
      const img = document.createElement("img");
      img.className = "attachment-preview-img";
      img.alt = title || "";
      img.src = url;
      bodyEl.appendChild(img);
    } else {
      const frame = document.createElement("iframe");
      frame.className = "attachment-preview-frame";
      frame.title = title || "Önizleme";
      frame.src = url;
      bodyEl.appendChild(frame);
    }

    root.removeAttribute("hidden");
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("attachment-preview-open");
    document.addEventListener("keydown", onKeydown);
    closeBtn.focus();
  }

  function closePreview() {
    if (!root || root.hasAttribute("hidden")) {
      return;
    }
    bodyEl.innerHTML = "";
    root.setAttribute("hidden", "");
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("attachment-preview-open");
    document.removeEventListener("keydown", onKeydown);
    if (lastFocus && typeof lastFocus.focus === "function") {
      lastFocus.focus();
    }
  }

  document.addEventListener(
    "click",
    (e) => {
      const btn = e.target.closest(".detail-attachment-preview[data-preview-url]");
      if (!btn) {
        return;
      }
      e.preventDefault();
      const url = btn.getAttribute("data-preview-url");
      const title = btn.getAttribute("data-preview-title") || "";
      const kind = btn.getAttribute("data-preview-kind") || "frame";
      if (!url) {
        return;
      }
      openPreview(url, title, kind);
    },
    true
  );
})();
