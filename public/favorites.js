(() => {
  const STORAGE_KEY = "rf_favorite_folders";
  const ORDER_KEY = "rf_folder_order";

  function getFavorites() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function saveFavorites(favorites) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch (e) {
      console.error("[favorites] Kaydetme hatası:", e);
    }
  }

  function getFolderOrder() {
    try {
      const data = localStorage.getItem(ORDER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  function saveFolderOrder(order) {
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(order));
    } catch (e) {
      console.error("[folder-order] Kaydetme hatası:", e);
    }
  }

  function applyFolderOrder(folders) {
    const savedOrder = getFolderOrder();
    if (!savedOrder || !Array.isArray(savedOrder)) return folders;
    
    const ordered = [];
    const remaining = [...folders];
    
    savedOrder.forEach(folder => {
      const idx = remaining.indexOf(folder);
      if (idx > -1) {
        ordered.push(folder);
        remaining.splice(idx, 1);
      }
    });
    
    return [...ordered, ...remaining];
  }

  function isFavorite(folderName) {
    return getFavorites().includes(folderName);
  }

  function toggleFavorite(folderName) {
    const favorites = getFavorites();
    const index = favorites.indexOf(folderName);
    
    if (index === -1) {
      favorites.push(folderName);
    } else {
      favorites.splice(index, 1);
    }
    
    saveFavorites(favorites);
    return index === -1;
  }

  function updateFavoriteButton(btn, isFav) {
    const icon = btn.querySelector(".material-symbols-outlined");
    if (icon) {
      icon.textContent = isFav ? "star" : "star_outline";
    }
    btn.classList.toggle("is-favorite", isFav);
  }

  function getFoldersFromDOM() {
    const folderList = document.querySelector(".sidebar-section-grow .folder-list");
    if (!folderList) return [];
    
    const folders = [];
    folderList.querySelectorAll("[data-folder]").forEach((el) => {
      const folder = el.dataset.folder;
      if (folder && !folders.includes(folder)) {
        folders.push(folder);
      }
    });
    return folders;
  }

  function getSelectedFolderFromDOM() {
    const activeItem = document.querySelector(".folder-item-wrapper.active, .folder-item.active");
    if (activeItem) {
      return activeItem.dataset.folder || "";
    }
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("folder") || "";
  }

  function renderFavoritesList() {
    const favoritesList = document.getElementById("favorites-list");
    const favoritesSection = document.getElementById("favorites-section");
    
    if (!favoritesList || !favoritesSection) {
      console.log("[favorites] Favoriler bölümü bulunamadı");
      return;
    }

    const favorites = getFavorites();
    const allFolders = window.pageData?.folders || getFoldersFromDOM();
    const selectedFolder = window.pageData?.selectedFolder || getSelectedFolderFromDOM();
    
    console.log("[favorites] Favoriler:", favorites);
    console.log("[favorites] Tüm klasörler:", allFolders);
    console.log("[favorites] Seçili klasör:", selectedFolder);

    if (favorites.length === 0) {
      favoritesSection.style.display = "none";
      return;
    }

    favoritesSection.style.display = "";

    const folderIcon = (name) => {
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
    };

    const escapeHtml = (value) => {
      return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    };

    const html = favorites
      .filter(folder => allFolders.length === 0 || allFolders.includes(folder))
      .map((folder) => {
        const isActive = folder === selectedFolder;
        const icon = folderIcon(folder);
        return `
          <div class="folder-item-wrapper${isActive ? " active" : ""}" data-folder="${escapeHtml(folder)}">
            <a class="folder-item${isActive ? " active" : ""}" href="/?folder=${encodeURIComponent(folder)}" style="display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:8px;padding:8px 14px 8px 16px;text-decoration:none;color:inherit;border-radius:4px;margin:1px 6px;border-left:3px solid transparent;white-space:nowrap;">
              <span class="material-symbols-outlined folder-icon" style="font-size:16px;color:#7B9DC8;flex-shrink:0;">${icon}</span>
              <span class="folder-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;">${escapeHtml(folder)}</span>
            </a>
            <button type="button" class="folder-favorite-btn is-favorite" data-folder="${escapeHtml(folder)}" title="Favorilerden çıkar">
              <span class="material-symbols-outlined">star</span>
            </button>
          </div>
        `;
      })
      .join("");

    favoritesList.innerHTML = html;

    favoritesList.querySelectorAll(".folder-favorite-btn").forEach((btn) => {
      btn.addEventListener("click", handleFavoriteClick);
    });
  }

  function initDragAndDrop(container, storageCallback) {
    let draggedItem = null;

    container.querySelectorAll(".folder-item-wrapper").forEach((item) => {
      if (item.hasAttribute("data-drag-initialized")) return;
      item.setAttribute("data-drag-initialized", "true");
      item.draggable = true;

      item.addEventListener("dragstart", (e) => {
        draggedItem = item;
        item.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });

      item.addEventListener("dragend", () => {
        item.classList.remove("dragging");
        draggedItem = null;
        
        const newOrder = Array.from(container.querySelectorAll(".folder-item-wrapper"))
          .map(el => el.dataset.folder)
          .filter(Boolean);
        
        if (storageCallback) {
          storageCallback(newOrder);
        }
      });

      item.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (!draggedItem || draggedItem === item) return;

        const rect = item.getBoundingClientRect();
        const midpoint = rect.top + rect.height / 2;
        
        if (e.clientY < midpoint) {
          item.before(draggedItem);
        } else {
          item.after(draggedItem);
        }
      });
    });
  }

  function renderAllFoldersWithOrder() {
    const folderList = document.querySelector(".sidebar-section-grow .folder-list");
    if (!folderList) return;

    const currentFolders = Array.from(folderList.querySelectorAll("[data-folder]"))
      .map(el => el.dataset.folder)
      .filter(Boolean);
    
    if (currentFolders.length === 0) return;

    const orderedFolders = applyFolderOrder(currentFolders);
    
    if (JSON.stringify(currentFolders) === JSON.stringify(orderedFolders)) {
      initDragAndDrop(folderList, saveFolderOrder);
      return;
    }

    const selectedFolder = getSelectedFolderFromDOM();
    
    const folderIcon = (name) => {
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
    };

    const escapeHtml = (value) => {
      return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    };

    const getFolderCount = (folder) => {
      const existing = folderList.querySelector(`[data-folder="${CSS.escape(folder)}"] .folder-count`);
      return existing ? existing.outerHTML : "";
    };

    const html = orderedFolders.map((folder) => {
      const isActive = folder === selectedFolder;
      const icon = folderIcon(folder);
      const count = isActive ? getFolderCount(folder) : "";
      const isFav = isFavorite(folder);
      
      return `<div class="folder-item-wrapper${isActive ? " active" : ""}" data-folder="${escapeHtml(folder)}">
        <a class="folder-item${isActive ? " active" : ""}" href="/?folder=${encodeURIComponent(folder)}">
          <span class="material-symbols-outlined folder-icon">${icon}</span>
          <span class="folder-name">${escapeHtml(folder)}</span>
          ${count}
        </a>
        <button type="button" class="folder-favorite-btn${isFav ? " is-favorite" : ""}" data-folder="${escapeHtml(folder)}" title="Favorilere ekle/çıkar">
          <span class="material-symbols-outlined">${isFav ? "star" : "star_outline"}</span>
        </button>
      </div>`;
    }).join("");

    folderList.innerHTML = html;

    folderList.querySelectorAll(".folder-favorite-btn").forEach((btn) => {
      btn.addEventListener("click", handleFavoriteClick);
    });

    initDragAndDrop(folderList, saveFolderOrder);
  }

  function handleFavoriteClick(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const btn = e.currentTarget;
    const folder = btn.dataset.folder;
    
    if (!folder) return;

    const isNowFavorite = toggleFavorite(folder);
    updateFavoriteButton(btn, isNowFavorite);

    const wrapper = btn.closest(".folder-item-wrapper");
    if (wrapper) {
      const otherBtn = wrapper.querySelector(".folder-favorite-btn");
      if (otherBtn && otherBtn !== btn) {
        updateFavoriteButton(otherBtn, isNowFavorite);
      }
    }

    const folderList = document.querySelector(".sidebar-section-grow .folder-list");
    if (folderList) {
      const otherBtn = folderList.querySelector(`[data-folder="${CSS.escape(folder)}"] .folder-favorite-btn`);
      if (otherBtn) {
        updateFavoriteButton(otherBtn, isNowFavorite);
      }
    }

    renderFavoritesList();
  }

  function init() {
    console.log("[favorites] Init başlıyor...");
    
    renderAllFoldersWithOrder();
    
    document.querySelectorAll(".folder-favorite-btn").forEach((btn) => {
      const folder = btn.dataset.folder;
      const isFav = isFavorite(folder);
      updateFavoriteButton(btn, isFav);
      btn.addEventListener("click", handleFavoriteClick);
    });

    renderFavoritesList();
    
    const favoritesList = document.getElementById("favorites-list");
    if (favoritesList) {
      initDragAndDrop(favoritesList, saveFavorites);
    }
  }

  function waitForPageData(callback, maxAttempts = 50) {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const folderList = document.querySelector(".sidebar-section-grow .folder-list");
      if (folderList && folderList.children.length > 0) {
        clearInterval(interval);
        callback();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.log("[favorites] Zaman aşımı, yine de init çalıştırılıyor");
        callback();
      }
    }, 100);
  }

  function runWhenReady() {
    // CSS'in tam yüklenmesi ve paint cycle için bir frame bekle (FOUC önlemi)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        waitForPageData(init);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runWhenReady);
  } else {
    runWhenReady();
  }
})();
