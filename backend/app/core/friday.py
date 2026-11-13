"""Nudges as Friday notifications: NATS `notify.<user>`, which Friday's gateway
pushes to the phone (friday repo, server/friday_gateway/bus.py).

Optional: with FRIDAY_NATS_URL unset nothing is sent. A failure is logged,
never raised, and sending runs on its own thread so a request never waits for
it. The NATS protocol is spoken directly (one CONNECT, one PUB, a PING to be
sure it landed), as Pace does, to need no client library.

Settings, from the environment (.env.prod):
  FRIDAY_NATS_URL            e.g. nats://127.0.0.1:4222
  FRIDAY_NATS_USER           the login, default "applyquest"
  FRIDAY_NATS_PASSWORD_FILE  a file holding its password
  FRIDAY_USER                the Kanidm name whose phone hears it, default "anish"
"""
from __future__ import annotations

import json
import logging
import os
import socket
import threading

log = logging.getLogger(__name__)
SECTION = "applyquest"


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def send_now(title: str, body: str = "") -> bool:
    url = _env("FRIDAY_NATS_URL")
    if not url:
        return False
    user = _env("FRIDAY_USER", "anish")
    payload = json.dumps({"section": SECTION, "title": title[:200], "body": body[:1000]}, ensure_ascii=False).encode()
    connect = {"verbose": False, "pedantic": False, "name": "applyquest", "lang": "python", "version": "1"}
    try:
        pw_file = _env("FRIDAY_NATS_PASSWORD_FILE")
        if pw_file:
            with open(pw_file) as f:
                connect.update(user=_env("FRIDAY_NATS_USER", "applyquest"), **{"pass": f.read().strip()})
        host, port = url.split("://", 1)[-1].rsplit(":", 1)
        with socket.create_connection((host, int(port)), timeout=5) as sock:
            f = sock.makefile("rwb")
            if not f.readline().startswith(b"INFO "):
                raise ConnectionError("not a NATS server")
            f.write(b"CONNECT " + json.dumps(connect).encode() + b"\r\n")
            f.write(f"PUB notify.{user} {len(payload)}\r\n".encode() + payload + b"\r\nPING\r\n")
            f.flush()
            while True:
                line = f.readline()
                if not line or line.startswith(b"-ERR"):
                    raise ConnectionError((line or b"closed").decode().strip())
                if line.startswith(b"PONG"):
                    return True
    except (OSError, ValueError) as e:
        log.warning("couldn't tell Friday: %s", e)
        return False


def tell(title: str, body: str = "") -> None:
    """Send in the background."""
    threading.Thread(target=send_now, args=(title, body), daemon=True).start()
