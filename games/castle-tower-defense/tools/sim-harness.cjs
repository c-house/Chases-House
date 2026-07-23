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
require('../engine.js');

const E = global.window.CTD3Entities;
const Maps = global.window.CTD3Maps;
const Eng = global.window.CTD3Engine;

const TICK_MS = 1000 / 60;
const MAX_SIM_MS = 60 * 60 * 1000; // hard cap per run; sim is deterministic and self-terminating

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

// ─── Static curve computation (ADR-036 §2.2) ─────────────────
// Split children (Slime → 2 Mini Slimes) count toward both wave HP and
// income: they are real HP the towers must clear and real bounty paid.
function waveStats(wave, hpMult) {
  let hp = 0, bounty = 0, count = 0;
  for (const gDef of wave.enemies) {
    const def = E.ENEMIES[gDef.type];
    if (!def) continue;
    hp += gDef.count * Math.round(def.hp * hpMult);
    bounty += gDef.count * def.bounty;
    count += gDef.count;
    if (def.splitsInto && E.ENEMIES[def.splitsInto]) {
      const child = E.ENEMIES[def.splitsInto];
      const n = gDef.count * (def.splitCount || 2);
      hp += n * Math.round(child.hp * hpMult);
      bounty += n * child.bounty;
      count += n;
    }
  }
  return { hp, bounty, count, income: bounty + (wave.reward || 0) };
}

function computeCurves(map) {
  const quiet = E.mergedDifficulty('quiet', map.difficultyOverrides);
  const rows = [];
  let cum = quiet.startGold;
  map.waves.forEach((w, i) => {
    const base = waveStats(w, 1.0);
    const q = waveStats(w, quiet.hpMult);
    rows.push({
      wave: i + 1,
      isBoss: !!w.isBoss,
      baseHp: base.hp,
      quietHp: q.hp,
      income: q.income,
      cumGoldBefore: cum,
      attrition: q.hp / cum
    });
    cum += q.income;
  });
  return rows;
}

// ─── Scripted build policies ─────────────────────────────────
function cheapestTowerType() {
  let best = null, bestCost = Infinity;
  for (const [type, def] of Object.entries(E.TOWERS)) {
    if (def.tiers[0].cost < bestCost) { best = type; bestCost = def.tiers[0].cost; }
  }
  return best;
}

function emptySlots(state) {
  const used = new Set(state.towers.map(t => t.slotId));
  return state.mapDef.buildSlots.filter(s => !used.has(s.id));
}

function cheapestUpgrade(state) {
  let best = null, bestCost = Infinity;
  for (const tw of state.towers) {
    const next = E.TOWERS[tw.type].tiers[tw.tier + 1];
    if (next && next.cost < bestCost) { best = tw; bestCost = next.cost; }
  }
  return best ? { tower: best, cost: bestCost } : null;
}

const POLICIES = {
  // Always the globally cheapest affordable action; ties favor placement.
  'greedy-cheapest': function (state) {
    for (;;) {
      const slots = emptySlots(state);
      const type = cheapestTowerType();
      const placeCost = E.TOWERS[type].tiers[0].cost;
      const up = cheapestUpgrade(state);
      if (slots.length && placeCost <= state.gold && (!up || placeCost <= up.cost)) {
        if (Eng.place(state, slots[0].id, type) !== 'ok') return;
      } else if (up && up.cost <= state.gold) {
        if (Eng.upgrade(state, up.tower.id) !== 'ok') return;
      } else return;
    }
  },
  // Rangers on every slot, then max each one out in slot order (concentration).
  'ranger-heavy': function (state) {
    for (;;) {
      const slots = emptySlots(state);
      if (slots.length) {
        if (E.TOWERS.ranger.tiers[0].cost > state.gold) return;
        if (Eng.place(state, slots[0].id, 'ranger') !== 'ok') return;
        continue;
      }
      const tw = state.towers.find(t => E.TOWERS[t.type].tiers[t.tier + 1]);
      if (!tw) return;
      if (E.TOWERS[tw.type].tiers[tw.tier + 1].cost > state.gold) return;
      if (Eng.upgrade(state, tw.id) !== 'ok') return;
    }
  },
  // Mixed composition cycling through roles, then cheapest-upgrade-first.
  'balanced': function (state) {
    const comp = ['ranger', 'catapult', 'ranger', 'warden', 'mage', 'ranger', 'catapult'];
    for (;;) {
      const slots = emptySlots(state);
      if (slots.length) {
        const type = comp[state.towers.length % comp.length];
        if (E.TOWERS[type].tiers[0].cost > state.gold) return;
        if (Eng.place(state, slots[0].id, type) !== 'ok') return;
        continue;
      }
      const up = cheapestUpgrade(state);
      if (!up || up.cost > state.gold) return;
      if (Eng.upgrade(state, up.tower.id) !== 'ok') return;
    }
  }
};

// ─── Sim runner ──────────────────────────────────────────────
// opts.slowCall: wait out the ADR-036 D4 early-call countdown before each
// send (forfeits every bonus) — the control arm for the early-call check.
function runScripted(mapId, difficulty, policyName, opts) {
  const state = Eng.createState(mapId, difficulty);
  const policy = POLICIES[policyName];
  const slowCall = !!(opts && opts.slowCall);
  const kills = {};
  let elapsed = 0;
  while (state.fsm !== 'wonRun' && state.fsm !== 'lostRun' && elapsed < MAX_SIM_MS) {
    policy(state);
    if (Eng.canSendNextWave(state) && (!slowCall || state.prepCountdownMs <= 0)) {
      Eng.sendNextWave(state);
    }
    Eng.step(state, TICK_MS);
    for (const ev of state.events) if (ev.kind === 'kill') kills[ev.enemyType] = (kills[ev.enemyType] || 0) + 1;
    state.events.length = 0;
    elapsed += TICK_MS;
  }
  return {
    won: state.fsm === 'wonRun',
    timedOut: elapsed >= MAX_SIM_MS,
    lives: state.lives,
    gold: state.gold,
    goldEarned: state.goldEarned,
    wavesCleared: state.fsm === 'wonRun' ? state.waveTotal : state.waveIndex,
    simSec: Math.round(elapsed / 1000),
    kills
  };
}

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
  Object.keys(E.ENEMIES).length + ' enemy types, ' + Object.keys(POLICIES).length + ' scripted builds\n');

// 1. Referenced enemy types exist.
for (const map of maps) {
  const missing = [];
  map.waves.forEach((w, i) => w.enemies.forEach(gDef => {
    if (!E.ENEMIES[gDef.type]) missing.push('w' + (i + 1) + ':' + gDef.type);
  }));
  check('wave-types-exist:' + map.id, missing.length === 0, missing.join(',') || map.waves.length + ' waves');
}

// 2. Every ENEMIES entry reachable from some official wave (directly or via split).
{
  const reachable = new Set();
  for (const map of maps) map.waves.forEach(w => w.enemies.forEach(gDef => reachable.add(gDef.type)));
  for (const t of [...reachable]) {
    const def = E.ENEMIES[t];
    if (def && def.splitsInto) reachable.add(def.splitsInto);
  }
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
    for (const policyName of Object.keys(POLICIES)) {
      const r = runScripted(map.id, difficulty, policyName);
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
    const wonBy = Object.keys(POLICIES).filter(p => results[map.id + '/' + difficulty + '/' + p].won);
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
  const slow = runScripted('plains', 'quiet', 'ranger-heavy', { slowCall: true });
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
