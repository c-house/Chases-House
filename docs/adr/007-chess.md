# ADR-007: Chess

**Status**: Accepted
**Date**: 2026-03-09

## Context

Chess is the most complex game in the collection. The game tree is enormous, move validation has many special rules, and building a competent AI is a significant undertaking. This ADR captures the approach used to deliver a playable chess experience within the project's vanilla JS constraints.

## Decision

Built a full chess implementation with all standard rules. Player plays as White against an AI opponent. The engine and AI are split across two files with a clean module boundary (`window.ChessEngine` / `window.ChessAI`).

### Difficulty Levels

AI features are controlled by a feature-flag configuration table:

| Level | Depth | PST | Move Ordering | Transposition Table | Quiescence |
|-------|-------|-----|---------------|---------------------|------------|
| Easy | 2 | No | No | No | No |
| Medium | 3 | Yes | No | No | No |
| Hard | 4 | Yes | Yes | No | No |
| Extreme | 5 | Yes | Yes | Yes | Yes |

Extreme uses iterative deepening (depth 1→5), reusing the transposition table across iterations. The TT uses a polynomial rolling hash (not Zobrist — sufficient for vanilla JS). Quiescence search extends captures-only up to 4 plies beyond the main search horizon.

### AI Approach

Minimax with alpha-beta pruning. Evaluation layers: material-only (easy) or material + piece-square tables (medium+). Piece values in centipawns: pawn=100, knight=320, bishop=330, rook=500, queen=900, king=20000. Move ordering uses MVV-LVA plus center-distance bonus. No Web Workers — AI runs synchronously after a 200ms `setTimeout` for DOM repaint. No opening book.

### Special Rules Implemented

All standard rules: castling (kingside + queenside, both colors), en passant, pawn promotion (modal with queen/rook/bishop/knight selection), fifty-move rule (100 half-moves), threefold repetition (string-key position comparison), stalemate, and insufficient material detection (K vs K, K+B vs K, K+N vs K, K+B vs K+B same-color).

### Key Design Decisions

- Pieces rendered via Unicode chess symbols (font-dependent, no images)
- Click-to-select, click-to-move with legal move highlighting
- Full algebraic notation with disambiguation, check (+), and checkmate (#) suffixes
- Move history panel in the UI
- Check and checkmate visual indicators on the board
- Board squares use bg-surface / bg-elevated alternation

## Files Changed

- `games/chess/index.html` — Game page with inline CSS, promotion modal, move history panel (493 lines)
- `games/chess/game.js` — Board state, move generation, all rules, rendering, `ChessEngine` module (885 lines)
- `games/chess/ai.js` — AI engine, evaluation, search, `ChessAI` module (427 lines)
- `games/index.html` — Chess card added to gallery

## Verification

- All piece movement rules including special moves work correctly
- Check, checkmate, and stalemate detection confirmed
- AI responds within acceptable time at each difficulty
- Playable with touch interaction on mobile
- AI quality assessed through full games per difficulty
