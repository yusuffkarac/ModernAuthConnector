#!/usr/bin/env python3
import os

from app.config import load_settings
from app.mail_client import MailClient
from app.server import run_server


HOST = "127.0.0.1"
PORT = 8765
SETTINGS_FILE = "Edi Settings.csv"


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, SETTINGS_FILE)
    if not os.path.exists(csv_path):
        raise SystemExit(f"{SETTINGS_FILE} bulunamadi: {csv_path}")

    settings = load_settings(csv_path)
    client = MailClient(settings)
    run_server(client, host=HOST, port=PORT, base_dir=base_dir)


if __name__ == "__main__":
    main()
