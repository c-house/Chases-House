#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# ─── Paths ────────────────────────────────────────────────────────
PROMPT_FILE="$SCRIPT_DIR/PROMPT_BUILD.md"
LOG_FILE="$SCRIPT_DIR/ralph-crossword.log"

# ─── Configuration ────────────────────────────────────────────────
MAX_ITERATIONS="${1:-20}"
PERMISSION_MODE="${PERMISSION_MODE:-acceptEdits}"
DANGEROUSLY_SKIP_PERMISSIONS="${DANGEROUSLY_SKIP_PERMISSIONS:-false}"
COMPLETION_SENTINEL="<promise>COMPLETE</promise>"
BLOCKER_SENTINEL="<promise>BLOCKED</promise>"
export CLAUDE_CODE_MAX_OUTPUT_TOKENS="${CLAUDE_CODE_MAX_OUTPUT_TOKENS:-64000}"
ITERATION=0

# ─── Preflight checks ─────────────────────────────────────────────
[ -f "$PROMPT_FILE" ] || { echo "ERROR: $PROMPT_FILE not found."; exit 1; }
command -v claude &>/dev/null || { echo "ERROR: claude CLI not found. Install it first."; exit 1; }

# ─── Build the claude command ────────────────────────────────────
if [[ "$DANGEROUSLY_SKIP_PERMISSIONS" == "true" ]]; then
    CLAUDE_ARGS=(--dangerously-skip-permissions -p)
else
    CLAUDE_ARGS=(--permission-mode "$PERMISSION_MODE" -p)
fi

CLAUDE_CMD="cat \"$PROMPT_FILE\" | claude ${CLAUDE_ARGS[*]}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RALPH LOOP STARTING"
echo "  Max iterations: $MAX_ITERATIONS"
echo "  Log: $LOG_FILE"
echo ""
echo "  Run manually:"
echo "    cd $REPO_ROOT"
echo "    $CLAUDE_CMD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── Main loop ────────────────────────────────────────────────────
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
    ITERATION=$((ITERATION + 1))
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    echo ""
    echo "┌─ Iteration $ITERATION / $MAX_ITERATIONS [$TIMESTAMP] ─────────────────"

    cat "$PROMPT_FILE" | claude "${CLAUDE_ARGS[@]}" | tee "$TMPFILE"

    EXIT_CODE=${PIPESTATUS[1]}
    echo "└─ Iteration $ITERATION complete (exit: $EXIT_CODE)"

    # Log to file (never read by agent)
    {
        echo ""
        echo "--- Iteration $ITERATION — $TIMESTAMP (exit: $EXIT_CODE) ---"
        echo ""
        cat "$TMPFILE"
    } >> "$LOG_FILE"

    # Check for plan completion
    if grep -qF "$COMPLETION_SENTINEL" "$TMPFILE"; then
        echo ""
        echo "Plan complete after $ITERATION iteration(s)."
        break
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

if [ $ITERATION -ge $MAX_ITERATIONS ]; then
    echo ""
    echo "MAX ITERATIONS ($MAX_ITERATIONS) REACHED without completion"
    echo "   Review $LOG_FILE for status"
    exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  RALPH LOOP FINISHED in $ITERATION iteration(s)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
