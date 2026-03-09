# Implementation Plan — Games Section

Build the games section for chases.house, transforming the placeholder into a full game gallery with 6 browser games.

Source: ADR-003 through ADR-009 in `docs/adr/`

---

## Todo

- [ ] **GAME-003**: Checkers (ADR-005)
  - Create `games/checkers/index.html` and `games/checkers/game.js`
  - 8x8 board, standard American rules: diagonal moves, mandatory captures, multi-jump chains, king promotion
  - Alpha-beta AI: Easy (2 plies), Medium (4 plies), Hard (6-8 plies), Extreme (8-10 plies)
  - Player pieces accent-gold, AI pieces terracotta/ember, kings visually distinguished
  - Click-to-select, click-to-move, valid move highlighting, mandatory jump enforcement
  - Add Checkers card to `games/index.html` gallery

- [ ] **GAME-004**: Connect Four (ADR-006)
  - Create `games/connect-four/index.html` and `games/connect-four/game.js`
  - 7-column, 6-row board with drop animation
  - Alpha-beta AI: Easy (2 plies), Medium (4 plies), Hard (6-8 plies), Extreme (10+ plies)
  - Column hover preview, player discs accent-gold, AI discs terracotta
  - Win state highlights four connected discs
  - Add Connect Four card to `games/index.html` gallery

- [ ] **GAME-005**: Chess (ADR-007)
  - Create `games/chess/index.html`, `games/chess/game.js`, and `games/chess/ai.js`
  - Full rules: all piece movement, castling, en passant, pawn promotion (with piece selection UI), fifty-move rule, threefold repetition, stalemate
  - AI in separate file: Easy (2 plies), Medium (3-4 plies + piece-square tables), Hard (4-5 plies + alpha-beta + move ordering), Extreme (5-6 plies + iterative deepening + transposition table + quiescence search)
  - Unicode chess symbols or SVGs, legal move highlighting, check/checkmate indicators, algebraic notation move history
  - Player is White, AI is Black. AI responds <3s at each difficulty.
  - Add Chess card to `games/index.html` gallery

- [ ] **GAME-006**: Snake (ADR-008)
  - Create `games/snake/index.html` and `games/snake/game.js`
  - Canvas-based grid movement, snake in accent-gold, food as glowing ember dot
  - Difficulty = speed: Easy (~200ms), Medium (~130ms), Hard (~80ms), Extreme (~50ms)
  - Arrow keys + WASD input, swipe gestures on mobile, pause with spacebar/tap
  - High score in `localStorage`, game over screen with "Play Again"
  - Add Snake card to `games/index.html` gallery

- [ ] **GAME-007**: Sudoku (ADR-009)
  - Create `games/sudoku/index.html` and `games/sudoku/game.js`
  - 9x9 CSS Grid with 3x3 box borders, backtracking puzzle generator with unique-solution verification
  - Difficulty = givens: Easy (~36-40), Medium (~30-35), Hard (~25-29), Extreme (~20-24)
  - Given cells bold/non-editable, number pad input, pencil marks, real-time conflict highlighting
  - Puzzle state saved to `localStorage`, "New Puzzle" button
  - Add Sudoku card to `games/index.html` gallery

---

## Done

- [x] **GAME-001**: Games gallery page (ADR-003)
  _Completed: Rewrote `games/index.html` from placeholder to a gallery layout with heading, description, and a `.game-grid` container ready for game cards. Added shared game-card styles to `styles.css` (`.game-grid`, `.game-card`, `.game-card-icon`, `.game-card-title`, `.game-card-desc`, `.game-card-tag`) following the `.room-card` pattern — ember border, hover lift/glow, CSS Grid 1–3 columns responsive. Empty state shown with dashed border until first game ships. Files changed: `games/index.html`, `styles.css`._

- [x] **GAME-002**: Tic Tac Toe (ADR-004)
  _Completed: Created `games/tic-tac-toe/index.html` and `games/tic-tac-toe/game.js`. 3x3 CSS Grid board with player X (accent-gold) and AI O (text-faint). Minimax AI with depth-aware scoring: Easy (random), Medium (minimax + 30% random fallback), Hard/Extreme (optimal minimax). Difficulty selector with 4 levels, status bar with turn/result display, win-cell highlighting, "New Game" button, back link to games gallery. Replaced empty state in `games/index.html` with Tic Tac Toe game card. Keyboard accessible (Enter/Space on cells), responsive layout. Files changed: `games/tic-tac-toe/index.html`, `games/tic-tac-toe/game.js`, `games/index.html`._
