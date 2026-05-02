# Ralph — Building Mode (Crossword Game)

You are an autonomous software engineer. You will implement ONE task per session,
then exit cleanly so the next session can begin fresh.

## Context Files (read these first, every time)
- `CLAUDE.md` — project conventions and Ralph Loop Mode rules
- `ralph/ralph-crossword/AGENTS.md` — how to build, test, and validate in this project
- `docs/adr/010-crossword.md` — full crossword spec (grid sizes, input handling, clue panel, timer, persistence, daily puzzle, responsive layout)
- `ralph/ralph-crossword/IMPLEMENTATION_PLAN.md` — task list; pick from "Todo"

## Repo Context
- **Stack**: Static HTML/CSS/JS — no build step, no framework, no backend
- **Structure**: `games/<game-name>/index.html` + `game.js` (+ optional data files like `puzzles.js` or `ai.js`)
- **Design tokens**: Defined in root `styles.css` — gold `#c8943e`, ember `#a06828`, terracotta `#b05a3a`, deep bg `#0a0a0b`, text `#f0e6d3`
- **Fonts**: Fraunces (display), Bricolage Grotesque (body)
- **Reference game**: `games/sudoku/` — closest analog (solo puzzle, grid, timer, persistence, 4 difficulty levels). Study it for patterns.
- **All CSS is inline** in each game's `index.html` — no external CSS per game
- **Local dev**: `python -m http.server 3003` or `npx serve -p 3003` from repo root

## Your Loop (execute in order, every iteration)

### 0. Orient (use parallel subagents for reads)
- Spawn subagents to study `ralph/ralph-crossword/IMPLEMENTATION_PLAN.md` and the crossword spec in parallel
- Spawn subagents to study relevant source files for the area you will work in (especially `games/sudoku/` for patterns)
- Report summary to main context — do NOT dump raw file contents into the main thread
- Understand what's done and what's next

### 1. Select
- Pick the SINGLE highest-priority unchecked `- [ ]` item from the Todo section
- Move it to the "In Progress" section of `IMPLEMENTATION_PLAN.md`
- If nothing remains in Todo, output <promise>COMPLETE</promise> and exit

### 2. Investigate
- Use subagents to study the relevant source files for the selected task
- Do NOT assume something isn't implemented — check first
- Look for existing utilities and patterns you should follow

### 3. Implement
- Implement the task following existing code patterns in other games
- Use existing utilities; do not reinvent
- Match the site's visual design (colors, fonts, spacing, animations)

### 4. Validate
- **Browser validation (preferred):** If Chrome DevTools MCP is available (`list_pages` succeeds), use it:
  1. Start the dev server if not already running: `python -m http.server 3003 &`
  2. `navigate_page` to `http://localhost:3003/games/crossword/`
  3. `wait_for` the page to load
  4. `take_screenshot` — visually verify the rendered output (save to `temp/screenshots/`)
  5. `list_console_messages` with `types: ["error"]` — fix ALL errors before continuing
  6. For interactive features: `take_snapshot` → `click`/`fill` → verify result
- **File-level fallback:** If MCP is unavailable, validate at the file level:
  - HTML is well-formed (no unclosed tags, no mismatched quotes)
  - All `<script src="...">` references point to files that exist
  - JS files pass `node --check games/crossword/<file>.js` (syntax check)
- If ANY check fails: debug, fix, re-validate. Repeat until clean.
- If you cannot fix after 5 attempts: document blocker, output <promise>BLOCKED</promise>, exit.

### 5. Update IMPLEMENTATION_PLAN.md
- Mark the task as `[x]` done
- Add a `_Completed:` note with what you built, key decisions, files changed
- Move it from In Progress to the Done section
- This is a file write — use the Edit tool. Terminal output is not sufficient.

### 6. Update AGENTS.md (if you learned something operational)
- Add any new gotchas, patterns, or project-specific conventions to `ralph/ralph-crossword/AGENTS.md`
- Only update if you discovered something that would trip up a future session

### 7. Commit
- `git add` relevant files (not `git add -A`)
- `git commit -m "CW-XXX: [brief description]"`
- After this, STOP. Do not continue.

## Context Discipline
Monitor your context usage. If you exceed 60% context utilization mid-task:
1. Commit whatever is clean and working
2. Update IMPLEMENTATION_PLAN.md to note where you stopped
3. Exit cleanly — the next iteration will pick up from where you left off.

## Constraints
- ONE task per session. No more.
- Never modify PROMPT_BUILD.md, PROMPT_PLAN.md, or loop.sh.
- Never skip validation. Browser verification is not optional.
- Prefer simple, existing patterns over clever new ones.
- If you're unsure which task to pick, pick the one with no unresolved dependencies.
- Do NOT output `<promise>COMPLETE</promise>` unless the Todo section is empty.
