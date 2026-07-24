#!/usr/bin/env node
/*
 * Tests for the fairness oracle (ADR-037 C-7).
 *
 * Run from the CTD directory:   node tools/map-rules-test.cjs
 * Exit 0 when every assertion passes, 1 otherwise.
 *
 * Two kinds of coverage, both required:
 *   1. A POSITIVE and a NEGATIVE control per promoted rule — every rule must
 *      fire on at least one purpose-built violating map AND stay silent on a
 *      purpose-built compliant one. A rule with only one of those is a rule
 *      that could be vacuously true.
 *   2. A pinned BASELINE of the six official maps. They were hand-authored
 *      before these rules were written and several violate them; pinning the
 *      exact violation set means a future rule edit that silently changes an
 *      official map's verdict fails here instead of surprising the generator.
 */
'use strict';

const Rules = require('./map-rules.js');

let pass = 0, fail = 0;
function check(id, cond, detail) {
  const status = cond ? 'PASS' : 'FAIL';
  if (cond) pass++; else fail++;
  console.log(status + '  ' + id + (detail ? '  [' + detail + ']' : ''));
}
const codesOf = m => Rules.check(m).map(i => i.code);
const fires = (m, code) => codesOf(m).includes(code);

// ─── The compliant control ───────────────────────────────────
// Purpose-built to satisfy all ten promoted rules at once. Deliberately NOT
// one of the official maps: those are the baseline, and using one as the
// negative control would make the controls and the baseline the same test.
//
//   Path: 8 waypoints, 7 axis-aligned segments, 6 turns, 39.0 tiles total,
//   starting hard on the west edge and ending at the keep. Slot offsets sit
//   just inside 2u of their corners so H1 (distance to both segments) and H7
//   (distance to the corner waypoint) are both satisfied — at 1.5/1.5 the
//   diagonal is 2.12 and H7's corner role would go unfilled.
function compliantMap() {
  return {
    id: 'ctrl:compliant',
    path: [
      { x: -14, z: -6 }, { x: -7, z: -6 }, { x: -7, z: 0 }, { x: -1, z: 0 },
      { x: -1, z: 6 },   { x: 5, z: 6 },   { x: 5, z: 1 },  { x: 8, z: 1 }
    ],
    castle: { x: 8, y: 0, z: 1 },
    buildSlots: [
      { id: 's1', x: -12,   z: -4.4 }, // flank on the first straight
      { id: 's2', x: -8.4,  z: -4.6 }, // inside corner at (-7,-6)
      { id: 's3', x: -5.6,  z: -1.4 }, // inside corner at (-7,0)
      { id: 's4', x: -2.4,  z: 1.4 },  // inside corner at (-1,0)
      { id: 's5', x: 0.4,   z: 4.6 },  // inside corner at (-1,6)
      { id: 's6', x: 3.6,   z: 4.6 },  // inside corner at (5,6)
      { id: 's7', x: 6.6,   z: 2.6 }   // castle anchor
    ]
  };
}

console.log('CTD3 map-rules oracle — ' + Rules.RULES.length + ' promoted rules\n');

// ─── 1. Negative control: the compliant map trips nothing ────
{
  const issues = Rules.check(compliantMap());
  check('compliant-control-silent', issues.length === 0,
    issues.length ? issues.map(i => i.code + ': ' + i.message).join(' | ') : 'no warns');
}

