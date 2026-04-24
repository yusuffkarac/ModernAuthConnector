const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

function decodeHtmlEntities(input) {
  const entities = {
    "&nbsp;": " ",
    "&lt;": "<",
    "&gt;": ">",
    "&amp;": "&",
    "&quot;": '"',
    "&#39;": "'",
    "&#x2F;": "/",
    "&#x27;": "'",
    "&#x60;": "`",
    "&ndash;": "–",
    "&mdash;": "—",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
    "&euro;": "€",
    "&pound;": "£",
    "&yen;": "¥",
    "&laquo;": "«",
    "&raquo;": "»",
    "&bull;": "•",
    "&middot;": "·",
    "&hellip;": "…",
    "&apos;": "'",
  };

  let result = String(input || "");
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replaceAll(entity, char);
  }

  // Numeric entities: &#123; veya &#x7B;
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  result = result.replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

  return result;
}

function stripHtml(input) {
  return decodeHtmlEntities(
    input
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n") // <br> etiketlerini yeni satıra dönüştür
      .replace(/<p\s*\/?>/gi, "\n") // <p> etiketlerini yeni satıra dönüştür
      .replace(/<\/p>/gi, "") // </p> kapatma etiketlerini kaldır
      .replace(/<[^>]+>/g, " ") // Diğer tüm HTML etiketlerini boşluğa dönüştür
  )
    .replace(/[ \t]+/g, " ") // Sadece çoklu boşluk ve tab'ları tek boşluğa indirge (yeni satırları koru)
    .replace(/\n[ \t]+/g, "\n") // Yeni satır sonrasındaki boşlukları temizle
    .replace(/[ \t]+\n/g, "\n") // Yeni satır öncesindeki boşlukları temizle
    .trim();
}

function formatFlags(flags) {
  const list = Array.from(flags || []);
  if (list.length === 0) {
    return ["Yok"];
  }

  const mapped = list.map((flag) => {
    switch (flag) {
      case "\\Seen":
        return "Okundu";
      case "\\Answered":
        return "Yanıtlandı";
      case "\\Flagged":
        return "Yıldızlı";
      case "\\Draft":
        return "Taslak";
      case "\\Deleted":
        return "Silinmiş";
      default:
        return flag;
    }
  });

  return mapped;
}

