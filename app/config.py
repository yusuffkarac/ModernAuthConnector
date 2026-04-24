import csv
from dataclasses import dataclass


@dataclass
class MailboxSettings:
    endpoint: str
    username: str
    port: int
    oauth_authority: str
    client_id: str
    client_secret: str


def load_settings(csv_path: str) -> MailboxSettings:
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f, delimiter=";"))

    if not rows:
        raise RuntimeError("CSV icinde ayar satiri bulunamadi.")

    row = rows[0]
    return MailboxSettings(
        endpoint=row.get("Endpoint", "").strip(),
        username=row.get("Endpoint Username", "").strip(),
        port=int((row.get("FTP Port", "") or "993").strip() or "993"),
        oauth_authority=row.get("OAUTH AUTHORITY", "").strip(),
        client_id=row.get("OAUTH CLIENTID", "").strip(),
        client_secret=row.get("OAUTH CLIENTSECRET", "").strip(),
    )
