# ADR-035 — Counting House nav entry (countinghouse.chases.house)

Date: 2026-07-11 · Status: accepted

## Context

Counting House is a deterministic stock-research dashboard — a room of the
house with its own private repo (`c-house/Finance_AI`). It is served from this
box behind a dedicated Cloudflare Tunnel (`counting-house`,
`a424a50c-a901-4080-95c0-9c50813dd831`) at `countinghouse.chases.house`,
**members-only** behind Cloudflare Access using the same reusable
"Allowed Users" policy as WebDJ/Lookout/Files. The homepage needs a nav entry
that lights up only while the tunnel + origin are actually up.

## Decision

Standard not-yet-always-on pattern (ADR-024): a `coming-soon` span upgraded by
the shared `enableNavWhenLive` probe.

- Probe style: **cross-origin subdomain** (Music pattern, ADR-012), not
  Worker-routed path. `https://countinghouse.chases.house/health` returns
  `200 ok` with `Access-Control-Allow-Origin: https://chases.house`, and a
  Zero Trust app "Counting House Health Check" (policy: shared
  "Public Health Check" — Bypass — Everyone) exempts exactly that path from
  the Access gate.
- Like the Music entry, the link activates for **everyone** when the service
  is up; non-approved visitors then meet the Access login. Availability
  signaling and authorization stay separate concerns.

## Counting House nav span — slot 7

```html
<span id="countinghouse-nav" class="nav-link coming-soon" style="--i:7">Counting House<span class="coming-soon-tag">soon</span></span>
```

## Files touched

- `index.html` — the span above, after Files (`--i:6`)
- `nav-health.js` — one `enableNavWhenLive('countinghouse-nav', 'https://countinghouse.chases.house/health', 'Counting House')` registration
- No new CSS (`.nav-link-live` and `navActivate` are shared, ADR-024)

## Infra (Cloudflare, provisioned separately — lives with the Counting House repo)

Proxied CNAME `countinghouse` → `<tunnel-UUID>.cfargotunnel.com`; origin
`scripts/serve_site.py` on `127.0.0.1:3005`; Access apps "Counting House"
(Allowed Users) + "Counting House Health Check" (Bypass). Runbook:
`Finance_AI/docs/deploy.md`. The zone-wide `X-Robots-Tag: noindex` Transform
Rule (ADR-033) covers the subdomain since it is proxied.

## Local-dev note

From `localhost` the probe fails CORS by design (ACAO is pinned to
`https://chases.house`), so the span stays "soon" locally — same behavior as
the Music probe. Verify activation on the live origin.

## Rollback

Remove the span and the `enableNavWhenLive` line; delete the two Access apps
and the CNAME if the room is retired. Once the service is deemed always-on,
simplify to a plain anchor (ADR-024 pattern 1) in a follow-up commit.
