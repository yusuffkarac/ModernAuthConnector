(() => {
  const pageDataNode = document.getElementById("page-data");
  const contextMenu = document.getElementById("mail-context-menu");
  const modal = document.getElementById("mail-action-modal");
  const modalTitle = document.getElementById("mail-action-modal-title");
  const modalMessage = document.getElementById("mail-action-modal-message");
  const modalFields = document.getElementById("mail-action-modal-fields");
  const modalError = document.getElementById("mail-action-modal-error");
  const targetFolderSelect = document.getElementById("mail-action-target-folder");
  const confirmButton = document.getElementById("mail-action-confirm");

  if (!pageDataNode || !contextMenu || !modal || !confirmButton) {
    return;
  }

  let pageData = {};
  try {
    pageData = JSON.parse(pageDataNode.textContent || "{}");
  } catch (parseErr) {
    console.error("[message-actions] Sayfa verisi okunamadi:", parseErr);
    return;
  }
  const folders = Array.isArray(pageData.folders) ? pageData.folders : [];

  let selectedMail = null;
  let pendingAction = null;

  const closeContextMenu = () => {
    contextMenu.hidden = true;
  };

  const openContextMenu = (event, mailItem) => {
    selectedMail = {
      folder: mailItem.dataset.folder || "",
      uid: mailItem.dataset.uid || "",
      subject: mailItem.dataset.subject || "-",
      from: mailItem.dataset.from || "-",
    };

    contextMenu.hidden = false;

    const { innerWidth, innerHeight } = window;
    const menuRect = contextMenu.getBoundingClientRect();
    const left = Math.min(event.clientX, innerWidth - menuRect.width - 8);
    const top = Math.min(event.clientY, innerHeight - menuRect.height - 8);

    contextMenu.style.left = `${Math.max(8, left)}px`;
    contextMenu.style.top = `${Math.max(8, top)}px`;
  };

  const resetModalState = () => {
    modalError.hidden = true;
    modalError.textContent = "";
    modalFields.hidden = true;
    targetFolderSelect.innerHTML = "";
    confirmButton.disabled = false;
    confirmButton.textContent = "Onayla";
  };

  const closeModal = () => {
    modal.hidden = true;
    pendingAction = null;
    resetModalState();
  };

  const openModal = (action) => {
    if (!selectedMail) return;

    pendingAction = action;
    resetModalState();

    if (action === "mark-unread") {
      modalTitle.textContent = "Okunmadı yap";
      modalMessage.textContent = `"${selectedMail.subject}" maili okunmadı olarak işaretlensin mi?`;
    }

    if (action === "move") {
      modalTitle.textContent = "Klasör değiştir";
      modalMessage.textContent = `"${selectedMail.subject}" maili başka bir klasöre taşınsın mı?`;
      modalFields.hidden = false;

      const availableFolders = folders.filter((folder) => folder !== selectedMail.folder);
      for (const folder of availableFolders) {
        const option = document.createElement("option");
        option.value = folder;
        option.textContent = folder;
        targetFolderSelect.append(option);
      }

      if (availableFolders.length === 0) {
        modalError.hidden = false;
        modalError.textContent = "Tasima icin farkli bir klasor bulunamadi.";
        confirmButton.disabled = true;
      }
    }

    modal.hidden = false;
  };

  const submitAction = async () => {
    if (!selectedMail || !pendingAction) return;

    modalError.hidden = true;
    modalError.textContent = "";
    confirmButton.disabled = true;
    confirmButton.textContent = "İşleniyor...";

    const payload = {
      confirmed: true,
      action: pendingAction,
      folder: selectedMail.folder,
      uid: selectedMail.uid,
    };

    if (pendingAction === "move") {
      payload.targetFolder = targetFolderSelect.value;
    }

    try {
      const response = await fetch("/api/messages/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Islem tamamlanamadi.");
      }

      window.location.reload();
    } catch (error) {
      modalError.hidden = false;
      modalError.textContent = error instanceof Error ? error.message : "Islem tamamlanamadi.";
      confirmButton.disabled = false;
      confirmButton.textContent = "Onayla";
    }
  };

  document.querySelectorAll("[data-mail-item='true']").forEach((mailItem) => {
    mailItem.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      openContextMenu(event, mailItem);
    });
  });

  contextMenu.querySelectorAll("[data-menu-action]").forEach((button) => {
    button.addEventListener("click", () => {
      closeContextMenu();
      openModal(button.dataset.menuAction || "");
    });
  });

  document.addEventListener("click", (event) => {
    if (!contextMenu.hidden && !contextMenu.contains(event.target)) {
      closeContextMenu();
    }
  });

  document.addEventListener("scroll", closeContextMenu, true);
  window.addEventListener("resize", closeContextMenu);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeContextMenu();
      if (!modal.hidden) {
        closeModal();
      }
    }
  });

  modal.querySelectorAll("[data-modal-close='true']").forEach((button) => {
    button.addEventListener("click", closeModal);
  });

  confirmButton.addEventListener("click", submitAction);
})();
