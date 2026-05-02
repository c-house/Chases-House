# ADR-019: Embershore (Link's Awakening cozy mini)

**Status**: Proposed
**Date**: 2026-04-24

## Summary

Build **Embershore**, a top-down adventure mini for chases.house in `games/embershore/`: one small island overworld (5×4 = 20 screens), four tiny dungeons, a fishing minigame, and ~6 NPCs with personality. Solo, Canvas 2D, tile-based with screen-by-screen room scrolling — the load-bearing Link's Awakening feel. Original art, original characters, original (CC0-sourced) music. Saves to localStorage.

## Context

The games gallery currently spans turn-based strategy ([Tic Tac Toe](../../games/tic-tac-toe/) → [Chess](../../games/chess/)), arcade real-time ([Snake](../../games/snake/), [Pac-Man](../../games/pacman/)), solo puzzles ([Sudoku](../../games/sudoku/), [Crossword](../../games/crossword/)), and networked party ([Jeopardy](../../games/jeopardy/)). The **adventure / exploration** category is missing — no game where the player wanders, talks to characters, finds items, and lives in a small story.

The user's brief: a *Link's Awakening cozy mini*. Small island, 4 tiny dungeons, fishing, NPCs. The original LA (1993) earns devotion through its dreamy mood — the trading sequence, Marin's song, Madam MeowMeow's runaway dog, the surreal Wind Fish reveal. The mood is the point. A faithful recreation is not the goal; capturing the cozy-melancholy-tropical-strange feel in a 15–30 minute playable is.

### Why this fits chases.house

- **Genre gap** — no adventure title yet
- **Palette compatibility** — LA-DX's warm palette (sand, terracotta-dawn, jungle green) overlaps the Warm Hearth tokens better than Pac-Man's neon arcade scheme. This game sits at chases.house *natively*, not as a transplant
- **Solo-only** — no Firebase, no backend, just localStorage
- **Long-form anchor** — gives the gallery a "stay a while" entry next to all the bite-sized titles

### IP / clone risk (load-bearing)

A direct LA clone would be DMCA bait — Nintendo is more aggressive than most (AM2R, Mario 64 ports, Pokémon Uranium). The recreation must be a **homage with original assets, original geography, original characters, original music**. Mechanics (top-down room-scroll, A/B item-slots, sword/shield, dungeon items) are not copyrightable. Sprites, music, NPC names, place names, and the awakening song must all be original or CC0.

## Canonical reference (so we don't get rules wrong)

- **Genre**: top-down action-adventure; descended from *The Legend of Zelda* (1986) and *A Link to the Past* (1991); ancestor of every modern "2D Zelda-like"
- **Core loop**: explore overworld → find dungeon → solve puzzles using the dungeon's signature item → defeat boss → collect macguffin → repeat → final ritual
- **Win/lose**: collect all dungeon macguffins, perform final ritual; "lose" is a soft reset (LA: wake in bed; Embershore: wake in inn)
- **Iconic moments to deliver**: the wash-ashore opening, the item-get freeze-pose with jingle, the room-scroll feel, an NPC who hums a fragment of the final song, the dream-reveal ending
- **Rules amateurs get wrong**:
  - Room-scroll is **not** free-camera scroll. The camera locks per-room and *eases* (~280ms) on transition. Music continues unbroken.
  - Two item slots (A and B) — the player chooses which two of N items are equipped. This is not "current weapon."
  - Death is a soft reset, not a punishment. Cozy genre depends on this.
  - Bushes and rocks gate progression by tool, not by stat. The world tells you what you can't do yet.
- **Era look**: Game Boy Color DX palette (1998), bent toward warm

## Decisions

### Mode

Solo only. Couch co-op would dilute the mood and isn't precedented in LA. No online, no spectator, no AI opponents in the strategy-game sense (dungeon enemies are scripted behaviors, not adversarial AI).

### Working name: Embershore

The player washes ashore on a glowing beach; the island is the dream of a sleeping creature called the **Hearthwarden** (analogue to the Wind Fish, fully original lore). "Ember" pairs with the site's `--accent-ember #a06828` token. **Player character working name: "the player character."** Both names flagged in Open Questions.

### Core loop

