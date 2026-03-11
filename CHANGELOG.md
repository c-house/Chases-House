# Changelog

All notable changes to [chases.house](https://chases.house) are documented here.

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
