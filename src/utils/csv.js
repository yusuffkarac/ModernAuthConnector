const fs = require("fs/promises");

function parseSemicolonLine(line) {
  const cells = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ";" && !inQuotes) {
      cells.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  cells.push(cur);
  return cells;
}

async function readSettings(csvPath) {
  const raw = await fs.readFile(csvPath, "utf8");
  const lines = raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV icinde ayar satiri bulunamadi.");
  }

  const headers = parseSemicolonLine(lines[0]);
  const values = parseSemicolonLine(lines[1]);
  const row = {};

  headers.forEach((h, i) => {
    row[h] = (values[i] || "").trim();
  });

  return {
    endpoint: row.Endpoint,
    username: row["Endpoint Username"],
    port: Number.parseInt(row["FTP Port"] || "993", 10) || 993,
    oauthAuthority: row["OAUTH AUTHORITY"],
    clientId: row["OAUTH CLIENTID"],
    clientSecret: row["OAUTH CLIENTSECRET"],
  };
}

module.exports = { readSettings };
