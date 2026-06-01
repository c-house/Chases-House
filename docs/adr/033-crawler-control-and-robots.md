# ADR-033 — Crawler control: robots.txt, noindex, and AI-bot blocking

**Status:** Accepted, 2026-05-31.

## Context

chases.house had **no crawler control in the repo** — no `robots.txt`, `sitemap.xml`,
`<meta robots>`, or canonical tags. Yet a `robots.txt` *did* serve live, because **Cloudflare's
"managed robots.txt"** was toggled on for the zone and was generating one (a `User-agent: *` group
with `Content-Signal: search=yes,ai-train=no`, plus `Disallow: /` for the major AI training
crawlers). That state (a) was invisible from git, and (b) actively *invited* search indexing
(`search=yes`), the opposite of what the operator wants.

Goal: keep the site **out of search results** (privacy) while staying publicly reachable by humans;
**block AI training crawlers** but **never block the operator's own Claude tools**.

Crawler control is **per-host and per-layer**:

| Layer | Role |
|---|---|
| **GoDaddy (DNS)** | A-records → GitHub Pages. **No role** in crawler control. |
| **GitHub Pages** | Serves `robots.txt`/`sitemap.xml` from the repo root, but **cannot emit custom HTTP headers** (so no origin `X-Robots-Tag`). See `docs/misc/github-pages-capabilities.md`. |
| **Cloudflare** | The only place that can inject response headers and run WAF enforcement; also supplies an auto-updating managed AI-crawler blocklist. |

Load-bearing facts:
- `robots.txt` and Cloudflare's `Content-Signal` field are **advisory** and **cannot deindex**.
  `Content-Signal` is an unratified proposal that Google does **not** act on. The **only** mechanism
  with confirmed search-removal effect is **`noindex`** (`X-Robots-Tag` header or `<meta robots>`).
- A `noindex` directive is only honored if the page stays **crawlable** — so we must **not**
  `Disallow` anything we want kept out of the index. A zone-wide `noindex` header covers every path.
- Cloudflare **prepends** its managed block above an origin `robots.txt`, so the repo file must not
  define its own `User-agent: *` group (that would create a conflicting second wildcard group).
- Anthropic UAs: **`ClaudeBot`** = training crawler (must stay blocked); **`Claude-User`** =
  operator-initiated fetch (must stay allowed). Verified literal UA from Claude Code's WebFetch:
  `Claude-User (claude-code/2.1.158; +https://support.anthropic.com/)`.

## Decision

Separation of concerns — **repo = git-tracked policy anchor**, **Cloudflare = enforcement +
auto-updating AI blocklist**, **header = the actual deindex**:

1. **Repo `robots.txt`** (root): no `User-agent: *` group, no path `Disallow`s. Just an explicit
   allow for `Claude-User` and a comment pointing here. No `sitemap.xml` (we discourage discovery).
   - Path `Disallow`s were deliberately **rejected**: the paths (`/docs/`, `/ralph/`, `/temp/`, game
     tool pages) are public files in a public repo, so a `Disallow` gives zero privacy, *advertises*
     the paths, and would *prevent* the `noindex` header from reaching them. The header covers them.
2. **Cloudflare managed robots.txt: leave ON** — its AI-bot list auto-updates, which a hand-kept
   repo list would not. The repo's no-wildcard design means the two files compose without conflict.
3. **Cloudflare Transform Rule** — the authoritative, zone-wide deindex (`X-Robots-Tag: noindex`).
4. **Cloudflare WAF "Block AI Bots"** — was intended as enforcement against crawlers that ignore
   `robots.txt`, but it blocked the operator's own `Claude-User` tools and the free plan offered no
   reliable per-UA skip, so it is **left OFF** (see addendum). robots.txt's AI disallows remain the
   declared AI policy; reputable AI crawlers honor them.

### Cloudflare config (dashboard-only — recorded verbatim for recoverability)

> These live only in the Cloudflare dashboard (no CF API token on this box). Recreate exactly:

