#!/usr/bin/env node
/*
 * Headless balance harness + hygiene smoke tests (ADR-036 CH-1, decision D6).
 *
 * Run from the CTD directory:   node tools/sim-harness.cjs
 * (also works from repo root:   node games/castle-tower-defense/tools/sim-harness.cjs)
 * Exit 0 when every non-KNOWN-FAIL check passes, 1 otherwise.
 *
 * What it does:
 *   1. Runs scripted baseline builds (greedy-cheapest, ranger-heavy, balanced)
 *      through every official map x both difficulties at fixed 16.67ms ticks
 *      with auto-sendNextWave; reports win/loss, lives, final gold.
 *   2. Emits per-wave curve rows (HP, income, attrition ratio, cumulative gold)
 *      as CSV to tools/curves/<mapId>.csv so balance state is a reproducible
 *      artifact (ADR-036 §2.2 methodology: attrition = quiet wave HP ÷
 *      cumulative quiet gold assuming full clears; split children included).
 *   3. Asserts hygiene invariants (lesson 8: selection→effect):
 *      - every ENEMIES entry spawns and dies in sim (split + spectral included)
 *      - both DIFFICULTY modes measurably change HP and starting resources
 *      - every official map completable by ≥1 scripted build (per difficulty)
 *      - every enemy type referenced by official waves exists in ENEMIES
 *      - every ENEMIES entry is reachable from some official wave
 *      - attrition ratio is monotone non-declining waves 2→7 (ADR-036 D2)
 *
 * KNOWN_FAILS below documents pre-existing content findings (not regressions):
 * they print as KNOWN-FAIL, are excluded from the ALL PASS summary, and are
 * expected to be cleared by the chunk named in their reason string.
 */
'use strict';

const fs = require('fs');
const path = require('path');

global.window = { location: { search: '' } };
require('../entities.js');
require('../maps.js');
require('../endless.js'); // endless constants + wave generator (ADR-037 D8/D9)
require('../engine.js');
require('./sim-core.js'); // shared scripted-build runner + curves (ADR-036 X-1)

const E = global.window.CTD3Entities;
const Maps = global.window.CTD3Maps;
const Eng = global.window.CTD3Engine;
const SimCore = global.window.CTD3SimCore;
const Endless = global.window.CTD3Endless;
// The scripted-build runner, build list, and static curve computation live in
// sim-core.js so the editor's "Simulate this map" panel shares one implementation.
// runScripted takes the map OBJECT (it installs a single-map CTD3Maps facade).
const { runScripted, computeCurves } = SimCore;

const TICK_MS = 1000 / 60; // killCheck's fixed tick (runScripted uses sim-core's own)

// ─── KNOWN-FAIL registry (findings, not assertion weakening) ──
// id → reason. Reviewed each sprint; clearing entries is part of the
// owning chunk's acceptance (ADR-036 CH-3 for all of the below).
const KNOWN_FAILS = {};
// (CH-1 registered 10 entries here — 4 dead Phase-5 enemy types, 6 attrition
// findings. All cleared by CH-3's content wiring + D2 retune, 2026-07-23.)

const checks = [];
const staleKnown = [];
function check(id, cond, detail) {
  const known = Object.prototype.hasOwnProperty.call(KNOWN_FAILS, id);
  if (cond && known) staleKnown.push(id);
  const status = cond ? 'PASS' : (known ? 'KNOWN-FAIL' : 'FAIL');
  checks.push({ id, status });
  const suffix = detail ? '  [' + detail + ']' : '';
  const note = (!cond && known) ? '  (' + KNOWN_FAILS[id] + ')' : '';
  console.log(status + '  ' + id + suffix + note);
}
function warn(msg) { console.log('WARN  ' + msg); }

// Scripted-build policies, runScripted, and the static curve computation
// (waveStats/computeCurves) now live in tools/sim-core.js — see the require
// above. The harness keeps only the hygiene micro-arena (killCheck) and the
// acceptance/check orchestration below.

