# ADR-020: Fishing

**Status**: Accepted (planning pass — visual direction confirmed Stardew-style; ready for `/frontend-design` and `/feature-dev:feature-dev`)
**Date**: 2026-04-25

## Summary

A solo, cozy, real-time **arcade-fishing** game lives at [games/fishing-game/](games/fishing-game/). The player casts a line into water, watches a bobber, hooks on a strike, and plays a short Stardew-style bobber-bar reel-in minigame to land the fish. Catches accumulate cash, cash buys rod upgrades, upgrades open deeper water with rarer fish. Sessions are 2–5 minutes; runs are infinitely re-castable; a daily seed gives friends something to compare.

The genre niche it fills on the site: real-time *cozy* — the opposite mood of Snake (twitch) and the puzzle solos (Sudoku, Crossword). It is the dusk-on-a-dock game, rendered in 16-bit pixel art.

---

## §0. Canonical reference — what IS a fishing game?

**Genre & lineage.** "Arcade fishing" — direct ancestors are Nintendo's *Black Bass* (1989), Sega's *Bass Fishing* (1997 arcade), and *Reel Fishing* (PS1). Modern descendants: the *Stardew Valley* fishing minigame (2016, bobber-bar tension), *Animal Crossing* (timed-strike), *Webfishing* (2024, multiplayer cozy), and the most direct browser ancestor — Coolmath's *Tiny Fishing* (cast → hook on the way up → upgrade). The recreation borrows Stardew's bobber-bar reel from the moment of strike, plus Tiny Fishing's session shape (cast → catch → sell → upgrade → cast again).

**Core loop (one sentence).** *Cast, wait for the strike, win the reel-in minigame before the line snaps, sell the fish, and decide whether to upgrade or cast again.*

**Win / lose / score.**
- No "win" — open-ended. Score = lifetime cash + rarest catch.
- Per-cast loss = line snaps (tension overflow) or fish escapes (bobber misalignment too long). The fish gets away, no payout.
- Run never ends — the player closes the tab when they're done. (This is intentional cozy framing, not arcade-loss framing.)

**Iconic moments (non-negotiable).**
1. **The cast** — a satisfying arc-to-splash with a small water ripple.
2. **The strike** — the bobber jerks, a haptic/visual thump, and the player must react within ~800 ms.
3. **The reel fight** — a short Stardew-style bar where the player's "catch zone" must keep the fish silhouette overlapped while the fish darts; tension meter rises if misaligned.
4. **The reveal** — fish breaks the surface, name + size + rarity displayed, a small flourish for rares.
5. **The "one that got away"** — when the line snaps, a brief silhouette of the lost fish flickers and dives. This is a *gift to the player on failure* (see §10).

**Rules amateur clones get wrong.**
- Strikes that happen on a perfectly fixed timer feel rigged — strike windows must be a noisy distribution, not a metronome.
- Reel minigames that punish *moving the reel* (rather than rewarding *staying aligned*) feel hostile. The fish should feel like a creature with intent, not a random number.
- "Bigger = rarer" is the wrong axis alone — rarity should also include *unusual* (small but bizarre fish are a good surprise tier).
- Cash inflation: if upgrades come too fast, depth tiers feel meaningless. If too slow, the loop dies. This is the single hardest tuning job.
- Ignoring the *idle* moment between cast and strike — that quiet is the whole point. Don't over-fill it with UI noise.

**Era & feel.** Mid-2010s indie cozy — *Stardew Valley* (2016) is the polestar. 16-bit-inspired pixel art, warm earthy palette, deliberate dithering, soft idle ambient animation. Not strict NES-era 8-bit; not modern flat-vector. The mood is *quiet farm-sim dusk*: a chunky pixel sun, a wooden dock, a chunky pixel bobber, and the kind of music that makes time soft.

---

## §1. Fit for chases.house

