# Known deviations found in Claude-generated pages

Paste this alongside `htmlStander.md` when asking Claude (or any LLM)
to write or audit a page.  It lists every violation discovered during
the first four pages and explains exactly what went wrong, why it
matters, and how to avoid repeating it.

---

## 1. Boot script rewritten instead of copied verbatim

**Pages affected:** SAML, DevSecOps (initial builds)

**What happened:**
Claude rewrote the boot script using different variable names
(`saved` / `sys` / `theme` instead of `stored` / `sysLight` /
`effective`) and sometimes reordered the logic.  The behavior was
*almost* identical but not byte-for-byte equal.

**Why it breaks things:**
Any divergence means future find-and-replace maintenance across pages
won't work.  Subtle logic order changes can also skip the
`data-theme` attribute or the class swap, causing FOUC on iOS.

**Prevention rule:**
> Copy the boot script from `htmlStander.md` character-for-character.
> Do not rename variables, reorder lines, or "improve" it.  Treat it
> as a frozen blob.

---

## 2. Hardcoded hex colors in page-specific CSS

**Pages affected:** WebSphere (`.cat-badge .dot { background: #5b8def }`)

**What happened:**
The category accent dot used a literal hex value instead of a CSS
variable + `filter: var(--accent-filter)`.

**Why it breaks things:**
The hex renders at full saturation in light mode — a neon blue dot on
a cream background.  `--accent-filter` desaturates/softens colored
elements for light mode; skipping it means the dot "glows."

**Prevention rule:**
> Never write a literal hex for any visible element except inside the
> boot script's two `bg` constants and the category-dot `background`
> declaration.  Every colored dot/bar/badge must also carry
> `filter: var(--accent-filter)`.

---

## 3. Interactive tap targets below 44px

**Pages affected:** All four (SAML: 36px, WebSphere: 38px, OAuth2: 38px, DevSecOps: 38px)

**What happened:**
Nav chips used `min-height: 36px` or `min-height: 38px` instead of
`var(--tap)` (44px).

**Why it breaks things:**
Apple HIG and WCAG 2.5.8 require 44px minimum for touch targets.
Smaller chips cause mis-taps on iPhone, especially in the horizontal
scroll strip where a wrong tap fires a section jump.

**Prevention rule:**
> Every clickable element — links, buttons, chips, toggles — must use
> `min-height: var(--tap)`.  Never hardcode a pixel value; always
> reference the token so a single update propagates everywhere.

---

## 4. Section nav not sticky / missing backdrop blur

**Pages affected:** SAML

**What happened:**
The `.page-toc` was a plain horizontally scrollable `<nav>` with no
`position: sticky`, no `top: env(safe-area-inset-top)`, no backdrop
blur, and no top/bottom borders.  It scrolled away with the page.

**Why it breaks things:**
Every other page has a sticky nav.  Without it, the user loses
one-tap section jumping as soon as they scroll past the header.  The
missing `top: env(safe-area-inset-top)` would also cause notch overlap
if it *were* sticky with `top: 0`.

**Prevention rule:**
> Every page with a section nav must wrap it in a `.navwrap` container
> with `position: sticky; top: env(safe-area-inset-top)` and the
> standard backdrop-blur + border treatment from the chip snippet in
> `htmlStander.md`.  A section nav that scrolls away is a standard
> violation, not "N/A."

---

## 5. Sharp-cornered chips instead of pills

**Pages affected:** WebSphere (initial build)

**What happened:**
The section-nav chips used a small `border-radius` (4–6px) producing
sharp rectangles, while all other pages used `border-radius: 999px`
(pills).

**Why it breaks things:**
Visual inconsistency across pages.  The standard explicitly requires
pill shape for all section-nav and filter chips.

**Prevention rule:**
> All section-nav/filter chips must use `border-radius: 999px`.
> Never use a fixed-pixel radius for chips.

---

## 6. Missing active-chip state with category accent

**Pages affected:** SAML (initial build)

**What happened:**
Chips had `:active` / `:focus-visible` states but no `.active` class
for IntersectionObserver-driven highlighting.  There was no JS to
track which section the user had scrolled to.

**Why it breaks things:**
Without the `.active` class + IntersectionObserver, the user can't
see which section they're currently reading.  The nav chips all look
identical while scrolling.

**Prevention rule:**
> Every sticky section nav must include:
> 1. A `.active` CSS class using `color-mix(in srgb, var(--accent) 14%, transparent)` background and `color-mix(in srgb, var(--accent) 40%, transparent)` border.
> 2. An IntersectionObserver script that adds/removes `.active` as sections enter/leave the viewport.
> 3. Auto-scroll of the nav strip to keep the active chip visible (`scrollIntoView({ inline: 'center', block: 'nearest' })`).

---

## 7. iPhone notch overlap on sticky elements

**Pages affected:** OAuth2, WebSphere (before fix)

**What happened:**
Sticky navs used `top: 0` which places the nav directly under the
iPhone status bar / Dynamic Island, overlapping the first row of chips.

**Why it breaks things:**
On iPhone 14+ with Dynamic Island or older notch models in landscape,
the chips sit behind the system UI and can't be tapped.

**Prevention rule:**
> Every `position: sticky` element that sticks to the top must use
> `top: env(safe-area-inset-top)` — never `top: 0`.

---

## How to use this document

When prompting Claude to write a new page, include both files:

```
Here are two documents:
1. htmlStander.md — the design standard (follow it exactly)
2. KNOWN-DEVIATIONS.md — mistakes Claude has made before on this
   project; do not repeat any of them

Write a page for: [topic]
```

When prompting Claude to audit existing pages, add:

```
Audit every page against htmlStander.md AND the known deviations
list.  A missing sticky nav is a violation, not "N/A."  Flag
every issue with the rule number it breaks.
```
