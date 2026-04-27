# ADR-018: Yahtzee polish pass

**Status**: Shipped (polish pass landed; post-launch refinements appended 2026-04-26)
**Date**: 2026-04-25

## Summary

A targeted polish pass on the shipped Yahtzee game ([ADR-017](017-yahtzee.md)) addressing aesthetic and density gaps surfaced by a `/frontend-design` critical evaluation. Scope is **cosmetic + small-motion + density + a11y** — no rule changes, no new modes, no new shared modules, no new fonts, no audio samples. The shipped game's visual direction (felt-and-bakelite midcentury) stands; this ADR plugs the two specific places it leaks (pause + help overlays read as generic dark-mode modals) and tightens a handful of under-furnished moments (blank dice slots, fanfare density, title button hierarchy, mobile scorecard height, hi-scores empty state, cup idle).

## Context

[ADR-017](017-yahtzee.md) shipped a 5-file Yahtzee at `games/yahtzee/` with full canonical rules (25/25 rule tests pass), solo + hot-seat modes, gamepad support via [`SharedGamepad`](016-shared-gamepad.md), localStorage persistence, a Yahtzee fanfare moment, and Konami easter egg. End-to-end verification through Chrome DevTools MCP captured 14 reference screenshots at `docs/screenshots/yahtzee-01-title.png` … `yahtzee-14-pause-overlay.png` and confirmed zero console errors.

A subsequent `/frontend-design` evaluation accepted the visual direction as distinctive (typography, palette, shadow layering, sidebar scorecard layout) but flagged two specific aesthetic leaks that read as generic-AI: the **pause + help overlays** (dark gradient cards on dark blur) and the **pre-roll blank dice slots** (placeholder-rectangle cliché). It also flagged six under-furnished moments worth tightening for the same shipping window. A polish pass is justified now — not feature creep — because (1) the gaps are concentrated in moments the player sees on first load (title, pre-roll dice, pause), (2) the fixes are short and isolated to inline CSS + ~30 lines of JS in `showFanfare()`, and (3) doing them now means the game ships in its intended voice. Deferring would leave the most "AI-generic" surfaces as the player's first impression.

## Decisions

Decisions are clustered by axis. Each cluster carries its own DRY/YAGNI/SOLID/KISS block. File targets are named so a follow-up `/feature-dev` can plan implementation directly.

### Cluster 1 — Visual cohesion (overlays, blank slots, title hierarchy, hi-scores, felt anchor)

The single largest leverage point. The game has two surfaces (scorecard, paper buttons) doing the paper-cream personality and several surfaces (pause card, help card, blank dice, hi-scores list) reading "any modern dark UI." Bring those surfaces into the same tactile vocabulary.