- **Why this game, why this site?** The gallery has turn-based AI strategy (4 games), real-time twitch (Snake), cerebral puzzles (Sudoku, Crossword), and party multiplayer (Jeopardy, Pac-Man). It has no *cozy* game — nothing you'd open while half-listening to a podcast. Fishing fills that mood gap and is visually distinctive in a way no current game is (water, sky, wood — none of the existing palette work uses water).
- **Solo / multi.** Solo only for v1. Daily-seed comparison ("you got the Lakeworm at depth 3 today?") gives a shareable hook without server-authoritative state.
- **Session length.** 30 sec — 5 min per casting session, infinitely repeatable. No save-and-resume needed; persistent upgrades carry across visits via `localStorage`.
- **Dealbreakers.** None. No backend needed, no matchmaking, no anti-cheat (high scores are local). The whole game is a state machine over a Canvas 2D scene.

---

## §2. Players & modes

| Mode | Decision | Reason |
|---|---|---|
| Single-player | **In** | The core experience. |
| Local co-op | Out (v1) | Cozy fishing alongside a friend is sweet but doubles UI complexity. Park in §10. |
| Local versus | Out | Adversarial framing breaks the cozy mood. |
| Online multiplayer | Out | Would require Firebase. Not justified for a contemplative solo game. |
| Spectator / host view | N/A | No "TV" surface. |
| AI opponents | N/A | The fish *are* the opponents — see "fish AI" in §6. |

---

## §3. Controls & input

The whole game is one verb at a time — cast / wait / reel — so input stays simple.

| Action | Keyboard | Mouse | Touch | Gamepad |
|---|---|---|---|---|
| Cast (charge & release for distance) | Hold/release **Space** | Hold/release left-click | Press-and-hold on water | Hold/release **A** |
| React to strike | **Space** | Click | Tap | **A** |
| Move catch-zone during reel | **←/→** or **A/D** | Mouse X | Drag horizontally | Left stick X / D-pad **L/R** |
| Pause | **Esc** or **P** | — | Tap pause icon | **Start** |
| Sell + upgrade menu | **Tab** or shop-button | Click shop | Tap shop | **B** opens shop |

- **Gamepad** routes through [games/shared/gamepad.js](games/shared/gamepad.js) (per ADR-016). Use `consumeButtonPress` for **A** strikes, raw axis read for catch-zone motion, and `rumble` for the strike thump and tension warning. **Buttons added to the shared module:** `B` (shop), `START` (pause). (ADR-016 currently exposes only `A` and the d-pad — extend `BUTTONS` when this game is built.)
- **Mobile.** Fully playable: tap to cast, tap to react to strike, drag horizontally to move the catch-zone. The reel minigame is wide enough that thumbs work.
- **Accessibility.** Hold-to-cast charge timer is generous (≥1.0 s). The strike window is *configurable* in pause-menu settings (default 800 ms, easy 1500 ms). Reduced-motion mode flattens screen-shake and parallax. Colorblind-safe: the catch-zone uses a *bright-outline + diagonal-stripe pattern*, not just hue, against the fish silhouette.
- **Input feel knobs:** charge curve (linear vs ease-out), strike-window length, fish-velocity smoothing, catch-zone friction, tension-bar fill rate / decay rate, gamepad stick deadzone (already in shared util).

---

## §4. UI / UX structure

The game lives on **one screen**. Mode/menu changes are overlays, not page transitions.

1. **Title / attract** — Idle dusk scene, gentle water lap, "Press Space / Tap to start." After 6 s idle, an attract animation: an unseen fish strikes, a silhouette fights, the rod bends. Then back to idle.
2. **Active play** — The dock + water + sky scene. Persistent HUD (top-right): cash, depth tier, current rod, daily-seed badge. Bobber + line are the focal point. The rest is negative space.
3. **Strike → reel overlay** — Reel-bar appears centered, mid-screen. World scene dims slightly behind it. Tension meter on the side.
4. **Catch reveal** — Fish portrait, name, length, rarity stars, cash awarded. 2 s default; press anything to dismiss faster.
5. **Pause** — Resume, Settings (audio sliders, strike-window difficulty, reduced-motion, colorblind), How to play, Quit-to-title. Quitting *keeps* upgrades and cash (auto-saved).
6. **Shop** — Slide-up panel: rod tier, lure tier, line strength. Each upgrade names what it changes. Closes back to active play.
7. **Bestiary** (small, optional) — Caught fish gallery, silhouettes for uncaught ones.
8. **Help** — Three-step inline animation, not a wall of text. Skip after one read.

