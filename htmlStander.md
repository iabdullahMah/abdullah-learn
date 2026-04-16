# abdullah-learn — page design standard

Paste this into a chat with any LLM that writes a new page for the site.
Following it end to end is what makes a page support both dark and light
themes (including the user's manual toggle) and survive cross-page
navigation without re-flashing.

---

You are writing a new HTML page for **abdullah-learn**, a mobile-first
PWA at `learn.iabdullah.xyz`. It is Ag's offensive-security notebook,
written by Jarvis. Every page is a self-contained `.html` file under
`/pages/` that inherits design tokens from `/assets/shared.css`. iPhone
Safari is the primary target; the page must support both dark and light
themes and survive the user's manual toggle.

## Hard rules — break any of these and the page will look wrong

1. **No hardcoded colors.** Use the CSS variables listed below. Never
   write `#000`, `#fff`, `#0a0a0c`, `#f7f5ef`, `rgba(10,10,12,…)`,
   `rgba(255,255,255,…)`, or any other literal color for backgrounds,
   text, or borders. If you need translucency, use
   `color-mix(in srgb, var(--bg) 88%, transparent)`.
2. **Include the theme boot script verbatim** in `<head>` BEFORE
   `<link rel="stylesheet">`. Without it the user's saved theme won't
   apply and the page flashes on load.
3. **Cache-bust the stylesheet** with `?v=4`:
   `/assets/shared.css?v=4`.
4. **Mobile first.** Min interactive size 44px (`var(--tap)`). Use
   `100dvh`, never `100vh`. Use `env(safe-area-inset-*)`.
5. **One `<meta name="theme-color" id="theme-color-meta" …>` only**,
   with that exact id — the boot script keeps it in sync.
6. After writing the page, **add an entry to `/manifest.json`** (schema
   at the bottom).

## Required `<head>` boilerplate (copy verbatim, fill in `<…>`)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="learn" />
  <meta name="theme-color" id="theme-color-meta" content="#0a0a0c" />
  <meta name="description" content="<one-line description>" />

  <script>
    (function () {
      try {
        var stored = localStorage.getItem('theme');
        var sysLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
        var effective = stored || (sysLight ? 'light' : 'dark');
        var bg = effective === 'light' ? '#f7f5ef' : '#0a0a0c';
        var root = document.documentElement;
        if (stored === 'dark' || stored === 'light') {
          root.setAttribute('data-theme', stored);
        }
        root.classList.remove(effective === 'light' ? 'theme-dark'  : 'theme-light');
        root.classList.add(   effective === 'light' ? 'theme-light' : 'theme-dark');
        root.style.backgroundColor = bg;
        var meta = document.getElementById('theme-color-meta');
        if (meta) meta.setAttribute('content', bg);
      } catch (e) {}
    })();
  </script>

  <title><Page title> — abdullah-learn</title>

  <link rel="apple-touch-icon" href="/assets/icon-180.png" />
  <link rel="icon" type="image/svg+xml" href="/assets/icon.svg" />
  <link rel="manifest" href="/manifest.webmanifest" />
  <link rel="stylesheet" href="/assets/shared.css?v=4" />

  <style>
    /* page-specific CSS — must use var(--*) tokens only */
  </style>
</head>
```

## Design tokens (from shared.css — already loaded; don't redefine)

**Backgrounds:** `var(--bg)`, `var(--bg-raised)`, `var(--bg-card)`,
`var(--bg-card-hover)`

**Text:** `var(--fg)`, `var(--fg-muted)`, `var(--fg-subtle)`

**Borders:** `var(--border)`, `var(--border-strong)`

**Fonts:** `var(--font-display)` (Instrument Serif — titles, italics),
`var(--font-body)` (Geist — body), `var(--font-mono)` (IBM Plex Mono —
meta, code, dates, badges)

**Sizing:** `var(--tap)` = 44px, `var(--radius)` = 10px,
`var(--radius-sm)` = 6px

**Accent finish:** `filter: var(--accent-filter)` — apply to every
colored dot/bar/badge so accent colors desaturate properly in light
mode. Forget this and your category dots glow neon on cream.

## Page body skeleton

```html
<body>
  <article class="page">
    <a class="back" href="/">← back to index</a>

    <div class="meta-row">
      <span class="cat-badge"><span class="dot" aria-hidden="true"></span><category name></span>
      <span class="date">YYYY-MM-DD</span>
    </div>

    <h1 class="title">Page <em>title</em>.</h1>
    <p class="lead">One-paragraph hook.</p>

    <h2>Section</h2>
    <p>Body paragraph.</p>

    <!-- optional: callouts, code, ordered lists with numbered steps -->

    <a class="back" href="/">← back to index</a>
  </article>
</body>
```

## Reference page CSS (paste, edit only the marked spots)

```css
.page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 24px 20px 64px;
}
@media (min-width: 768px) { .page { padding: 40px 32px 80px; } }

.back {
  display: inline-flex; align-items: center;
  min-height: var(--tap);
  font-family: var(--font-mono); font-size: 12px;
  color: var(--fg-muted); letter-spacing: 0.03em;
}

.meta-row { display: flex; align-items: center; gap: 10px; margin: 20px 0 14px; }

.cat-badge {
  display: inline-flex; align-items: center; gap: 8px;
  height: 24px; padding: 0 10px;
  border: 1px solid var(--border-strong); border-radius: 999px;
  font-family: var(--font-mono); font-size: 11px;
  color: var(--fg); letter-spacing: 0.04em; text-transform: lowercase;
}
.cat-badge .dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: <category accent hex>;       /* from table below */
  filter: var(--accent-filter);            /* REQUIRED for light mode */
}

.date { font-family: var(--font-mono); font-size: 11px; color: var(--fg-subtle); letter-spacing: 0.04em; }

