# AGENTS.md — Crossword Game Operational Guide

This file contains project-specific conventions for the Crossword game.
Ralph reads this at the start of every session. Keep it brief and factual.

## Project Stack
- Language: HTML/CSS/JS (no TypeScript, no build step)
- Hosting: GitHub Pages (static files only)
- Local dev: `python -m http.server 3003` from repo root
- No test runner — browser-based validation via Chrome DevTools MCP

## Validation Commands
```bash
python -m http.server 3003 &   # Start dev server
node --check games/crossword/game.js  # JS syntax check (fallback)
```

## Code Conventions
- All CSS is inline in each game's `index.html` — no external CSS per game
- JS uses IIFE pattern for game modules
- Design tokens from root `styles.css`: gold `#c8943e`, ember `#a06828`, terracotta `#b05a3a`, deep bg `#0a0a0b`, text `#f0e6d3`
- Fonts: Fraunces (display), Bricolage Grotesque (body)
- Reference: `games/sudoku/` for solo puzzle patterns (grid, timer, persistence, difficulty)

## File Structure
```
games/crossword/
├── index.html     # Full game page (inline CSS + structure)
├── game.js        # Core game logic (state, rendering, input)
└── puzzles.js     # Puzzle data (grids, clues, solutions)
```

## Gotchas
<!-- Ralph appends here when it discovers pitfalls -->

## Recent Learnings
<!-- Ralph appends here during development -->