For each screen: primary = press the same button (Space / A / tap); secondary = pause; back-out = Esc. **Mobile layout:** the HUD shrinks; the shop becomes a bottom sheet.

---

## §5. Progression & persistence

- **localStorage key:** `fishing-state` — cash, owned upgrades, bestiary set, lifetime stats, settings.
- **Persistent upgrades.** Three tracks, four tiers each: rod (catch-zone width), lure (rarity bias), line (tension capacity). 12 buy-decisions over the lifetime of an account = the long-arc progression.
- **Depth tiers.** Unlocked by upgrades, not separately purchased. Each tier introduces a fish pool with a few new species.
- **Daily seed.** Today's date seeds the strike sequence and the fish-spawn pool. A small "Daily" toggle (default on) pins the seed so two players on the same day can swap notes ("the daily had a Moonperch in tier 3"). Off = random.
- **Bestiary** — set of fish IDs ever caught. Small reward; mostly for the warm "I've seen you before" feeling.
- **No achievements, no streak counters.** YAGNI; cozy framing.

---

## §6. Difficulty & game feel

- **Curve.** First three casts: high-frequency strikes, easy reel, easy fish. Strike windows tighten and fish AI gets jumpier as the player upgrades into deeper tiers.
- **Onboarding.** First cast: a coach-mark "Hold Space, release to cast." First strike: "Press Space when the bobber jerks!" First reel: "Keep the bright zone over the fish." Three coach-marks total. Auto-suppressed after first successful catch; never appears again on this device.
- **Adaptive assist.** If three reels fail in a row, the catch-zone widens 15% silently for the next reel. Never spoken aloud — the player should feel competent, not patronized.
- **Fish AI.** Each fish species has: base speed, dart frequency (Poisson), pause probability, reversal preference, and a "spook" multiplier when the catch-zone is dead-on. This produces species that feel different — the Lakeworm is wriggly, the Trout is straightforward, the rare Moonperch is jittery and pauses unpredictably.
- **Feedback / juice budget.**
  - Cast → bobber-splash particle + ripple ring + low *plonk*.
  - Strike → 80 ms screen-shake (≤4 px), gamepad weak-rumble pulse, sharp transient SFX, bobber lurches.
  - Reel-bar misalignment → tension bar tints amber; near-snap = strong pulse + screen tint warning.
  - Successful land → confetti is overkill; instead, the rod springs straight, water bursts up briefly, fish silhouette rises, brief warm-light wash.
  - Snap (loss) → sharp *ping* of the line, slow-mo dive of the silhouette, rod recoil. **No** "you lose" text — just a quiet beat before the next cast.
- **Signature game feel.** The **strike thump** — the moment the bobber jerks. It must hit harder than feels reasonable. Screen-shake + rumble + transient SFX + bobber animation in 80 ms. That moment is the dopamine spike that earns the quiet minutes around it.

---

## §7. Audio

- **Music.** A single 90–120 s looped track — cozy, melodic, evening-lake. Stardew's musical lineage is acoustic-leaning (piano, soft strings, light percussion) rather than chiptune; lean that direction. The Web Audio bus loads the loop on first-interaction unlock and starts immediately at low volume — no separate "press to enable music" step.
- **SFX inventory.**
  - `cast_charge` (held tone rising), `cast_release` (whip), `splash`, `water_idle_loop` (gentle lap)
  - `strike_thump`, `bobber_jerk`
  - `reel_tick` (steady), `reel_warn` (tension spike), `line_snap`
  - `catch_land`, `rare_sting` (only on rare+)
  - `menu_move`, `menu_confirm`, `menu_back`
  - `coin` (sale)
