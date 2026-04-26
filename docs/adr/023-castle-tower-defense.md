# ADR-023: Castle Tower Defense

**Status**: Accepted (Implemented)
**Date**: 2026-04-24 (planning) → 2026-04-25 (implementation + verification)

> ADR number: this slot was renumbered from `017` (originally claimed during planning) to `023` to avoid collisions with several other parallel branches that landed at `017` (asteroids, firebase-security, shared-leaderboard, underhearth, uno, yahtzee). The next free integer at sign-off was 023. Internal code references (e.g. the `localStorage` 7th-caller note in [game.js](../../games/castle-tower-defense/game.js)) point to ADR-023.

## Summary

Single-player, real-time tower-defense game: enemies walk a fixed path across a hand-authored map, the player builds and upgrades towers on adjacent build slots, and survives a scripted set of waves. v1 shipped with three maps × three difficulties, four tower types, six enemy types, mouse + keyboard + gamepad input, local-only persistence (best stars per map+difficulty), and a parchment-and-ink medieval visual direction that extends the site's gold/ember/terracotta tokens.

Lives in [games/castle-tower-defense/](../../games/castle-tower-defense/) — lowercase-hyphen, matching `pacman`, `tic-tac-toe`, etc. See **§Implementation** at the bottom of this ADR for what landed; sections §0–§13 record the original planning decisions for posterity.

## §0 Canonical reference

- **Genre & lineage:** Wave-based, fixed-path tower defense in the medieval/fantasy idiom. Lineage runs WC3 custom maps (Element TD) → Desktop Tower Defense (2007 Flash) → Bloons TD, GemCraft, Kingdom Rush (2011), Plants vs. Zombies. "Castle Tower Defense" is the medieval-themed cut of this genre.
- **Core loop (one sentence):** Place towers along a path so they kill waves of enemies before the enemies reach the castle, spending the gold each kill drops to buy and upgrade more towers.
- **Win/lose/score:** Win = survive all scripted waves with at least one life left. Lose = an enemy reaches the castle while lives are at zero. Score = stars (1–3) based on lives remaining at the end + a numeric tiebreaker (gold spent vs. earned).
- **Iconic moments:**
  1. The "barely saved" wave — last enemy dies one tile from the gate.
  2. A maxed-out tower one-shotting a boss.
  3. Adapting on the fly when a flying enemy bypasses ground towers.
  4. The satisfying "wave cleared" beat after a tense run.
  5. The aha! placement that makes the whole map suddenly cheap to defend.
