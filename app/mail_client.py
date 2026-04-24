import imaplib
import json
import re
import urllib.parse
import urllib.request
from email import message_from_bytes
from email.header import decode_header
from email.message import Message

from app.config import MailboxSettings


def decode_mime(value: str) -> str:
    if not value:
        return ""
    parts = decode_header(value)
    out: list[str] = []
    for chunk, encoding in parts:
        if isinstance(chunk, bytes):
            out.append(chunk.decode(encoding or "utf-8", errors="replace"))
        else:
            out.append(chunk)
    return "".join(out)


class MailClient:
    def __init__(self, settings: MailboxSettings):
        self.settings = settings

    def _get_token(self) -> str:
        authority = self.settings.oauth_authority.rstrip("/")
        token_url = f"{authority}/oauth2/v2.0/token"
        payload = urllib.parse.urlencode(
            {
                "client_id": self.settings.client_id,
                "client_secret": self.settings.client_secret,
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

    def _connect(self) -> imaplib.IMAP4_SSL:
        token = self._get_token()
        auth_string = (
            f"user={self.settings.username}\x01auth=Bearer {token}\x01\x01"
        ).encode("utf-8")
        client = imaplib.IMAP4_SSL(self.settings.endpoint, self.settings.port)
        client.authenticate("XOAUTH2", lambda _: auth_string)
        return client

    def list_folders(self) -> list[str]:
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

    def list_messages(self, folder: str, limit: int = 50) -> tuple[int, list[dict[str, str]]]:
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
            # En yeni mailler en ustte gorunsun diye tersten siraliyoruz.
            sample = list(reversed(ids[-limit:]))
            rows: list[dict[str, str]] = []

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
                        "subject": decode_mime(msg.get("Subject", "")) or "-",
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

    def get_message_detail(self, folder: str, message_id: str) -> dict[str, str]:
        client = self._connect()
        try:
            typ, _ = client.select(folder, readonly=True)
            if typ != "OK":
                raise RuntimeError(f"{folder} klasoru acilamadi.")

            typ, data = client.fetch(message_id, "(BODY.PEEK[])")
            if typ != "OK" or not data or not data[0]:
                raise RuntimeError("Mail detayi okunamadi.")

            raw = data[0][1]
            msg = message_from_bytes(raw)
            body_text = self._extract_body_text(msg)
            return {
                "id": message_id,
                "subject": decode_mime(msg.get("Subject", "")) or "-",
                "from": decode_mime(msg.get("From", "")),
                "date": decode_mime(msg.get("Date", "")),
                "body": body_text or "(Icerik bos)",
            }
        finally:
            try:
                client.close()
            except Exception:
                pass
            try:
                client.logout()
            except Exception:
                pass

    def _extract_body_text(self, msg: Message) -> str:
        if msg.is_multipart():
            plain = None
            html_part = None
            for part in msg.walk():
                content_type = part.get_content_type()
                disposition = (part.get("Content-Disposition") or "").lower()
                if "attachment" in disposition:
                    continue
                payload = part.get_payload(decode=True)
                if payload is None:
                    continue
                charset = part.get_content_charset() or "utf-8"
                text = payload.decode(charset, errors="replace")
                if content_type == "text/plain" and plain is None:
                    plain = text
                elif content_type == "text/html" and html_part is None:
                    html_part = text
            if plain:
                return plain.strip()
            if html_part:
                return self._strip_html(html_part).strip()
            return ""

        payload = msg.get_payload(decode=True)
        if payload is None:
            return ""
        charset = msg.get_content_charset() or "utf-8"
        text = payload.decode(charset, errors="replace")
        if msg.get_content_type() == "text/html":
            return self._strip_html(text).strip()
        return text.strip()

    def _strip_html(self, value: str) -> str:
        value = re.sub(r"(?is)<(script|style).*?>.*?</\\1>", "", value)
        value = re.sub(r"(?s)<[^>]+>", " ", value)
        value = re.sub(r"\\s+", " ", value)
        return value
