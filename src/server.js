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
  migrateLegacyMailSession,
  resolveActiveAccountId,
  getMailAccounts,
  hasMailSession,
  addMailAccount,
  removeMailAccount,
} = require("./sessionMail");
const { renderPage, renderDetailBlock, renderLoginPage } = require("./views/layout");
const { normalizeAttachmentContentType } = require("./utils/mimeFromFilename");

function saveSession(req) {
  return Promise.resolve();
}

function requireMailSession(req, res, next) {
  migrateLegacyMailSession(req);
  if (!hasMailSession(req)) {
    const pathStr = String(req.path || "");
    const wantsJson =
      pathStr.startsWith("/api/") ||
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

function resolveAccountForApi(req) {
  const fromQuery = String(req.query?.account || req.body?.account || "").trim();
  return resolveActiveAccountId(req, fromQuery);
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
    migrateLegacyMailSession(req);
    const addMode = String(req.query.add || "").trim() === "1";
    if (hasMailSession(req) && !addMode) {
      const dest = String(req.query.next || "/").trim() || "/";
      const safe = dest.startsWith("/") && !dest.startsWith("//") ? dest : "/";
      return res.redirect(302, safe);
    }

    const error = String(req.query.error || "").trim();
    const next = String(req.query.next || "/").trim() || "/";
    const query = {
      endpoint: String(req.query.endpoint || "").trim(),
      username: String(req.query.username || "").trim(),
      port: String(req.query.port || "").trim(),
      oauthAuthority: String(req.query.oauthAuthority || "").trim(),
      clientId: String(req.query.clientId || "").trim(),
      clientSecret: String(req.query.clientSecret || "").trim(),
      autologin: String(req.query.autologin || "").trim(),
    };
    return res.status(200).send(renderLoginPage({ error, next, query, addAccount: addMode }));
  });

  app.post("/login", async (req, res) => {
    const settings = normalizeMailSettings(req.body);
    const verifyErr = await verifyMailSettings(settings);
    if (verifyErr) {
      const q = new URLSearchParams({
        error: verifyErr,
        next: String(req.body?.next || "/").trim() || "/",
      });
      if (String(req.body?.addAccount || "").trim() === "1") {
        q.set("add", "1");
      }
      return res.redirect(302, `/login?${q.toString()}`);
    }

    migrateLegacyMailSession(req);
    const addAccount = String(req.body?.addAccount || "").trim() === "1";

    if (!req.session.sid) {
      req.session.sid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
    const sid = req.session.sid;

    if (!hasMailSession(req)) {
      clearMailClientForSessionId(sid);
      req.session.mailAccounts = [];
      req.session.activeAccountId = "";
      addMailAccount(req, settings, { makeActive: true });
    } else if (addAccount) {
      addMailAccount(req, settings, { makeActive: true });
    } else {
      addMailAccount(req, settings, { makeActive: true });
    }

    try {
      await saveSession(req);
    } catch (err) {
      console.error("[POST /login] Oturum kaydedilemedi:", err);
      return res.status(500).send(renderLoginPage({ error: "Oturum kaydedilemedi.", next: "/", addAccount: false }));
    }

    const dest = String(req.body?.next || "/").trim() || "/";
    const safe = dest.startsWith("/") && !dest.startsWith("//") ? dest : "/";
    const acc = resolveActiveAccountId(req, "");
    let redirectUrl = safe;
    try {
      const u = new URL(safe, "http://localhost");
      if (acc) u.searchParams.set("account", acc);
      redirectUrl = u.pathname + u.search;
    } catch {
      redirectUrl = acc ? `/?account=${encodeURIComponent(acc)}` : "/";
    }
    return res.redirect(302, redirectUrl);
  });

  app.post("/logout", (req, res) => {
    const sid = req.session?.sid;
    if (sid) {
      clearMailClientForSessionId(sid);
    }
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout hatasi:", err);
      }
      res.clearCookie("mac.sid");
      res.redirect(302, "/login");
    });
  });

  app.post("/accounts/:id/remove", requireMailSession, (req, res) => {
    const id = String(req.params.id || "").trim();
    const accounts = getMailAccounts(req);
    if (accounts.length <= 1) {
      return res.status(400).send("Son hesap kaldirilamaz. Cikis yapin.");
    }
    const ok = removeMailAccount(req, id);
    if (!ok) {
      return res.status(404).send("Hesap bulunamadi.");
    }
    const nextAcc = resolveActiveAccountId(req, "");
    const dest = String(req.body?.next || "/").trim() || "/";
    const safe = dest.startsWith("/") && !dest.startsWith("//") ? dest : "/";
    let redirectUrl = safe;
    try {
      const u = new URL(safe, "http://localhost");
      if (nextAcc) u.searchParams.set("account", nextAcc);
      redirectUrl = u.pathname + u.search;
    } catch {
      redirectUrl = nextAcc ? `/?account=${encodeURIComponent(nextAcc)}` : "/";
    }
    return res.redirect(302, redirectUrl);
  });

  app.get("/", requireMailSession, async (req, res) => {
    const accountId = resolveActiveAccountId(req, String(req.query.account || "").trim());
    const mailClient = getMailClientForRequest(req, accountId);
    if (!mailClient) {
      return res.redirect(302, "/login");
    }

    const rawQ = String(req.query.q || "").trim().slice(0, 120);
    const searchQuery = rawQ.length >= 2 ? rawQ : "";

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
    let searchActive = false;
    let matchCount = 0;

    try {
      const view = await mailClient.getMailboxView(selectedFolder, selectedMessageUid, 50, searchQuery);
      folders = view.folders;
      selectedFolder = view.selectedFolder;
      folderNotFound = view.folderNotFound || false;
      total = String(view.total);
      messages = view.messages;
      selectedMessageUid = view.selectedMessageUid;
      detail = view.detail;
      searchActive = Boolean(view.searchActive);
      matchCount = Number(view.matchCount) || 0;
    } catch (err) {
      console.error("[GET /] Mailbox goruntuleme hatasi:", err);
      error = err instanceof Error ? err.message : "Bilinmeyen hata";
    }

    const active = getMailAccounts(req).find((a) => a.id === accountId);
    const mailboxUsername = active?.settings?.username || "";

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
        activeAccountId: accountId,
        mailAccounts: getMailAccounts(req),
        searchQuery: rawQ,
        searchActive,
        matchCount,
      })
    );
  });

  app.get("/api/mailbox/list-json", requireMailSession, async (req, res) => {
    const accountId = resolveAccountForApi(req);
    const mailClient = getMailClientForRequest(req, accountId);
    if (!mailClient) {
      return res.status(401).json({ ok: false, error: "Oturum gerekli." });
    }

    const rawQ = String(req.query.q || "").trim().slice(0, 120);
    const searchQuery = rawQ.length >= 2 ? rawQ : "";
    const selectedFolderRaw = String(req.query.folder || "Done").trim();
    const selectedUidRaw = String(req.query.uid || "").trim();

    try {
      const view = await mailClient.getMailboxView(selectedFolderRaw, selectedUidRaw, 50, searchQuery);
      return res.status(200).json({
        ok: true,
        accountId,
        folders: view.folders,
        selectedFolder: view.selectedFolder,
        folderNotFound: view.folderNotFound || false,
        total: view.total,
        messages: view.messages,
        selectedMessageUid: view.selectedMessageUid,
        searchActive: Boolean(view.searchActive),
        searchQuery: view.searchQuery || "",
        matchCount: Number(view.matchCount) || 0,
      });
    } catch (err) {
      console.error("[GET /api/mailbox/list-json]", err);
      const message = err instanceof Error ? err.message : "Liste alinamadi.";
      return res.status(400).json({ ok: false, error: message });
    }
  });

  app.post("/api/messages/action", requireMailSession, async (req, res) => {
    const accountId = resolveAccountForApi(req);
    const mailClient = getMailClientForRequest(req, accountId);
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
    const accountId = resolveAccountForApi(req);
    const mailClient = getMailClientForRequest(req, accountId);
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
      const html = renderDetailBlock(detail, folder, accountId);
      return res.status(200).json({ ok: true, html });
    } catch (err) {
      console.error(`[GET /api/messages/detail] folder=${folder} uid=${uid} — Hata:`, err);
      const message = err instanceof Error ? err.message : "Mail detayi getirilemedi.";
      return res.status(400).json({ ok: false, error: message });
    }
  });

  app.get("/api/messages/attachment", requireMailSession, async (req, res) => {
    const accountId = resolveAccountForApi(req);
    const mailClient = getMailClientForRequest(req, accountId);
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
    console.log("Giris: /login — Oturum dosya deposunda (session-file-store).");
  });
}

bootstrap().catch((err) => {
  console.error("Uygulama baslatilamadi:", err);
  process.exit(1);
});
