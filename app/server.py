import html
import os
import urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

from app.mail_client import MailClient


def render_template(template_text: str, **context: str) -> str:
    output = template_text
    for key, value in context.items():
        output = output.replace(f"{{{{{key}}}}}", value)
    return output


def create_handler(mail_client: MailClient, template_path: str, css_path: str):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            parsed = urllib.parse.urlparse(self.path)
            if parsed.path == "/static/styles.css":
                return self._serve_css(css_path)

            if parsed.path != "/":
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"Not Found")
                return

            query = urllib.parse.parse_qs(parsed.query)
            selected = (query.get("folder", ["Done"])[0] or "Done").strip()
            selected_mid = (query.get("mid", [""])[0] or "").strip()

            folders: list[str] = []
            messages: list[dict[str, str]] = []
            total = ""
            error = ""
            detail: dict[str, str] | None = None

            try:
                folders = mail_client.list_folders()
                if selected not in folders and folders:
                    selected = folders[0]
                message_total, messages = mail_client.list_messages(selected, limit=50)
                total = str(message_total)
                if messages:
                    if not selected_mid:
                        selected_mid = messages[0]["id"]
                    if any(m["id"] == selected_mid for m in messages):
                        detail = mail_client.get_message_detail(selected, selected_mid)
            except Exception as exc:
                error = html.escape(str(exc))

            options_html = []
            for folder in folders:
                selected_attr = " selected" if folder == selected else ""
                options_html.append(
                    f'<option value="{html.escape(folder)}"{selected_attr}>'
                    f"{html.escape(folder)}</option>"
                )

            folder_links_html = []
            for folder in folders:
                is_active = " active" if folder == selected else ""
                folder_links_html.append(
                    "<a class='folder-item"
                    f"{is_active}' href='/?folder={urllib.parse.quote(folder)}'>"
                    f"{html.escape(folder)}</a>"
                )

            rows_html = []
            for row in messages:
                is_active = " active" if row["id"] == selected_mid else ""
                rows_html.append(
                    f"<a class='mail-item{is_active}' "
                    f"href='/?folder={urllib.parse.quote(selected)}&mid={urllib.parse.quote(row['id'])}'>"
                    "<div class='mail-item-top'>"
                    f"<h3>{html.escape(row['subject'])}</h3>"
                    f"<span class='mail-id'>#{html.escape(row['id'])}</span>"
                    "</div>"
                    f"<p class='mail-from'>{html.escape(row['from'])}</p>"
                    f"<p class='mail-date'>{html.escape(row['date'])}</p>"
                    "</a>"
                )
            if not rows_html:
                rows_html.append("<div class='empty'>Kayit yok</div>")

            detail_block = "<div class='empty'>Soldan bir mail sec.</div>"
            if detail:
                detail_block = (
                    "<article class='mail-preview'>"
                    f"<h2>{html.escape(detail['subject'])}</h2>"
                    f"<p><strong>Kimden:</strong> {html.escape(detail['from'])}</p>"
                    f"<p><strong>Tarih:</strong> {html.escape(detail['date'])}</p>"
                    "<hr />"
                    f"<pre>{html.escape(detail['body'])}</pre>"
                    "</article>"
                )

            with open(template_path, "r", encoding="utf-8") as f:
                template = f.read()

            body = render_template(
                template,
                options="".join(options_html),
                folder_links="".join(folder_links_html),
                selected_folder=html.escape(selected),
                error_block=(f"<div class='error'>{error}</div>" if error else ""),
                total=(total if total else "-"),
                rows="".join(rows_html),
                detail_block=detail_block,
            ).encode("utf-8")

            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def _serve_css(self, path: str):
            if not os.path.exists(path):
                self.send_response(404)
                self.end_headers()
                return
            with open(path, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "text/css; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def log_message(self, format: str, *args):
            return

    return Handler


def run_server(mail_client: MailClient, host: str, port: int, base_dir: str):
    template_path = os.path.join(base_dir, "templates", "index.html")
    css_path = os.path.join(base_dir, "static", "styles.css")
    handler = create_handler(mail_client, template_path, css_path)
    server = HTTPServer((host, port), handler)
    print(f"Acildi: http://{host}:{port}")
    print("Not: Salt-okunur listeleme yapar, mailbox uzerinde degisiklik yapmaz.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
