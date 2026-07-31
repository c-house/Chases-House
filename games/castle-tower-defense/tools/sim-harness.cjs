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
// findings. All cleared by CH-3's content wiring + D2 retune, 2026-07-23.
// ADR-040 W8-1 registered one more — `content-reachable:drake`, red only for
// the one commit between the type landing and its waves landing. Cleared here
// by the wave rewrite, which is that entry's stated owner.)

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

// ─── 6b. Campaign spawn ceiling (ADR-040 D33) ────────────────
// The campaign side of level-design rule W8. Endless has had `endless-spawn-
// bound` since ADR-037; the campaign has never had one, and its only guard was
// the W8 estimator inside tools/map-editor.html's validate() — browser-only,
// and therefore unrunnable from here.
//
// This measures TOTAL EFFECTIVE SPAWNS per wave (split children walked), the
// same quantity `endless-spawn-bound` measures, NOT peak concurrency — the two
// differ by roughly 1.9x on this content and must not be conflated.
//
// It found real content: before the ADR-040 rewrite, forest w8 stood at 38
// (shielded 6 + runner 10 + skirmisher 6 + heavy 4 + slime 4 -> 12 bodies),
// i.e. the campaign was ABOVE its own ceiling and had been since ADR-036 CH-3.
// That is why this check could not land before the wave rewrite.
//
// The 35 is hard-coded HERE for the reason the endless check states: a
// threshold imported from the module under test can be raised by the same edit
// that breaks it.
{
  const W8_CEILING = 35;
  for (const map of maps) {
    let peak = 0, peakWave = 0;
    map.waves.forEach((w, i) => {
      const n = Endless.effectiveSpawnCount(w, E.ENEMIES);
      if (n > peak) { peak = n; peakWave = i + 1; }
    });
    check('campaign-spawn-bound:' + map.id, peak <= W8_CEILING,
      'peak ' + peak + ' effective spawns (wave ' + peakWave + ') vs W8 ceiling ' + W8_CEILING);
  }
}

// ─── 6c. Campaign rebuild gap (ADR-040 D28) ──────────────────
// Every wave must contain at least one >=3.5s pause with no spawns — the
// mid-wave breath the re-imagining introduced, and the editor rule W2 the
// campaign failed on 37 of 48 waves before it.
//
// This is guarded because it ships at ZERO margin: `delay` values are
// hand-written literals laid out as (previous group's last spawn + 3500), so
// all 96 group boundaries in the campaign sit at exactly 3500ms. Changing any
// group's `count` or `spacing` without also moving every later group's delay
// silently closes the gap — e.g. plains w6 shielded 5->6 pushes that group's
// tail 1150ms later and drops the next boundary to 2350ms, under BOTH this
// rule and the editor's own 3000ms floor. Without this check that reverts with
// a fully green harness, and only a browser session would ever notice.
//
// This asserts D28's rule, which is STRICTLY STRONGER than the editor's W2 and
// is the one that can silently rot. W2 warns only when a wave has NO gap of
// >=3000ms anywhere, so on a three-group wave one closed boundary still passes
// it — the plains w6 mutation above drops boundary 1 to 2350ms while boundary 2
// stays at 3500, and W2 is satisfied. D28 says EVERY group boundary leaves the
// gap, so that is what is measured here: per-boundary, not the wave's maximum.
//
// Same shape as the ceiling check above: the threshold is hard-coded here, not
// read from the data under test. Single-group waves have no boundary and are
// exempt (plains w1 is one footman).
{
  const MIN_GAP_MS = 3500;
  for (const map of maps) {
    const tight = [];
    map.waves.forEach((w, i) => {
      const groups = w.enemies.slice().sort((a, b) => (a.delay || 0) - (b.delay || 0));
      for (let k = 1; k < groups.length; k++) {
        const prev = groups[k - 1];
        const tail = (prev.delay || 0) + Math.max(0, prev.count - 1) * (prev.spacing || 0);
        const gap = (groups[k].delay || 0) - tail;
        if (gap < MIN_GAP_MS) {
          tight.push('w' + (i + 1) + ' ' + prev.type + '->' + groups[k].type + ' ' + gap + 'ms');
        }
      }
    });
    check('campaign-rebuild-gap:' + map.id, tight.length === 0,
      tight.length ? tight.join(', ')
        : map.waves.length + ' waves, every group boundary >=' + MIN_GAP_MS + 'ms');
  }
}

