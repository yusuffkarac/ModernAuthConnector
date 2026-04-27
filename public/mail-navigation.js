(() => {
  const mailList = document.querySelector(".mail-list");
  const readingPane = document.querySelector(".reading-pane");

  if (!mailList || !readingPane) {
    return;
  }

  let pageData = {};
  try {
    pageData = JSON.parse(document.getElementById("page-data")?.textContent || "{}");
  } catch {
    pageData = {};
  }

  const accountId = String(pageData.activeAccountId || "").trim();
  const searchQ = String(pageData.searchQuery || "").trim();

  const setActiveMail = (targetItem) => {
    mailList.querySelectorAll("[data-mail-item='true']").forEach((item) => {
      item.classList.remove("active");
    });
    targetItem.classList.add("active");
  };

  const buildUrl = (folder, uid) => {
    const p = new URLSearchParams();
    if (accountId) p.set("account", accountId);
    if (folder) p.set("folder", folder);
    if (uid) p.set("uid", uid);
    if (searchQ.length >= 2) p.set("q", searchQ.slice(0, 120));
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  const detailQuery = (folder, uid) => {
    const p = new URLSearchParams();
    if (accountId) p.set("account", accountId);
    p.set("folder", folder);
    p.set("uid", uid);
    return p.toString();
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
      const detailRes = await fetch(`/api/messages/detail?${detailQuery(folder, uid)}`);
      const result = await detailRes.json();

      if (!detailRes.ok || !result.ok || typeof result.html !== "string") {
        throw new Error(result.error || "Mail detayi yuklenemedi.");
      }

      readingPane.classList.remove("is-loading");
      readingPane.innerHTML = result.html;
      setActiveMail(mailItem);

      if (pushHistory) {
        const url = buildUrl(folder, uid);
        window.history.pushState({ folder, uid, accountId }, "", url);
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
