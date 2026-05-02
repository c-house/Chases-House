# ADR-018: Hearthguard (Into the Breach–style, D&D-themed)

**Status**: Draft (planning pass complete — all open questions resolved; ready for `/frontend-design` and `/feature-dev:feature-dev` handoff)
**Date**: 2026-04-25
**Display name**: **Hearthguard**
**Folder**: `games/hearthguard/`
**Module namespace**: `window.Hearthguard`

## Summary

A turn-based tactics puzzle game in the lineage of Subset Games' *Into the Breach* (2018), reskinned as D&D-flavored medieval fantasy. Tiny **8×8 grid**, **3 hero units** (Knight / Archer / Mage), **5 turns** per mission, fully **deterministic**: every enemy telegraphs its next attack, the player sees all consequences before committing, and good play turns combat into a chess-meets-Sudoku puzzle of pushing/blocking/redirecting goblin and troll attacks to protect 3 villager objectives. Solo only, ~5–10 min per mission, three-mission run, runs entirely client-side. Justified addition: the gallery has chase arcades (Snake, Pac-Man, Asteroids draft), abstract board games (Chess, Checkers, Connect Four), and word/number puzzles (Sudoku, Crossword) — but **no tactics / strategic-planning genre**.

## Decisions

- **Mode**: **Solo only**. Deterministic-puzzle core has no clean multiplayer fit; AI opponents are the *enemy units*, not a strategic adversary.
- **Grid**: **8×8** (not 6×6). 6×6 was tempting for purity but cramped 3 heroes + 3 objectives + 3–5 enemies + spawn tiles into thrashing; 8×8 gives breathing room while staying scannable.
- **Run shape**: **3-mission run** (Forest → Crossroads → Castle Gate). 5 turns each, escalating enemy variety per mission. Loss = run over (permadeath); win = victory screen + score breakdown. No mid-run save (a run is short enough to do in one sitting).
- **Determinism**: Every enemy shows its next attack as a telegraphed arrow + damage number on its target tile at start of player phase. No hidden info, no RNG during a turn's resolution. RNG is *only* used between turns for spawn placement and is shown via "next spawn" markers a turn ahead — same as ItB.
- **Units (v1)**:
  - **Knight**: melee, **push 1** on hit (the core ItB-style "redirect the punch" verb), 3 HP, 2 move.
  - **Archer**: ranged line attack 1–4 tiles, **pulls** target 1 tile toward archer (alternate redirect verb), 2 HP, 3 move.
  - **Mage**: **AoE 3-tile line** that does no damage but **swaps positions** of any two adjacent units in the line (board-state manipulation, no kill), 2 HP, 2 move.
  - All 3 actions create *positional* problems, not damage races — this is the "ItB feel" v1 must hit.
- **Enemies (v1)**: Goblin (1 HP, melee, 3 move), Troll (3 HP, melee + push, 2 move), Goblin Archer (1 HP, line attack, 2 move). Dragon and Mage-enemy parked for v2.
- **Objectives**: 3 villager tiles per mission. Mission lost when **all 3** are destroyed — same generosity threshold as ItB's grid health, so a single missed turn isn't an instant restart.
- **Score**: villagers saved (×100) + enemies killed (×25) + turns unused (×10) + perfect-mission bonus (no villager hit, all enemies dead). Three integer values + a total — readable, not min-maxable into degeneracy.
- **Persistence**: `localStorage` for **best-run score**, **mute preference**, and **completed-missions counter** (cosmetic — unlocks a victory parchment seal at 10 / 50 / 100). No mid-run save.
- **Controls**:
  - **Mouse / touch (primary)**: click hero → highlighted move tiles + attack range → click destination → click attack target → "Confirm turn" button.
  - **Keyboard**: `Tab`/`1`/`2`/`3` cycle units, arrow keys move cursor, `Space` confirm, `Z` undo (turn-only, free), `Enter` end turn.
  - **Gamepad** (via `games/shared/gamepad.js`): D-pad cursor, `A` confirm, `B` cancel, `DPAD_DOWN` long-press = end turn. Uses only the existing `BUTTONS` set (`A`, `DPAD_*`) — no new shared-utility surface.
  - **Mobile touch**: tap-to-select, tap-tile-to-move, long-press-tile for action menu. Confirm button is permanently visible at bottom of screen.
