/**
 * Guess MIME from file basename extension (e.g. Outlook often uses application/octet-stream for PDFs).
 * @param {string} filename
 * @returns {string | null}
 */
function inferMimeTypeFromFilename(filename) {
  const base = String(filename || "").trim().split(/[/\\]/).pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot < 0 || dot === base.length - 1) {
    return null;
  }
  const ext = base.slice(dot + 1).toLowerCase();
  const map = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    bmp: "image/bmp",
    tif: "image/tiff",
    tiff: "image/tiff",
    txt: "text/plain",
    csv: "text/csv",
  };
  return map[ext] || null;
}

/**
 * When server reports a generic binary type, replace with inferred type for correct browser handling.
 * @param {string} contentType
 * @param {string} filename
 * @returns {string}
 */
function normalizeAttachmentContentType(contentType, filename) {
  const ct = String(contentType || "").trim().toLowerCase();
  const inferred = inferMimeTypeFromFilename(filename);
  const generic =
    !ct ||
    ct === "application/octet-stream" ||
    ct === "binary/octet-stream" ||
    ct === "application/force-download" ||
    ct === "application/x-download";
  if (generic && inferred) {
    return inferred;
  }
  return String(contentType || "application/octet-stream").trim() || "application/octet-stream";
}

/** MIME safe for inline tab preview (no SVG). */
function mimeAllowsInlinePreview(mimeRaw) {
  const mime = String(mimeRaw || "").trim().toLowerCase();
  if (!mime) {
    return false;
  }
  if (mime === "application/pdf") {
    return true;
  }
  if (mime === "text/plain" || mime === "text/csv") {
    return true;
  }
  if (mime.startsWith("image/")) {
    if (mime === "image/svg+xml") {
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Show preview when declared MIME or filename extension implies a previewable type.
 * @param {string} mimeRaw
 * @param {string} filename
 */
function attachmentPreviewableByMimeOrFilename(mimeRaw, filename) {
  if (mimeAllowsInlinePreview(mimeRaw)) {
    return true;
  }
  const inferred = inferMimeTypeFromFilename(filename);
  return inferred ? mimeAllowsInlinePreview(inferred) : false;
}

module.exports = {
  inferMimeTypeFromFilename,
  normalizeAttachmentContentType,
  attachmentPreviewableByMimeOrFilename,
};
