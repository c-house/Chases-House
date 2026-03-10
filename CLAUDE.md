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
npx serve -p 300

```

## Chrome DevTools MCP - Testing Protocol

After building any UI component, page, or user flow:

1. Ensure the dev server is running
2. `navigate_page` -> target URL
3. `wait_for` -> confirm page has loaded (landmark element or heading)
4. `take_snapshot` -> inspect DOM structure, get UIDs for interaction
5. `take_screenshot` -> visually verify rendered output (save to `docs/screenshots/`)
6. `list_console_messages` with `types: ["error"]` -> fix ALL errors before continuing
7. `list_network_requests` -> confirm no 4xx/5xx responses
8. For interactive elements: `take_snapshot` -> `click(uid)` or `fill_form` -> verify result
9. For responsive: `resize_page` or `emulate` -> `take_screenshot`
10. Only proceed when: zero console errors, zero failed network requests, screenshot matches UX spec

**Critical rules:**
- Always `take_snapshot` BEFORE `click` or `fill` (UIDs are session-specific)
- Always `wait_for` after `navigate_page` (dynamic content may not be ready)
- Filter `list_console_messages` by `types: ["error"]` for token efficiency
- Use `evaluate_script` sparingly; filter results before returning
- `take_screenshot` with `fullPage: true` for layout verification
- Re-snapshot after any navigation (UIDs don't persist across page loads)

---

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

---

## Headless / Ralph Loop Mode

You are running inside a **bash loop**. Each iteration launches a fresh Claude session with a clean context window. The loop detects `<promise>COMPLETE</promise>` in your output to know the **entire plan is finished** and exits early.

When the prompt references an IMPLEMENTATION_PLAN.md, you are an autonomous coding agent:
- Do NOT summarize the plan. Do NOT ask questions. Do NOT present options or menus.
- Pick the **single** highest-priority unchecked `- [ ]` item, implement it, test it.
- **Exactly ONE item per session.** Even if other items look easy or already implemented, do NOT touch them. The next iteration will handle them.
- **Update IMPLEMENTATION_PLAN.md** — mark `[x]`, add `_Completed:` notes with what you built, key decisions, files changed. Move the item to the Done section. Use the Edit tool. **You MUST write to the file — terminal output alone is not sufficient.**
- **Commit** — make a git commit with a descriptive message. After this, STOP. The outer bash loop handles the next item in a fresh session.
- Your entire output should be about what you built and changed — never about what you could do or what the user might want.
- **Do NOT output `<promise>COMPLETE</promise>` unless the Todo section is empty.** The sentinel signals "plan finished" — not "iteration finished." The loop continues automatically without it.
- If all items already have `[x]`, output `<promise>COMPLETE</promise>` immediately and exit.

