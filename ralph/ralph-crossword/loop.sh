#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

ITERATIONS="${1:?Usage: $0 <iterations>}"
PROMPT_FILE="${PROMPT_FILE:-$SCRIPT_DIR/PROMPT_BUILD.md}"
PERMISSION_MODE="${PERMISSION_MODE:-acceptEdits}"
LOG_FILE="${LOG_FILE:-$SCRIPT_DIR/$(basename "$SCRIPT_DIR").log}"
COMPLETION_SENTINEL="${COMPLETION_SENTINEL:-<promise>COMPLETE</promise>}"
BLOCKER_SENTINEL="${BLOCKER_SENTINEL:-<promise>BLOCKED</promise>}"
CLAUDE_CODE_MAX_OUTPUT_TOKENS="${CLAUDE_CODE_MAX_OUTPUT_TOKENS:-64000}"
export CLAUDE_CODE_MAX_OUTPUT_TOKENS

# Preflight
[ -f "$PROMPT_FILE" ] || { echo "ERROR: $PROMPT_FILE not found."; exit 1; }
command -v claude &>/dev/null || { echo "ERROR: claude CLI not found."; exit 1; }

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RALPH LOOP STARTING"
echo "  Prompt: $PROMPT_FILE"
echo "  Iterations: $ITERATIONS"
echo "  Permission: $PERMISSION_MODE"
echo "  Completion: $COMPLETION_SENTINEL"
echo "  Log: $LOG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

for ((i = 1; i <= ITERATIONS; i++)); do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo ""
    echo "┌─ Iteration $i / $ITERATIONS [$TIMESTAMP] ─────────────────"

    cat "$PROMPT_FILE" | claude --permission-mode "$PERMISSION_MODE" \
        -p | tee "$TMPFILE"

    EXIT_CODE=${PIPESTATUS[1]}
    echo "└─ Iteration $i complete (exit: $EXIT_CODE)"

    # Log to file (never read by agent)
    {
        echo ""
        echo "--- Iteration $i — $TIMESTAMP (exit: $EXIT_CODE) ---"
        echo ""
        cat "$TMPFILE"
    } >> "$LOG_FILE"

    # Check for plan completion
    if grep -qF "$COMPLETION_SENTINEL" "$TMPFILE"; then
        echo ""
        echo "Plan complete after $i iteration(s), exiting."
        exit 0
    fi

    # Check for blockers
    if grep -qF "$BLOCKER_SENTINEL" "$TMPFILE"; then
        echo ""
        echo "BLOCKER DETECTED — human intervention needed"
        echo "   Check $LOG_FILE for details"
        exit 1
    fi

    echo "   Continuing to next item..."
done

echo ""
echo "MAX ITERATIONS ($ITERATIONS) REACHED without completion"
echo "   Review $LOG_FILE for status"
exit 1