function formatMailDate(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function assertUid(uid) {
  const parsed = Number.parseInt(String(uid || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Gecersiz mail uid.");
  }
  return parsed;
}

/** IMAP BODY part path: "1", "2.1", ... */
function assertValidImapPartPath(part) {
  const s = String(part || "").trim();
  if (!/^\d+(\.\d+)*$/.test(s)) {
    throw new Error("Gecersiz ek parca yolu.");
  }
  return s;
}

function pickFilenameFromStructure(node) {
  const dp = node.dispositionParameters || {};
  const params = node.parameters || {};
  const raw =
    dp.filename ||
    dp.name ||
    params.filename ||
    params.name ||
    "";
  return String(raw || "").trim();
}

function sanitizeFilenameForDownload(name, partPath) {
  const base = String(name || "").trim() || `attachment-${String(partPath).replace(/\./g, "-")}`;
  const ascii = base.replace(/[^\x20-\x7E]+/g, "_").replace(/["\\;]/g, "_");
  return ascii.slice(0, 200) || "attachment";
}

class MailClientService {
  constructor(settings) {
    this.settings = settings;
    this.tokenCache = { value: "", expiresAt: 0 };
    this.folderCache = { value: [], expiresAt: 0 };
  }

  async getAccessToken() {
    const now = Date.now();
    if (this.tokenCache.value && this.tokenCache.expiresAt > now) {
      return this.tokenCache.value;
    }

    const url = `${this.settings.oauthAuthority.replace(/\/$/, "")}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: this.settings.clientId,
      client_secret: this.settings.clientSecret,
      grant_type: "client_credentials",
      scope: "https://outlook.office365.com/.default",
    });

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error(`[OAuth] Token alinamadi: HTTP ${res.status} — ${txt}`);
      throw new Error("Kimlik dogrulama basarisiz. Sunucu loglarina bakiniz.");
    }

    const json = await res.json();
    if (!json.access_token) {
      throw new Error("Token alinamadi: access_token bos.");
    }
    const ttlSeconds = Number.parseInt(String(json.expires_in || "3600"), 10);
    const safeTtl = Number.isFinite(ttlSeconds) ? ttlSeconds : 3600;
    this.tokenCache = {
      value: json.access_token,
      expiresAt: Date.now() + Math.max(60, safeTtl - 120) * 1000,
    };
    return json.access_token;
  }

  async withClient(fn) {
    const token = await this.getAccessToken();
    const client = new ImapFlow({
      host: this.settings.endpoint,
      port: this.settings.port,
      secure: true,
      logger: false,
      auth: {
        user: this.settings.username,
        accessToken: token,
        method: "XOAUTH2",
      },
    });

    await client.connect();
    try {
      return await fn(client);
    } finally {
      await client.logout();
    }
  }

  async listFolders() {
    const now = Date.now();
    if (this.folderCache.value.length > 0 && this.folderCache.expiresAt > now) {
      return this.folderCache.value;
    }

    return this.withClient(async (client) => {
      return this._fetchFolders(client);
    });
  }

  _findTextParts(structure, path = "") {
    if (!structure) return [];
    const results = [];
    const type = String(structure.type || "").toLowerCase();
    const subtype = String(structure.subtype || "").toLowerCase();

    if (type === "text" && (subtype === "plain" || subtype === "html")) {
      results.push({ path: path || "1", subtype });
    } else if (structure.childNodes && structure.childNodes.length > 0) {
      structure.childNodes.forEach((child, i) => {
        const childPath = path ? `${path}.${i + 1}` : String(i + 1);
        results.push(...this._findTextParts(child, childPath));
      });
    }
    return results;
  }

  /**
   * Lists downloadable attachment parts from parsed BODYSTRUCTURE (ImapFlow).
   * @returns {{ part: string, filename: string, mimeType: string, size: number }[]}
   */
  _collectAttachmentParts(structure) {
    const out = [];

    const isBodyTextLeaf = (node) => {
      const t = String(node.type || "").toLowerCase();
      return t === "text/plain" || t === "text/html";
    };

    const shouldIncludeLeaf = (node) => {
      const disp = String(node.disposition || "").toLowerCase();
      const filename = pickFilenameFromStructure(node);
      if (disp === "attachment") {
        return true;
      }
      if (isBodyTextLeaf(node)) {
        return disp === "attachment" || Boolean(filename);
      }
      if (filename) {
        return true;
      }
      if (disp === "inline") {
        return false;
      }
      const t = String(node.type || "").toLowerCase();
      if (t.startsWith("text/")) {
        return false;
      }
      if (t.startsWith("multipart/")) {
        return false;
      }
      return t.length > 0;
    };

    const walk = (node) => {
      if (!node) {
        return;
      }
      const type = String(node.type || "").toLowerCase();
      const children = node.childNodes;
      if (children && children.length > 0) {
        if (type.startsWith("multipart/")) {
          children.forEach(walk);
          return;
        }
        if (type === "message/rfc822") {
          children.forEach(walk);
          const disp = String(node.disposition || "").toLowerCase();
          const fn = pickFilenameFromStructure(node);
          const partPath = node.part ? String(node.part) : "";
          if (partPath && (disp === "attachment" || fn)) {
            const size = Number.isFinite(node.size) ? Number(node.size) : 0;
            const defaultEml = `mesaj-${partPath.replace(/\./g, "-")}.eml`;
            out.push({
              part: partPath,
              filename: fn || defaultEml,
              mimeType: "message/rfc822",
              size,
            });
          }
          return;
        }
      }

      const partPath = node.part ? String(node.part) : "";
      if (!partPath) {
        return;
      }
      if (!shouldIncludeLeaf(node)) {
        return;
      }

      const filename = pickFilenameFromStructure(node) || sanitizeFilenameForDownload("", partPath);
      const mimeType = String(node.type || "application/octet-stream").toLowerCase();
      const size = Number.isFinite(node.size) ? Number(node.size) : 0;

      out.push({
        part: partPath,
        filename,
        mimeType,
        size,
      });
    };

    walk(structure);
    return out;
  }

  async _extractBodyText(client, uid, bodyStructure) {
    const parts = this._findTextParts(bodyStructure);
    const plainPart = parts.find((p) => p.subtype === "plain");
    const htmlPart = parts.find((p) => p.subtype === "html");
    const target = plainPart || htmlPart;

    if (!target) {
      // Yapı anlaşılamadıysa güvenli fallback: tam kaynağı çek
      const fallback = await client.fetchOne(uid, { source: true }, { uid: true });
      if (!fallback) return "(Icerik bos)";
      const parsed = await simpleParser(fallback.source);
      const textBody = parsed.text || "";
      const htmlBody = typeof parsed.html === "string" ? parsed.html : "";
      return textBody.trim() || stripHtml(htmlBody) || "(Icerik bos)";
    }

    const partMsg = await client.fetchOne(
      uid,
      { bodyParts: [target.path] },
      { uid: true }
    );

    if (!partMsg) return "(Icerik bos)";
    const raw = partMsg.bodyParts?.get(target.path);
    if (!raw) return "(Icerik bos)";

    const text = raw.toString("utf8");
    if (target.subtype === "plain") return text.trim() || "(Icerik bos)";
    return stripHtml(text) || "(Icerik bos)";
  }

  async _fetchFolders(client) {
    const now = Date.now();
    if (this.folderCache.value.length > 0 && this.folderCache.expiresAt > now) {
      return this.folderCache.value;
    }
    const listed = await client.list();
    const folders = listed.map((f) => f.path);
    this.folderCache = { value: folders, expiresAt: Date.now() + 60 * 1000 };
    return folders;
  }

  async listMessages(folder, limit = 50) {
    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock(folder, { readOnly: true });
      try {
        const exists = client.mailbox.exists || 0;
        const summary = [];

        if (exists > 0) {
          const start = Math.max(1, exists - limit + 1);
          for await (const msg of client.fetch(
            `${start}:${exists}`,
            { uid: true, envelope: true, flags: true },
            { uid: false }
          )) {
            summary.push({
              id: String(msg.seq),
              date: formatMailDate(msg.envelope?.date),
              from: msg.envelope?.from?.[0]?.address || "-",
              subject: msg.envelope?.subject || "-",
              flags: formatFlags(msg.flags),
            });
          }
        }

        summary.sort((a, b) => Number.parseInt(b.id, 10) - Number.parseInt(a.id, 10));
        return { total: exists, messages: summary };
      } finally {
        lock.release();
      }
    });
  }

  async getMessageDetail(folder, sequenceId) {
    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock(folder, { readOnly: true });
      try {
        const seq = Number.parseInt(sequenceId, 10);
        if (!Number.isFinite(seq) || seq < 1) {
          throw new Error("Gecersiz mail id.");
        }

        const structMsg = await client.fetchOne(
          seq,
          { envelope: true, flags: true, bodyStructure: true },
          { uid: false }
        );

        if (!structMsg) {
          throw new Error("Mail detayi okunamadi.");
        }

        const envelope = structMsg.envelope;
        const body = await this._extractBodyText(client, seq, structMsg.bodyStructure);
        const attachments = this._collectAttachmentParts(structMsg.bodyStructure);
        return {
          id: String(seq),
          subject: envelope?.subject || "-",
          from: envelope?.from?.[0]?.address || "-",
          date: formatMailDate(envelope?.date),
          flags: formatFlags(structMsg.flags),
          body,
          attachments,
        };
      } finally {
        lock.release();
      }
    });
  }

  async getMailboxView(folder, selectedMessageUid, limit = 50) {
    return this.withClient(async (client) => {
      const folders = await this._fetchFolders(client);

      let selectedFolder = folder;
      let folderNotFound = false;
      if (!folders.includes(selectedFolder) && folders.length > 0) {
        folderNotFound = true;
        [selectedFolder] = folders;
      }

      const lock = await client.getMailboxLock(selectedFolder, { readOnly: true });
      try {
        const exists = client.mailbox.exists || 0;
        const messages = [];

        if (exists > 0) {
          const start = Math.max(1, exists - limit + 1);
          for await (const msg of client.fetch(
            `${start}:${exists}`,
            { uid: true, envelope: true, flags: true },
            { uid: false }
          )) {
            messages.push({
              id: String(msg.seq),
              uid: String(msg.uid || ""),
              date: formatMailDate(msg.envelope?.date),
              from: msg.envelope?.from?.[0]?.address || "-",
              subject: msg.envelope?.subject || "-",
              flags: formatFlags(msg.flags),
            });
          }
        }

        messages.sort((a, b) => Number.parseInt(b.uid, 10) - Number.parseInt(a.uid, 10));
        let chosenUid = selectedMessageUid;
        if (!chosenUid && messages.length > 0) {
          chosenUid = messages[0].uid;
        }

        let detail = null;
        if (chosenUid && messages.some((m) => m.uid === chosenUid)) {
          const uid = Number.parseInt(chosenUid, 10);

          // bodyStructure ile önce yapıyı çek, sonra sadece text/html part'larını indir
          const structMsg = await client.fetchOne(
            uid,
            { envelope: true, flags: true, bodyStructure: true },
            { uid: true }
          );

          if (structMsg) {
            const envelope = structMsg.envelope;
            const body = await this._extractBodyText(client, uid, structMsg.bodyStructure);
            const attachments = this._collectAttachmentParts(structMsg.bodyStructure);
            detail = {
              id: String(structMsg.seq || ""),
              uid: String(structMsg.uid || uid),
              subject: envelope?.subject || "-",
              from: envelope?.from?.[0]?.address || "-",
              date: formatMailDate(envelope?.date),
              flags: formatFlags(structMsg.flags),
              body,
              attachments,
            };
          }
        }

        return {
          folders,
          selectedFolder,
          folderNotFound,
          total: exists,
          messages,
          selectedMessageUid: chosenUid || "",
          detail,
        };
      } finally {
        lock.release();
      }
    });
  }

  async getMessageDetailByUid(folder, uid) {
    const parsedUid = assertUid(uid);
    const sourceFolder = String(folder || "").trim();
    if (!sourceFolder) {
      throw new Error("Klasor adi zorunludur.");
    }

    return this.withClient(async (client) => {
      const folders = await this._fetchFolders(client);
      if (!folders.includes(sourceFolder)) {
        throw new Error("Klasor bulunamadi.");
      }

      const lock = await client.getMailboxLock(sourceFolder, { readOnly: true });
      try {
        const msg = await client.fetchOne(
          parsedUid,
          { envelope: true, flags: true, bodyStructure: true },
          { uid: true }
        );

        if (!msg) {
          throw new Error("Mail detayi okunamadi.");
        }

        const body = await this._extractBodyText(client, parsedUid, msg.bodyStructure);
        const attachments = this._collectAttachmentParts(msg.bodyStructure);
        return {
          id: String(msg.seq || ""),
          uid: String(msg.uid || parsedUid),
          subject: msg.envelope?.subject || "-",
          from: msg.envelope?.from?.[0]?.address || "-",
          date: formatMailDate(msg.envelope?.date),
          flags: formatFlags(msg.flags),
          body,
          attachments,
        };
      } finally {
        lock.release();
      }
    });
  }

  /**
   * Fetches a single BODY part if it is a listed attachment for this message.
   * @returns {{ buffer: Buffer, contentType: string, filename: string }}
   */
  async fetchAttachmentPart(folder, uid, partPathRaw) {
    const parsedUid = assertUid(uid);
    const partPath = assertValidImapPartPath(partPathRaw);
    const sourceFolder = String(folder || "").trim();
    if (!sourceFolder) {
      throw new Error("Klasor adi zorunludur.");
    }

    return this.withClient(async (client) => {
      const folders = await this._fetchFolders(client);
      if (!folders.includes(sourceFolder)) {
        throw new Error("Klasor bulunamadi.");
      }

      const lock = await client.getMailboxLock(sourceFolder, { readOnly: true });
      try {
        const msg = await client.fetchOne(
          parsedUid,
          { bodyStructure: true },
          { uid: true }
        );

        if (!msg) {
          throw new Error("Mail bulunamadi.");
        }

        const attachments = this._collectAttachmentParts(msg.bodyStructure);
        const meta = attachments.find((a) => a.part === partPath);
        if (!meta) {
          throw new Error("Ek parcasi bulunamadi veya indirilemez.");
        }

        // fetchOne(bodyParts) returns transfer-encoded bytes; downloadMany decodes base64 / QP (ImapFlow).
        const downloaded = await client.downloadMany(String(parsedUid), [partPath], { uid: true });
        const entry = downloaded && downloaded[partPath];
        if (!entry || entry.content == null) {
          throw new Error("Ek icerigi okunamadi.");
        }

        let buffer = entry.content;
        if (!Buffer.isBuffer(buffer)) {
          buffer = Buffer.from(buffer);
        }
        if (buffer.length === 0) {
          throw new Error("Ek icerigi bos.");
        }

        const contentType =
          (entry.meta && entry.meta.contentType) || meta.mimeType || "application/octet-stream";
        const filename = sanitizeFilenameForDownload(
          (entry.meta && entry.meta.filename) || meta.filename,
          partPath
        );

        return {
          buffer,
          contentType,
          filename,
        };
      } finally {
        lock.release();
      }
    });
  }

  async markMessageUnread(folder, uid) {
    const parsedUid = assertUid(uid);
    const sourceFolder = String(folder || "").trim();

    if (!sourceFolder) {
      throw new Error("Klasor adi zorunludur.");
    }

    return this.withClient(async (client) => {
      const folders = await this._fetchFolders(client);

      if (!folders.includes(sourceFolder)) {
        throw new Error("Klasor bulunamadi.");
      }

      const lock = await client.getMailboxLock(sourceFolder, { readOnly: false });
      try {
        const updated = await client.messageFlagsRemove(parsedUid, ["\\Seen"], { uid: true });
        if (!updated) {
          throw new Error("Mail okunmamis olarak isaretlenemedi.");
        }
        return true;
      } finally {
        lock.release();
      }
    });
  }

  async moveMessage(folder, uid, destinationFolder) {
    const parsedUid = assertUid(uid);
    const sourceFolder = String(folder || "").trim();
    const targetFolder = String(destinationFolder || "").trim();

    if (!sourceFolder || !targetFolder) {
      throw new Error("Kaynak ve hedef klasor zorunludur.");
    }

    if (sourceFolder === targetFolder) {
      throw new Error("Mail zaten bu klasorde.");
    }

    return this.withClient(async (client) => {
      const folders = await this._fetchFolders(client);

      if (!folders.includes(sourceFolder)) {
        throw new Error("Kaynak klasor bulunamadi.");
      }

      if (!folders.includes(targetFolder)) {
        throw new Error("Hedef klasor bulunamadi.");
      }

      const lock = await client.getMailboxLock(sourceFolder, { readOnly: false });
      try {
        const moved = await client.messageMove(parsedUid, targetFolder, { uid: true });
        if (!moved) {
          throw new Error("Mail hedef klasore tasinamadi.");
        }
        return true;
      } finally {
        lock.release();
      }
    });
  }
}

module.exports = { MailClientService };
