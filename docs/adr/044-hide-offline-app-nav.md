# ADR-044 — Hide a tunneled app's nav entry while it isn't running

**Status:** Accepted, 2026-10-15. Amends [ADR-012](012-music-nav-health-check.md) and [ADR-024](024-lookout-nav-and-shared-health-helper.md): a down app's placeholder is now hidden instead of showing "soon".

## Context

The nav carries a placeholder `<span class="nav-link coming-soon">` for each Cloudflare-hosted app (Music, Lookout, StockWatch, Counting House). `nav-health.js` swaps it for a live link when the app's `/health` returns 200. When the app is down, the span stays and reads "<App> soon". On 2026-10-15, Music, Lookout and Counting House answered `/health` with 530; only StockWatch answered 200. The game sub-pages (chess, checkers, snake, jeopardy and others) carry a Music span with no `id` that nothing ever probes, so it reads "soon" permanently. The operator's call: an app that isn't running shouldn't appear in the nav at all.

## Decision

Hide every `.nav-link.coming-soon` with CSS (`display: none`) from first paint. `nav-health.js` is unchanged in behaviour: on a 200 it replaces the hidden span with a visible `<a class="nav-link nav-link-live">`, so a running app appears and a stopped one never shows. There is no flicker, because the hiding needs no script.

**Files** is not affected. Its nav link is a static page on chases.house that works without its tunnel; only the encrypted-blob server behind it is tunneled.

**The Files page keeps no probe script** (ADR-024's posture). Its CSP `connect-src 'self'` blocks the cross-origin probes, and the page promises it contacts nothing. Its app placeholders therefore stay hidden there even while an app is up; the other pages show them.

## Files touched

- `styles.css` — the "Coming soon nav state" rules and `.coming-soon-tag` replaced by `.nav-link.coming-soon { display: none; }`
- `nav-health.js` — comments only

The `<span class="coming-soon-tag">soon</span>` markup inside each placeholder is left in place; it is never displayed.

## Rollback

Restore the removed `styles.css` rules from git (`git show <this commit>^:styles.css`). No markup or script change needs reverting.
