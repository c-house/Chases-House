#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# ─── Configuration ────────────────────────────────────────────────
PROMPT_FILE="${PROMPT_FILE:-$SCRIPT_DIR/PROMPT.md}"
MAX_ITERATIONS="${MAX_ITERATIONS:-20}"
COMPLETION_SIGNAL="${COMPLETION_SIGNAL:-<promise>COMPLETE</promise>}"
DANGEROUSLY_SKIP_PERMISSIONS="${DANGEROUSLY_SKIP_PERMISSIONS:-false}"
LOG_FILE="${LOG_FILE:-$SCRIPT_DIR/ralph-jeopardy.log}"
CLAUDE_CODE_MAX_OUTPUT_TOKENS="${CLAUDE_CODE_MAX_OUTPUT_TOKENS:-64000}"
export CLAUDE_CODE_MAX_OUTPUT_TOKENS
ITERATION=0

# ─── Preflight checks ─────────────────────────────────────────────
[ -f "$PROMPT_FILE" ] || { echo "ERROR: $PROMPT_FILE not found."; exit 1; }
command -v claude &>/dev/null || { echo "ERROR: claude CLI not found. Install it first."; exit 1; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RALPH LOOP STARTING"
echo "  Prompt: $PROMPT_FILE"
echo "  Max iterations: $MAX_ITERATIONS"
echo "  Skip permissions: $DANGEROUSLY_SKIP_PERMISSIONS"
echo "  Completion signal: $COMPLETION_SIGNAL"
echo "  Log: $LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── Main loop ────────────────────────────────────────────────────
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    echo ""
    echo "┌─ Iteration $ITERATION / $MAX_ITERATIONS [$TIMESTAMP] ─────────────────"

    # Log iteration start
    echo "[$TIMESTAMP] ITERATION $ITERATION START" >> "$LOG_FILE"

    CLAUDE_ARGS=(-p)
    if [[ "$DANGEROUSLY_SKIP_PERMISSIONS" == "true" ]]; then
        CLAUDE_ARGS+=(--dangerously-skip-permissions)
    fi

    cat "$PROMPT_FILE" | claude "${CLAUDE_ARGS[@]}" | tee "$TMPFILE"

    EXIT_CODE=${PIPESTATUS[1]}
    echo "└─ Iteration $ITERATION complete (exit: $EXIT_CODE)"

    # Log output
    {
        echo ""
        echo "--- Iteration $ITERATION — $TIMESTAMP (exit: $EXIT_CODE) ---"
        echo ""
        cat "$TMPFILE"
    } >> "$LOG_FILE"
    echo "[$TIMESTAMP] ITERATION $ITERATION END (exit: $EXIT_CODE)" >> "$LOG_FILE"
    echo "---" >> "$LOG_FILE"

    # Check completion signal
    if grep -qF "$COMPLETION_SIGNAL" "$TMPFILE"; then
        echo ""
        echo "✅ COMPLETION SIGNAL DETECTED after $ITERATION iteration(s)"
        echo "   Signal: $COMPLETION_SIGNAL"
        break
    fi

    # Check for blockers
    if grep -qiE "BLOCKED|STUCK|CANNOT_PROCEED" "$TMPFILE"; then
        echo ""
        echo "⚠️  BLOCKER DETECTED — human intervention needed"
        echo "   Check $LOG_FILE for details"
        exit 1
    fi

    echo "   No completion signal. Continuing..."

done

if [ $ITERATION -ge $MAX_ITERATIONS ]; then
    echo ""
    echo "⛔  MAX ITERATIONS ($MAX_ITERATIONS) REACHED without completion signal"
    echo "    Review $LOG_FILE for status"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RALPH LOOP FINISHED in $ITERATION iteration(s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
