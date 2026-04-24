const { MailClientService } = require("./services/mailClient");

/** @type {Map<string, MailClientService>} */
const mailClientsBySessionId = new Map();

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
  // cookie-session'da sessionID yok, kendi ID'mizi kullaniyoruz
  if (!req.session?.sid) {
    req.session.sid = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return req.session.sid;
}

function getMailClientForRequest(req) {
  const settings = req.session?.mailSettings;
  if (!settings) {
    return null;
  }

  const sid = getSessionId(req);
  let client = mailClientsBySessionId.get(sid);
  if (!client) {
    client = new MailClientService(settings);
    mailClientsBySessionId.set(sid, client);
  }
  return client;
}

function clearMailClientForSessionId(sessionId) {
  mailClientsBySessionId.delete(sessionId);
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
  verifyMailSettings,
};