// ─── 6d. Figure-ground anchor rule (ADR-040 D28, promoted here) ──
// ADR-040 recorded this as prose and said so: "the ratio is hand-measured prose,
// and a later composition edit that pushes Tidewater w8 to 32% would fail
// nothing." This is that check. The threshold, the type set and the slot list
// live in ONE place — SimCore.ANCHOR_RULE — which also carries the three ways
// this rule is routinely misread and names ADR-041 D41 as the owner of its
// relaxation.
{
  const ANCHOR_RULE = SimCore.ANCHOR_RULE;
  const perType = SimCore.waveStatsByType;
  const anchorRows = [];
  for (const map of maps) {
    const violations = [];
    let measured = 0;
    for (const slot of ANCHOR_RULE.SLOTS) {
      const wave = map.waves[slot - 1];
      if (!wave) continue;
      const { bodies, hp } = perType(wave, 1.0);
      measured++;
      const totalBodies = Object.values(bodies).reduce((s, v) => s + v, 0);
      const lowBodies = ANCHOR_RULE.TYPES.reduce((s, t) => s + (bodies[t] || 0), 0);
      const share = totalBodies ? lowBodies / totalBodies : 0;
      // HP lead is per TYPE, and the low-contrast types are summed for the share
      // but compared individually for the lead — a wave whose largest single HP
      // contributor is a low-contrast type is the failure ADR-040 hit on its
      // first draft (Snowfall w8 with 14 ghosts leading by both measures).
      // Ties resolve TOWARD the low-contrast type: with a strict `>` the winner
      // of a tie is whichever group the author happened to list first, so the
      // same composition could pass or fail on ordering alone.
      let leadType = null, leadHp = -1;
      for (const [t, v] of Object.entries(hp)) {
        if (v > leadHp || (v === leadHp && ANCHOR_RULE.TYPES.includes(t))) { leadHp = v; leadType = t; }
      }
      const leadIsLow = ANCHOR_RULE.TYPES.includes(leadType);
      const ratioStr = lowBodies + '/' + totalBodies;
      anchorRows.push(map.id + ' w' + slot + ': ' + ratioStr +
        ' = ' + (share * 100).toFixed(1) + '%, HP lead ' + leadType);
      if (share > ANCHOR_RULE.MAX_SHARE) {
        violations.push('w' + slot + ' low-contrast ' + ratioStr +
          ' = ' + (share * 100).toFixed(1) + '% > ' + (ANCHOR_RULE.MAX_SHARE * 100).toFixed(1) + '%');
      }
      if (leadIsLow) {
        violations.push('w' + slot + ' HP lead is low-contrast type "' + leadType + '"');
      }
    }
    // `measured` guards against a vacuous pass: a map missing both slots would
    // otherwise report "within 30% and not HP-led" having checked nothing.
    check('anchor-ratio:' + map.id, violations.length === 0 && measured === ANCHOR_RULE.SLOTS.length,
      violations.length ? violations.join('; ')
        : measured !== ANCHOR_RULE.SLOTS.length
          ? 'only ' + measured + ' of ' + ANCHOR_RULE.SLOTS.length + ' anchor slots exist on this map'
          : measured + ' anchor slots within ' + (ANCHOR_RULE.MAX_SHARE * 100).toFixed(0) + '% and not HP-led');
  }
  // ADR-040's twelve-anchor table, reproduced from live data as the acceptance
  // evidence that this check measures what that table measured.
  console.log('      anchors: ' + anchorRows.join(' | '));
  // The two anchors that genuinely exercise the threshold (ADR-040 records that
  // the other ten are 0% by construction). Pinned as regression fixtures so a
  // composition edit that moves them shows up as a named failure rather than as
  // a silently different percentage inside a still-passing ratio check.
  // Pinned as the RATIO, not the rounded percent: 6/25 and 7/29 are both "24%",
  // so a percent fixture would let tidewater w8 gain four bodies including a
  // low-contrast one and still pass.
  {
    const lastSlot = ANCHOR_RULE.SLOTS[ANCHOR_RULE.SLOTS.length - 1];
    const exercised = { tidewater: '6/25', snowfall_pass: '5/20' };
    const drift = [];
    for (const [mapId, expectRatio] of Object.entries(exercised)) {
      const row = anchorRows.find(r => r.startsWith(mapId + ' w' + lastSlot + ':'));
      const got = row && row.match(/: (\d+\/\d+) =/);
      const ratio = got ? got[1] : '(no w' + lastSlot + ' row)';
      if (ratio !== expectRatio) {
        drift.push(mapId + ' w' + lastSlot + ' ' + ratio + ' (ADR-040 recorded ' + expectRatio + ')');
      }
    }
    check('anchor-exercised-fixtures', drift.length === 0,
      drift.length ? drift.join(', ')
        : 'tidewater w8 6/25, snowfall_pass w8 5/20 — unchanged since ADR-040');
  }
}


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

  // ─── T-1 calibration coverage (ADR-038 T-1) ────────────────
  // The pre-T-1 endless checks all measured plains / quiet / seed 7 — one map,
  // one difficulty, one seed. T-1 widens the run-based ones to a real matrix.
  //
  // WHY MAPS BELONG ON THE RUN AXIS BUT NOT ON THE CSV AXIS. `waveFor(i, seed)`
  // takes no map, and no official map defines `difficultyOverrides` (verified:
  // zero occurrences in maps.js), so endless *curve* content varies only by
  // seed and difficulty — different maps at one seed emit byte-identical rows,
  // which is why the CSVs below are per seed × difficulty and not per map.
  // Runs are different: they depend on the map through its path and its build
  // slots, so every run-based assertion ranges over maps as well.
  // Derived from listOfficial() rather than hardcoded, so a seventh official map
  // is covered by every endless assertion on the day it lands instead of being
  // silently excluded — which is how the neighbouring campaign sections iterate.
  const CAL_MAPS = maps.map(m => m.id);
  const CAL_SEEDS = [7, 101, 2029];
  const CAL_DIFFS = ['quiet', 'spirited'];

  // Calibrated targets. Held HERE rather than read from endless.js, for the
  // reason `endless-spawn-bound` already states: a threshold imported from the
  // module under test can be raised by the same edit that breaks it.
  const SURVIVAL_MIN = 15, SURVIVAL_MAX = 35;   // waves, balanced build
  const DURATION_MIN = 600, DURATION_MAX = 1800; // sim-seconds, balanced build
  const DOMINANCE_MARGIN = 0.15;                 // bank / call-early vs balanced
  const BANK_MIN_WAVES = 10;                     // non-vacuity floor for the bank arm
  const BUILD_SEPARATION_MIN = 3;                // waves between best and worst build
  const SATURATION_MIN_WAVE = 5;                 // the build phase must last this long

  // Every endless tunable, pinned. This is the regression lock the CSVs and the
  // outcome bands do NOT provide: the bands are wide enough that BOUNTY_GAP,
  // INTEREST_RATE, BUY_LIFE_GROWTH and both SCALARS can move without turning a
  // single check red, and three of those move no CSV byte either (the CSV
  // columns are functions of the HP/bounty/reward curve alone). Measured by
  // mutation, not assumed.
  //
  // This check is not a quality judgement — it asserts only that a change to a
  // calibrated constant is DELIBERATE. Recalibrating means editing this pin in
  // the same commit, which is the ADR-041 D37 pattern: change a documented
  // constant rather than silently drift past an unattributed check.
  const CALIBRATED_CONSTANTS = {
    ENDLESS_GROWTH: 1.15, BOUNTY_GAP: 1.07,
    INTEREST_RATE: 0.02, INTEREST_PERIOD_MS: 15000, INTEREST_CAP: 50,
    BUY_LIFE_BASE: 100, BUY_LIFE_GROWTH: 1.5,
    BOSS_CADENCE: 10, FIXED_OPENING: 5,
    BASE_REWARD: 20, BOSS_REWARD: 70
  };

  // One matrix, computed once, read by every widened/new check below.
  const matrix = [];
  for (const mapId of CAL_MAPS) {
    const m = Maps.byId(mapId);
    for (const seed of CAL_SEEDS) {
      for (const difficulty of CAL_DIFFS) {
        const runs = {};
        for (const build of SimCore.BUILDS) {
          runs[build] = runScripted(m, difficulty, build,
            { endless: true, seed, maxWaves: WAVE_CAP });
        }
        matrix.push({ mapId, seed, difficulty, runs });
      }
    }
  }
  const cell = (mapId, seed, difficulty) =>
    matrix.find(c => c.mapId === mapId && c.seed === seed && c.difficulty === difficulty);
  console.log('endless calibration matrix: ' + CAL_MAPS.length + ' maps x ' +
    CAL_SEEDS.length + ' seeds x ' + CAL_DIFFS.length + ' difficulties x ' +
    SimCore.BUILDS.length + ' builds = ' + (matrix.length * SimCore.BUILDS.length) + ' runs');

  // 7e0. Calibrated constants are pinned (T-1). See CALIBRATED_CONSTANTS above
  // for why the outcome bands and the CSVs do not cover this on their own.
  {
    const drift = [];
    for (const [k, v] of Object.entries(CALIBRATED_CONSTANTS)) {
      if (Endless[k] !== v) drift.push(k + ' ' + v + '→' + Endless[k]);
    }
    // SCALARS is an object, so it is compared field-wise rather than by identity.
    if (Endless.SCALARS.startGoldMult !== 1.25) {
      drift.push('SCALARS.startGoldMult 1.25→' + Endless.SCALARS.startGoldMult);
    }
    if (Endless.SCALARS.startLivesMult !== 1.0) {
      drift.push('SCALARS.startLivesMult 1→' + Endless.SCALARS.startLivesMult);
    }
    check('endless-constants-pinned', drift.length === 0,
      drift.length ? 'UNPINNED DRIFT: ' + drift.join(', ') +
                     ' — recalibrating means editing CALIBRATED_CONSTANTS in this file too'
                   : (Object.keys(CALIBRATED_CONSTANTS).length + 2) + ' tunables at their calibrated values');
  }

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
  // mode is a slot machine. WIDENED by T-1 from plains/quiet/seed 7 to the
  // whole matrix: the worst pair now governs, not the one that was measured.
  {
    let worstSpread = Infinity, where = '', detail = '';
    for (const c of matrix) {
      const d = SimCore.BUILDS.map(b => c.runs[b].wavesCleared);
      const sp = Math.max.apply(null, d) - Math.min.apply(null, d);
      if (sp < worstSpread) {
        worstSpread = sp;
        where = c.mapId + '/' + c.difficulty + '/seed' + c.seed;
        detail = d.join('/');
      }
    }
    check('endless-build-separation', worstSpread >= BUILD_SEPARATION_MIN,
      'worst pair ' + where + ' depths ' + detail + ' — spread ' + worstSpread +
      ' waves (>=' + BUILD_SEPARATION_MIN + ' required) across ' + matrix.length + ' map/seed/difficulty cells');
  }

  // 7f2. NEW (T-1). Survival band — the calibrated run depth, in waves.
  //
  // SCOPED TO THE BALANCED BUILD, deliberately. The band describes a competent
  // player and the two naive arms are not that: across this matrix they run
  // 12-19 waves on quiet and as low as 10 on spirited, so 30 of the 72 naive
  // runs are BELOW the band's floor. An unscoped band would fail on arms it was
  // never chosen for — it would have to be widened until it asserted nothing.
  // Measured: balanced 22-26 quiet, 19-21 spirited — inside 15-35 on both.
  {
    const bad = [];
    let lo = Infinity, hi = -Infinity;
    for (const c of matrix) {
      const w = c.runs.balanced.wavesCleared;
      lo = Math.min(lo, w); hi = Math.max(hi, w);
      if (w < SURVIVAL_MIN || w > SURVIVAL_MAX) {
        bad.push(c.mapId + '/' + c.difficulty + '/seed' + c.seed + ' w' + w);
      }
    }
    check('endless-survival-band', bad.length === 0,
      'balanced ' + lo + '-' + hi + ' waves across ' + matrix.length + ' cells (band ' +
      SURVIVAL_MIN + '-' + SURVIVAL_MAX + ')' + (bad.length ? ' — OUT: ' + bad.join(', ') : ''));
  }

  // 7f3. NEW (T-1). Duration band, in SIM-SECONDS — what the wave band was only
  // ever a proxy for (ADR-038 §2.1: "short enough that a run is one sitting").
  //
  // ALSO SCOPED TO BALANCED, and the reason is worth stating correctly because
  // the obvious one is backwards. On plains/quiet/seed 7 alone the naive arms
  // run ~670s, which sits inside 600-1800 and looks like a vacuous pass. Across
  // the full matrix they run 375-744s, so 38 of 72 naive runs are BELOW the
  // floor: unscoped, this band would fail loudly on arms it was never chosen to
  // describe. Either way it must be scoped to the arm it was picked to bracket.
  // Measured: balanced 926-1185s quiet, 795-919s spirited (13.3-19.75 min).
  {
    const bad = [];
    let lo = Infinity, hi = -Infinity;
    for (const c of matrix) {
      const s = c.runs.balanced.simSec;
      lo = Math.min(lo, s); hi = Math.max(hi, s);
      if (s < DURATION_MIN || s > DURATION_MAX) {
        bad.push(c.mapId + '/' + c.difficulty + '/seed' + c.seed + ' ' + s + 's');
      }
    }
    check('endless-duration-band', bad.length === 0,
      'balanced ' + lo + '-' + hi + 's across ' + matrix.length + ' cells (band ' +
      DURATION_MIN + '-' + DURATION_MAX + 's = ' + (DURATION_MIN / 60) + '-' + (DURATION_MAX / 60) +
      ' min)' + (bad.length ? ' — OUT: ' + bad.join(', ') : ''));
  }

  // 7f4. NEW (T-1). No dominant strategy — neither an always-bank nor an
  // always-call-early policy may run more than 15% deeper than the balanced
  // one (the figure ADR-037 C-3 named, carried forward by ADR-038 §7 T-1).
  //
  // Both poles run the BALANCED composition, so this isolates the economic
  // decision from the build decision.
  //
  // ═══ READ THIS BEFORE TRUSTING A PASS HERE ═══════════════════════════════
  // THIS CHECK HAS NO POWER OVER THE INTEREST CONSTANTS TODAY, and saying so is
  // the honest form of the result. `endless-build-saturation` below measures
  // why: the balanced build stops spending at wave 8-10 and then plays 9-17
  // further waves with a full board and maxed tiers, spending only 11-21% of
  // its lifetime income. After saturation there is nothing left to buy, so run
  // depth is a function of the HP curve against a frozen board and is causally
  // disconnected from every gold constant.
  //
  // Demonstrated rather than reasoned: patched to INTEREST_RATE 0.20 with the
  // cap removed, the banking arm accrues ~263,000,000 gold and still returns a
  // +0.0% margin, because it spends the identical 1,885g the balanced build
  // does. Adding the game's only late gold sink does not rescue it either — an
  // arm that converts its hoard into purchased lives also measures +0.0%, since
  // at wave-26 HP a maxed board leaks whole waves and a dozen bought lives buy
  // well under one extra wave.
  //
  // So a PASS here means "no dominance was observable", NOT "no dominance
  // exists". The check is kept because it is T-1's named acceptance criterion,
  // because it is the falsifiable record of that limitation, and because it
  // regains power the moment endless gains a late-game gold sink — which is
  // exactly what ADR-038 D20's tower-depth work would add. The guard against
  // the interest degeneracy is `endless-interest-bound`, which does fire
  // (measured: 45.7% uncapped, 40.5% at a 5s period, both FAIL).
  // ═════════════════════════════════════════════════════════════════════════
  //
  // The non-vacuity clause stays regardless: an always-bank arm that never
  // builds dies at wave 1-2 and satisfies "no deeper than balanced" trivially —
  // measured, with a naive "skip the policy under a floor" construction every
  // floor >= endless start gold collapsed to 2 waves. It does not fire against
  // the current opts.bank, which builds unrestricted while any slot is empty;
  // it is coverage against a future rewrite of that arm.
  //
  // Three reserve floors are swept rather than one, because the strongest
  // banking strategy is not known a priori: 300 (light), 1500, and the
  // saturation bank INTEREST_CAP/INTEREST_RATE where interest goes flat. Only
  // the lightest ever sets `worstBank` — the two hoarding floors measure
  // strictly worse (-20.8% to -73.7%) and appear in the detail string only.
  // That third floor reads two values from the module under test, which the
  // threshold policy above forbids; it is a PROBE POINT rather than a
  // threshold, and the consequence of it moving is a weaker arm, never a
  // weaker bar.
  {
    const FLOORS = [300, 1500,
      (Endless.INTEREST_CAP != null && Endless.INTEREST_RATE > 0)
        ? Math.round(Endless.INTEREST_CAP / Endless.INTEREST_RATE) : 2500];
    let worstBank = -Infinity, wbWhere = '', worstEarly = -Infinity, weWhere = '';
    let vacuous = [];
    for (const c of matrix) {
      const base = c.runs.balanced.wavesCleared;
      const opts = { endless: true, seed: c.seed, maxWaves: WAVE_CAP };
      const map = Maps.byId(c.mapId);
      for (const f of FLOORS) {
        const r = runScripted(map, c.difficulty, 'balanced', Object.assign({ bank: f }, opts));
        const margin = (r.wavesCleared - base) / base;
        if (margin > worstBank) {
          worstBank = margin;
          wbWhere = c.mapId + '/' + c.difficulty + '/seed' + c.seed + ' floor' + f +
                    ' w' + r.wavesCleared + ' vs balanced w' + base;
        }
        // Non-vacuity: the arm must have played. Only the LIGHTEST floor is
        // required to clear the bar — a full hoard is *supposed* to be bad, and
        // demanding depth from it would assert the degeneracy is survivable.
        if (f === FLOORS[0] && (r.towersStanding === 0 || r.wavesCleared < BANK_MIN_WAVES)) {
          vacuous.push(c.mapId + '/' + c.difficulty + '/seed' + c.seed +
                       ' towers ' + r.towersStanding + ' w' + r.wavesCleared);
        }
      }
      const e = runScripted(map, c.difficulty, 'balanced', Object.assign({ callEarly: true }, opts));
      const em = (e.wavesCleared - base) / base;
      if (em > worstEarly) {
        worstEarly = em;
        weWhere = c.mapId + '/' + c.difficulty + '/seed' + c.seed +
                  ' w' + e.wavesCleared + ' vs balanced w' + base;
      }
    }
    check('endless-dominance-margin',
      vacuous.length === 0 && worstBank <= DOMINANCE_MARGIN && worstEarly <= DOMINANCE_MARGIN,
      'always-bank worst +' + (worstBank * 100).toFixed(1) + '% (' + wbWhere + '); ' +
      'call-early worst +' + (worstEarly * 100).toFixed(1) + '% (' + weWhere + '); ' +
      'limit +' + (DOMINANCE_MARGIN * 100) + '%' +
      (vacuous.length ? ' — VACUOUS bank arm (built nothing or died before wave ' +
        BANK_MIN_WAVES + '): ' + vacuous.join(', ')
       : '; bank arm non-vacuous on all ' + matrix.length + ' cells'));
  }

  // 7f5. NEW (T-1). Build saturation — the wave index after which the balanced
  // build has nothing left to buy. This is ADR-038 **D20's** named scope input
  // ("identify the wave index beyond which marginal build decisions stop
  // changing run depth"), which T-1 owes cycle 4's tower-depth adjudication.
  //
  // Measured across all 36 cells: saturation at wave **8-10**, followed by
  // **9-17 idle waves**, with only **11.2-21.3%** of lifetime income ever
  // spent. A 26-wave run therefore contains roughly nine waves of economy and
  // seventeen of watching — which is the strongest evidence this project has
  // produced for D20, and the direct cause of endless-dominance-margin having
  // no economic power (see its note above).
  //
  // ASSERTED IN THE DIRECTION THAT CAN ACTUALLY BREAK: the build phase must
  // last at least SATURATION_MIN_WAVE waves. A change that let the board fill
  // and max out almost immediately — a large SCALARS.startGoldMult, a cheaper
  // tier ladder — would erase the opening's decisions entirely, and nothing
  // else in this file would notice. The idle-wave count is REPORTED, not
  // bounded: it is today's finding, not today's requirement, and bounding it
  // would assert that a known design gap must persist.
  {
    let worstSat = Infinity, where = '', maxIdle = 0, minSpend = 1, maxSpend = 0;
    let loSat = Infinity, hiSat = 0;
    for (const c of matrix) {
      const r = c.runs.balanced;
      const sat = r.lastSpendWave;
      loSat = Math.min(loSat, sat); hiSat = Math.max(hiSat, sat);
      if (sat < worstSat) { worstSat = sat; where = c.mapId + '/' + c.difficulty + '/seed' + c.seed; }
      maxIdle = Math.max(maxIdle, r.wavesCleared - sat);
      const frac = r.goldSpent / Math.max(1, r.goldEarned);
      minSpend = Math.min(minSpend, frac); maxSpend = Math.max(maxSpend, frac);
    }
    check('endless-build-saturation', worstSat >= SATURATION_MIN_WAVE,
      'balanced stops spending at wave ' + loSat + '-' + hiSat + ' (>=' + SATURATION_MIN_WAVE +
      ' required; earliest ' + where + '); up to ' + maxIdle + ' idle waves after it; ' +
      (minSpend * 100).toFixed(1) + '-' + (maxSpend * 100).toFixed(1) +
      '% of lifetime income ever spent — ADR-038 D20 scope input');
  }

  // 7g. Selection→effect (ADR-036 D6, mandatory for a new selectable mode).
  // Directional, like every sibling difficulty check in this file: "merely
  // different" would pass an inverted scalar that made spirited the easy one.
  // WIDENED by T-1 from one map/seed to every map × seed.
  {
    const bad = [];
    for (const mapId of CAL_MAPS) for (const seed of CAL_SEEDS) {
      const q = cell(mapId, seed, 'quiet').runs.balanced;
      const s = cell(mapId, seed, 'spirited').runs.balanced;
      if (!(s.wavesCleared < q.wavesCleared)) {
        bad.push(mapId + '/seed' + seed + ' quiet w' + q.wavesCleared +
                 ' vs spirited w' + s.wavesCleared);
      }
    }
    check('endless-selection-effect', bad.length === 0,
      (CAL_MAPS.length * CAL_SEEDS.length) + ' map/seed pairs, spirited must run shallower' +
      (bad.length ? ' — NOT SHALLOWER: ' + bad.join(', ') : ' — all pairs directional'));
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
  // WIDENED by T-1 from plains/quiet/seed 7 to the whole matrix. This is the
  // check the INTEREST_CAP-versus-lower-rate decision was settled against:
  // measured worst share is 16.7% with the cap, 45.7% uncapped at the same
  // rate (a breach), and 25.0% at half the rate uncapped. See endless.js.
  {
    let worstShare = 0, worstWhere = '', worstEarned = 0, worstRun = null;
    for (const c of matrix) {
      for (const build of SimCore.BUILDS) {
        const r = c.runs[build];
        // goldEarned is cumulative TOTAL income, interest included — the
        // brief's denominator. The share of non-interest income is reported
        // alongside so the stricter reading is visible without being asserted.
        const share = r.interestEarned / Math.max(1, r.goldEarned);
        if (share > worstShare) {
          worstShare = share; worstEarned = r.interestEarned; worstRun = r;
          worstWhere = build + ' @ ' + c.mapId + '/' + c.difficulty + '/seed' + c.seed;
        }
      }
    }
    // worstRun stays null when no run earned any interest at all (rate 0, or a
    // cap of 0). That is a legitimate configuration and must report a check
    // rather than die with a TypeError inside the detail string.
    const exInterest = worstRun
      ? worstEarned / Math.max(1, worstRun.goldEarned - worstEarned) : 0;
    check('endless-interest-bound', worstShare < INTEREST_MAX_SHARE,
      'worst ' + (worstWhere || 'no run earned interest') + ' ' +
      (worstShare * 100).toFixed(1) + '% of total income (<' +
      (INTEREST_MAX_SHARE * 100) + '% required); ' + (exInterest * 100).toFixed(1) +
      '% of earned-other; across ' + (matrix.length * SimCore.BUILDS.length) + ' runs');
  }

  // 7i. Endless curve CSVs — the artifact the next tuning pass starts from,
  // written alongside (never over) the six campaign curves.
  //
  // T-1 widens this from one file to a per-seed × per-difficulty SET, and the
  // axis choice is deliberate: `waveFor(i, seed)` takes no map and no official
  // map defines `difficultyOverrides`, so two different maps at one seed emit
  // byte-identical rows. A per-MAP set would be six copies of the same file
  // wearing different names. Seed and difficulty are the axes that actually
  // move the content, so those are the axes the files carry.
  //
  // These CSVs are also the tightest regression lock in this section: the
  // survival and duration bands catch gross drift, but any change to
  // ENDLESS_GROWTH, BOUNTY_GAP, BOSS_CADENCE or the reward constants moves
  // these rows byte-for-byte and shows up as a diff.
  {
    const emit = (file, seed, difficulty) => {
      const rows = ['seed,difficulty,wave,isBoss,spawnCount,hpScale,bountyScale,waveHp,reward'];
      const d = E.mergedDifficulty(difficulty, endlessMap.difficultyOverrides, Endless.SCALARS);
      for (let i = 0; i < WAVE_CAP; i++) {
        const w = Endless.waveFor(i, seed);
        const stats = SimCore.waveStats(w, d.hpMult * Endless.hpScale(i));
        rows.push([seed, difficulty, i + 1, w.isBoss, Endless.effectiveSpawnCount(w, E.ENEMIES),
          Endless.hpScale(i).toFixed(3), Endless.bountyScale(i).toFixed(3),
          stats.hp, w.reward].join(','));
      }
      fs.writeFileSync(path.join(curvesDir, file), rows.join('\n') + '\n');
      return file;
    };
    const written = [];
    for (const seed of CAL_SEEDS) for (const difficulty of CAL_DIFFS) {
      written.push(emit('endless-seed' + seed + '-' + difficulty + '.csv', seed, difficulty));
    }

    // The legacy file, kept under its historical name and its original column
    // set so its git history stays a continuous series rather than a delete and
    // an add. It is the seed-7/quiet row-set; `endless-seed7-quiet.csv` carries
    // the same waves with the self-describing header.
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
      written.push('endless-plains-quiet.csv');
    }
    console.log('endless curve CSVs written (' + written.length + '): ' + written.join(', '));
  }
}