// ─── 2. Positive controls, one violating map per rule ────────
// Each mutates the compliant control minimally, so a firing rule is
// attributable to the mutation and nothing else.
const POSITIVE = {
  H1: () => {           // pull every slot off the bends
    const m = compliantMap();
    m.buildSlots = [
      { id: 's1', x: -12, z: -3 }, { id: 's2', x: -4, z: -3 }, { id: 's3', x: -4, z: 3 },
      { id: 's4', x: 2, z: 3 }, { id: 's5', x: 8, z: 3 }, { id: 's6', x: 2, z: -3 }
    ];
    return m;
  },
  H2: () => {           // strand one slot far from any segment
    const m = compliantMap();
    m.buildSlots[3] = { id: 's4', x: 12, z: -8 };
    return m;
  },
  H3: () => {           // a long straight with nothing near its midpoint
    const m = compliantMap();
    m.path = [
      { x: -14, z: -6 }, { x: 0, z: -6 }, { x: 0, z: 0 }, { x: 6, z: 0 },
      { x: 6, z: 6 }, { x: 11, z: 6 }
    ];
    m.castle = { x: 11, y: 0, z: 6 };
    m.buildSlots = [
      { id: 's1', x: -13, z: -4 }, { id: 's2', x: -2, z: -4 }, { id: 's3', x: 2, z: -2 },
      { id: 's4', x: 4, z: 2 }, { id: 's5', x: 8, z: 4 }, { id: 's6', x: 9, z: 8 }
    ];
    return m;
  },
  H4: () => {           // slots spread so no two overlap along the road
    const m = compliantMap();
    m.buildSlots = [
      { id: 's1', x: -13, z: -4 }, { id: 's2', x: 10, z: 3 }
    ];
    return m;
  },
  H5: () => {           // nothing within 4 tiles of spawn or keep
    const m = compliantMap();
    m.buildSlots = m.buildSlots.filter(s => s.id !== 's1' && s.id !== 's7');
    return m;
  },
  H7: () => {           // corners only — no flank, no anchor
    const m = compliantMap();
    m.buildSlots = [
      { id: 's2', x: -8.5, z: -4.5 }, { id: 's3', x: -5.5, z: -1.5 },
      { id: 's4', x: -2.5, z: 1.5 }
    ];
    return m;
  },
  H8: () => {           // a short, barely-bent road
    const m = compliantMap();
    m.path = [{ x: -14, z: -6 }, { x: -4, z: -6 }, { x: -4, z: 0 }, { x: 0, z: 0 }];
    m.castle = { x: 0, y: 0, z: 0 };
    return m;
  },
  H10: () => {          // spawn parked in the middle of the field
    const m = compliantMap();
    m.path = m.path.slice();
    m.path[0] = { x: -6, z: -6 };
    return m;
  },
  H11: () => {          // one slot for a full-length road
    const m = compliantMap();
    m.buildSlots = [{ id: 's1', x: -12, z: -4 }];
    return m;
  },
  H12: () => {          // one slot is the sole cover for most of the road,
    const m = compliantMap();   // while a redundant pair shares the far end
    m.buildSlots = [
      { id: 's1', x: -7, z: -3 }, { id: 's2', x: 6.6, z: 2.6 }, { id: 's3', x: 6, z: 3 }
    ];
    return m;
  }
};

for (const rule of Rules.RULES) {
  const make = POSITIVE[rule.code];
  if (!make) { check('positive-control:' + rule.code, false, 'NO CONTROL DEFINED'); continue; }
  const m = make();
  const got = codesOf(m);
  check('positive-control:' + rule.code, got.includes(rule.code),
    got.length ? 'fired: ' + got.join(',') : 'fired nothing');
}

// Every rule must also be silent on the compliant control — asserted once
// above as a set, and here per-rule so a failure names the rule.
for (const rule of Rules.RULES) {
  check('negative-control:' + rule.code, !fires(compliantMap(), rule.code));
}

