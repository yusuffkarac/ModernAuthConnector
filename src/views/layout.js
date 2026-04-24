function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e");
}

function initialsOf(sender) {
  const value = String(sender || "").trim();
  if (!value || value === "-") return "MA";
  const local = value.includes("@") ? value.split("@")[0] : value;
  const chunks = local.replace(/[._-]+/g, " ").split(" ").filter(Boolean);
  if (chunks.length === 1) return chunks[0].slice(0, 2).toUpperCase();
  return `${chunks[0][0] || ""}${chunks[1][0] || ""}`.toUpperCase();
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

function folderIcon(name) {
  const n = String(name || "").toLowerCase();
  if (n.includes("inbox") || n.includes("gelen")) return "inbox";
  if (n.includes("sent") || n.includes("gönderil") || n.includes("gonderil")) return "send";
  if (n.includes("draft") || n.includes("taslak")) return "drafts";
  if (n.includes("deleted") || n.includes("silinmiş") || n.includes("silinmis") || n.includes("trash")) return "delete";
  if (n.includes("junk") || n.includes("spam") || n.includes("gereksiz")) return "report";
  if (n.includes("archive") || n.includes("arşiv") || n.includes("arsiv")) return "archive";
  if (n.includes("outbox") || n.includes("giden")) return "outbox";
  if (n.includes("notes") || n.includes("notlar")) return "note";
  if (n.includes("calendar") || n.includes("takvim")) return "calendar_today";
  if (n.includes("contacts") || n.includes("kişiler") || n.includes("kisiler")) return "contacts";
  if (n.includes("tasks") || n.includes("görev") || n.includes("gorev")) return "task_alt";
  if (n.includes("journal")) return "menu_book";
  if (n.includes("done") || n.includes("tamamlanan")) return "check_circle";
  if (n.includes("conversation") || n.includes("konuşma") || n.includes("konusma")) return "forum";
  if (n.includes("birthday") || n.includes("doğum") || n.includes("dogum")) return "cake";
  return "folder";
}

function avatarColor(initials) {
  const palette = [
    { bg: "#0078D4", text: "#fff" },
    { bg: "#107C10", text: "#fff" },
    { bg: "#D83B01", text: "#fff" },
    { bg: "#5C2D91", text: "#fff" },
    { bg: "#0050EF", text: "#fff" },
    { bg: "#B4009E", text: "#fff" },
    { bg: "#EC008C", text: "#fff" },
    { bg: "#68217A", text: "#fff" },
    { bg: "#00B4D8", text: "#fff" },
    { bg: "#2D7D9A", text: "#fff" },
  ];
  const idx = (initials || "A").charCodeAt(0) % palette.length;
  return palette[idx];
}

function renderPage({
  folders,
  selectedFolder,
  folderNotFound,
  total,
  messages,
  selectedMessageUid,
  detail,
  error,
}) {
  const folderOptions = folders
    .map((folder) => {
      const selected = folder === selectedFolder ? " selected" : "";
      return `<option value="${escapeHtml(folder)}"${selected}>${escapeHtml(folder)}</option>`;
    })
    .join("");

  const folderLinks = folders
    .map((folder) => {
      const active = folder === selectedFolder ? " active" : "";
      const href = `/?folder=${encodeURIComponent(folder)}`;
      const count =
        folder === selectedFolder
          ? `<span class="folder-count">${escapeHtml(total)}</span>`
          : "";
      const icon = folderIcon(folder);
      return `<a class="folder-item${active}" href="${href}">
        <span class="material-symbols-outlined folder-icon">${icon}</span>
        <span class="folder-name">${escapeHtml(folder)}</span>
        ${count}
      </a>`;
    })
    .join("");

  const mailItems =
    messages.length === 0
      ? `<div class="empty">
          <span class="material-symbols-outlined" style="font-size:48px;display:block;text-align:center;margin-bottom:8px;color:#C8C6C4">mail_outline</span>
          <div style="text-align:center;color:#8A8886;font-size:13px">Bu klasörde e-posta yok</div>
        </div>`
      : messages
          .map((m) => {
            const active = m.uid === selectedMessageUid ? " active" : "";
            const href = `/?folder=${encodeURIComponent(selectedFolder)}&uid=${encodeURIComponent(m.uid)}`;
            const initials = initialsOf(m.from);
            const col = avatarColor(initials);
            const flags = m.flags || [];
            const isRead = flags.some((f) => flagClass(f) === "is-seen");
            const unreadClass = isRead ? "" : " unread";
            return `
              <a
                class="mail-item${active}${unreadClass}"
                href="${href}"
                data-mail-item="true"
                data-folder="${escapeHtml(selectedFolder)}"
                data-uid="${escapeHtml(String(m.uid))}"
                data-subject="${escapeHtml(m.subject)}"
                data-from="${escapeHtml(m.from)}"
              >
                <div class="mail-avatar-wrap">
                  <div class="mail-avatar" style="background:${col.bg};color:${col.text}">${escapeHtml(initials)}</div>
                </div>
                <div class="mail-body">
                  <div class="mail-item-head">
                    <span class="mail-sender">${escapeHtml(m.from)}</span>
                    <span class="mail-date">${escapeHtml(m.date)}</span>
                  </div>
                  <div class="mail-subject">${escapeHtml(m.subject)}</div>
                  <div class="mail-meta-row">
                    <span class="mail-uid">UID #${escapeHtml(String(m.uid))}</span>
                    <div class="mail-flags-inline">
                      ${flags.map((f) => `<span class="flag-pill ${flagClass(f)}">${escapeHtml(f)}</span>`).join("")}
                    </div>
                  </div>
                </div>
              </a>`;
          })
          .join("");

  const detailInitials = detail ? initialsOf(detail.from) : "MA";
  const detailColor = avatarColor(detailInitials);

  const detailBlock = detail
    ? `<article class="mail-preview">
        <div class="detail-actions">
          <button class="action-btn"><span class="material-symbols-outlined">reply</span><span>Yanıtla</span></button>
          <button class="action-btn"><span class="material-symbols-outlined">reply_all</span><span>Tümünü yanıtla</span></button>
          <button class="action-btn"><span class="material-symbols-outlined">forward</span><span>İlet</span></button>
          <div class="action-sep"></div>
          <button class="action-icon-btn" title="Sil"><span class="material-symbols-outlined">delete</span></button>
          <button class="action-icon-btn" title="Arşivle"><span class="material-symbols-outlined">archive</span></button>
          <button class="action-icon-btn" title="Bildir"><span class="material-symbols-outlined">report</span></button>
          <button class="action-icon-btn" title="Okundu/Okunmadı"><span class="material-symbols-outlined">mark_email_read</span></button>
          <button class="action-icon-btn" title="Daha fazla"><span class="material-symbols-outlined">more_horiz</span></button>
        </div>
        <div class="detail-content">
          <h1 class="detail-subject">${escapeHtml(detail.subject)}</h1>
          <div class="detail-meta-row">
            <div class="detail-avatar" style="background:${detailColor.bg};color:${detailColor.text}">${escapeHtml(detailInitials)}</div>
            <div class="detail-meta-info">
              <div class="detail-from"><strong>Kimden:</strong> ${escapeHtml(detail.from)}</div>
              <div class="detail-date-to">
                <span><strong>Tarih:</strong> ${escapeHtml(detail.date)}</span>
                <span class="detail-uid">UID: ${escapeHtml(String(detail.uid || "-"))} &bull; SEQ: ${escapeHtml(String(detail.id || "-"))}</span>
              </div>
            </div>
          </div>
          <div class="detail-flags">
            <strong>Flag:</strong> ${(detail.flags || []).map((f) => `<span class="flag-pill ${flagClass(f)}">${escapeHtml(f)}</span>`).join("")}
          </div>
          <hr class="detail-hr" />
          <div class="detail-body"><pre>${escapeHtml(detail.body)}</pre></div>
        </div>
      </article>`
    : `<div class="empty-detail">
        <span class="material-symbols-outlined">mark_email_read</span>
        <p>Bir e-posta seçin</p>
      </div>`;

  const errorBlock = error
    ? `<div class="error-banner"><span class="material-symbols-outlined">error_outline</span>${escapeHtml(error)}</div>`
    : "";

  const folderNotFoundBlock = folderNotFound
    ? `<div class="warning-banner"><span class="material-symbols-outlined">warning</span>İstenen klasör bulunamadı; ilk klasöre yönlendirildiniz.</div>`
    : "";

  const pageData = safeJson({
    folders,
    selectedFolder,
  });

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Outlook - Posta</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css" />
  <script src="/panes.js" defer></script>
  <script src="/message-actions.js" defer></script>
</head>
<body>

  <!-- Top App Bar -->
  <header class="topbar">
    <div class="topbar-left">
      <button class="topbar-icon-btn" title="Menü"><span class="material-symbols-outlined">menu</span></button>
      <button class="topbar-icon-btn" title="Başlatıcı"><span class="material-symbols-outlined">apps</span></button>
      <span class="brand">Outlook</span>
    </div>
    <div class="topbar-search">
      <div class="search-box">
        <span class="material-symbols-outlined search-icon">search</span>
        <input type="text" placeholder="Ara" class="search-input" />
      </div>
    </div>
    <div class="topbar-actions">
      <button class="topbar-icon-btn" title="Yardım"><span class="material-symbols-outlined">help_outline</span></button>
      <button class="topbar-icon-btn" title="Bildirimler"><span class="material-symbols-outlined">notifications</span></button>
      <button class="topbar-icon-btn" title="Ayarlar"><span class="material-symbols-outlined">settings</span></button>
      <div class="user-avatar" title="Hesap">YK</div>
    </div>
  </header>

  <!-- Ribbon / Action Bar -->
  <div class="ribbon">
    <button class="ribbon-btn primary"><span class="material-symbols-outlined">edit</span><span>Yeni posta</span></button>
    <div class="ribbon-sep"></div>
    <div class="ribbon-split-grp">
      <button class="ribbon-btn ribbon-split-main"><span class="material-symbols-outlined">delete</span><span>Sil</span></button><button class="ribbon-btn ribbon-split-drop" title="Silme seçenekleri"><span class="material-symbols-outlined">expand_more</span></button>
    </div>
    <button class="ribbon-btn"><span class="material-symbols-outlined">archive</span><span>Arşivle</span></button>
    <button class="ribbon-btn"><span class="material-symbols-outlined">report</span><span>Bildir</span></button>
    <button class="ribbon-btn"><span class="material-symbols-outlined">cleaning_services</span><span>Süpür</span></button>
    <div class="ribbon-split-grp">
      <button class="ribbon-btn ribbon-split-main"><span class="material-symbols-outlined">drive_file_move</span><span>Şuraya Taşı</span></button><button class="ribbon-btn ribbon-split-drop" title="Taşıma seçenekleri"><span class="material-symbols-outlined">expand_more</span></button>
    </div>
    <div class="ribbon-sep"></div>
    <button class="ribbon-btn"><span class="material-symbols-outlined">reply</span><span>Yanıtla</span></button>
    <button class="ribbon-btn"><span class="material-symbols-outlined">reply_all</span><span>Tümünü yanıtla</span></button>
    <button class="ribbon-btn"><span class="material-symbols-outlined">forward</span><span>İlet</span></button>
    <div class="ribbon-sep"></div>
    <div class="ribbon-split-grp">
      <button class="ribbon-btn ribbon-split-main"><span class="material-symbols-outlined">bolt</span><span>Hızlı adımlar</span></button><button class="ribbon-btn ribbon-split-drop" title="Hızlı adım seçenekleri"><span class="material-symbols-outlined">expand_more</span></button>
    </div>
    <div class="ribbon-sep"></div>
    <div class="ribbon-split-grp">
      <button class="ribbon-btn ribbon-split-main"><span class="material-symbols-outlined">mark_email_read</span><span>Okundu / Okunmadı</span></button><button class="ribbon-btn ribbon-split-drop" title="Daha fazla seçenek"><span class="material-symbols-outlined">expand_more</span></button>
    </div>
    <div class="ribbon-split-grp">
      <button class="ribbon-btn ribbon-icon-only ribbon-split-main" title="Bayrak koy"><span class="material-symbols-outlined">flag</span></button><button class="ribbon-btn ribbon-split-drop" title="Bayrak seçenekleri"><span class="material-symbols-outlined">expand_more</span></button>
    </div>
    <div class="ribbon-split-grp">
      <button class="ribbon-btn ribbon-icon-only ribbon-split-main" title="Kategorize et"><span class="material-symbols-outlined">label</span></button><button class="ribbon-btn ribbon-split-drop" title="Kategori seçenekleri"><span class="material-symbols-outlined">expand_more</span></button>
    </div>
    <button class="ribbon-btn ribbon-icon-only" title="Daha fazla seçenek"><span class="material-symbols-outlined">more_horiz</span></button>

    <!-- Sağ taraf: ek eylem ikonları + klasör seçici -->
    <div class="ribbon-right">
      <button class="ribbon-btn ribbon-icon-only" title="Ertele"><span class="material-symbols-outlined">snooze</span></button>
      <button class="ribbon-btn ribbon-icon-only" title="Toplantı oluştur"><span class="material-symbols-outlined">event</span></button>
      <button class="ribbon-btn ribbon-icon-only" title="Gönderimi zamanla"><span class="material-symbols-outlined">schedule_send</span></button>
      <div class="ribbon-sep"></div>
      <form method="GET" action="/" class="ribbon-folder-form" title="Klasör seç">
        <span class="material-symbols-outlined" style="font-size:16px;color:#605E5C">folder_open</span>
        <select name="folder" onchange="this.form.submit()" class="ribbon-folder-select">${folderOptions}</select>
      </form>
    </div>
  </div>

  <div class="app-body">

    <!-- App Rail (sol dar nav) -->
    <nav class="app-rail">
      <a class="rail-item active" href="/" title="Posta">
        <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1">mail</span>
        <small>Posta</small>
      </a>
      <a class="rail-item" href="#" title="Takvim">
        <span class="material-symbols-outlined">calendar_today</span>
        <small>Takvim</small>
      </a>
      <a class="rail-item" href="#" title="Kişiler">
        <span class="material-symbols-outlined">group</span>
        <small>Kişiler</small>
      </a>
      <a class="rail-item" href="#" title="Görevler">
        <span class="material-symbols-outlined">task_alt</span>
        <small>Görevler</small>
      </a>
      <a class="rail-item" href="#" title="Dosyalar">
        <span class="material-symbols-outlined">folder</span>
        <small>Dosyalar</small>
      </a>
      <div class="rail-spacer"></div>
      <a class="rail-item" href="#" title="Diğer uygulamalar">
        <span class="material-symbols-outlined">add_circle_outline</span>
      </a>
    </nav>

    <!-- Sidebar (Klasör ağacı) -->
    <aside class="sidebar">
      <div class="sidebar-section">
        <div class="sidebar-section-header">
          <span>Sık Kullanılanlar</span>
          <span class="material-symbols-outlined sidebar-chevron">expand_more</span>
        </div>
        <a class="folder-item${selectedFolder === "INBOX" ? " active" : ""}" href="/?folder=INBOX">
          <span class="material-symbols-outlined folder-icon">inbox</span>
          <span class="folder-name">Gelen Kutusu</span>
          ${selectedFolder === "INBOX" ? `<span class="folder-count">${escapeHtml(total)}</span>` : ""}
        </a>
        <a class="folder-item${selectedFolder === "Archive" ? " active" : ""}" href="/?folder=Archive">
          <span class="material-symbols-outlined folder-icon">archive</span>
          <span class="folder-name">Arşiv</span>
          ${selectedFolder === "Archive" ? `<span class="folder-count">${escapeHtml(total)}</span>` : ""}
        </a>
      </div>

      <div class="sidebar-section sidebar-section-grow">
        <div class="sidebar-section-header">
          <span class="account-email">Klasörler</span>
          <span class="material-symbols-outlined sidebar-chevron">expand_more</span>
        </div>
        <nav class="folder-list">${folderLinks}</nav>
        <p class="sidebar-note">Görüntüleme, okunmadı işaretleme ve klasör taşıma desteklenmektedir</p>
      </div>

      <div class="sidebar-bottom">
        <a href="#" class="folder-item">
          <span class="material-symbols-outlined folder-icon">group</span>
          <span class="folder-name">Gruplara Git</span>
        </a>
      </div>
    </aside>
    <div
      class="pane-resizer pane-resizer-sidebar"
      data-resize-target="sidebar"
      role="separator"
      aria-label="Klasör paneli genişliğini değiştir"
      aria-orientation="vertical"
    ></div>

    <!-- Mail List Panel -->
    <section class="mail-list-panel">
      <div class="list-header">
        <div class="list-tabs">
          <button class="list-tab active">Odaklanmış</button>
          <button class="list-tab">Diğer</button>
        </div>
        <div class="list-header-actions">
          <button class="list-icon-btn" title="Filtrele"><span class="material-symbols-outlined">filter_list</span></button>
          <button class="list-icon-btn" title="Sırala"><span class="material-symbols-outlined">sort</span></button>
        </div>
      </div>
      ${errorBlock}
      ${folderNotFoundBlock}
      <div class="mail-list">${mailItems}</div>
    </section>
    <div
      class="pane-resizer pane-resizer-list"
      data-resize-target="list"
      role="separator"
      aria-label="Mail listesi genişliğini değiştir"
      aria-orientation="vertical"
    ></div>

    <!-- Reading Pane -->
    <section class="reading-pane">${detailBlock}</section>

  </div>
  <script id="page-data" type="application/json">${pageData}</script>

  <div id="mail-context-menu" class="context-menu" hidden>
    <button type="button" class="context-menu-item" data-menu-action="mark-unread">
      <span class="material-symbols-outlined">mark_email_unread</span>
      <span>Okunmadı yap</span>
    </button>
    <button type="button" class="context-menu-item" data-menu-action="move">
      <span class="material-symbols-outlined">drive_file_move</span>
      <span>Klasörünü değiştir...</span>
    </button>
  </div>

  <div id="mail-action-modal" class="confirm-modal" hidden>
    <div class="confirm-modal-backdrop" data-modal-close="true"></div>
    <div class="confirm-modal-card" role="dialog" aria-modal="true" aria-labelledby="mail-action-modal-title">
      <div class="confirm-modal-header">
        <h2 id="mail-action-modal-title" class="confirm-modal-title">İşlem onayı</h2>
        <button type="button" class="confirm-modal-close" data-modal-close="true" aria-label="Kapat">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <p id="mail-action-modal-message" class="confirm-modal-message"></p>
      <div id="mail-action-modal-fields" class="confirm-modal-fields" hidden>
        <label class="confirm-field-label" for="mail-action-target-folder">Hedef klasör</label>
        <select id="mail-action-target-folder" class="confirm-field-select"></select>
      </div>
      <div id="mail-action-modal-error" class="confirm-modal-error" hidden></div>
      <div class="confirm-modal-actions">
        <button type="button" class="modal-btn secondary" data-modal-close="true">Vazgeç</button>
        <button type="button" id="mail-action-confirm" class="modal-btn primary">Onayla</button>
      </div>
    </div>
  </div>
</body>
</html>`;
}

module.exports = { renderPage };
