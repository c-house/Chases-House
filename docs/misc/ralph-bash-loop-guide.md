# The Original Ralph Loop: Huntley's "malloc orchestrator"
### A complete reference with templates

---

## The Core Philosophy

The original Ralph loop is not about making a smarter agent — it's about building a smarter **harness** around a reliable-but-amnesiac one. Huntley calls it a "malloc orchestrator": you deliberately control what gets allocated into the context window each iteration, rather than letting it grow organically. 

Three axioms:
1. **State lives in files, not conversation.** The context window is a working memory buffer, not a database.
2. **Failures evaporate, progress persists.** Each iteration reconstructs reality from the filesystem — not from a transcript of what went wrong.
3. **Backpressure, not hope.** Tests, typechecks, and linters are your exit conditions. If you can't verify it programmatically, you don't have a gate.

---

## The Minimal Loop

```bash
while :; do
  cat PROMPT.md | claude-code
done
```

That's the entire original. Everything else — max iterations, completion signals, logging — is scaffolding on top of this primitive.

---

## The Full Loop Script (`loop.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

# ─── Configuration ────────────────────────────────────────────────
PROMPT_FILE="${PROMPT_FILE:-PROMPT.md}"
MAX_ITERATIONS="${MAX_ITERATIONS:-20}"
COMPLETION_SIGNAL="${COMPLETION_SIGNAL:-<promise>COMPLETE</promise>}"
LOG_FILE="ralph-run.log"
ITERATION=0

# ─── Preflight checks ─────────────────────────────────────────────
if [ ! -f "$PROMPT_FILE" ]; then
  echo "ERROR: $PROMPT_FILE not found. Create it before running Ralph."
  exit 1
fi

if ! command -v claude-code &>/dev/null; then
  echo "ERROR: claude-code CLI not found. Install it first."
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RALPH LOOP STARTING"
echo "  Prompt: $PROMPT_FILE"
echo "  Max iterations: $MAX_ITERATIONS"
echo "  Completion signal: $COMPLETION_SIGNAL"
echo "  Log: $LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── Main loop ────────────────────────────────────────────────────
while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))
  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  
  echo ""
  echo "┌─ Iteration $ITERATION / $MAX_ITERATIONS [$TIMESTAMP] ─────────────────"
  
  # Log iteration start
  echo "[$TIMESTAMP] ITERATION $ITERATION START" >> "$LOG_FILE"
  
  # Run the agent, capture output AND stream it to terminal
  OUTPUT=$(cat "$PROMPT_FILE" | claude-code --dangerously-skip-permissions 2>&1 | tee /dev/stderr)
  EXIT_CODE=${PIPESTATUS[1]}
  
  echo "└─ Iteration $ITERATION complete (exit: $EXIT_CODE)"
  
  # Log output
  echo "$OUTPUT" >> "$LOG_FILE"
  echo "[$TIMESTAMP] ITERATION $ITERATION END (exit: $EXIT_CODE)" >> "$LOG_FILE"
  echo "---" >> "$LOG_FILE"
  
  # Check completion signal
  if echo "$OUTPUT" | grep -qF "$COMPLETION_SIGNAL"; then
    echo ""
    echo "✅ COMPLETION SIGNAL DETECTED after $ITERATION iteration(s)"
    echo "   Signal: $COMPLETION_SIGNAL"
    break
  fi
  
  # Check for blockers (Ralph got stuck and said so)
  if echo "$OUTPUT" | grep -qiE "BLOCKED|STUCK|CANNOT_PROCEED"; then
    echo ""
    echo "⚠️  BLOCKER DETECTED — human intervention needed"
    echo "   Check ralph-run.log for details"
    exit 1
  fi
  
  echo "   No completion signal. Continuing..."
  
done

