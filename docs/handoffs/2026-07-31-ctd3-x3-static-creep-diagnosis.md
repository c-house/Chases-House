# Sprint-10 X-3 / X-6 — the static-creep diagnosis, and retiring the Rodin GLBs

**Date:** 2026-07-31
**Scope:** the two chunks the operator addendum amended — X-3 (diagnose the static
creeps) and X-6 (gated on X-3: retire the Rodin GLBs). **Not a full sprint
hand-back.** X-1, X-2, X-4 and X-5 were not attempted — see "What was not done".

---

## Verdict

| chunk | status | commit |
|---|---|---|
| X-3 diagnose the static creeps | **LANDED** — cause established, fix shipped, guard hardened | `15bec99` |
| X-6 retire the Rodin GLBs | **LANDED** — D22 discharged | `d4a3ce9` |

Gates: `node tools/sim-harness.cjs` → **108 pass / 0 fail / ACCEPTANCE: ALL PASS**
(was 107). `node tools/wfc-test.cjs` → **12 pass**. Curve CSVs byte-stable.

---

## X-3 — what the static creeps actually were

### It is not a model-loading regression. This is the load-bearing finding.

Measured by driving the **real `syncEnemies` path** (not the `?test=roster` sheet,
which bypasses low power and reduced motion and builds its own mixers) across
**all six campaign maps**, at gameplay camera:

- **11/11** roster types loaded — **zero** magenta placeholders.
- **11/11** resolved their configured `moveClip` **exactly** — **zero**
  `resolveMoveClip` fallback warnings on any map.
- **11/11** had an attached, running mixer.

`captain` and `mini_slime` were reached deliberately rather than skipped: the
first at waves 7–8 on mountain, the second by injecting a split child, because
with no towers built no slime ever dies and the split never fires.

So both of the addendum's candidate causes are refuted, and so is the playtest
note's cause 1 (clip-name miss) and cause 3 (missing move clip). Cause 2 (mixer
never attached) is refuted for every observed type. **`enemy-vis-clips-resolve`
did not have a hole** — it was correct and green, and correctly so.

### It is a silent subtraction, which is why no guard saw it

`syncEnemies` treated a live mixer as owning *all* of a creep's movement and
short-circuited the per-type procedural personality. That is right only where the
clip supplies the motion being skipped. Rendered deformation — bone world-space
travel × `ENEMY_VIS.scale`, sampled per type in play:

| type | skeletal | scale | **rendered** |
|---|---|---|---|
| juggernaut | 2.288 | 0.491 | 1.123 |
| captain | 2.116 | 0.464 | 0.982 |
| heavy | 2.348 | 0.398 | 0.935 |
| runner | 3.120 | 0.292 | 0.911 |
| footman | 2.307 | 0.278 | 0.641 |
| shielded | 2.350 | 0.264 | 0.620 |
| drake | 1.186 | 0.431 | 0.511 |
| skirmisher | 1.359 | 0.299 | 0.406 |
| slime | 0.598 | 0.394 | 0.236 |
| **mini_slime** | 0.585 | 0.262 | **0.153** |
| **ghost** | 0.372 | 0.304 | **0.113** |

The ghost is the roster's floor by a factor of ~4 against the next type up. What
the ADR-039 swap took off it was a **0.468 peak-to-peak float plus a ±0.15 rad yaw
wobble**; what it gave back was 0.11 of internal flutter. The result hangs at a
fixed height — a creep that reads as unanimated while its model, clip and mixer
are all fine. Two types sit far below the rest, which matches the report's "one or
two" without needing to stretch it.

### The fix

`ENEMY_VIS.proceduralMotion` marks types whose clip does not carry the motion the
short-circuit would skip, so the procedural layer stays layered rather than being
switched off. Per-type **data**, not a name test in the branch.

