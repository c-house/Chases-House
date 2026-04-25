# ADR-022: Cleaner Home Page (Forest Backdrop)

**Status**: Accepted
**Date**: 2026-04-25

## Summary

Replace the room-card landing page with a single full-bleed forest-cabin photograph and a quiet "Chase's House" title anchored bottom-left. The site nav stays at the top; the room cards (Games, Cookbook) are removed. Designed and chosen via Claude Design exploration of four directions (Pure Hero, Lit Window, Nameplate, Sidebar Rail) — Variation A (Pure Hero) won.

## Decisions

- **Visual direction**: full-viewport forest-cabin photograph as a fixed backdrop. Title sits in the lower-left where the forest is densest — away from the cabin's lit window so the type doesn't compete with the focal point of the image. Toned-gold accent on "House" (`#d9a458`) instead of the brighter site `--accent-gold` for the same reason.
- **Room cards removed**: the home page is now pure landing — Games and Cookbook are reachable via the top nav, which already lists every section. Eliminates the awkward "Home / Games / Cookbook tabs at the top *and* duplicated as cards in the middle" duplication that prompted the redesign.
- **Nav slimmed site-wide**: every page's nav is now **Home · Games · Cookbook · Music · Files** — five items (or four where the page predates Cookbook). Blog and Links are removed (per the design session, they were `coming-soon` filler with no implementation behind them). Music stays because its `coming-soon` tag is dynamic — the inline live-check script promotes it to a real link to `dj.thewiseguy.ai` when the Cloudflare Tunnel is up, so it represents a live feature rather than filler. Cleanup applied across all 19 HTML pages that carried the nav: home page in commit `e48fc0c`, the 14 already-tracked interior pages in commit `6c82355`, and the 5 still-untracked WIP game pages (`asteroids`, `fishing-game`, `hearthguard`, `solitaire`, `uno`) cleaned in working tree so the slimmed nav lands automatically when those games get their first commits. The animation-stagger `--i:N` indices on remaining items are left as-is (gaps in the sequence don't matter because the only consumer is `calc(700ms + var(--i, 0) * 80ms)` for fade-in delay).
- **Background image strategy**: two source files, swapped by aspect ratio.
  - `/assets/forest-house-landscape.png` — default, used on landscape and square viewports.
  - `/assets/forest-house-portrait.png` — swapped in via `@media (max-aspect-ratio: 1/1)` for tall/narrow viewports (mobile portrait).
  - Both layers are `position: fixed; inset: 0` so the backdrop holds while the page scrolls.
- **Legibility layer**: a single `.forest-vignette` `position: fixed` element above the image but below content, combining a diagonal darken (top-right → bottom-left, anchoring the title corner) and a soft radial edge vignette. No noise/grain layer here — the photograph already carries texture, and the site-wide `body::before / ::after` ambient gradients are explicitly disabled on `body.home` so they don't muddy the image.
- **Animation**: `forestFadeIn` (1400ms scale-in on the backdrop), staggered `fadeSlideUp` on title / tagline / nav (reusing the existing `styles.css` keyframe), and a 6s `warmGlow` text-shadow loop on the gold "House" accent that reads as a slow lantern flicker.
- **Image source of truth**: the `assets/` folder at repo root. `assets/` holds site-wide static media; `files/` is the encrypted file vault page (a feature route, not a media folder); `cookbook/images/` is the per-feature precedent for section-scoped images.
- **CSS scoping**: all new styles live inline in `index.html` under the `body.home` class. `/styles.css` is untouched. The site-wide ambient `body::before / ::after` overlays are suppressed only when `body.home` is set, so every other page keeps the existing chrome.

## Implementation

Shipped in three commits:

**`255f2a1` — Cleaner home page with forest-cabin backdrop**

- [index.html](../../index.html) — rewritten as the Pure Hero layout. Inline CSS for backdrop, vignette, hero positioning, animations, and responsive behavior. Music live-check script preserved verbatim.
- [assets/forest-house-landscape.png](../../assets/forest-house-landscape.png) — landscape backdrop (sourced from the user's tuned `house-bg-horizontal.png`).
- [assets/forest-house-portrait.png](../../assets/forest-house-portrait.png) — portrait backdrop (sourced from the user's tuned `house-bg-vertical.png`).

**`e48fc0c` — Drop Blog and Links from home-page nav**

- [index.html](../../index.html) — removed the two `coming-soon` `nav-link` items for Blog and Links. Five-item nav remains.

**`6c82355` — Drop Blog and Links nav items site-wide**

Removed the same two `nav-link coming-soon` items from every already-tracked page that carries the site nav:

- [files/index.html](../../files/index.html)
- [games/index.html](../../games/index.html)
- [games/checkers/index.html](../../games/checkers/index.html), [games/chess/index.html](../../games/chess/index.html), [games/connect-four/index.html](../../games/connect-four/index.html), [games/crossword/index.html](../../games/crossword/index.html), [games/snake/index.html](../../games/snake/index.html), [games/sudoku/index.html](../../games/sudoku/index.html), [games/tic-tac-toe/index.html](../../games/tic-tac-toe/index.html), [games/pacman/index.html](../../games/pacman/index.html)
- [games/jeopardy/index.html](../../games/jeopardy/index.html), [games/jeopardy/builder.html](../../games/jeopardy/builder.html), [games/jeopardy/host.html](../../games/jeopardy/host.html), [games/jeopardy/play.html](../../games/jeopardy/play.html)

The 5 untracked WIP game pages (`games/asteroids/index.html`, `games/fishing-game/index.html`, `games/hearthguard/index.html`, `games/solitaire/index.html`, `games/uno/index.html`) had the same two lines stripped in working tree by the same `sed` pass — they remain untracked, so the cleanup will land with their respective first commits rather than in this ADR's commits.

## Out of scope

- Renumbering the `--i:N` animation-stagger indices to close the gaps left by the removed Blog and Links items — gaps don't affect layout, only the fade-in delay timing of subsequent items.
- Stripping the `coming-soon` Music tag — Music has a real backing feature (the live-check upgrade to `dj.thewiseguy.ai`), so its `soon` is conditional, not filler.
- Porting the same forest backdrop to interior pages — interior pages keep the existing dark chrome.
- A pure-CSS / SVG illustrated fallback if the PNG fails to load — the photograph is the design, no fallback needed for a static personal site.

## Provenance

Design explored in Claude Design (`claude.ai/design`) bundle `mXNE6acjnkNuf6Zrd9qxow`. Four variations on a 1280×800 canvas, user picked Variation A (Pure Hero) with the forest backdrop, then iterated on title placement (lower-left), gold tone, type size (5rem → 4.6rem), and single-line wrap.
