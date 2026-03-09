#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

PROMPT_FILE="${PROMPT_FILE:-$SCRIPT_DIR/PROMPT_BUILD.md}"
PERMISSION_MODE="${PERMISSION_MODE:-acceptEdits}"
LOG_FILE="${LOG_FILE:-$SCRIPT_DIR/ralph-games.log}"

# Preflight
[ -f "$PROMPT_FILE" ] || { echo "ERROR: $PROMPT_FILE not found."; exit 1; }

TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

cat "$PROMPT_FILE" | claude --permission-mode "$PERMISSION_MODE" \
    -p | tee "$TMPFILE"

# Log to file (never read by agent)
{
    echo ""
    echo "--- Run — $(date '+%Y-%m-%d %H:%M:%S') ---"
    echo ""
    cat "$TMPFILE"
} >> "$LOG_FILE"