if [ $ITERATION -ge $MAX_ITERATIONS ]; then
  echo ""
  echo "⛔  MAX ITERATIONS ($MAX_ITERATIONS) REACHED without completion signal"
  echo "    Review ralph-run.log and IMPLEMENTATION_PLAN.md for status"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RALPH LOOP FINISHED in $ITERATION iteration(s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

Usage:
```bash
chmod +x loop.sh

# Basic run
./loop.sh

# Override defaults via env vars
MAX_ITERATIONS=50 PROMPT_FILE=PROMPT_BUILD.md ./loop.sh

# Run overnight, log to file
nohup ./loop.sh > ralph-output.log 2>&1 &
echo "Ralph PID: $!"
```

---

## The Three Phases

Ralph is not just a loop — it's a three-phase funnel. The loop is only Phase 3.

```
Phase 1: SPEC          Phase 2: PLAN            Phase 3: BUILD
──────────────         ──────────────────────   ──────────────────────
Define what            Gap-analyze specs         Implement tasks,
you want built         vs. current code.         commit, repeat.
as jobs-to-be-         Write prioritized         One task per loop
done → spec files      IMPLEMENTATION_PLAN.md    iteration.
```

You **swap PROMPT.md** to switch between planning mode and building mode. The loop mechanics are identical — only the instructions differ.

---

## File Architecture

```
project/
├── loop.sh                    # The bash loop
├── PROMPT.md                  # Active prompt (swapped for PLAN vs BUILD mode)
├── PROMPT_PLAN.md             # Planning mode prompt (copy to PROMPT.md to plan)
├── PROMPT_BUILD.md            # Building mode prompt (copy to PROMPT.md to build)
├── AGENTS.md                  # Operational guide — how to build/test THIS project
├── IMPLEMENTATION_PLAN.md     # Living task checklist (agent writes this)
├── specs/
│   ├── auth.md                # One spec per topic of concern
│   ├── dashboard.md
│   └── billing.md
├── ralph-run.log              # Append-only run log (never read by agent)
└── src/                       # Your actual codebase
```

**Key rule:** The agent reads `PROMPT.md`, `AGENTS.md`, and `specs/*`. It writes `IMPLEMENTATION_PLAN.md` and source code. It commits. It never writes to `PROMPT.md` or the loop script itself. These are **your** controls.

---

## Template: PROMPT_PLAN.md (Planning Mode)

Copy to `PROMPT.md` when you need to generate or refresh the implementation plan.

```markdown
# Ralph — Planning Mode

You are an expert software engineer performing a gap analysis.

## Your Job
1. Study ALL files in `specs/*` using parallel subagents (up to 50 Sonnet subagents)
   to understand the full requirements.
2. Study `src/*` using parallel subagents to understand what currently exists.
3. Compare specs against code — identify what is missing, incomplete, or incorrect.
4. Use an Opus subagent to analyze findings and prioritize tasks.
5. Write (or rewrite) `IMPLEMENTATION_PLAN.md` as a prioritized, checkbox task list.

## Rules
- DO NOT implement anything. Planning only.
- DO NOT commit anything.
- Tasks must be atomic — one task = one session of work.
- Each task must have explicit acceptance criteria (how will we know it's done?).
- Sort by priority: critical blockers first, nice-to-haves last.
- When complete, output: <promise>PLAN_COMPLETE</promise>

## Output Format for IMPLEMENTATION_PLAN.md
```markdown
# Implementation Plan
_Last updated: [date]_

## In Progress
(none)

## Todo
- [ ] **[TASK-001]** Short task description
  - Acceptance: What passing looks like
  - Files: Which files will be touched
  - Depends on: (none or TASK-XXX)

- [ ] **[TASK-002]** ...

## Done
- [x] **[TASK-000]** Initial scaffolding
```
```

---

## Template: PROMPT_BUILD.md (Building Mode)

Copy to `PROMPT.md` for the main building loop.

```markdown
# Ralph — Building Mode

You are an autonomous software engineer. You will implement ONE task per session,
then exit cleanly so the next session can begin fresh.

## Context Files (read these first, every time)
- `specs/*` — requirements and acceptance criteria
- `AGENTS.md` — how to build, test, and commit in this project
- `IMPLEMENTATION_PLAN.md` — task list; pick from "Todo"

## Your Loop (execute in order, every iteration)

### 0. Orient (parallel subagents)
- Study `specs/*` — understand full requirements
- Study `IMPLEMENTATION_PLAN.md` — understand what's done and what's next
- Study `src/lib/*` and relevant source — understand existing patterns

### 1. Select
- Pick the SINGLE highest-priority unchecked item from `IMPLEMENTATION_PLAN.md`
- Move it to "In Progress"
- If nothing remains in Todo, output <promise>COMPLETE</promise> and exit

### 2. Investigate
- Use subagents to study the relevant source files
- Do NOT assume something isn't implemented — check first

### 3. Implement
- Implement the task following existing code patterns
- Use existing utilities; do not reinvent

### 4. Validate (backpressure)
- Run: [your test command here, e.g. `npm test` or `pytest`]
- Run: [your typecheck command, e.g. `npx tsc --noEmit`]
- Run: [your lint command, e.g. `npm run lint`]
- If ANY check fails: debug, fix, and re-validate. Repeat until clean.
- If you cannot fix after 5 attempts: document blocker, output BLOCKED, exit.

### 5. Update IMPLEMENTATION_PLAN.md
- Mark the task as [x] done
- Note any discoveries, gotchas, or follow-up tasks you found

### 6. Update AGENTS.md (if you learned something operational)
- Add any new gotchas, patterns, or project-specific conventions

### 7. Commit
- `git add -A`
- `git commit -m "TASK-XXX: [brief description of what was done]"`
- `git push` (if remote configured)

### 8. Exit
- Output the completion line: <promise>COMPLETE</promise>
- The bash loop will immediately start a fresh session for the next task.

## Constraints
- ONE task per session. No more.
- Never modify PROMPT.md, PROMPT_PLAN.md, PROMPT_BUILD.md, or loop.sh.
- Never skip validation. Tests are not optional.
- Prefer simple, existing patterns over clever new ones.
- If you're unsure which task to pick, pick the one with no unresolved dependencies.
```

---

## Template: AGENTS.md

Start with a minimal version. Add to it only when Ralph fails in a specific, repeatable way — not upfront.

```markdown
# AGENTS.md — Operational Guide

This file contains project-specific conventions discovered during development.
Ralph reads this at the start of every session. Keep it brief and factual.

## Project Stack
- Language: [e.g. TypeScript / Python 3.11]
- Framework: [e.g. Next.js 14 / FastAPI]
- Test runner: [e.g. `npm test` / `pytest`]
- Typecheck: [e.g. `npx tsc --noEmit`]
- Lint: [e.g. `npm run lint` / `ruff check .`]

## Build Commands
```bash
npm install       # Install deps (run if package.json changed)
npm run build     # Full build
npm test          # All tests
npm run lint      # Lint
npx tsc --noEmit  # Type check
```

## Code Conventions
- [Add as discovered — e.g. "All API responses use the ApiResponse<T> wrapper type"]
- [e.g. "Database queries go in src/db/, never inline in routes"]

## Gotchas
- [Add when Ralph trips over something — e.g. "When adding a new enum, update constants.ts or tests fail"]
- [e.g. "The v1/users endpoint is deprecated — use v2/users"]

## File Structure
```
src/
├── components/    # UI components (React)
├── routes/        # API route handlers
├── db/            # Database queries
├── lib/           # Shared utilities
└── types/         # TypeScript types
```

## Recent Learnings
<!-- Ralph and humans append here during development -->
```

---

## Template: specs/EXAMPLE_SPEC.md

One file per "topic of concern." Describe the WHAT, not the HOW.

```markdown
# Spec: User Authentication

## Job to Be Done
Users need to securely register, log in, and maintain sessions so that
protected routes are accessible only to authenticated users.

## Scope
This spec covers: registration, login, logout, session management, and
password reset. It does NOT cover: OAuth/SSO (see specs/oauth.md), 
user profile management (see specs/profile.md).

## Requirements

### Registration
- Users can register with email + password
- Email must be unique; duplicate email returns a 409 error
- Password minimum 8 characters; hashed with bcrypt before storage
- On success: creates user record, issues JWT, returns 201

### Login
- Users can log in with email + password
- Invalid credentials return 401 (do not distinguish email vs password)
- On success: issues JWT with 7-day expiry, returns 200

### Session Management
- JWT stored in httpOnly cookie (not localStorage)
- Protected routes return 401 if no valid JWT
- JWT refresh endpoint extends expiry without re-login

### Password Reset
- User requests reset via email
- Time-limited token (1 hour) sent to registered email
- Token single-use; invalid after use or expiry

## Acceptance Criteria
- [ ] `POST /auth/register` creates user and returns token
- [ ] `POST /auth/login` returns token for valid credentials
- [ ] `POST /auth/login` returns 401 for invalid credentials
- [ ] `GET /protected` returns 401 without valid JWT
- [ ] `GET /protected` returns 200 with valid JWT
- [ ] All acceptance criteria have passing integration tests

## Out of Scope
- Social login (OAuth)
- Two-factor authentication
- Admin user management
```

---

## Template: IMPLEMENTATION_PLAN.md (initial seed)

Ralph will overwrite this in planning mode. Seed it if you want to start building immediately.

```markdown
# Implementation Plan
_Last updated: [date] — generated by planning loop_

## In Progress
(none)

## Todo

- [ ] **[TASK-001]** Set up project scaffolding and test infrastructure
  - Acceptance: `npm test` runs with 0 failures, `npx tsc --noEmit` passes
  - Files: package.json, tsconfig.json, jest.config.ts
  - Depends on: (none)

- [ ] **[TASK-002]** Create User model and database schema
  - Acceptance: User table exists with id, email, passwordHash, createdAt fields
  - Files: src/db/schema.ts, migrations/001_users.sql
  - Depends on: TASK-001

- [ ] **[TASK-003]** Implement POST /auth/register endpoint
  - Acceptance: Returns 201 with JWT on success; 409 on duplicate email; integration test passes
  - Files: src/routes/auth.ts, src/db/users.ts
  - Depends on: TASK-002

## Done
(none yet)
```

---

## Running the Two Modes

```bash
# ── PLANNING MODE ─────────────────────────────────────────────────
# Use when: no plan exists, or plan is stale/wrong

cp PROMPT_PLAN.md PROMPT.md
MAX_ITERATIONS=3 COMPLETION_SIGNAL="<promise>PLAN_COMPLETE</promise>" ./loop.sh

# Review IMPLEMENTATION_PLAN.md before proceeding
# If it looks wrong, fix your specs and re-run planning mode

# ── BUILDING MODE ─────────────────────────────────────────────────
# Use when: plan exists and looks right

cp PROMPT_BUILD.md PROMPT.md
MAX_ITERATIONS=50 ./loop.sh

# ── OVERNIGHT RUN ─────────────────────────────────────────────────
nohup env MAX_ITERATIONS=100 ./loop.sh > overnight.log 2>&1 &
echo "Ralph PID: $! — tail -f overnight.log to watch"
```

---

## Subagent Fan-out Pattern (in PROMPT.md)

The main agent is a **scheduler only** — all expensive reads happen in subagents to protect the main context window.

```markdown
### 0. Orient (ALWAYS use parallel subagents for reads)
- Spawn up to 50 Sonnet subagents to study `specs/*` in parallel
- Spawn up to 50 Sonnet subagents to study relevant `src/*` files
- Spawn 1 Opus subagent to synthesize findings and choose the next task
- Report summary to main context — do NOT dump raw file contents here
```

Why: each subagent gets ~156k tokens of its own context, which is garbage-collected after it returns. The main agent gets a clean summary instead of raw file contents.

---

## Context Budget Guidelines

| Context usage | State | Action |
|---|---|---|
| 0–50% | Smart zone | Normal operation |
| 50–70% | Degrading | Finish task, commit, exit |
| 70%+ | Dumb zone | Abort task, commit partial, exit immediately |

Add this to your PROMPT.md to enforce it:
```markdown
## Context Discipline
Monitor your context usage. If you exceed 60% context utilization mid-task:
1. Commit whatever is clean and working
2. Update IMPLEMENTATION_PLAN.md to note where you stopped
3. Output <promise>COMPLETE</promise> and exit
The next iteration will pick up from where you left off.
```

---

## Backpressure: Making Verification Programmatic

The most important thing in your PROMPT.md is the validation step. Without a real gate, Ralph has no signal for "done."

**Tier 1 (fast, always run):**
```bash
npm test              # Unit tests
npx tsc --noEmit      # Type checking
npm run lint          # Linting
```

**Tier 2 (slower, run before commit):**
```bash
npm run test:integration   # Integration tests
npm run test:e2e           # End-to-end (if applicable)
```

**Tier 3 (subjective, LLM-as-judge):**
For UI quality, UX, or other non-deterministic criteria, you can add an LLM evaluation step that outputs a binary PASS/FAIL. Treat it like a test — if it fails, don't commit.

---

## Escape Hatches

| Situation | Action |
|---|---|
| Ralph going off-track | `Ctrl+C` to stop the loop |
| Bad commits | `git reset --hard HEAD~N` |
| Plan is wrong/stale | Re-run planning mode with fresh `PROMPT_PLAN.md` |
| Agent stuck in a failure pattern | Stop loop, add a sign to `AGENTS.md`, restart |
| Context rot mid-run | Stop loop, run `/compact` manually, restart |
| Credentials/key exposure risk | Always run in Docker or isolated sandbox |

---

## Sandbox Setup (important for `--dangerously-skip-permissions`)

Ralph requires `--dangerously-skip-permissions` to run autonomously — every tool call needing approval would break the loop. This bypasses Claude's permission system entirely.

```bash
# Minimal Docker sandbox
docker run -it --rm \
  -v $(pwd):/workspace \
  -w /workspace \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  --network none \          # No internet unless your app needs it
  node:20 \
  bash -c "npm install -g @anthropic-ai/claude-code && ./loop.sh"
```

Rule of thumb: only give Ralph the API keys and deploy keys it actually needs for the task. Nothing else.

---

## Key Insight Summary

```
THE MALLOC ORCHESTRATOR

You control:           Ralph controls:
─────────────────      ─────────────────────────
loop.sh                Which task to pick next
PROMPT.md              How to implement it
AGENTS.md              When it thinks it's done
specs/*                What patterns to follow

You do NOT control:    You VERIFY with:
─────────────────      ─────────────────────────
Implementation         Tests (pass/fail)
Task ordering          Type checker
Code patterns          Linter
                       Git history
                       IMPLEMENTATION_PLAN.md

State lives in FILES, not conversation.
Failures evaporate, progress persists.
```
