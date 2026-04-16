#!/usr/bin/env python3
"""abdullah-learn GitHub webhook.

Minimal stdlib-only HTTP service. On a verified `push` to the configured
branch, runs `git pull --ff-only` against the checkout at LEARN_REPO_PATH.

Endpoints
---------
POST /webhook         — GitHub delivery. HMAC-SHA256 required.
GET  /webhook/health  — liveness probe. Unauthenticated.

Environment
-----------
GITHUB_WEBHOOK_SECRET   (required)     HMAC secret shared with GitHub.
LEARN_REPO_PATH         (/opt/learn)   Path to the git checkout.
LEARN_WEBHOOK_HOST      (127.0.0.1)    Bind host.
LEARN_WEBHOOK_PORT      (9100)         Bind port.
LEARN_BRANCH            (main)         Branch expected on the push ref.

The service refuses to start if the secret is missing/empty or the repo
path isn't a git working tree. All significant events are logged to
stdout so systemd journal captures them.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import subprocess
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# --- config ------------------------------------------------------------------

SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "").strip()
REPO_PATH = os.environ.get("LEARN_REPO_PATH", "/opt/learn")
BIND_HOST = os.environ.get("LEARN_WEBHOOK_HOST", "127.0.0.1")
BIND_PORT = int(os.environ.get("LEARN_WEBHOOK_PORT", "9100"))
BRANCH = os.environ.get("LEARN_BRANCH", "main")

MAX_BODY = 1 * 1024 * 1024  # 1 MiB
GIT_TIMEOUT = 60  # seconds

log = logging.getLogger("learn-webhook")


# --- helpers -----------------------------------------------------------------

def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(body)


def _verify_signature(secret: str, body: bytes, sig_header: str | None) -> bool:
    if not sig_header or not sig_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    provided = sig_header.split("=", 1)[1].strip()
    return hmac.compare_digest(expected, provided)


def _run_git_pull() -> tuple[bool, str]:
    """Run `git pull --ff-only`. Returns (ok, combined_output)."""
    try:
        proc = subprocess.run(
            ["git", "-C", REPO_PATH, "pull", "--ff-only", "origin", BRANCH],
            capture_output=True,
            text=True,
            timeout=GIT_TIMEOUT,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return False, f"git pull timed out after {GIT_TIMEOUT}s"
    except FileNotFoundError:
        return False, "git binary not found on PATH"

    output = (proc.stdout or "") + (proc.stderr or "")
    return proc.returncode == 0, output.strip()


def _startup_sanity() -> None:
    if not SECRET:
        print("fatal: GITHUB_WEBHOOK_SECRET is empty or unset", file=sys.stderr)
        sys.exit(2)
    git_dir = os.path.join(REPO_PATH, ".git")
    if not os.path.isdir(git_dir):
        print(
            f"fatal: LEARN_REPO_PATH={REPO_PATH!r} is not a git working tree "
            f"(missing {git_dir})",
            file=sys.stderr,
        )
        sys.exit(2)


# --- handler -----------------------------------------------------------------

class WebhookHandler(BaseHTTPRequestHandler):
    server_version = "learn-webhook/1.0"

    # Route stdlib logs through our logger so journald sees uniform lines.
    def log_message(self, fmt: str, *args) -> None:  # noqa: A003
        log.info("%s - %s", self.address_string(), fmt % args)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/webhook/health":
            _json_response(self, HTTPStatus.OK, {"ok": True, "service": "learn-webhook"})
            return
        _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/webhook":
            _json_response(self, HTTPStatus.NOT_FOUND, {"ok": False, "error": "not found"})
            return

        length_raw = self.headers.get("Content-Length")
        try:
            length = int(length_raw) if length_raw is not None else 0
        except ValueError:
            _json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": "bad length"})
            return

        if length <= 0:
            _json_response(self, HTTPStatus.BAD_REQUEST, {"ok": False, "error": "empty body"})
            return
        if length > MAX_BODY:
            _json_response(self, HTTPStatus.REQUEST_ENTITY_TOO_LARGE,
                           {"ok": False, "error": "body too large"})
            return

        body = self.rfile.read(length)

        delivery = self.headers.get("X-GitHub-Delivery", "-")
        event = self.headers.get("X-GitHub-Event", "-")
        sig = self.headers.get("X-Hub-Signature-256")

        if not _verify_signature(SECRET, body, sig):
            log.warning("delivery=%s event=%s bad signature", delivery, event)
            _json_response(self, HTTPStatus.UNAUTHORIZED,
                           {"ok": False, "error": "bad signature"})
            return

        # Parse after verifying signature. Order matters.
        try:
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            log.warning("delivery=%s event=%s bad json: %s", delivery, event, e)
            _json_response(self, HTTPStatus.BAD_REQUEST,
                           {"ok": False, "error": "bad json"})
            return

        if event == "ping":
            log.info("delivery=%s event=ping ok", delivery)
            _json_response(self, HTTPStatus.OK, {"ok": True, "pong": True})
            return

        if event != "push":
            log.info("delivery=%s event=%s ignored (non-push)", delivery, event)
            _json_response(self, HTTPStatus.OK,
                           {"ok": True, "ignored": True, "reason": f"event={event}"})
            return

        ref = (payload.get("ref") or "").strip()
        expected_ref = f"refs/heads/{BRANCH}"
        if ref != expected_ref:
            log.info("delivery=%s event=push ref=%s ignored (not %s)",
                     delivery, ref or "-", expected_ref)
            _json_response(self, HTTPStatus.OK,
                           {"ok": True, "ignored": True, "reason": f"ref={ref}"})
            return

        commit_sha = (payload.get("after") or "")[:12] or "-"
        ok, output = _run_git_pull()
        if ok:
            log.info("delivery=%s event=push commit=%s pull ok", delivery, commit_sha)
            _json_response(self, HTTPStatus.OK,
                           {"ok": True, "pulled": True, "commit": commit_sha})
        else:
            log.error("delivery=%s event=push commit=%s pull FAILED: %s",
                      delivery, commit_sha, output)
            _json_response(self, HTTPStatus.INTERNAL_SERVER_ERROR,
                           {"ok": False, "pulled": False, "commit": commit_sha,
                            "error": output[-400:]})


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
        stream=sys.stdout,
    )
    _startup_sanity()

    server = ThreadingHTTPServer((BIND_HOST, BIND_PORT), WebhookHandler)
    log.info("learn-webhook listening on %s:%d repo=%s branch=%s",
             BIND_HOST, BIND_PORT, REPO_PATH, BRANCH)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("shutdown requested")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