// ─── Source-level decal guards (ADR-037 sprint-6 H-2) ────────
// scene.js is browser-only ESM (it imports the bare 'three' specifier, which
// resolves only through the page's importmap) and cannot be require()d under
// Node, so these are TEXT assertions over its source. They retire the ground-
// decal burial+leak class the way a renderer test can't: written against the
// actual function signatures, not brittle whole-line matches.
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'scene.js'), 'utf8');

  // Parse GROUND_DECAL_Y's value from source rather than hardcoding 0.24 twice.
  const gdyMatch = src.match(/const\s+GROUND_DECAL_Y\s*=\s*([0-9.]+)/);
  const GDY = gdyMatch ? parseFloat(gdyMatch[1]) : NaN;

  // Each flat-decal factory's default-y token: `y != null ? y : <token>`.
  function factoryDefault(name) {
    const at = src.indexOf('function ' + name + '(');
    if (at < 0) return null;
    const m = src.slice(at, at + 600).match(/y\s*!=\s*null\s*\?\s*y\s*:\s*([A-Za-z0-9_.]+)/);
    return m ? m[1] : null;
  }
  const ringDefault = factoryDefault('makeRing');
  const discDefault = factoryDefault('makeDisc');

  // (1) Both factories default y to the named clearance constant.
  check('decal-default-clearance',
    ringDefault === 'GROUND_DECAL_Y' && discDefault === 'GROUND_DECAL_Y',
    'makeRing->' + ringDefault + ', makeDisc->' + discDefault);

  // (2) No makeRing/makeDisc call site passes a numeric y literal below the
  //     clearance. The 6th positional arg is y; non-numeric args (the constant
  //     itself, or a variable) are legal by (1). Definitions are skipped.
  const buried = [];
  for (const name of ['makeRing', 'makeDisc']) {
    const re = new RegExp(name + '\\(', 'g');
    let mm;
    while ((mm = re.exec(src))) {
      if (src.slice(Math.max(0, mm.index - 9), mm.index) === 'function ') continue; // the def
      const close = src.indexOf(')', mm.index);
      const args = src.slice(mm.index + name.length + 1, close).split(',').map(s => s.trim());
      const y = args[5];
      if (y != null && /^-?\d*\.?\d+$/.test(y) && parseFloat(y) < GDY) buried.push(name + ' y=' + y);
    }
  }
  check('decal-no-buried-literals', Number.isFinite(GDY) && buried.length === 0,
    buried.length ? buried.join('; ') : 'GROUND_DECAL_Y=' + GDY + ', no y-literal below it');

  // (3) The syncDecals rebuild path frees GPU buffers before clear() — the leak
  //     countermeasure H-1 shipped (a dispose pass). Anchor between the function
  //     header and its first decalsGroup.clear().
  const syncAt = src.indexOf('function syncDecals(');
  const clearAt = src.indexOf('decalsGroup.clear()', syncAt);
  const prelude = (syncAt >= 0 && clearAt > syncAt) ? src.slice(syncAt, clearAt) : '';
  check('decal-dispose-present', /\.dispose\s*\(/.test(prelude),
    'dispose() between syncDecals header and clear()');
}