- **Source.** CC0 — the Pac-Man pattern (ADR-014) of OpenGameArt sample packs + Web Audio bus. Avoids any licensed-IP risk. Music biases toward acoustic/orchestral cozy samples (piano, strings, soft chimes). SFX can mix organic foley (water, splash) with a touch of warm chiptune blip on menu cues — **chiptune-leaning is now welcome** since the visual is pixel art, but keep ambient/world sounds organic.
- **Mix bus.** Master + music + sfx, persisted sliders (default 70 / 60 / 80). First-interaction unlock at the first key/click on the title screen; music fades in over ~1.5 s so the unlock doesn't feel jarring.

---

## §8. Visual brief — handoff to `/frontend-design`

> **Brief for `/frontend-design`:** Build the visual language for a **Stardew Valley–style cozy pixel-art** fishing game on chases.house. **One screen, dusk-on-a-dock**, Canvas-2D scene rendered in 16-bit-inspired pixel art. Vibe: cozy farm-sim, slightly melancholic-warm; the calm before a strike. Adjectives: *cozy, golden-hour, chunky-pixeled, generous, slightly secretive.*
>
> **Era reference:** *Stardew Valley* (2016) is the polestar — chunky-but-readable pixel sprites, warm earth-tone palette, deliberate dithering for gradients, soft idle animations on every prop. Adjacent references: *Animal Crossing: New Leaf* fishing scenes, *Eastward*, *Chicory* (looser, but the same cozy register). **Not** strict 8-bit NES, **not** modern flat-vector, **not** illustrated/painterly.
>
> **Pixel scale.** Base art at **2× pixel resolution** — sprites authored at small sizes (16×16 base tiles, 32×32 fish sprites, 48×64 rod-and-rod-arm) and `image-rendering: pixelated` upscaled to viewport. Lock the visible play area to a virtual resolution near 320×180 (16:9), letterboxed if the canvas doesn't divide cleanly. Any UI overlay text that *isn't* in the pixel font (see typography) lives outside the canvas at native resolution.
>
> **Palette.** Extends the site tokens, leaning warm and saturated like Stardew's seasonal palettes:
> - **Sun & gold:** site `#c8943e` for the chunky pixel sun and HUD accents.
> - **Wood & ember:** site `#a06828` for the dock planks; site `#b05a3a` (terracotta) for sky-horizon dithering.
> - **New (dusk-blue family):** `#1d3147` deep-water, `#2a4a6b` mid-water, `#3e6a8f` near-shore, plus a single highlight `#7fb0d4` for the moving water-shimmer pixel. The site has no blue elsewhere — this is the deliberate break, justified because water cannot read warm.
> - **Foliage / land:** muted greens `#4a6b3a` (dark) and `#6b8a4a` (mid) for the silhouetted far hills.
> - **Sky gradient:** terracotta-orange high → dusk-blue low, dithered transitions (no smooth gradient — that would break the pixel-art language).
> - Vignette / title backdrop: `#0a0a0b` only at the absolute edges.
>
> **Typography.** Hybrid:
> - **In-canvas (HUD numbers, catch-reveal name + size, shop labels):** a pixel-style font like **Pixelify Sans** (Google Fonts; pixel-art typeface that scales legibly). All in-game text uses this. Numbers are tabular so the cash counter doesn't shimmy.
> - **Page-shell + gallery card title:** site defaults (Fraunces / Bricolage) — keeps cohesion with the rest of chases.house outside the canvas.
> - **Game title text on the title screen:** authored as a small bespoke pixel-banner sprite (sized at 2× pixel scale), not webfont. Reads as part of the world.
>
> **Motion language.** Pixel-art is sprite-driven and snappy. Lean into:
> - **Step-frame animation** (3–4 frames at 6–8 fps) for water shimmer, rod sway, and idle dock embers — *not* CSS easing curves.
> - **Snap-to-pixel motion** for fish silhouettes during the reel-bar (no sub-pixel interpolation; positions round to integers). This is what makes pixel art feel pixel-art.
> - **Cinematic moments** (strike thump, snap, rare-tier reveal) get full-frame screen-shake measured in *pixels* (1–3 px), not percentages.
>
> **Iconography & sprite list.** Author as pixel sprites, not SVG. Approximate sizes:
> - Fish silhouettes for reel-bar: 24×16 to 48×24 across rarity tiers.
> - Fish portraits for catch reveal: 64×48 with two highlight colors + outline.
> - HUD icons (coin, rod, depth marker, daily badge): 16×16 each, single-color outline + 1-pixel highlight, gold-accent.
> - Bobber: 8×12, with a 2-frame jerk animation for strike.
> - Catch-zone in reel-bar: vertical band, **bright gold outline + dithered fill** (colorblind-safe — pattern, not just hue, against fish silhouette).
>
> **Backgrounds & environments.** Three parallax layers:
> 1. **Far layer (slow, ~1 px / s):** silhouetted hills + chunky pixel sun, sky dither.
> 2. **Mid layer (medium, ~3 px / s):** water surface with 4-frame shimmer animation; surface line ripples on impact.
> 3. **Near layer (foreground, static):** dock planks (with subtle grain), the rod, the rod-arm. Idle: rod tip animates a 1-pixel up-down bob on a 2 s loop. Fireflies (1-pixel sprites) drift up at low density on a Bezier-ish path approximated by 8 keyframes.
> - **No bloom, no blur, no anti-aliased glow.** All "glow" is achieved with palette-shifted dithering.
>
> **Hero frame for the gallery card.** A 16:9 pixel-art shot: silhouetted dock + rod-arm at right, chunky pixel sun half-melted into the water at left horizon, bobber a single bright pixel dead-center, three concentric ripple rings. Title "Fishing" rendered as a small pixel-banner sprite floating above the rod. **Render this exact frame as the gallery preview image** (`docs/screenshots/fishing-game-card.png` → eventually `games/fishing-game/preview.png`). If you cannot picture this frame, the visual is not ready.
>
> **The one detail nobody asked for.** The chunky pixel sun has a **single highlight pixel** that drifts left across its face on a 90 s cycle, like a sun-spot. A close looker will catch it. Combined with the rod-tip bob and the occasional firefly landing on the rod — three small loyalty rewards for someone who watches the idle scene.
>
> **Cohesion guardrail.** The site shell (header nav, footer) stays in Fraunces/Bricolage at native resolution. Only the canvas and its overlay UI go pixel. The visitor's eye should travel "site → game frame → pixel world inside" — the transition framed, not jarring.

