# ADR-032 — Shopping nav entry (Smart-Shopper)

**Status:** Accepted, 2026-05-30.

## Context

Smart-Shopper (private repo) generates a daily car-search report and emails an email-safe digest whose body links to a full, rich web report. That report is now hosted from Smart-Shopper as an always-on nginx container behind a Cloudflare Tunnel, surfaced at `chases.house/shop`. It needs a nav entry on chases.house — same need Lookout had (ADR-024).

Smart-Shopper's surface is **same-origin path-based** (`chases.house/shop/*`), exactly like Lookout (`/the-lookout/*`), not a cross-origin subdomain like Music. So it reuses the `enableNavWhenLive` helper verbatim — one new line, no CORS.

## Decision

Add a `shop-nav` coming-soon span and one `enableNavWhenLive` call probing the same-origin `/shop/health`:

```js
enableNavWhenLive('shop-nav', '/shop/health', 'Shopping');
```

The span upgrades to a live `<a href="/shop">` when the probe returns 200; otherwise it stays "Shopping soon". `/shop/health` is public (Cloudflare Access bypass), mirroring the WebDJ/Lookout health posture. The Smart-Shopper nginx answers `/shop/health` (and bare `/health`) so the probe works regardless of whether the `chases-house-router` Worker strips the `/shop` prefix.

## Shopping nav span — slot 5

| `--i` | Page |
|-------|------|
| 0 | Home |
| 1 | Games |
| 2 | Cookbook |
| 3 | Music |
| 4 | Lookout |
| 5 | Shopping (new) |
| 6 | Files |

Shopping is grouped with the other coming-soon entries (Music, Lookout); Files moves from `--i:5` → `--i:6`.

## Files touched

| File | Change |
|------|--------|
| `nav-health.js` | Add the `shop-nav` probe line (after `lookout-nav`). |
| `index.html` | Add Shopping span at `--i:5`; bump Files to `--i:6`. |
| `games/index.html` | Same. |
| `files/index.html` | Same (Files is the active span). |

Pages without a `shop-nav` span no-op silently (`if (!el) return`). No new CSS — `.nav-link-live` is shared (ADR-024).

## Infra (Cloudflare, provisioned separately)

- A `smart-shopper` Cloudflare Tunnel → the nginx container (`localhost:3003`).
- A `/shop/*` route on the `chases-house-router` Worker → that tunnel (mirrors `/the-lookout/*`).
- A Cloudflare Access app for `chases.house/shop/*` + a `chases.house/shop/health` **Bypass=Everyone** policy (mirrors WebDJ's "Health Check" app).

## Rollback

Remove the `shop-nav` span / the `enableNavWhenLive('shop-nav', …)` line. With the span present but the tunnel down, it simply shows "Shopping soon" indefinitely — the intended fallback.