// Micro-arena: one enemy of `type` against a full board of T3 rangers with
// hacked gold — proves the type spawns, moves, and dies through the real
// engine path (spectral charges consumed, splits spawned and cleaned up).
function killCheck(type) {
  const state = Eng.createState('plains', 'quiet');
  state.gold = 999999;
  for (const slot of state.mapDef.buildSlots) Eng.place(state, slot.id, 'ranger');
  for (const tw of state.towers) { Eng.upgrade(state, tw.id); Eng.upgrade(state, tw.id); }
  state.fsm = 'inWave';
  state.waveProgress = { spawnQueue: [{ type, spawnAtMs: 0 }], elapsedMs: 0 };
  const kills = {};
  let spawned = false, elapsed = 0, primaryId = null, hitsOnPrimary = 0;
  while (elapsed < 120000) {
    Eng.step(state, TICK_MS);
    if (!primaryId && state.enemies.length) { spawned = true; primaryId = state.enemies[0].id; }
    for (const ev of state.events) {
      if (ev.kind === 'kill') kills[ev.enemyType] = (kills[ev.enemyType] || 0) + 1;
      if (ev.kind === 'hit' && ev.enemyId === primaryId) hitsOnPrimary++;
    }
    state.events.length = 0;
    elapsed += TICK_MS;
    if (spawned && !state.enemies.length && (!state.waveProgress || !state.waveProgress.spawnQueue.length)) break;
  }
  return { spawned, kills, hitsOnPrimary };
}

// ─── Main ────────────────────────────────────────────────────
const maps = Maps.listOfficial();
console.log('CTD3 sim harness — ' + maps.length + ' official maps, ' +
  Object.keys(E.ENEMIES).length + ' enemy types, ' + SimCore.BUILDS.length + ' scripted builds\n');

// 1. Referenced enemy types exist.
for (const map of maps) {
  const missing = [];
  map.waves.forEach((w, i) => w.enemies.forEach(gDef => {
    if (!E.ENEMIES[gDef.type]) missing.push('w' + (i + 1) + ':' + gDef.type);
  }));
  check('wave-types-exist:' + map.id, missing.length === 0, missing.join(',') || map.waves.length + ' waves');
}

// 2. Every ENEMIES entry reachable from some official wave (directly or via split).
//    Split reachability is transitive (chain-splits included).
{
  const reachable = new Set();
  for (const map of maps) map.waves.forEach(w => w.enemies.forEach(gDef => {
    let t = gDef.type;
    while (t && !reachable.has(t)) {
      reachable.add(t);
      const def = E.ENEMIES[t];
      t = def && def.splitsInto;
    }
  }));
  for (const type of Object.keys(E.ENEMIES)) {
    check('content-reachable:' + type, reachable.has(type));
  }
}

// 3. Every ENEMIES entry spawnable + killable through the real engine path.
for (const type of Object.keys(E.ENEMIES)) {
  const def = E.ENEMIES[type];
  const r = killCheck(type);
  let ok = r.spawned && (r.kills[type] || 0) >= 1;
  let detail = 'kills=' + JSON.stringify(r.kills);
  if (def.splitsInto) {
    const n = def.splitCount || 2;
    ok = ok && (r.kills[def.splitsInto] || 0) >= n;
    detail += ' expected ' + n + 'x ' + def.splitsInto;
  }
  if (def.spectralCharges) {
    // Spectral selection→effect: the kill must have cost at least
    // charges+1 hits, proving the negation branch actually fired.
    ok = ok && r.hitsOnPrimary >= def.spectralCharges + 1;
    detail += ' hits=' + r.hitsOnPrimary + ' (>=' + (def.spectralCharges + 1) + ' required)';
  }
  check('spawn-and-kill:' + type, ok, detail);
}

