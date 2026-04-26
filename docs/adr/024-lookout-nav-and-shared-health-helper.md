# ADR-024 — Lookout nav entry + shared `enableNavWhenLive` helper

**Status:** Accepted, 2026-04-26.

## Context

ADR-012 established the Music tab pattern: a `<span id="music-nav" class="nav-link coming-soon">` on every top-level page, upgraded to a live `<a>` link when `https://dj.thewiseguy.ai/health` returns 200.

A second tunneled subsite — **The Lookout**, a private Tampa Bay civic-data + camera viewer — needs the same treatment. Following ADR-012's pattern verbatim would mean copy-pasting a near-identical IIFE into every page that carries the new `lookout-nav` span. The original Music IIFE was already duplicated across `index.html`, `games/index.html`, and `games/solitaire/index.html` (~20 lines × 3 places).

The first ADR-002 in The Lookout repo's path-based-routing decision means the Lookout's health endpoint is **same-origin** (`/the-lookout/health`), unlike Music's cross-origin `dj.thewiseguy.ai/health`. The two probes differ only in URL, ID, and label.

## Decision

Extract one shared helper at `/nav-health.js`, called once per nav entry.

```js
function enableNavWhenLive(id, healthUrl, label) {
  var el = document.getElementById(id);
  if (!el) return;
  var ctrl = new AbortController();
  setTimeout(function () { ctrl.abort(); }, 4000);
  fetch(healthUrl, { signal: ctrl.signal, mode: 'cors' })
    .then(function (r) {
      if (!r.ok) return;
      var a = document.createElement('a');
      a.href = healthUrl.replace(/\/health$/, '');
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'nav-link nav-link-live';
      a.style.cssText = el.style.cssText;
      a.textContent = label;
      el.replaceWith(a);
    })
    .catch(function () { /* tunnel down — keep "soon" placeholder */ });
}
enableNavWhenLive('music-nav',   'https://dj.thewiseguy.ai/health', 'Music');
enableNavWhenLive('lookout-nav', '/the-lookout/health',             'Lookout');
```

Pages that probe load it via `<script src="/nav-health.js" defer></script>`. Pages without `music-nav` or `lookout-nav` spans no-op silently — same `if (!el) return` guard as before.

## CSS — one shared activation class

Replaces:

```css
.nav-link.music-live { ... animation: musicActivate ... }
@keyframes musicActivate { ... }
```

With:

```css
.nav-link.nav-link-live { ... animation: navActivate ... }
@keyframes navActivate { ... }
```

Animation timing and colors are unchanged. Both Music and Lookout get the same gold-glow activation.

## Lookout nav span

Slot 4 in the nav. Slot ordering (post-update):

| `--i` | Page    |
|-------|---------|
| 0     | Home    |
| 1     | Games   |
| 2     | Cookbook|
| 3     | Music   |
| 4     | Lookout (new) |
| 5     | Files   |

The 5 game/files pages already had Files at `--i:5` with slot 4 reserved. Only `index.html` needed Files bumped from 4 → 5.

## Files touched

| File | Change |
|------|--------|
| `nav-health.js` | New — the shared helper. |
| `styles.css` | `.music-live` → `.nav-link-live`; `@keyframes musicActivate` → `navActivate`. |
| `index.html` | Add Lookout span; bump Files to `--i:5`; replace inline IIFE with `<script src="/nav-health.js" defer>`. |
| `games/index.html` | Add Lookout span; replace inline IIFE with shared script. |
| `games/solitaire/index.html` | Add Lookout span; replace inline IIFE with shared script. |
| `files/index.html` | Add Lookout span only. (No probe script — same posture as Music: file shows "soon" permanently because the page's CSP `connect-src` blocks fetches per ADR-013.) |
| `games/asteroids/index.html` | Add Lookout span only. (No existing probe script; matches existing pattern.) |
| `games/uno/index.html` | Add Lookout span only. (Same.) |

## Why same-origin for Lookout but cross-origin for Music?

Music lives at `dj.thewiseguy.ai` — a separate domain. ADR-012 set up Cloudflare Access bypass + CORS headers for the cross-origin probe.

Lookout lives at `chases.house/the-lookout/*` — same origin as the chases.house pages making the probe. No CORS headers needed. The same `mode: 'cors'` flag is left in the helper for the Music probe; for same-origin requests it's a harmless no-op. See The Lookout repo's ADR-002 for the path-based architecture.

## Rollback

If `nav-health.js` breaks any page:

1. Inline the IIFE back into the affected page (3-line snippet).
2. Or just remove the `<script src="/nav-health.js" defer>` tag. The `<span id="lookout-nav">` will display "Lookout soon" indefinitely, which is the desired fallback anyway.

## Future nav entries

Add a new `<span id="X-nav" class="nav-link coming-soon" ...>` to the relevant pages, then add **one line** to `nav-health.js`:

```js
enableNavWhenLive('X-nav', '<healthUrl>', '<Label>');
```

No new CSS class needed — `.nav-link-live` is shared across all activations.
