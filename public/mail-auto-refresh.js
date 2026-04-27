(() => {
  const mailList = document.querySelector(".mail-list");
  if (!mailList) return;

  let pageData = {};
  try {
    pageData = JSON.parse(document.getElementById("page-data")?.textContent || "{}");
  } catch {
    pageData = {};
  }

  const POLL_MS = 45000;
  const notified = new Set();
  let timer = null;

  function readInitialMaxUid() {
    let m = 0;
    mailList.querySelectorAll("[data-uid]").forEach((el) => {
      const u = Number.parseInt(el.getAttribute("data-uid") || "", 10);
      if (Number.isFinite(u) && u > m) m = u;
    });
    return m;
  }

  let lastMaxUid = readInitialMaxUid();

  function maxUidInList(msgs) {
    let m = 0;
    if (!Array.isArray(msgs)) return 0;
    for (const msg of msgs) {
      const u = Number.parseInt(String(msg.uid || ""), 10);
      if (Number.isFinite(u) && u > m) m = u;
    }
    return m;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function flagClass(flag) {
    const value = String(flag || "").toLowerCase();
    if (value.includes("okundu")) return "is-seen";
    if (value.includes("yanıtlandı") || value.includes("yanitlandi")) return "is-answered";
    if (value.includes("yıldızlı") || value.includes("yildizli")) return "is-flagged";
    if (value.includes("taslak")) return "is-draft";
    if (value.includes("silinmiş") || value.includes("silinmis")) return "is-deleted";
    return "is-default";
  }

  function initialsOf(sender) {
    const value = String(sender || "").trim();
    if (!value || value === "-") return "MA";
    const local = value.includes("@") ? value.split("@")[0] : value;
    const chunks = local.replace(/[._-]+/g, " ").split(" ").filter(Boolean);
    if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
    return `${chunks[0][0] || ""}${chunks[1][0] || ""}`.toUpperCase();
  }

  function avatarColor(initials) {
    const palette = [
      { bg: "#0078D4", text: "#fff" },
      { bg: "#107C10", text: "#fff" },
      { bg: "#D83B01", text: "#fff" },
      { bg: "#5C2D91", text: "#fff" },
      { bg: "#0050EF", text: "#fff" },
    ];
    const idx = (initials || "A").charCodeAt(0) % palette.length;
    return palette[idx];
  }

  function buildMailItemHtml(m, selectedFolder, selectedUid, accountId) {
    const active = String(m.uid) === String(selectedUid) ? " active" : "";
    const p = new URLSearchParams(window.location.search);
    if (accountId) p.set("account", accountId);
    p.set("folder", selectedFolder);
    p.set("uid", String(m.uid));
    const href = `/?${p.toString()}`;

    const initials = initialsOf(m.from);
    const col = avatarColor(initials);
    const flags = Array.isArray(m.flags) ? m.flags : [];
    const isRead = flags.some((f) => flagClass(f) === "is-seen");
    const unreadClass = isRead ? "" : " unread";
    const flagsHtml = flags.map((f) => `<span class="flag-pill ${flagClass(f)}">${escapeHtml(f)}</span>`).join("");

    return `<a class="mail-item${active}${unreadClass}" href="${escapeHtml(href)}" data-mail-item="true" data-folder="${escapeHtml(selectedFolder)}" data-uid="${escapeHtml(String(m.uid))}" data-subject="${escapeHtml(m.subject)}" data-from="${escapeHtml(m.from)}"><div class="mail-avatar-wrap"><div class="mail-avatar" style="background:${col.bg};color:${col.text}">${escapeHtml(initials)}</div></div><div class="mail-body"><div class="mail-item-head"><span class="mail-sender">${escapeHtml(m.from)}</span><span class="mail-date">${escapeHtml(m.date)}</span></div><div class="mail-subject">${escapeHtml(m.subject)}</div><div class="mail-meta-row"><span class="mail-uid">UID #${escapeHtml(String(m.uid))}</span><div class="mail-flags-inline">${flagsHtml}</div></div></div></a>`;
  }

  function listJsonUrl() {
    const cur = new URLSearchParams(window.location.search);
    const p = new URLSearchParams();
    const acc = cur.get("account") || pageData.activeAccountId;
    if (acc) p.set("account", acc);
    p.set("folder", cur.get("folder") || pageData.selectedFolder || "Done");
    const uid = cur.get("uid");
    if (uid) p.set("uid", uid);
    const q = cur.get("q");
    if (q) p.set("q", q);
    return `/api/mailbox/list-json?${p.toString()}`;
  }

  async function poll() {
    if (document.visibilityState !== "visible") return;
    try {
      const res = await fetch(listJsonUrl(), { headers: { Accept: "application/json" } });
      const data = await res.json();
      if (!res.ok || !data.ok || !Array.isArray(data.messages)) return;

      const accountId = String(data.accountId || pageData.activeAccountId || "").trim();
      const label = String(pageData.accountLabel || accountId || "Posta").slice(0, 48);
      const folder = data.selectedFolder || pageData.selectedFolder || "Done";
      const newMax = maxUidInList(data.messages);

      if (
        lastMaxUid > 0 &&
        newMax > lastMaxUid &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        const newcomers = data.messages.filter((m) => {
          const u = Number.parseInt(String(m.uid), 10);
          return Number.isFinite(u) && u > lastMaxUid;
        });
        for (const m of newcomers) {
          const key = `${accountId}:${m.uid}`;
          if (notified.has(key)) continue;
          notified.add(key);
          try {
            new Notification(`${label}: yeni posta`, {
              body: `${m.subject || "-"} — ${m.from || "-"}`,
              tag: key,
            });
          } catch {
            /* ignore */
          }
        }
      }

      lastMaxUid = newMax;

      const cur = new URLSearchParams(window.location.search);
      const selectedUid = data.selectedMessageUid || cur.get("uid") || "";

      if (data.messages.length === 0) {
        const emptyText = data.searchActive ? "Sonuç bulunamadı" : "Bu klasörde e-posta yok";
        mailList.innerHTML = `<div class="empty"><span class="material-symbols-outlined" style="font-size:48px;display:block;text-align:center;margin-bottom:8px;color:#C8C6C4">mail_outline</span><div style="text-align:center;color:#8A8886;font-size:13px">${escapeHtml(emptyText)}</div></div>`;
        return;
      }

      mailList.innerHTML = data.messages
        .map((m) => buildMailItemHtml(m, folder, selectedUid, accountId))
        .join("");

      document.dispatchEvent(new CustomEvent("mac-mail-list-updated"));
    } catch (e) {
      console.warn("[mail-auto-refresh] poll:", e);
    }
  }

  function start() {
    if (timer) clearInterval(timer);
    timer = setInterval(poll, POLL_MS);
  }

  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      poll();
      start();
    } else {
      stop();
    }
  });

  const notifyBtn = document.getElementById("mac-notify-enable");
  if (notifyBtn && typeof Notification !== "undefined") {
    notifyBtn.addEventListener("click", async () => {
      try {
        const r = await Notification.requestPermission();
        notifyBtn.title = r === "granted" ? "Bildirimler açık" : `Bildirim: ${r}`;
      } catch {
        /* ignore */
      }
    });
  }

  start();
  setTimeout(poll, 3000);
})();