// 4. Difficulty selection→effect: modes measurably change HP + resources.
{
  const q = Eng.createState('plains', 'quiet');
  const s = Eng.createState('plains', 'spirited');
  check('difficulty-start-resources', q.gold > s.gold && q.lives > s.lives,
    'quiet ' + q.gold + 'g/' + q.lives + 'L vs spirited ' + s.gold + 'g/' + s.lives + 'L');
  const hq = E.makeEnemy('footman', q.difficultyMult.hpMult).maxHp;
  const hs = E.makeEnemy('footman', s.difficultyMult.hpMult).maxHp;
  check('difficulty-enemy-hp', hs > hq, 'footman quiet ' + hq + ' vs spirited ' + hs);
  const o = E.mergedDifficulty('quiet', { quiet: { startGold: 999 } });
  check('difficulty-override-merge', o.startGold === 999 && o.hpMult === E.DIFFICULTY.quiet.hpMult);
  // ADR-036 CH-2: harder pays more per kill (D3 coupling, lesson 2).
  const bq = E.bountyFor(E.ENEMIES.footman, q);
  const bs = E.bountyFor(E.ENEMIES.footman, s);
  check('bounty-coupling-per-kill', bs > bq, 'footman quiet ' + bq + 'g vs spirited ' + bs + 'g');
}

// 4b. Tier efficiency (ADR-036 D3a): DPS-per-cumulative-gold rises with tier,
// T3 in ~1.1–1.3x T1, for every projectile tower.
for (const [type, def] of Object.entries(E.TOWERS)) {
  if (def.behavior !== 'projectile') continue;
  const eff = [];
  let cum = 0;
  def.tiers.forEach(t => {
    cum += t.cost;
    eff.push((t.damage * t.fireRate * (t.volley || 1)) / cum);
  });
  const monotone = eff.every((v, i) => i === 0 || v >= eff[i - 1] - 0.001);
  const ratio = eff[eff.length - 1] / eff[0];
  check('tier-efficiency:' + type, monotone && ratio >= 1.1 && ratio <= 1.3,
    eff.map(v => v.toFixed(3)).join('→') + ' T3/T1=' + ratio.toFixed(2));
}

// 5. Scripted runs: every map x difficulty x policy; completability per difficulty.
console.log('');
const results = {};
for (const map of maps) {
  for (const difficulty of ['quiet', 'spirited']) {
    for (const policyName of SimCore.BUILDS) {
      const r = runScripted(map, difficulty, policyName);
      results[map.id + '/' + difficulty + '/' + policyName] = r;
      console.log('run   ' + map.id.padEnd(14) + difficulty.padEnd(9) + policyName.padEnd(16) +
        (r.won ? 'WON ' : (r.timedOut ? 'TIMEOUT ' : 'LOST')) +
        '  waves ' + r.wavesCleared + '/' + map.waves.length +
        '  lives ' + r.lives + '  gold ' + r.gold + '  (' + r.simSec + 's sim)');
    }
  }
}
console.log('');
// Deliberately stricter than the CH-1 brief (quiet only): CH-2/CH-3 both
// require "all maps completable on both difficulties", so spirited is a
// hard check too. If a future tune intends spirited to beat naive scripted
// builds, register a KNOWN_FAILS entry with that rationale.
for (const map of maps) {
  for (const difficulty of ['quiet', 'spirited']) {
    const wonBy = SimCore.BUILDS.filter(p => results[map.id + '/' + difficulty + '/' + p].won);
    check('completable:' + map.id + ':' + difficulty, wonBy.length > 0,
      wonBy.length ? 'won by ' + wonBy.join(',') : 'no scripted build wins');
  }
}

// 5b. ADR-036 CH-2 coupling, run-level: spirited total gold earned >= quiet
// (same map, same scripted build) — bountyMult must outweigh nothing, since
// enemy counts and wave rewards are identical across difficulties.
for (const map of maps) {
  const q = results[map.id + '/quiet/ranger-heavy'];
  const s = results[map.id + '/spirited/ranger-heavy'];
  // Strict > when both runs won: a full spirited clear at bountyMult 1.25
  // must out-earn quiet, so equality would mean the multiplier never
  // reached killEnemy (the exact integration a >= would let slip).
  const ok = (q.won && s.won) ? s.goldEarned > q.goldEarned : s.goldEarned >= q.goldEarned;
  check('bounty-coupling-total:' + map.id, ok,
    'earned quiet ' + q.goldEarned + 'g vs spirited ' + s.goldEarned + 'g');
}

