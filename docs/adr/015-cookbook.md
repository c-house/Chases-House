# ADR-015: Cookbook

**Status**: Accepted
**Date**: 2026-04-23

## Context

The Family Cookbook was designed and built as a standalone prototype in `~/Downloads/Family Cookbook/` — a React-via-CDN, no-build app with a warm "rustic kitchen" aesthetic. It contains seven family recipes (lemon garlic tenderloin from Genevieve Pavlik, Wanda Hankus's lasagna, Sunday roast chicken, weeknight chili, brown butter chocolate chip cookies, tall buttermilk pancakes, three-cheese baked mac) with features you don't get out of a PDF or a Notion page:

- Live serving-size scaling (stepper → all ingredient amounts recompute, step text inlines the scaled value)
- Ingredient-tag filter chips (protein / vegetable / pantry / brightness) and full-text search across title/author/ingredients/steps
- Favorites, personal notes, and checked-off ingredients/steps, all persisted per-recipe in `localStorage`
- Cook mode — one giant step at a time, wake-lock so the screen doesn't dim, progress bar across the bottom

Goal: bring it into `chases.house` as a first-class section alongside Games and Files, without disturbing its paper-and-ink aesthetic and without introducing a build step.

## Decision

Migrated the prototype verbatim into `cookbook/` at the repo root. No code refactor — the source already matches the site's conventions perfectly.

### Why it fits as-is

The prototype's shape maps one-to-one onto the chases.house architecture:

| chases.house convention | Family Cookbook prototype |
|---|---|
| Static HTML/CSS/JS, no build | React + Babel-standalone via CDN, no build |
| IIFE or `window.GameName` modules | `window.RECIPES` / `window.RLib` / `window.RusticApp`, rustic.jsx wrapped in IIFE |
| Inline CSS per game | Rustic styles injected into `<head>` at runtime under `.rustic` scope |
| Each section is a self-contained experience with its own aesthetic | Cookbook owns its cream-paper palette; site chrome doesn't leak in |
| Game directories carry their own `data/`, `lib/`, etc. (see Chess's multi-file pattern) | `cookbook/data/`, `cookbook/lib/`, `cookbook/directions/` preserved |

Because the stylesheet is scoped under a `.rustic` wrapper class, there's no style leakage back to the dark chases.house chrome on other pages — same insulation pattern the games already rely on.

### File mapping

| Source (`~/Downloads/Family Cookbook/`) | Destination (`chases.house/`) |
|---|---|
| `Family Cookbook.html` | `cookbook/index.html` |
| `data/recipes.js` | `cookbook/data/recipes.js` |
| `lib/recipe-lib.js` | `cookbook/lib/recipe-lib.js` |
| `directions/rustic.jsx` | `cookbook/directions/rustic.jsx` |

Skipped: `.design-canvas.state.json` (design-tool state), `uploads/*.md` (the source markdown the recipes were transcribed from — source material, not runtime artifacts).

### Site integration

- **Nav** — Added `Cookbook` link at position 2 (live routes grouped at the front) across `index.html`, `games/index.html`, and `files/index.html`; re-numbered the `--i` CSS variables so the staggered fade-in cadence stays smooth with the now-seven-item nav.
- **Home** — Added a second `.room-card` to the homepage "rooms" section. The section was previously block-layout with a single card; made it `display: flex; flex-wrap: wrap; gap` so multiple cards sit side-by-side on desktop and stack cleanly on mobile (the existing mobile media query already recenters, so responsive behavior is preserved).
- **No changes to cookbook internals** — `index.html`, `data/recipes.js`, `lib/recipe-lib.js`, `directions/rustic.jsx` are byte-for-byte the prototype.

### DNS

The cookbook lives at `chases.house/cookbook/`. Considered a `cookbook.chases.house` subdomain, rejected because:

1. **Matches existing pattern** — `/games/`, `/files/`, `/cookbook/`. Path-based across the board.
2. **Zero DNS work** — the apex `chases.house` CNAME already points to GitHub Pages; a subdomain would need a new A/CNAME record in GoDaddy and either (a) a second repo with its own Pages site or (b) a proxy, because user.github.io sites serve from one root only.
3. **One deploy, one domain** — KISS. Push to `main` and everything ships.
4. **Not a separate product** — it's Chase's family cookbook on Chase's site. Subdomains make sense for products with independent audiences; this is one house with many rooms.

If the cookbook ever warrants independent identity, promotion to a subdomain is a `CNAME` record + 301 redirect away.

## Files Changed

**New:**
- `cookbook/index.html` — Page shell (React 18 + Babel 7 via UMD CDN, Google Fonts for Cormorant Garamond / Lora / Caveat / IBM Plex Mono)
- `cookbook/data/recipes.js` — 7 recipes with normalized per-serving amounts and `{i:N}` ingredient-reference tokens in step text
- `cookbook/lib/recipe-lib.js` — Amount formatting (unicode fractions ½ ⅓ ¾), scaling, search, tag filtering, `useLocalState` hook
- `cookbook/directions/rustic.jsx` — Home / Recipe / Cook-mode screens, wrapped in an IIFE, exposes `window.RusticApp`
- `docs/adr/015-cookbook.md` — This document

**Modified:**
- `index.html` — Added Cookbook nav link + room card; made `.rooms` flex-wrap
- `games/index.html` — Added Cookbook nav link (re-indexed)
- `files/index.html` — Added Cookbook nav link (re-indexed)

## Addendum — 2026-04-23 (recipe expansion)

Three more recipes transcribed from `~/Downloads/*.docx.md` source files and folded into the cookbook. Two of them introduced categories the original four (Mains / Sides / Breakfast / Desserts) didn't cover:

- **Fried Artichoke Hearts with Garlic Aioli** (Tasty Kitchen) → new **Appetizers** category
- **Yum Yum Sauce** (Jason's BBQ Adventures) → new **Sauces** category
- **Blueberry Ice Cream with Optional Crisp** (Riverside Len / Food.com) → existing **Desserts**

### Category expansion

`Appetizers` and `Sauces` added to two places so the new recipes land in their own tab instead of the `Other` catch-all:

- `cookbook/directions/rustic.jsx:323` — `categories` array drives the tab strip
- `cookbook/lib/recipe-lib.js:99` — `groupByCategory` default `order` drives the grouping on the home view

Kept insertion order low-churn: `['All', 'Mains', 'Sides', 'Appetizers', 'Sauces', 'Breakfast', 'Desserts']`. Savory-savory-savory-light-sweet flow matches a menu.

### Image handling

The source `.docx.md` files embed the recipe photos as base64 `data:image/png;base64,...` references at the bottom of each file. Decoded once with a throwaway Python script (`base64.b64decode` per `[imageN]:` reference line) and written to `cookbook/images/<recipe-id>/image1.png`. Script was removed after use — it's a one-shot import, not a build step. Same image-folder convention the `keller-chicken` and `pot-roast` recipes already use; `photo` field on each recipe is a relative path.

### Verification

- `node --check` clean on `recipes.js` and `recipe-lib.js`
- Load-test via Node: all 13 recipes parse; new entries carry expected category / ingredient count / step count / photo path
- Dev server (`python -m http.server 3003`) returned 200 for `/cookbook/` and for each new `cookbook/images/<id>/image1.png`
- Did **not** click through the rendered UI (Chrome DevTools MCP wasn't reachable this session) — follow-up task if anything looks off in the browser

## Verification

- Page loads cleanly at `/cookbook/` — masthead renders, category tabs, filter chips, seven recipe cards populated across Mains / Breakfast / Sides / Desserts
- Opening a recipe: hero photo, ingredient list, numbered directions with ingredient references inlined, print / save / back affordances
- Serving-size stepper: decrement/increment recomputes every ingredient amount (and the inlined step references) live
- Cook mode: step-by-step view with progress bar, next/previous, mark-done, wake-lock acquired if browser supports it
- Search filters recipes across title/author/ingredients/steps; tag chips filter with AND logic
- Favorites, notes, checked ingredients, checked steps persist across reloads under `rustic:*` localStorage keys
- Zero console errors, zero failed network requests (Google Fonts, unpkg React/Babel, Unsplash photos all 200)
- Nav link on homepage, games, and files all point to `/cookbook/`; homepage room card renders alongside Games

## Addendum — 2026-09-13 (mobile layout)

The cookbook shipped desktop-only. On a Pixel 6 (412 CSS px) a recipe page was unusable: the recipe body is a `340px 1fr` grid with a 56px gap inside 56px page padding, so the ingredient rail alone consumed the viewport and pushed Directions off-screen to the right, with the "start cook mode" button clipped at the edge. Display type was fixed-pixel (84px masthead, 64px recipe title, 120px cook-mode step number) and every layout value lived in a JSX inline `style`, where no media query can reach it.

### Decision

Move the layout-bearing values out of inline styles into the injected `#rustic-styles` sheet under named classes, then let two media queries override them. Inline styles stay for one-off decoration (colours, borders, margins) — only what needs to respond moved.

Classes added: `.rustic-page(.home|.recipe)`, `.rustic-searchbar`, `.rustic-tabs`, `.rustic-card-grid`, `.rustic-actionbar`, `.rustic-meta`, `.rustic-hero-photo`, `.rustic-recipe-body`, `.rustic-ing-panel`, `.rustic-dirhead`, `.rustic-step-row`, `.rustic-step-num`, `.rustic-cook-{bar,rail,main,num,title,text,foot}`, and four `*-title` type classes.

Two breakpoints rather than one:

- **≤ 900px** — recipe body collapses to one column and the ingredient rail stops being sticky. Chosen above tablet width because at 768px the two-column grid already squeezed the steps to a ~26-character measure with an empty rail beside it.
- **≤ 760px** — phone treatment: 18px page gutters, single-column cards, wrapped tab strip, 3/2 hero crop, smaller step numerals, full-width cook-mode button, tighter button labels so back/print/save fit one row.

Fluid display type via `clamp()` (e.g. masthead `clamp(42px, 10.5vw, 84px)`) instead of a second set of fixed sizes — the desktop maximum is unchanged, so the desktop rendering is untouched.

Two non-layout fixes rode along because they only misbehave on touch: every `:hover` rule moved inside `@media (hover: hover)` (on a phone they latch after a tap — a tapped card stayed lifted), and the ingredient checkbox gets a 44px hit area via a transparent `::after` inset, without growing the 26px drawn circle.

`min-height: 100vh` → `100dvh` in cook mode so the footer isn't buried under Chrome's address bar.

### Verification

Headless Chromium (Playwright, Pixel 6 viewport 412×915 + touch), served from `python -m http.server 3030`:

- No horizontal overflow at 320/360/390/412/480/600/768/820/1024/1440px — `scrollWidth === clientWidth` and no element extending past the viewport on home, recipe, and cook-mode views. Before the change the recipe view overflowed on every width below ~900px
- Zero console errors, zero failed requests on all three views
- **Desktop is pixel-identical**: full-page screenshots at 1440px before/after the change diff to 0 differing pixels of 7.7M (home) and 3.2M (recipe) via pixelmatch
- Touch interactions exercised by tap, not click: search filter, category tab, servings stepper (4 → 5), ingredient checkbox, cook-mode next/exit — all correct
- Print unaffected: `.no-print` elements still hide and the print grid is unchanged under `emulateMedia({media:'print'})`

Google Fonts and unpkg are unreachable from the verification sandbox, so the pinned React/Babel and the four webfont families were served from npm equivalents via request interception — same versions, real type metrics.

### Known follow-up (not in this change)

`formatAmount` falls back to a decimal when a scaled amount doesn't land near a unicode fraction, so scaling 4 servings → 3 can render "0.08 tsp black pepper". Cosmetic, pre-existing, and identical on desktop — a rounding-policy fix, not a layout one.
