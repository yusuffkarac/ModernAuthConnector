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

function formatAttachmentSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) {
    return "";
  }
  if (n < 1024) {
    return `${n} B`;
  }
  if (n < 1024 * 1024) {
    return `${(n / 1024).toFixed(1)} KB`;
  }
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const {
  attachmentPreviewableByMimeOrFilename,
  inferMimeTypeFromFilename,
} = require("../utils/mimeFromFilename");

function renderAttachmentSection(detail, folder) {
  const list = Array.isArray(detail.attachments) ? detail.attachments : [];
  if (list.length === 0) {
    return "";
  }

  const folderEnc = encodeURIComponent(String(folder || ""));
  const uidEnc = encodeURIComponent(String(detail.uid || ""));

  const rows = list
    .map((att) => {
      const partEnc = encodeURIComponent(String(att.part || ""));
      const href = `/api/messages/attachment?folder=${folderEnc}&uid=${uidEnc}&part=${partEnc}`;
      const hrefInline = `${href}&inline=1`;
      const canPreview = attachmentPreviewableByMimeOrFilename(att.mimeType, att.filename || "");
      const sizeLabel = formatAttachmentSize(att.size);
      const inferredMime = inferMimeTypeFromFilename(att.filename || "");
      const mimeLabel =
        inferredMime &&
        String(att.mimeType || "")
          .toLowerCase()
          .includes("octet-stream")
          ? `${inferredMime} (${escapeHtml(att.mimeType || "")})`
          : escapeHtml(att.mimeType || "");
      const meta = [mimeLabel, sizeLabel ? escapeHtml(sizeLabel) : ""].filter(Boolean).join(" · ");
      const previewMime =
        inferMimeTypeFromFilename(att.filename || "") ||
        String(att.mimeType || "")
          .trim()
          .toLowerCase();
      const previewKind = previewMime.startsWith("image/") ? "image" : "frame";
      const previewTitle = escapeHtml(String(att.filename || att.part || "Onizleme"));
      const previewBtn = canPreview
        ? `<button type="button" class="detail-attachment-preview" data-preview-url="${escapeHtml(hrefInline)}" data-preview-title="${previewTitle}" data-preview-kind="${escapeHtml(previewKind)}" title="Bu pencerede onizle">Önizle</button>`
        : "";
      return `<li class="detail-attachment-row">
          <span class="material-symbols-outlined detail-attachment-icon">attach_file</span>
          <div class="detail-attachment-info">
            <span class="detail-attachment-name">${escapeHtml(att.filename || att.part)}</span>
            ${meta ? `<span class="detail-attachment-meta">${meta}</span>` : ""}
          </div>
          <div class="detail-attachment-actions">
            ${previewBtn}
            <a class="detail-attachment-download" href="${escapeHtml(href)}" download>İndir</a>
          </div>
        </li>`;
    })
    .join("");

  return `<div class="detail-attachments">
      <h2 class="detail-attachments-title">Ekler</h2>
      <ul class="detail-attachment-list">${rows}</ul>
    </div>`;
}

