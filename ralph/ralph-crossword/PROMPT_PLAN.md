# Ralph — Planning Mode (Crossword Game)

You are an expert software engineer performing a gap analysis.

## Your Job
1. Study ALL spec files referenced below using parallel subagents to understand the full requirements.
2. Study the existing source code using parallel subagents to understand what currently exists.
3. Compare specs against code — identify what is missing, incomplete, or incorrect.
4. Write (or rewrite) `ralph/ralph-crossword/IMPLEMENTATION_PLAN.md` as a prioritized, checkbox task list.

## Specs
- `docs/adr/010-crossword.md` — full crossword spec
- `games/sudoku/` — reference game for patterns (solo puzzle, grid, timer, persistence, difficulty levels)

## Rules
- DO NOT implement anything. Planning only.
- DO NOT commit anything.
- Tasks must be atomic — one task = one session of work.
- Each task must have explicit acceptance criteria (how will we know it's done?).
- Sort by priority: critical blockers first, nice-to-haves last.
- When complete, output: <promise>COMPLETE</promise>

## Output Format for IMPLEMENTATION_PLAN.md
```markdown
# Implementation Plan
_Last updated: [date]_

## In Progress
(none)

## Todo
- [ ] **[CW-001]** Short task description [category]
  - Acceptance: What passing looks like
  - Files: Which files will be touched
  - Depends on: (none or CW-XXX)

- [ ] **[CW-002]** ...

## Done
(none yet)
```
