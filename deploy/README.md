# abdullah-learn — deployment runbook

Target host: **penforge** (Ubuntu, systemd, nginx, certbot already
installed). Domain: **learn.iabdullah.xyz**.

Deployment model: `git push` → GitHub → webhook → `git pull --ff-only`
on the server. No file upload, no scp.

---

## 0. Prerequisites

On penforge, confirm the tools exist:

```sh
python3 --version         # 3.10+ preferred
nginx -v
certbot --version
git --version
```

DNS: an A/AAAA record for `learn.iabdullah.xyz` must point at penforge
before certbot will succeed.

---

## 1. Create a deploy user

```sh
sudo adduser --system --group --home /opt/learn --shell /usr/sbin/nologin learndeploy
sudo install -d -o learndeploy -g learndeploy /opt/learn
sudo install -d -o learndeploy -g learndeploy /opt/learn-webhook
```

The user has no password and no login shell. Everything git-related
runs through systemd or `sudo -u learndeploy`.

---

## 2. GitHub deploy key

```sh
sudo -u learndeploy ssh-keygen -t ed25519 -N '' -f /opt/learn/.ssh/id_ed25519 -C 'learndeploy@penforge'
sudo -u learndeploy cat /opt/learn/.ssh/id_ed25519.pub
```

Add the printed public key to the GitHub repo as a **Deploy Key**, with
**Allow write access disabled**. Also add `github.com` to the deploy
user's `known_hosts`:

```sh
sudo -u learndeploy ssh-keyscan github.com >> /opt/learn/.ssh/known_hosts
sudo chmod 600 /opt/learn/.ssh/id_ed25519
sudo chmod 644 /opt/learn/.ssh/id_ed25519.pub /opt/learn/.ssh/known_hosts
```

---

## 3. Clone the repo

```sh
sudo -u learndeploy git clone git@github.com:iabdullahmah/abdullah-learn.git /opt/learn
cd /opt/learn && sudo -u learndeploy git log -1 --oneline
```

`/opt/learn` is now the document root nginx serves. `git pull --ff-only`
from the webhook will refresh it in place.

---

## 4. Install the webhook

```sh
sudo install -o learndeploy -g learndeploy -m 0755 \
    /opt/learn/deploy/webhook/webhook.py /opt/learn-webhook/webhook.py
```

Generate a strong secret and put it in the env file. The env file is
root-owned mode 600 — only systemd reads it.

```sh
SECRET=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
sudo install -m 0600 -o root -g root /dev/null /etc/learn-webhook.env
sudo tee /etc/learn-webhook.env >/dev/null <<EOF
GITHUB_WEBHOOK_SECRET=${SECRET}
LEARN_REPO_PATH=/opt/learn
LEARN_WEBHOOK_HOST=127.0.0.1
LEARN_WEBHOOK_PORT=9100
LEARN_BRANCH=main
EOF
echo "webhook secret: ${SECRET}"   # copy this; you'll paste it into GitHub
```

---

## 5. Install the systemd unit

```sh
sudo install -m 0644 /opt/learn/deploy/systemd/learn-webhook.service /etc/systemd/system/learn-webhook.service
sudo systemctl daemon-reload
sudo systemctl enable --now learn-webhook
sudo systemctl status learn-webhook --no-pager
```

Health check — must return `{"ok": true, "service": "learn-webhook"}`:

```sh
curl -sS http://127.0.0.1:9100/webhook/health
```

---

## 6. Install the nginx vhost

```sh
sudo install -m 0644 /opt/learn/deploy/nginx/learn.iabdullah.xyz.conf \
    /etc/nginx/sites-available/learn.iabdullah.xyz.conf
sudo ln -sf /etc/nginx/sites-available/learn.iabdullah.xyz.conf \
    /etc/nginx/sites-enabled/learn.iabdullah.xyz.conf
```

Add the rate-limit zone to the top-level `http { }` block in
`/etc/nginx/nginx.conf` (idempotent: check before appending):

```sh
grep -q 'zone=learn_webhook' /etc/nginx/nginx.conf \
    || sudo sed -i '/^http {/a\    limit_req_zone $binary_remote_addr zone=learn_webhook:1m rate=2r/s;' /etc/nginx/nginx.conf
sudo nginx -t
sudo systemctl reload nginx
```

---

## 7. TLS via certbot

```sh
sudo certbot --nginx -d learn.iabdullah.xyz
```

certbot edits the vhost, uncommenting the `ssl_certificate*` lines and
wiring the HSTS/HTTP→HTTPS redirect cleanly. After it finishes:

```sh
curl -sI https://learn.iabdullah.xyz/ | head -n 1    # expect 200
```

Certbot's systemd timer handles renewal. No cron needed.

---

## 8. Register the GitHub webhook

GitHub repo → Settings → Webhooks → Add webhook.

- **Payload URL:** `https://learn.iabdullah.xyz/webhook`
- **Content type:** `application/json`
- **Secret:** paste the hex secret from step 4
- **SSL verification:** enabled
- **Which events:** *Just the `push` event.*
- **Active:** ✓

Click **Add webhook**. GitHub immediately sends a `ping`; the service
should log `event=ping ok`.

---

## 9. End-to-end test

On your laptop:

```sh
git commit --allow-empty -m "test: webhook round-trip"
git push
```

On penforge:

```sh
journalctl -u learn-webhook -f
```

Expected log: `delivery=… event=push commit=<sha> pull ok`. Open the
site and confirm the commit landed.

---

## Operations

### Logs

```sh
journalctl -u learn-webhook -f             # live
journalctl -u learn-webhook --since '1h ago'
tail -f /var/log/nginx/learn.access.log
tail -f /var/log/nginx/learn.error.log
```

### Manual pull

If GitHub is down or a webhook is lost, pull by hand:

```sh
sudo -u learndeploy git -C /opt/learn pull --ff-only origin main
```

### Rotate the webhook secret

```sh
NEW=$(python3 -c 'import secrets; print(secrets.token_hex(32))')
sudo sed -i "s|^GITHUB_WEBHOOK_SECRET=.*|GITHUB_WEBHOOK_SECRET=${NEW}|" /etc/learn-webhook.env
sudo systemctl restart learn-webhook
echo "new secret: ${NEW}"
```

Then update the secret on GitHub: Settings → Webhooks → Edit. Trigger a
manual redelivery to confirm.

### Update the webhook code

The webhook lives at `/opt/learn-webhook/webhook.py`, copied from the
repo. After a change to `deploy/webhook/webhook.py`:

```sh
sudo -u learndeploy git -C /opt/learn pull --ff-only
sudo install -o learndeploy -g learndeploy -m 0755 \
    /opt/learn/deploy/webhook/webhook.py /opt/learn-webhook/webhook.py
sudo systemctl restart learn-webhook
```

### Disable the service

```sh
sudo systemctl disable --now learn-webhook
```

The site keeps working (nginx still serves `/opt/learn`); only the
auto-pull stops.

---

## Troubleshooting

- **`bad signature` in journal.** GitHub secret and
  `GITHUB_WEBHOOK_SECRET` disagree. Copy-paste errors are the usual
  cause.
- **`pull FAILED: non-fast-forward`.** Someone committed directly on
  penforge, or the branch diverged. Investigate with
  `git -C /opt/learn status` and `git log HEAD..origin/main`. Do not
  `--hard reset` without reading first.
- **`permission denied (publickey)` on pull.** Deploy key missing or
  `known_hosts` not populated. Re-run step 2.
- **502 on `/webhook`.** Webhook not running. `systemctl status
  learn-webhook`; look at `journalctl`.
