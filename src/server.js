const express = require("express");
const path = require("path");
const session = require("express-session");
const FileStore = require("session-file-store")(session);

const { host, port, sessionSecret, sessionMaxAgeMs } = require("./config");
const {
  normalizeMailSettings,
  getMailClientForRequest,
  clearMailClientForSessionId,
  verifyMailSettings,
} = require("./sessionMail");
const { renderPage, renderDetailBlock, renderLoginPage } = require("./views/layout");
const { normalizeAttachmentContentType } = require("./utils/mimeFromFilename");

function saveSession(req) {
  // cookie-session otomatik kaydeder, Promise wrapper compat icin
  return Promise.resolve();
}

function requireMailSession(req, res, next) {
  if (!req.session?.mailSettings) {
    const path = String(req.path || "");
    const wantsJson =
      path.startsWith("/api/") ||
      String(req.get("Accept") || "").includes("application/json") ||
      String(req.get("X-Requested-With") || "") === "XMLHttpRequest";
    if (wantsJson) {
      return res.status(401).json({ ok: false, error: "Oturum gerekli veya suresi doldu." });
    }
    const nextUrl = encodeURIComponent(req.originalUrl || "/");
    return res.redirect(302, `/login?next=${nextUrl}`);
  }
  return next();
}

async function bootstrap() {
  const app = express();

  app.set("trust proxy", 1);

  app.use(
    session({
      name: "mac.sid",
      secret: sessionSecret,
      resave: false,
      saveUninitialized: false,
      store: new FileStore({
        path: path.join(process.cwd(), "sessions"),
        ttl: Math.floor(sessionMaxAgeMs / 1000),
        retries: 1,
      }),
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        maxAge: sessionMaxAgeMs,
        secure: process.env.NODE_ENV === "production",
      },
    })
  );

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(process.cwd(), "public")));

  app.get("/login", (req, res) => {
    if (req.session?.mailSettings) {
      const dest = String(req.query.next || "/").trim() || "/";
      const safe = dest.startsWith("/") && !dest.startsWith("//") ? dest : "/";
      return res.redirect(302, safe);
    }

    const error = String(req.query.error || "").trim();
    const next = String(req.query.next || "/").trim() || "/";
    return res.status(200).send(renderLoginPage({ error, next }));
  });

  app.post("/login", async (req, res) => {
    const settings = normalizeMailSettings(req.body);
    const verifyErr = await verifyMailSettings(settings);
    if (verifyErr) {
      const q = new URLSearchParams({
        error: verifyErr,
        next: String(req.body?.next || "/").trim() || "/",
      });
      return res.redirect(302, `/login?${q.toString()}`);
    }

    const sid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    req.session.sid = sid;
    clearMailClientForSessionId(sid);
    req.session.mailSettings = settings;

    try {
      await saveSession(req);
    } catch (err) {
      console.error("[POST /login] Oturum kaydedilemedi:", err);
      return res.status(500).send(renderLoginPage({ error: "Oturum kaydedilemedi.", next: "/" }));
    }

    const dest = String(req.body?.next || "/").trim() || "/";
    const safe = dest.startsWith("/") && !dest.startsWith("//") ? dest : "/";
    return res.redirect(302, safe);
  });

  app.post("/logout", (req, res) => {
    const sid = req.session?.sid;
    if (sid) {
      clearMailClientForSessionId(sid);
    }
    req.session = null;
    res.redirect(302, "/login");
  });

  app.get("/", requireMailSession, async (req, res) => {
    const mailClient = getMailClientForRequest(req);
    if (!mailClient) {
      return res.redirect(302, "/login");
    }

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

    const mailboxUsername = req.session.mailSettings?.username || "";

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
        mailboxUsername,
      })
    );
  });

  app.post("/api/messages/action", requireMailSession, async (req, res) => {
    const mailClient = getMailClientForRequest(req);
    if (!mailClient) {
      return res.status(401).json({ ok: false, error: "Oturum gerekli." });
    }

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

  app.get("/api/messages/detail", requireMailSession, async (req, res) => {
    const mailClient = getMailClientForRequest(req);
    if (!mailClient) {
      return res.status(401).json({ ok: false, error: "Oturum gerekli." });
    }

    const folder = String(req.query.folder || "").trim();
    const uid = String(req.query.uid || "").trim();

    if (!folder || !uid) {
      return res.status(400).json({ ok: false, error: "Klasor ve uid zorunludur." });
    }

    try {
      const detail = await mailClient.getMessageDetailByUid(folder, uid);
      const html = renderDetailBlock(detail, folder);
      return res.status(200).json({ ok: true, html });
    } catch (err) {
      console.error(`[GET /api/messages/detail] folder=${folder} uid=${uid} — Hata:`, err);
      const message = err instanceof Error ? err.message : "Mail detayi getirilemedi.";
      return res.status(400).json({ ok: false, error: message });
    }
  });

  app.get("/api/messages/attachment", requireMailSession, async (req, res) => {
    const mailClient = getMailClientForRequest(req);
    if (!mailClient) {
      return res.status(401).json({ ok: false, error: "Oturum gerekli." });
    }

    const folder = String(req.query.folder || "").trim();
    const uid = String(req.query.uid || "").trim();
    const part = String(req.query.part || "").trim();

    if (!folder || !uid || !part) {
      return res.status(400).json({ ok: false, error: "Klasor, uid ve part zorunludur." });
    }

    try {
      const { buffer, contentType, filename } = await mailClient.fetchAttachmentPart(folder, uid, part);
      const inlineRaw = String(req.query.inline || "").trim().toLowerCase();
      const asInline =
        inlineRaw === "1" || inlineRaw === "true" || inlineRaw === "yes" || inlineRaw === "inline";

      const resolvedType = normalizeAttachmentContentType(contentType, filename);
      res.setHeader("Content-Type", resolvedType);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Length", String(buffer.length));

      const safeName = filename.replace(/"/g, "'");
      if (asInline) {
        res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
      } else {
        res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
      }

      return res.status(200).send(buffer);
    } catch (err) {
      console.error(`[GET /api/messages/attachment] folder=${folder} uid=${uid} part=${part} — Hata:`, err);
      const message = err instanceof Error ? err.message : "Ek indirilemedi.";
      return res.status(400).json({ ok: false, error: message });
    }
  });

  app.listen(port, host, () => {
    console.log(`Acildi: http://${host}:${port}`);
    console.log("Giris: /login — Tum veriler sifreli cookie'de saklaniyor (sunucu restart edilse bile oturum korunur).");
  });
}

bootstrap().catch((err) => {
  console.error("Uygulama baslatilamadi:", err);
  process.exit(1);
});
