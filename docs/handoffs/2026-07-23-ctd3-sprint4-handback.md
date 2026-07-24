# CTD3 Sprint 4 hand-back — cycle 2's build sprint (ADR-037)

**Date:** 2026-07-23
**Dispatched at:** `3e2d0c1` · **Ends at:** `df90279` · **7 commits** (6 chunks + this hand-back)
**Sprint goal (ADR-037 §7):** give CTD's economy a run long enough to matter — an endless mode on any map, machine-verified before a human plays it — and clear the last four named debts.

**Headline: the endless chain shipped.** Endless mode exists end to end — engine, economy and UI — and is machine-verified by 12 new harness checks. Six of seven chunks landed, including the stretch. The one that did not is C-3, blocked on the operator playtest gate exactly as ADR-037 D11 designed.

**The most important thing in this document is not a chunk.** C-4 set out to re-judge a colour and found that **the Warden aura had not been rendering on any map at all** — a decal at `y = 0.05` buried inside 0.2-tall terrain since the ADR-030/031 tile renderer landed. Its hover preview was buried too. Both are fixed. The same class of bug is still live for the selected-tower range circle (see Deferred).

---

## Progress

### Gates

| Gate | State | Evidence |
|---|---|---|
| **G-0** — deploy the cycle-1 backlog | **MET** | `git rev-list --count origin/main..main` = **0** at session start. Informational: `curl -sI https://chases.house/games/castle-tower-defense/` → `HTTP/1.1 200`, `last-modified: Thu, 23 Jul 2026 22:27:13 GMT` — a cycle-1 artifact is live. |
| **G-1** — retune feel playtest | **UNMET** | No `docs/handoffs/` file whose name contains "g1" or "playtest", and no operator addendum. Blocks C-3 only. |

### Per chunk

| Chunk | State | Hash |
|---|---|---|
| **C-1** endless engine + economy, headless (L) | **LANDED** | `562b264` |
| **C-2** endless UI — entry, HUD, buy-a-life, results (M) | **LANDED** | `37a1138` |
| **C-5** audio honesty (S) | **LANDED** | `40824fd` |
| **C-4** Warden aura legibility re-check (S) | **LANDED** | `ecf7ece` |
| **C-6** editor — attrition table + topbar Save (M) | **LANDED** | `03c0fa7` |
| **C-3** endless balance calibration (M) | **BLOCKED** | G-1 unmet (ADR-037 D11). Not attempted. Depends only on the playtest; C-1 landed, so its other dependency is satisfied. |
| **C-7** fairness oracle (L, stretch) | **LANDED** | `df90279` |

No chunk reached FAILED-OUT. No chunk was NOT-ATTEMPTED — C-7's stretch precondition ("every eligible chunk above LANDED") was met, since BLOCKED does not count toward the sprint stop.

### Acceptance results

**Harness — 58 → 70 checks**, `ACCEPTANCE: ALL PASS`, exit 0, at every chunk boundary. Twelve new endless checks:

`endless-determinism` · `endless-run-determinism` · `endless-spawn-bound` · `endless-difficulty-override-merge` · `endless-buy-a-life` · `endless-score-ordering` · `endless-unbounded` · `endless-terminates` · `endless-build-separation` · `endless-selection-effect` · `endless-early-call-tension` · `endless-interest-bound`

Final endless numbers on plains/quiet, seed 7: naive builds die at waves 18 / 18 / 26 (spread 8, ≥3 required); spirited runs 6 waves shallower than quiet; interest is 16.7 % of total income against a 35 % ceiling.

**`node tools/wfc-test.cjs`** — 12 pass, unchanged, run at every boundary that touched editor or rules code.

**`node tools/map-rules-test.cjs`** (new) — **44 pass / 0 fail**, exit 0.

**Campaign-CSV stability (content-level rule): HOLDS at every chunk boundary.** `git diff -- tools/curves/` showed **no content change** for the six campaign CSVs after every harness run of the sprint. `git status --porcelain -- tools/curves/` listed only the new `endless-plains-quiet.csv` plus the **pre-existing phantom flag on `forest.csv`** — the mixed-EOL artifact the bootstrap describes. It was present at dispatch, was never staged, committed, checked out or renormalised, and is still present now. D12 was not breached: no `maps.js` wave data, `ENEMIES`, `TOWERS`, star threshold or `unlockRequirement` was touched.

**In-browser verdicts**

