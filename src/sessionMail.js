const crypto = require("crypto");
const { MailClientService } = require("./services/mailClient");

/** @type {Map<string, MailClientService>} key: `${sid}:${accountId}` */
const mailClientsByKey = new Map();

function normalizeMailSettings(body) {
  const endpoint = String(body?.endpoint || "").trim();
  const username = String(body?.username || "").trim();
  const portRaw = String(body?.port || "993").trim();
  const oauthAuthority = String(body?.oauthAuthority || "").trim();
  const clientId = String(body?.clientId || "").trim();
  const clientSecret = String(body?.clientSecret || "").trim();
  const port = Number.parseInt(portRaw, 10) || 993;

  return { endpoint, username, port, oauthAuthority, clientId, clientSecret };
}

function validateMailSettingsShape(s) {
  if (!s.endpoint) return "IMAP uç noktası (Endpoint) zorunludur.";
  if (!s.username) return "Posta kutusu kullanıcısı zorunludur.";
  if (!s.oauthAuthority) return "OAuth Authority zorunludur.";
  if (!s.clientId) return "OAuth Client ID zorunludur.";
  if (!s.clientSecret) return "OAuth Client Secret zorunludur.";
  return "";
}

function getSessionId(req) {
  if (!req.session?.sid) {
    req.session.sid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return req.session.sid;
}

/**
 * Eski oturumları mailAccounts + activeAccountId yapısına taşır.
 * @param {import("express").Request} req
 */
function migrateLegacyMailSession(req) {
  if (!req.session) return;
  const legacy = req.session.mailSettings;
  const hasAccounts = Array.isArray(req.session.mailAccounts) && req.session.mailAccounts.length > 0;
  if (legacy && !hasAccounts) {
    const id = crypto.randomUUID();
    req.session.mailAccounts = [
      {
        id,
        settings: { ...legacy },
        label: String(legacy.username || "").trim() || "Hesap",
      },
    ];
    req.session.activeAccountId = id;
    delete req.session.mailSettings;
  }
}

/**
 * @returns {{ id: string, settings: object, label: string }[]}
 */
function getMailAccounts(req) {
  migrateLegacyMailSession(req);
  const list = req.session?.mailAccounts;
  if (!Array.isArray(list)) return [];
  return list;
}

/**
 * @param {import("express").Request} req
 * @param {string} [queryAccountId]
 * @returns {string|null} account id veya null
 */
function resolveActiveAccountId(req, queryAccountId) {
  const accounts = getMailAccounts(req);
  if (accounts.length === 0) return null;

  const q = String(queryAccountId || "").trim();
  if (q && accounts.some((a) => a.id === q)) {
    req.session.activeAccountId = q;
    return q;
  }

  const active = String(req.session?.activeAccountId || "").trim();
  if (active && accounts.some((a) => a.id === active)) {
    return active;
  }

  const first = accounts[0].id;
  req.session.activeAccountId = first;
  return first;
}

function getActiveAccount(req, queryAccountId) {
  const id = resolveActiveAccountId(req, queryAccountId);
  if (!id) return null;
  const acc = getMailAccounts(req).find((a) => a.id === id);
  return acc || null;
}

function clientCacheKey(sid, accountId) {
  return `${sid}:${accountId}`;
}

/**
 * Aktif (veya açıkça verilen) hesap için MailClientService.
 * @param {import("express").Request} req
 * @param {string} [queryAccountId] req.query.account
 */
function getMailClientForRequest(req, queryAccountId) {
  migrateLegacyMailSession(req);
  const account = getActiveAccount(req, queryAccountId);
  if (!account?.settings) {
    return null;
  }

  const sid = getSessionId(req);
  const key = clientCacheKey(sid, account.id);
  let client = mailClientsByKey.get(key);
  if (!client) {
    client = new MailClientService(account.settings);
    mailClientsByKey.set(key, client);
  }
  return client;
}

/** Oturumdaki tüm hesap önbelleğini temizle (logout). */
function clearMailClientForSessionId(sessionId) {
  const prefix = `${sessionId}:`;
  for (const k of mailClientsByKey.keys()) {
    if (k.startsWith(prefix)) {
      mailClientsByKey.delete(k);
    }
  }
}

function clearMailClientForAccount(sessionId, accountId) {
  mailClientsByKey.delete(clientCacheKey(sessionId, accountId));
}

function hasMailSession(req) {
  migrateLegacyMailSession(req);
  return getMailAccounts(req).length > 0;
}

/**
 * @param {import("express").Request} req
 * @param {object} settings normalizeMailSettings çıktısı
 * @param {{ makeActive?: boolean }} [opts]
 * @returns {string} yeni hesap id
 */
function addMailAccount(req, settings, opts = {}) {
  migrateLegacyMailSession(req);
  const id = crypto.randomUUID();
  const label = String(settings.username || "").trim() || "Hesap";
  if (!Array.isArray(req.session.mailAccounts)) {
    req.session.mailAccounts = [];
  }
  req.session.mailAccounts.push({ id, settings: { ...settings }, label });
  if (opts.makeActive !== false) {
    req.session.activeAccountId = id;
  }
  const sid = getSessionId(req);
  clearMailClientForAccount(sid, id);
  return id;
}

/**
 * @param {import("express").Request} req
 * @param {string} accountId
 * @returns {boolean}
 */
function removeMailAccount(req, accountId) {
  migrateLegacyMailSession(req);
  const id = String(accountId || "").trim();
  if (!id || !Array.isArray(req.session.mailAccounts)) return false;

  const idx = req.session.mailAccounts.findIndex((a) => a.id === id);
  if (idx < 0) return false;

  const sid = getSessionId(req);
  clearMailClientForAccount(sid, id);
  req.session.mailAccounts.splice(idx, 1);

  if (req.session.activeAccountId === id) {
    req.session.activeAccountId = req.session.mailAccounts[0]?.id || "";
  }
  return true;
}

/**
 * @param {import("express").Request} req
 * @returns {Promise<string>}
 */
async function verifyMailSettings(settings) {
  const errMsg = validateMailSettingsShape(settings);
  if (errMsg) {
    return errMsg;
  }

  try {
    const probe = new MailClientService(settings);
    await probe.getAccessToken();
    return "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Baglanti dogrulanamadi.";
    return msg;
  }
}

module.exports = {
  normalizeMailSettings,
  validateMailSettingsShape,
  getMailClientForRequest,
  clearMailClientForSessionId,
  clearMailClientForAccount,
  verifyMailSettings,
  migrateLegacyMailSession,
  getMailAccounts,
  resolveActiveAccountId,
  getActiveAccount,
  hasMailSession,
  addMailAccount,
  removeMailAccount,
};