// ─── 2b. Boundary controls — the thresholds themselves ───────
// The controls above clear most limits by a wide margin (H12 at 0% against a
// 30% ceiling), which means they prove a rule EXISTS but not that its number
// is right: a mutation battery showed 11 of 23 threshold changes surviving,
// including H12's ceiling, H11's ceil/floor, H4's run length and the sampling
// interval. These pairs pin each number from BOTH sides — just inside the
// limit must stay silent, just outside must fire.
function boundary(id, passingMap, failingMap, code) {
  check('boundary:' + id + ':inside-silent', !fires(passingMap, code), 'want no ' + code);
  check('boundary:' + id + ':outside-fires', fires(failingMap, code), 'want ' + code);
}
{
  // H5 — anchor radius is 4u: 3.9 from the keep passes, 4.1 fails.
  const at = (d) => { const m = compliantMap(); m.buildSlots[6] = { id: 's7', x: 8 - d, z: 1 }; return m; };
  boundary('H5-castle-4u', at(3.9), at(4.1), 'H5');
}
{
  // H11 — [ceil(len/7), floor(len/5)] = [6,7] at 39u. 6 and 7 pass; 5 and 8 fail.
  const withN = (n) => {
    const m = compliantMap();
    m.buildSlots = m.buildSlots.slice(0, Math.min(n, 7));
    while (m.buildSlots.length < n) m.buildSlots.push({ id: 'x' + m.buildSlots.length, x: -12, z: -4.4 });
    return m;
  };
  boundary('H11-lower-6', withN(6), withN(5), 'H11');
  boundary('H11-upper-7', withN(7), withN(8), 'H11');
}
{
  // H8 — path budget bounds are inclusive. 5 turns passes, 4 fails.
  const turns5 = compliantMap();
  turns5.path = [ { x: -14, z: -6 }, { x: -7, z: -6 }, { x: -7, z: 0 }, { x: -1, z: 0 },
                  { x: -1, z: 6 }, { x: 6, z: 6 }, { x: 6, z: 1 } ];
  turns5.castle = { x: 6, y: 0, z: 1 };
  const turns4 = compliantMap();
  turns4.path = [ { x: -14, z: -6 }, { x: -7, z: -6 }, { x: -7, z: 0 }, { x: 1, z: 0 },
                  { x: 1, z: 6 }, { x: 9, z: 6 } ];
  turns4.castle = { x: 9, y: 0, z: 6 };
  check('boundary:H8-turns-5-passes', !fires(turns5, 'H8'), 'turns=' + Rules.corners(turns5.path).length);
  check('boundary:H8-turns-4-fires', fires(turns4, 'H8'), 'turns=' + Rules.corners(turns4.path).length);
}
{
  // SAMPLE_STEP + H4's run arithmetic. k consecutive samples span (k−1)
  // intervals, so a true 3.0u overlap is the pass boundary and 2.5u must fail.
  // Two slots on a straight, separated so their 7.5u discs overlap by a
  // controlled amount along the road: overlap = 2*sqrt(7.5² − off²) − sep.
  // EXACTLY two slots, so the verdict is attributable to their separation and
  // cannot be satisfied by some other pair elsewhere on the map.
  const pair = (sep) => {
    const m = compliantMap();
    m.buildSlots = [
      { id: 'a', x: -11 - sep / 2, z: -4.5 }, { id: 'b', x: -11 + sep / 2, z: -4.5 }
    ];
    return m;
  };
  boundary('H4-run-3u', pair(11), pair(12), 'H4');
}
{
  // H12 — the 30% sole-coverage ceiling, pinned from both sides. Rather than
  // hand-tuning coordinates to land near 30%, sweep slot COUNT (more slots
  // spread the load, lowering the worst sole share), measure the real share
  // independently, and assert the verdict flips exactly where the measured
  // share crosses the ceiling. Self-calibrating, so it cannot rot into a
  // probe that sits far from the number it claims to pin.
  const spread = (n) => {
    const m = compliantMap();
    const pts = Rules.samplePath(m.path);
    m.buildSlots = [];
    for (let i = 0; i < n; i++) {
      const p = pts[Math.floor((i + 0.5) * pts.length / n)];
      m.buildSlots.push({ id: 'p' + i, x: p.x, z: p.z - 1.2 });
    }
    return m;
  };
  const share = (m) => {
    const pts = Rules.samplePath(m.path);
    let tot = 0; const sole = new Array(m.buildSlots.length).fill(0);
    for (const p of pts) {
      let n = 0, li = -1;
      m.buildSlots.forEach((s, i) => { if (Rules.dist(s, p) <= Rules.T1_RANGE) { n++; li = i; } });
      if (n) tot++;
      if (n === 1) sole[li]++;
    }
    return Math.max.apply(null, sole.map(c => c / tot));
  };
  let below = null, above = null;
  for (let n = 2; n <= 12; n++) {
    const s = share(spread(n));
    if (s <= 0.30 && (below === null || s > share(spread(below)))) below = n;
    if (s > 0.30 && (above === null || s < share(spread(above)))) above = n;
  }
  const ok = below !== null && above !== null &&
    !fires(spread(below), 'H12') && fires(spread(above), 'H12');
  check('boundary:H12-ceiling-30pct', ok,
    below === null || above === null ? 'could not straddle the ceiling'
      : 'silent at ' + (share(spread(below)) * 100).toFixed(1) + '% (' + below + ' slots), fires at ' +
        (share(spread(above)) * 100).toFixed(1) + '% (' + above + ' slots)');
}
{
  // H1's inside-quadrant constraint: a slot ≤2u from BOTH legs but on the
  // OUTSIDE of every bend must not earn corner credit. Without the quadrant
  // test this map reads perfectly clean.
  const outside = compliantMap();
  const cs = Rules.corners(outside.path);
  outside.buildSlots = cs.map((c, i) => {
    const inner = compliantMap().buildSlots[i + 1];
    return { id: 'o' + i, x: 2 * c.at.x - inner.x, z: 2 * c.at.z - inner.z };  // mirror through the corner
  });
  check('boundary:H1-outside-corner-not-credited', fires(outside, 'H1'),
    'mirrored ' + outside.buildSlots.length + ' slots to the outside of every bend');
}

