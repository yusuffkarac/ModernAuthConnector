const express = require("express");
const path = require("path");

const { host, port, settingsCsvPath } = require("./config");
const { readSettings } = require("./utils/csv");
const { MailClientService } = require("./services/mailClient");
const { renderPage } = require("./views/layout");

async function bootstrap() {
  const settings = await readSettings(settingsCsvPath);
  const mailClient = new MailClientService(settings);

  const app = express();
  app.use(express.json());
  app.use(express.static(path.join(process.cwd(), "public")));

  app.get("/", async (req, res) => {
    const selectedFolderRaw = String(req.query.folder || "Done").trim();
    const selectedUidRaw = String(req.query.uid || req.query.mid || "").trim();

    let folders = [];
    let selectedFolder = selectedFolderRaw;
    let total = "-";
    let messages = [];
    let detail = null;
    let error = "";
    let folderNotFound = false;
    let selectedMessageUid = selectedUidRaw;

    try {
      const view = await mailClient.getMailboxView(selectedFolder, selectedMessageUid, 50);
      folders = view.folders;
      selectedFolder = view.selectedFolder;
      folderNotFound = view.folderNotFound || false;
      total = String(view.total);
      messages = view.messages;
      selectedMessageUid = view.selectedMessageUid;
      detail = view.detail;
    } catch (err) {
      console.error("[GET /] Mailbox goruntuleme hatasi:", err);
      error = err instanceof Error ? err.message : "Bilinmeyen hata";
    }

    res.status(200).send(
      renderPage({
        folders,
        selectedFolder,
        folderNotFound,
        total,
        messages,
        selectedMessageUid,
        detail,
        error,
      })
    );
  });

  app.post("/api/messages/action", async (req, res) => {
    const action = String(req.body?.action || "").trim();
    const folder = String(req.body?.folder || "").trim();
    const uid = String(req.body?.uid || "").trim();
    const targetFolder = String(req.body?.targetFolder || "").trim();
    const confirmed = req.body?.confirmed === true;

    if (!confirmed) {
      return res.status(400).json({ ok: false, error: "Islem onayi gerekli." });
    }

    try {
      if (action === "mark-unread") {
        await mailClient.markMessageUnread(folder, uid);
        return res.status(200).json({ ok: true });
      }

      if (action === "move") {
        await mailClient.moveMessage(folder, uid, targetFolder);
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ ok: false, error: "Desteklenmeyen islem." });
    } catch (err) {
      console.error(`[POST /api/messages/action] action=${action} folder=${folder} uid=${uid} — Hata:`, err);
      const message = err instanceof Error ? err.message : "Islem gerceklestirilemedi.";
      return res.status(400).json({ ok: false, error: message });
    }
  });

  app.listen(port, host, () => {
    console.log(`Acildi: http://${host}:${port}`);
    console.log("Desteklenen islemler: goruntuleme, okunmamis isaretleme, klasor tasima.");
  });
}

bootstrap().catch((err) => {
  console.error("Uygulama baslatilamadi:", err);
  process.exit(1);
});
