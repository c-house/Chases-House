# Chase's House — Design System

A warm, cozy, deliberately handmade brand. Two interlocking visual scopes:

- **Cabin in the Woods (dark)** — the main "house" chrome. Deep pine canopy, fog and moss, a single warm window glowing gold. Used by the homepage, Games, Files, and any future "rooms."
- **Rustic Paper (light)** — the Cookbook scope. Warm cream paper, ink-brown serifs, hand-drawn energy, a script accent. The view from inside the cabin, at the kitchen table. Activated by wrapping content in `.rustic`.

Both scopes share the same posture — **generous, tactile, a little imperfect** — and the same emotional center: the cabin's lit window. In the dark scope it shows up literally as gold accent light cutting through pine and fog. In the rustic scope it's the sun on paper. Personal, hand-built, made with butter and patience.

> "Welcome in. Make yourself at home."

The house metaphor is everything, and the brand artwork now makes it specific: **a small log cabin in deep evergreen woods, one window lit, smoke curling from the chimney, ferns at the door.** Each section of the site is a *room* of that cabin — currently Games, Cookbook, Files, and (when the related site is online) Music. The homepage is the path through the trees. The favicon is that lit window.

---

## Sources

- **Repo:** [c-house/Chases-House](https://github.com/c-house/Chases-House) (`main`)
- **Live site:** [chases.house](https://chases.house)
- **Stack:** plain HTML/CSS/JS, GitHub Pages, no build step. Cookbook is React via Babel-standalone CDN.
- **Brand artwork:** `assets/forest-house-landscape.png` (2752×1536, wide viewports) and `assets/forest-house-portrait.png` (1664×2592, tall viewports). Both share the same canopy edge color `#0d1410`, so chrome blends seamlessly into either crop.
- **Key files we drew from:**
  - `styles.css` — dark tokens + nav/card/header system
  - `index.html` — homepage hero + room cards
  - `games/index.html` — game gallery cards
  - `files/style.css` — buttons, fields, dropzones, banners
  - `cookbook/directions/rustic.jsx` — full rustic paper scope (chips, stepper, cook-mode)
  - `cookbook/data/recipes.js` — voice/tone reference for content
  - `CHANGELOG.md` — release voice (terse, declarative bullets)
  - `favicon.svg` — cabin silhouette with glowing window (logo)

---

## Index

| File | What's in it |
|---|---|
| `README.md` | This document — context, content tone, visual foundations, iconography |
| `colors_and_type.css` | All design tokens (CSS vars) for both scopes + semantic helpers |
| `SKILL.md` | Agent-Skills compatible entry point |
| `assets/` | Logo, favicon, the two forest-cabin backdrops, real food photography |
| `preview/` | Standalone HTML cards rendered on the Design System tab |
| `ui_kits/chases-house/` | UI kit recreating the dark "Cabin in the Woods" chrome (homepage, games, files) |
| `ui_kits/cookbook/` | UI kit recreating the rustic paper Cookbook scope |

---

## Content Fundamentals

The voice is **personal, warm, and matter-of-fact** — a friend telling you about a thing they made. Never marketing-y, never breathless.

### Tone
- **First person, warm and quiet.** "My notes." "what happened when you made it." "Welcome in. Make yourself at home."
- **Direct address, occasional.** "Trust me." "Don't skip it." "This is non-negotiable." Shows up at the punchline of a paragraph.
- **Script-font accents** carry the warm flourishes: *"recipes worth keeping"*, *"bon appétit"*, *"made with butter and patience"*.
- **A little wry.** "Lumps are fine — they're your friend." "Stack high. Butter. Warm maple syrup. Don't overthink it."
- **No emoji in headings or chrome.** Emoji used sparingly as iconography on cards (🐍 for Snake, 🍳 for cookbook). Never decorative in body copy.

### Casing
- **Sentence case in body copy.**
- **SMALLCAPS WITH WIDE TRACKING for labels and metadata.** Always uppercase + `letter-spacing: 0.24em` (rustic) or `0.08–0.12em` (dark). Used for category tags, "FILTER BY INGREDIENT", "VS AI", "EST. 2026 · VOL. I", "STEP 3 OF 7".
- **lowercase chips and stems.** Filter chips read `pork`, `lemon`, `garlic`. Section CTAs read `back to book`, `print`, `save`, `next step →`. Lowercase signals "this is a tool, not a feature."
- **Title Case for proper nouns and section names** ("The Family Cookbook", "Sunday Roast Chicken", "Pac-Man").

### Pronouns
- **You** for instructions and addressing the reader.
- **I/My** for personal artifacts. ("My notes")
- **We/Our** never used. The brand is one person's house, not a company.

### Vibe phrases (steal these)
- "Welcome in. Make yourself at home."
- "recipes worth keeping"
- "made with butter and patience"
- "pull up a chair"
- "bon appétit"
- "what happened when you made it"
- "Browser-based games to play when you need a break."
- "Family recipes, scaled to any serving size."
- Coming-soon tags read just `soon`, never `Coming Soon` or `Beta`.

### Length & rhythm
- **Page descriptions** are one or two short sentences max.
- **Recipe blurbs** are a single line with a beat — *"Crispy skin, buttery herb rub, a whole lemon in the cavity. This is the one."*
- **Changelog entries** are bullet lists, declarative, present tense ("Add", "Replace", "Fix"), one technical detail per bullet.
- **Chef's notes** are 1–3 sentences, italic, slightly conversational.

---

## Visual Foundations

### Color
**Two related palettes that share a soul.** Dark scope is *outside the cabin at dusk*; rustic scope is *inside the cabin in the morning*. The gold accent ties them together — same warm light, seen from two sides of the window.

**Dark / Cabin in the Woods**
- Backgrounds: `#0d1410` canopy → `#152821` pine shadow → `#1f3329` moss-stone → `#2a4234` fern. A four-step ladder of dim greens. Never solid black.
- Atmosphere: `--fog #6e8a7a` (mid-green haze, used in muted structure), `--mist #a8bfaf` (lightest green-gray, distant text-on-art), `--bark #3a2a1c` (warm brown for log-frame strokes).
- Text: `#faf3e6` heading, `#f0e6d3` primary, `#9aa89a` muted (lichen — pulled green so it ties back to the forest), `#5a6a5e` faint (deep moss). Always paper-warm — never pure white, never blue-cool.
- Accents: `#e8b75a` gold (the cabin window — primary, used SPARINGLY), `#f4cc6e` glow (hover, like the window flickering up), `#a06828` ember (log-frame borders, dividers), `#b05a3a` terracotta (warning, the chimney's orange), `#7a9460` sage (success / growth), `#4a6a4e` moss (secondary structural green).

**The gold is the cabin window.** It is the *only* warm light source in the painting and should be treated as a finite resource in the UI. One CTA per view, one active nav link, the brand mark, occasional code highlights. If gold appears more than ~5 times on a screen, it stops feeling like a window and starts feeling like a button bar.

**Rustic / Cookbook**
- Paper: `#f3ead8` → `#ead9bd` → `#e2cfae`. Three warm creams, never white.
- Ink: `#2b1e14` → `#5a4630` → `#8a7354`. Brown ink, never black.
- Accents: `#b8502a` terracotta (primary), `#8c3a1e` deep, `#5e6b3a` olive (success — same family as the dark scope's sage), `#6b2736` burgundy (favorite/saved), `#c08a2e` gold (stars).
- Lines: `#c9b48d` solid, `rgba(139,108,61,0.22)` soft.

### Type
**Dark scope:** `Fraunces` (display, with `WONK 1, SOFT 50` variation settings — gives the ball-terminal flair) + `Bricolage Grotesque` (body). Display is set at low weights (350–500) and big sizes — the tension between heavy hairlines and bold strokes is intentional.

**Rustic scope:** `Cormorant Garamond` (display, italic for category headings — never roman) + `Lora` (body) + `Caveat` (script accent for warmth) + `IBM Plex Mono` (ingredient amounts, numerical clarity).

Code: `SFMono-Regular`/Consolas system stack.

**SMALLCAPS pattern:** display-family, uppercase, `letter-spacing: 0.24em`, weight 600. The signature of the brand. Used for `EST. 2026 · VOL. I` mastheads, category tags, step counters, field labels.

**Italic display** is used heavily in the rustic scope for category section titles (*Mains*, *Sides*, *Desserts*) and recipe step numbers. Never in the dark scope.

### Backgrounds & atmosphere
- **Dark scope** — the *primary* background is the forest illustration itself: `forest-house-landscape.png` (or the portrait crop) fixed-positioned and `cover`-sized, with a `#0d1410` fallback color matching the artwork's outer canopy. On wide pages, the artwork is allowed to breathe. On dense interior screens (forms, file tools), apply a 55–80% top/bottom dark gradient (`linear-gradient(180deg, rgba(13,20,16,0.55) 0%, transparent 15%, transparent 78%, rgba(13,20,16,0.80) 100%)`) so chrome stays legible.
- When the artwork would compete with content (long lists, tables, forms), drop to flat `--bg-main` and layer two ambient radial gradients: gold from top-left at 3.5% opacity, sage from bottom-right at 2.5% opacity. Never pure flat green.
- **Rustic scope** uses two radial gradients (terracotta top-left, olive bottom-right at 5–6%) plus a 160px tiling SVG turbulence noise (warmer brown tint, 3.5% opacity). The paper has tooth.
- **Header underline:** `linear-gradient(90deg, transparent, var(--accent-ember), transparent)` at 30% opacity. Never a solid line.
- **Drifting motes** — fireflies/embers — are an optional decorative layer in the dark scope. Six elements max, drifting upward over 14–21s with a gold/ember box-shadow. Used on hero pages only.

### Imagery
- **The forest cabin illustrations** are the centerpiece of the dark scope. Use them at large scale, cover-sized, behind hero content. Never inset, never with a heavy filter, never tinted. Let the painting be the painting.
- **Real food photography** in the cookbook (warm-toned, crops emphasizing texture).
- **Hero images** (rustic scope) are wide-aspect (16/7) with `inset 0 0 0 1px rgba(0,0,0,0.04)` and `0 4px 24px rgba(60,40,20,0.15)` shadow.
- **Card thumbnails** are `aspect-ratio: 4/3` with subtle inner shadow. First card in a grid sometimes gets a piece of "tape" overlaid (rotated 3deg) for scrapbook feel.
- **Slight rotation** on a few rustic cards (`rotate(-0.4deg)`, `rotate(0.3deg)`) — never all of them, just a *few*.
- **No purple/violet, no neon, no cool blues.** Everything in the brand should feel like fire, paper, wood, food, dusk, candlelight — or like the forest at the edges of those things.

### Borders & strokes
- **Dark scope cards:** `1px solid var(--accent-ember)` at default — they read as the warm log-frame around a window. On hover, the border becomes `--accent-gold` and the card itself lifts toward the viewer (the window has been spotted through the trees). Never a heavier border.
- **Rustic dropzone-style:** `1.5px dashed`, becomes `solid` once filled.
- **Rustic dividers:** `1.5px solid var(--ink)` for primary section breaks, `1px dotted var(--line-soft)` for ingredient list items, `linear-gradient` fade for ornamental.
- **Rustic stepper:** `1.5px solid` outer + interior dividers — looks letterpress.

### Shadows
- **Default:** none. Cards rest flat on the moss.
- **Card-at-rest on busy artwork:** `0 12px 32px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)` (`--shadow-card-rest`) — a deep grounding shadow so the card doesn't dissolve into the painting.
- **Hover (dark cards):** `0 8px 32px rgba(232, 183, 90, 0.14), 0 2px 8px rgba(0, 0, 0, 0.45)` (`--shadow-card-hover`) — a gold halo + soft drop. Card also lifts `translateY(-4px)`.
- **Dragover dropzone:** `0 0 0 4px rgba(232, 183, 90, 0.10)` (`--shadow-glow-soft`) — a soft outer ring, not a shadow.
- **Hero photos (rustic):** `0 4px 24px rgba(60, 40, 20, 0.15)` — warm brown drop, never gray.
- **Glow text effect** on the homepage accent: animated `text-shadow: 0 0 60px rgba(232, 183, 90, 0.55), 0 0 110px rgba(232, 183, 90, 0.18)` — the *"window through the trees"* — pulses on a 5–8s loop. Use on ONE element per view at most.

### Radii
- **Dark scope:** `3px` (small tags), `6px` (cards/buttons/fields — the default), `8px` (prominent cards). Restrained — like notched logs, not pillows.
- **Rustic scope:** `2px` (buttons, stepper) — feels letterpress; `100px` (chips — pill); `50%` (round checkboxes, corner badges). The contrast between the 2px buttons and 100px pills is part of the look.

### Animation
- **Stagger entry on every page.** Nav links cascade in via `--i: 0..N` with `60–80ms` per step. Hero title fades in at `150ms`. Tagline at `450ms`. Footer at `600–1300ms`.
- **Easing:** `ease-out` for entrances; `cubic-bezier(0.2, 0.7, 0.3, 1)` (`--ease-out`) for the rustic scope (gentler, paper-like). Never bouncy.
- **Durations:** `150ms` for hover state changes; `300–350ms` for transitions; `500–700ms` for entry animations.
- **No bounce, no spring, no parallax.** Just fades and rises — and the slow window-glow pulse.
- **Drifting motes** (optional) loop on 14–21s with staggered delays. They should look incidental, like fireflies on a porch.

### Hover & press states
- **Nav links** (dark): underline scales from left (`scaleX(0)` → `scaleX(1)`) on a `0.35s` ease, color shifts to `--accent-glow`.
- **Cards** (dark): `translateY(-4px)`, border ember → gold, gold halo shadow. `0.3s ease` on transform + box-shadow + border-color.
- **Buttons primary** (dark): bg gold → glow, `translateY(-1px)` lift, `translateY(0)` on `:active`.
- **Rustic buttons:** `transform: translateY(1px)` on `:active` — pressed-into-paper feel.
- **Rustic cards:** `translateY(-3px)` lift on hover via `cubic-bezier(.2,.7,.3,1)`.

### Layout rules
- **Page padding:** `clamp(1.5rem, 5vw, 4rem)` horizontal + `clamp(4rem, 12vh, 10rem)` top. Always fluid clamps.
- **Max content width:** `72rem` (game grid) or `48rem` (forms/files).
- **Card grids:** `repeat(auto-fill, minmax(18rem, 1fr))` (dark game grid) or `minmax(260px, 1fr)` (rustic recipes). Always responsive auto-fill.
- **Dark hero composition rule:** when the cabin artwork is showing, do *not* center heavy text directly over the cabin in the painting — push hero copy to the upper-left or upper-right thirds so the cabin keeps its visual punch. The painting is the hero; the type is the caption.
- **Rustic recipe layout:** sticky `340px` ingredients column on the left, fluid steps on the right.
- **Header pattern:** small thin underline gradient, nav right-aligned (or centered on mobile). `1.2–2rem` vertical padding.

### Transparency, blur, and capsules
- **No `backdrop-filter` blur** anywhere by default. The look is matte paper / matte ink, not glass. *Exception:* dark scope cards laid directly on the forest illustration may use a `2px` backdrop-blur on a translucent gradient surface so they punch through the painting without blocking it entirely.
- **Card surface on artwork:** `linear-gradient(180deg, rgba(40,40,44,0.85), rgba(30,30,33,0.92))`. The slight gradient (top lighter than bottom) suggests light spilling onto the card from above — like firelight from inside.
- **Transparency** is used for borders, ambient gradients (3–6% opacity), the noise filter (3.5%). Never for "frosted" panels.
- **Capsules** appear only as filter chips (`border-radius: 100px`). Buttons stay rectangular.
- **Inline highlights** in cook mode: `background: rgba(184, 80, 42, 0.08)` behind ingredient mentions in step text. A wash, not a pill.

### Cards
- **Dark room/game card:** translucent dark surface (`rgba(40,40,44,0.85) → rgba(30,30,33,0.92)` gradient) + `1px solid ember` border + `6px` radius + padding `clamp(1.5rem, 3vw, 2rem)`. Resting shadow `--shadow-card-rest` so it lifts off the artwork. Icon top, title middle, description, optional `tag` pinned bottom-left.
- **Rustic recipe card:** *no border, no shadow at rest* — the `4/3` thumb has its own inset+drop, then the title/blurb/meta sit below. Hover translates up `3px`.

---

## Iconography

The brand's approach is **deliberately mixed and casual** — like a real cabin, not a UI kit:

- **Logo:** `assets/favicon.svg` is the brand mark — a cabin silhouette with a glowing gold window. The window uses a `radialGradient` (`#f4cc6e` → `#e8b75a`). Use it everywhere a logo is wanted. There is no other lockup or wordmark — the brand is "Chase's **House**" with the second word in `--accent-gold`.

- **Unicode glyphs as icons** (the dominant pattern in the dark scope):
  - `&#9823;` ♟ / `&#9818;` ♚ — Games / Chess
  - `&#127859;` 🍳 — Cookbook
  - `&#10006;` ✖ — Tic Tac Toe
  - `&#9679;` ● — Connect Four
  - `&#128013;` 🐍 — Snake
  - `&#9638;` ▦ — Sudoku
  - `&#9641;` ▩ — Crossword
  - `&#10067;` ❓ — Jeopardy
  - `&#9737;` ☉ — Pac-Man
  - `&#9878;` ⚖ — Files dropzone
  - `&#128065;` 👁 — passphrase show/hide
  - `›` (rotated 90deg on `[open]`) — disclosure chevron
  - `&#10003;` `&#9747;` — checkmarks/x where needed

  Styled with `font-size: 1.75–1.8rem; opacity: 0.7–0.9;` and inherit color. Slightly inconsistent on purpose — that's the charm.

- **Inline SVG icons** (rustic cookbook scope only): hand-drawn-feeling line icons, `1.6px` stroke, `strokeLinecap="round"`, no fill except for filled-state hearts/stars. The `RIcon` set lives in `cookbook/directions/rustic.jsx` and `ui_kits/cookbook/RIcon.jsx`. Set includes: search, heart, clock, users, spoon, back chevron, print, star, check.

- **No icon font** (Lucide, Phosphor, Heroicons) is used. The mix of unicode + bespoke SVG is deliberate.

- **Emoji** appears once: `&#127859;` 🍳 on the cookbook room card. Otherwise emoji is avoided — the warmth comes from typography and the cabin artwork, not pictographs.

If the system needs an icon you don't have, prefer in this order: (1) a bespoke 1.6-stroke line SVG matching `RIcon`, (2) a unicode glyph, (3) only as a last resort, a CDN icon library — and flag the substitution.

---

## Asks for the user

- **Fonts substituted from Google Fonts:** Fraunces, Bricolage Grotesque, Cormorant Garamond, Lora, Caveat, IBM Plex Mono — all already loaded by the production site. ✅
- **Brand artwork:** The two forest-cabin illustrations (`forest-house-landscape.png`, `forest-house-portrait.png`) are now the dark scope's primary background. If you want alternate seasonal versions (snow, autumn) we'd need new art.
- **Imagery:** Real cookbook photos are owned. The dark scope still uses Unsplash placeholders for room cards in production — supply real photography if you want those owned.
- **Logo lockups:** there's no horizontal/wordmark lockup — only the favicon + "Chase's House" type-set heading. Let me know if you want a proper lockup designed to sit alongside the cabin mark.
