/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — endless.js  (ADR-037 D8/D9)
   Endless-mode constants + the deterministic wave generator.

   This is the ONE implementation, consumed by two callers:
     • index.html (browser) — loaded as a <script> before engine.js.
     • tools/sim-harness.cjs (Node) — required after entities.js so
       CTD3Engine can reach it through the same window shim.

   Pure data + pure functions: no DOM, no engine state, no Math.random.
   Every run is reproducible from (seed, waveIndex) alone, which is what
   makes the harness's determinism check possible.

   Every endless-ONLY tunable lives HERE, so the balance calibration pass
   (ADR-037 C-3) is a constants-only edit to this file. Two numbers it does
   NOT own, because they are shared with the campaign and changing them would
   breach D12: PREP_COUNTDOWN_MS (engine.js — in endless it is also the
   auto-send cadence, and so the interest-periods-per-wave rate) and the
   harness's own check thresholds.

   tools/map-editor.html deliberately does NOT load this module: it consumes
   sim-core's campaign runner only, so the editor never reaches an endless
   path. Loading it there is the prerequisite for any future in-editor
   endless preview.
   Exposes window.CTD3Endless.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── Tunable constants — CALIBRATED (ADR-037 D9, ADR-038 T-1) ────────
  //
  // STATUS. These entered as Element TD reference values (×1.178/level HP
  // against ~1.0925 bounty growth) rather than CTD measurements. **T-1 ran that
  // calibration** — 6 official maps × 3 seeds (7 / 101 / 2029) × both
  // difficulties, every scripted arm plus the banking and call-early poles —
  // and the headline result is that the reference values SURVIVED measurement:
  // every calibrated quantity landed inside its target band, so the numbers
  // below did not move. What changed is their standing — they are no longer
  // inherited-and-unverified.
  //
  // Measured at these values (tools/sim-harness.cjs, section 7 — every figure
  // here is the harness's own printed output, not a side measurement):
  //   balanced survival   quiet 22–26 waves · spirited 19–21   (band 15–35)
  //   balanced duration   quiet 926–1185 s · spirited 795–919  (band 600–1800)
  //   build separation    worst pair 3 waves                    (≥3 required)
  //   interest share      17.9% worst of total income           (<35% ceiling)
  //   dominance margin    always-bank 0.0%, call-early 5.3%     (≤15% allowed)
  //   build saturation    spending stops at wave 8–10           (≥5 required)
  //
  // TWO OF THOSE ARE NOT COMFORTABLE AND THE TABLE SHOULD NOT BE READ AS IF
  // THEY WERE. Build separation lands EXACTLY on its threshold — the worst cell
  // (mountain/spirited/seed 101, depths 17/17/20) has zero headroom, so a small
  // content nudge can turn that check red. And the widening is what revealed
  // it: the pre-T-1 single-cell figure was a spread of 8.
  //
  // HOW THESE ARE ACTUALLY LOCKED, stated precisely because an earlier draft of
  // this comment overclaimed it. The outcome bands are wide, and mutation
  // testing shows BOUNTY_GAP, INTEREST_RATE, BUY_LIFE_GROWTH and both SCALARS
  // can all move without turning a single band red — three of them move no CSV
  // byte either. So the real lock is `endless-constants-pinned`, which pins
  // every tunable below by value: recalibrating means editing that pin in the
  // same commit. The bands catch gross behavioural drift, the CSVs make curve
  // changes diffable, and the pin is what makes a silent constant edit
  // impossible. Note the CSVs are a diffable ARTIFACT, not an automatic gate —
  // the harness rewrites them and exits 0.
  //
  // THE FINDING THAT MATTERS MOST IS NOT A CONSTANT (ADR-038 D20). The balanced
  // build stops spending at wave 8–10 and then plays 9–17 further waves with a
  // full board and maxed tiers, having spent only 11–21% of its lifetime
  // income. Endless has roughly nine waves of economy followed by seventeen of
  // watching. That is the scope input D20 asked this pass to produce, and it is
  // also why `endless-dominance-margin` has no power over the numbers below —
  // see the long note at that check.
  //
  const ENDLESS_GROWTH      = 1.15;   // per-enemy HP multiplier per wave
  const BOUNTY_GAP          = 1.07;   // bounty grows at GROWTH/GAP — ETD's deliberate ~7%/wave compounding gap
  const INTEREST_RATE       = 0.02;   // fraction of banked gold paid per period
  const INTEREST_PERIOD_MS  = 15000;  // 2% / 15s of unpaused sim time
  // Per-period ceiling on interest, and the ONE knob T-1 was asked to settle
  // deliberately: a cap on the payout versus simply lowering the rate.
  //
  // THE CAP WINS, and the measurement is what decides it (6 maps × 3 seeds,
  // worst interest share of total income, against the harness's 35% ceiling):
  //     rate 0.02 + cap 50   →  17.9%   (51% of the ceiling)   ← shipped
  //     rate 0.02, uncapped  →  45.7%   BREACHES the ceiling
  //     rate 0.01, uncapped  →  25.0%   (71% of the ceiling)
  // A lower rate does clear the ceiling, but it buys that by halving the
  // incentive EVERYWHERE — including early, where choosing between banking
  // 200g and placing a tower is the decision interest exists to create. The cap
  // leaves interest fully proportional below the saturation bank
  // (INTEREST_CAP / INTEREST_RATE = 2500g), exactly where that decision is
  // live, and flattens it only above — so it removes the degeneracy without
  // flattening the mechanic.
  //
  // WHAT THE DEGENERACY ACTUALLY IS. The 45.7% figure has been described as the
  // "bank everything, win" failure. **It is an INCOME-COMPOSITION degeneracy,
  // not a strategic one**: interest becomes the dominant source of gold,
  // swamping both bounty and the early-call bonus it is meant to be in tension
  // with. The cap is still the right fix, but for that reason rather than the
  // one the old note implied.
  //
  // The stronger claim — "and banking does not out-run building either" — is
  // one this repo CANNOT currently make, and the honest statement of why is
  // more useful than the claim. T-1's always-bank arm measures +0.0% at every
  // reserve floor under every interest configuration, including a deliberately
  // absurd 0.20-uncapped patch that accrues ~263 million gold. That is not
  // evidence about the design; it is an artifact of build saturation (above):
  // after wave 8–10 there is nothing to buy, so no amount of gold converts into
  // depth and no economic strategy can express dominance either way. Read
  // `endless-dominance-margin` as "no dominance was OBSERVABLE", never as "no
  // dominance exists".
  const INTEREST_CAP        = 50;
  // Buy-a-life cost curve. UNCHANGED by T-1, and the reason is a limitation
  // rather than a result: no scripted policy models *when* buying a life is
  // correct, so the only arm available is "buy greedily whenever affordable" —
  // a strawman in both directions (it can bankrupt its own board, and it never
  // declines a bad purchase). What that arm does establish is a bound: at these
  // values it gains at most **+13.0%** run depth over the balanced build, i.e.
  // inside the same ≤15% margin the dominance check uses, so the curve is not
  // obviously mispriced. Its *shape* is unmeasured and stays that way until an
  // arm exists that can judge a purchase. Recorded so a future pass does not
  // read "unchanged" as "verified".
  const BUY_LIFE_BASE       = 100;    // first purchased life
  const BUY_LIFE_GROWTH     = 1.5;    // cost = BASE × GROWTH^(lives already bought)
  const BOSS_CADENCE        = 10;     // a boss-flagged anchor every Nth wave
  const FIXED_OPENING       = 5;      // waves 1..N are authored, not shuffled
  const BASE_REWARD         = 20;     // wave-clear reward before bounty scaling
  const BOSS_REWARD         = 70;
  // Layered onto the merged campaign difficulty at createState (D8.3) —
  // multiplicative so per-map difficultyOverrides keep working.
  const SCALARS = { startGoldMult: 1.25, startLivesMult: 1.0 };

  // Design guard mirroring level-design rule W8 (peak concurrent ≤ 35).
  // Every template below is authored well under this; the harness asserts it.
  const SPAWN_CEILING = 35;

  // ─── Seeded RNG (mulberry32) ─────────────────────────────────
  // Deterministic and self-contained: a run is reproducible from its seed,
  // and the harness can assert two runs generate an identical sequence.
  function rngFrom(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // Mixes the run seed with a block index so consecutive blocks don't
  // walk consecutive RNG streams (which would correlate their shuffles).
  function mixSeed(seed, block) {
    let h = ((seed >>> 0) ^ Math.imul(block + 1, 0x9E3779B1)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
    h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  }

  // ─── Wave shapes ─────────────────────────────────────────────
  // Same {type, count, spacing, delay} group shape maps.js uses, so the
  // engine's wave dripper needs no endless-specific branch.
  function g(type, count, spacing, delay) {
    return { type, count, spacing, delay: delay || 0 };
  }

  // Waves 1–5: a fixed, learnable opening (ETD's pattern). Deliberately
  // scaled like a campaign opening — endless growth starts at ×1.0, so
  // these are the raw numbers a first-time endless player meets.
  const OPENING = [
    [ g('footman', 6, 700, 0) ],
    [ g('footman', 8, 560, 0), g('runner', 3, 700, 5000) ],
    [ g('runner', 6, 620, 0), g('footman', 5, 520, 4500) ],
    [ g('heavy', 3, 1400, 0), g('footman', 6, 520, 4500) ],
    [ g('shielded', 4, 1100, 0), g('skirmisher', 4, 800, 5000), g('footman', 4, 520, 9000) ]
  ];

  // The shuffled middle. `minBlock` gates a composition until the run has
  // earned it, so block 0 never opens with juggernauts. Counts are authored
  // so that effective spawns (split children included) stay ≤ ~22 — all
  // difficulty growth goes into HP, never into entity count (D9).
  //
  // T-1 FINDING, recorded and deliberately NOT acted on here (this was a
  // constants-only pass; `minBlock` is content, not a tunable). At the
  // calibrated curve the deepest run anywhere across 6 maps × 3 seeds is
  // **wave 26**, so block 3 (waves 31+) is never entered and `bulwark` and
  // `stormfront` are **unreachable** — 10 of 12 templates are live content.
  // `mixedhost` and `deluge` (block 2, waves 21–30) are reached only by the
  // balanced build; the two naive arms die at waves 10–19 across the matrix
  // (12–19 on quiet, as low as 10 on spirited). Lowering those two
  // `minBlock`s is the obvious response and it is a content decision that
  // wants its own commit and its own re-baseline, not a line in a calibration.
  const TEMPLATES = [
    { id: 'rabble',     minBlock: 0, groups: [ g('footman', 10, 520, 0), g('runner', 4, 650, 5200) ] },
    { id: 'swiftfoot',  minBlock: 0, groups: [ g('runner', 9, 520, 0), g('footman', 6, 480, 5000) ] },
    { id: 'ironbacks',  minBlock: 0, groups: [ g('heavy', 5, 1300, 0), g('footman', 6, 500, 5000) ] },
    { id: 'shieldwall', minBlock: 0, groups: [ g('shielded', 6, 1050, 0), g('footman', 5, 520, 6000) ] },
    { id: 'skyborne',   minBlock: 0, groups: [ g('skirmisher', 8, 700, 0), g('runner', 4, 600, 5600) ] },
    { id: 'ooze',       minBlock: 1, groups: [ g('slime', 6, 1000, 0), g('footman', 4, 520, 6000) ] },
    { id: 'hauntings',  minBlock: 1, groups: [ g('ghost', 7, 780, 0), g('skirmisher', 5, 700, 6000) ] },
    { id: 'siegework',  minBlock: 1, groups: [ g('juggernaut', 2, 2200, 0), g('shielded', 5, 1100, 4000), g('footman', 4, 520, 9000) ] },
    { id: 'mixedhost',  minBlock: 2, groups: [ g('heavy', 4, 1300, 0), g('shielded', 4, 1100, 4500), g('skirmisher', 5, 700, 9000), g('runner', 5, 560, 12000) ] },
    { id: 'deluge',     minBlock: 2, groups: [ g('runner', 10, 430, 0), g('ghost', 5, 760, 5000), g('heavy', 3, 1400, 10000) ] },
    { id: 'bulwark',    minBlock: 3, groups: [ g('juggernaut', 3, 2000, 0), g('heavy', 5, 1250, 3000), g('shielded', 5, 1050, 9000) ] },
    { id: 'stormfront', minBlock: 3, groups: [ g('skirmisher', 9, 640, 0), g('ghost', 7, 720, 5500), g('runner', 6, 520, 11000) ] }
  ];

  // Boss anchors escalate their captain count, then hold — the wave's teeth
  // come from the HP curve, not from stacking more bodies on screen.
  function bossGroups(block) {
    const captains = Math.min(3, 1 + block);
    return [
      g('captain', captains, 3000, 0),
      g('heavy', 5, 1200, 4000),
      g('shielded', 4, 1100, 9000)
    ];
  }

  // ─── Growth curves ───────────────────────────────────────────
  // waveIndex is 0-based (wave 1 = index 0), so wave 1 always runs at ×1.0.
  function hpScale(waveIndex)     { return Math.pow(ENDLESS_GROWTH, waveIndex); }
  function bountyScale(waveIndex) { return Math.pow(ENDLESS_GROWTH / BOUNTY_GAP, waveIndex); }
  function scaleFor(waveIndex) {
    return { hp: hpScale(waveIndex), bounty: bountyScale(waveIndex) };
  }

  function buyLifeCost(livesBought) {
    return Math.round(BUY_LIFE_BASE * Math.pow(BUY_LIFE_GROWTH, Math.max(0, livesBought || 0)));
  }

  // ─── Block assignment ────────────────────────────────────────
  // A "block" is BOSS_CADENCE waves ending in a boss anchor. Within each
  // block the non-anchor waves are Fisher–Yates shuffled from the eligible
  // template pool (lesson 6: shuffle the middle, pin the anchors). Block 0's
  // middle is only waves 6–9 because 1–5 are the fixed opening.
  function middleCount(block) {
    const slots = BOSS_CADENCE - 1;
    return block === 0 ? slots - FIXED_OPENING : slots;
  }

  const _blockCache = new Map();
  function blockAssignment(seed, block) {
    const key = (seed >>> 0) + ':' + block;
    const hit = _blockCache.get(key);
    if (hit) return hit;
    const slots = middleCount(block);
    const pool = TEMPLATES.filter(t => t.minBlock <= block);
    const bag = [];
    while (bag.length < slots) bag.push.apply(bag, pool);
    const rnd = rngFrom(mixSeed(seed, block));
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
    }
    const out = bag.slice(0, slots);
    // Bounded memo: a long run must not grow this without limit.
    if (_blockCache.size > 64) _blockCache.clear();
    _blockCache.set(key, out);
    // Hand out a COPY, never the cached array. This function is exported, and
    // a caller that sorts/reverses/splices the result in place would silently
    // rewrite the live run's remaining waves — breaking the one property this
    // module exists to guarantee, in a way no determinism check could catch.
    return out.slice();
  }

  // ─── The generator ───────────────────────────────────────────
  // Returns a wave in exactly the shape maps.js produces, so every
  // consumer (engine dripper, sim-core waveStats, UI) reads it unchanged.
  // Pure: same (waveIndex, seed) always yields the same wave.
  function waveFor(waveIndex, seed) {
    const w = waveIndex + 1;                     // 1-based wave number
    const block = Math.floor(waveIndex / BOSS_CADENCE);
    const isBoss = (w % BOSS_CADENCE) === 0;
    let groups;
    if (isBoss) {
      groups = bossGroups(block);
    } else if (w <= FIXED_OPENING) {
      groups = OPENING[w - 1];
    } else {
      // Position within this block's shuffled middle.
      const posInBlock = ((w - 1) % BOSS_CADENCE);           // 0..BOSS_CADENCE-2 for non-anchors
      const idx = block === 0 ? posInBlock - FIXED_OPENING : posInBlock;
      const assigned = blockAssignment(seed, block);
      groups = assigned[idx % assigned.length].groups;
    }
    const rewardBase = isBoss ? BOSS_REWARD : BASE_REWARD;
    return {
      // Fresh group objects each call: the engine's dripper reads them and
      // a shared mutable array across waves would be a latent aliasing bug.
      enemies: groups.map(gr => g(gr.type, gr.count, gr.spacing, gr.delay)),
      reward: Math.round(rewardBase * bountyScale(waveIndex)),
      isBoss: isBoss
    };
  }

  // Effective spawn count for a wave, split children included — the number
  // level-design rule W8's ceiling of 35 is about. Used by the harness.
  function effectiveSpawnCount(wave, enemies) {
    let total = 0;
    for (const gr of wave.enemies) {
      let def = enemies[gr.type];
      let n = gr.count;
      const seen = new Set();
      while (def) {
        // Throws rather than truncating, matching sim-core's waveStats: a
        // splitsInto cycle must fail loudly in both counters, or this one
        // would under-count and let the spawn-ceiling check pass on a map
        // the campaign path already rejects.
        if (seen.has(def)) {
          throw new Error('ENEMIES splitsInto cycle reached from "' + gr.type + '" — fix entities.js');
        }
        seen.add(def);
        total += n;
        const child = def.splitsInto && enemies[def.splitsInto];
        n = child ? n * (def.splitCount || 2) : 0;
        def = child || null;
      }
    }
    return total;
  }

  window.CTD3Endless = {
    ENDLESS_GROWTH, BOUNTY_GAP, INTEREST_RATE, INTEREST_PERIOD_MS, INTEREST_CAP,
    BUY_LIFE_BASE, BUY_LIFE_GROWTH, BOSS_CADENCE, FIXED_OPENING,
    BASE_REWARD, BOSS_REWARD, SCALARS, SPAWN_CEILING, TEMPLATES,
    rngFrom, hpScale, bountyScale, scaleFor, buyLifeCost,
    waveFor, blockAssignment, effectiveSpawnCount
  };
})();
