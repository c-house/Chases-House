#!/usr/bin/env python3
"""
serve-vault.py — serve *.age files from a local directory over HTTP.

Designed to sit behind a Cloudflare Tunnel + Zero Trust Access policy at
files.chases.house. See docs/files-tunnel-setup.md.

Hardening:
  - Only paths matching ^/[A-Za-z0-9._-]+\\.age$ are served. Everything else
    returns 403 Forbidden. Defence-in-depth in case Zero Trust is ever
    misconfigured.
  - No directory listings.
  - CORS: Access-Control-Allow-Origin: https://chases.house on OPTIONS only
    (not currently used, but kept as a seam if a browser-side listing is
    ever added).

Usage:
  python serve-vault.py [DIR] [PORT]

Defaults: DIR=./vault  PORT=8765

This script lives outside the repo (it has operational purpose only).
Copy it somewhere like C:\\Users\\chase\\tools\\ and run it alongside
cloudflared.
"""

import http.server
import os
import re
import sys
from functools import partial

ALLOWED = re.compile(r"^/[A-Za-z0-9._-]+\.age$")


class VaultHandler(http.server.SimpleHTTPRequestHandler):
    # Suppress directory listing (overrides the default list_directory).
    def list_directory(self, path):  # noqa: D401 - stdlib override
        self.send_error(403, "Directory listing disabled")
        return None

    def do_GET(self):
        if not ALLOWED.match(self.path):
            self.send_error(403, "Not an .age file")
            return
        return super().do_GET()

    def do_HEAD(self):
        if not ALLOWED.match(self.path):
            self.send_error(403, "Not an .age file")
            return
        return super().do_HEAD()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "https://chases.house")
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS")
        self.end_headers()

    def end_headers(self):
        # No-store: operator distributes .age files once; avoid intermediary caching.
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    # Quiet the default stderr request log; cloudflared already logs.
    def log_message(self, fmt, *args):  # noqa: D401
        pass


def main():
    directory = sys.argv[1] if len(sys.argv) > 1 else "vault"
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 8765

    directory = os.path.abspath(directory)
    if not os.path.isdir(directory):
        sys.stderr.write(f"vault directory does not exist: {directory}\n")
        sys.exit(1)

    handler = partial(VaultHandler, directory=directory)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"serving *.age files from {directory} on http://127.0.0.1:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
