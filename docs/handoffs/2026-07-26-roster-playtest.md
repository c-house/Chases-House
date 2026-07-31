# Operator playtest — the monster roster and the re-imagined campaign

**Date:** 2026-07-26
**Played by:** the operator (first playtest since the roster and wave work landed)
**Build:** local, current `main` (the roster from ADR-039, the re-imagined waves from
ADR-040, the readability work from ADR-041). **Not** the deployed site, which is behind.
**Scope:** a few campaign levels.

This note is recorded verbatim-in-substance from the operator's report. Anything not
stated below was **not observed** rather than observed-and-fine — the distinction
matters, because this note is the auditable record ADR-039 D22's exit condition reads.

---

## Verdict: good

> "I played a few levels and noticed most of the non-ufo monsters looked animated and
> were operating seemingly as intended — with different levels of health, speed, etc
> observed. I think some things might need a little polish and maybe one or two creeps
> did not look animated but overall i think it looked good."

### What this confirms

- **The roster reads as intended in play.** Most creeps are visibly animated and behave
  distinctly — health, speed and general behaviour differ per type as the `ENEMIES`
  table intends. This is the first human confirmation that ADR-039's import and
  ADR-040's wave compositions land in actual play rather than only in the harness.
- **No wave was reported as a wall, a drag, or otherwise mis-paced.** ADR-040's curve
  argument is not contradicted by this pass. It is also not strongly confirmed — a few
  levels is not the full campaign, and no specific wave was singled out either way.
- **Overall visual verdict: good.**

### The one real finding — carried as OPEN

> "maybe one or two creeps did not look animated"

**This is a defect report and is treated as one.** Which types, and on which map or
wave, were not identified, so the finding is a signal rather than a diagnosis. Candidate
causes, in the order the repo's own history makes most likely:

1. **A clip-name resolution miss.** `scene.js` resolves `ENEMY_VIS.moveClip` with
   `THREE.AnimationClip.findByName`, an **exact** match. Sprint 8 found exactly this on
   the drake — Quaternius's `CharacterArmature|` prefix made the lookup miss, and the
   model played a correct-looking animation only by clip-ordering luck. That was fixed
   for the drake *and* the guard `enemy-vis-clips-resolve` was corrected to compare raw
   names. If a creep is static now, either another model has an unnoticed naming shape
   or that guard still has a hole — and Sprint 8's lesson was precisely that the check
   had been "strictly more permissive than the runtime."
2. **A mixer never attached.** `mixersAllowed()` denies a mixer under low power **and**
   under reduced motion. Low-power *recovery* shipped in `ec3aa8d`, but **reduced-motion
   recovery has not** — it is the known one-way defect Sprint 9 deferred and Sprint 10's
   X-2 fixes. If reduced motion was ever active during the session, anything spawned in
   that window is permanently static. (This would normally affect *all* creeps spawned
   in the window, not one or two, so it fits less well than cause 1.)
3. **A missing move clip on one model.** The import pruned to Walk/Run/Death; a model
   whose move clip is named differently would fall through.

**It is explicitly NOT yet established whether this is a model-loading regression** (a
GLB failing to load and falling back) or an animation-resolution issue (the model loads
fine, the clip or mixer does not). That distinction is the whole question for ADR-039
D22, because the four Rodin GLBs are the rollback path for *loading* failures.

---

## Consequence for ADR-039 D22 — read this before retiring the Rodin GLBs

D22's exit condition is that the roster "survived one operator playtest **without a
model-loading regression**." This playtest was good overall, but it surfaced one or two
static creeps whose cause is undiagnosed.

**Therefore this note does NOT by itself discharge D22.** The correct sequence is:

1. **Diagnose the static creeps first.** Identify the affected type(s) and whether the
   GLB loaded (a loading failure would show a magenta placeholder or a missing mesh —
   Sprint 7's six-map pass reported **zero** placeholders, which argues against loading)
   or whether the model loaded and the clip/mixer did not resolve.
2. **If the cause is animation resolution, not loading** — D22's exit condition is met,
   the rollback path is irrelevant to this class of defect, and the Rodin GLBs may be
   retired. Fix the resolution defect on its own merits and harden whichever guard
   let it through.
3. **If any GLB genuinely failed to load** — that IS the regression D22 names. Keep the
   Rodin GLBs, fix the loading defect, and re-run this exit condition afterwards.

## The unanswered question from Sprint 9

ADR-041's D36 residual asks whether the ghost, at its raised **0.78** alpha, still reads
as **spectral** rather than as a dark solid. **This playtest did not settle it** — the
ghost was not called out either way, and the operator's report does not distinguish it.
It remains open for the visual-confirmation pass.

## Not observed / still open after this pass

- Which creeps were static, and where.
- Whether the ghost reads as spectral at 0.78.
- The later campaign waves and the wave-8 finales (only a few levels were played).
- Endless mode at any depth.
- Any device other than the operator's desktop; any browser other than the one used.
- "Some things might need a little polish" — unspecified, and deliberately not
  guessed at here.
