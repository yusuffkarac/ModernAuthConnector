(() => {
  const STORAGE_KEY = "rf_sidebar_collapsed";

  function getCollapsedSections() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  function saveCollapsedSections(collapsed) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(collapsed));
    } catch (e) {
      console.error("[sidebar-collapsible] Kaydetme hatası:", e);
    }
  }

  function toggleSection(header) {
    const section = header.closest(".sidebar-section");
    if (!section) return;

    const sectionId = section.id || section.querySelector(".sidebar-section-header span")?.textContent?.trim();
    if (!sectionId) return;

    const isCollapsed = section.classList.toggle("is-collapsed");
    const chevron = header.querySelector(".sidebar-chevron");
    
    if (chevron) {
      chevron.textContent = isCollapsed ? "chevron_right" : "expand_more";
    }

    const collapsed = getCollapsedSections();
    if (isCollapsed) {
      if (!collapsed.includes(sectionId)) {
        collapsed.push(sectionId);
      }
    } else {
      const index = collapsed.indexOf(sectionId);
      if (index > -1) {
        collapsed.splice(index, 1);
      }
    }
    
    saveCollapsedSections(collapsed);
  }

  function init() {
    const headers = document.querySelectorAll(".sidebar-section-header");
    const collapsed = getCollapsedSections();

    headers.forEach((header) => {
      const section = header.closest(".sidebar-section");
      if (!section) return;

      const sectionId = section.id || header.querySelector("span")?.textContent?.trim();
      if (!sectionId) return;

      const chevron = header.querySelector(".sidebar-chevron");
      
      if (collapsed.includes(sectionId) || collapsed.includes("Favoriler") || collapsed.includes("Sık Kullanılanlar") || collapsed.includes("Klasörler")) {
        if (collapsed.includes(sectionId) || 
            (sectionId === "Favoriler" && collapsed.includes("Favoriler")) ||
            (sectionId === "Sık Kullanılanlar" && collapsed.includes("Sık Kullanılanlar")) ||
            (sectionId === "Klasörler" && collapsed.includes("Klasörler"))) {
          section.classList.add("is-collapsed");
          if (chevron) chevron.textContent = "chevron_right";
        }
      }

      header.style.cursor = "pointer";
      header.addEventListener("click", (e) => {
        if (e.target.closest("a, button, input, select")) return;
        toggleSection(header);
      });
    });
  }

  function runWhenReady() {
    // CSS'in tam yüklenmesi ve bir paint cycle geçmesi için bir frame bekle
    // Bu, FOUC (Flash of Unstyled Content) sorununu önler
    requestAnimationFrame(() => {
      requestAnimationFrame(init);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runWhenReady);
  } else {
    runWhenReady();
  }
})();
