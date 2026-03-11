# ADR-012: Dynamic Music Nav Link with Health Check

**Status**: Accepted
**Date**: 2026-03-10

## Context

The site nav includes a "Music" tab linking to `dj.thewiseguy.ai`, a DJ web app served via a local Cloudflare Tunnel. The tunnel is usually offline — the app only runs when the user starts it locally. We want the Music tab to appear as "coming soon" when offline and upgrade to a live link when online.

## Constraints

- **GitHub Pages**: No server-side code available
- **Cloudflare Access**: Protects `dj.thewiseguy.ai` — all unauthenticated requests get a 302 redirect to the Access login page, regardless of tunnel state
- **CORS**: Cross-origin fetches from `chases.house` require explicit `Access-Control-Allow-Origin` headers from the target

### Approaches Rejected

1. **`fetch()` with `mode: 'no-cors'`** — Cloudflare always responds (Access login or Error 1033), so the fetch resolves in both states. Cannot distinguish online from offline.
2. **`redirect: 'manual'` with `mode: 'no-cors'`** — Both states produce the same Cloudflare Access 302 redirect. No signal difference.
3. **Image probe / resource loading** — Cloudflare Access intercepts all paths, so probes fail regardless of tunnel state.
4. **Always show as a static link** — Works but doesn't communicate availability to visitors.

## Decision

Use a **public health endpoint** on the DJ app with a Cloudflare Access bypass:

1. **DJ app** exposes `GET /health` returning `{"status":"ok"}` with `Access-Control-Allow-Origin: https://chases.house`
2. **Cloudflare Access** has a bypass policy for the `/health` path (app: "WebDJ Health Check", policy: "Public Health Check — Bypass — Everyone")
3. **chases.house** fetches `/health` with `mode: 'cors'` on page load:
   - 200 OK → replace "coming soon" span with a live `<a>` link
   - Network error or non-200 → keep "coming soon" (default state)
4. **4-second timeout** via `AbortController` prevents a hung connection from blocking the nav

### Default State

The Music tab renders as a disabled `<span class="coming-soon">` in HTML. JavaScript upgrades it to an `<a>` only on success. This means:
- No flash of incorrect state
- Works without JavaScript (stays "coming soon")
- Gracefully handles slow/failed health checks

### Activation Animation

When the tab upgrades, a `.music-live` CSS class applies a 600ms gold glow animation (`musicActivate` keyframe) that fades from muted → gold → primary text color. Respects `prefers-reduced-motion`.

## Files Changed

| File | Change |
|------|--------|
| `styles.css` | Added `.music-live` class and `@keyframes musicActivate` |
| `index.html` | Music span gets `id="music-nav"`, inline `<script>` before `</body>` |
| `games/index.html` | Same changes as `index.html` |

## Dependencies

- DJ app (`dj.thewiseguy.ai`) must serve `GET /health` with CORS header
- Cloudflare Access bypass policy must remain active for `/health`
- Health endpoint rate-limited to 360 req/min on DJ app side
