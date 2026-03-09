# ADR-010: Crossword

**Status**: Pending
**Date**: 2026-03-09

## Context

The games collection has adversarial games (Tic Tac Toe, Checkers, Connect Four, Chess), a real-time action game (Snake), and a solo logic puzzle (Sudoku). A crossword adds a word/trivia puzzle category — a different kind of challenge that tests vocabulary and lateral thinking rather than spatial reasoning or reflexes. Crossword puzzles are among the most popular daily puzzle formats globally (NYT Crossword has 1M+ subscribers).

### How Competitors Handle This

**NYT Crossword** — The gold standard. Difficulty scales by day of week: Monday (easiest, direct clues) through Saturday (hardest, obscure wordplay, fewer black squares, no theme). Sunday is large (21x21) but medium difficulty. Features: timer, check/reveal helpers, pencil mode, streaks, leaderboards. The NYT Mini (5x5) is a separate quick-play format.

**Other apps** (Washington Post, LA Times, CodyCross) — Similar feature sets: timer, hints with penalties, check answers, daily cadence, streak tracking. CodyCross adds themed worlds with progressive difficulty.

**Common difficulty levers across competitors:**
- Grid size (5x5 mini → 15x15 standard → 21x21 Sunday)
- Clue obscurity (direct definitions → wordplay → cryptic)
- Black square ratio (more black squares = easier; more open = harder)
- Theme complexity (themed Monday–Thursday; themeless Friday–Saturday)
- Helper feature availability (easy = more hints; hard = fewer)

## Decision

Built a crossword puzzle game with pre-bundled puzzles at four difficulty levels. Difficulty scales via grid size — Easy is NYT Mini-style 5x5, Extreme is a full 15x15. Puzzles are pre-authored and shipped as embedded JSON (no backend, no runtime generation).

### Difficulty Levels

Difficulty scales by grid size, which naturally increases solve time, vocabulary demands, and the number of interlocking constraints:

| Level   | Grid   | ~Words | ~Solve Time | Clue Style       |
|---------|--------|--------|-------------|------------------|
| Easy    | 5×5    | 5–8    | ~2 min      | Direct definitions |
| Medium  | 9×9    | 15–20  | ~8 min      | Moderate wordplay |
| Hard    | 13×13  | 30–40  | ~18 min     | Tricky clues     |
| Extreme | 15×15  | 45–55  | ~30 min     | Obscure/wordplay |

Each difficulty has its own pool of 5–10 puzzles. A date-based hash (djb2 on `YYYY-MM-DD`) selects "today's puzzle" deterministically per difficulty. A "Random" mode picks from the pool randomly.

### Puzzle Data Format

Puzzles stored as JSON in a separate `puzzles.js` file (exported via `window.CrosswordPuzzles`), following the chess pattern of splitting data/AI into a second file:

```json
{
  "id": "easy-001",
  "size": 5,
  "title": "Monday Morning",
  "grid": [
    ["S","T","A","R","T"],
    ["H","#","#","O","#"],
    ["O","P","E","N","S"],
    ["#","A","#","#","H"],
    ["S","N","A","K","E"]
  ],
  "clues": {
    "across": [
      { "num": 1, "row": 0, "col": 0, "text": "Begin", "answer": "START" }
    ],
    "down": [
      { "num": 1, "row": 0, "col": 0, "text": "Footwear", "answer": "SHOE" }
    ]
  }
}
```

- `grid`: 2D array — `"#"` = black cell, letters = solution. Single source of truth.
- Clue `answer` field is redundant with grid but enables O(1) check/reveal without re-extracting word spans.
- `num`, `row`, `col` on each clue avoids runtime clue-numbering computation.

### Key Design Decisions

- **Grid rendering**: CSS Grid with `grid-template-columns: repeat(var(--grid-size), 1fr)`. `--grid-size` set dynamically via JS when puzzle loads. Board width scales per difficulty via `clamp()` values.
- **Cell states**: `.selected` (gold highlight on cursor), `.word-highlight` (faint gold on current word), `.checked-incorrect` (terracotta for wrong answers), `.revealed` (faint/italic for given-away letters), `.player-value` (gold for player-entered letters).
- **Clue numbering**: Small absolute-positioned `<span class="cell-number">` in top-left of each numbered cell. Font scales down with grid size.
- **Input handling** (crossword-specific):
  - Click cell to select; click same cell to toggle across/down direction
  - A–Z places letter and auto-advances to next empty cell in current word
  - Backspace clears current cell; if empty, retreats and clears previous
  - Arrow keys navigate between non-black cells; spacebar toggles direction
  - Tab/Shift+Tab jumps between words
