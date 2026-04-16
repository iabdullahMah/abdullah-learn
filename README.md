# abdullah-learn

A personal offensive-security notebook by Ag. Live at
[learn.iabdullah.xyz](https://learn.iabdullah.xyz). Built as a
mobile-first PWA — designed for iPhone Safari first, added to the home
screen and used like a native app.

This is a notebook, not a reference. Pages are opinionated, short, and
reflect one person's working memory.

---

## Structure

```
/
├── README.md                      this file
├── index.html                     React SPA (CDN, no build step)
├── manifest.json                  site content — categories + pages
├── manifest.webmanifest           PWA manifest
├── 404.html                       matching dark theme
├── assets/
│   ├── shared.css                 design tokens, base styles
│   ├── icon.svg                   source icon
│   ├── icon-180.png               apple-touch-icon
│   ├── icon-192.png               PWA icon
│   └── icon-512.png               PWA icon (maskable)
├── pages/
│   └── welcome.html               per-page standalone HTML
└── deploy/
    ├── README.md                  full runbook for penforge
    ├── nginx/
    ├── systemd/
    └── webhook/
```

---

## How a page gets here

1. **Question.** Ag asks Jarvis to explain something.
2. **Page built.** Jarvis writes an HTML file under `/pages/<slug>.html`
   and appends an entry to `manifest.json` in the same commit.
3. **Push to GitHub.**
4. **Penforge pulls.** Webhook verifies signature, runs
   `git pull --ff-only`.
5. **Index updates.** The React app fetches `manifest.json` with
   `cache: 'no-cache'` on each load.

No build step. No database. No CMS.

---

## `manifest.json` per-page schema

```json
{
  "slug": "welcome",
  "title": "How this site works",
  "description": "What abdullah-learn is, how pages get here, and how to read them.",
  "category": "tools",
  "tags": ["meta", "workflow"],
  "date": "2026-04-16",
  "interactive": false
}
```

- `slug` → the page lives at `/pages/<slug>.html`.
- `category` → one of the nine ids in `manifest.categories`.
- `tags` → free-form lowercase, indexed by search.
- `interactive: true` → renders a badge; signals the page has clickable
  diagrams.

Site-level fields: `title`, `tagline`, `owner`, `updated`.

---

## Local dev

```sh
python3 -m http.server 8080
```

Then open <http://localhost:8080/>. React, Babel, and fonts load from
CDNs, so you need internet on first run — after that the browser caches
them.

For iPhone parity, use Safari's Responsive Design Mode at 375 × 812 and
verify nothing horizontal-scrolls.

---

## Deployment

See [`deploy/README.md`](deploy/README.md) for the full runbook:
`learndeploy` user, GitHub deploy key, webhook service, nginx vhost,
certbot, GitHub webhook registration. Executed separately by the
operator on penforge.