- **Re-skin pause + help overlay cards as paper-cream surfaces.** Replace the current `linear-gradient(180deg, var(--bg-elevated), var(--bg-surface))` + ivory-tinted 1px border with the scorecard's gradient (`var(--paper-warm) → var(--paper)`), the scorecard's noise overlay (data-URL fractalNoise at multiply blend), an ink-on-paper border (`1px solid var(--paper-line)`), and ink-tone text (`var(--ink)`). Affected: `games/yahtzee/index.html` rules `.overlay-card`, `.overlay-card h2`, `.overlay-section-h`, `.overlay-row`, `.help-card h3`, `.help-card p/li`, `.help-card kbd`. Card body backdrop (`.overlay::before`) stays a dark blur — the paper card needs to *sit on* something dark to read like a card on a felt table. **DRY:** the scorecard already inlines the same noise pattern at line 649; lift that exact data-URL string into a shared CSS rule (`.paper-surface::before`) and apply both `.scorecard::before` and `.overlay-card::before` to it.
- **Toggle + kbd chip readability after the re-skin.** The current `.toggle` (dark base / ember-when-on) and `.help-card kbd` (dark bg, ember text) are tuned for a dark surface. After paper re-skin, recolor them with ink-on-paper variants: toggle base = `var(--paper-line)` / on = `var(--accent-ember)`, kbd bg = `var(--bakelite-warm)` with `var(--ink)` text and `var(--paper-line)` border. Reduces contrast risk on the new surface.
- **Chalked dice outline for blank slots.** The current `.die-slot.blank .die` is a featureless translucent rectangle. Replace its inset shadow with a `::before` pseudo-element drawing a dashed bakelite-tone outline at the die's border-radius, opacity ~0.35. Cue is "ready to roll," not "loading skeleton." Reduced-motion / standard CSS only — no JS change. Affected: `index.html` rule `.die-slot.blank .die` (line 215) and `.die-slot.blank .die::after` (line 221, currently disabled).
- **Distinguish "Continue" from "High Scores" on title.** Title currently has three CTAs in two visual tiers: New Game (`.btn-primary`, ember), Continue (plain `.btn`, outlined), High Scores (`.btn-quiet`, faintest). Continue is the *meaningful state* (a saved run exists), so it should be the eye-magnet when shown. Add a `.btn-paper-chip` modifier styled as the paper-cream button family (`var(--paper-warm)` background, `var(--ink)` text, soft shadow, optional small bookmark glyph) and apply it to `#continue-btn`. New Game stays `.btn-primary`; High Scores stays `.btn-quiet`. Result: three distinct tones with the paper chip privileged when present. **DRY:** `.btn-paper.solid` already exists at line 457 for setup/save buttons — extend that rule with a `.btn-paper.chip` variant rather than creating a parallel class.
- **Hi-scores screen empty / few-entry layout.** With 0 entries the screen is a heading + a single back button on bare felt. Add a paper-printed scorecard *placeholder* card (matching the play-screen scorecard treatment): ten ledger rows ("—  —  —" or "Your run goes here"), with the actual entries rendered into the same rows when present. Ledger styling reuses scorecard `.sc-row` dotted dividers. Affected: `game.js renderHiScores()` (markup) + `index.html` `.hi-list` styling.
- **Felt watermark anchor.** The play-stage felt is a uniform radial gradient. Add a single subtle watermark — choice between (a) a low-opacity (~0.08) Fraunces "Y" or "YAHTZEE" glyph in the top-left corner of the felt, or (b) a faint cup glyph echoing the title cup. Static, not animated. Applies to `.play-stage` only (not setup, not hi-scores) — the play screen is where the eye lingers. **Open question** below on which symbol.

```
DRY:   noise overlay pattern is duplicated between scorecard and re-skinned
       overlays — extract to a shared `.paper-surface::before` rule.
       `.btn-paper.solid` already exists; add `.chip` variant rather than
       a new family.
YAGNI: skip per-screen felt themes (only play-stage gets the anchor); skip
       crown SVG re-engraving for v1 (parked; see Out of scope).
SOLID: paper surface = one rule, applied compositionally. Toggle/kbd
       restyles are scoped to the overlay context (single responsibility).
KISS:  no new fonts, no canvas, no SVG filter chains. CSS variables +
       data-URL noise + a `::before` outline. ~80 lines of CSS total.

Decision: proceed.
```

### Cluster 2 — Motion language (fanfare density, cup breath, reduced-motion gates)

The fanfare is the signature moment — its density should match the size of the achievement. The title cup idle has dead air between rocks that a minor breath fills. Both are short, both respect `prefers-reduced-motion`.

- **Fanfare particle spawn.** The fanfare overlay currently has burst + rays + mark + sub but **zero particles** today (the markup at lines 1421-1426 has no `.spark` elements; the evaluation note that "6 fixed sparks" exist was off — there are none). Add a JS-driven spawn in `game.js showFanfare()`: create ~28–32 `<div class="spark">` children of the `.fanfare` container with randomized `--spark-x`, `--spark-y`, `--spark-size`, `--spark-delay` CSS custom properties, each running a single CSS keyframe (radial-burst-out + fade) tied to those vars. Sparks are removed on fanfare hide. **JS-driven over baked-in markup**: lets density and randomness vary per fire (cheap visual variety), keeps `index.html` lean, and avoids a fixed pattern that becomes visible after 2-3 plays.
- **Title cup breath.** Add a second keyframe (`@keyframes breath`) running ~3s ease-in-out alternate, scale 1.0 ↔ 1.005, layered on top of the existing `rock` keyframe via `animation: rock 6s …, breath 3s …;`. Both gated by `prefers-reduced-motion` and `body.reduced-motion .cup`.
- **Reduced-motion gating coverage.** Audit added animations — sparks, breath — and ensure each is silenced by both `@media (prefers-reduced-motion: reduce)` and the explicit `body.reduced-motion .X` selector pattern already used at lines 262, 320, 992-995. Sparks gate by simply not spawning when reduced-motion is on (cheaper than CSS gate).

