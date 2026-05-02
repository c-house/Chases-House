---
# ADR-017: Underhearth — a roguelike

**Status**: Draft (planning pass — awaiting review before design/implementation)
**Date**: 2026-04-24

## Summary

Add a turn-based, procedurally-generated dungeon crawler to the gallery, descended from *Rogue* (1980) → *NetHack* → *Brogue* (2009). D&D medieval fantasy theme: a single hero (Knight, Archer, or Mage) descends N floors of a randomized dungeon, fighting goblins/trolls/dragons, managing HP / MP / hunger / scrolls / potions, and trying to retrieve the **Amulet of the Hearth** from the bottom and climb back out alive. Permadeath. Deterministic per-seed. Pure keyboard, pure ASCII (chunky monospace, full color), pure DOM grid — no Canvas, no framework, no backend. Deeply replayable from a few hundred lines of orthogonal logic — by some margin the highest fun-per-line-of-code on the gallery.

Folder: [games/underhearth/](games/underhearth/). Display name: *Underhearth* — confirmed 2026-04-25 (workshop preserved below for the record).

## Name workshop

The site convention is single evocative noun (sudoku, chess, snake, jeopardy, pacman, crossword). "Roguelike" is a genre, not a name. "Dungeon" is honest but flavorless. Candidates:

| Name | For | Against |
|------|-----|---------|
| *Dungeon* | Zero ambiguity, immediate genre signal. | Bland. No tie to the site's identity. Reads like a placeholder. |
| *Delve* | Short, verbs-as-noun, captures the activity. | Sounds like a SaaS product. |
| *Vellum* | Ink-on-parchment ties the visual direction. | Doesn't read as a game — could be a note-taking app. |
| *Lantern* | The player *is* the lantern (candle-radius FOV is the central mechanic). | Trademarked by an existing dev tool. Too soft. |
| *Cinder* | Fits the ember palette. | Generic; many products. |
| *Embershore* | Warm-hearth tonality. | Already in use as a parallel ADR planning draft (017-embershore.md). Skip. |
| **Underhearth** | "What's beneath the hearth." chases.house = the cozy home above; *Underhearth* = the dungeon below the floorboards. The macguffin is already named *Amulet of the Hearth* (§0) — recovering it from the underhearth becomes thematically tight. Single invented word, no brand collision, evokes "Underdark" without copying. | Mild portmanteau coinage. |

**Confirmed: *Underhearth*** (2026-04-25). Folder: [games/underhearth/](games/underhearth/).

## §0 Canonical reference

- **Genre & lineage:** Traditional roguelike. Lineage: *Rogue* (Toy/Wichman/Arnold, 1980) → *Hack* → *NetHack* (1987–) → *Angband* / *ADOM* → *Brogue* (Brian Walker, 2009 — the most relevant ancestor: tight, elegant, ASCII-only, ~30-floor runs in 30 minutes) → modern *Dungeon Crawl Stone Soup*, *Caves of Qud*, *Cogmind*. The "Berlin Interpretation" (2008) codifies the canonical factors: random environment, permadeath, turn-based, grid-based, non-modal, complexity, resource management, hack'n'slash, exploration & discovery.
- **Core loop (one sentence):** Walk a turn at a time through procedurally-generated rooms, decide *fight / flee / use a finite resource* on every encounter, and trade short-term safety against descending deeper for better loot.
- **Win/lose/score:** Win = retrieve the macguffin from floor N and ascend back to floor 1. Lose = die (permadeath — no reload, no save-scumming on the same seed). Score = depth reached × gold collected + win bonus, with a tiebreaker on turn count.
- **Iconic moments:**
  1. **The narrow escape** — 3 HP, surrounded, drink the unidentified blue potion, it's *healing*, you live.
  2. **The unwise zap** — read an unidentified scroll mid-fight, it's *teleport*, you land next to a sleeping dragon.
  3. **The identification gambit** — quaff the unknown potion *now*, on a full-HP floor, to learn what it is before you need it.
  4. **The corridor stand** — fight a mob one-at-a-time in a 1-tile passage instead of getting swarmed in the open room.
  5. **The death epitaph** — "Killed by a goblin on level 4 after 1,247 turns. Carrying: a wand of *something*."
- **Rules amateur clones botch:**
  - **Identification game** — magic items must start *unidentified* (random alias per seed: "blue potion", "twisted wand"). Stripping this out turns roguelikes into a damage spreadsheet.
  - **Energy / speed system** — fast monsters get extra turns per player turn; slow monsters skip turns. Naive 1:1 turns make speed potions/boots meaningless.
  - **Field of view + memory** — only the currently-visible tiles render at full intensity; previously-seen tiles render dim ("remembered"); unseen tiles are black. No global vision.
  - **Hunger / food clock** — the slow tightening that prevents infinite stair-grinding for HP regen. Without it, optimal play is "rest forever."
  - **Resource curve** — HP regen, identification scrolls, healing potions all scale *with* difficulty, not against. Brogue's elegance is famously about this.
  - **Confirmations on irreversible actions** — quaffing the wrong potion is fair; quaffing it because you mis-keyed and the game didn't ask is not.