- **Managed robots.txt:** AI Crawl Control → Overview → "Managed robots.txt" = **ON**. To also set
  the search signal, use AI Crawl Control → *Manage robots.txt* → Search engines = **Block**.
- **Transform Rule** — Rules → Transform Rules → Modify Response Header → **Create** ("Add static
  header to response"):
  - Name: `noindex all responses`
  - If: `http.host eq "chases.house"`
  - Then: **Set static** response header `X-Robots-Tag` = `noindex`
  - *(`nofollow` intentionally omitted — this hub links out to subsites; `noindex` alone suffices.)*
- **WAF "Block AI Bots"** (Security → Settings → Bots) — currently **OFF / "Do not block"** (see
  addendum for why). If ever re-enabled, pair it with a tested WAF Skip rule
  `(http.user_agent contains "Claude-User")` verified against a real Anthropic-infra fetch.

## Scope (per-host)

Applies to the **chases.house zone** only. `files.chases.house` is behind Zero-Trust Access
(crawlers hit the auth wall — already unindexable; its public front-end at `chases.house/files/` is
covered by the header). `thewiseguy.ai` (Music) is a **separate zone** and needs its own policy if
desired — out of scope. Lookout/Shopping "coming-soon" spans live on chases.house (covered); their
tunneled targets, when live, need their own robots.

## Rollback

Delete repo `robots.txt`; remove the `noindex all responses` Transform Rule (once created); reset
the managed robots.txt Search-engines control to Allow. (WAF "Block AI Bots" is already off.)
Managed robots.txt then reverts to being the sole (Cloudflare-generated) file with `search=yes`.

## Addendum — 2026-05-31 (as-built status — PARTIAL; curl-verified)

Driven via Chrome DevTools MCP against the chases.house zone
(account `0ee1273a5cee6fea6a5a5a66666c8df6`) over a **shared** browser, which made dashboard
automation unreliable. Status below is what `curl` confirms — **not** dashboard optimism. (Earlier
drafts of this addendum twice claimed completion prematurely; this is the corrected record.)

**Done & curl-verified:**
- **Repo `robots.txt` is live and merged** below the managed block. `curl https://chases.house/robots.txt`
  shows the managed AI-crawler `Disallow: /` set (Amazonbot, Applebot-Extended, Bytespider, CCBot,
  ClaudeBot, CloudflareBrowserRenderingCrawler, Google-Extended, GPTBot, meta-externalagent) followed
  by the origin `User-agent: Claude-User` / `Disallow:` (allow) group. Served `Cf-Cache-Status:
  DYNAMIC` (not edge-cached; no purge applies).
- **WAF "Block AI Bots" turned OFF** ("Do not block"). It had been enabled ("Block on all pages") and
  was returning **HTTP 403 to `Claude-User`** (the operator's own tools) and to `GPTBot`. The free
  plan offered no reliable per-UA skip, so it was disabled. After disabling, `curl` confirms
  `Claude-User`, `GPTBot`, and a plain browser UA all return **200**.

**NOT done — still required to meet the privacy goal (and blocking automation):**
- **Transform Rule `X-Robots-Tag: noindex` — NOT created.** `curl -I https://chases.house/` shows
  **no** `X-Robots-Tag` header on `/`, `/games/`, `/styles.css`, or `/files/`. This is the only
  mechanism that actually deindexes, so **the site is NOT yet protected from search indexing.**
  The create-rule form (Rules → Transform Rules → Modify Response Header → "Add static header to
  response") has no stable element handles for MCP fill/click on the shared browser; the form was
  reached but not completed.
- **Managed Content-Signal still `search=yes`.** The Manage-robots.txt "Search engines → Block"
  toggle did not save; live file still reads `Content-Signal: search=yes,ai-train=no` (advisory only,
  so not load-bearing — but should be flipped for intent consistency).

**Lessons:** (1) the assumption that `Claude-User` would pass Block-AI-Bots was wrong — verify per-UA
behavior with a real fetch before relying on any WAF bot rule. (2) Driving the CF dashboard via MCP on
a browser shared with other sessions is unreliable; prefer a dedicated browser/profile or guided
manual clicks for the remaining two steps.