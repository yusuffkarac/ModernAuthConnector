#!/usr/bin/env python3
from run import main


if __name__ == "__main__":
    main()
#!/usr/bin/env python3
import csv
import html
import imaplib
import json
import os
import urllib.parse
import urllib.request
from email import message_from_bytes
from email.header import decode_header
from http.server import BaseHTTPRequestHandler, HTTPServer


SETTINGS_FILE = "Edi Settings.csv"
HOST = "127.0.0.1"
PORT = 8765


def decode_mime(value):
    if not value:
        return ""
    parts = decode_header(value)
    out = []
    for chunk, enc in parts:
        if isinstance(chunk, bytes):
            out.append(chunk.decode(enc or "utf-8", errors="replace"))
        else:
            out.append(chunk)
    return "".join(out)


def load_settings(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f, delimiter=";"))
    if not rows:
        raise RuntimeError("CSV icinde ayar satiri bulunamadi.")
    row = rows[0]
    return {
        "endpoint": row.get("Endpoint", "").strip(),
        "username": row.get("Endpoint Username", "").strip(),
        "port": int((row.get("FTP Port", "") or "993").strip() or "993"),
        "oauth_authority": row.get("OAUTH AUTHORITY", "").strip(),
        "client_id": row.get("OAUTH CLIENTID", "").strip(),
        "client_secret": row.get("OAUTH CLIENTSECRET", "").strip(),
    }


class MailClient:
    def __init__(self, settings):
        self.settings = settings

    def _get_token(self):
        authority = self.settings["oauth_authority"].rstrip("/")
        token_url = f"{authority}/oauth2/v2.0/token"
        payload = urllib.parse.urlencode(
            {
                "client_id": self.settings["client_id"],
                "client_secret": self.settings["client_secret"],
                "grant_type": "client_credentials",
                "scope": "https://outlook.office365.com/.default",
            }
        ).encode("utf-8")
        req = urllib.request.Request(token_url, data=payload, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        token = data.get("access_token")
        if not token:
            raise RuntimeError("OAuth token alinamadi.")
        return token

    def _connect(self):
        token = self._get_token()
        auth_string = (
            f"user={self.settings['username']}\x01auth=Bearer {token}\x01\x01"
        ).encode("utf-8")
        client = imaplib.IMAP4_SSL(self.settings["endpoint"], self.settings["port"])
        client.authenticate("XOAUTH2", lambda _: auth_string)
        return client

    def list_folders(self):
        client = self._connect()
        try:
            typ, mailboxes = client.list()
            if typ != "OK":
                raise RuntimeError("Klasorler listelenemedi.")
            folders = []
            for item in mailboxes:
                line = item.decode("utf-8", errors="replace")
                folder = line.rsplit(' "/" ', 1)[-1].strip('"')
                folders.append(folder)
            return folders
        finally:
            try:
                client.logout()
            except Exception:
                pass

    def list_messages(self, folder, limit=30):
        client = self._connect()
        try:
            typ, sel = client.select(folder, readonly=True)
            if typ != "OK":
                raise RuntimeError(f"{folder} klasoru acilamadi.")
            total = int(sel[0])
            typ, found = client.search(None, "ALL")
            if typ != "OK":
                raise RuntimeError("Mesajlar aranirken hata olustu.")

            ids = found[0].split()
            sample = ids[-limit:]
            rows = []
            for mid in sample:
                typ, msg_data = client.fetch(
                    mid, "(BODY.PEEK[HEADER.FIELDS (DATE FROM SUBJECT)])"
                )
                if typ != "OK" or not msg_data or not msg_data[0]:
                    continue
                raw = msg_data[0][1]
                msg = message_from_bytes(raw)
                rows.append(
                    {
                        "id": mid.decode(),
                        "date": decode_mime(msg.get("Date", "")),
                        "from": decode_mime(msg.get("From", "")),
                        "subject": decode_mime(msg.get("Subject", "")),
                    }
                )
            return total, rows
        finally:
            try:
                client.close()
            except Exception:
                pass
            try:
                client.logout()
            except Exception:
                pass


def render_page(folders, selected_folder, total, messages, error):
    options = []
    for folder in folders:
        sel = " selected" if folder == selected_folder else ""
        options.append(
            f'<option value="{html.escape(folder)}"{sel}>{html.escape(folder)}</option>'
        )
    option_html = "\n".join(options)

    rows = []
    for m in messages:
        rows.append(
            "<tr>"
            f"<td>{html.escape(m['id'])}</td>"
            f"<td>{html.escape(m['date'])}</td>"
            f"<td>{html.escape(m['from'])}</td>"
            f"<td>{html.escape(m['subject'] or '-')}</td>"
            "</tr>"
        )
    rows_html = "\n".join(rows) if rows else "<tr><td colspan='4'>Kayit yok</td></tr>"

    error_html = (
        f"<div class='error'>{html.escape(error)}</div>" if error else ""
    )
    total_html = f"<p><b>Toplam:</b> {total}</p>" if total is not None else ""

    return f"""<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mailbox Viewer</title>
  <style>
    body {{ font-family: Arial, sans-serif; margin: 24px; background: #fafafa; }}
    .card {{ background: #fff; padding: 16px; border: 1px solid #ddd; border-radius: 8px; }}
    .error {{ color: #9b1c1c; background: #fde8e8; padding: 10px; border-radius: 6px; margin: 12px 0; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
    th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 14px; }}
    th {{ background: #f3f4f6; }}
    .note {{ color: #555; font-size: 13px; margin-top: 8px; }}
  </style>
</head>
<body>
  <div class="card">
    <h2>Mailbox Goruntuleyici</h2>
    <form method="GET" action="/">
      <label for="folder">Klasor:</label>
      <select id="folder" name="folder">{option_html}</select>
      <button type="submit">Listele</button>
    </form>
    <div class="note">Sadece okumadir (readonly). Mesaj degistirme/silme yapilmaz.</div>
    {error_html}
    {total_html}
    <table>
      <thead><tr><th>ID</th><th>Tarih</th><th>Gonderen</th><th>Konu</th></tr></thead>
      <tbody>{rows_html}</tbody>
    </table>
  </div>
</body>
</html>"""


class Handler(BaseHTTPRequestHandler):
    client = None

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != "/":
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"Not Found")
            return

        query = urllib.parse.parse_qs(parsed.query)
        selected = (query.get("folder", ["Done"])[0] or "Done").strip()

        folders = []
        total = None
        messages = []
        error = ""

        try:
            folders = self.client.list_folders()
            if selected not in folders and folders:
                selected = folders[0]
            total, messages = self.client.list_messages(selected, limit=50)
        except Exception as exc:
            error = str(exc)

        body = render_page(folders, selected, total, messages, error).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


def main():
    csv_path = os.path.join(os.getcwd(), SETTINGS_FILE)
    if not os.path.exists(csv_path):
        raise SystemExit(f"{SETTINGS_FILE} bulunamadi: {csv_path}")

    settings = load_settings(csv_path)
    Handler.client = MailClient(settings)

    server = HTTPServer((HOST, PORT), Handler)
    print(f"Acildi: http://{HOST}:{PORT}")
    print("Not: Salt-okunur listeleme yapar, mailbox uzerinde degisiklik yapmaz.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
