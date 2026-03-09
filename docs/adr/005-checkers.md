# ADR-005: Checkers

**Status**: Accepted
**Date**: 2026-03-09

## Context

Checkers (American/English draughts) adds a board game with more strategic depth than Tic Tac Toe. It introduces piece movement, multi-jump captures, and king promotion — expanding the AI and UI complexity while remaining approachable.

## Decision

Built standard 8x8 American checkers where the player competes against an AI. All standard rules: diagonal movement, mandatory captures, multi-jump chains, king promotion on the back row. A piece that promotes mid-chain ends its turn (per official American Checkers rules).

### Difficulty Levels

| Level | Search Depth |
|-------|-------------|
| Easy | 2 plies |
| Medium | 4 plies |
| Hard | 7 plies |
| Extreme | 9 plies |

### AI Approach

Minimax with alpha-beta pruning. Chain-jump sequences are expanded into complete atomic moves before the search (via `expandChainJumps`), so the AI evaluates full multi-jump paths as single moves rather than hop-by-hop.

Evaluation function scores: piece count (100 regular, 175 king), row advancement bonus (3 per row), center control (5 regular, 8 king for rows/cols 2–5), and mobility differential (2 per legal move advantage). AI chain jumps animate step-by-step with 300ms delays.

### Key Design Decisions

- Board is a 2D `Array[8][8]` of integer constants (0=empty, 1–4 for player/AI regular/king)
- Player pieces in accent-gold gradient, AI pieces in terracotta gradient
- Kings marked with ♚ Unicode symbol via `::after` pseudo-element
- Valid moves shown as gold dots, captures as hollow rings
- Last-move squares highlighted with subtle gold background
- Live piece count display (not win/loss score)
- Full DOM rebuild on every render (no virtual DOM)

## Files Changed

- `games/checkers/index.html` — Game page with inline CSS (313 lines)
- `games/checkers/game.js` — Game logic, move validation, chain-jump AI (614 lines)
- `games/index.html` — Checkers card added to gallery

## Verification

- All rules verified: diagonal moves, mandatory captures, multi-jumps, king promotion
- AI plays reasonably at each difficulty level
- Piece selection and valid move highlighting work correctly
- Board playable on mobile