// 5c. ADR-036 CH-4: an early-calling build banks more gold than one that
// waits out every countdown (same map/difficulty/policy — the only delta
// is tempo, so the difference is exactly the early-call bonuses).
{
  const fast = results['plains/quiet/ranger-heavy'];
  const slow = runScripted(Maps.byId('plains'), 'quiet', 'ranger-heavy', { slowCall: true });
  check('early-call-banks-more', fast.won && slow.won && fast.goldEarned > slow.goldEarned,
    'early-caller ' + fast.goldEarned + 'g vs slow-caller ' + slow.goldEarned + 'g');
}

// 6. Curve CSVs + attrition monotonicity (ADR-036 D2: no mid-run decline w2→w7).
const curvesDir = path.join(__dirname, 'curves');
fs.mkdirSync(curvesDir, { recursive: true });
for (const map of maps) {
  const rows = computeCurves(map);
  const csv = ['map,wave,isBoss,baseHp,quietHp,income,cumGoldBeforeQuiet,attritionQuiet'];
  for (const r of rows) {
    csv.push([map.id, r.wave, r.isBoss, r.baseHp, r.quietHp, r.income, r.cumGoldBefore,
      r.attrition.toFixed(3)].join(','));
  }
  fs.writeFileSync(path.join(curvesDir, map.id + '.csv'), csv.join('\n') + '\n');

  // Waves 2→7 (tutorial wave 1 and the wave-8 boss spike excluded per D2).
  const mid = rows.slice(1, 7);
  let declines = [];
  for (let i = 0; i + 1 < mid.length; i++) {
    if (mid[i + 1].attrition < mid[i].attrition - 0.02) {
      declines.push('w' + mid[i].wave + '→w' + mid[i + 1].wave +
        ' (' + mid[i].attrition.toFixed(2) + '→' + mid[i + 1].attrition.toFixed(2) + ')');
    }
  }
  const fullLength = rows.length >= 8;
  check('attrition-monotone:' + map.id, fullLength && declines.length === 0,
    !fullLength ? 'only ' + rows.length + ' waves' : (declines.join(' ') || 'w2→w7 non-declining'));
  const w7 = rows[6];
  if (w7 && (w7.attrition < 0.9 || w7.attrition > 1.3)) {
    warn('attrition-band:' + map.id + ' wave-7 ratio ' + w7.attrition.toFixed(2) +
      ' outside D2 target ~1.0–1.2');
  }
}
console.log('\ncurve CSVs written to ' + path.relative(process.cwd(), curvesDir));