- **C-1** — endless module loads; endless wave 1 keeps its full 20 s build window (the `prepCountdownMs` zero-sentinel trap avoided); auto-send fires at expiry; interest accrues; zero console errors.
- **C-2** — endless startable from an official map and a My Maps entry through the real buttons; wave counter passes 8 with no victory screen (verified to wave 20); interest ticks and pays; buy-a-life debits gold and adds a life with the escalating curve visible (100 → 150 → 225); results show waves survived and a persisted best. **`localStorage['ctd3:scores']` byte-identical before and after a full endless run** (captured as raw strings and compared). Zero new console errors. Reads cleanly at 390 px with no overflow and exactly one gold-filled control.
- **C-4 — six-map aura verdict.** All six official maps judged with the aura actually rendering; **`0x8fc6cf` ratified.** plains (1.0, 1.4) clear · forest (0.7, 1.0) clear · mountain (0.7, 1.0) clear · snowfall_pass (0.7, 1.0) weakest but legible · tidewater (0.7) clear · riverbend (0.7) clear. Every *palette* was judged at both a normal and a zoomed-out camera; two individual maps were not (plains lacks 0.7; tidewater/riverbend lack 1.0 — both reuse forest's palette, judged at both). **The dated verdict landed in `docs/adr/034-ctd3-ui-ux-remediation-v2.md`, appended to Deliberate Decision A.** `localStorage['ctd3:scores']` was seeded to reach the star-locked maps and restored to its exact 278-byte pre-check value.
- **C-5** — 13 audio requests (exactly the 13 files that exist), **zero** requests for the absent loops, **zero console messages of any kind**, all 13 SFX buffers decoded and the dispatch table exercised without throwing, both gated rows hidden with computed `display: none`, the gate proven to *open* when a buffer appears, and `musicVolume`/`ambientVolume` preserved and still applied.
- **C-6** — Simulate renders a table; a deliberately-declining wave list marks waves 5 and 6 in terracotta with "falls from w4"/"falls from w5" and nothing else; the shipped Plains curve marks nothing; all six official maps produce **zero** decline marks (verified against the committed CSVs); topbar Save saves at both widths; **at 785 px with the Status tab showing, a topbar Save auto-switched the rail to Export** — the previously-unreachable MutationObserver is now live; no new gold-filled control kind; no page overflow at 785/876/914/1037/1164; zero console errors.
- **C-7** — the editor surfaces the new warns in author voice with faint rule-code chips on a blocker-clean-but-coverage-poor map (7 warns), and is silent on a purpose-built compliant map; no new blockers; all six official maps still validate to a non-blocked state.

### Adversarial review

One fresh-context subagent per chunk, six rounds. It earned its keep decisively — every round found at least one real defect, and two rounds found bugs that would have shipped:

- **C-2** — the buy-a-life button's author `display: flex` out-cascaded the user-agent `[hidden]` rule, leaving a dead terracotta control **visible and tabbable in every campaign run**.
- **C-4** — I claimed a second Warden-aura site did not exist. It did; I had grepped the identifier, not the value. That site (the hover preview) was buried by the same defect, meaning I had ratified a colour on a surface that never rendered.
- **C-7** — H1 was implemented with only half its rule, blessing slots on the *outside* of every bend; `samplePath` hung forever on an `Infinity` coordinate; and the test suite let 11 of 23 threshold mutations survive.

Reviews also independently *proved* things worth trusting: C-1's campaign arithmetic is bit-identical to `HEAD` (a full 6-map × 2-difficulty × 3-build fingerprint), C-1's new checks are mutation-proved falsifiable, C-2's `ctd3:scores` byte-identity, and C-7's pinned baseline reproduced from a from-scratch reimplementation of the rulebook.

### Discrepancies with the ADR, recorded as required

1. **C-6's marking window (material).** The brief's literal `2 ≤ w ≤ n−1` compares wave 2 against wave 1, which flags **five of the six shipped maps** — their w1→w2 step falls because wave 1 is scaled against a flat starting purse, which ADR-037 §2.2 itself calls a construction artifact. Implemented from wave 3 vs wave 2 with the harness's 0.02 tolerance, making the editor byte-equivalent to what `sim-harness.cjs` gates on. Resolved toward the brief's stated intent ("a validator that flags it would … be wrong") against its literal index range.
2. **C-5's brief is internally in tension.** "No request is made" and "reappears with no further code change" cannot both hold for a static file — existence is undetectable without a request, and any probe reintroduces the 404 the chunk removes. Resolved toward the machine-checkable condition. Re-enabling a bed is now: drop the `.ogg` in, move one line from `ABSENT_LOOPS` to `SAMPLES`.
3. **C-1 touched `index.html`**, which its file list omits — one `<script>` tag to load `endless.js`. Without it the module is unloadable in the browser and the chunk only half-lands.
4. **C-4 changed a constant the brief did not anticipate.** The brief scoped it to the colour constant "or no change"; the defect was the aura's Y position. Fixing it was prerequisite to delivering the chunk at all — a colour that never reaches the screen cannot be judged.

---

## Deferred items — every one classified

### schedule-now

- **The selected-tower range circle is buried and non-functional on every map.** `makeRing`'s `y` default is still `0.05`, and its remaining defaulting caller is the range circle in `syncDecals` — same defect C-4 fixed for the aura, same one-line shape, but a different feature (gold, not the Warden cyan), so it was out of C-4's charter. This is a core affordance that does not render today. **Unblock: none — it is a one-line fix plus a six-map look.**
- **G-1 playtest.** Ten minutes of play (Mountain/spirited, Tidewater/quiet), reporting whether the midgame reads too hot. Blocks C-3, and C-3 is the chunk that sets the numbers a human will actually feel in endless.

### fold-into-next-sprint

- **C-3 endless balance calibration**, in full, the moment G-1 lands. Carry these measurements into it: naive builds die at 18/18/26 (target band 15–35 — currently satisfied, but measured on one map and one seed); build spread 8 waves; interest 16.7 % of income.
- **`INTEREST_CAP = 50` is C-3's to settle.** It is a design addition, not a weakened assertion — the 35 % bound was never touched, and uncapped 2 %/15 s measured **45.7 %** of income on the deepest run, the "bank everything" degeneracy ADR-037's risk table names. C-3's brief names "any per-tick cap" as one of its tunables. The adversarial reviewer argued the brief-literal alternative is a lower *rate* instead (0.01 measures 25 % uncapped). **C-3 owns both knobs; this is the first thing it should look at.**
- **`endless-selection-effect` and the survival band are single-map, single-seed.** C-3 should widen them across maps and seeds before treating 15–35 as verified.
- **C-7's H12 boundary probe** straddles the 30 % ceiling at 20.3 % vs 51.9 % rather than hugging it. It pins the rule's direction firmly but not its exact number; tightening wants a purpose-built geometry rather than a slot-count sweep.
- **The editor's gold-fill budget is still contradicted in source** — a CSS comment calls the Decor Size pill "the editor's sole gold-filled active state" while the hand-backs call Save the sole gold fill. C-6 was scoped to not *widen* it, and did not. Settling it is a future pass.
- **Ctrl+S still means "Copy JSON", not Save.** Adding a control labelled "Save" sharpens the mismatch. Rebinding was scope creep for C-6 and the ADR flags the shortcut as an open question.

### carried forward from the cycle-3 docket (unchanged, still queued)

- **Layout generator** (path + slots + castle, generate-and-reject) — its own ADR per D10. **C-7 materially de-risked this**: the fairness oracle now exists as a pure, callable module with a pinned baseline, and its geometry helpers are exported so the generator judges by the same definitions.
- **Endless leaderboard** — unblocked on the scoring side by C-1/C-2 (`ctd3:endless` now holds waves/gold/lives per map+difficulty). **Still blocked on the operator publishing a `ctd3-scores` RTDB rules block** (ADR-017; console-managed, out of repo).
- **Tower-roster depth / combination mechanic** — deliberately not competing with endless for a cycle.
- **Daily seeded challenge** — C-2 laid a seam: every endless run has a reproducible seed and it is shown on the results screen.
- **Editor gold-budget settle** — see above.

### drop-with-reason

- **Music/ambient sourcing.** A content-acquisition task, not a code task; cycle 1 dropped it for the same reason and C-5 makes silence honest rather than broken. The wiring is intact and one line from returning.
- **Reconciling the ADR-034 allowlist line numbers wholesale.** C-4 corrected the one that was actively wrong (`scene.js:702` → `:836`, and it is a real site, not a phantom). A general line-number sweep is churn.

---

## Known-unknowns

**What I could not verify, and what would settle it:**

- **Endless *feel*.** The harness proves endless is deterministic, unbounded, terminating, build-separating and non-degenerate. It cannot prove it is fun. **Settled by:** playing it. This is now the single most valuable thing an operator can do, and it also unblocks C-3.
- **Endless on a live Community map.** The path was exercised end to end with only the Firebase *network* stubbed — every shipped line real, buttons rendered, import-and-play ran, `ctd3:scores` untouched. A genuinely live run needs a published community map; publishing was **denied to this session by the console-managed RTDB rules** (`PERMISSION_DENIED` on write). **Settled by:** the operator publishing one map from the editor, then pressing "Import & play" on the Community tab.
- **Long-run endless beyond wave 26.** No scripted build survived further, so waves 27+ have never been simulated or seen. The wave generator is defined for all waves and asserted deterministic to wave 60, but its *content* past 26 is unobserved.
- **The C-6 observer above 900 px.** Verified at 785 px. It cannot fire on desktop by design (it returns early when the tablist is hidden), so "does not fire on desktop" is asserted, not "works there".
- **C-4's two missing camera passes** — plains at 0.7, tidewater/riverbend at 1.0. Every palette was covered at both zooms; those three maps were not individually.

**Standing operator items, carried:**

- **G-1 retune playtest** — still unmet; now blocking a specific chunk.
- **Real-phone bottom-sheet and tabs** — the editor's <900 px shell and the game HUD were verified in a resized desktop window, never on a device.
- **Real NVDA / VoiceOver** — the endless HUD's live regions, the buy-a-life `aria-disabled` treatment, and C-6's results table were reasoned about and DOM-verified, never heard.
- **Real-iOS HUD** — unverified.
- **Snowfall path contrast** — confirmed again during C-4 and recorded: snowfall's pale grey path reads with markedly less contrast against its near-white ground than the terracotta paths do against green. A path/ground question, not an aura one.
- **Firefox / Safari matrix** — every verification this sprint ran in the debug Chrome.

---

## Note for the next session

Nothing in this sprint was pushed. `main` is **7 commits ahead of `origin/main`**; deploying is the operator's action. The G-0 gate that governed this sprint will be unmet for the next one until that push and a Cloudflare purge happen.