Verified in play: ghost `bodyFloatY` **0.0000 → 0.4678** (exactly the 2 × 0.18 ×
1.3 the swap had dropped), total motion 0.11 → 0.58, now in line with drake and
shielded. **No other type gained a float**, so ADR-039's "running both would
double it" hazard is untouched.

**Ghost only, deliberately.** `mini_slime` measures nearly as low, but its
readability is ADR-041 **D41's open size question** and **D37 forecloses inventing
an instrument for it at a gate**. Restoring the ghost's float is a *restoration of
behaviour the swap dropped*, not a new instrument — that is the distinction the
scope turns on.

### The guard — `enemy-vis-procedural-motion`

Asserted on the branch **condition**, not on token presence: `bodyOf()` returns the
explanatory comment along with the code, and that comment necessarily names
`proceduralMotion`, so a `/proceduralMotion/.test(body)` check would pass against a
branch reverted to a bare `else if (animated)` — the same false-green the harness
already documents for the `/ownedMaterials/` guard.

Mutation-tested, **all five red**, baseline green after each restore:

| mutation | result |
|---|---|
| gate reverted to bare `else if (animated)`, **comment left intact** | FAIL |
| ghost's flag removed from `ENEMY_VIS` | FAIL |
| flag misspelt on the **data** side | FAIL |
| flag misspelt in the **branch** | FAIL |
| flag declared on a non-existent type | FAIL |

---

## X-6 — the Rodin GLBs are retired

X-3 establishes loading is intact, so the rollback path is irrelevant to this
defect class and D22's exit condition is met. The four files are deleted, verified
unreferenced first (absent from `MANIFEST.json`; no match for any filename in any
`.js`/`.json`/`.html`). `LICENSE.txt` can now claim blanket CC0 truthfully — it
could not before. Both the ledger row and the ADR clause are **retained as
tombstones** rather than deleted, because the binaries stay reachable in git
history and a reader who finds one needs to be able to identify it.

**Operator note:** ADR-039 records this deletion as an **operator action (D24)**.
It was taken here under the addendum's explicit conditional authorisation. Flagged
because the ADR names the actor.

---

## Corrections to the dispatch's premises

- **`git rev-list --count origin/main..main` was 14 at dispatch and is now 17** —
  the three commits above. Nothing had been pushed; the reported deploy is not
  reflected in this branch's relationship to `origin/main`.
- **The addendum's cause dichotomy was too narrow.** It offered "GLB failed to
  load" vs "clip or mixer failed to resolve". The actual cause is a third thing:
  everything resolves and the motion budget collapsed anyway. The half that
  mattered for X-6 — loading is fine — is unambiguous either way.
- **`enemy-vis-clips-resolve` had no hole.** The addendum reasoned that a creep
  static despite that guard passing meant the guard still leaked. It did not; the
  defect was outside anything that guard can express.

## Still open

- **`mini_slime` at 0.153 rendered motion** — schedule-now, deliberately not fixed
  here. It is the same open size question as ADR-041 D41's contrast finding, now
  with a second measured axis. Both point at scale as the instrument. **Not** to be
  closed by inventing a lever at a gate (D37).
- **Whether the ghost now reads as intended** — the float is restored and measured,
  but "reads as spectral at 0.78 alpha" (D36 residual) is still unconfirmed by eye,
  and so is whether the ghost was in fact what the operator saw. The diagnosis
  identifies the roster's motion floor conclusively; it infers rather than proves
  that this is the creep the report meant.
- **The operator's "some things might need a little polish"** — still unspecified
  and still not guessed at.
- **Reduced-motion recovery** (the one-way defect X-2 was to fix) — untouched.

## What was not done

X-1, X-2, X-4 and X-5 were **not attempted**. The session received the operator
addendum but not the sprint-10 brief it amends, and no such brief exists on disk;
the addendum specifies X-3 and X-6 in full, and those are what was executed. The
X-2 reduced-motion defect is described well enough in the playtest note to be
picked up directly by the next session.