// ─── 7. Endless mode (ADR-037 C-1) ───────────────────────────
// D6 makes harness coverage mandatory for any new selectable mode, so every
// property that must hold regardless of how the campaign *feels* is asserted
// here: determinism, unboundedness, termination, build separation,
// selection→effect and the interest bound. The numbers these checks defend
// are starting values (ADR-037 §7 note) — a later calibration chunk may move
// them, but never in the commit that first fails one.
console.log('');
{
  const SEED = 7;
  const WAVE_CAP = 60;            // sim guard: a build that never dies is a defect
  const INTEREST_MAX_SHARE = 0.35; // cumulative interest ÷ cumulative income
  const endlessMap = Maps.byId('plains');

  // 7a. Determinism — the generator is pure over (waveIndex, seed).
  {
    const seqA = [], seqB = [];
    for (let i = 0; i < 40; i++) {
      seqA.push(JSON.stringify(Endless.waveFor(i, SEED)));
      seqB.push(JSON.stringify(Endless.waveFor(i, SEED)));
    }
    const other = [];
    for (let i = 0; i < 40; i++) other.push(JSON.stringify(Endless.waveFor(i, SEED + 1)));
    const same = seqA.every((s, i) => s === seqB[i]);
    // A seed that changes nothing would make "deterministic" vacuous.
    const differs = other.some((s, i) => s !== seqA[i]);
    check('endless-determinism', same && differs,
      same ? (differs ? '40 waves identical for seed ' + SEED + ', seed ' + (SEED + 1) + ' differs'
                      : 'seed has NO effect on the sequence') : 'same seed produced different waves');
  }

  // 7a2. Run-level determinism — two capped runs from one seed agree exactly.
  {
    const o = { endless: true, seed: SEED, maxWaves: 12 };
    const r1 = runScripted(endlessMap, 'quiet', 'balanced', o);
    const r2 = runScripted(endlessMap, 'quiet', 'balanced', o);
    check('endless-run-determinism',
      r1.wavesCleared === r2.wavesCleared && r1.gold === r2.gold &&
      r1.goldEarned === r2.goldEarned && r1.interestEarned === r2.interestEarned,
      'w' + r1.wavesCleared + '/' + r1.gold + 'g vs w' + r2.wavesCleared + '/' + r2.gold + 'g');
  }

  // 7b. Spawn ceiling — all growth goes into HP, never entity count (D9).
  // Level-design rule W8's ceiling, split children included. The 35 is
  // hard-coded HERE, not read from endless.js: a threshold imported from the
  // module under test can be raised by the same edit that breaks it.
  {
    const W8_CEILING = 35;
    let peak = 0, peakWave = 0;
    for (let i = 0; i < WAVE_CAP; i++) {
      const n = Endless.effectiveSpawnCount(Endless.waveFor(i, SEED), E.ENEMIES);
      if (n > peak) { peak = n; peakWave = i + 1; }
    }
    check('endless-spawn-bound', peak <= W8_CEILING && Endless.SPAWN_CEILING <= W8_CEILING,
      'peak ' + peak + ' spawns (wave ' + peakWave + ') vs W8 ceiling ' + W8_CEILING +
      '; module SPAWN_CEILING=' + Endless.SPAWN_CEILING);
  }

  // 7b2. Endless scalars layer through mergedDifficulty WITHOUT displacing
  // per-map difficultyOverrides (brief item 7). The pre-existing override
  // check runs the 2-arg campaign path and never touches this one.
  {
    const o = E.mergedDifficulty('quiet', { quiet: { startGold: 999 } }, Endless.SCALARS);
    const plain = E.mergedDifficulty('quiet', { quiet: { startGold: 999 } });
    const expected = Math.round(999 * Endless.SCALARS.startGoldMult);
    check('endless-difficulty-override-merge',
      o.startGold === expected && plain.startGold === 999 && o.hpMult === E.DIFFICULTY.quiet.hpMult,
      'override 999g → endless ' + o.startGold + 'g (expected ' + expected + '), campaign still ' + plain.startGold + 'g');
  }

  // 7b3. Buy-a-life (brief item 6): escalating cost curve + the place/upgrade/
  // sell enum contract, including that it is inert outside endless.
  {
    const costs = [0, 1, 2, 3].map(n => Endless.buyLifeCost(n));
    const escalating = costs.every((c, i) => i === 0 || c > costs[i - 1]);
    const s = Eng.createState('plains', 'quiet', { endless: true, seed: SEED });
    const livesBefore = s.lives;
    s.gold = 0;
    const poor = Eng.buyLife(s);
    s.gold = 10000;
    const rich = Eng.buyLife(s);
    const secondCost = Eng.buyLifeCost(s);
    const campaign = Eng.buyLife(Eng.createState('plains', 'quiet'));
    check('endless-buy-a-life',
      escalating && costs[0] === 100 && poor === 'unaffordable' && rich === 'ok' &&
      s.lives === livesBefore + 1 && s.gold === 10000 - costs[0] &&
      secondCost === costs[1] && campaign === 'invalid',
      'costs ' + costs.join('→') + '; poor=' + poor + ' rich=' + rich +
      ' lives ' + livesBefore + '→' + s.lives + '; campaign=' + campaign);
  }

  // 7b4. Endless scoring (brief item 8): waves survived primary, gold then
  // lives as tiebreak — the ordering the results screen ranks by.
  {
    const mk = (waves, gold, lives) => ({ waves, gold, lives });
    const ok =
      Eng.endlessBetter(mk(12, 0, 0), mk(11, 9999, 99)) > 0 &&   // waves outrank everything
      Eng.endlessBetter(mk(12, 500, 0), mk(12, 400, 99)) > 0 &&  // then gold
      Eng.endlessBetter(mk(12, 500, 5), mk(12, 500, 4)) > 0 &&   // then lives
      Eng.endlessBetter(mk(12, 500, 5), mk(12, 500, 5)) === 0 && // exact tie
      Eng.endlessBetter(mk(1, 0, 0), null) > 0;                  // first run beats no record
    check('endless-score-ordering', ok, 'waves > gold > lives, ties equal, null-safe');
  }

  // 7c. The runs the remaining checks read.
  const endlessRuns = {};
  for (const build of SimCore.BUILDS) {
    endlessRuns[build] = runScripted(endlessMap, 'quiet', build,
      { endless: true, seed: SEED, maxWaves: WAVE_CAP });
    const r = endlessRuns[build];
    console.log('run   endless       quiet    ' + build.padEnd(16) +
      (r.lost ? 'LOST' : (r.timedOut ? 'TIMEOUT ' : 'CAPPED')) +
      '  waves ' + r.wavesCleared + '  gold ' + r.gold +
      '  interest ' + r.interestEarned + '/' + r.goldEarned + '  (' + r.simSec + 's sim)');
  }
  const depths = SimCore.BUILDS.map(b => endlessRuns[b].wavesCleared);
  const best = Math.max.apply(null, depths), worst = Math.min.apply(null, depths);

  // 7d. Unboundedness — endless blows past the campaign's 8-wave ceiling and
  // never reaches 'wonRun' for a competent build.
  {
    const champion = SimCore.BUILDS.reduce((a, b) =>
      endlessRuns[b].wavesCleared > endlessRuns[a].wavesCleared ? b : a);
    const r = endlessRuns[champion];
    check('endless-unbounded', r.wavesCleared >= 20 && !r.won,
      champion + ' cleared ' + r.wavesCleared + ' waves (>=20 required, campaign ceiling is 8)' +
      (r.won ? ' — but reached wonRun, which endless must never do' : ''));
  }

  // 7e. Termination — a naive build must eventually LOSE. An endless mode a
  // dumb build survives forever in is broken, so neither the sim-time budget
  // nor the wave cap may be what stops these runs.
  {
    const survivors = SimCore.BUILDS.filter(b =>
      !endlessRuns[b].lost || endlessRuns[b].timedOut || endlessRuns[b].hitWaveCap);
    check('endless-terminates', survivors.length === 0,
      survivors.length ? survivors.join(',') + ' never died below the wave cap ' + WAVE_CAP
                       : 'all ' + SimCore.BUILDS.length + ' builds died by wave ' + best);
  }

  // 7f. Build separation — build choice must move survival depth, or the
  // mode is a slot machine.
  check('endless-build-separation', best - worst >= 3,
    'depths ' + depths.join('/') + ' — spread ' + (best - worst) + ' waves (>=3 required)');

  // 7g. Selection→effect (ADR-036 D6, mandatory for a new selectable mode).
  // Directional, like every sibling difficulty check in this file: "merely
  // different" would pass an inverted scalar that made spirited the easy one.
  {
    const q = endlessRuns.balanced;
    const s = runScripted(endlessMap, 'spirited', 'balanced',
      { endless: true, seed: SEED, maxWaves: WAVE_CAP });
    check('endless-selection-effect', s.wavesCleared < q.wavesCleared,
      'quiet w' + q.wavesCleared + '/' + q.goldEarned + 'g vs spirited w' +
      s.wavesCleared + '/' + s.goldEarned + 'g (spirited must run shallower)');
  }

  // 7g2. The early-call bonus is KEPT in endless and deliberately opposes
  // interest (D9). Exercises the callEarly arm: calling every wave the moment
  // it can be called must pay bonuses the auto-send arm never sees, and must
  // trade away interest accrual to do it. C-3 measures whether either pole
  // dominates; this only proves the tension is wired and live.
  {
    const early = runScripted(endlessMap, 'quiet', 'balanced',
      { endless: true, seed: SEED, maxWaves: 15, callEarly: true });
    const waited = runScripted(endlessMap, 'quiet', 'balanced',
      { endless: true, seed: SEED, maxWaves: 15 });
    check('endless-early-call-tension',
      early.interestEarned < waited.interestEarned && early.simSec < waited.simSec,
      'call-early ' + early.interestEarned + 'g interest in ' + early.simSec + 's vs ' +
      'wait-out ' + waited.interestEarned + 'g in ' + waited.simSec + 's (same 15 waves)');
  }

  // 7h. Interest non-degeneracy — measured on the WAITING arm (endless prep
  // auto-sends, so the default scripted run forfeits every early-call bonus
  // and accrues the maximum interest available; that is the worst case the
  // bound has to hold against).
  {
    let worstShare = 0, worstBuild = '', worstEarned = 0;
    for (const build of SimCore.BUILDS) {
      const r = endlessRuns[build];
      // goldEarned is cumulative TOTAL income, interest included — the
      // brief's denominator. The share of non-interest income is reported
      // alongside so the stricter reading is visible without being asserted.
      const share = r.interestEarned / Math.max(1, r.goldEarned);
      if (share > worstShare) { worstShare = share; worstBuild = build; worstEarned = r.interestEarned; }
    }
    const worstRun = endlessRuns[worstBuild];
    const exInterest = worstEarned / Math.max(1, worstRun.goldEarned - worstEarned);
    check('endless-interest-bound', worstShare < INTEREST_MAX_SHARE,
      'worst ' + worstBuild + ' ' + (worstShare * 100).toFixed(1) + '% of total income (<' +
      (INTEREST_MAX_SHARE * 100) + '% required); ' + (exInterest * 100).toFixed(1) + '% of earned-other');
  }

  // 7i. Endless curve CSV — the artifact the next tuning pass starts from,
  // written alongside (never over) the six campaign curves.
  {
    const rows = ['wave,isBoss,spawnCount,hpScale,bountyScale,waveHpQuiet,reward'];
    const quiet = E.mergedDifficulty('quiet', endlessMap.difficultyOverrides, Endless.SCALARS);
    for (let i = 0; i < WAVE_CAP; i++) {
      const w = Endless.waveFor(i, SEED);
      const stats = SimCore.waveStats(w, quiet.hpMult * Endless.hpScale(i));
      rows.push([i + 1, w.isBoss, Endless.effectiveSpawnCount(w, E.ENEMIES),
        Endless.hpScale(i).toFixed(3), Endless.bountyScale(i).toFixed(3),
        stats.hp, w.reward].join(','));
    }
    fs.writeFileSync(path.join(curvesDir, 'endless-plains-quiet.csv'), rows.join('\n') + '\n');
    console.log('endless curve CSV written to ' +
      path.relative(process.cwd(), path.join(curvesDir, 'endless-plains-quiet.csv')));
  }
}

// ─── Summary ─────────────────────────────────────────────────
const failed = checks.filter(c => c.status === 'FAIL');
const knownFailed = checks.filter(c => c.status === 'KNOWN-FAIL');
const passed = checks.filter(c => c.status === 'PASS');
for (const id of staleKnown) {
  warn('stale KNOWN_FAILS entry now passing — remove it so future regressions fail loudly: ' + id);
}
console.log('\n' + passed.length + ' pass, ' + failed.length + ' fail, ' + knownFailed.length + ' known-fail' +
  (knownFailed.length ? ' (documented, excluded from acceptance)' : ''));
if (failed.length === 0) {
  console.log('ACCEPTANCE: ALL PASS');
  process.exit(0);
} else {
  console.log('ACCEPTANCE: FAIL');
  process.exit(1);
}