- **Era / look:** Late-80s monochrome terminal *honesty*, 2009-Brogue color *richness*. Chunky, readable, glyph-first.

## §1 Fit for chases.house

- **Why this game:** Gallery has turn-based abstract strategy (chess, checkers), real-time arcade (snake, pacman, asteroids), solo puzzles (sudoku, crossword), party (jeopardy), real-time strategy (castle-tower-defense if shipped). **Missing: a deep, replayable, permadeath solo run.** Roguelikes are the canonical answer — and they uniquely *thrive* on a static site (fully deterministic, no animation budget, keyboard-driven, infinitely replayable from the same files).
- **Solo / multi:** **Solo only.** Multi-player roguelikes exist (*Rogue Online*, *Crawl Online*) but they betray the genre's introspective core. Drop.
- **Session length:** **15–30 minute runs** (Brogue model). Long enough to invest, short enough that death doesn't ruin your evening. Death-to-restart in <2 seconds.
- **Dealbreakers:** None. No backend, no networking, no anti-cheat. Determinism is *desirable*, not a problem. Fits the static-site model better than any other genre on the list.

## §2 Players & Modes

| Mode | v1 | Reason |
|------|----|--------|
| Single-player | **Ship** | The genre is solo. |
| Local hot-seat | Drop | Roguelikes don't pass-and-play — turns are private, runs are introspective. |
| Local versus | Drop | Different genre. |
| Online MP | Drop | Betrays the genre + needs Firebase + matchmaking. YAGNI. |
| Spectator/host | N/A | No host distinction. |
| AI opponents | N/A — but extensive AI for **monsters**. |

Three classes for v1, all single-player: **Knight** (high HP, melee, weak magic), **Archer** (mid HP, ranged, traps), **Mage** (low HP, spells, weak melee). Class choice is the only "mode" knob.

## §3 Controls & Input

Roguelikes have a famously deep keymap. v1 keeps the canonical set; nothing exotic.

### Movement — keyboard-as-joystick (responsive two-key combo)

The input layer tracks the **currently-held set** of movement keys. The intended direction is the sum of held cardinal vectors, clamped to 8-way, recomputed every step from the live held-set so the keyboard mirrors a joystick's behaviour:

- `↑` alone → N. Press `→` *while still holding `↑`* → immediately switches to NE on the next step. Release `→` (still holding `↑`) → returns to N. Release both → stop.
- **Opposing keys cancel** on that axis: `↑` + `↓` = no vertical component (so `↑` + `↓` + `→` = E).
- **Single deliberate press = single step** = single turn. **Held key = walk-repeat**, with timings grounded in the table below.
  - **Initial delay (DAS): 180 ms.**
  - **Repeat rate (ARR): 90 ms per step** (~11 steps/sec).
  - When a *second* movement key is pressed while another is already held, the new direction takes effect on the **next ARR tick** — not waiting for a fresh DAS, so the joystick-replicate diagonal is responsive without re-arming the tap-vs-hold disambiguation.
  - Both timings are constants in `input.js`; **expose ARR** as a settings slider (60–150 ms) when a settings panel ships, **keep DAS fixed** at 180 ms (per competitive-Tetris evidence: players tune ARR far more than DAS).

  **Why these numbers** (research summary, full sources cited in the §3 footnote):

  | Reference | DAS | ARR | Note |
  |-----------|-----|-----|------|
  | Tetris Guideline (modern) | 167–300 ms | 33–50 ms | Default for guideline-compliant Tetris implementations |
  | Tetr.io / Jstris defaults | 167–170 ms | 33 ms | Tetris with very fast ARR — extreme by genre standards |
  | Competitive Tetris players | 50–110 ms | 0–10 ms | Trained users; not a default |
  | macOS keyboard repeat (typing) | ~500 ms | ~90 ms | Typing context — DAS deliberately slow |
  | Windows keyboard repeat (typing) | ~500 ms | ~33 ms | Same |
  | NetHack / Brogue / DCSS / ToME | (no auto-repeat) | (n/a) | Single-step + explicit `Shift+dir` run mode |
  | Caves of Qud | brief | unconfirmed | Modern roguelite — does auto-repeat on hold |
  | Real-time games (Hades, Stardew, etc.) | 0 | per-frame (~16 ms) | Concept doesn't apply; per-tick velocity |
  | HCI tap-duration ceiling (Card et al.) | 80–150 ms | — | Above 150 ms = "user is holding, not tapping" |
  | Steve Swink, *Game Feel* | — | <100 ms | Sub-100 ms feels "instant"; >250 ms feels laggy |

  **180 / 90 ms** sits just above the human tap ceiling (so a deliberate single press cannot double-step) and matches the macOS typing repeat (familiar cadence). It is faster than every typing-context default and slower than competitive Tetris — appropriate for a turn-based game where an unintended extra step has gameplay consequences (walking into a trap, eating a monster's free hit). The interrupt rules (FOV / HP / item / corridor branch) cap the worst-case "I held too long" outcome at one extra step.
- **Walk-repeat halts on**: monster entering FOV, low-HP threshold crossed (≤25 %), item underfoot, branching corridor, hunger state change, or any non-movement keypress. Same interrupt rules as classic NetHack run-mode, just driven by held-keys instead of an explicit `Shift+direction` modifier.

Cardinal/diagonal key sources:
- **Cardinals**: arrow keys, `WASD`, `hjkl` (vi-keys), or `numpad 8/4/6/2`.
- **Native single-key diagonals** (where supported): `yubn` (vi-keys), `numpad 7/9/1/3`. These remain instant-step *without* needing the held-set summing.
- **Wait one turn**: `.` or `numpad 5`.
- **Auto-explore current floor**: `o`. Same interrupt rules as walk-repeat.
- **Stairs**: `>` descend, `<` ascend.

This collapses NetHack's separate `Shift+direction` run mechanic into the natural feel of holding a key. Single deliberate keystrokes still get single deliberate turns; held keys get continuous walking; combined held keys get diagonal walking; releasing one key returns to the cardinal continuum without a stutter step. The interrupt rules preserve the genre's "deliberate per turn near danger" property — held-walking auto-stops the moment anything matters.

### Actions (single-key, NetHack-canonical)
`g` get/pickup · `i` inventory · `q` quaff potion · `r` read scroll · `z` zap wand · `w` wield weapon · `W` wear armor · `t` throw · `f` fire bow · `s` search adjacent tiles · `?` help · `Esc` close any modal · `Space` confirm/dismiss messages.

### Mouse
- Click any visible tile → walk-to (pathfinds, halts on monster sight).
- Click a monster → fire/throw if equipped to do so (else describe).
- Hover any tile → tooltip with what's there.

### Gamepad — full Xbox scheme via [`window.SharedGamepad`](games/shared/gamepad.js)

**This ADR owns extending `SharedGamepad.BUTTONS` to the full Xbox scheme.** ADR-016 deferred these buttons "until a consumer needs them"; this is that consumer (Castle Tower Defense flagged the same need — its ADR inherits the extension). The extension lands as a small standalone PR *before* this game's `input.js` consumes it, so DRY is preserved and CTD picks up a stable shared module.

Button table (Xbox naming, matches the W3C Gamepad API standard mapping):

| Button | Index | Used here for |
|--------|-------|---------------|
| `A` | 0 | confirm · pickup · "OK" |
| `B` | 1 | cancel · close modal |
| `X` | 2 | quick-quaff most-recent potion |
| `Y` | 3 | wait one turn |
| `LB` | 4 | open inventory |
| `RB` | 5 | open quick-actions menu |
| `LT` | 6 | ascend stairs (when standing on `<`) |
| `RT` | 7 | descend stairs (when standing on `>`) |
| `BACK` | 8 | save & quit menu |
| `START` | 9 | pause/resume; on title screen, "Begin descent" |
| `LS` / `RS` | 10–11 | reserved (unused v1) |
| `DPAD_UP/DOWN/LEFT/RIGHT` | 12–15 | already in `BUTTONS` (ADR-016) |

**Movement parity with keyboard:** D-pad cardinals → cardinal move. Two D-pad buttons held simultaneously → diagonal (same held-set summing rule as keyboard). Left stick → 8-way move via deadzone'd quadrant detection. The gamepad joystick *is* the canonical model; the keyboard explicitly mimics it.

**Rumble:** short on hit-given · long on hit-taken-while-low-HP · ascending pattern on amulet-grab · defeat pattern on death.

### Mobile / touch
- Tap tile = walk-to (same as mouse).
- Long-press tile = describe.
- **On-screen action dock** (bottom of screen) with the 6 most-used actions: pickup, inventory, quaff, read, descend, wait. Full keymap accessible only via inventory drill-down on mobile.
- **Mobile is a second-class but real target** — the game is grid + glyphs + tap, which works fine on a phone. Won't optimize for landscape vs portrait; pick one (portrait, narrow dungeons).

### Accessibility
- **Colorblind-safe**: every monster glyph is *also* a unique letter. Never differentiate two threats by color alone. (`g` goblin / `G` greater goblin / `T` troll / `D` dragon — the canonical roguelike convention is already a11y-friendly by accident.)
- **Reduced-motion**: kills tile-shake on hit and the descent-floor wipe; honors `prefers-reduced-motion`.
- **Screen-reader narration of key events**: ARIA-live region echoes the message log. Genuine roguelike accessibility win — the game *is* text.
- **Remappable keys**: parked for v2.

### Input feel
- **No buffering** (turn-based — there is nothing to buffer). One key = one turn = one render.
- **Run-stop sensitivity**: configurable threshold for "stop running because I see something."
- **Confirmation gates** on irreversible moves into known danger (walking onto known traps, attacking peaceful NPCs) — `y/n` prompt with a "remember my answer this run" toggle.

## §4 UI / UX

| Screen | Primary | Secondary | Back-out | Mobile |
|--------|---------|-----------|----------|--------|
| Title / attract | "Begin descent" | "How to Play", "Daily Seed" | n/a | full-width buttons |
| Class select | tap a class card (Knight / Archer / Mage) | seed input field (optional) | back to title | 1-col stack |
| Active play | walk / fight / loot | open inventory, quick-actions | n/a (turn-based; no time pressure) | dock at bottom |
| Inventory modal | use / equip / drop | close | `Esc` / `i` again / tap-out | full-screen overlay |
| Targeting overlay | aim ranged attack, line preview | confirm / cancel | `Esc` | tap target tile |
| Death / epitaph | "Try again" (instant) | "View memorial" | back to title | centered |
| Memorial / scoreboard | top-10 runs (initials, depth, class, cause of death, date) | clear (with confirmation) | back | scroll list |
| How-to-play | inline first-floor tutorial (3 popups, dismissible) | "Skip tutorial" | inline | inline |

**Active-play HUD** (always-visible, anchored, never overlaps the dungeon):

- **Top bar**: class name, character icon, floor depth, turn count.
- **Left bar**: HP bar, MP bar, hunger meter, status effects (burning, slowed, blessed).
- **Right bar**: condensed inventory (top 4 quick-slots: equipped weapon, equipped armor, last-used potion, last-used scroll).
- **Bottom strip**: scrolling message log (last 3 lines visible, full log in a `Tab` overlay).
- **Center**: the dungeon glyph grid.

**Pause is implicit** — every keystroke is a turn; not pressing a key is pause. Inventory and menus do not consume turns. Quit-to-title saves the run.

## §5 Progression & Persistence

- **Run save (resume)**: full game state serialized to `localStorage` after every turn. Key: `dungeon:current-run`. On title screen, "Continue" appears if a run exists. Closing the tab mid-run does not lose progress. Death clears the save.
- **High-score memorial**: top 20 runs, key `dungeon:memorial`, schema `{ initials, class, depth, gold, won, causeOfDeath, turns, seed, date }`. **`seed` is recorded** so a run can be replayed verbatim from the title screen.
- **Identification memory persists across runs?** **No.** Aliases re-randomize per seed (canonical roguelike rule — meta-knowledge belongs to the player, not the save file).
- **Daily seed**: title screen offers "Daily Run" — a deterministic seed derived from `YYYY-MM-DD`. All players who play the daily play *the same dungeon*. Memorial separates daily runs into their own table for fair comparison. (Wordle-style social hook — the cheapest replay-ability flywheel that exists.)
- **Unlockables**: none in v1. (Three classes from the start; YAGNI on meta-progression.)

## §6 Difficulty & Game Feel

- **Difficulty curve**: depth *is* the curve. Floor 1 = three goblins. Floor 5 = trolls + first wand. Floor 10 = first dragon. Floor 15 = the amulet floor + a hard climb back. v1 ships **15 floors** (Brogue ships 26, NetHack ~50; 15 is enough to feel deep without bloating content authoring).
- **Onboarding**: first-floor tutorial — three sequential dismissible popups: (1) "Walk with arrow keys or click. Bump into the goblin to attack." (2) "Press `g` over the dagger to pick it up. Press `i` to see your inventory." (3) "Find the `>` and press `>` to descend." Dismiss-all toggle. `localStorage` flag remembers dismissal.
- **Rubber-banding**: none. Difficulty toggle is **class choice** (Mage = hard, Knight = forgiving) and **seed luck** (some seeds are kind, some hostile — that's roguelikes).
- **Feedback loops**:
  - HP-low (< 25%) tints the screen edges red and pulses subtly.
  - Hit-given: 1-frame glyph flash on target.
  - Hit-taken: 1-frame screen shake (off in reduced-motion).
  - Pickup: gold ✦ briefly twinkles into the gold counter.
  - Identify: scroll/potion/wand glow once gold when first identified.
  - Stair descent: brief vertical wipe + "*You descend to the 5th floor.*" message log entry in italic.
- **Juice signature**: the **death epitaph card**. When you die, the screen darkens to deep bg; a parchment card slides up centered; centered Fraunces "**Killed by a Troll on level 7**", below it "carrying: an unidentified scroll, 47 gold, a *flickering* wand", below that "1,438 turns · seed `WARMHEARTH-042`". A button: "Try again." That card is the single piece of game feel that has to be flawless — it is the moment the player decides whether to start another run or close the tab.

## §7 Audio

- **Music**: **none in v1.** Roguelikes are quiet by tradition (the rhythm of keyboard taps *is* the music). Adding a loop adds risk (the Pac-Man buzz incident, ADR-014) for marginal reward.
- **SFX inventory (≤ 10, all CC0 samples)**: footstep, melee hit, melee miss, monster die, item pickup, gold pickup, quaff/read, stair descent, low-HP heartbeat (one-shot, fires once when crossing 25%), death sting.
- **Source**: CC0 samples (matches Pac-Man / ADR-014 precedent, since the synthesis route already burned us once). Tiny budget — a single-digit number of one-shots.
- **Mute / volume**: persisted at `dungeon:audio` (`{ muted: bool, volume: 0..1 }`). Muted is a totally legitimate way to play this game; default volume 50%. First-keystroke unlocks Web Audio (browser autoplay gate).

## §8 Visual brief (handoff to `/frontend-design`)

> **Mood:** *candlelit · vellum · hand-inked · braided-shadow · slightly-haunted · honest-monospace.* The dungeon should look like an illuminated manuscript that animates one tile at a time — letters, not sprites; ink, not pixels.
>
> **Era / reference:** Late-1980s VT-220 terminal *honesty* fused with 2009 *Brogue's* color richness. Reject pixel-art tilesets entirely — ASCII glyphs are the iconic look. Reference: Brogue's color palette (warm walls, cool water, vivid flames), NetHack's tile-letter convention (`@` you, `g` goblin, `D` dragon), illuminated-manuscript marginalia for chrome.
>
> **Palette:** Extends the site's Warm Hearth tokens — this is the genre that can use them most natively.
>   - Walls: `--accent-ember` `#a06828` (warm stone, lit) → fading to `#3a2a1f` (remembered, dim) → black (unseen).
>   - Floors: muted parchment `#1a1612` with `--text-faint` dot pattern.
>   - You (`@`): `--accent-glow` `#e8b04a` — a small candle in the dark.
>   - Friendlies / merchants: `--sage` `#6a7d5a`.
>   - Enemies: graded by danger — `--text-muted` (trivial) → `--terracotta` `#b05a3a` (real threat) → bright crimson outside the palette (lethal — the one justified break).
>   - Items: `--accent-gold` `#c8943e` glow on first sighting, dimmer once seen.
>   - Magic effects: violet/indigo (a small allowed expansion — magic is *meant* to feel outside the warm palette).
> **The break from the site palette is minimal and earned.** Crimson for "you might die" and indigo for "this is magic" are the two non-warm colors; everything else is the site's existing tokens applied to a dungeon.
>
> **Typography:** Monospace for the dungeon glyphs — propose a chunky humanist mono (Fira Code, JetBrains Mono, or Berkeley Mono if available; final pick from `/frontend-design`). Glyphs sized at ~18–22 px on desktop, scaled larger on mobile. **Fraunces** for the death-epitaph card, the title screen, and any in-world inscription overlay (book pages, scroll text). **Bricolage Grotesque** for HUD numerics (HP / MP / depth / gold / turn count) and tooltips.
>
> **Motion language:** **Almost none.** Turn-based games are killed by gratuitous animation. The *only* motion is: glyph hit-flash (single frame), HP-low edge pulse (slow, subliminal), parchment-card slide on death (one of the only "big" moments), stair-descent wipe (200 ms vertical), and identification glow (single fade).
>
> **Iconography:** ASCII characters only for the dungeon. SVG for HUD icons (heart, mana drop, hunger crumb, gold coin, the three class crests on the title screen). No sprite sheet.
>
> **Backgrounds & environments:** Subtle parchment grain *behind* the glyph grid (extends the site's existing grain texture). Floor-themed tints — caves are warmer, crypts are bluer, dragon's lair has a faint ember pulse.
>
> **Hero frame for the gallery card:** Mid-game shot. The `@` symbol in glow-gold, candle-radius of fully-lit warm-ember walls around it, dim-ember "remembered" tiles fading off into black, three `g` goblins approaching from a corridor with the rightmost one mid-hit-flash, one `!` potion glyph glowing, the HUD strip on the left showing `HP 14/22 · MP 6/8 · Depth 4`. Fraunces title at top: "*Underhearth*."
>
> **The one detail nobody asked for:** **The candle flicker.** The lit-radius around `@` shifts subtly between two slightly-different ember tints on a slow random pulse (every 1.5–4 s, per-tile, ε saturation shift). Costs almost nothing; sells the candlelit-dungeon aesthetic instantly. (Optionally amplifies near oil lamps on the floor — a v2 idea.)

## §9 Architecture brief (handoff to `/feature-dev:feature-dev`)

> **Folder:** [games/underhearth/](games/underhearth/).
>
> **Files (start with the minimum; justify any additions):**
>
> | File | Role |
> |------|------|
> | `index.html` | page shell, inline CSS, script tags, ARIA-live region for screen-reader log |
> | `game.js` | entry, top-level state, FSM, public `window.Underhearth` |
> | `dungeon.js` | procedural floor generation: rooms + corridors (BSP or rooms-and-tunnels), stair placement, monster/item spawn tables per depth |
> | `entities.js` | data tables: monsters (glyph, color, HP, dmg, AI tag, speed), items (potions, scrolls, wands, weapons, armor) — extended by adding rows |
> | `engine.js` | turn engine, energy/speed system, FOV (recursive shadowcasting or symmetric pre-compute), pathfinding (A* — only for click-to-walk and run/auto-explore; monsters use simple BFS toward `@` when in sight) |
> | `render.js` | DOM grid renderer (one `<span>` per tile, recycled — no innerHTML thrash), HUD updates, candle-flicker tick, screen-reader log echo |
> | `input.js` | keyboard + mouse + touch + `SharedGamepad`; centralized "intent → action" mapper. Owns the held-keys set, the walk-repeat scheduler, and the joystick-replicate diagonal-summing logic that powers movement (§3). Walk-repeat halts on the standard run-stop interrupt list. |
> | `audio.js` | Web Audio one-shot bus (~10 CC0 samples), mute/volume persistence |
> | `audio/` | CC0 sample files + per-Pac-Man-precedent `LICENSE.txt` |
>
> Eight code files for a roguelike is *modest* — these systems are genuinely orthogonal (FOV, pathfinding, identification, AI, generation each want their own module). Resist further splitting (no `monsters.js` + `items.js` until one of them passes ~500 lines).
>
> **Module pattern:** `window.<Submodule>` per file (matches Chess multi-file precedent). Top-level public surface is `window.Underhearth.start()`.
>
> **State shape:** Single state object owned by `game.js`; explicit FSM `title → classSelect → playing(walking|targeting|inventoryOpen|menuOpen|messagePrompt) → death → memorial`. Mutations route through engine functions (`engine.executePlayerTurn`, `engine.executeMonsterTurns`) — not scattered.
>
> **RNG:** Seeded **mulberry32** or **xoroshiro128**. Single global `rng` instance per run, re-seeded on `start()` from the user's seed input or `Date.now()`. **All randomness goes through this RNG** — `Math.random()` is forbidden in this game's code (lint-by-grep at review time). Determinism unlocks daily seeds, replays, and bug-report reproducibility for free.
>
> **Render approach:** **DOM grid** of `<span>` elements, ~80×24 cells (≈ 1,920 spans). Each cell has a fixed `id`; `render.js` mutates `.textContent` and `.className` per turn. No Canvas, no WebGL — DOM is faster *and* more accessible at this glyph count and update rate. (Roguelikes are turn-based — we redraw on player input, not 60 Hz.)
>
> **Tick loop:** **Event-driven, not RAF.** Player input → engine processes one player turn → engine processes monster turns until next player turn comes due (energy system) → render once → wait for next input. The candle-flicker is the *only* RAF loop, and it touches CSS variables, not DOM structure.
>
> **FOV:** Symmetric recursive shadowcasting (canonical roguelike algorithm; ~150 lines, well-documented references exist). Each frame: clear "currently visible" set, raycast from `@` out to a radius (8–10 tiles, lower in dim corridors), mark seen tiles into a per-floor "remembered" bitmap. Render uses the three-state mask: visible (full color) / remembered (dim ember) / unseen (black).
>
> **Procedural generation:** Rooms-and-corridors approach (simpler than BSP, easier to tune). 5–10 rooms per floor, connected by L-shaped corridors. Stairs in two different rooms. Monsters and items spawn from depth-keyed weighted tables. **Generation must be deterministic from the seed** — any non-deterministic order breaks the daily-seed feature.
>
> **Shared utilities:**
>   - **This ADR owns the [games/shared/gamepad.js](games/shared/gamepad.js) `BUTTONS` extension** to the full Xbox scheme (table in §3). Lands as a small standalone PR before this game's `input.js` consumes it; CTD inherits it for free.
>   - **Do NOT extract a shared FOV / pathfinding / RNG / message-log helper.** This is the only consumer; YAGNI applies hard. Revisit only if a second game needs them.
>   - Same `localStorage` situation as every other game — small per-game JSON blobs; the cross-game helper can wait for a 7th caller (this would be that 7th, but the helper itself is its own ADR per CTD's note).
>
> **Networking:** None.
>
> **Verification (per CLAUDE.md MCP protocol):** Boot dev server → navigate → snapshot → screenshot title, class-select, active-play (forced seed for repeatability), inventory modal, death epitaph card → simulate a deterministic 50-turn run via key dispatches → confirm message log content matches a recorded transcript → `list_console_messages types:["error"]` empty → `list_network_requests` clean (only the audio samples). The deterministic-seed property makes regression testing this game uniquely cheap.

## §10 Adjacent / orthogonal / perpendicular ideas

| # | Idea | Class | v1 |
|---|------|-------|----|
| 1 | Three classes (Knight / Archer / Mage) | Adjacent | **Ship** |
| 2 | Daily seed + memorial separate table | Adjacent | **Ship** (the social hook is too cheap to pass up) |
| 3 | Shareable result card (Wordle-style emoji + depth/seed string) | Orthogonal | Park (build after daily lands) |
| 4 | Replay viewer (re-play a saved run from seed + input log) | Orthogonal | Park |
| 5 | Custom seed input on title screen ("type a word to play that dungeon") | Adjacent | **Ship** (already implied by daily seeds; trivial UI) |
| 6 | Identification puzzle (unidentified potions / scrolls / wands with per-seed aliases) | Adjacent | **Ship** (it's table-stakes — a "roguelike" without ID is a damage spreadsheet) |
| 7 | Pet companion (mage's familiar, knight's hound) | Adjacent | Park |
| 8 | Vault rooms / shops / library (special rooms) | Adjacent | Park (one variant only in v1: a single "treasure room" on a random floor) |
| 9 | Boss floors (mid-game troll king, end-game dragon) | Adjacent | **Ship** (final dragon on floor 15) |
| 10 | Memorial wall (top-20 runs persistent locally) | Orthogonal | **Ship** |
| 11 | "Ghost of last death" — the corpse of your previous run sits on the floor where you died, lootable for partial gold | Perpendicular | **Ship** (delightful, ~30 LOC, sells the permadeath theme) |
| 12 | Konami-code "wizard mode" (debug / cheat) | Perpendicular | Park (useful for development; gate behind a flag) |
| 13 | Date-keyed dungeon flavor (October = bone walls; December = ice floors) | Perpendicular | Park |
| 14 | Cross-game "House Cup" leaderboard | Cross-game | Drop (its own ADR, not roguelike-specific) |
| 15 | Reduced-motion + colorblind-safe (genre is already mostly there) | A11y | **Ship** (cheap and right) |
| 16 | Screen-reader narration via ARIA-live message log | A11y | **Ship** (genuine genre win — the game *is* text) |
| 17 | Mascot in the title screen (a small `m` mouse that scurries idly) | Perpendicular flourish | Park |
| 18 | Procedural item names ("the Frostbitten Sword of Whispers") | Perpendicular | Park (fun; bloats content for v1) |
| 19 | Tutorial popups on floor 1 (3 dismissibles) | Adjacent | **Ship** |
| 20 | "Closest you got" — death card shows your best previous depth on this seed | Failure-mode gift | Park (cute; not v1) |
| 21 | Candle-flicker on the lit radius | Perpendicular flourish | **Ship** (the §"§8" "one detail nobody asked for") |

Total candidates: 21. v1 ships: 9 (#1, #2, #5, #6, #9, #10, #11, #15, #16, #19, #21). Park: 11. Drop: 1.

## §11 Fun audit

1. **10-second hook:** You see `@` glow gold in candlelight, surrounded by ember walls and three goblin `g` glyphs in a corridor. You bump into the first one. It dies in two hits. Gold ticks up. The dungeon breathes. You want one more turn.
2. **Skill ceiling:** Resource management mastery — when to identify, when to hoard, when to descend without full HP, how to pull mobs into corridors. Veterans 15-floor on the daily seed. Casuals die on floor 4 and laugh at the epitaph. Both leave satisfied.
3. **Story you tell a friend:** "I was on floor 13 with 4 HP, I drank an unidentified potion *praying* for healing — it was *paralysis* — I just had to watch the troll walk over and kill me." Permadeath + identification = inexhaustible anecdote generator.
4. **Surprise:** The first time you read a scroll and the entire floor map fills in. Or the first time you zap a wand and the goblin *teleports*. Or the first time you find your previous run's ghost on floor 6.
5. **Restart friction:** Death epitaph card → "Try again" button → new seed loaded, class re-selected from last choice, on the floor-1 spawn tile in **<2 seconds**. (Brogue's restart cadence is the gold standard; we match it.)

## §12 Beauty audit

- **Hero frame:** described in §"§8" — `@` candlelit in warm ember walls, three goblins in a corridor, one mid-hit-flash, HUD strip on the left, Fraunces "Underhearth" title.
- **Negative space:** the unseen black around the candle radius is the negative space. The dungeon you *can't* see is as important as the part you can — that's the whole game.
- **Readability under pressure:** glyphs are 1 character; HP bar is fixed-position; the message log is bottom-anchored and only ever shows the last 3 lines. At maximum chaos (10 monsters in view, low HP, 4 status effects) the player can still parse the screen because there's nothing decorative to filter out. Glyph + color + position. Done.
- **Cohesion with chases.house:** the warm ember walls and gold `@` are *the most direct expression of the site's palette of any game in the gallery.* The site looks like a candlelit hearth; the dungeon looks like the same hearth's shadows.
- **The one detail nobody asked for:** the candle-flicker on the lit radius (item #21 above).

## §13 Scope discipline

```
## Architectural Decision: Recreate a roguelike on chases.house

DRY:   Reuses games/shared/gamepad.js (with the BUTTONS extension also requested by
       Castle Tower Defense — whoever ships first does it). Does NOT duplicate audio,
       FOV, RNG, or pathfinding from any existing game. Does duplicate the per-game
       localStorage pattern (now ~7 callers); the shared helper is its own ADR per the
       CTD note, not blocking here. → No avoidable duplication.

YAGNI: Drops online MP, hot-seat, replay viewer, custom keybinds, pet companions,
       procedural item names, custom shops/library/vault, "House Cup" cross-game scores,
       achievement system, seasonal palettes, mascot animation. None are required for
       the core loop.

SOLID: dungeon.js (generation) ≠ engine.js (turns/FOV/path) ≠ entities.js (data tables)
       ≠ render.js (display) ≠ input.js (intent) ≠ audio.js. game.js orchestrates only.
       entities.js extended by adding rows, not editing logic (open/closed). Single
       FSM in game.js is the source of state truth.

KISS:  ASCII glyphs, not tilesets. DOM grid, not Canvas. Rooms-and-corridors, not BSP.
       15 floors, not 50. Three classes, not twelve. CC0 samples, not synthesis.
       Symmetric shadowcasting (well-documented, ~150 LOC) over reinventing FOV.
       No music. No replays. No multiplayer. The smallest cut that still delivers the
       genre's iconic loop.

Decision: Proceed as planned.
```

### v1 (ship)

- Folder [games/underhearth/](games/underhearth/); display name *Underhearth*
- **Three classes** (Knight, Archer, Mage) — class is the difficulty knob
- **15 procedurally-generated floors**; final-floor dragon + Amulet of the Hearth; ascend back to floor 1 to win
- Permadeath + auto-save mid-run (closing tab ≠ losing run; only death clears it)
- Identification game: potions/scrolls/wands start unidentified with per-seed aliases
- Energy/speed turn system; symmetric shadowcasting FOV with three-state visibility (visible / remembered / unseen)
- **Input**: keyboard with **responsive two-key joystick-replicate movement** (held-set summing, 200/80 ms walk-repeat, run-stop interrupts), mouse (click-to-walk), touch (tap-to-walk + on-screen action dock), gamepad via the **full Xbox scheme** through `SharedGamepad` (this ADR owns the extension)
- **Seed system**: daily seed (Wordle-style, derived from `YYYY-MM-DD`) **plus** custom seed input on title screen (type any string to play that dungeon) **plus** "load seed from memorial" (re-play any prior recorded run from its `seed`). Memorial separates daily-run and free-run tables.
- **"Ghost of last death"** lootable corpse on the floor where you previously died
- ASCII rendering on a DOM grid; warm-hearth palette extended for dungeon use; candle-flicker on lit radius
- Up to ~10 CC0 SFX one-shots; no music in v1
- Reduced-motion + screen-reader (ARIA-live message log) + colorblind-safe glyph differentiation
- Tutorial: 3 dismissible popups on floor 1, skipped on subsequent runs
- Death epitaph card (the juice signature) — shows seed, class, depth, cause-of-death, "Try again" in <2 s
- Games-gallery card with `solo` tag
- Verification per CLAUDE.md MCP protocol on title, class-select, active-play (deterministic seed), inventory, death card

### Out of scope / parked for follow-up ADRs

- Shareable Wordle-style result card (after daily seed proves out)
- Replay viewer (record + play back input log + seed)
- Pet companion / familiar
- Special rooms beyond the single treasure room (shops, libraries, vaults)
- Procedural item naming
- Custom keybinding UI
- Date-keyed seasonal dungeon palettes
- Mascot mouse on title screen
- "Closest you got" on death card
- Konami / wizard / cheat mode
- Cross-game "House Cup" leaderboard
- Music
- BSP-based generation
- Bestiary / encyclopedia between runs
- More classes (Rogue, Cleric, Druid, …)
- Mobile landscape optimization (portrait only in v1)

## Resolutions

| # | Question | Answer |
|---|----------|--------|
| 1 | Name | **Underhearth** (confirmed 2026-04-25). Folder: [games/underhearth/](games/underhearth/). |
| 2 | Floor count | **15 floors.** |
| 3 | Class roster | **Three classes from the start** (Knight / Archer / Mage). |
| 4 | Arrow/WASD diagonals + held-key feel | **Responsive two-key joystick-replicate** with **DAS 180 ms / ARR 90 ms** (justified against Tetris Guideline, OS repeat defaults, NetHack/Brogue/DCSS conventions, and HCI tap-duration data — see §3 *Movement* table). Held-set summing for diagonals; second key press takes effect on the next ARR tick. ARR settings slider deferred to v1.1; DAS fixed. |
| 5 | `SharedGamepad` extension | **This ADR owns the extension**, full Xbox scheme (table in §3 *Gamepad*). Lands as a small standalone PR before `input.js` consumes it; Castle Tower Defense inherits the result. |
| 6 | Seed system | Daily seed **plus** custom seed input on title screen **plus** load-seed-from-memorial (replay any recorded run by its seed). Implemented together — they share one underlying `start(seedString)` entrypoint, so DRY. |
| 7 | Ghost of last death | **Ship in v1.** |

No remaining blockers. Ready to invoke `/frontend-design` (with §8) and `/feature-dev:feature-dev` (with §9).

---

## Handoff checklist

- [x] §0 canonical reference grounded in real genre lineage (Rogue → NetHack → Brogue) and the Berlin Interpretation
- [x] §3 includes gamepad mapping via [games/shared/](games/shared/), with a flagged extension to `BUTTONS`
- [x] §8 brief is ready to hand to `/frontend-design`
- [x] §9 brief is ready to hand to `/feature-dev:feature-dev`
- [x] §10 lists 21 candidate ideas, each marked ship/park/drop
- [x] §13 has an explicit v1 cut line
- [x] ADR file written to [docs/adr/017-underhearth.md](docs/adr/017-underhearth.md)

**All seven open questions resolved; name confirmed.** Ready to invoke `/frontend-design` (with the §8 brief) and `/feature-dev:feature-dev` (with the §9 brief).