(Brief is ready to hand off; do not implement visuals from this ADR alone.)

---

## §9. Architecture brief — handoff to `/feature-dev:feature-dev`

> **Brief for `/feature-dev:feature-dev`:** Solo, single-page, Canvas-2D arcade-fishing game at [games/fishing-game/](games/fishing-game/). Static, no backend, no build step. Pixel-art rendering (`image-rendering: pixelated`, virtual resolution ~320×180 upscaled). Match site conventions (see [games/snake/](games/snake/) and [games/pacman/](games/pacman/) for precedent).
>
> **Proposed files (start minimum, justify any extras):**
> - `index.html` — page shell, inline CSS, `<canvas>`, overlays for title/pause/shop/catch-reveal.
> - `game.js` — main module (`window.Fishing`), state machine, render loop, input dispatch.
> - `fish.js` — pure data: species table (id, name, rarity tier, AI parameters, cash value).
> - `audio.js` — Web Audio bus, sample loader, played-cue API. Mirrors Pac-Man's audio module shape.
>
> Defer until needed: a separate `render.js` is **not** justified at v1 — it would be one consumer with no reuse. Same for an `input.js` — input is small enough to live in `game.js` and the gamepad utility is already shared.
>
> **Module pattern.** `window.Fishing` namespace, IIFE per file (matches site convention). Single source of truth for state.
>
> **State machine** with named states: `title → casting → waiting → strike → reeling → reveal → (back to casting)`, plus `paused` and `shop` overlays. Each state has an `enter`, `tick(dt)`, and `exit`. Transitions are explicit — no implicit booleans. Pause/shop are stack overlays, not states (they freeze the underlying tick).
>
> **Render approach.** Canvas 2D with **pixel-art configuration**: set `imageSmoothingEnabled = false`, render to a backing canvas at virtual resolution (~320×180), then `drawImage` upscale to the visible canvas with integer scaling. Three layered draws per virtual-resolution frame: background parallax, world (water/dock/bobber/line), HUD. Object count is tiny (≤30 sprites at peak), so no need for WebGL or off-screen-canvas batching beyond the single virtual backbuffer.
>
> **Tick loop.** `requestAnimationFrame` with **fixed-timestep accumulator** (60 Hz logical ticks). The reel minigame's tension math depends on consistent deltas — variable-step would make rare frame drops feel like cheating. Determinism (for daily seeds) is required only for the strike RNG and fish-spawn RNG; isolate them behind a seeded `Math.random` substitute (Mulberry32 or similar — small, well-understood).
>
> **Shared utilities.**
> - **Use** [games/shared/gamepad.js](games/shared/gamepad.js) (ADR-016). Extend `BUTTONS` to expose `B` and `START` indices (1 and 9 in standard mapping). The PR for fishing should land that extension and prove it with a passing build of Pac-Man + Jeopardy.
> - **Don't extract** anything new to `games/shared/` yet. A high-score utility, a settings utility, an audio bus — each looks tempting, but only one consumer exists. ADR-016's principle: extract only when there is a real second consumer demanding it.
>
> **Networking.** None.
>
> **Testing / verification (per CLAUDE.md).** Run dev server (`python -m http.server 3003`). Chrome DevTools MCP: `navigate_page` to `http://localhost:3003/games/fishing-game/`, `wait_for` the title heading, `take_snapshot`, `take_screenshot`, `list_console_messages` filtered to errors, `list_network_requests` for any 4xx. Then drive the full loop (cast → strike → reel → reveal → shop) via `click` and `press_key`. Verify pixel-art crispness at multiple zoom levels (canvas should never show smoothing artifacts). Verify mobile via `resize_page` to 390×844 (iPhone-class). All zero-error runs before close-out.

