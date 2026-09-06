# ADR-043 — StockWatch nav entry replaces Shopping (slot 5)

**Status:** Accepted, 2026-09-06. Supersedes [ADR-032](032-shopping-nav.md) for nav slot 5; ADR-032's infra notes stay as history.

## Context

The Shopping entry (ADR-032) probed `/shop/health`, served from a nginx container on the
operator's PC through a Cloudflare Tunnel. That container and tunnel have been down for months,
so the entry has shown "Shopping soon" indefinitely. Smart-Shopper's StockWatch (the PS5 restock
poller) now runs entirely on Cloudflare — a Worker at `stockwatch.chases.house` with no local
origin — and is the room worth surfacing. The operator's call: drop the Shopping surface for
now and use StockWatch in its place; a larger consolidation is likely later.

## Decision

Replace the `shop-nav` span with a `stockwatch-nav` span in the same slot, probed cross-origin
(Counting House pattern, ADR-035):

```js
enableNavWhenLive('stockwatch-nav', 'https://stockwatch.chases.house/health', 'StockWatch');
```

`/health` returns `200 ok` with `Access-Control-Allow-Origin: https://chases.house` and is exempt
from the Access gate by a "StockWatch Health Check" app (Bypass · Everyone); every other path on
that hostname sits behind the shared **Allowed Users** policy. Because the Worker has no local
dependency, the chip should be live whenever Cloudflare is.

## Files touched

- `index.html`, `games/index.html`, `files/index.html` — slot 5 span: `shop-nav`/Shopping → `stockwatch-nav`/StockWatch
- `nav-health.js` — the one `enableNavWhenLive` line
- No CSS changes; no slot renumbering (Files stays `--i:6`, Counting House `--i:7`)

## Infra (provisioned in the Smart-Shopper repo, not here)

Worker `stockwatch` with custom domain `stockwatch.chases.house` (`workers_dev` off); D1
`stockwatch`; Access apps "StockWatch" (`8c7897f3-…`, Allowed Users) and "StockWatch Health Check"
(`0a0e8531-…`, Public Health Check). Runbook: `Smart-Shopper/stockwatch-cf/README.md`; decision
record: Smart-Shopper ADR-0005.

Left in place for the later consolidation: the `/shop/*` route on the `chases-house-router`
Worker, the `shop-tunnel.chases.house` DNS record, and the "Shopping" / "Shopping Health Check"
Access apps. None of them is reachable from the nav any more.

## Local-dev note

From `localhost` the probe fails CORS by design (ACAO is pinned to `https://chases.house`), so
the span stays "soon" locally. Verify on the live origin.

## Rollback

Restore the `shop-nav` span and probe line from ADR-032; nothing else moved.
