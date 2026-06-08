module.exports = {
  host: process.env.HOST || "",
  port: 8765,
  /** Oturum imzalama anahtarı — üretimde mutlaka ortam değişkeni verin. */
  sessionSecret: process.env.SESSION_SECRET || "dev-only-change-me",
  /** Oturum çerezi süresi (ms). */
  sessionMaxAgeMs: Number.parseInt(process.env.SESSION_MAX_AGE_MS || "", 10) || 24 * 60 * 60 * 1000,
};
