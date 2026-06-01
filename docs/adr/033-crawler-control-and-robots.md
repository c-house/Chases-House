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
3. **Cloudflare Transform Rule** — the authoritative, zone-wide deindex.
4. **Cloudflare WAF "Block AI Bots"** — enforcement against crawlers that ignore `robots.txt`, with
   a `Claude-User` carve-out so the operator's tools are never blocked.

### Cloudflare config (dashboard-only — recorded verbatim for recoverability)

> These live only in the Cloudflare dashboard (no CF API token on this box). Recreate exactly:

- **Managed robots.txt:** Security → Settings → "Instruct AI bot traffic with robots.txt" = **ON**.
  *(Optional: set the `*` Content-Signal to `search=no` for intent consistency — advisory only.)*
- **Transform Rule** — Rules → Transform Rules → Modify Response Header → **Create**:
  - Name: `noindex all responses`
  - If: `http.host eq "chases.house"`
  - Then: **Set static** response header `X-Robots-Tag` = `noindex`
  - *(`nofollow` intentionally omitted — this hub links out to subsites; `noindex` alone suffices.)*
- **WAF "Block AI Bots"** — Security → Bots → "AI Scrapers and Crawlers" → **Block on all pages**.
  - **Carve-out** (so the operator's Claude tools aren't blocked) — WAF custom rule, action **Skip**
    (all remaining custom rules + Bot Fight Mode):
    `(http.user_agent contains "Claude-User")`
  - Documented rollback: if it still blocks the operator's tools, turn the toggle **off** —
    `robots.txt` + the `noindex` header alone still meet the goal.

## Scope (per-host)

Applies to the **chases.house zone** only. `files.chases.house` is behind Zero-Trust Access
(crawlers hit the auth wall — already unindexable; its public front-end at `chases.house/files/` is
covered by the header). `thewiseguy.ai` (Music) is a **separate zone** and needs its own policy if
desired — out of scope. Lookout/Shopping "coming-soon" spans live on chases.house (covered); their
tunneled targets, when live, need their own robots.

## Verification

- Live `robots.txt` = managed AI block **+** the repo `Claude-User` group (after cache purge of
  `https://chases.house/robots.txt`).
- `curl -I https://chases.house/` (and a sub-page + an asset) shows `X-Robots-Tag: noindex`.
- A Claude Code `WebFetch https://chases.house/` returns **200** (UA `Claude-User …` not blocked).

## Rollback

Delete repo `robots.txt`; remove the Transform Rule; turn off "Block AI Bots". Managed robots.txt
reverts to being the sole (Cloudflare-generated) file.

## Addendum — 2026-05-31 (as-built + verification)

Executed end-to-end via Chrome DevTools MCP against the chases.house zone
(account `0ee1273a5cee6fea6a5a5a66666c8df6`). Deltas from the plan above:

- **Transform Rule** created exactly as specified (`http.host eq "chases.house"` →
  Set static `X-Robots-Tag: noindex`). Verified live: `noindex` returns on the homepage,
  `/games/`, and `styles.css`. **`nofollow` was not added** (per the plan).
- **Managed robots.txt — search signal flipped to `no`.** Via Security → Settings → Bots →
  *Manage robots.txt*, set "Search engines: **Block**". Confirmed via the panel's Preview that
  this only changes the wildcard group to `Content-Signal: search=no,ai-train=no` and **keeps
  `Allow: /`** — it does *not* add a crawl-blocking `Disallow`, so Googlebot still crawls and
  reads the `noindex` header (no deindex trap). "Block AI input" left **unchecked** so the
  operator's real-time Claude fetches aren't signaled against.
- **WAF "Block AI Bots"** enabled, "Block on all pages". **No `Claude-User` Skip rule was
  needed:** a real fetch from Anthropic infrastructure (`WebFetch`, UA `Claude-User …`) returned
  the normal site (HTTP 200), confirming Cloudflare does not classify `Claude-User` as a blocked
  AI crawler. The Skip rule (`http.user_agent contains "Claude-User"`, action Skip) remains the
  documented remedy **only if** CF later reclassifies it.
- **No cache purge applies.** `chases.house/robots.txt` is `Cf-Cache-Status: DYNAMIC` — generated
  per-request by managed-robots, not edge-cached. The origin (repo) file is **appended below**
  the managed block; getting the newly-added origin file to merge required clicking **Save** in
  the Manage robots.txt panel (which re-runs origin detection). For future repo `robots.txt`
  edits: if the change doesn't appear, re-save that panel to force re-detection.
- **Live merged result verified:** managed block (`search=no,ai-train=no`; `Disallow: /` for
  Amazonbot, Applebot-Extended, Bytespider, CCBot, ClaudeBot, CloudflareBrowserRenderingCrawler,
  Google-Extended, GPTBot, meta-externalagent) **+** the origin `User-agent: Claude-User` /
  `Disallow:` (allow) group.
