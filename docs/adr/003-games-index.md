# ADR-003: Games Index Page

**Status**: Accepted
**Date**: 2026-03-09

## Context

The games section had a placeholder page (`games/index.html`) that said "Games are on their way." As games were built, the site needed a hub page listing available games with links to each one. This page is the entry point from the homepage "Games" room card and nav link.

## Decision

Transformed `games/index.html` from a placeholder into a game gallery. Games are displayed as cards in a responsive grid, each linking to its subdirectory.

### Design

- Cards use the `.game-card` pattern (defined in shared `styles.css`) — ember border, hover lift/glow
- Each card is an `<a>` tag with four child `<span>` elements: icon, title, description, and tag badge
- Icons are Unicode characters (✖, ♟, ●, ♚, 🐍, ▪) — no images or SVGs needed
- CSS Grid with `auto-fill, minmax(18rem, 1fr)` — responsive from 1–3 columns
- Tags indicate game type: "vs AI" or "Solo"
- Card descriptions note the AI algorithm used (e.g., "minimax", "alpha-beta pruning")
- No JavaScript on the page — pure HTML/CSS with links

### Games Listed

All six games ship on the gallery: Tic Tac Toe, Checkers, Connect Four, Chess, Snake, Sudoku.

## Files Changed

- `games/index.html` — Rewritten from placeholder to 6-card game gallery (132 lines)
- `styles.css` — Game card grid and card component styles added to shared stylesheet

## Verification

- Navigate from homepage Games card and nav link to `/games/`
- All 6 game cards render and link to correct subdirectories
- Responsive layout works at desktop, tablet, and mobile widths
- Warm Hearth theme consistency (colors, fonts, background)
