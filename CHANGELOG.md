# Changelog

All notable changes to [chases.house](https://chases.house) are documented here.

## 2026-05-31 — Crawler control: repo robots.txt + Cloudflare hardening (PARTIAL)

- Add a version-controlled `robots.txt` at the repo root. Deliberately *thin* — no `User-agent: *` group (Cloudflare's managed robots.txt prepends one and its auto-updating AI-crawler block above this file) and no path `Disallow`s. Its only directive is an explicit allow for `Claude-User`, the operator's user-initiated Claude fetches (verified UA `Claude-User (claude-code/…)`), so they're never caught alongside the `ClaudeBot` training crawler. Verified live: the repo group merges below the managed block
- **WAF "Block AI Bots" turned OFF** (curl-verified): it had been enabled but returned HTTP 403 to the operator's own `Claude-User` tools (and GPTBot); Cloudflare's free path gave no reliable per-UA skip, so it was disabled. All UAs now return 200. robots.txt disallows remain the declared AI policy (reputable crawlers honor them)
- Audit finding that prompted this: a `robots.txt` already served live, generated entirely by Cloudflare managed-robots, but it set `Content-Signal: search=yes` (inviting indexing) and lived nowhere in git
- `chases.house/robots.txt` is served dynamically by managed-robots (`Cf-Cache-Status: DYNAMIC`, not cacheable); no purge applies
- **STILL TODO** (the actual search-suppression layer; tracked in ADR-033's addendum): create the zone-wide `X-Robots-Tag: noindex` Transform Rule (the authoritative deindex; GitHub Pages can't emit headers) — **not yet created, so the site is NOT deindexed yet**; and flip the managed Content-Signal to `search=no` (still `search=yes`). Both stalled on unreliable MCP automation of a shared browser
- Add ADR-033 (with an honest PARTIAL as-built addendum)

## 2026-05-30 — Music nav points at thewiseguy.ai apex

- Switch the Music nav health-probe in `nav-health.js` from `dj.thewiseguy.ai/health` to the apex `thewiseguy.ai/health` (WebDJ rebrand to canonical apex). The existing `healthUrl.replace(/\/health$/,'')` auto-derives the live link href, so the upgraded Music link now points at `https://thewiseguy.ai`
- Apex chosen over the new `dj.chases.house` family alias deliberately: the WebDJ Cloudflare Access "Health Check" bypass is scoped to `thewiseguy.ai/health` only, so any other target would 302 to Access login and CORS-fail the probe
- Document `nav-health.js` (shared `enableNavWhenLive` helper), the off-repo tunneled subsites, ADR-024, and the Cloudflare edge-cache purge-after-deploy gotcha in `CLAUDE.md`

## 2026-04-25 — Cleaner home page (forest backdrop)

- Replace the room-card landing with a full-bleed forest-cabin photograph and a quiet "Chase's House" title in the lower-left
- Drop the Games / Cookbook room cards — both reachable from the existing top nav, ending the duplication that prompted the redesign
- Slim the nav site-wide to Home · Games · Cookbook · Music · Files; drop Blog and Links (no implementation behind them) from every live page that carries the nav (home + 14 interior); Music stays because its live-check script promotes it to a real link when the stream is up
- Add `assets/forest-house-landscape.png` and `assets/forest-house-portrait.png`; CSS swaps to portrait via `@media (max-aspect-ratio: 1/1)` for tall/narrow viewports
- Toned-gold accent (`#d9a458`) on "House" and a weighted vignette so the title doesn't compete with the cabin's lit window
- All new styles inline under `body.home`; `styles.css` untouched and other pages keep existing chrome
- Designed via Claude Design exploration (4 variations, Variation A "Pure Hero" picked); ADR-022

## 2026-04-23 — Cookbook recipes (Appetizers, Sauces, Blueberry Ice Cream)

- Add three recipes transcribed from `.docx.md` source files: Fried Artichoke Hearts with Garlic Aioli (Tasty Kitchen), Yum Yum Sauce (Jason's BBQ Adventures), Blueberry Ice Cream with Optional Crisp (Riverside Len / Food.com)
- Introduce `Appetizers` and `Sauces` categories — `cookbook/directions/rustic.jsx` tab strip and `cookbook/lib/recipe-lib.js` `groupByCategory` order updated so new recipes get their own tab instead of landing in `Other`
- Decode embedded base64 recipe photos into `cookbook/images/<recipe-id>/image1.png`, matching the convention `keller-chicken` and `pot-roast` already use
- Update ADR-015 with an addendum covering the expansion and category-list change

## 2026-04-23 — Cookbook

- Add Family Cookbook at `/cookbook/` — seven family recipes with live serving-size scaling, ingredient-tag filters, full-text search, favorites, personal notes, and cook mode
- React 18 + Babel-standalone via CDN (no build step), rustic paper-and-ink aesthetic scoped under `.rustic` class so nothing leaks to the dark chases.house chrome
- `cookbook/data/recipes.js` stores recipes as normalized per-serving amounts; `{i:N}` tokens in step text render the scaled ingredient inline when displayed
- `cookbook/lib/recipe-lib.js` handles amount formatting (unicode fractions), scaling, search, tag filtering, and a `useLocalState` hook
- Cook mode requests a screen wake-lock so the phone stays bright on the counter
- Favorites, notes, checked ingredients, and checked steps persist under `rustic:*` localStorage keys
- Add Cookbook link to the header nav on Home / Games / Files (re-indexed the fade-in stagger for the now-seven-item nav)
- Add Cookbook room card on the homepage; made `.rooms` flex-wrap so multiple cards sit side-by-side
- Served path-based (no DNS changes) — rationale captured in ADR-015
- Add ADR-015

## 2026-04-23 — Pac-Man

- Add Pac-Man game with four modes: Solo vs AI, Pac vs Ghosts, Co-op, Battle Royale (up to 4 players on one PC)
- Classic 28×31 arcade maze with authentic Blinky / Pinky / Inky / Clyde targeting and scatter → chase → frightened mode cycling
- Split-keyboard (WASD / Arrows / IJKL / Numpad) and Gamepad API support for Xbox, PlayStation, 8BitDo, and Switch Pro controllers
- Pre-game bind screen claims an input scheme per player; pause (P) / mute (M) hotkeys with mute persisted in localStorage
- Replace buzzing Web Audio synthesis with CC0 retro samples from Juhani Junkala's pack (OpenGameArt) — one-shot `AudioBufferSourceNode`s for SFX and looped tracks for siren / frightened / retreat with fade-in/out
- Fix latent bug where the `sfx` gain bus was initialized to 0, silently muting every dot / pellet / eat-ghost sound
- Siren `playbackRate` rises as dots deplete for arcade-authentic intensity ramp
- Add Pac-Man card to the games gallery (9th game, "multiplayer" tag)
- Add ADR-014

## 2026-03-10 — Music Nav Health Check

- Add dynamic Music nav tab — probes `dj.thewiseguy.ai/health` on page load, upgrades from "coming soon" to a live link when the Cloudflare Tunnel is running
- Add `.music-live` CSS class with gold glow activation animation
- Add ADR-012 documenting the health check approach and rejected alternatives

## 2026-03-09 — Crossword

- Build Crossword puzzle game with 20 puzzles across 4 difficulty levels (5x5 to 15x15)
- Daily puzzle selection via djb2 hash with daily/random mode toggle
- Count-up timer with pause/resume and visibility auto-pause
- Check/Reveal toolbar buttons, localStorage persistence, and best times tracking
- Add crossword card to games gallery
- Add ADR-010

## 2026-03-09 — Jeopardy

- Build multiplayer Jeopardy game (Jackbox-style) with Firebase Realtime DB
- Host screen: lobby, board reveal, buzzer judging, scoring
- Player screen: join via room code, buzz in, wager on Daily Doubles and Final Jeopardy
- Round transitions (Single → Double Jeopardy → Final), play-again with rejoin
- Custom board builder with form validation and localStorage persistence
- Add ADR-011

## 2026-03-09 — Games

- Build games gallery page (`/games/`) with responsive card grid
- Add 6 games: Tic Tac Toe, Checkers, Connect Four, Chess, Snake, Sudoku
- All vs-AI games feature 4 difficulty levels (minimax / alpha-beta pruning)
- Snake with canvas rendering and 4 speed levels
- Sudoku with backtracking generator, pencil marks, and conflict highlighting
- Add ADRs 003–009
- Refactor shared styles into `styles.css` with design tokens and common layout components
- Add custom SVG favicon (house silhouette with warm glowing window)
- Add ADR-002

## 2026-03-09 — Warm Hearth Redesign

- Redesign homepage with warm gold/ember aesthetic, Fraunces + Bricolage Grotesque typography, ambient background layers, and staggered CSS load animations
- Create Games page (`/games/`) with matching design language
- Add ADR-001

## 2026-03-09 — Project Setup

- Initial static site with CNAME for chases.house
- Add site plan and GitHub Pages capabilities reference docs
