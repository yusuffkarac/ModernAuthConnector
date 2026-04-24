const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");

function stripHtml(input) {
  return input
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
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

function assertUid(uid) {
  const parsed = Number.parseInt(String(uid || ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Gecersiz mail uid.");
  }
  return parsed;
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
      const folders = await client.list();
      const mapped = folders.map((f) => f.path);
      this.folderCache = { value: mapped, expiresAt: Date.now() + 60 * 1000 };
      return mapped;
    });
  }

  async listMessages(folder, limit = 50) {
    return this.withClient(async (client) => {
      const lock = await client.getMailboxLock(folder, { readOnly: true });
      try {
        const exists = client.mailbox.exists || 0;
        const start = Math.max(1, exists - limit + 1);
        const summary = [];

        for await (const msg of client.fetch(
          `${start}:${exists || 1}`,
          { uid: true, envelope: true, flags: true },
          { uid: false }
        )) {
          summary.push({
            id: String(msg.seq),
            date: msg.envelope?.date ? new Date(msg.envelope.date).toString() : "",
            from: msg.envelope?.from?.[0]?.address || "-",
            subject: msg.envelope?.subject || "-",
            flags: formatFlags(msg.flags),
          });
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

        const msg = await client.fetchOne(
          seq,
          { envelope: true, source: true, flags: true },
          { uid: false }
        );

        if (!msg) {
          throw new Error("Mail detayi okunamadi.");
        }

        const envelope = msg.envelope;
        const parsed = await simpleParser(msg.source);
        const textBody = parsed.text || "";
        const htmlBody = typeof parsed.html === "string" ? parsed.html : "";
        const body = textBody.trim() || stripHtml(htmlBody) || "(Icerik bos)";
        return {
          id: String(seq),
          subject: envelope?.subject || "-",
          from: envelope?.from?.[0]?.address || "-",
          date: envelope?.date ? new Date(envelope.date).toString() : "",
          flags: formatFlags(msg.flags),
          body,
        };
      } finally {
        lock.release();
      }
    });
  }

  async getMailboxView(folder, selectedMessageUid, limit = 50) {
    return this.withClient(async (client) => {
      const listedFolders = await client.list();
      const folders = listedFolders.map((f) => f.path);
      this.folderCache = { value: folders, expiresAt: Date.now() + 60 * 1000 };

      let selectedFolder = folder;
      let folderNotFound = false;
      if (!folders.includes(selectedFolder) && folders.length > 0) {
        folderNotFound = true;
        [selectedFolder] = folders;
      }

      const lock = await client.getMailboxLock(selectedFolder, { readOnly: true });
      try {
        const exists = client.mailbox.exists || 0;
        const start = Math.max(1, exists - limit + 1);
        const messages = [];

        for await (const msg of client.fetch(
          `${start}:${exists || 1}`,
          { uid: true, envelope: true, flags: true },
          { uid: false }
        )) {
          messages.push({
            id: String(msg.seq),
            uid: String(msg.uid || ""),
            date: msg.envelope?.date ? new Date(msg.envelope.date).toString() : "",
            from: msg.envelope?.from?.[0]?.address || "-",
            subject: msg.envelope?.subject || "-",
            flags: formatFlags(msg.flags),
          });
        }

        messages.sort((a, b) => Number.parseInt(b.uid, 10) - Number.parseInt(a.uid, 10));
        let chosenUid = selectedMessageUid;
        if (!chosenUid && messages.length > 0) {
          chosenUid = messages[0].uid;
        }

        let detail = null;
        if (chosenUid && messages.some((m) => m.uid === chosenUid)) {
          const uid = Number.parseInt(chosenUid, 10);
          const msg = await client.fetchOne(
            uid,
            { envelope: true, source: true, flags: true },
            { uid: true }
          );

          if (msg) {
            const envelope = msg.envelope;
            const parsed = await simpleParser(msg.source);
            const textBody = parsed.text || "";
            const htmlBody = typeof parsed.html === "string" ? parsed.html : "";
            const body = textBody.trim() || stripHtml(htmlBody) || "(Icerik bos)";
            detail = {
              id: String(msg.seq || ""),
              uid: String(msg.uid || uid),
              subject: envelope?.subject || "-",
              from: envelope?.from?.[0]?.address || "-",
              date: envelope?.date ? new Date(envelope.date).toString() : "",
              flags: formatFlags(msg.flags),
              body,
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

  async markMessageUnread(folder, uid) {
    const parsedUid = assertUid(uid);
    const sourceFolder = String(folder || "").trim();

    if (!sourceFolder) {
      throw new Error("Klasor adi zorunludur.");
    }

    return this.withClient(async (client) => {
      const listedFolders = await client.list();
      const folders = listedFolders.map((f) => f.path);
      this.folderCache = { value: folders, expiresAt: Date.now() + 60 * 1000 };

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
      const listedFolders = await client.list();
      const folders = listedFolders.map((f) => f.path);
      this.folderCache = { value: folders, expiresAt: Date.now() + 60 * 1000 };

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