function renderDetailBlock(detail, mailFolder = "") {
  if (!detail) {
    return `<div class="empty-detail">
        <span class="material-symbols-outlined">mark_email_read</span>
        <p>Bir e-posta seçin</p>
      </div>`;
  }

  const detailInitials = initialsOf(detail.from);
  const detailColor = avatarColor(detailInitials);
  const attachmentBlock = renderAttachmentSection(detail, mailFolder);

  return `<article class="mail-preview">
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
          ${attachmentBlock}
          <hr class="detail-hr" />
          <div class="detail-body">${escapeHtml(detail.body).replaceAll("&amp;#39;", "'").replaceAll("&amp;quot;", '"').replaceAll("&amp;gt;", ">").replaceAll("&amp;lt;", "<").replaceAll("&amp;amp;", "&").replaceAll("&amp;nbsp;", " ")}</div>
        </div>
      </article>`;
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
  mailboxUsername = "",
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
      return `<div class="folder-item-wrapper${active}" data-folder="${escapeHtml(folder)}">
        <a class="folder-item${active}" href="${href}" style="display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:8px;padding:8px 14px 8px 16px;text-decoration:none;color:inherit;border-radius:4px;margin:1px 6px;border-left:3px solid transparent;white-space:nowrap;">
          <span class="material-symbols-outlined folder-icon" style="font-size:16px;color:#7B9DC8;flex-shrink:0;">${icon}</span>
          <span class="folder-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">${escapeHtml(folder)}</span>
          ${count}
        </a>
        <button type="button" class="folder-favorite-btn" data-folder="${escapeHtml(folder)}" title="Favorilere ekle/çıkar">
          <span class="material-symbols-outlined">star_outline</span>
        </button>
      </div>`;
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

  const detailBlock = renderDetailBlock(detail, selectedFolder);

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
  <title>Rail Flow - Posta</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css" />
  <script src="/panes.js" defer></script>
  <script src="/mail-navigation.js" defer></script>
  <script src="/attachment-preview.js" defer></script>
  <script src="/message-actions.js" defer></script>
  <script src="/favorites.js" defer></script>
  <script src="/sidebar-collapsible.js" defer></script>
</head>
<body>

  <!-- Top App Bar -->
  <header class="topbar">
    <div class="topbar-left">
      <button class="topbar-icon-btn" title="Menü"><span class="material-symbols-outlined">menu</span></button>
      <button class="topbar-icon-btn" title="Başlatıcı"><span class="material-symbols-outlined">apps</span></button>
      <span class="brand">Rail Flow</span>
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
      <span class="topbar-mailbox-label" title="${escapeHtml(mailboxUsername)}">${escapeHtml(mailboxUsername || "—")}</span>
      <form method="post" action="/logout" class="topbar-logout-form">
        <button type="submit" class="topbar-icon-btn" title="Çıkış yap"><span class="material-symbols-outlined">logout</span></button>
      </form>
    </div>
  </header>

  <div class="app-body">

    <!-- App Rail (sol dar nav) -->
    <nav class="app-rail">
      <a class="rail-item active" href="/" title="Posta" style="--nav-color:#72C0FF">
        <span class="rail-icon-wrap" style="background:rgba(114,192,255,0.18)">
          <span class="material-symbols-outlined" style="font-variation-settings:'FILL' 1;color:#72C0FF">mail</span>
        </span>
        <small>Posta</small>
      </a>
      <a class="rail-item" href="#" title="Takvim" style="--nav-color:#FCA947">
        <span class="rail-icon-wrap">
          <span class="material-symbols-outlined" style="color:#FCA947">calendar_today</span>
        </span>
        <small>Takvim</small>
      </a>
      <a class="rail-item" href="#" title="Kişiler" style="--nav-color:#74BCFF">
        <span class="rail-icon-wrap">
          <span class="material-symbols-outlined" style="color:#74BCFF">group</span>
        </span>
        <small>Kişiler</small>
      </a>
      <a class="rail-item" href="#" title="Görevler" style="--nav-color:#C6C0FC">
        <span class="rail-icon-wrap">
          <span class="material-symbols-outlined" style="color:#C6C0FC">task_alt</span>
        </span>
        <small>Görevler</small>
      </a>
      <a class="rail-item" href="#" title="Dosyalar" style="--nav-color:#7FD394">
        <span class="rail-icon-wrap">
          <span class="material-symbols-outlined" style="color:#7FD394">folder</span>
        </span>
        <small>Dosyalar</small>
      </a>
      <div class="rail-spacer"></div>
      <a class="rail-item rail-item-add" href="#" title="Diğer uygulamalar">
        <span class="rail-icon-wrap">
          <span class="material-symbols-outlined" style="color:rgba(255,255,255,0.55)">add_circle_outline</span>
        </span>
      </a>
    </nav>

    <!-- Sidebar (Klasör ağacı) -->
    <aside class="sidebar" style="contain: layout style; visibility: visible;">
      <!-- Sidebar üst "Yeni posta" butonu — Outlook tarzı -->
      <div class="sidebar-top-btn-area">
        <button class="sidebar-new-mail-btn">
          <span class="material-symbols-outlined">edit</span>
          <span>Yeni posta</span>
        </button>
      </div>

      <!-- Favoriler Bölümü -->
      <div class="sidebar-section" id="favorites-section">
        <div class="sidebar-section-header">
          <span>Favoriler</span>
          <span class="material-symbols-outlined sidebar-chevron">expand_more</span>
        </div>
        <div id="favorites-list" class="folder-list">
          <!-- Favoriler JavaScript ile doldurulacak -->
        </div>
      </div>

      <!-- Sık Kullanılanlar Bölümü -->
      <div class="sidebar-section">
        <div class="sidebar-section-header">
          <span>Sık Kullanılanlar</span>
          <span class="material-symbols-outlined sidebar-chevron">expand_more</span>
        </div>
        <a class="folder-item${selectedFolder === "INBOX" ? " active" : ""}" href="/?folder=INBOX" style="display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:8px;padding:8px 14px 8px 16px;text-decoration:none;color:inherit;border-radius:4px;margin:1px 6px;border-left:3px solid transparent;white-space:nowrap;">
          <span class="material-symbols-outlined folder-icon" style="font-size:16px;color:#7B9DC8;flex-shrink:0;">inbox</span>
          <span class="folder-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">Gelen Kutusu</span>
          ${selectedFolder === "INBOX" ? `<span class="folder-count">${escapeHtml(total)}</span>` : ""}
        </a>
        <a class="folder-item${selectedFolder === "Archive" ? " active" : ""}" href="/?folder=Archive" style="display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:8px;padding:8px 14px 8px 16px;text-decoration:none;color:inherit;border-radius:4px;margin:1px 6px;border-left:3px solid transparent;white-space:nowrap;">
          <span class="material-symbols-outlined folder-icon" style="font-size:16px;color:#7B9DC8;flex-shrink:0;">archive</span>
          <span class="folder-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">Arşiv</span>
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
        <a href="#" class="folder-item sidebar-groups-link" style="display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:8px;padding:8px 14px 8px 16px;text-decoration:none;color:#0078D4;border-radius:4px;margin:1px 6px;border-left:3px solid transparent;white-space:nowrap;">
          <span class="material-symbols-outlined folder-icon" style="color:#0078D4;font-size:16px;flex-shrink:0;">diversity_3</span>
          <span class="folder-name" style="color:#0078D4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">Gruplara Git</span>
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

    <!-- Sağ içerik alanı: Ribbon + panel'ler -->
    <div class="content-area">

      <!-- Ribbon / Action Bar -->
      <div class="ribbon">
        <button class="ribbon-btn primary"><span class="material-symbols-outlined">edit</span><span>Yeni posta</span></button>
        <div class="ribbon-sep"></div>
        <div class="ribbon-split-grp">
          <button class="ribbon-btn ribbon-split-main"><span class="material-symbols-outlined" style="color:#D13438">delete</span><span>Sil</span></button><button class="ribbon-btn ribbon-split-drop" title="Silme seçenekleri"><span class="material-symbols-outlined">expand_more</span></button>
        </div>
        <button class="ribbon-btn"><span class="material-symbols-outlined" style="color:#0078D4">archive</span><span>Arşivle</span></button>
        <button class="ribbon-btn"><span class="material-symbols-outlined" style="color:#CA5010">report</span><span>Bildir</span></button>
        <button class="ribbon-btn"><span class="material-symbols-outlined" style="color:#0078D4">cleaning_services</span><span>Süpür</span></button>
        <div class="ribbon-split-grp">
          <button class="ribbon-btn ribbon-split-main"><span class="material-symbols-outlined" style="color:#0078D4">drive_file_move</span><span>Şuraya Taşı</span></button><button class="ribbon-btn ribbon-split-drop" title="Taşıma seçenekleri"><span class="material-symbols-outlined">expand_more</span></button>
        </div>
        <div class="ribbon-sep"></div>
        <button class="ribbon-btn"><span class="material-symbols-outlined" style="color:#0078D4">reply</span><span>Yanıtla</span></button>
        <button class="ribbon-btn"><span class="material-symbols-outlined" style="color:#0078D4">reply_all</span><span>Tümünü yanıtla</span></button>
        <button class="ribbon-btn"><span class="material-symbols-outlined" style="color:#0078D4">forward</span><span>İlet</span></button>
        <div class="ribbon-sep"></div>
        <!-- Teams benzeri ikon -->
        <button class="ribbon-btn ribbon-icon-only ribbon-teams-btn" title="Teams'de mesaj gönder">
          <span class="ribbon-teams-icon">T</span>
        </button>
        <div class="ribbon-sep"></div>
        <div class="ribbon-split-grp">
          <button class="ribbon-btn ribbon-split-main"><span class="material-symbols-outlined" style="color:#6264A7">bolt</span><span>Hızlı adımlar</span></button><button class="ribbon-btn ribbon-split-drop" title="Hızlı adım seçenekleri"><span class="material-symbols-outlined">expand_more</span></button>
        </div>
        <div class="ribbon-sep"></div>
        <div class="ribbon-split-grp">
          <button class="ribbon-btn ribbon-split-main"><span class="material-symbols-outlined" style="color:#0078D4">mark_email_read</span><span>Okundu / Okunmadı</span></button><button class="ribbon-btn ribbon-split-drop" title="Daha fazla seçenek"><span class="material-symbols-outlined">expand_more</span></button>
        </div>
        <div class="ribbon-split-grp">
          <button class="ribbon-btn ribbon-icon-only ribbon-split-main" title="Bayrak koy"><span class="material-symbols-outlined" style="color:#CA5010">flag</span></button><button class="ribbon-btn ribbon-split-drop" title="Bayrak seçenekleri"><span class="material-symbols-outlined">expand_more</span></button>
        </div>
        <div class="ribbon-split-grp">
          <button class="ribbon-btn ribbon-icon-only ribbon-split-main" title="Kategorize et"><span class="material-symbols-outlined" style="color:#6264A7">label</span></button><button class="ribbon-btn ribbon-split-drop" title="Kategori seçenekleri"><span class="material-symbols-outlined">expand_more</span></button>
        </div>
        <button class="ribbon-btn ribbon-icon-only" title="Daha fazla seçenek"><span class="material-symbols-outlined" style="color:#605E5C">more_horiz</span></button>

        <!-- Sağ taraf: ek eylem ikonları + klasör seçici -->
        <div class="ribbon-right">
          <button class="ribbon-btn ribbon-icon-only" title="Ertele"><span class="material-symbols-outlined" style="color:#107C10">snooze</span></button>
          <button class="ribbon-btn ribbon-icon-only" title="Toplantı oluştur"><span class="material-symbols-outlined" style="color:#CC4400">event</span></button>
          <button class="ribbon-btn ribbon-icon-only" title="Gönderimi zamanla"><span class="material-symbols-outlined" style="color:#0078D4">schedule_send</span></button>
          <div class="ribbon-sep"></div>
          <form method="GET" action="/" class="ribbon-folder-form" title="Klasör seç">
            <span class="material-symbols-outlined" style="font-size:16px;color:#0078D4">folder_open</span>
            <select name="folder" onchange="this.form.submit()" class="ribbon-folder-select">${folderOptions}</select>
          </form>
        </div>
      </div>

      <!-- Mail panelleri -->
      <div class="content-panels">
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

    </div><!-- /content-area -->

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

function renderLoginPage({ error = "", next = "/", query = {} }) {
  const safeNext = String(next || "/").trim() || "/";
  const nextValue = safeNext.startsWith("/") && !safeNext.startsWith("//") ? safeNext : "/";
  const errorBlock = error
    ? `<div class="ms-login-error" role="alert"><span class="material-symbols-outlined">error_outline</span><span>${escapeHtml(error)}</span></div>`
    : "";

  // URL parametrelerinden değerleri al (query objesi veya doğrudan parametreler)
  const getParam = (key, defaultValue = "") => {
    const value = query && query[key] ? String(query[key]).trim() : "";
    return value || defaultValue;
  };

  const prefillEndpoint = getParam("endpoint", "");
  const prefillUsername = getParam("username", "");
  const prefillPort = getParam("port", "993");
  const prefillOauthAuthority = getParam("oauthAuthority", "");
  const prefillClientId = getParam("clientId", "");
  const prefillClientSecret = getParam("clientSecret", "");

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Oturum açın</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css" />
</head>
<body class="ms-login-page">
  <div class="ms-login-bg" aria-hidden="true"></div>
  <main class="login-shell ms-login-shell">
    <div class="ms-login-card">
      <div class="ms-login-brand">
        <img src="https://www.rail-flow.com/wp-content/uploads/2020/12/Rail-Flow.svg" alt="Rail Flow" class="rf-logo" />
        <span class="rf-wordmark">Rail Flow</span>
      </div>
      <h1 class="ms-login-title">Oturum açın</h1>
      <p class="ms-login-lead">Rail Flow posta kutunuza uygulama (client credentials) ile bağlanın.</p>
      ${errorBlock}
      <div class="ms-csv-block" id="csv-block">
        <button type="button" class="ms-csv-toggle" id="csv-toggle-btn" aria-expanded="false" aria-controls="csv-content">
          <span class="ms-csv-toggle-icon material-symbols-outlined">expand_more</span>
          <span class="ms-csv-toggle-text">EDI ayar CSV (isteğe bağlı)</span>
          <span class="ms-csv-toggle-badge">Yapıştır</span>
        </button>
        <div class="ms-csv-content" id="csv-content" hidden>
          <p class="ms-csv-hint">Başlık satırı ve bir veri satırını yapıştırın; gerekli sütunlar otomatik eşlenir.</p>
          <textarea
            id="csv-paste-area"
            class="ms-csv-paste"
            rows="5"
            spellcheck="false"
            wrap="off"
            placeholder="Active?;Exchange Party;...;Endpoint;Endpoint Username;...;FTP Port;...;OAUTH AUTHORITY;OAUTH CLIENTID;OAUTH CLIENTSECRET;..."
          ></textarea>
          <div class="ms-csv-actions">
            <button type="button" class="ms-btn-csv" id="csv-apply-btn">CSV'den forma aktar</button>
          </div>
          <p class="ms-csv-status" id="csv-paste-status" role="status" aria-live="polite"></p>
        </div>
      </div>
      <form id="ms-login-form" class="ms-login-form" method="post" action="/login" autocomplete="on">
        <input type="hidden" name="next" value="${escapeHtml(nextValue)}" />
        <label class="ms-field">
          <span class="ms-field-label">IMAP sunucusu</span>
          <input class="ms-field-input" name="endpoint" type="text" required placeholder="outlook.office365.com" value="${escapeHtml(prefillEndpoint)}" />
        </label>
        <label class="ms-field">
          <span class="ms-field-label">E-posta veya kullanıcı adı</span>
          <input class="ms-field-input" name="username" type="text" required placeholder="ornek@kurum.onmicrosoft.com" autocomplete="username" value="${escapeHtml(prefillUsername)}" />
        </label>
        <label class="ms-field">
          <span class="ms-field-label">IMAP bağlantı noktası</span>
          <input class="ms-field-input" name="port" type="number" min="1" max="65535" value="${escapeHtml(prefillPort || '993')}" />
        </label>
        <label class="ms-field">
          <span class="ms-field-label">OAuth yetkili sunucu (authority)</span>
          <input class="ms-field-input" name="oauthAuthority" type="url" required placeholder="https://login.microsoftonline.com/kiracı-kimligi" value="${escapeHtml(prefillOauthAuthority)}" />
        </label>
        <label class="ms-field">
          <span class="ms-field-label">Uygulama (istemci) kimliği</span>
          <input class="ms-field-input" name="clientId" type="text" required autocomplete="off" spellcheck="false" value="${escapeHtml(prefillClientId)}" />
        </label>
        <label class="ms-field">
          <span class="ms-field-label">İstemci parolası</span>
          <input class="ms-field-input" name="clientSecret" type="password" required autocomplete="current-password" value="${escapeHtml(prefillClientSecret)}" />
        </label>
        <p class="ms-login-hint">
          <a class="ms-link" href="https://learn.microsoft.com/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth" target="_blank" rel="noopener noreferrer">IMAP ve OAuth yapılandırması</a>
          hakkında bilgi alın.
        </p>
        <div class="ms-login-actions">
          <button type="submit" class="ms-btn-primary">İleri</button>
        </div>
        <div class="ms-share-link-row">
          <button type="button" class="ms-btn-link-share" id="share-link-btn" title="Form bilgilerini içeren paylaşılabilir link oluştur">
            <span class="material-symbols-outlined">content_copy</span>
            <span>Linki Kopyala</span>
          </button>
          <span class="ms-share-status" id="share-status" role="status" aria-live="polite"></span>
        </div>
      </form>
    </div>
    <div class="ms-login-card ms-login-card-foot">
      <span class="material-symbols-outlined ms-foot-icon" aria-hidden="true">key</span>
      <span class="ms-foot-text">Bu oturumda yalnızca kayıtlı Azure uygulaması kimlik bilgileri kullanılır; kişisel Microsoft hesabı parolası istenmez.</span>
    </div>
  </main>
  <script>
(function () {
  function parseSemicolonLine(line) {
    var cells = [];
    var cur = "";
    var inQuotes = false;
    for (var i = 0; i < line.length; i += 1) {
      var ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === ";" && !inQuotes) {
        cells.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    cells.push(cur);
    return cells;
  }

  function applyFromCsv(raw) {
    var text = String(raw || "").replace(/^\\uFEFF/, "").trim();
    if (!text) {
      return { ok: false, msg: "CSV alanı boş." };
    }
    var lines = text.split(/\\r?\\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length < 2) {
      return { ok: false, msg: "En az iki satır gerekli: başlık ve bir veri satırı." };
    }
    var headers = parseSemicolonLine(lines[0]).map(function (h) { return h.trim(); });
    var values = null;
    for (var i = 1; i < lines.length; i += 1) {
      var cells = parseSemicolonLine(lines[i]);
      if (cells.some(function (c) { return String(c).trim() !== ""; })) {
        values = cells;
        break;
      }
    }
    if (!values) {
      return { ok: false, msg: "Dolu bir veri satırı bulunamadı." };
    }
    var row = {};
    headers.forEach(function (h, idx) {
      row[h] = String(values[idx] != null ? values[idx] : "").trim();
    });
    var endpoint = row["Endpoint"] || "";
    var username = row["Endpoint Username"] || "";
    var port = row["FTP Port"] || "993";
    var oauthAuthority = row["OAUTH AUTHORITY"] || "";
    var clientId = row["OAUTH CLIENTID"] || "";
    var clientSecret = row["OAUTH CLIENTSECRET"] || "";
    if (!endpoint || !username || !oauthAuthority || !clientId || !clientSecret) {
      return {
        ok: false,
        msg: "Eksik sütun: Endpoint, Endpoint Username, FTP Port, OAUTH AUTHORITY, OAUTH CLIENTID veya OAUTH CLIENTSECRET bulunamadı veya boş.",
      };
    }
    return {
      ok: true,
      endpoint: endpoint,
      username: username,
      port: port,
      oauthAuthority: oauthAuthority,
      clientId: clientId,
      clientSecret: clientSecret,
    };
  }

  function setStatus(el, msg, isError) {
    if (!el) return;
    el.textContent = msg || "";
    el.classList.toggle("is-error", !!isError);
  }

  function fillForm(form, r) {
    function set(name, value) {
      var el = form.querySelector('[name="' + name + '"]');
      if (el) el.value = value != null ? String(value) : "";
    }
    set("endpoint", r.endpoint);
    set("username", r.username);
    var p = parseInt(String(r.port), 10);
    set("port", Number.isFinite(p) && p > 0 ? p : 993);
    set("oauthAuthority", r.oauthAuthority);
    set("clientId", r.clientId);
    set("clientSecret", r.clientSecret);
  }

  // URL query parametrelerini parse et
  function getUrlParams() {
    var params = {};
    var search = window.location.search;
    if (!search || search.length < 2) return params;
    var pairs = search.substring(1).split("&");
    for (var i = 0; i < pairs.length; i++) {
      var pair = pairs[i].split("=");
      if (pair.length >= 2) {
        var key = decodeURIComponent(pair[0]);
        var value = decodeURIComponent(pair.slice(1).join("="));
        params[key] = value;
      }
    }
    return params;
  }

  function runApply() {
    var ta = document.getElementById("csv-paste-area");
    var form = document.getElementById("ms-login-form");
    var status = document.getElementById("csv-paste-status");
    if (!ta || !form) return;
    var result = applyFromCsv(ta.value);
    if (!result.ok) {
      setStatus(status, result.msg, true);
      return;
    }
    fillForm(form, result);
    setStatus(status, "Form alanları CSV veri satırından dolduruldu.", false);
  }

  function toggleCsvBlock() {
    var toggleBtn = document.getElementById("csv-toggle-btn");
    var content = document.getElementById("csv-content");
    if (!toggleBtn || !content) return;
    var isExpanded = toggleBtn.getAttribute("aria-expanded") === "true";
    toggleBtn.setAttribute("aria-expanded", String(!isExpanded));
    content.hidden = isExpanded;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("csv-apply-btn");
    var ta = document.getElementById("csv-paste-area");
    var toggleBtn = document.getElementById("csv-toggle-btn");
    if (btn) btn.addEventListener("click", runApply);
    if (ta) {
      ta.addEventListener("paste", function () {
        setTimeout(runApply, 80);
      });
    }
    if (toggleBtn) toggleBtn.addEventListener("click", toggleCsvBlock);

    // URL parametrelerinden formu doldur (eğer varsa)
    var urlParams = getUrlParams();
    var form = document.getElementById("ms-login-form");
    var hasUrlParams = urlParams.endpoint || urlParams.username || urlParams.clientId || urlParams.oauthAuthority;
    if (form && hasUrlParams) {
      // Eğer input zaten server-side doldurulmadıysa (value boşsa)
      function fillIfEmpty(name, value) {
        var el = form.querySelector('[name="' + name + '"]');
        if (el && !el.value && value) {
          el.value = value;
        }
      }
      fillIfEmpty("endpoint", urlParams.endpoint);
      fillIfEmpty("username", urlParams.username);
      fillIfEmpty("port", urlParams.port || "993");
      fillIfEmpty("oauthAuthority", urlParams.oauthAuthority);
      fillIfEmpty("clientId", urlParams.clientId);
      fillIfEmpty("clientSecret", urlParams.clientSecret);
    }

    // Link paylaşma fonksiyonu
    var shareBtn = document.getElementById("share-link-btn");
    var shareStatus = document.getElementById("share-status");

    function generateShareLink() {
      if (!form) return "";
      var baseUrl = window.location.origin + "/login";
      var params = new URLSearchParams();

      function addParam(name) {
        var el = form.querySelector('[name="' + name + '"]');
        if (el && el.value && el.value.trim()) {
          params.set(name, el.value.trim());
        }
      }

      addParam("endpoint");
      addParam("username");
      addParam("port");
      addParam("oauthAuthority");
      addParam("clientId");
      addParam("clientSecret");

      var queryString = params.toString();
      return queryString ? (baseUrl + "?" + queryString) : baseUrl;
    }

    function copyToClipboard(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      // Fallback for older browsers
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      var success = false;
      try {
        success = document.execCommand("copy");
      } catch (e) {
        success = false;
      }
      document.body.removeChild(textarea);
      return success ? Promise.resolve() : Promise.reject(new Error("Kopyalama başarısız"));
    }

    function showStatus(message, isError) {
      if (!shareStatus) return;
      shareStatus.textContent = message;
      shareStatus.classList.toggle("is-error", !!isError);
      shareStatus.classList.toggle("is-success", !isError);
      setTimeout(function () {
        shareStatus.textContent = "";
        shareStatus.classList.remove("is-error", "is-success");
      }, 3000);
    }

    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        var link = generateShareLink();
        if (!link || link === window.location.origin + "/login") {
          showStatus("Önce form alanlarını doldurun", true);
          return;
        }
        copyToClipboard(link).then(function () {
          showStatus("Link kopyalandı!", false);
        }).catch(function () {
          showStatus("Kopyalama başarısız", true);
        });
      });
    }
  });
})();
  </script>
</body>
</html>`;
}

module.exports = { renderPage, renderDetailBlock, renderLoginPage };
