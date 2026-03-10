# Project: Chase's House

## Stack & Architecture

- **Site**: Static personal website at **chases.house**
- **Tech**: Plain HTML/CSS/JS — no build step, no framework, no backend
- **Hosting**: GitHub Pages (push to `main` triggers deploy)
- **Domain**: chases.house (DNS via GoDaddy A records → GitHub Pages IPs)
- **Games**: Browser games in `games/` — each self-contained with inline CSS

## Folder Structure

```
/                     → Root (served by GitHub Pages)
├── index.html        → Home page (landing/hub)
├── styles.css        → Shared design tokens
├── CNAME             → Custom domain config
├── docs/             → Project documentation (not served)
│   ├── adr/          → Architecture decision records (one per feature)
│   └── screenshots/  → Visual test artifacts
└── games/            → Browser games
    ├── index.html    → Games gallery page
    ├── sudoku/       → Solo puzzle (reference for new games)
    ├── chess/        → Multi-file reference (window.ChessEngine pattern)
    ├── jeopardy/     → Multiplayer (Firebase Realtime DB)
    └── crossword/    → Solo puzzle (in development)
```

## Key Conventions

- Plain HTML/CSS/JS — no frameworks, no build steps
- All CSS inline in each game's HTML — no external CSS per game
- JS uses IIFE or `window.GameName` module pattern
- Dark theme: deep bg `#0a0a0b`, text `#f0e6d3`
- Design tokens in root `styles.css`: gold `#c8943e`, ember `#a06828`, terracotta `#b05a3a`
- Fonts: Fraunces (display), Bricolage Grotesque (body)
- Mobile-responsive designs
- No secrets or API keys in the repo (everything is public)

## Commands

```bash
python -m http.server 3003    # Local dev server (from repo root)
npx serve -p 3003             # Alternative dev server
node --check <file>.js        # JS syntax validation
```

## Available Custom Commands

- `/feature-dev` - Architecture planning at phase kick-off and before any new feature. Invoke BEFORE writing code.
- `/frontend-design` - UI component and screen work. Invoke BEFORE building any component or UI feature.

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

---

## Engineering Principles (enforced in priority order)

### 1. DRY - Don't Repeat Yourself [HIGHEST PRIORITY]

- Extract common logic into reusable functions immediately
- Centralize validation, parsing, and formatting logic
- If you write similar code twice, stop and refactor before continuing
- Before adding a function, search for existing utilities that already do it

### 2. YAGNI - You Aren't Gonna Need It

- Implement ONLY what is specified in the ADR or planning docs
- No future-proofing, speculative features, or extra config options "just in case"
- If it is not in `docs/adr/`, do not build it

### 3. SOLID Principles

- **S** - Single Responsibility: each function/module does one thing only
- **O** - Open/Closed: add behaviour via new code; do not modify working code
- **L** - Liskov Substitution: subtypes must be substitutable for their base types
- **I** - Interface Segregation: prefer small, focused interfaces over large general ones
- **D** - Dependency Inversion: depend on abstractions, not concrete implementations

### 4. KISS - Keep It Simple [LOWEST but still mandatory]

- Prefer obvious solutions over clever ones
- Readable code over compact code
- Avoid abstractions until they are needed by at least two concrete cases

---

## Architectural Decision Protocol

Invoke at every phase kick-off and any meaningful design fork (new game, shared utility, data format change). Do NOT apply to routine line-level implementation.

```
## Architectural Decision: [Short description]

DRY:   Is this logic duplicated elsewhere? -> [Yes/No + action]
YAGNI: Is this required by the ADR? -> [Yes/No + action]
SOLID: Does each unit have one responsibility? -> [Yes/No + action]
KISS:  Is there a simpler approach? -> [Yes/No + action]

Decision: [Proceed as planned / Refactor first / Descope]
```

---

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

## Context Hygiene Rules

- Never call `git diff` without `-- [specific file]` or `--stat`
- Never call `git log` without `--oneline -20` or similar limit
- `evaluate_script` must filter before returning (never return raw innerHTML)
- `list_network_requests`: check status codes only unless debugging
- `take_snapshot`: use default (non-verbose) unless diagnosing a11y

---

## Key Planning References

| Document | Path |
|----------|------|
| Site Plan | `docs/site-plan.md` |
| Chrome DevTools Guide | `docs/Chrome-DevTools-MCP-Guide.md` |
| ADR: Crossword | `docs/adr/010-crossword.md` |
| ADR: Jeopardy | `docs/adr/011-jeopardy.md` |