// ─── 3. Robustness — the editor calls this on every keystroke ─
{
  const partial = [
    null, {}, { path: [] }, { path: [{ x: 0, z: 0 }] },
    { path: [{ x: 0, z: 0 }, { x: 1, z: 0 }] },                       // no slots/castle
    { path: [{ x: 0, z: 0 }, { x: 1, z: 0 }], buildSlots: [], castle: { x: 1, z: 0 } }
  ];
  let threw = null;
  for (const m of partial) {
    try { Rules.check(m); } catch (e) { threw = JSON.stringify(m) + ' → ' + e.message; }
  }
  check('partial-maps-never-throw', threw === null, threw || 'all ' + partial.length + ' handled');
}
{
  // A zero-length path segment must not divide by zero.
  const m = compliantMap();
  m.path = [{ x: -14, z: -6 }, { x: -14, z: -6 }, { x: -7, z: -6 }, { x: -7, z: 0 }, { x: 0, z: 0 }];
  let ok = true;
  try { Rules.check(m); } catch (e) { ok = false; }
  check('degenerate-segment-safe', ok);
}
{
  // Hostile coordinates must not HANG. The per-rule try/catch cannot contain
  // an infinite loop, and the generator has no AXIS blocker in front of it.
  const hostile = [1e7, 1e12, Infinity, -Infinity, NaN];
  const results = [];
  for (const x of hostile) {
    const m = compliantMap();
    m.path = m.path.slice();
    m.path[3] = { x, z: 0 };
    const t0 = Date.now();
    let ok = true;
    try { Rules.check(m); } catch (e) { ok = false; }
    results.push(x + ':' + (Date.now() - t0) + 'ms' + (ok ? '' : ' THREW'));
  }
  // If any of these hung we would never reach this line — reaching it IS the
  // assertion. The timing is reported so a future regression is visible.
  check('hostile-coordinates-terminate', true, results.join(' '));
}
{
  // Collinear waypoints must not launder a long straight past H3/H8. The same
  // 14-tile run, once whole and once split by a redundant midpoint, must give
  // the same verdict.
  const whole = compliantMap();
  whole.path = [{ x: -14, z: -6 }, { x: 0, z: -6 }, { x: 0, z: 2 }, { x: 6, z: 2 }, { x: 6, z: 6 }];
  whole.castle = { x: 6, y: 0, z: 6 };
  whole.buildSlots = [{ id: 's1', x: -12, z: -4 }, { id: 's2', x: 2, z: 0 }, { id: 's3', x: 4, z: 4 }];
  const split = JSON.parse(JSON.stringify(whole));
  split.path = [{ x: -14, z: -6 }, { x: -7, z: -6 }, { x: 0, z: -6 }, { x: 0, z: 2 }, { x: 6, z: 2 }, { x: 6, z: 6 }];
  const a = codesOf(whole).sort().join(','), b = codesOf(split).sort().join(',');
  check('collinear-split-same-verdict', a === b, 'whole [' + a + '] vs split [' + b + ']');
}

// ─── 4. Pinned baseline for the six official maps ────────────
// Loaded through the same window shim tools/sim-harness.cjs uses.
global.window = { location: { search: '' } };
require('../entities.js');
require('../maps.js');
const Maps = global.window.CTD3Maps;

// MEASURED from the shipped maps.js on 2026-07-23 — recorded, not predicted.
// These are FINDINGS about hand-authored content, not regressions: the maps
// predate the rules. Pinned so a future rule edit that silently changes an
// official verdict fails loudly here instead of surprising the generator.
//
// Worth noting for whoever tunes the generator: the six maps are largely
// compliant. Only four rules fire at all, and the pattern is consistent —
// inside-corner density (H1) on five maps, a missing spawn/keep anchor (H5)
// on three, an unfilled role (H7) on three, and one stranded slot on plains
// (H2). Nothing trips H3, H4, H8, H10, H11 or H12, which is a useful signal
// that those thresholds are calibrated to the content rather than against it.
const BASELINE = {
  plains:        ['H1', 'H2', 'H5'],
  forest:        ['H1', 'H5', 'H7'],
  mountain:      ['H1', 'H7'],
  tidewater:     ['H1'],
  snowfall_pass: ['H7'],
  riverbend:     ['H1', 'H5']
};

console.log('');
for (const map of Maps.listOfficial()) {
  const got = codesOf(map).sort();
  const want = (BASELINE[map.id] || []).slice().sort();
  const same = got.length === want.length && got.every((c, i) => c === want[i]);
  check('official-baseline:' + map.id, same,
    same ? got.join(',') || 'clean' : 'got [' + got.join(',') + '] want [' + want.join(',') + ']');
}

// No promoted rule may be a blocker — severity is warn, always.
{
  const allWarn = Maps.listOfficial().every(m => Rules.check(m).every(i => i.severity === 'warn'));
  check('official-never-blocked', allWarn);
}

// ─── Summary ─────────────────────────────────────────────────
console.log('\n' + pass + ' pass, ' + fail + ' fail');
if (fail === 0) { console.log('ACCEPTANCE: ALL PASS'); process.exit(0); }
console.log('ACCEPTANCE: FAIL'); process.exit(1);
