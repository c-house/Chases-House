# Project: Chase's House

## Stack & Architecture

- **Site**: Static personal website at **chases.house**
- **Tech**: Plain HTML/CSS/JS — no build step, no framework, no backend
- **Hosting**: GitHub Pages (push to `main` triggers deploy). Static assets sit behind a Cloudflare cache (up to ~4h stale) — purge the changed asset URL after deploy via the CF dashboard's Custom Purge (no CF API token on this box and dash-session API writes 403 — see "Cloudflare Dashboard via Chrome DevTools MCP")
- **Domain**: chases.house (DNS via GoDaddy A records → GitHub Pages IPs)
- **Games**: Browser games in `games/` — each self-contained with inline CSS
- **Subsites**: Some nav links (Music → thewiseguy.ai, Lookout) point to Cloudflare-tunneled services hosted off-repo; `files.chases.house` is another tunneled subsite (ADR-013). This repo carries only their nav links / static front-ends, not the tunnels
- **Crawler control** (ADR-033, *deindex LIVE & curl-verified*): the site is kept out of search results by a Cloudflare **`X-Robots-Tag: noindex`** Response-Header Transform Rule (matches all incoming requests; rule id `9eb681edc71243098b7be69df71bfda9`) — the authoritative deindex, since GitHub Pages can't emit headers. A thin repo `robots.txt` (allows `Claude-User`) is **appended below** Cloudflare managed-robots' auto-updating AI-crawler block. WAF "Block AI Bots" is **off** (`ai_bots_protection: disabled`) — it 403'd the operator's own `Claude-User` tools and the free plan gave no reliable per-UA skip; re-enable only with a verified `(http.user_agent contains "Claude-User")` Skip rule. One advisory item left manual: flip managed Content-Signal `search=yes`→`search=no` (AI Crawl Control → Manage robots.txt) — cosmetic only, the header does the real work. `chases.house/robots.txt` is served **dynamically** (`Cf-Cache-Status: DYNAMIC`) — not cache-purgeable; if a repo `robots.txt` edit doesn't appear live, re-save the **Manage robots.txt** panel to force origin re-detection. **In the current CF dashboard, Transform Rules live under Rules → Overview** (no dedicated nav item); the SPA churns element IDs so MCP DOM-automation needs fresh per-call DOM queries + React native value-setter (the Rulesets API rejects plain-fetch writes with 403/CSRF). Full rule spec in ADR-033

## Folder Structure