(Brief is ready to hand off; do not write code from this ADR alone.)

---

## §10. Adjacent / orthogonal / perpendicular ideas

Ten+ candidate ideas, each with a verdict.

| # | Idea | Axis | Verdict | Note |
|---|---|---|---|---|
| 1 | Local co-op (two rods, alternating casts) | Adjacent | **Park** (v2 ADR) | Doubles input + UI complexity; cozy is best solo. |
| 2 | Lake variants (river / ocean / pond) themed by upgrade tier | Adjacent | **Park** | Tempting, but v1's "depth tiers" already vary the fish pool. Add when v1 ships and depth feels stale. |
| 3 | Replay system (play back a successful reel) | Orthogonal | **Drop** | Cute, but no audience for a personal-best replay in a solo game. |
| 4 | Shareable result card (Wordle-style emoji grid of today's catches) | Orthogonal | **Ship in v1** | Tiny implementation cost; unlocks the "did you do today's daily?" loop. Bottom of the catch-reveal screen: "Copy result." |
| 5 | Photo mode (pause and arrange the scene for a screenshot) | Orthogonal | **Drop** | Pretty, but only the developer would use it. |
| 6 | Speedrun timer for "first Moonperch" | Orthogonal | **Drop** | Wrong mood — speedrunning is the antithesis of cozy. |
| 7 | Konami-code easter egg (Loch Ness silhouette appears at impossible depth) | Perpendicular | **Ship in v1** | One sprite + one rare RNG branch. Pure delight. |
| 8 | Date-keyed flourishes (cherry blossoms on April 1, snow flurries in December) | Perpendicular | **Park** | Charming, but invisible most of the year. Add once basic palette is locked. |
| 9 | Animated title-screen attract (idle catch every 6 s) | Perpendicular | **Ship in v1** | Already in §4. Cheap; pays back tenfold on the gallery card hover preview. |
| 10 | Cross-game "house cup" leaderboard | Cross-game | **Drop** | Different game cadences make this incoherent (chess elo + fishing cash + sudoku time?). |
| 11 | Failure gift: ghost silhouette of the lost fish dives back down | Failure-mode | **Ship in v1** | The signature *gift on failure*. Already named as iconic in §0. |
| 12 | "Closest you got" hint after a snap ("It was a Moonperch — first of the season") | Failure-mode | **Ship in v1** | Twofold reward: comfort + a hook to cast again. Tiny cost. |
| 13 | Reduced-motion mode (no parallax, no shake) | Accessibility | **Ship in v1** | Required-table-stakes for any motion-heavy scene. |
| 14 | Screen-reader narration of strikes and catches | Accessibility | **Park** | Real value but real implementation cost; fishing is a heavily-visual game. Park honestly rather than ship a half-baked version. |
| 15 | Dynamic favicon (a tiny bobber that bobs when a strike is happening in a background tab) | Perpendicular | **Park** | Charming but easy to bungle; do once after v1 telemetry shows people leave the tab open. |

**v1 ship list from §10:** #4 (share card), #7 (Loch Ness), #9 (attract), #11 (ghost silhouette), #12 (closest-you-got), #13 (reduced motion).

---

## §11. Fun audit

1. **The 10-second hook.** The dusk scene is *quiet and inviting*. The first cast lands a small fish in 20 seconds, with a punchy strike-thump. Curiosity does the rest: "How big can this get?"
2. **The skill ceiling.** Mastery = reading the fish's dart pattern and pre-empting it (not chasing). Expert play looks like the catch-zone *anticipating* the fish, holding mostly still while the fish darts into it. A novice catches the easy tier; an expert lands rares because they don't lose tension on jittery fish.
3. **The story you tell a friend.** "Bro the daily today had a *Moonperch* and I nearly snapped my line — like 95% tension, three darts in a row, and it just… came right to me at the end." If that sentence doesn't survive playtesting, the loop is broken.
4. **The surprise.** First time a *rare-tier* fish strikes, the strike-thump is louder, the screen tint deepens, and the silhouette during reel is unmistakably weirder. Players were not told this would happen.
5. **The restart friction.** From snap or land back to "ready to cast" = under 1.5 s. The catch-reveal can be dismissed faster with any input. The shop is a sidebar, not a screen change.

---

## §12. Beauty audit

- **Hero frame.** Already specified in §8: low-horizon dusk dock, sun melting into water, bobber as a single point of light, ripples expanding. **This is the games-gallery card.**
- **Negative space.** The upper third of the screen is sky, near-empty. The water is a single broad surface. The dock and rod occupy a small wedge bottom-right. The HUD lives in the top-right *only* and disappears during the catch-reveal moment.
- **Readability under pressure.** During the reel, the world dims and the reel-bar is centered with a high-contrast outline. Tension is communicated by *both* a meter and a screen tint — a player who is panicking can still parse "I am about to lose" peripherally.
- **Cohesion with chases.house.** The pixel-art style is new for the site, but the gold/ember/terracotta palette extends naturally into 16-bit pixel form, and the page-shell type stays in site defaults — only the canvas goes pixel. **A visitor should feel "ah, same designer, different mood."** Not "this got iframed in." The break — adding dusk-blue and pixel typography inside the canvas — is intentional and necessary; water needs cool tones, and pixel art needs pixel font to feel honest.
- **The detail nobody asked for.** The rod tip bobs imperceptibly with the surface ripple, and a firefly occasionally lands on it. (§8.)

---

## §13. Scope discipline

```
## Architectural Decision: Recreate Fishing on chases.house

DRY:   Is this logic duplicated elsewhere?
       → Gamepad polling (use games/shared/gamepad.js — ADR-016).
       → Audio bus pattern (replicate Pac-Man's shape; do not extract — only one consumer).
       → localStorage settings: each game writes its own — no shared util yet (no second consumer).

YAGNI: Is this required for a shippable v1?
       → CUT: co-op, lake variants, photo mode, replay, speedrun timer, cross-game leaderboard,
              date-keyed flourishes, dynamic favicon, screen-reader narration.
       → KEEP: solo loop, three upgrade tracks × four tiers, daily seed, share card,
              reduced-motion mode, attract animation, ghost-of-the-lost-fish, Loch Ness easter egg.

SOLID: Does each unit have one responsibility?
       → game.js (state machine + render + input dispatch) is a god-module by definition;
         that is intentional for a small game. fish.js is pure data. audio.js owns the bus.
         Each state in the FSM is its own object (enter/tick/exit). No god-functions inside.

KISS:  Is there a simpler approach?
       → The simplest version that still delivers the loop: cast → strike → reel-bar → catch
         → small upgrade. Do that first. Add the daily seed last.

Decision: Proceed to /frontend-design and /feature-dev:feature-dev with the v1 cut below.
```

### v1 cut (ship)

- Solo game at `games/fishing-game/`
- One scene (dusk dock), Canvas 2D pixel-art (virtual 320×180 upscaled, `image-rendering: pixelated`), three parallax layers
- State machine: `title → casting → waiting → strike → reeling → reveal`, plus `paused` and `shop` overlays
- Three upgrade tracks (rod / lure / line), four tiers each, ~12 fish species across four depth tiers
- Daily seed (default on)
- Share-card export from catch-reveal
- Loch Ness easter egg (Konami code)
- Attract animation on title screen
- Ghost-silhouette + "closest you got" line on snap
- Reduced-motion + colorblind-safe catch-zone + configurable strike-window
- CC0 audio (per ADR-014 pattern)
- Gamepad support via ADR-016 `SharedGamepad` (with `B` and `START` button additions)
- Mobile-responsive layout
- Gallery card on [games/index.html](games/index.html)

### Out of scope (parked for follow-up ADRs)

- Local co-op (#1)
- Lake variants beyond depth tiering (#2)
- Date-keyed seasonal flourishes (#8)
- Dynamic favicon (#15)
- Screen-reader narration (#14)

---

## Open questions — resolved 2026-04-25

1. **Visual reference.** ✅ **Stardew Valley pixel-art cozy.** §0 era, §8 brief, §12 cohesion all rewritten accordingly.
2. **Daily seed default.** ✅ **On**, with a one-tap toggle in the pause menu. Cozy framing preserved — the seed only varies the fish pool, no time pressure.
3. **Audio default state.** ✅ **Music starts at first interaction**, fades in over ~1.5 s, default volume sliders 70 / 60 / 80. Browser autoplay constraint is respected by gating on first input; no separate "press to enable music" UX. Mute is always available via sliders or pause-menu toggle.
4. **Folder name.** ✅ **`games/fishing-game/`** (confirmed). All path references updated.
5. **Loch Ness easter egg.** ✅ **Ship in v1.** One sprite, one rare RNG branch on Konami code.

---

## Handoff checklist

- [x] §0 canonical reference is grounded (real games named, real rules called out)
- [x] §3 includes gamepad mapping via `games/shared/gamepad.js` (with explicit note to extend `BUTTONS`)
- [x] §8 brief is self-contained, Stardew-aligned, and ready for `/frontend-design`
- [x] §9 brief is self-contained and ready for `/feature-dev:feature-dev`
- [x] §10 lists 15 candidates, each marked ship/park/drop
- [x] §13 has an explicit v1 cut line and parked-for-v2 list
- [x] ADR file written to `docs/adr/020-fishing-game.md`
- [x] All five open questions resolved

**Ready to invoke `/frontend-design` (with the §8 brief) and `/feature-dev:feature-dev` (with the §9 brief).**