- **Undo**: **Free unlimited undo within a turn** until "Confirm turn" is pressed. Once confirmed, the turn resolves and is locked. This is the single most important design choice — it converts the game from "twitchy regret" to "puzzle-solver mode" and is *the* reason ItB feels different from XCOM.
- **Visual direction**: Inked parchment + stained-glass color. Not pixel-art (every other ItB clone is). Hand-inked SVG hero/enemy glyphs in silhouette on a parchment grid, deep stained-glass blues/reds for highlights and threat zones. Site palette extends *naturally*: site gold `#c8943e` becomes the parchment-edge highlight, ember `#a06828` becomes warm shadow under units, terracotta `#b05a3a` becomes enemy threat-tint. Justified: the site already *is* a warm parchment-y vibe; this game is the most "of-the-house" piece in the gallery, not a break-out aesthetic.
- **Tech**: Plain HTML/CSS/JS, IIFE on `window.Hearthguard`. **DOM grid** (not Canvas) — 64 tiles is well within DOM-render territory, and DOM gives free hover states, accessibility, and CSS-driven threat-zone styling. Canvas only if profiling shows a problem (it won't).
- **Audio**: Web Audio synthesis for SFX (sword, bow, magic-chime, hit, miss, villager-fall, victory). No music in v1 (parchment/stained-glass aesthetic + thoughtful pacing reads better in silence). Locked: synthesis. Rationale in §7.
- **Accessibility / narration**: **Screen-reader narration of telegraphs and turn-resolution promoted to v1.** A deterministic, fully-text-able tactics game is the gallery's biggest a11y opportunity — and the same narration channel doubles as a clean machine-readable surface (an LLM agent can play the game from narration alone, without computer-vision parsing of the canvas/DOM). Implementation cost is ~150 LoC because the resolver is already pure (state → state).

## v1 Scope (ship)

- 8×8 grid, 3 missions per run, 5 turns each, permadeath, deterministic enemy telegraphs
- 3 heroes (Knight push, Archer pull, Mage swap), 3 enemies (Goblin, Troll, Goblin Archer)
- 3 villager objectives per mission, lose-condition = all 3 fallen
- Free unlimited within-turn undo, "Confirm turn" gate, no mid-turn locking
- Score breakdown (saved + kills + turn-bonus + perfect-mission flag)
- Mouse + keyboard + gamepad + mobile-touch input
- `localStorage` best-run score, mute preference, completed-mission counter
- Tutorial mission (mission 1 has scripted hint overlays for first-time players, dismissible after seen-once flag)
- Pause (`P`) overlay with rules-recap + restart-run + quit-to-menu
- `prefers-reduced-motion` respected (no hit-pause, no shake; numbers still pop in)
- Web Audio SFX inventory: cursor-move, select-unit, invalid-action, knight-strike, archer-shot, mage-swap, enemy-attack, hit, villager-fall, mission-win, run-win, run-lose, menu-confirm
- Inked-parchment visual treatment, stained-glass threat-zone tinting, SVG hero/enemy glyphs
- **Screen-reader narration** of all enemy telegraphs, hero actions, and turn-resolution events via `aria-live="polite"` region; complete keyboard-only flow (no mouse-only paths). Verified with NVDA / VoiceOver smoke test.
- Games-gallery card added (11th entry, **`solo`** tag, glyph: ⚔ crossed swords)
- Verification per CLAUDE.md Chrome DevTools MCP protocol: zero console errors, zero failed network requests, screenshots of title / mid-mission / victory / game-over

## Out of scope / follow-ups (parked for v2 ADR)

- **Dragon enemy** (3-tile breath cone, 5 HP) — the iconic capstone, but needs its own balance pass
- **Enemy Mage** (teleport, swap your unit out of position)
- **Pilot/hero progression between missions** (XP, perks, +1 HP) — ItB's "pilots level up" loop
- **Run variety**: 3 alternate hero squads (Knights / Rangers / Wizards) with distinct verb sets
- **Daily seed + emoji-grid shareable result** (🛡️🏹🔥 + score, Wordle-style)
- **Replay system** — re-watch a turn's full resolution from any move forward
- **Practice/sandbox mode** — pick a mission, infinite restarts, no run loss
- **Statistics dashboard** — runs played, win rate, favorite hero, perfect-mission count
- **High-contrast & dyslexia-friendly modes** beyond reduced-motion
- **Cross-game "House Cup" meta-leaderboard** — its own ADR, not Tactics-specific
- **`games/shared/highscores.js` extraction** — wait until a third consumer (Snake + Asteroids draft + this would be the trigger; flag as the next-consumer activates extraction)

## Dropped (explicitly considered, not pursued)

- Multiplayer (sync vs async PvP, online co-op) — fundamentally wrong for a deterministic single-puzzle loop; co-op turn-by-turn = pace murder
- 6×6 grid (too cramped for 3 heroes + 3 villagers + 3+ enemies)
- Hidden info / fog-of-war (kills the "puzzle" feel and is the literal opposite of ItB's design contract)
- Random damage / criticals / dice rolls (same — would flip the genre to XCOM)
- Procedurally generated missions in v1 (3 hand-tuned missions read tighter for a debut; procedural is a v2 conversation)
- Unit unlocks / shop economy (power creep in a game that lives or dies on tight constraints)
- Music in v1 (silence is the right call for a thinker; revisit if v2 adds run length)
- Pixel-art aesthetic (every ItB clone does this; the visual direction here is the differentiator)
- Konami codes / dynamic favicon / weather palette / hidden second game — all fail YAGNI

## Canonical reference (§0)

- **Genre & lineage**: Turn-based puzzle-tactics. Direct ancestor: *Into the Breach* (Subset Games, 2018). Lineage: *Advance Wars* (intelligent systems, 2001) → *Final Fantasy Tactics* (Square, 1997) → *XCOM* reboot (Firaxis, 2012) → *ItB* (which stripped the genre to its puzzle skeleton). Cousins: *Hoplite* (mobile, 2013), *Wargroove* (2019).
- **Core loop**: *Survey the threats the enemies have telegraphed, then plan a 3-unit turn that pushes/redirects those attacks so they hit the wrong target — yours, the wall, or the enemies themselves.*
- **Win/lose**: Complete 5 turns with ≥1 villager alive = mission win. All 3 villagers fallen = mission loss = run loss (permadeath). Win 3 missions in a row = run victory.
- **Iconic moments** (recreation must deliver):
  1. Realizing one push converts a "we're dead" turn into a "they kill *each other*" turn.
  2. Sacrificing a hero to body-block an attack on a villager.
  3. The visible-threat "you saw this coming and chose this anyway" feeling on a wipe.
  4. The first time the Mage swap turns a kill-shot into the enemy hitting another enemy.
  5. The end-of-mission "0 villagers lost" perfect bonus chime.
- **Easy-to-get-wrong rules**:
  - Threat resolution **simultaneous** (all enemies attack at once, pre-attack positions used) — *not* sequential — or pushes don't compose right.
  - Push out-of-bounds = unit takes damage *and stays on board edge*; in ItB this is a tile-flavor distinction, in v1 we treat board edge as a hard wall doing 1 dmg to the pushed unit.
  - When an enemy targets a tile and another enemy gets pushed onto that tile *before* attacks resolve, the attack still goes through — **hits whoever is in the targeted tile at resolution time**. This is the engine of most "they kill each other" tricks. Easy to botch.
  - Telegraphs must show damage *number* on tile, not just direction — players plan around exact HP math.
  - Undo must restore *full* state including spent-action flags; partial undo is a known clone-killer bug.
- **Era**: Post-2018, modern indie-tactics. Visual register sits between board-game illustration and graphic novel, deliberately *not* the ItB pixel-mech look (clones over-borrow that).

## Fit for chases.house (§1)

- **Why this game**: The gallery has nothing in the strategy/puzzle-tactics genre. Chess scratches "abstract perfect-information board game" but is unwinnable for casual play; Sudoku scratches "deduction puzzle" but is solo-text. Tactics fills the gap of *ten-minute strategic-planning sessions* with visible consequence chains — the "I had to think for two minutes about my next move" niche, well-suited to a personal site visited in short windows.
- **Solo / multi**: **Solo only.** ItB's whole appeal is fully-known board state — adding any opponent kills the puzzle.
- **Session length**: ~3 min per mission, ~10 min per full run. Restart friction matters (see §11).
- **Dealbreakers**: None. Fully client-side, deterministic, no networking, no anti-cheat.

## Players & modes (§2)

- **Single-player**: Core experience.
- **Local co-op (same screen)**: Out — turn-by-turn co-op is the worst of both worlds (slow + spoils the puzzle for the second player). Drop.
- **Local versus**: Out — wrong genre fit. Drop.
- **Online multiplayer**: Out — Firebase complexity unjustified, no design need. Drop.
- **Spectator/host view**: Out — no second screen story. Drop.
- **AI opponents**: The *enemies are the AI*, but they're scripted-deterministic, not adaptive. No bot-as-opponent for solo lobby (there isn't one). Drop.

## Controls & input (§3)

- **Keyboard layout**: `Tab` / `1` `2` `3` cycle units (number keys = direct hero select). Arrows move cursor. `Space` or `Enter` confirm. `Z` undo. `Esc` cancels current selection (not undo). `End` or `Enter`-on-empty-cursor confirms full turn. WASD also accepted as alias for arrows. Rationale: chess-clones already use mouse-primary + arrow-secondary; this matches.
- **Mouse/touch**: Primary input. Click selects, click-tile-to-move, click-target-to-attack, click "Confirm turn" button to resolve.
- **Gamepad** (via `SharedGamepad`):
  - D-pad → cursor / unit cycling (long-press `DPAD_LEFT`/`RIGHT` = next/prev unit)
  - `A` → confirm action
  - **`B` button is not in `SharedGamepad.BUTTONS` today** — adding (`B: 1`). Small justified extension; ADR-016 explicitly anticipated this ("the other 11 standard-mapping indices land when a consumer needs them"). Per the W3C Standard Gamepad Mapping spec, button index 1 is the *right-hand face button* on every controller — Xbox `B`, PlayStation `○`, Switch `A` (physical layout). The label varies by platform; the *position* (right-of-confirm) is universal, which is what cancel-button muscle memory is built on. No per-platform branching needed.
  - `DPAD_DOWN` long-press → end turn (signal: a small confirm-ring fills under the cursor over 600 ms)
  - Rumble: short pulse on `A` confirm, longer pulse on enemy attack landing on hero, longest pulse on mission loss
- **Mobile touch**: tap-select, tap-move, tap-attack-target. "Confirm turn" is a fixed bottom-of-screen button (CSS `position: fixed`). Long-press a unit for inline radial of move/attack/swap. No swipe gestures, no tilt — too imprecise for grid placement.
- **Accessibility**: Threat tiles use a **red tint *plus* a striped pattern overlay** (colorblind-safe — red/green dichromacy). Critical hit indicators are **shape-coded** (sword icon for melee, arrow for ranged, swirl for magic) not color-coded. Reduced-motion respected (no hit-pause, no camera shake).
- **Input feel knobs**: cursor-repeat rate ~150 ms, hold-to-end-turn duration 600 ms, animation speed of attack-resolution playback (1× / 2× / instant — user setting, persisted).

## UI / UX structure (§4)

1. **Title screen**: parchment field with inked title type; "Begin Run", "How to Play", "Best Run: 2,140", small mute toggle in corner.
2. **Mission briefing**: parchment scroll unfurls — mission name (e.g. "The Forest Edge"), turn count "5", enemy roster icons, map preview thumbnail, "Begin" button.
3. **Active play HUD**:
   - Top: turn counter (1/5), mission name, run-score running total
   - Center: 8×8 grid (the play space)
   - Bottom-left: 3 hero portraits with HP bars + action-spent dots
   - Bottom-right: "Undo" (`Z`), "Confirm turn" (large, primary CTA)
   - Hover/select: tile shows threat overlay + damage number; selected unit's range tints in stained-glass blue (move) and red (attack)
4. **Pause** (`P`): rules recap card + Resume / Restart Run / Quit to Title. Confirms before destroying current run.
5. **Mission end (win)**: scroll-stamp animation slamming a wax seal on the parchment, score breakdown card, "Continue Run →".
6. **Mission end (loss = run loss)**: villagers fall animation, run-summary card (missions completed 0–3, score, "closest you got"), "New Run" + "Title".
7. **High-score / best-run view**: small panel on title screen showing best score + missions completed at best score. No leaderboard, no global rankings.
8. **Help / how-to-play**: 5-page parchment scroll: (1) verbs, (2) telegraphs, (3) undo, (4) objectives, (5) controls. Reachable from title and pause.

For each screen — **mobile spec**: portrait-locked grid sized to viewport-width minus margins, hero portraits stack as a horizontal scroll-strip, "Confirm turn" is a fixed-bottom 56 px button. Backing out of any screen = top-left chevron + Esc/`B`-button.

## Progression & persistence (§5)

- **High scores**: `localStorage` key `hearthguard-best-run` = `{ score, missionsCompleted, date, perfectMissions }`. Single best-run record (no top-10 needed; runs are short and the *single-best* is the right brag).
- **Save/resume**: No. Run length doesn't justify the complexity, and ItB explicitly chose run-only-permadeath for tension.
- **Unlockables**: One cosmetic — a wax-seal flourish on the title screen at 10 / 50 / 100 missions completed lifetime. Counter persists in `localStorage` `hearthguard-missions-completed`. No gameplay-affecting unlocks (anti-power-creep).
- **Stats / achievements**: Lifetime missions completed only. No achievement list — YAGNI for a 3-mission-run game.
- **Seeds / daily challenge**: **Parked for v2** — code path is determinism-friendly (RNG only between turns for spawns), so a daily seed is a future small change, not a rewrite.

## Difficulty & game feel (§6)

- **Difficulty curve**: Mission 1 has 3 enemies (2 Goblins + 1 Troll), mission 2 adds a Goblin Archer and a 4th enemy mid-run, mission 3 has 5 enemies + a mid-mission spawn surge. No difficulty selector in v1 — the curve *is* the difficulty.
- **Onboarding**: Mission 1 is also the tutorial. Scripted hint overlays fire on first-time-only triggers: "Click a hero to see their range", "Hover an enemy to see its target", "Push to redirect attacks", "Confirm when ready". Dismiss-once via `localStorage` `hearthguard-tutorial-seen`.
- **Rubber-banding**: None — fights against the puzzle premise. Free undo is the assist.
- **Feedback loops** (specific moments):
  - Hero confirms move → small particle burst on destination tile + parchment-rustle sfx
  - Push lands an enemy onto another enemy's targeted tile → **hit-pause 120 ms + glyph flashes white** before resolution
  - Villager saved by body-block → wax-seal flash on the villager tile + chime
  - Perfect-mission bonus → fanfare sting + golden border around score card
  - Run win → animated quill signs the parchment with the date
- **Juice budget signature**: The **redirected-attack hit-pause + flash**. This *is* the "I outsmarted them" moment ItB lives on; if v1 nails this one effect, the rest of game-feel can be conservative.

## Audio (§7)

- **Music**: None in v1. Silence reads as "thoughtful planning"; music would underscore tension at the cost of letting players *think*. Revisit in v2 if a daily-seed mode adds replay loops.
- **SFX inventory**:
  - cursor-move (soft tick)
  - unit-select (parchment rustle)
  - move-confirm (footstep)
  - knight-strike (sword *thunk*)
  - archer-shot (bowstring + arrow whoosh)
  - mage-swap (magical chime + reverse-swoosh)
  - enemy-attack-melee (heavy growl-thud)
  - enemy-attack-ranged (whoosh + impact)
  - hit-on-hero (low impact)
  - hit-on-enemy (sharp impact)
  - villager-fall (somber single-note bell)
  - mission-win (4-note fanfare)
  - run-win (8-note triumphant)
  - run-lose (descending minor third)
  - menu-confirm (page turn)
  - invalid-action (low buzz, 80 ms — short to avoid annoying)
- **Source**: **Web Audio synthesis (locked).** How competitors handle this: *Into the Breach* itself ships rich sample-based SFX + a full orchestral score by Ben Prunty — that is the right call for a downloadable indie title with a budget. For a static personal-site recreation, two reasons synthesis wins: (1) zero asset weight, no CDN, no licensing dance — matches the rest of the gallery; (2) the *aesthetic target* here is quiet/parchment/contemplative — a thin synth tick is a closer fit than a Hollywood-grade impact sample, which would feel out-of-place against Sudoku and Crossword's near-silence. ADR-014's takeaway applies: synthesis succeeds on short one-shots with simple envelopes (this game's entire SFX list) and fails on continuously-modulated drones (this game has zero). CC0 sample fallback retained as a swap path — `audio.js` exposes one function per sound, so any individual SFX can be re-routed to a buffer source if synthesis is obviously off during build.
- **Mute / volume**: persisted across sessions in `localStorage` `hearthguard-muted`. Single mute toggle in v1 (no separate music/SFX sliders since there's no music).
- **First-interaction gate**: Audio context starts on the first click/tap/keypress on the title screen — same pattern as Pac-Man.

## Visual direction brief — for `/frontend-design` (§8)

> **Mood**: inked, parchment-warm, stained-glass-bright-on-thoughtful, hand-drawn-but-precise, quietly medieval. **Era reference**: hybrid of (a) *Inkle*'s text-adventure illustration style, (b) illuminated medieval manuscript marginalia, (c) modern indie tactics like *Wildermyth* or *Wargroove* but **explicitly not pixel-art**. **Palette**: extends site Warm Hearth tokens — parchment background `#f0e6d3` (site `--text-warm`) becomes the *grid* base, deep ink `#1a1611` becomes line-art, site gold `#c8943e` becomes selection highlight, ember `#a06828` becomes warm shadow under units, terracotta `#b05a3a` becomes enemy threat-tint with a stained-glass ~20%-opacity overlay. Stained-glass blue `#3a5a7c` (new accent, justify in design pass) is reserved for player movement range. Cohesion choice is justified — this is the *most* on-brand game in the gallery (the site already evokes warm parchment). **Typography**: `Fraunces` (display) for mission titles + score callouts; `Bricolage Grotesque` for HUD numbers and tooltips; **no pixel font** (deliberate departure from genre default). **Motion language**: weighty and confident — units don't bounce, they *step*; threats fade in over 200 ms with a slight ink-bloom; attack resolution plays at 600 ms per enemy with a hit-pause on redirects. **Iconography**: SVG silhouettes — Knight (kite shield + sword profile), Archer (longbow at draw), Mage (cowled figure + staff), Goblin (small + spear), Troll (hunched + club), Goblin Archer (shortbow), Villager (hooded). Threats: red striped overlay on target tiles + a small icon (sword/arrow/swirl) at the top-right of each threatened tile showing damage number. **Backgrounds**: subtle paper-grain (existing site SVG noise filter `#grain` is reusable), parchment-edge vignette, mission 3 has a faint inked castle-wall silhouette behind the grid. **Screens to design**: title/best-run, mission briefing scroll, active-play HUD (the hero piece — must read instantly under threat), pause overlay, mission-win seal-stamp, run-end summary, how-to-play scroll, mobile-portrait variants of all of the above. **The one detail nobody asked for**: every grid tile has a *very subtly* different inked grain — 4 tile variants randomized across the board so the parchment never looks tiled. Plus a quill cursor on desktop.

## Architecture brief — for `/feature-dev:feature-dev` (§9)

> Build the deterministic-tactics game at `games/hearthguard/` per ADR-018. Proposed files (challenge if a tighter cut works): `index.html`, `game.js` (entry + RAF loop + state machine `title → briefing → playing → resolving → mission-end → run-end`), `state.js` (immutable turn-state snapshots for free undo — single object, no Redux), `units.js` (Knight / Archer / Mage / Goblin / Troll / Goblin Archer factories with ability functions returning state-deltas), `ai.js` (deterministic enemy intent — pick target, telegraph, no adaptation), `resolver.js` (turn-resolution engine — simultaneous attack resolution with the "tile-occupant-at-resolution-time" rule from §0; this is the riskiest module, encapsulate it), `render.js` (DOM grid + SVG glyphs + threat-overlay + animation queue), `narrate.js` (pure: state → human-readable string list — drives `aria-live` region and is also exposed via `window.Hearthguard.describeState()` so an LLM agent or screen reader gets the same machine-clean text), `input.js` (mouse/keyboard/touch + delegation to `SharedGamepad`), `audio.js` (Web Audio synth, one function per SFX in §7's inventory), `missions.js` (3 hand-authored mission specs: starting layout, enemy waves, villager positions). Module pattern: IIFE on `window.Hearthguard`, matching Chess and Pac-Man. **State management**: a single immutable state object cloned on each player action, kept in an undo stack for the duration of a turn, popped on `Z`, cleared on Confirm. **Render**: DOM grid (`<div class="tile">` × 64) inside a wrapping `<div class="board">`; CSS Grid for layout; glyph layer via inline `<svg>` per occupied tile. Canvas only if profiling shows DOM is too slow (it won't at 64 tiles + ~10 entities). **Tick loop**: `requestAnimationFrame` only during active animations; turn-resolution runs through a small async queue (one animated attack at a time, with hit-pause). No fixed-timestep needed — there's no continuous physics. **Reuse `games/shared/gamepad.js`**; add `B: 1` to `SharedGamepad.BUTTONS` (small extension, justified — see §3). Do NOT prematurely extract a high-score helper. **Persistence**: `localStorage` keys `hearthguard-best-run`, `hearthguard-missions-completed`, `hearthguard-muted`, `hearthguard-tutorial-seen`, `hearthguard-anim-speed`. **Determinism**: the resolver is pure (state → state); the AI is pure (state → intents); the narrator is pure (state → strings); RNG is seeded per mission and only used between turns for spawn placement. This makes a future v2 daily-seed and replay-system trivial without rework, and makes the game cleanly inspectable by external automation (a screen reader, an LLM agent, or a future replay UI all consume the same pure functions). **Verification**: Chrome DevTools MCP per CLAUDE.md — navigate, snapshot, screenshot title + active-play + mission-win + run-end, `list_console_messages` filtered to errors, confirm zero failed network requests, manually verify all three hero verbs + all three enemy intents + redirect-into-friendly-fire (the marquee mechanic) + free undo + tutorial overlays + run permadeath flow + `aria-live` narration fires for each telegraph and resolution event + complete keyboard-only flow.

## Adjacent / orthogonal / perpendicular ideas (§10)

| # | Idea | Category | Verdict |
|---|------|----------|---------|
| 1 | Daily seed + emoji-grid result (🛡️🏹🔥 score share) | Orthogonal | **Park** — v2 |
| 2 | Replay system (rewatch a turn from any move forward) | Orthogonal | **Park** — v2 |
| 3 | Practice/sandbox mode (any mission, infinite restarts) | Adjacent | **Park** — v2 |
| 4 | Statistics dashboard (lifetime runs, hero-favorite, perfect-rate) | Orthogonal | **Park** — v2 |
| 5 | Alternate hero squads (Rangers / Wizards / Clerics) | Adjacent | **Park** — v2 |
| 6 | Pilot/hero progression between missions (XP, perks) | Adjacent | **Park** — v2 |
| 7 | Dragon enemy (3-tile breath cone) | Adjacent | **Park** — v2, headline of v2 ADR |
| 8 | Konami-code easter egg (hidden 4th hero — Bard) | Perpendicular | **Drop** |
| 9 | Date-aware palette (gilded for holidays, ash for Halloween) | Perpendicular | **Drop** |
| 10 | Animated title screen reacting to idle (units pace nervously) | Perpendicular | **Park** — small touch for a v2 polish pass |
| 11 | Cross-game "House Cup" meta-leaderboard | Cross-game | **Park** — own ADR, not Tactics-specific |
| 12 | Photo/screenshot mode of final-turn board | Orthogonal | **Drop** — `Print Screen` is enough |
| 13 | High-contrast mode beyond reduced-motion | Adjacent | **Park** — accessibility v2 |
| 14 | Dyslexia-friendly font toggle | Adjacent | **Park** — accessibility v2 |
| 15 | Screen-reader narration of telegraphs ("goblin will hit knight for 1") | Adjacent | **Ship in v1** — biggest a11y win in the gallery; same channel doubles as machine-readable surface for LLM agents |
| 16 | Shareable "puzzle of the turn" — export current board as link | Orthogonal | **Drop** — doesn't compose with run permadeath; revisit only with daily-seed |
| 17 | A "closest you got" replay on run loss | Failure-mode gift | **Ship in v1** — single-line summary of best turn ("Turn 4: redirected 2 attacks") |
| 18 | Compliment generator on loss ("the bards will sing of turn 3") | Failure-mode gift | **Ship in v1** — small flavor lines, ~12 strings, harmless |

## Fun audit (§11)

1. **The 10-second hook**: First click selects a Knight; tile-glow shows where they can move *and* which enemy attack they'd block by standing on a target tile. Strategy is visible immediately — no wall of text.
2. **The skill ceiling**: Mission 3 perfect-clear (all enemies dead, 0 villagers hit, ≥1 turn unused) is hard. Expert play is identifiable by *consistent* perfect-clears across runs, not by reaching a higher number.
3. **The story you tell a friend**: *"I had a goblin about to one-shot the last villager and I pushed a troll into its path — they killed each other and I won."* If a player can say something like this after a run, the loop is fun. (This is the central design test — every other decision serves it.)
4. **The surprise**: The first time a player realizes pushing an enemy can cause an *enemy* to be the target hit by another enemy's attack. Designed-in via the simultaneous-resolution rule (§0).
5. **The restart friction**: New Run button is one click from run-end screen. Mission start is auto-forward from briefing scroll (no extra click). End-of-run → playing-again target: **<2 seconds**.

## Beauty audit (§12)

- **Hero frame** (the gallery screenshot): Mid-mission active-play. Knight selected, blue stained-glass move-range fan, red striped threat-zone on two tiles, a Mage to the right with its swap line teased in faint outline, parchment edges, three small villager glyphs along the bottom row. Score "0 lost" stamp visible. Reads as *"a game where you think before you act"* in one image.
- **Negative space**: The board has no decorative chrome inside the play area — all HUD lives at the top edge and bottom strip. Eyes rest on the parchment grain itself.
- **Readability under pressure**: Threat numbers are large + shape-coded (sword/arrow/swirl). HP bars on heroes are 3 segmented squares (not numerical) so glance-readable. "Confirm turn" button never moves.
- **Cohesion with chases.house**: This is the *most* on-brand game in the gallery — site is already a warm parchment vibe; this game *is* parchment. Justified extension, not a break.
- **The one detail nobody asked for**: Subtle inked-grain variation across tiles (4 randomized variants) so the board never looks like a checkerboard of identical squares. Plus a small quill-cursor on desktop.

## Scope discipline (§13)

```
## Architectural Decision: Recreate Into-the-Breach-style Tactics on chases.house

DRY:   Reuses games/shared/gamepad.js (adds B button to BUTTONS, justified
       extension). Reuses styles.css design tokens. localStorage pattern is
       Snake/Asteroids-similar — accepted; flag as the next-consumer trigger
       for a games/shared/highscores.js extraction.
YAGNI: Cut multiplayer, music, daily seed, replay, achievements, hero squads,
       dragon, mage-enemy, mid-run save, difficulty selector, pixel-art
       aesthetic. Each cut is the boring-correct call — none affect the v1
       core loop.
SOLID: Each proposed module has one responsibility. Resolver is pure (state
       in, state out); AI is pure (state in, intents out); render is the only
       module that touches DOM. game.js orchestrates only.
KISS:  DOM grid over Canvas (64 tiles), Web Audio synth over sample download,
       localStorage over Firebase, single immutable-clone undo over a Redux
       layer, no fixed-timestep (no physics). One slightly-clever choice —
       turn-resolution as an animated async queue — justified because
       simultaneous-attack rules need a sequenced render of an instant logical
       step.

Decision: Proceed to v1 as scoped above.
```

**v1 cut line** is the "v1 Scope (ship)" section at the top. Everything in "Out of scope / follow-ups" sits behind it as a v2 ADR.

## Resolutions (Q&A round 1)

Six questions from the planning pass were answered; five are locked, one (display name) is being workshopped further in §Name below.

| # | Question | Resolution |
|---|----------|------------|
| 1 | Display name | "Watchfire" accepted as placeholder; user asked to workshop further. See **§Name workshop** below. |
| 2 | Grid size 8×8 vs 6×6 | **Locked: 8×8.** *Into the Breach* itself ships 8×8 and is the genre exemplar. *Hoplite* uses small hex (different geometry). *Advance Wars / FFT / XCOM* all use much larger variable maps (different genre). For this puzzle-tactics niche, 8×8 is the validated standard; 6×6 thrashes 3 heroes + 3 villagers + ≥3 enemies. |
| 3 | Add `B: 1` to `SharedGamepad.BUTTONS` | **Locked: yes.** Per W3C Standard Gamepad Mapping, button index 1 is universally the right-of-confirm face button — Xbox `B`, PlayStation `○`, Switch `A` (physical layout). The label varies by platform, the *position* (and therefore the muscle-memory cancel role) does not. No platform branching needed. |
| 4 | Audio synthesis vs CC0 samples | **Locked: synthesis.** Reasoning detailed in §7. tl;dr: ItB's full-orchestral score and Hollywood SFX are right for a paid indie title, wrong for a contemplative parchment-quiet personal-site recreation. Synthesis matches the gallery's other near-silent thinkers (Sudoku, Crossword) and ADR-014 validated synthesis on exactly this profile (short one-shots with envelopes). |
| 5 | Screen-reader narration in v1 | **Locked: yes, in v1.** Bumped from §10 idea-15 (parked) to v1 ship. Two reasons compounded: (a) deterministic text-able games are the highest-leverage a11y target in the gallery; (b) the same `narrate.js` pure function exposes a clean machine-readable surface — an LLM agent can play the game from narration alone, no DOM/canvas vision needed. Cost is ~150 LoC because the resolver is already pure. |
| 6 | Gallery glyph: ♞ vs ⚔ vs 🛡 | **Locked: ⚔ crossed swords.** Agreed with the user's instinct — ♞ (knight) reads chess-y and the gallery already has Chess. ⚔ communicates "tactical combat" without genre overlap. 🛡 over-emphasizes the defensive framing and under-sells the proactive verbs (push/pull/swap). |

## §Name (resolved)

**Display name: Hearthguard.** Folder: `games/hearthguard/`. Module: `window.Hearthguard`. Storage prefix: `hearthguard-*`. The name was workshopped against five tests (originality, verb-specificity, site cohesion, length, mobile readability) and won on the second test most decisively — the site palette is literally named "Warm Hearth" and the game's win condition is *protect the people gathered at the fire*. Historical anchor: a king's household guard. ADR title, file name, and all path references updated accordingly. The workshop process is preserved below for the record in case future ADRs revisit the choice.

## §Name workshop (record)

The brief asks for a D&D-flavored medieval tactics title that fits a personal-site gallery built on a "Warm Hearth" palette. Tests a name should pass:

1. **Original** — no franchise / trademark collision (rules out *Bastion*, *Stronghold*, *Vanguard*, *Aegis*).
2. **Specific to the verb set** — heroes guard 3 villagers from waves of enemies. The name should evoke *defense / vigilance*, not generic combat (rules out *Skirmish*, *Battleline*, *Onslaught*).
3. **Cohesive with the site** — the site palette is literally named "Warm Hearth"; bonus points for evoking hearth/firelight.
4. **One or two words, no subtitle** — gallery cards have ~14 chars before the title wraps.
5. **Reads on a phone screen at 16 px** — no aggressive ligatures.

Candidates with reasoning:

| Name | Pitch | Trade-off |
|------|-------|-----------|
| **Hearthguard** | Historical: a king's personal household guard. Direct phonetic + thematic link to the site's "Warm Hearth" tokens. Suggests "protect the people gathered at the fire," which IS the game's win condition. | Slightly long (11 chars). Possibly too on-brand — could read as branded merch rather than a game. |
| **Watchfire** | Current placeholder. The signal-fire kept burning to warn of approaching attack. Short, punchy, atmospheric. | Generic-fantasy-adjacent; doesn't directly evoke *tactics* or *the player's verbs*. Used as a chapter title in many fantasy novels. |
| **The Long Watch** | Quietly evocative — implies patience, vigilance, the thoughtful pacing that IS the gameplay. Title-cased reads literary. | Three words; gallery card may strain. Slightly somber for a game with a fanfare and gold-stamp wins. |
| **Bulwark** | Punchy, single word, unambiguously defensive. A bulwark is *the thing the player builds with their unit positions*. | Hard consonants; some collision with Bulwark.net (security brand) but no game-industry overlap I could find. |
| **Standfast** | Archaic compound (one who stands fast); both verb and identity. Beautiful on parchment. | Risks reading as a typo; a player might not know how to say it. |
| **Wardens** | The 3 heroes literally are wardens of 3 villagers. Plural noun = the player's squad, neat fit. | "Warden" carries D&D-class baggage (rangers, druids); could mis-cue what kind of game it is. |
| **Threshold** | Evokes the village edge the heroes hold. Literary, slightly oblique. | Doesn't read as a game name first; reads as a poetry collection. |

**Recommendation: "Hearthguard."** It is the only candidate that ties site-palette → game-fiction → win-condition in one word. If "Hearthguard" reads too branded, **"Bulwark"** is the cleanest single-word alt (defense-coded, punchy, no franchise collision). **"Watchfire"** stays viable as a third choice and is a perfectly acceptable ship name if a tiebreaker is needed.

**Outcome**: Hearthguard accepted.

## Hand-off checklist

- [x] §0 canonical reference grounded in ItB rules, not hallucinated
- [x] §3 includes gamepad mapping via `games/shared/gamepad.js` (`BUTTONS.B = 1` extension approved)
- [x] §7 audio source decided (synthesis, locked)
- [x] §8 brief ready to hand to `/frontend-design`
- [x] §9 brief ready to hand to `/feature-dev:feature-dev` (now includes `narrate.js`)
- [x] §10 lists 18 candidate ideas, each marked ship/park/drop (idea #15 promoted to v1)
- [x] §13 has explicit v1 cut line
- [x] Display name finalized (**Hearthguard**)
- [x] ADR file written to `docs/adr/018-hearthguard.md`

---

**Status**: All planning decisions locked. Next step is the design + architecture handoff: invoke `/frontend-design` with the §8 brief, then `/feature-dev:feature-dev` with the §9 brief. No game code is written until both passes return.