```
DRY:   reduced-motion uses the existing two-channel pattern (media query +
       body class) — no new mechanism.
YAGNI: skip a confetti library, skip per-category fanfare variants, skip
       upper-bonus +35 visual ribbon (audio exists; visual is parked).
SOLID: showFanfare() owns spark lifecycle; CSS owns shape; no cross-talk.
KISS:  vanilla DOM creation + CSS vars; no rAF, no particle engine.

Decision: proceed.
```

### Cluster 3 — Information density (mobile scorecard, type weight)

A small, high-leverage tightening for the most-bandwidth-constrained surface.

- **Mobile scorecard height.** Drop `max-height: 45vh` to `38vh` at the `(max-width: 720px)` breakpoint (line 1169). Tighten `.sc-row` padding from `0.4rem 0.4rem` to `0.3rem 0.4rem` *and* font-size from `0.88rem` to `0.84rem` at the same breakpoint. Net result: the dice area gets ~10vh back without sacrificing the 13-row scorecard. Verify all rows still fit with iPhone SE 1 viewport (375×667).
- **Hi-scores ledger row metric.** Match the new scorecard row metric for visual continuity within the paper family.

```
DRY:   the row metric becomes one rule scoped under the breakpoint —
       reused by scorecard + hi-scores ledger.
YAGNI: no per-row category icons resize; no rotating column hierarchy.
SOLID: density = one set of CSS overrides at the breakpoint.
KISS:  three rule changes, no new media queries.

Decision: proceed.
```

### Cluster 4 — Accessibility (ARIA-live, keyboard order)

Small additions; cheap to do alongside the visual work.

- **ARIA-live region for score commits.** Add a visually-hidden `<div role="status" aria-live="polite">` near the scorecard. On commit, write a compact phrase: `"3 of a Kind: 24 points scored"`, `"Yahtzee: 50 points scored — bonus active"`, `"Sixes: 0 (forced zero)"`. Read by screen readers; invisible to sighted users; cheap. Affected: `index.html` (1 element) + `game.js commitCategory()` (1 line per branch).
- **Keyboard tab order audit.** Verify the play-screen tab order: util-bar → roll button → dice 1-5 → scorecard rows → confirm. No code change unless a regression is found; this is a verification item for the implementation phase.
- **Paper contrast spot-check.** `--ink` `#4a3520` on `--paper-warm` `#f6ecd3` ≈ 8.5:1 (passes AA Large + AA normal). `var(--accent-ember)` `#a06828` on the same paper ≈ 4.6:1 (passes AA normal at body size, marginal at smaller). Confirm during implementation; if a row uses ember at <14px and reads marginal, fall back to `--ink` for readability and reserve ember for category headers.

```
DRY:   one ARIA-live region, called from commitCategory.
YAGNI: no full screen-reader narrative for every dice toggle (noisy);
       no skip links (single-screen game).
SOLID: announce-on-commit is a single hook in commitCategory.
KISS:  zero new dependencies.

Decision: proceed.
```

### Cluster 5 — Audio sweetening (synth-only constraint)

The audio module is pure Web Audio synth (no CC0 samples — that path was discussed in ADR-017 but never realized and is **not** being added now). The fanfare is the only moment where a richer timbre might land; everything else sounds correct already. This cluster is mostly a *preserve* decision.

