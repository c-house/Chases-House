# AGENTS.md — Jeopardy Game Operational Guide

This file contains project-specific conventions for the Jeopardy game.
Ralph reads this at the start of every session. Keep it brief and factual.

## Project Stack
- Language: HTML/CSS/JS (no TypeScript, no build step)
- Framework: None — static files served by GitHub Pages
- Real-time: Firebase v10 compat SDK via CDN `<script>` tags
- Auth: Firebase Anonymous Auth
- Local dev: `python -m http.server 3003` or `npx serve -p 3003` from repo root

## Validation Commands
```bash
# No test runner — validation is browser-based via Chrome DevTools MCP
# 1. Start dev server
python -m http.server 3003 &

# 2. Navigate to page, take screenshot, check console errors
# See PROMPT_BUILD.md step 3 for full protocol
```

## Code Conventions
- All CSS is inline in each HTML file — no external CSS per game
- JS uses IIFE + `window.Jeopardy` module pattern (see `shared.js`)
- Firebase config is inlined in `shared.js` — no env files
- Design tokens: gold `#c8943e`, ember `#a06828`, terracotta `#b05a3a`, deep bg `#0a0a0b`, text `#f0e6d3`
- Jeopardy-specific: board cells `#0d1a3a`, accent-gold dollar values, white-on-blue clue overlay
- Fonts: Fraunces (display), Bricolage Grotesque (body)
- Reference game for patterns: `games/chess/` (multi-file, `window.ChessEngine` pattern)

## File Structure
```
games/jeopardy/
├── index.html          # Landing page (host/join/builder links)
├── host.html           # Host screen (lobby, board, judging)
├── play.html           # Player screen (join, buzzer, wager)
├── builder.html        # Board builder (local-only authoring)
├── shared.js           # Firebase init, room management, window.Jeopardy module
├── host.js             # Host game logic
├── player.js           # Player game logic
├── builder.js          # Builder persistence logic
└── boards/
    └── sample.json     # Shipped sample board data
```

## Gotchas
- Firebase SDK is v10 **compat** mode (not modular) — use `firebase.database()` not `getDatabase()`
- Room codes are 4 uppercase letters, omitting I and O to avoid confusion
- `onDisconnect()` handlers must be set immediately after auth for reliable cleanup
- Server timestamps (`firebase.database.ServerValue.TIMESTAMP`) are critical for fair buzz ordering
- Daily Double placement is randomized at game start, not baked into board JSON

## Recent Learnings
<!-- Ralph and humans append here during development -->
- jsdelivr CDN for `qrcode@1.5.3` is blocked by Chrome ORB (Cross-Origin Read Blocking). Use cdnjs instead: `https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js` (QRCode.js by davidshimjs). API: `new QRCode(element, text)` — not the npm `qrcode` package's `QRCode.toCanvas()` API.
- Create placeholder JS stubs (empty IIFE) for script tags that reference future files to avoid 404 console errors during validation.