h1.title {
  font-family: var(--font-display); font-weight: 400;
  font-size: clamp(36px, 9vw, 64px); line-height: 1.05; letter-spacing: -0.01em;
  margin: 6px 0 22px; color: var(--fg);
}
h1.title em { font-style: italic; }

p.lead { font-size: 17px; color: var(--fg); margin: 0 0 22px; }

h2 {
  font-family: var(--font-display); font-weight: 400;
  font-size: clamp(22px, 5vw, 30px); letter-spacing: -0.005em;
  color: var(--fg); margin: 36px 0 10px;
}

p { color: var(--fg-muted); font-size: 16px; line-height: 1.65; margin: 0 0 14px; }

code {
  font-family: var(--font-mono); font-size: 13px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: 4px; padding: 1px 6px; color: var(--fg);
}

.callout {
  margin: 32px 0; padding: 18px 20px;
  border: 1px solid var(--border);
  border-left: 2px solid <category accent hex>;
  border-radius: var(--radius-sm);
  background: var(--bg-raised);
  color: var(--fg-muted); font-size: 15px; line-height: 1.6;
}
/* Soften accent border in light mode (REQUIRED if you use a callout). */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) .callout { border-left-color: <muted accent hex>; }
}
:root[data-theme="light"] .callout { border-left-color: <muted accent hex>; }
.callout strong {
  font-family: var(--font-display); font-style: italic; font-weight: 400;
  color: var(--fg); font-size: 18px;
}
```

## How to add light-mode-specific overrides

For any component where the look needs a tweak in light mode (a softer
accent border, a different shadow, etc.) you must use BOTH selectors:

```css
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) .your-thing { /* light-mode tweak */ }
}
:root[data-theme="light"] .your-thing { /* same tweak — for manual toggle */ }
```

Do **not** use just one. The MQ covers system-light when there's no
manual choice; the attribute selector covers manual toggle. Both must
exist or the manual toggle won't take effect.

## Categories and accent colors

Use the `id` in `manifest.json`, the hex in CSS.

| id | name | accent (hex) |
|---|---|---|
| web | Web Exploitation | #ff4d5e |
| api | API Security | #22d3ee |
| auth | Auth & Sessions | #f5b544 |
| mobile | Mobile Security | #a78bfa |
| review | Source Code Review | #2dd4bf |
| enterprise | Enterprise Architectures | #5b8def |
| tools | Tools & Tradecraft | #84cc16 |
| hardware | Hardware & IoT | #f97316 |
| devsecops | DevSecOps | #ec4899 |

## If the page is interactive (diagrams, toggles, etc.)

Add React 18 + Babel Standalone in `<body>` (no build step):

```html
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script type="text/babel" data-presets="react"> /* component code */ </script>
```

Set `"interactive": true` in the manifest entry. The interactive UI
must still use only the design tokens — no hardcoded colors inside
React components, no inline `style={{ background: '#fff' }}`. SVG
diagrams: stroke/fill via `currentColor` or via the accent vars; never
literal hex.

## Shared enhancements (copy buttons, TOC, tags, Prism, SW)

Every page gets a free upgrade by adding this block just before
`</body>`. One file, one include — you don't wire anything per-page.

```html
<script src="https://unpkg.com/prismjs@1.29.0/components/prism-core.min.js"></script>
<script src="https://unpkg.com/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>
<script src="/assets/enhance.js?v=1"></script>
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }
</script>
```

What `enhance.js` auto-wires:

- **Copy buttons** on every `<pre>` (inside `article.page`, `.prose`,
  or `main`). No per-page HTML needed.
- **Auto TOC** — add `<nav class="toc"></nav>` anywhere in the article.
  Built from `<h2>`/`<h3>` inside `article.page`. On desktop you can
  add the `toc--sticky` class for a sticky sidebar.
- **Clickable tags** — add a `<div class="tags">` with
  `<a class="tag" data-tag="foo">foo</a>` entries. Each links to
  `/?tag=foo` and pre-filters the index.
- **Prism highlighting** — any `<code class="language-bash">` (or any
  other language) inside a `<pre>` gets highlighted on load. The theme
  derives from your page's `--accent` token, so code matches the
  category color automatically.

The **service worker** (`/sw.js`) caches the shell + visited pages so
the site works offline after the first visit. Bump `CACHE_VERSION` in
`/sw.js` when shipping breaking changes.

## Update `/manifest.json` after writing the page

Add an entry to the `"pages"` array:

```json
{
  "slug": "<filename-without-.html>",
  "title": "<Page Title>",
  "description": "<one-line>",
  "category": "<id from table>",
  "tags": ["..."],
  "date": "YYYY-MM-DD",
  "interactive": false
}
```

Then commit on `main` and push.

## Pre-flight checklist before you commit

- [ ] No literal hex/rgba color anywhere except the boot-script `bg`
      constants and the category accent dot/bar.
- [ ] Theme boot script present in `<head>` and unmodified.
- [ ] `<meta name="theme-color" id="theme-color-meta" …>` present,
      only one.
- [ ] Stylesheet linked as `/assets/shared.css?v=4`.
- [ ] Every colored dot/bar has `filter: var(--accent-filter)`.
- [ ] Every light-mode override has both the
      `@media (prefers-color-scheme: light) :root:not([data-theme="dark"])`
      form AND the `:root[data-theme="light"]` form.
- [ ] No `100vh`. No `position: fixed` that ignores
      `env(safe-area-inset-*)`.
- [ ] All interactive elements ≥ 44px.
- [ ] `manifest.json` updated and JSON-validates.
- [ ] Shared enhance.js + SW registration block included before `</body>`.
- [ ] If the page has `<pre>` code blocks, `<code>` inside has a
      `language-*` class so Prism can highlight.