```
/                     → Root (served by GitHub Pages)
├── index.html        → Home page (landing/hub)
├── styles.css        → Shared design tokens
├── CNAME             → Custom domain config
├── nav-health.js     → Shared nav-link health-probe (enableNavWhenLive); lights up
│                       "coming-soon" nav spans when their tunneled subsite returns
│                       200 on /health. New subsite nav = one call here. See ADR-024
├── docs/             → Project documentation (not served)
│   ├── adr/          → Architecture decision records (one per feature; point-in-time —
│   │                   append a dated `## Addendum — YYYY-MM-DD`, don't rewrite the body)
│   └── screenshots/  → Local verification artifacts (gitignored)
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
python -m http.server 3030    # Local dev server (from repo root) — port 3030, see Reserved Dev Ports
npx serve -p 3030             # Alternative dev server
node --check <file>.js        # JS syntax validation
```

- **Firebase (anonymous auth + RTDB writes) only works from allowlisted referrers** — the dev port `localhost:3030` and `chases.house/*` (ADR-017 API-key HTTP-referrer restriction; the legacy `localhost:3003` is still allowlisted too). A dev server on any *other* port throws `auth/requests-from-referer-http://localhost:<port>-are-blocked` at the gateway — it reads like a rules/`PERMISSION_DENIED` denial but is not. Serve dev on **3030**, or run the write from the live site (`chases.house`).

## Reserved Dev Ports

**Chases House dev server → `3030`** (repo root; serves *all* games from one server). Migrated off `3003` on 2026-07-24 because `3003` collides with Smart-Shopper's docker web; the Firebase referrer allowlist now includes `localhost:3030` (ADR-017). Serve with the Commands above — do not hand-pick another port.

**Do NOT bind these — claimed by sibling `~/Projects` repos (collisions break their active sessions):**

| Port | Owner |
|---|---|
| 3000 | shared default (AI-Hub, Doorbell-AI, Map, Smart-Lock, Web-DnD, WebDJ) |
| 3001 | Doorbell-AI tunnel |
| 3002 | WebDJ tunnel (thewiseguy.ai / dj.chases.house) |
| 3003 | Smart-Shopper web (docker) — Chases House's *former* dev port |
| 3004 | The Lookout tunnel |
| 5173 | Vite default (Web-DnD is the usual active session, + Orrery, others) |
| 5180 | MyCraft (mcstructure-studio) |
| 5432 / 5433 | Postgres / Docker |
| 8765 | files-vault tunnel / pokemon-agent |
| 9222 | Chrome DevTools MCP debugger (runs on the Web-DnD chrome profile) |

## Deploy & Cache Verification (post-push)

- **Verify live bytes against the git blob, never the working tree.** `core.autocrlf=true` → working tree is CRLF, git blobs and Pages both serve LF. Use `curl -sS <url> | md5sum` vs `git show HEAD:<path> | md5sum`; comparing to the on-disk file reports false STALE on every CRLF file. Same root cause: after a harness run `tools/curves/*.csv` show porcelain-modified with an *empty* `git diff` — assert byte-stability on content (`git diff`), not `git status --porcelain`.
- Only `games/**` HTML/JS is browser-served and needs purging; `docs/**.md`, `tools/*.cjs`, `tools/curves/*.csv` are Node-only.
- Purge fired ⇔ `cf-cache-status` flips `HIT`→`MISS` on the next curl. The dashboard shows no success toast either way — the curl is the only confirmation.

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

## Chrome DevTools MCP - Launch Command

The user launches Chrome (not Claude) before MCP can attach. If
`mcp__chrome-devtools__*` tools are absent from a session, ask the
user to run:

```
"/c/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9222 --user-data-dir="C:\Users\chase\Projects\Web-DnD\chrome-mcp-profile" --no-first-run --no-default-browser-check --start-fullscreen --disable-session-crashed-bubble --hide-crash-restore-bubble
```

Notes: port `9222`. The `user-data-dir` lives under `Web-DnD/`
(NOT this repo) — reused across the user's projects. Do not
auto-launch Chrome from Claude; it's a shared-system side effect.

---

## Chrome DevTools MCP - Testing Protocol

After building any UI component, page, or user flow:

1. Ensure the dev server is running
2. `navigate_page` -> target URL
3. `wait_for` -> confirm page has loaded (landmark element or heading)
4. `take_snapshot` -> inspect DOM structure, get UIDs for interaction
5. `take_screenshot` -> visually verify rendered output (save to `docs/screenshots/` — gitignored, local-only)
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

## Cloudflare Dashboard via Chrome DevTools MCP

- Zone `chases.house` = `652a4b42e13da393ab5696d88737aa09`; account = `0ee1273a5cee6fea6a5a5a66666c8df6`. Purge panel: `/<account>/chases.house/caching/configuration` → Custom Purge → URL (`purge_by: files`, ≤30 URLs).
- **Dash-session `fetch` writes 403 (CSRF) — confirmed for `purge_cache`, not just Rulesets.** GET (`/api/v4/zones?name=…`) works fine with session cookies. Don't retry the API for writes; drive the UI.
- **Native value-setter alone will NOT enable a submit button** — nor will synthetic `input`/`change`, nor calling React's `onChange` prop directly. Working recipe: set the value *minus its last character* via the native setter, then send **one real key event** (`press_key`) for the final char. React's root listener only trusts genuine CDP input.
- The MCP Chrome uses its own profile (`chrome-mcp-profile/`), so it has a separate CF session — the operator must log in there once; Claude cannot.

---

## Context Hygiene Rules

- Never call `git diff` without `-- [specific file]` or `--stat`
- Never call `git log` without `--oneline -20` or similar limit
- `evaluate_script` must filter before returning (never return raw innerHTML)
- `list_network_requests`: check status codes only unless debugging
- `take_snapshot`: use default (non-verbose) unless diagnosing a11y
- Stage explicit paths (`git add <files>`), never `git add -A` — the tree accumulates other-session artifacts, design dumps, and large zips; `-A` has swept a 48 MB zip into a commit here. `*.zip` is gitignored
- Infra/deploy work (Cloudflare, DNS, Pages): the dashboard showing success ≠ it being live. `curl`-verify the real effect (header / status / robots.txt) BEFORE writing any "done"/"verified" claim in docs or a commit

---

## Key Planning References

| Document | Path |
|----------|------|
| Site Plan | `docs/site-plan.md` |
| Chrome DevTools Guide | `docs/Chrome-DevTools-MCP-Guide.md` |
| ADR: Crossword | `docs/adr/010-crossword.md` |
| ADR: Jeopardy | `docs/adr/011-jeopardy.md` |
| ADR: Lookout nav + health helper | `docs/adr/024-lookout-nav-and-shared-health-helper.md` |

---

## Agentic Feature Workflow (hostile + unprecedented work)

For high-stakes feature work with both characteristics:

- **Hostile** — high cost of getting it wrong (security, data integrity, performance budgets, production interfaces).
- **Unprecedented** — limited precedent in this codebase or the ecosystem; no existing pattern to copy.

Apply the protocol documented in [`.claude/shared/agentic-feature-workflow.md`](.claude/shared/agentic-feature-workflow.md). Skip the ceremony for routine work (bug fixes, single-hook tweaks, established patterns) — plan mode → direct agent execution is enough.

**Phase map (condensed):**

| Phase | Step | Tool | Fresh ctx |
|---|---|---|---|
| 0 Recon | 1-2. Map terrain, constraints inventory | Direct agent | — |
| 1 Design | 3-4. Plan-mode draft + pushback | Plan mode | — |
| | 5. Adversarial review #1 | `/review-plan` | **yes** |
| | 6. Refine + adversarial review #2 | Plan mode + `/review-plan` | **yes** |
| | 7. Serialize plan → spec doc (contract) | Direct agent | — |
| 2 Build | 8-9. `/feature-dev` with per-task checkpoints (~200 lines / 3 files budget) | feature-dev | — |
| | 10. Verify; manually exercise hostile scenarios | feature-dev + manual | — |
| Debug | D1-D6. Isolate → diagnose → minimum-change fix → regression test | Fresh agent for D1-D2 | **yes** |
| 3 Harden | 11. Adversarial diff review | Fresh agent | **yes** |
| | 12. Stress the unprecedented bits | Manual + agent | — |
| | 13. ADR (≤1 page, ~400 words) | Direct agent | — |

**Hard rules:**
- Two adversarial passes for hostile/unprecedented work; a third has diminishing returns.
- Brief reviewers on the plan, not the justifications. Rationale biases the attack.
- Spec is a contract, not an explanation. Rationale belongs in the ADR.
- Workers implement exactly what the spec specifies. Missing piece → STOP and report.
- Minimum-change fixes only. Other improvements get listed as follow-ups, not bundled.
- Read every diff at every task boundary. No batch approval.

Full protocol with guardrail phrases (paste into prompts), signal table for misdirected thinking, and deviation rules → [`.claude/shared/agentic-feature-workflow.md`](.claude/shared/agentic-feature-workflow.md).

---

## Blender MCP (for asset work)

Blender MCP is configured in `.mcp.json` as `blender-community` (port 9877). Requires Blender running locally with the [community MCP add-on](https://github.com/ahujasid/blender-mcp) enabled. Use the `blender-mcp` and `blender-scene` skills for scene-build, asset import (Poly Haven / Sketchfab / Hyper3D / Hunyuan3D), and render workflows.

Primary use case in this repo: sourcing CC0 enemy/decoration assets for Castle Tower Defense 3D from Quaternius / KayKit / Kenney kits, retopologizing to the Kenney castle-kit silhouette, and exporting to `games/castle-tower-defense/assets/models/`.