1. Wander the overworld, bump into NPCs, find bushes that hide rupees/shells, locate dungeon entrances
2. Enter a dungeon (6–8 rooms with one signature item + one boss)
3. Beat the boss → receive a **Hearth Sigil** (LA's "instrument" analogue)
4. Fish at Embershore Cove between dungeons for a small economy and bestiary
5. After 4 sigils, light the central campfire — island slowly fades to gold-on-black, Hearthwarden wakes, credits

### Iconic-moment delivery checklist

| LA moment | Embershore equivalent | v1? |
|---|---|---|
| Marin sings the Ballad | Bard NPC hums a different fragment per screen visited; full melody only audible after all 4 dungeons | ✅ |
| Trading sequence (8 steps) | Mini 3-step trade only | partial |
| Owl statue hints | Carved totem stones, context-aware to game state | ✅ |
| Madam MeowMeow's BowWow | Sailor's lost ferret quest — fetch from a dungeon entrance | ✅ |
| Fishing pond | Embershore Cove — 5 species × 3 sizes, trophy for largest | ✅ |
| Item-get freeze-pose with jingle | the player character holds item overhead, ~2.4s pause, 2-bar jingle | ✅ |
| Rooster (late-game traversal) | — | v2 |

### Controls

| Input | Action |
|---|---|
| Arrow keys / WASD / D-pad | Move (4-directional, grid-snapped feel) |
| Space / J / pad A | Use item slot A (default: sword) |
| Shift / K / pad B | Use item slot B (default: shield) |
| E / pad Y | Talk / pick up / read totem (context-sensitive) |
| Tab / Esc / pad Start | Open menu (item swap, map, save) |
| M | Mute |

Gamepad routes through `games/shared/gamepad.js`. ADR-016's `SharedGamepad.BUTTONS` exposes only `A` + `DPAD_*` today; we will extend it to expose `B`, `Y`, `START` — exactly the "land when a consumer needs them" extension that ADR-016 anticipates. One-line addition, no API churn.

No mobile touch in v1. A virtual D-pad in a 30-minute exploration game is a worse experience than honest desktop-only.

### Visual direction

**Brief for `/frontend-design`** — do not design here, hand off:

- **Mood words**: warm, dreamy, gently sun-bleached, twilight-tropical, slightly melancholy
- **Era reference**: Game Boy Color DX palette **bent toward warm**; toy-diorama softness from the Switch remake informs UI shaping (rounded dialogue boxes, soft drop-shadows on overlays) but not the in-game pixel art
- **Palette**: extend site tokens. In-game tile palette = 4-color ramps anchored on `--accent-gold #c8943e`, `--accent-ember #a06828`, `--accent-terracotta #b05a3a`, deep-bg `#0a0a0b`, text `#f0e6d3`. Sand / grass / water / stone each get a 4-color ramp pulled from this anchor set
- **Typography**: Press Start 2P for in-game HUD and dialogue (already vendored for Pac-Man — DRY); Fraunces remains for the surrounding page chrome
- **Sprite style**: 16×16 tiles, hand-authored, 4-color GB-style ramps in the Embershore palette. the player character wears a deep terracotta tunic against gold-sand
- **Motion**: deliberate (room-scroll = 280ms cubic ease-in-out); idle anim everywhere (NPCs blink, fish jump, fire flickers, water shimmers); reduced-motion toggle disables shake and softens transitions to crossfade
- **Hero frame** (gallery card): the player character on a cliff at golden-hour, Hearthwarden's sleeping silhouette barely visible in the cloud-line, totem stone in foreground

### Audio

| Track | Source | Notes |
|---|---|---|
| Overworld | CC0 chiptune | Looped, gentle, warm |
| Per dungeon (×4) | CC0 chiptune (alts) | Distinct mood per dungeon |
| Fishing | CC0 chiptune | Sleepy, repeating |
| Boss | CC0 chiptune | Tense, brief |
| Hearthwarden wake / credits | CC0 chiptune | Triumphant + soft |
| SFX (sword, hit, pickup, dialogue blip, fish bite, item-get jingle, error, menu) | Reuse where possible from the Junkala pack already in `games/pacman/sounds/`; supplement with additional CC0 |

The "item-get" jingle is the signature audio cue and must be original or CC0 (LA's 4-note theme is iconic and Nintendo-owned).

Audio architecture **mirrors `games/pacman/audio.js`** — AudioContext on first gesture, parallel WAV fetch + decode into AudioBuffers, separate gain buses for music / SFX, mute persisted to localStorage. **Do not** extract a shared `games/shared/audio.js` yet — DRY says wait for the third consumer (we have one consumer today, this would be the second). Style the new code identically so a future extraction is mechanical.

### Architecture

**Brief for `/feature-dev:feature-dev`** — do not write file structure here, hand off:

Proposed minimum file set under `games/embershore/`:

| File | Role |
|---|---|
| `index.html` | Page shell, canvas, overlay markup, inline CSS |
| `world.js` | Tile data — overworld + 4 dungeons. Hand-authored nested arrays |
| `engine.js` | Tick loop, room-scroll state, collision, inventory, save/load |
| `entities.js` | the player character, NPC archetype, enemy archetypes, projectile, item-pickup |
| `ai.js` | Per-enemy behaviors (4 enemy types + 4 mini-bosses + 4 bosses) |
| `input.js` | Keyboard + gamepad polling; delegates to `SharedGamepad` |
| `audio.js` | Web Audio init, sample loading, music + SFX (Pac-Man parallel) |
| `render.js` | Canvas drawing — tiles, sprites, HUD, dialogue box |
| `dialogue.js` | NPC text data + dialogue-box state machine. All strings support `{name}` interpolation against the saved player name |
| `ui.js` | Title, pause, inventory menu, map, game-over |
| `game.js` | Module wiring, per-frame loop |
| `sprites/` | PNG sprite sheets — terrain, wren, npcs, enemies, items |
| `sounds/` | CC0 audio assets |

Module pattern: IIFE on `window.EmbershoreX` (matches Chess + Pac-Man — site convention).

State machine: explicit named states `title → name-entry → overworld → dialogue → menu → dungeon → boss → fishing → cutscene → credits`. Transitions are the only way state changes; no implicit flag-flipping. The `name-entry` state appears exactly once per save (after the wash-ashore intro on a fresh save) and is skipped on continue.

Render: Canvas 2D. Tile atlas + sprite atlas. Full-room redraw at 16×16 tiles × 10×9 rooms × 60 fps is well within budget. No WebGL.

Tick loop: `requestAnimationFrame` + fixed-step accumulator (1/60s) for the engine, raw rAF for render. Determinism doesn't matter (no replays / seeds) but fixed-step keeps physics stable across slow frames.

Save: a single JSON blob in localStorage under `embershore.save.v1`. Stores: `name`, position, room, sigils, items, hearts max+current, rupees, NPCs spoken to, fishes caught, conch shells. Versioned key so a v2 save format can coexist or migrate.

### Persistence

- **Save**: auto-save on every screen transition + every menu close. No manual save (cozier)
- **High scores**: largest fish per species, fastest island completion. localStorage. No global leaderboard (no backend, and the genre doesn't suit one)
- **Daily seed**: not applicable to a story game

### Difficulty & onboarding

Single difficulty. Onboarding = a 30-second wash-ashore intro with a totem stone on the first screen reading "PRESS E TO READ" and "ARROW KEYS TO MOVE." The hand-holding is over by screen 3.

Failure: hearts reach zero → the player character wakes in the inn with full hearts; dungeon enemies respawn; no progress lost. Death is a soft reset.

### Game feel signature

**The signature mechanic — non-negotiable**: the **room-scroll**. When the player character steps off-screen, the camera does not follow — it eases over to the next room (~280ms cubic) while the music continues unbroken. NPCs in the destination room are pre-rendered as the player character enters. This single mechanic IS the LA feel; getting it wrong (free-scroll camera, instant cut, or jerky timing) collapses the mood.

**Secondary signature — the item-get pose**: time freezes, the player character holds the item overhead, 2-bar jingle plays, then play resumes. Pause must be exactly long enough to feel ceremonial without being annoying (~2.4s).

## §10 — Adjacent / orthogonal / perpendicular ideas (20 candidates)

| # | Idea | Verdict |
|---|---|---|
| 1 | Daily fishing leaderboard (local) — best fish per day in localStorage | **ship v1** (cheap, charming) |
| 2 | Bard NPC who hums a different melody fragment per visit | **ship v1** (signature mood, low cost) |
| 3 | Owl-totem hints, context-aware to game state | **ship v1** (doubles as tutorial) |
| 4 | Full LA-style 8-step trading sequence | **park** (v2 ADR — too much surface area) |
| 5 | Mini 3-step trading sequence | **ship v1** |
| 6 | Map screen with progress dots | **ship v1** |
| 7 | Photo mode — `P` saves a PNG of the current room | **park** (v2) |
| 8 | Date easter eggs — snow in December, pumpkin on inn sill late October, cherry blossoms early April, fireworks Jan 1 | **ship v1** (one conditional in render, big delight) |
| 9 | Idle title-screen — the player character snoozing on the beach, waves loop | **ship v1** (this IS the title) |
| 10 | NPC compendium — "village book" of who you've met | **park** (v2) |
| 11 | Shareable result card — emoji grid summary | **park** (v2) |
| 12 | Reduced-motion mode | **ship v1** (accessibility) |
| 13 | Dyslexia-friendly font toggle for dialogue | **park** (v2) |
| 14 | Hidden conch shells (8 across the island) | **ship v1** (Korok-style; reuses pickup code) |
| 15 | Cross-game cameo — a Pac-Man pellet on a hidden screen, a chess piece on a totem | **ship v1** (one sprite each, big delight) |
| 16 | Animated favicon — tiny waving the player character in tab title | **park** (v2 — site-level concern) |
| 17 | Loading-screen mini — flick-the-fish while a dungeon loads | **drop** (load is instant) |
| 18 | Wind Fish constellation in Snake's death screen if Embershore is completed | **park** (v2 — cross-game state needs an audit) |
| 19 | New Game+ — second loop with night palette swap | **park** (v2) |
| 20 | Hearthwarden whisper — every 90s of idle play, ambient one-line whisper | **ship v1** (one timer, one string array) |

## §11 — Fun audit

1. **10-second hook**: gold-pink dawn beach, Hearthwarden silhouette breathing in the clouds, totem says "press E to read." Mood lands instantly
2. **Skill ceiling**: low (cozy, not hardcore). Mastery = sub-30-minute island clear. Speedrun timer parked for v2
3. **Story you tell a friend**: "I caught the rainbow trout!" / "Tide Temple boss with one heart!" / "There's a dungeon hidden behind the campfire — did you find it?"
4. **Surprise**: the campfire isn't decorative. After the 4th sigil, the whole island slowly inverts to gold-on-black and the Hearthwarden wakes
5. **Restart friction**: 0 seconds. Death = wake in inn. Quitting = title-screen "Continue" → straight to last screen

## §12 — Beauty audit

- **Hero frame**: golden-hour cliff with the player character in silhouette, Hearthwarden cloud-form behind, totem in foreground
- **Negative space**: ocean, sky, sand do the resting. HUD = minimal hearts-row + rupee count top-left, fading to 70% opacity at full hearts
- **Readability under pressure**: dungeon rooms reserve a high-contrast 10% margin (no enemies/items spawn there) so HUD never overlaps action
- **Cohesion with chases.house**: this game sits *natively* on the site — the warm palette is endemic, not transplanted
- **The detail nobody asked for**: when the player character stands still 6 seconds, the breeze flutters the tunic-edge sprite (1 frame, 200ms) and a single leaf drifts diagonally across the screen

## §13 — Architectural Decision (CLAUDE.md format)

```
## Architectural Decision: Recreate Link's Awakening cozy mini as Embershore

DRY:   Is this logic duplicated elsewhere?
       → Audio architecture mirrors games/pacman/audio.js. Sharing
         (games/shared/audio.js) is tempting but YAGNI — wait for the
         third consumer. Gamepad → already shared via ADR-016.
         Action: re-implement audio in same style; future extraction
         will be mechanical.

YAGNI: Is this required for a shippable v1?
       → Full trading sequence, photo mode, NPC compendium, shareable
         card, dyslexia font, NG+, animated favicon, cross-game state:
         all parked or dropped. v1 = overworld + 4 dungeons + fishing
         + 6 NPCs.

SOLID: Does each unit have one responsibility?
       → engine = state, render = drawing, world = map data,
         dialogue = text + box state, ai = enemy behaviors. No god
         module.

KISS:  Is there a simpler approach?
       → Cheapest cozy delivery = 1 overworld + 1 dungeon + fishing.
         But the user explicitly asked for "4 tiny dungeons" — the
         fourfoldness is the brief. Cutting to 1 drops the iconic
         ramp. Hold at 4.

Decision: Proceed. Single ADR, three PRs:
          PR1 — engine + overworld + 1 dungeon + 1 NPC (proof of feel)
          PR2 — 3 more dungeons + 5 more NPCs + trading mini
          PR3 — fishing + Hearthwarden ending + polish + cameos
```

## v1 scope (ship)

- 1 overworld, 5×4 = 20 screens
- 4 tiny dungeons (6–8 rooms each, 1 signature item + 1 boss per dungeon)
- 5 items total: sword (start), feather (jump small gaps), bombs (blow walls), boomerang (stun + retrieve), bow (long-range)
- Two-slot equip system (A and B)
- Fishing minigame (5 species × 3 sizes; trophy tracked per species)
- 6 named NPCs, each with a small quest hook
- 8 hidden conch shells across the island
- Mini 3-step trading sequence
- Owl totem hints
- Heart container + rupee economy
- Map screen, pause menu, inventory swap, localStorage save
- Title screen with idle animation, name-entry modal on first launch (text input + Finn / Cinder / Mavi quick-picks, default Cinder), soft-reset game-over, Hearthwarden ending
- CC0 chiptune music + SFX
- Gamepad (via `SharedGamepad`, extended to expose `B`/`Y`/`START`) + keyboard
- Reduced-motion toggle
- Bard NPC humming melody fragments
- Hearthwarden idle whispers
- Cross-game cameos (Pac-Man pellet on a hidden screen, chess piece on a totem)
- Date easter eggs (snow in December, pumpkin late October, cherry blossoms early April, fireworks Jan 1)

## Out of scope / follow-up ADRs

- Full 8-step trading sequence (v2 — follow-up ADR)
- Photo mode (PNG export of current room)
- NPC compendium / "village book"
- Shareable result card (emoji grid)
- Dyslexia-friendly font toggle
- New Game+ with night palette
- Animated favicon
- Cross-game state plumbing (Wind Fish constellation in Snake)
- Mobile touch controls
- Speedrun timer / leaderboard
- Multiple save slots

## Resolved decisions (post-review pass 1)

1. **Name** — **Embershore** confirmed
2. **Player character name** — **player picks on first launch.** A small name-entry modal appears once after the wash-ashore intro: text input (max 8 chars, A–Z), three quick-pick buttons (**Finn**, **Cinder**, **Mavi**), and a "Continue" button. Default if the player hits Enter on an empty field: **Cinder** (ties protagonist to the Hearthwarden mythology). Stored in the save blob under `name`. All NPC dialogue uses `{name}` placeholder interpolation. This is genre-canonical (LA does it) and low-cost
3. **Sprite art source** — **hybrid pipeline**: use Gemini (or any browser image-gen) for *concept art* — NPC portraits in dialogue boxes, title-screen splash, environment mood frames, palette-anchor reference images. Hand-author the in-game 16×16 tiles and sprites from those references, because raster image-gen models do not produce true-pixel art (they produce *pixelated-looking* art at 64–128px that reads as blurry/inconsistent when displayed at 16×16). Concept-from-Gemini → hand-pixel-on-grid is the path with best cohesion-per-hour
4. **Music pack** — **Patrick de Arteaga's CC0 game music** (`patrickdearteaga.com`, all tracks released CC0). Specifically: pull the warm/cozy tracks for overworld + fishing + ending, and his more tense tracks for boss + dungeons. **Fallback**: if his catalog gaps any slot, supplement from OpenGameArt's CC0-only filter (avoid CC-BY-SA tracks — attribution drift across a static site is annoying)
5. **Date easter egg** — **seasonal-only triggers, no personal birthday**:
   - **Snow** in December (white particle layer over outdoor screens)
   - **Pumpkin** on the inn windowsill, October 25–31
   - **Cherry blossoms** drifting across overworld screens, April 1–15
   - **Fireworks** behind the title screen, January 1
   The user can wire up a personal-date trigger later by editing one constant
6. **Staging** — **three PRs from one ADR** (proof → content → polish), confirmed
7. **Mobile** — **desktop-only** confirmed

## Open questions

_None — ready to hand off to `/frontend-design` and `/feature-dev:feature-dev`._

## Handoff checklist

- [x] §0 canonical reference accurate (no hallucinated rules)
- [x] §3 includes gamepad mapping via `games/shared/` (extending `BUTTONS` per ADR-016 plan)
- [x] §8 brief ready for `/frontend-design`
- [x] §9 brief ready for `/feature-dev:feature-dev`
- [x] §10 lists 20 candidate ideas, each marked ship/park/drop
- [x] §13 has explicit v1 cut line
- [x] ADR file written

**Next step**: user reviews this ADR. On confirmation, invoke `/frontend-design` with the §8 brief and `/feature-dev:feature-dev` with the §9 brief in parallel. **Do not write game code before both skills have returned.**
