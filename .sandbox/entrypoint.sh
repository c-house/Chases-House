#!/usr/bin/env bash
set -euo pipefail

# --- Copy host credentials if mounted ---
if [[ -f /tmp/host-credentials ]]; then
  cp /tmp/host-credentials /home/node/.claude/.credentials.json
  chown node:node /home/node/.claude/.credentials.json
  echo "Credentials loaded from host mount."
fi
chown -R node:node /home/node/.claude

# --- Mark workspace as safe for git (ownership differs in container) ---
git config --system --add safe.directory /workspace

echo "Sandbox ready."
echo ""

# --- Drop privileges to node user and exec command ---
export HOME=/home/node
if [[ $# -gt 0 ]]; then
  exec setpriv --reuid=1000 --regid=1000 --init-groups -- "$@"
else
  exec setpriv --reuid=1000 --regid=1000 --init-groups -- /bin/bash
fi