- **Skip audio changes in v1.** The evaluation flagged audio sweetening as a candidate but did not name a leak. The current synth — particularly the `yahtzee` arpeggio + sustained chord + sparkle layer — is on-character. Adding a sawtooth-lowpass "horn body" under the existing arpeggio is a v2 candidate if the moment ever feels thin in playtests; not enough signal to do it now.
- **Mute-state coverage.** Verify the new sparks do not generate any audio (they don't — pure visual). No change.

```
DRY:   no change.
YAGNI: skip CC0 samples (not in scope), skip horn-body layering (v2).
SOLID: no change.
KISS:  the synth-only constraint is the simplicity. Preserve it.

Decision: hold.
```

### Cluster 6 — Wide-net candidates (parked or rejected)

To meet the planning brief's "8+ candidates beyond the evaluation list" requirement, these were considered and either deferred or rejected with one-line rationale.

- **Crown SVG art-deco upgrade** (parked → v2). Game-over winner crown is a 7-point polygon. An engraved/midcentury variant would echo the period, but the crown is on screen for ~5 seconds at the end of a 15-minute game. Low leverage relative to the cluster-1 pause/help fix. Defer to a small v2 ADR or fold into a subsequent polish pass.
- **Upper-bonus +35 visual ribbon** (parked → v2). Audio plays an `upperBonus` cue when the upper subtotal first crosses 63; no visual flourish today. Worth doing eventually (the moment is satisfying and underexposed) but not load-bearing.
- **Forced-zero "thunk" visual** (rejected for v1). Audio cue exists (`zeroOut`); a matching die-settle exaggeration is cute but adds animation logic to a state that is already a bummer for the player. Don't double down on the negative moment.
- **Per-row score-committed "ink stroke" SVG** (rejected — gold-plating). The `.sc-row.scored::before` checkmark already communicates committed state; a hand-drawn ink stroke under the value is the kind of detail that takes 2 hours and almost no one notices.
- **Lifetime stats view** (out of scope; future ADR). Total games played, total Yahtzees rolled, average score, best run. Real feature, not polish; warrants its own ADR.
- **Round indicator on turn-bar** ("Round 7 of 13") (parked → v2). Small narrative anchor; would tighten the play-screen turn-bar without adding complexity. Skip for v1; the existing roll-meter `Roll N / 3` already handles within-turn pacing.
- **Score-row hover audio verification** (verification only). `audio.js` defines a `hover` SFX (line 134); confirm during implementation that scorecard row hover wires to it. If not, a one-line fix.
- **Felt table-edge band** (rejected in favor of watermark). The evaluation suggested either a table-edge or a watermark; both is too much. Watermark is less likely to fight with the dice-row at edge cases (small viewports).
- **Photo-mode / shareable result card / replay system / cosmetic dice skins** (already parked in [ADR-017's Out of scope](017-yahtzee.md#out-of-scope--follow-ups)). No change.
- **Custom cursor** (rejected — overengineering for a turn-based dice game).
- **Per-player tabbed scorecards in hot-seat** (rejected — current "active player only + chip strip" is cleaner than tabs; explicitly named in evaluation as something not to fix).
- **Loop background music** (rejected — explicitly off-by-default per ADR-017 §Resolved questions; reintroduces scope).

## v1 scope (ship list)

The cuts that ship in this polish pass, ranked by leverage:

1. **Pause + help overlay paper-cream re-skin** with shared `.paper-surface::before` noise rule, ink-tone toggle, ink-tone `<kbd>` chips. *Cluster 1.*
2. **Fanfare particle spawn (~30) in JS** via `showFanfare()`, with reduced-motion gating. *Cluster 2.*
3. **Chalked dice outline** on blank slots via `::before`. *Cluster 1.*
4. **`.btn-paper.chip` Continue button** on title CTA group. *Cluster 1.*
5. **Hi-scores ledger layout** with paper-printed placeholder rows (empty + few-entry case). *Cluster 1.*
6. **Felt watermark anchor** on `.play-stage` (single subtle glyph; choice in Open questions). *Cluster 1.*
7. **Mobile scorecard 38vh + tighter row metric**. *Cluster 3.*
8. **Title cup breath** layered on the existing rock keyframe. *Cluster 2.*
9. **ARIA-live commit announcer** on the play screen. *Cluster 4.*

## Out of scope / follow-ups

Each parked for a small future ADR or folded into a later polish pass.

- Crown SVG art-deco upgrade (Cluster 6).
- Upper-bonus +35 visual ribbon (Cluster 6).
- Round indicator on turn-bar (Cluster 6).
- Audio sweetening / horn-body fanfare layer (Cluster 5).
- Lifetime stats view (Cluster 6 → its own ADR).
- All ADR-017 §Out-of-scope items remain parked: AI opponent, online multiplayer, daily challenge, replay system, optimal-play hints, photo-mode, House Cup leaderboard, hot-seat resume, dice skins, rule variants.
- **Explicitly will not be added** in any pass: CC0 audio sample swap (synth-only constraint stands); new fonts (Fraunces + Bricolage only); shared high-score utility (still one consumer; per [ADR-016](016-shared-gamepad.md), extract on the *second* consumer, not the first).

## Resolved questions (2026-04-25)

1. **Pause + help re-skin extent**: **full paper treatment.** Paper-cream gradient + scorecard noise + ink-tone text + dotted dividers + ink-on-paper toggle + ink-on-paper `<kbd>` chips.
2. **Chalked dice outline style**: **dashed.** ~2px dashed bakelite outline at the die border-radius, opacity ~0.35.
3. **Felt watermark glyph**: **cup glyph**, ~6% opacity, top-left of `.play-stage`. Echoes the title cup; quieter than a letterform.
4. **Crown SVG art-deco**: **v2.** Stays in Out of scope for this ADR.
5. **Particle spawn implementation**: **JS-driven, randomized 24–36 sparks per fire.**
6. **ARIA-live verbosity**: **every commit**, polite tone.

## Handoff

When this ADR is reviewed and questions resolved:

1. Invoke `/feature-dev:feature-dev` with the **Decisions** section as the brief — clusters 1–4 are independent enough to land as separate sub-tasks if desired, but small enough to ship in a single feature-dev pass.
2. Build per CLAUDE.md protocol (DRY · YAGNI · SOLID · KISS).
3. Verify with Chrome DevTools MCP, refreshing the relevant `docs/screenshots/yahtzee-*.png` artifacts (especially `yahtzee-09-help-overlay.png` and `yahtzee-14-pause-overlay.png` to capture the re-skin, and a new `yahtzee-15-fanfare-dense.png` for the particle bump).
4. Zero console errors gate before marking complete.

Do **not** write game code before the open questions are resolved.

## Post-launch refinements (2026-04-26)

Four fixes landed after first-play feedback. All scoped to existing files, no new modules.

- **Scorecard tip highlight + score preview.** The scorecard distinguished only `scored / open / preview / disabled`; an "open" row that *would* score N points read identical to one that would score 0. Added a `'tip'` row status (`game.js rowStatus()`): legal AND `previewScore > 0` → row gets `.sc-row.tip`, a small gold dot indicator, and the would-be score in muted gold. Player can now scan the panel and see exactly which boxes pay out for the current dice. CSS in `index.html` rules `.sc-row.tip` / `.sc-row.tip .score` / `.sc-row.tip::after`. *DRY:* reuses `S.previewScore` already imported by the renderer.
- **Hover handler dedup.** `mouseover` bubbles for every row child (`.glyph` / `.label` / `.score`), and each fire called `renderScorecard()` which replaces `#scorecard.innerHTML`. The cursor then sat over a *new* node → another `mouseover` → another render → another hover SFX. Two visible symptoms: a buzzing pile-up of hover sounds, and the row DOM being destroyed between mousedown and mouseup so clicks could be lost. Added a single guard at the top of the handler: `if (scorecardCursor === cat) return;`. Verified: 21 nested mouseover events on one row now produce 1 hover SFX (was 21+); 7 distinct row entries produce 7 hover SFX.
- **Hover SFX redesign — Stardew-style cozy chime.** Replaced the original `tone(1200, 0.04, square)` buzzer with a soft two-note "tink" — E5 + B5 (perfect fifth), sine + triangle, gain 0.075 / 0.030, ~85ms. Combined with the dedup guard, sweeping the scorecard now feels like a wind chime instead of a phone keypad. `audio.js` `hover` recipe only.
- **Yahtzee scorecard refresh on commit.** When scoring a Yahtzee, the regular and zero branches called `nextTurn()` (which renders) immediately, but the Yahtzee branch only called it inside the 2.8s fanfare timeout. Result: scorecard total stayed stale for the full fanfare duration before jumping to the new value. Fix: call `renderScorecard()` immediately after the commit in the Yahtzee branch ([game.js:319-321](../../games/yahtzee/game.js#L319-L321)) so the +50 lands behind the fanfare. Verified end-to-end across two full 13-turn games — scorecard total updates within 200 ms of every commit, including Yahtzee.

```
DRY:   tip status reuses existing previewScore; refresh fix reuses existing
       renderScorecard.
YAGNI: no new "scored 0 vs scored points" row state — tip subsumes it; no
       new audio sample swap (synth-only constraint stands).
SOLID: single guard in hover handler; status function unchanged in shape.
KISS:  ~25 lines of code + ~15 lines of CSS across the four fixes.
```