- **Rules amateur clones botch:**
  - Pathfinding/blocking validation when towers are placed (not relevant here — we use *fixed* paths with build slots, see §13 KISS).
  - Tower projectile leading (must aim ahead of moving enemies).
  - Enemy resistances/types (armored, fast, flying that ignores ground attackers).
  - Sell value (refund 75% so experimentation isn't punished).
  - Wave preview (player must see what's coming before it starts).
  - "Send next wave early" bonus for impatient players.
- **Era / look:** Modern flat-illustration storybook (Kingdom Rush, but with the chases.house parchment/ink overlay). Not pixel-art, not 3D — bold silhouettes with ink linework.

## §1 Fit for chases.house

- **Why this game:** The gallery has turn-based strategy (chess, checkers), real-time arcade (snake, pacman), solo puzzles (sudoku, crossword), and party multiplayer (jeopardy). Missing: a **methodical real-time strategy** game with progression hooks. TD fills that — slower than pacman, deeper than snake, replayable across maps and difficulties.
- **Solo / multi:** Solo only. TD is at its best alone; co-op and versus TD are different genres entirely (drop, see §2).
- **Session length:** 5–15 minutes per run. Right size for a casual visit, generous enough for a real loop.
- **Dealbreakers:** None. Purely client-side. No matchmaking, no anti-cheat, no server.

## §2 Players & Modes

| Mode | v1 | Reason |
|------|----|--------|
| Single-player | **Ship** | Core experience |
| Local co-op | Drop | Doubles UI complexity (two cursors, two economies) for thin payoff |
| Local versus | Drop | "Rush mode" TD is a different game; would need separate map design |
| Online MP | Drop | Adds Firebase + matchmaking; YAGNI |
| Spectator/host | N/A | No host-screen distinction in TD |
| AI opponents | N/A | Enemies are scripted wave content, not AI |

## §3 Controls & Input

- **Mouse (primary):** Click empty slot → build menu opens; click placed tower → upgrade/sell panel; hover → tower range circle preview.
- **Keyboard:** `1`–`4` select tower type for next placement, `U` upgrade selected, `S` sell selected, `Space` pause/resume, `N` send next wave early (bonus gold), `F` toggle 2× fast-forward, `Esc` menu.
- **Touch:** Tap-to-select, double-tap to confirm placement, long-press for tower info. No pinch-zoom in v1 (maps are sized to viewport).
- **Gamepad (uses `window.SharedGamepad` from [games/shared/gamepad.js](../../games/shared/gamepad.js), per ADR-016):**
  - D-pad / left stick → move build cursor on grid (snap to slots).
  - `A` → confirm (open build menu / place / upgrade).
  - `B` → cancel / close menu.
  - `DPAD_LEFT` / `DPAD_RIGHT` inside build menu → cycle tower types.
  - `DPAD_UP` / `DPAD_DOWN` → upgrade / sell on a placed tower.
  - Rumble: short pulse on tower fire (off by default — toggle), strong pulse on castle damage, victory/defeat patterns.
  - **(Stale planning note, corrected at implementation):** the original planning text said `SharedGamepad.BUTTONS` only exposed `A` + four D-pad indices and would need extension. That was incorrect — the shared module already exposes the full Xbox standard mapping (A/B/X/Y/LB/RB/LT/RT/BACK/START/LS/RS/DPAD_*) at [games/shared/gamepad.js](../../games/shared/gamepad.js). No extension was made; the input layer consumes the existing names directly.
- **Mobile / accessibility:**
  - Remappable keyboard: parked for v2.
  - One-handed play: mouse is sufficient solo; keyboard shortcuts are convenience.
  - Colorblind-safe: enemy types differ by **silhouette + label**, not just color (see §6).
- **Input feel knobs:** cursor snap radius, hover-preview fade-in, tower-fire input throttle (none — towers fire on internal cooldown), fast-forward multiplier (2×).

## §4 UI / UX

| Screen | Primary | Secondary | Back-out | Mobile |
|--------|---------|-----------|----------|--------|
| Title | "Play" → map select | "How to Play" | n/a | full-width buttons |
| Map select | tap a map card | difficulty pills (Easy/Normal/Hard) on each card | back to title | 1-col card stack |
| Active HUD | place / upgrade towers | pause, fast-fwd, send-next-wave | Esc → pause | tower palette dock at bottom |
| Pause | Resume | Restart, Settings | Resume = Esc again | full-screen overlay |
| Game over | "Play Again" (instant restart) | "Next Map" / "Map Select" | back to map select | stars + score centered |
| How-to-play | inline tutorial on first wave of map 1 | skip if returning player (localStorage flag) | n/a | inline |

HUD layout (active play): gold + lives top-left, wave counter top-center, wave preview top-right (silhouettes of upcoming enemy types), tower palette bottom-center (4 cards with cost), control cluster (pause / fast-forward / send-next) bottom-right. Tower-info panel slides in from the right when a tower is selected.

## §5 Progression & Persistence

- **High scores (localStorage):** key `ctd:scores` → `{ [mapId]: { [difficulty]: { stars, bestScore } } }`. Best stars are sticky (only overwrite if higher). No global leaderboard.
- **Save/resume:** None mid-run — sessions are short.
- **Unlockables:** Map 1 + 2 unlocked from start; Map 3 unlocks at 5 total stars; Hard difficulty unlocks per map at 3★ on Normal. Generates light replay incentive without bolting on a meta-game.
- **Stats / achievements:** Drop. YAGNI.
- **Daily seed:** Park (would require procedural waves — out of scope).

## §6 Difficulty & Game Feel

- **Difficulty curve:** Easy / Normal / Hard tiers per map. Differences: starting gold, enemy HP multiplier, lives. Hard adds one extra wave with a tougher composition.
- **Onboarding:** Map 1 wave 1 is a tutorial: one slow goblin, a forced pop-up "Place an Archer here" pointing at a slot. Skip on subsequent runs (localStorage `ctd:tutorialSeen`).
- **Rubber-banding:** None. Manual difficulty toggle is the lever.
- **Feedback loops:**
  - Gold popup ("+10") at enemy death.
  - Tower mouth flash on fire.
  - Screen shake on castle damage (toggle off in reduced-motion mode).
  - Enemy stagger frame on hit.
  - Wave-clear flourish: parchment-corner ribbon unfurls + brass fanfare.
- **Juice signature:** the **wave-clear flourish** described above. That is the moment the game must feel earned — the equivalent of pacman's siren bend or jeopardy's daily-double sting.

### Tower types (v1)

| Tower | Role | Tier 1 / 2 / 3 |
|-------|------|----------------|
| Archer | Single-target, fast, cheap | base / longer range / volley (2 arrows) |
| Cannon | AoE splash, slow, mid-range | base / bigger splash / shrapnel |
| Mage | Hits flying, magic damage | base / chain to 2 / chain to 3 |
| Frost | Slows enemies, no/low damage | base / stronger slow / freeze chance |

### Enemy types (v1)

| Enemy | Trait | Counter |
|-------|-------|---------|
| Goblin | baseline | any |
| Orc | high HP, slow | Cannon AoE / focused fire |
| Wolf-rider | fast, low HP | Frost slow + any DPS |
| Shielded | armor reduces physical dmg | Mage (magic ignores armor) |
| Flying | bypasses ground attackers | Mage / Archer (Cannon misses) |
| Boss | high HP, regenerative, end of map 3 | combined-arms |

## §7 Audio

- **Music:** Light medieval loop, on by default at 40% volume (player can mute). At implementation, sourced from "Medieval: The Old Tower Inn" by Phil Michalski / Spring Spring ([opengameart.org/content/medieval-the-old-tower-inn](https://opengameart.org/content/medieval-the-old-tower-inn)) — CC0. Saved as `audio/bgm_loop.mp3`.
- **SFX inventory (12):** arrow loose, cannon thud, magic zap, frost shimmer, gold pickup, enemy death, castle hit, wave start, wave clear, victory, defeat, ui click. All 12 sourced from Juhani Junkala's "Essential Retro Video Game Sound Effects Collection [512 sounds]" ([opengameart.org/content/512-sound-effects-8-bit-style](https://opengameart.org/content/512-sound-effects-8-bit-style)) — CC0. Same artist as the existing Pac-Man pack on the site, so the auditory family is consistent. Per-file mapping recorded in [audio/LICENSE.txt](../../games/castle-tower-defense/audio/LICENSE.txt).
- **Source mix:** CC0 samples (matches Pac-Man precedent in ADR-014). No synthesized audio in v1.
- **Mute / volume:** separate music + SFX sliders, persisted in `ctd:settings` localStorage key (collapsed from the planned `ctd:audio` key into a single settings blob — see §Implementation). First click anywhere on the title screen unlocks Web Audio (browser autoplay gate).

## §8 Visual brief (handoff to `/frontend-design`)

> **Mood:** parchment, ink-line, sun-warm, hand-drawn, slightly storybook.
>
> **Era / reference:** Kingdom Rush flat illustration crossed with an old illuminated manuscript. Bold silhouettes, 2–4 color flat fills with ink outlines, light grain texture overlay.
>
> **Palette:** Extends site tokens. Gold (`#c8943e`) for player UI accents and tower outlines, terracotta (`#b05a3a`) for enemy team, ember (`#a06828`) for warning/damage, deep bg (`#0a0a0b`) for the page chrome, parchment cream (derive a tint from `#f0e6d3`) for the playfield. Path tiles are a darker earth stripe through the parchment.
>
> **Typography:** Fraunces (display, with WONK axis) for screen titles and the score readout — its slightly weird flavor suits the medieval theme. Bricolage Grotesque for HUD numerics, costs, and tooltips.
>
> **Motion language:** Snappy placement (easeOutBack, ~180ms), weighty enemy hit-stagger (~80ms freeze frame), parchment-unfurl ribbon for wave-clear (~600ms). No floaty arcade vibes.
>
> **Iconography:** Custom SVG sprites — towers and enemies as 4-color flat with ink outlines. Path/terrain as tiled CSS background or a single Canvas-drawn pattern. Cards/buttons with tiny torn-paper edges (CSS clip-path).
>
> **Background / environments:** Static parchment grain in the playfield border. Faint dust trail under moving enemies. Per-map backdrop hint: Plains (greens/golds), Forest (deeper greens, ink density up), Mountain Pass (greys, sparse).
>
> **Hero frame for the gallery card:** Mid-wave shot — three enemies on the path, one mid-arrow-strike with hit-flash, faint range circle on the firing archer, gold "+10" popup, parchment sidebar on the right with the four tower cards, score in Fraunces at top.
>
> **The one detail nobody asked for:** A tiny ink-blot bird that flies across the parchment border once per wave clear.

## §9 Architecture brief (handoff to `/feature-dev:feature-dev`)

> *(Original planning brief, preserved as historical record. The actual file split landed exactly as listed below; the only material deviation was the **render layer** — see §Implementation.)*
>
> **Folder:** `games/castle-tower-defense/` (lowercase-hyphen, matches site convention).
>
> **Files (start minimum):**
>
> | File | Role |
> |------|------|
> | `index.html` | page shell, inline CSS, script tags |
> | `game.js` | entry point, top-level state, FSM, public `window.CastleTowerDefense` |
> | `engine.js` | wave manager, tick loop, economy, lives, collision |
> | `entities.js` | tower + enemy + projectile data tables and behaviors |
> | `render.js` | Canvas 2D draw routines + DOM HUD updates |
> | `input.js` | pointer / keyboard / gamepad cursor (delegates gamepad to `SharedGamepad`) |
> | `audio.js` | Web Audio bus, sample loader, SFX + BGM |
> | `maps.js` | three hand-authored maps: tile grid, path, build slots, wave scripts |
> | `audio/` | CC0 sample files + a `LICENSE.txt` per Pac-Man precedent |
>
> **Module pattern:** `window.<Submodule>` per file (Chess/Pacman multi-file precedent). Public surface is `window.CastleTowerDefense.start()`.
>
> **State shape:** Single state object owned by `game.js`; explicit FSM `title → mapSelect → prepWave → inWave → wonRun | lostRun`, with `paused` as a separate boolean orthogonal to the FSM. Mutations go through reducer-style functions in `engine.js`.
>
> **Render approach (planned):** Canvas 2D for the playfield + DOM/CSS for the HUD overlay. *Replaced at implementation by SVG-DOM — see §Implementation.*
>
> **Tick loop:** `requestAnimationFrame` with a fixed-timestep accumulator (60 Hz logic). Determinism not required.
>
> **Pathfinding:** None at runtime. Paths are *baked into each map* as ordered polyline coordinates; towers go on adjacent build slots so placement never invalidates the route. (KISS.)
>
> **Shared utilities:**
>   - Use `games/shared/gamepad.js`. *(Planning text claimed it needed a `BUTTONS` extension; this turned out to be wrong — the file already exposed the full Xbox table at landing time. No extension made.)*
>   - Do **not** extract a `localStorage` helper yet — but flag it: a 7th caller (this game) trips the dedup signal. Recommend a follow-up ADR.
>   - Do **not** extract a shared audio bus. Pac-Man and CTD bus shapes differ.
>
> **Networking:** None.
>
> **Verification (per CLAUDE.md MCP protocol):** Boot dev server, navigate, snapshot, screenshot title + an active wave, simulate a tower placement, drive a full wave with `wait_for`, capture wave-clear / game-over, validate `list_console_messages types:["error"]` returns empty, verify `list_network_requests` shows no 4xx/5xx.

## §10 Adjacent / orthogonal / perpendicular ideas

| # | Idea | Class | v1 |
|---|------|-------|----|
| 1 | Hard+ mode unlocked at 3★ | Adjacent | **Ship** (Hard tier per-map at 3★ on Normal) |
| 2 | Endless / survival mode | Adjacent | Park |
| 3 | Sandbox / free-build | Adjacent | Drop (anti-fun for TD) |
| 4 | Map editor | Orthogonal | Drop (huge scope) |
| 5 | Replay export | Orthogonal | Drop (no determinism) |
| 6 | Shareable result card (Wordle-style emoji grid) | Orthogonal | Park |
| 7 | Daily seed with procedural waves | Orthogonal | Park |
| 8 | Speedrun timer | Orthogonal | Drop (TD doesn't speedrun cleanly) |
| 9 | Final boss on map 3 wave N | Perpendicular | **Ship** |
| 10 | Date-keyed palette (October pumpkin / December snow) | Perpendicular | Park |
| 11 | Konami-code 999-gold cheat | Perpendicular | Park |
| 12 | Cross-game "house cup" leaderboard | Cross-game | Drop (no other game tracks scores cross-site; YAGNI) |
| 13 | Reduced-motion toggle (kills shake + fire flash) | A11y | **Ship** |
| 14 | Colorblind-safe enemy silhouettes + labels | A11y | **Ship** (built into entity art from day one) |
| 15 | Hover-to-preview tower range + placement | Adjacent | **Ship** (genre table-stakes) |
| 16 | Bestiary / encyclopedia between waves | Perpendicular | Park |
| 17 | "Closest you got" rewind on loss | Failure-mode gift | Drop (cheap dopamine, expensive to build) |
| 18 | Ink-blot bird across the border on wave-clear | Perpendicular flourish | **Ship** (the §12 "one detail nobody asked for") |

Total candidates: 18. v1 ships: 5 (#1, #9, #13, #14, #15, #18). Park: 6. Drop: 6.

## §11 Fun audit

1. **10-second hook:** First archer plinks the first goblin — you see the projectile arc, hear the thud, watch gold tick up. Instant cause→effect→reward.
2. **Skill ceiling:** Optimal tower combos and placement. Experts 3-star Hard with minimum gold spent. The room above casual play is real.
3. **Story you tell a friend:** "I had ONE life left, the boss was on the second-to-last tile, and my mage tower's chain lightning fired RIGHT as he stepped on the gate."
4. **Surprise:** Wave 3 of map 1 sends a flying enemy. Ground-only towers miss it. The player must adapt and place a Mage.
5. **Restart friction:** "Play Again" button on game-over resets state in <1 second (no reload, no re-fetch — assets stay loaded).

## §12 Beauty audit

- **Hero frame:** described in §8 — mid-wave with a hit-flash, gold popup, sidebar palette, Fraunces score readout.
- **Negative space:** parchment margins around the playfield rest the eye; HUD elements anchored to corners, not floating.
- **Readability under pressure:** lives + gold use Fraunces-large at fixed top-left position; tower-palette unaffordable cards desaturate (don't overlap numbers); enemy types remain distinguishable by silhouette under heavy projectile load.
- **Cohesion with chases.house:** parchment cream is a derived tint of `#f0e6d3`; gold and ember used for accents; Fraunces and Bricolage are already the site fonts. The game feels like it lives at this address.
- **The one detail nobody asked for:** the ink-blot bird across the parchment border on wave-clear (item #18 in §10).

## §13 Scope discipline

```
## Architectural Decision: Recreate Castle Tower Defense on chases.house

DRY:   Gamepad logic reused from games/shared/gamepad.js (the BUTTONS table already had
       the full Xbox mapping — no extension needed; planning text was stale). Audio bus
       and localStorage helpers NOT extracted; the 7th localStorage caller (this game)
       trips the dedup signal — flagged in code comments and below for a follow-up ADR.
       → No duplication this round.

YAGNI: Dropped online MP, map editor, replays, daily seed, endless, sandbox, cross-game
       leaderboard, bestiary, "closest you got" rewind, konami code, date palettes,
       speedrun timer for v1. None are required for the core loop.

SOLID: Engine / entities / render / input / audio split by responsibility. entities.js is
       a data table extended by adding rows, not editing logic (open/closed). FSM in
       game.js is the single source of state truth.

KISS:  Fixed paths baked into each map as polylines (no runtime A* / BFS — towers go on
       dedicated build slots adjacent to the path, so placement never invalidates the
       route). SVG-DOM render (parchment fidelity) over Canvas 2D for ~80-node entity
       budget. Hand-authored waves, not procgen. Three maps, not ten.

Decision: Proceeded as planned, with the SVG-DOM render-layer deviation flagged and
          documented in §Implementation.
```

### v1 (shipped)

- Folder [games/castle-tower-defense/](../../games/castle-tower-defense/)
- 3 maps × 3 difficulties (Easy / Normal / Hard, with Hard gated per-map by 3★ on Normal)
- 4 tower types (Archer, Cannon, Mage, Frost), 3 upgrade tiers each
- 6 enemy types (Goblin, Orc, Wolf-rider, Shielded, Flying, Boss)
- 10 waves per map (11 on map 3, last is the boss)
- Stars 1–3 per (map, difficulty); best persisted in `localStorage` (`ctd:scores`)
- Mouse + keyboard + Xbox-format gamepad (gamepad via `SharedGamepad` directly; no extension needed)
- Web Audio: 1 BGM loop + 12 SFX, music/SFX volume sliders persisted (`ctd:settings`)
- Tutorial pop-up on first wave of map 1, skipped thereafter (`ctd:tutorialSeen`)
- Reduced-motion toggle (kills shake / hit-flash / fire flash / marginalia bird; rumble preserved as haptic, not visual)
- Colorblind-safe enemy silhouettes (built into the SVG sprite library)
- Wave-clear ink-bird marginalia flourish

### Out of scope / parked for follow-up ADRs

- Endless / survival mode
- Shareable Wordle-style result card
- Daily seed + procedural wave generator
- Bestiary / encyclopedia screen
- Custom keybinding UI
- Date-keyed seasonal palette
- Konami-code cheat
- Bigger maps with pinch-zoom (mobile)
- A future ADR for a shared `localStorage` helper if a 7th game adds another small JSON-blob caller — not blocking this work

## Resolved decisions (2026-04-24)

1. **Folder name → `games/castle-tower-defense/`.** Lowercase-hyphen, matching the rest of the gallery.
2. **Map count → 3 maps for v1**, with the data layer (`maps.js`) designed for trivial extensibility. Implemented as a `MAPS` array of plain data objects (`{ id, displayName, theme, path, buildSlots, waves, unlockRequirement }`); wave scripts are pure data (`{ enemies: [{ type, count, spacing, delay }], reward, isBoss }`); map-select UI iterates `MAPS` dynamically — adding a 4th map is one entry, no engine change.
3. **BGM → on by default at 40% volume** with a toggle on the title screen and in the pause menu. Mute state persists in the `ctd:settings` JSON blob (consolidated from the originally-planned standalone `ctd:audio` key).
4. **`SharedGamepad` extension → no-op.** Implementation discovered the file at [games/shared/gamepad.js](../../games/shared/gamepad.js) already exposes the full Xbox table (A/B/X/Y/LB/RB/LT/RT/BACK/START/LS/RS/DPAD_*) — the planning-time claim that it lacked B/X/Y/triggers was based on a stale read. The input layer consumes the existing names directly. (Note: planning text used `LSTICK`/`RSTICK`; actual file uses `LS`/`RS` — kept the existing names per DRY.)
5. **Boss → shipped on map 3 final wave (wave 11)** with the planned mechanic: slow HP regen (2%/sec) suspended for 2s after any tower hit. Forces sustained DPS rather than burst-then-wait. Telegraphed by a CSS pulsing-glow class toggled in `render.js` whenever `regenSuppressedMs <= 0`.

(Original questions block resolved; preserved here as a record.)

---

## Implementation (2026-04-25)

### Files (all under [games/castle-tower-defense/](../../games/castle-tower-defense/))

| File | Public surface | Role |
|------|---------------|------|
| [`index.html`](../../games/castle-tower-defense/index.html) | — | Page shell, inline CSS, full SVG sprite library (12 towers + 6 enemies + UI icons + map thumbnails), six screens (title / map-select / play / pause / game-over / tutorial), seven `<script>` tags in dependency order |
| [`entities.js`](../../games/castle-tower-defense/entities.js) | `window.CTDEntities` | `TOWERS` / `ENEMIES` / `DIFFICULTY` data tables + factories (`makeTower`, `makeEnemy`, `makeProjectile`, `makeEffect`); `canTarget` / `applyDamage` / `towerSellValue` predicates |
| [`maps.js`](../../games/castle-tower-defense/maps.js) | `window.CTDMaps` | Three hand-authored maps: Plains (10 waves), Forest (10), Mountain Pass (11 incl. boss). `byId(id)`, `maxStars()` helpers |
| [`audio.js`](../../games/castle-tower-defense/audio.js) | `window.CTDAudio` | Web Audio bus (master → music + sfx), lazy buffer load, BGM loop, event-driven SFX (`flushEvents(events)`), graceful no-op when files missing |
| [`render.js`](../../games/castle-tower-defense/render.js) | `window.CTDRender` | All DOM mutation: SVG-DOM entity diff, HUD/palette/tower-info population, map-select hydration, game-over fill, wave-clear ribbon, marginalia bird flight |
| [`input.js`](../../games/castle-tower-defense/input.js) | `window.CTDInput` | Keyboard handlers (`1`–`4`, `U/S/Space/N/F/Esc`) + gamepad polling via `SharedGamepad` (D-pad cursor snaps to nearest build slot; `A` confirm, `B` cancel, `X` upgrade, `Y` sell, `LB`/`RB` cycle palette, `START` pause, `RT` fast-forward, `LT` send-next-wave) |
| [`engine.js`](../../games/castle-tower-defense/engine.js) | `window.CTDEngine` | Pure state mutation: `createState`, polyline path baking + `sampleOnPath`, wave dripper, target picking + lead, projectile sim with splash/chain/slow/freeze, boss regen, win/lose detection, `place/upgrade/sell/sendNextWave/togglePause/setFastForward`, `computeScore/computeStars` |
| [`game.js`](../../games/castle-tower-defense/game.js) | `window.CastleTowerDefense.start()` | Boot, FSM, `requestAnimationFrame` tick (fixed-step accumulator capped at 5 steps/frame), document event delegation for `[data-go]` and `[data-action]`, localStorage helpers, audio first-click bring-up |
| [`audio/`](../../games/castle-tower-defense/audio/) | — | 13 CC0 audio files (12 SFX + 1 BGM), `README.txt`, `LICENSE.txt` with full source mapping |

Total: ~1,615 LOC across the seven engine modules.

### Material deviations from §9 plan

1. **Render layer → SVG-DOM, not Canvas 2D.** The frontend deliverable committed hard to a parchment-and-ink aesthetic with crisp ink linework; rasterizing those SVGs onto canvas at runtime blurs the strokes and forces re-rasterization on DPI changes. v1 entity counts (~80 nodes peak: ~6 towers + ~25 enemies + ~50 projectiles + effects) are well within DOM perf budget when only `transform` is mutated. `render.js syncEntities(state)` diffs state's entity list against `Map<id, <g>>` registries and updates `transform="translate(x y) rotate(r)"` only. Canvas remains an escape hatch — replacing `<svg class="field">` with `<canvas>` is a single-file change.
2. **`SharedGamepad.BUTTONS` extension → no-op.** The shared module already had the full Xbox table; the planning note was stale.
3. **Boss damage on castle hit → -5 lives** (vs. -1 for regular enemies). Wasn't explicit in the plan but felt right given the boss's HP and the dramatic stakes; documented here.
4. **`localStorage` keys → 3, not 2.** `ctd:scores` (best stars + bestScore per map+difficulty), `ctd:settings` (volumes, mutes, reduced-motion — folded the planned `ctd:audio` into this), `ctd:tutorialSeen` (single flag). [game.js](../../games/castle-tower-defense/game.js) carries a comment marking the 7th-caller dedup signal — open follow-up ADR if the codebase grows further.

### Audio assets sourced

All CC0. See [audio/LICENSE.txt](../../games/castle-tower-defense/audio/LICENSE.txt) for full per-file source mapping.

- **12 SFX** — Juhani Junkala's "Essential Retro Video Game Sound Effects Collection [512 sounds]" ([opengameart.org/content/512-sound-effects-8-bit-style](https://opengameart.org/content/512-sound-effects-8-bit-style)). Same artist as the existing Pac-Man pack on the site, so the auditory family is consistent.
- **1 BGM loop** — "Medieval: The Old Tower Inn" by Phil Michalski / Spring Spring ([opengameart.org/content/medieval-the-old-tower-inn](https://opengameart.org/content/medieval-the-old-tower-inn)).

### Verification (Chrome DevTools MCP, per CLAUDE.md)

End-to-end: title → map-select (hydrated, lock states correct) → tutorial gating wave-1 spawn until first Archer placed → play (towers fire with leading targeting; enemies walk path; gold/lives update; wave dripper spawns per script; effects fade) → pause overlay over playfield → game-over (defeat at lives=0 with 900ms grace; victory on last wave clear; stars + score + best persisted to `ctd:scores`) → reload map-select shows progress (Plains 3★ Normal, Plains-Hard pill unlocked, total stars updated). Console: 0 errors, 0 warnings. Network: 13/13 audio files 200, no 4xx/5xx anywhere. Screenshots in [docs/screenshots/](../screenshots/) (`ctd-impl-*.png`).

---

## Handoff checklist (final)

- [x] §0 canonical reference grounded in real genre lineage (Desktop TD → Kingdom Rush)
- [x] §3 gamepad mapping via `games/shared/`; planning's stale `BUTTONS` extension claim corrected
- [x] §8 brief executed by `/frontend-design` — visual layer landed in [games/castle-tower-defense/index.html](../../games/castle-tower-defense/index.html)
- [x] §9 brief executed by `/feature-dev:feature-dev` — engine modules landed; render-layer deviation documented
- [x] §10 lists 18 candidate ideas, each marked ship/park/drop; v1 ships #1, #9, #13, #14, #15, #18
- [x] §13 v1 cut line shipped intact
- [x] §7 audio sourced and dropped in (CC0 — Junkala SFX + Old Tower Inn BGM)
- [x] ADR file at `docs/adr/023-castle-tower-defense.md` (renumbered from 017 due to parallel-branch collisions)
- [x] CLAUDE.md MCP verification protocol executed: zero console errors, all network 200s, every screen + flow exercised end-to-end
