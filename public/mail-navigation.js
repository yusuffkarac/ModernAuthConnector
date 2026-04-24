(() => {
  const mailList = document.querySelector(".mail-list");
  const readingPane = document.querySelector(".reading-pane");

  if (!mailList || !readingPane) {
    return;
  }

  const setActiveMail = (targetItem) => {
    mailList.querySelectorAll("[data-mail-item='true']").forEach((item) => {
      item.classList.remove("active");
    });
    targetItem.classList.add("active");
  };

  const buildUrl = (folder, uid) => {
    const params = new URLSearchParams({ folder, uid });
    return `/?${params.toString()}`;
  };

  const renderLoadingMarkup = () => {
    return `
      <div class="mail-loading">
        <div class="mail-loading-topbar">
          <div class="mail-loading-chip"></div>
          <div class="mail-loading-chip"></div>
          <div class="mail-loading-chip short"></div>
        </div>
        <div class="mail-loading-content">
          <div class="mail-loading-title"></div>
          <div class="mail-loading-meta">
            <div class="mail-loading-avatar"></div>
            <div class="mail-loading-meta-lines">
              <div class="mail-loading-line w60"></div>
              <div class="mail-loading-line w35"></div>
            </div>
          </div>
          <div class="mail-loading-line w90"></div>
          <div class="mail-loading-line w100"></div>
          <div class="mail-loading-line w95"></div>
          <div class="mail-loading-line w70"></div>
        </div>
      </div>
    `;
  };

  const loadDetail = async (mailItem, pushHistory = true) => {
    const folder = mailItem.dataset.folder || "";
    const uid = mailItem.dataset.uid || "";
    if (!folder || !uid) return;

    const previousHtml = readingPane.innerHTML;
    readingPane.classList.add("is-loading");
    readingPane.innerHTML = renderLoadingMarkup();
    readingPane.setAttribute("aria-busy", "true");
    try {
      const detailRes = await fetch(
        `/api/messages/detail?folder=${encodeURIComponent(folder)}&uid=${encodeURIComponent(uid)}`
      );
      const result = await detailRes.json();

      if (!detailRes.ok || !result.ok || typeof result.html !== "string") {
        throw new Error(result.error || "Mail detayi yuklenemedi.");
      }

      readingPane.classList.remove("is-loading");
      readingPane.innerHTML = result.html;
      setActiveMail(mailItem);

      if (pushHistory) {
        const url = buildUrl(folder, uid);
        window.history.pushState({ folder, uid }, "", url);
      }
    } catch (err) {
      console.error("[mail-navigation] Detail fetch failed:", err);
      readingPane.classList.remove("is-loading");
      readingPane.innerHTML = previousHtml;
    } finally {
      readingPane.removeAttribute("aria-busy");
    }
  };

  mailList.addEventListener("click", async (event) => {
    const mailItem = event.target.closest("[data-mail-item='true']");
    if (!mailItem) return;

    event.preventDefault();
    await loadDetail(mailItem, true);
  });

  window.addEventListener("popstate", async (event) => {
    const state = event.state;
    if (!state || !state.uid) return;

    const selector = `[data-mail-item='true'][data-uid='${CSS.escape(String(state.uid))}']`;
    const mailItem = mailList.querySelector(selector);
    if (!mailItem) return;
    await loadDetail(mailItem, false);
  });
})();