- **Layout**: Flexbox `.game-layout` with board left, clues panel right (desktop). Stacked on mobile (≤768px) with an active-clue-bar below the grid showing the current clue — mirrors NYT mobile pattern.
- **Clue panel**: Scrollable panel with Across/Down sections. Active clue highlighted in gold. Completed words get strikethrough + fade. Clicking a clue selects its first empty cell.
- **Timer**: Count-up timer with pause/resume. Pauses automatically on `visibilitychange`. Best times per difficulty saved to localStorage.
- **Check/Reveal**: Four toolbar buttons — Check Letter, Check Word, Reveal Letter, Reveal Word. Check marks incorrect cells in terracotta. Reveal fills correct letter in faint/italic style. No keyboard shortcuts for these (prevent accidental use).
- **Daily puzzle**: `djb2(dateString) % poolSize` gives deterministic daily selection. All users see the same puzzle per difficulty per day.
- **State persistence**: Full state (player grid, cell flags, timer, selected cell, direction) saved to localStorage after every action. Cleared on completion. Same pattern as Sudoku.
- **Win detection**: Compare every non-black cell in `playerGrid` against `puzzle.grid`. All match = solved. Show win overlay with time.
- **Precomputed data**: On puzzle load, compute `wordSpans` (clue → list of cells) and `clueMap` (cell → {across, down} clue numbers) for O(1) lookups during input and rendering.

### Puzzle Content Strategy

Crossword puzzles require curated content (unlike Sudoku's algorithmic generation). Initial approach:
- Hand-craft 5×5 and 9×9 puzzles (manageable word counts)
- Use offline crossword construction tools for 13×13 and 15×15
- Export as JSON matching the schema above
- Pool grows over time; the daily selection and random mode work with any pool size

## Files Changed

- `games/crossword/index.html` — Game page with grid, clue panels, toolbar, timer, inline CSS (~500 lines)
- `games/crossword/game.js` — Game engine: state, rendering, input, timer, check/reveal, persistence (~550 lines)
- `games/crossword/puzzles.js` — Pre-bundled puzzle data as `window.CrosswordPuzzles` (~varies with content)
- `games/index.html` — Crossword card added to gallery
- `docs/adr/010-crossword.md` — This ADR

## Verification

- Grid renders correctly at all 4 sizes (5×5, 9×9, 13×13, 15×15)
- Cell selection, direction toggle, and word highlighting work
- Letter entry with auto-advance and backspace retreat
- Arrow key navigation skips black cells
- Tab cycles through words; spacebar toggles direction
- Check Letter/Word marks incorrect cells in terracotta
- Reveal Letter/Word fills correct answer in revealed style
- Timer counts up, pauses on visibility change, persists across reloads
- Best times saved per difficulty
- Daily puzzle is deterministic (same puzzle for same date)
- State persists across page refresh; cleared on completion
- Win overlay shows on correct completion with solve time
- Mobile layout: stacked board/clues, active clue bar visible
- 15×15 grid usable on 360px-wide phone screens
- Responsive clamp() sizing at all breakpoints
- Theme consistency with existing games (colors, fonts, animations)

## Implementation Sequence

1. `puzzles.js` — Seed with 2–3 puzzles per difficulty (can use placeholder content to unblock)
2. `index.html` — Full HTML structure + inline CSS (grid, clues panel, toolbar, timer, responsive)
3. `game.js` core — State model, puzzle loading, `computeWordSpans()`, `renderBoard()`, `renderClues()`
4. `game.js` input — Cell selection, direction toggle, letter entry, auto-advance, backspace, arrow keys, Tab
5. `game.js` timer — Start/pause/resume, visibility change handler, display formatting
6. `game.js` check/reveal — Toolbar buttons, check/reveal logic, cell flag rendering
7. `game.js` persistence — Save/load state, best times
8. `game.js` daily puzzle — Date-based selection, daily/random mode toggle
9. `games/index.html` — Add crossword card to gallery
10. Final puzzles — Replace placeholders with real crossword content
