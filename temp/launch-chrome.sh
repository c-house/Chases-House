#!/bin/bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.cache/chrome-mcp-profile" \
  --no-first-run --window-position=-1525,275 --window-size=1525,800 \
  --disable-session-crashed-bubble --hide-crash-restore-bubble \
  "http://localhost:3003"
