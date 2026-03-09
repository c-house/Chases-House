# CLAUDE.md - Chase's House

## Project Overview

Static personal website at **chases.house**, hosted on GitHub Pages.

- **Repo**: github.com/c-house/Chases-House
- **Tech**: Static HTML/CSS/JS — no build step, no backend
- **Deploy**: Push to `main` triggers automatic GitHub Pages deployment
- **Domain**: chases.house (DNS via GoDaddy A records → GitHub Pages IPs)

## Project Structure

```
/                     → Root (served by GitHub Pages)
├── index.html        → Home page (landing/hub)
├── CNAME             → Custom domain config
├── docs/             → Project documentation (not served)
│   ├── site-plan.md
│   ├── github-pages-capabilities.md
│   └── Chrome-DevTools-MCP-Guide.md
└── games/            → Browser games (planned)
```

## Development

### Local Dev Server

Use any static file server on port 3003:

```bash
# Python
python -m http.server 3003

# Node (npx)
npx serve -p 3003

# VS Code Live Server (configure port to 3003)
```

### Chrome DevTools MCP (REQUIRED for all browser interaction)

**IMPORTANT:** ALWAYS use the Chrome DevTools MCP to open, view, and interact with the website. NEVER use `start`, `open`, or other system commands to launch a browser. This applies to any request to "open the website", "show the page", "check the site", etc.

1. Start the local dev server (if not already running)
2. Launch the MCP-connected Chrome instance:

```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.cache/chrome-mcp-profile" \
  --no-first-run --window-position=-1525,275 --window-size=1525,800 \
  --disable-session-crashed-bubble --hide-crash-restore-bubble \
  "http://localhost:3003"
```

3. Use Chrome DevTools MCP tools to interact with the site:
- `take_screenshot` — verify UI/layout after changes. **Always save to `temp/screenshots/`** within the repo (e.g., `savePath: "temp/screenshots/my-screenshot.png"`). This ensures the MCP has write permissions without prompting.
- `take_snapshot` — inspect DOM structure and get element UIDs
- `list_console_messages` — check for JS errors
- `evaluate_script` — test JS in the browser context
- Always take a snapshot before using `click`/`fill` tools (need UIDs)

See [docs/Chrome-DevTools-MCP-Guide.md](docs/Chrome-DevTools-MCP-Guide.md) for full reference.

### CRITICAL: Development Principles

Implementation MUST adhere to these principles **in priority order**:

#### 1. DRY (Don't Repeat Yourself) - HIGHEST PRIORITY
- Extract common logic into reusable functions
- No copy-paste code between similar handlers
- Centralize validation, parsing, and formatting logic
- If you write similar code twice, refactor immediately

#### 2. YAGNI (You Aren't Gonna Need It)
- Implement ONLY what is specified in this ADR
- No "future-proofing" or speculative features
- No extra configuration options "just in case"
- If it's not in the requirements, don't build it

#### 3. SOLID Principles
- **S**ingle Responsibility: Each function/class does one thing
- **O**pen/Closed: Extend via new code, don't modify working code
- **L**iskov Substitution: Subtypes must be substitutable
- **I**nterface Segregation: Small, focused interfaces
- **D**ependency Inversion: Depend on abstractions, not concretions

#### 4. KISS (Keep It Simple, Stupid) - LOWEST PRIORITY (but still important)
- Prefer simple solutions over clever ones
- Readable code over compact code
- Obvious implementations over elegant abstractions

### CRITICAL: Tooling

Use `/feature-dev` for architecture planning and `/frontend-design` for any new UI components.

/feature-dev
/frontend-design

## Conventions

- Keep it simple: plain HTML/CSS/JS, no frameworks
- Dark theme (background: #0a0a0a, text: #fafafa)
- System font stack: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif
- Mobile-responsive designs
- No secrets or API keys in the repo (everything is public)

## Planned Features

- Games section (Tic Tac Toe, Checkers, more TBD)
- Future: blog, music/DJ tools, portfolio, links page

## Headless / Ralph Loop Mode

When the prompt references an IMPLEMENTATION_PLAN.md, you are an autonomous coding agent:
- Do NOT summarize the plan. Do NOT ask questions. Do NOT present options or menus.
- Pick the **single** highest-priority unchecked `- [ ]` item, implement it.
- **Exactly ONE item per session.** Even if other items look easy, do NOT touch them.
- **Update IMPLEMENTATION_PLAN.md** — mark `[x]`, add `_Completed:` notes with what you built, key decisions, files changed. Move the item to the Done section. Use the Edit tool.
- **Commit** — make a git commit with a descriptive message. After this, STOP.
- **Do NOT output `<promise>COMPLETE</promise>` unless the Todo section is empty.**