// ─── Source-level skinned-enemy lifecycle guards (ADR-039 D27) ─
// Same technique and same reason as the decal guards above: scene.js/assets.js
// are browser-only ESM and cannot be require()d under Node, so these are TEXT
// assertions. They exist because skinned+animated enemies introduced a leak
// surface (a mixer and N per-instance skeletons per live enemy) AND a mirror-
// image trap that is WORSE than the leak — disposing the geometry/materials that
// clones share with the CTD3Assets cache would corrupt every future spawn. Both
// directions are guarded, so neither can be "fixed" into the other.
{
  const src = fs.readFileSync(path.join(__dirname, '..', 'scene.js'), 'utf8');
  const asrc = fs.readFileSync(path.join(__dirname, '..', 'assets.js'), 'utf8');

  // Body of a top-level function: from its header to the next line-start `}`.
  function bodyOf(source, header) {
    const at = source.indexOf(header);
    if (at < 0) return '';
    const end = source.indexOf('\n}', at);
    return end > at ? source.slice(at, end) : source.slice(at);
  }

  const disposeBody = bodyOf(src, 'function disposeEnemyNode(');

  // (1) The disposal helper exists and frees all three per-instance resources:
  //     the mixer (UNCACHED from its root, not merely dropped — the mixer keeps
  //     an internal binding cache keyed by root), the per-instance skeletons
  //     SkeletonUtils.clone creates, and any per-instance cloned materials.
  const hasUncache  = /uncacheRoot\s*\(/.test(disposeBody);
  const hasSkeleton = /skeleton[\s\S]{0,80}?\.dispose\s*\(|sk\s*\.\s*dispose\s*\(/.test(disposeBody);
  // Assert the actual dispose CALL, not the mere mention of the field. A bare
  // /ownedMaterials/ test false-PASSES on a leftover comment such as
  // "// TODO: ownedMaterials cleanup moved elsewhere" — demonstrated, so the
  // ghost-material leak ADR-039 D27 names could return with the guard green.
  const hasOwnedMat = /for\s*\(\s*const\s+m\s+of\s+ud\.ownedMaterials\s*\)[\s\S]{0,60}?m\.dispose\s*\(/.test(disposeBody);
  check('enemy-dispose-complete',
    !!disposeBody && hasUncache && hasSkeleton && hasOwnedMat,
    disposeBody
      ? 'mixer.uncacheRoot=' + hasUncache + ', skeleton.dispose=' + hasSkeleton + ', ownedMaterials=' + hasOwnedMat
      : 'disposeEnemyNode() not found');

  // (2) INVERSE guard — the helper must NOT dispose geometry or a mesh's
  //     material, because getMesh clones share both by reference with the
  //     assets cache. A future session "completing" the disposal by adding
  //     o.geometry.dispose() would blank every later spawn of that type; this
  //     fails loudly instead. (The ownedMaterials loop disposes materials WE
  //     cloned, via a local — that is why the pattern is `.material.dispose`
  //     and `geometry.dispose` specifically, not any dispose call.)
  const disposesShared = /geometry\s*\.\s*dispose\s*\(/.test(disposeBody) ||
                         /\.\s*material\s*\.\s*dispose\s*\(/.test(disposeBody);
  check('enemy-no-shared-dispose', !!disposeBody && !disposesShared,
    disposesShared
      ? 'disposeEnemyNode disposes cache-SHARED geometry/material — corrupts future spawns'
      : 'no geometry/material dispose on the shared-clone path');

  // (3) BOTH teardown sites call it. Sprint 6's decal leak was one site fixed
  //     when two needed it; this asserts the pair rather than trusting memory.
  const clearBody = bodyOf(src, 'function clearPlayfield(');
  const inClear = /disposeEnemyNode\s*\(/.test(clearBody);
  const despawnAt = src.indexOf('for (const [id, node] of enemyNodes)');
  const deleteAt  = src.indexOf('enemyNodes.delete(', despawnAt);
  const despawn = (despawnAt >= 0 && deleteAt > despawnAt) ? src.slice(despawnAt, deleteAt) : '';
  const inDespawn = /disposeEnemyNode\s*\(/.test(despawn);
  check('enemy-dispose-both-sites', inClear && inDespawn,
    'clearPlayfield=' + inClear + ', syncEnemies despawn loop=' + inDespawn);

  // (4) Skinned assets are cloned with SkeletonUtils, not Object3D.clone.
  //     A plain clone leaves every copy deforming from the source's bones, which
  //     looks like a rigging bug rather than a cloning bug and is easy to
  //     reintroduce by "simplifying" getMesh back to one return path.
  const importsSkelUtils = /SkeletonUtils\.js'/.test(asrc);
  const routesOnSkinned  = /isSkinned\s*\(\s*id\s*\)\s*\?/.test(asrc);
  check('enemy-skinned-clone', importsSkelUtils && routesOnSkinned,
    'SkeletonUtils import=' + importsSkelUtils + ', getMesh routes on isSkinned=' + routesOnSkinned);

  // (5) Clips survive loading. GLTFLoader hands animations back on `gltf`, NOT
  //     on `gltf.scene`, so caching only the scene silently discards every clip
  //     and the mixers animate nothing — a failure that looks like "the models
  //     aren't animated" rather than "the loader dropped them".
  check('enemy-clips-cached', /clipCache\.set\s*\(\s*id\s*,\s*gltf\.animations/.test(asrc),
    'loadOne caches gltf.animations');

  // (6) The animation ADVANCE path. Guards 1-5 all protect the leak shape; none
  //     protected the feature, so every one of these regressions was silent:
  //     dropping the updateEnemyMixers call from sync, or zeroing its dt, stops
  //     all animation with a fully green harness.
  const syncBody = bodyOf(src, 'function sync(state, dtMs)');
  const advBody  = bodyOf(src, 'function updateEnemyMixers(');
  const calledFromSync = /updateEnemyMixers\s*\(\s*dtMs\s*\)/.test(syncBody);
  //     dt must come from the parameter, not a constant: `m.update(0)` or
  //     `m.update(SOME_LITERAL)` freezes every clip while still "updating".
  const advancesWithParamDt = /m\.update\s*\(\s*dtSec\s*\)/.test(advBody) &&
                              /dtSec\s*=[\s\S]{0,160}?dtMs/.test(advBody);
  check('enemy-mixers-advanced', calledFromSync && advancesWithParamDt,
    'sync->updateEnemyMixers(dtMs)=' + calledFromSync + ', advances by param-derived dt=' + advancesWithParamDt);

  // (7) Low power must actually shed the per-frame mixer cost (ADR-039 D27
  //     "Respect low-power mode"). Deleting this one line silently reinstates a
  //     mixer per live enemy on exactly the devices that cannot afford it.
  const lowPowerBody = bodyOf(src, 'function setLowPowerShadows(');
  check('enemy-lowpower-releases-mixers', /releaseAllEnemyMixers\s*\(/.test(lowPowerBody),
    'setLowPowerShadows releases live mixers');

  // (8) Skeleton sharing must key on boneInverses (same SOURCE SKIN), never on
  //     bone identity. Three of the shipped models carry two skins with
  //     byte-identical joint lists but deliberately different inverse bind
  //     matrices (a KHR_mesh_quantization consequence), so a bone-uuid key
  //     collides and rebinds the footman's weapon, the captain's mushroom and
  //     the slime's body onto the wrong bind matrices — visible as a wrong-scale
  //     limb, and easily misread as a bad ENEMY_VIS.scale.
  const shareBody = bodyOf(asrc, 'function shareSkeletons(');
  const keysOnInverses = /boneInverses/.test(shareBody);
  const keysOnBoneUuids = /bones\s*\.\s*map\s*\([\s\S]{0,40}?uuid/.test(shareBody);
  check('enemy-skeleton-share-key', !shareBody || (keysOnInverses && !keysOnBoneUuids),
    shareBody ? ('keys on boneInverses=' + keysOnInverses + ', keys on bone uuids=' + keysOnBoneUuids)
              : 'shareSkeletons absent (per-mesh skeletons — also correct)');

  // (9) ROSTER COVERAGE. Every ENEMIES type must have an ENEMY_VIS entry whose
  //     model is declared in MANIFEST.json and present on disk. Without this, a
  //     new enemy type (or a renamed asset) silently renders a magenta
  //     placeholder that never heals — getMesh caches the placeholder and
  //     syncEnemies builds each node exactly once.
  const entSrc = fs.readFileSync(path.join(__dirname, '..', 'entities.js'), 'utf8');
  const eStart = entSrc.indexOf('const ENEMIES = {');
  const eBody  = eStart < 0 ? '' : entSrc.slice(eStart, entSrc.indexOf('\n  };', eStart));
  const enemyTypes = [...eBody.matchAll(/^\s{4}([a-z_]+):\s*\{/gm)].map(m => m[1]);

  const visStart = src.indexOf('const ENEMY_VIS = {');
  const visBody  = visStart < 0 ? '' : src.slice(visStart, src.indexOf('\n};', visStart));
  const visMap = new Map();
  for (const m of visBody.matchAll(/^\s{2}([a-z_]+):\s*\{[^}]*?model:\s*'([^']+)'[^}]*?moveClip:\s*'([^']+)'/gm)) {
    visMap.set(m[1], { model: m[2], moveClip: m[3] });
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'assets', 'MANIFEST.json'), 'utf8'));
  const manById = new Map(manifest.map(e => [e.id, e.path]));

  const coverageGaps = [];
  for (const t of enemyTypes) {
    const v = visMap.get(t);
    if (!v) { coverageGaps.push(t + ':no-ENEMY_VIS-entry'); continue; }
    const p = manById.get(v.model);
    if (!p) { coverageGaps.push(t + ':' + v.model + '-not-in-manifest'); continue; }
    if (!fs.existsSync(path.join(__dirname, '..', 'assets', p))) coverageGaps.push(t + ':' + p + '-missing-on-disk');
  }
  check('enemy-vis-covers-roster',
    enemyTypes.length > 0 && visMap.size > 0 && coverageGaps.length === 0,
    coverageGaps.length ? coverageGaps.join('; ')
      : enemyTypes.length + ' ENEMIES types, all with a manifest-declared model on disk');

  // (10) Every ENEMY_VIS.moveClip must actually exist in its model's shipped
  //      clips. A typo here is silent: scene.js falls back to the first non-death
  //      clip and warns, but the intended animation is simply never played — and
  //      before that fallback existed it would have looped `Death`, which is
  //      animations[0] in every model of this roster.
  //      Names are compared RAW — exactly as three.js sees them. An earlier
  //      version stripped a leading 'Armature|' prefix before comparing, which
  //      made this check strictly MORE PERMISSIVE than the runtime: GLTFLoader
  //      caches `gltf.animations` verbatim and scene.js resolves moveClip with
  //      THREE.AnimationClip.findByName, an exact-string match. A prefixed clip
  //      therefore misses at runtime, falls through to the "first non-death
  //      clip" branch below, and plays the right animation only by ordering
  //      luck — while this check printed PASS. That is exactly what the
  //      ADR-040 drake import shipped into the working tree before an
  //      in-browser console read caught it, so the false green is demonstrated,
  //      not hypothetical. The strip is gone; the import pipeline renames clips
  //      instead (see assets/LICENSE.txt).
  function glbClipNames(absPath) {
    const b = fs.readFileSync(absPath);
    if (b.slice(0, 4).toString() !== 'glTF') return null;
    const jsonLen = b.readUInt32LE(12);
    const j = JSON.parse(b.slice(20, 20 + jsonLen).toString('utf8'));
    return (j.animations || []).map(a => String(a.name));
  }
  const clipGaps = [];
  for (const [type, v] of visMap) {
    const p = manById.get(v.model);
    if (!p) continue;                       // already reported by (9)
    const abs = path.join(__dirname, '..', 'assets', p);
    if (!fs.existsSync(abs)) continue;
    const names = glbClipNames(abs);
    if (!names) { clipGaps.push(type + ':' + v.model + '-not-a-glb'); continue; }
    if (!names.includes(v.moveClip)) clipGaps.push(type + ":moveClip '" + v.moveClip + "' not in [" + names.join(',') + ']');
  }
  check('enemy-vis-clips-resolve', visMap.size > 0 && clipGaps.length === 0,
    clipGaps.length ? clipGaps.join('; ') : visMap.size + ' moveClip names all resolve in their model');

  // (11) FLYER GROUND DISCS (ADR-041 D38). Two invariants, both of which fail
  //      silently in the shipped game: a flyer with no disc looks like a ground
  //      unit, and a disc shed under low power removes the depth cue at exactly
  //      the moment it is the ONLY one left (the cast shadow is already gone).
  const decalBody = bodyOf(src, 'function syncDecals(');
  //      (a) Every flying type is covered. Asserted STRUCTURALLY — the branch
  //          must read isFlying off the ENEMIES table, not test a hardcoded list
  //          of type names, because a hardcoded list silently omits the next
  //          flyer added (ADR-040's drake was exactly that event).
  const discIsDataDriven = /\.isFlying/.test(decalBody) && /makeDisc\s*\(/.test(decalBody);
  const discHardcodesTypes = /['"](?:skirmisher|ghost|drake)['"]/.test(decalBody);
  //      (b) Not shed under low power. syncDecals must contain no low-power
  //          branch at all, and setLowPowerShadows must not touch decalsGroup.
  const lowPowerBody2 = bodyOf(src, 'function setLowPowerShadows(');
  const discSurvivesLowPower = !/isLowPower/.test(decalBody) && !/decalsGroup/.test(lowPowerBody2);
  //      (c) The disc clears path CORNERS (0.296), which GROUND_DECAL_Y (0.24)
  //          does not — parsed from source so the constant and the rule cannot
  //          drift apart, the same way decal-no-buried-literals parses its.
  const flyerY = (src.match(/const\s+FLYER_DISC_Y\s*=\s*([0-9.]+)/) || [])[1];
  const clearsCorners = flyerY !== undefined && parseFloat(flyerY) > 0.296;
  const usesNamedY = /makeDisc\s*\([^)]*FLYER_DISC_Y/.test(decalBody);
  const flyerTypes = enemyTypes.filter(t => new RegExp('^\\s{4}' + t + ':.*isFlying:\\s*true', 'm').test(entSrc));
  check('enemy-flyer-disc',
    flyerTypes.length > 0 && discIsDataDriven && !discHardcodesTypes &&
    discSurvivesLowPower && clearsCorners && usesNamedY,
    flyerTypes.length + ' flying types (' + flyerTypes.join(',') + ')' +
    ', data-driven=' + discIsDataDriven + ', hardcoded-list=' + discHardcodesTypes +
    ', survives-low-power=' + discSurvivesLowPower +
    ', FLYER_DISC_Y=' + flyerY + ' >0.296=' + clearsCorners + ', named-y=' + usesNamedY);

  // (11b) THE PROCEDURAL LAYER IS NOT SILENTLY REMOVED (ADR-041, sprint-10 X-3).
  //      syncEnemies treats a live mixer as owning ALL of a creep's movement and
  //      short-circuits the per-type procedural personality. That is right only
  //      where the clip actually supplies the motion being skipped. For the ghost
  //      it did not: the ADR-039 swap took away a 0.468 peak-to-peak float plus a
  //      yaw wobble and gave back 0.11 of internal flutter (rendered deformation,
  //      measured in play on all six maps; the rest of the roster sits at
  //      0.41-1.12). The creep still loaded, still resolved its clip, still had a
  //      running mixer — every existing guard passed — and it read as unanimated.
  //      So the failure this check exists for is a SILENT SUBTRACTION, which no
  //      loading or clip-resolution assertion can see.
  //
  //      Asserted on the branch CONDITION, not on token presence. bodyOf() returns
  //      the explanatory comment along with the code, and that comment necessarily
  //      names `proceduralMotion` — so a `/proceduralMotion/.test(body)` check
  //      would pass against a branch that had been reverted to a bare
  //      `else if (animated)`. That is the identical false-green this file already
  //      documents for the `/ownedMaterials/` guard at (12).
  const syncEnemiesBody = bodyOf(src, 'function syncEnemies(');
  const gateReadsFlag  = /else\s+if\s*\(\s*animated\s*&&\s*!\(\s*vis\s*&&\s*vis\.proceduralMotion\s*\)\s*\)/.test(syncEnemiesBody);
  const gateIsBare     = /else\s+if\s*\(\s*animated\s*\)/.test(syncEnemiesBody);
  //      Declared set parsed from ENEMY_VIS itself, so a flag misspelt on the DATA
  //      side (where it would silently do nothing) fails just as loudly as one
  //      misspelt in the branch.
  const proceduralTypes = [...visBody.matchAll(/^\s{2}([a-z_]+):\s*\{[^}]*proceduralMotion:\s*true/gm)].map(m => m[1]);
  const allReal = proceduralTypes.every(t => enemyTypes.includes(t));
  //      The ghost is pinned BY NAME because it is the type the defect was
  //      diagnosed on; dropping its flag is a regression, not a preference.
  const ghostKeepsIt = proceduralTypes.includes('ghost');
  check('enemy-vis-procedural-motion',
    gateReadsFlag && !gateIsBare && proceduralTypes.length > 0 && allReal && ghostKeepsIt,
    'gate-reads-flag=' + gateReadsFlag + ', gate-is-bare=' + gateIsBare +
    ', declared=[' + proceduralTypes.join(',') + '], all-real-types=' + allReal +
    ', ghost-declared=' + ghostKeepsIt);

  // (12) LOW-POWER RECOVERY IS TWO-WAY (ADR-041 D39). Both halves were one-way
  //      and both failed silently: castShadow was cleared with no else branch, so
  //      only creeps spawned after recovery ever cast again; and mixers were
  //      released with nothing re-attaching, so a trip-and-clear cycle left
  //      animated and frozen creeps side by side for the rest of the run.
  //      Guarded as a PAIR because fixing either alone still leaves a one-way path.
  //      Asserted on the ASSIGNMENTS, not on the shape around them. An earlier
  //      cut tested `/else\s+if[\s\S]{0,120}_castShadowPreLowPower/`, which
  //      false-passes on an EMPTY else-branch and on a comment mentioning both
  //      tokens — the same false-green this file already documents for the
  //      `/ownedMaterials/` guard, and it bites here because bodyOf() returns the
  //      20-line explanatory comment along with the code.
  const recordsShadow  = /_castShadowPreLowPower\s*=\s*o\.castShadow/.test(lowPowerBody2);
  const restoresShadow = /o\.castShadow\s*=\s*o\.userData\._castShadowPreLowPower/.test(lowPowerBody2);
  const reattachesMixers = /else[\s\S]{0,80}attachAllEnemyMixers\s*\(/.test(lowPowerBody2) &&
                           /function attachAllEnemyMixers\s*\([\s\S]{0,600}attachEnemyMixer\s*\(/.test(src);
  check('enemy-lowpower-recovers', recordsShadow && restoresShadow && reattachesMixers,
    'castShadow recorded on trip=' + recordsShadow + ', restored on clear=' + restoresShadow +
    ', mixers re-attached on clear=' + reattachesMixers);
}

// ─── Summary ─────────────────────────────────────────────────
// A stale KNOWN_FAILS entry — one whose check now PASSES — silently disarms that
// check: the id stays registered, so if the finding ever regresses it prints
// KNOWN-FAIL and is excluded from acceptance, forever. This used to WARN only,
// and the exit gate keys on failed.length, so a forgotten entry stayed green
// indefinitely. The ADR-040 W8-1 -> W8-2 red window was cleared by discipline
// rather than by enforcement; this is the enforcement (ADR-040 listed it as
// out-of-scope, and ADR-041's addendum to that ADR records it as done).
// Registered through check() so it counts toward failed.length like any other.
for (const id of staleKnown) {
  warn('stale KNOWN_FAILS entry now passing — remove it so future regressions fail loudly: ' + id);
}
// ORPHANS are the same defect by the likelier route. staleKnown is only appended
// from inside check(), so an entry whose id is typo'd — or whose check was later
// renamed or deleted — never reaches it and sits registered forever, disarming
// nothing but reading as if it guards something. A rename is far more likely than
// a typo, which is exactly why this half matters.
const orphanKnown = Object.keys(KNOWN_FAILS).filter(id => !checks.some(c => c.id === id));
for (const id of orphanKnown) {
  warn('orphan KNOWN_FAILS entry matches no check (renamed or deleted?): ' + id);
}
const knownRot = staleKnown.concat(orphanKnown);
check('known-fails-not-stale', knownRot.length === 0,
  knownRot.length
    ? knownRot.length + ' entr' + (knownRot.length === 1 ? 'y' : 'ies') + ' to remove from KNOWN_FAILS: ' +
      staleKnown.map(id => id + ' (now passing)').concat(orphanKnown.map(id => id + ' (matches no check)')).join(', ')
    : Object.keys(KNOWN_FAILS).length + ' registered, none stale or orphaned');

// Tallied AFTER the stale-KNOWN_FAILS check above, so that check counts toward
// failed.length like every other. Computing these first is what made the old
// version advisory: the entry printed WARN and the exit gate never saw it.
const failed = checks.filter(c => c.status === 'FAIL');
const knownFailed = checks.filter(c => c.status === 'KNOWN-FAIL');
const passed = checks.filter(c => c.status === 'PASS');
console.log('\n' + passed.length + ' pass, ' + failed.length + ' fail, ' + knownFailed.length + ' known-fail' +
  (knownFailed.length ? ' (documented, excluded from acceptance)' : ''));
if (failed.length === 0) {
  console.log('ACCEPTANCE: ALL PASS');
  process.exit(0);
} else {
  console.log('ACCEPTANCE: FAIL');
  process.exit(1);
}
