/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — map-rules.js  (ADR-037 C-7)
   The coverage-and-fairness half of docs/level-design.md, promoted
   from prose into code.

   The editor already machine-checks every STRUCTURAL rule (9 blockers)
   and the wave-shape rules (6 warns). Everything about whether a layout
   is actually FAIR to play — inside-corner cover, slot reach, straight-away
   coverage, synergy, anchors, role diversity, the path budget, the spawn
   telegraph, slot density and coverage redundancy — lived only as a manual
   checklist. That means a generated layout could pass all 9 blockers and
   still be unplayable.

   Pure function over a map object; no DOM, no engine, no globals beyond the
   export. Same window-IIFE shape as tools/sim-core.js, and deliberately
   callable outside the editor: the cycle-3 layout generator needs an oracle
   it can run in a generate-and-reject loop, and this is it.

     CTD3MapRules.check({ path, buildSlots, castle }) -> [{ code, message }]

   Every rule is warn-tier by construction. NOTHING here may become a
   blocker: the six official maps were hand-authored before these rules were
   written and several violate them, so a new blocker would break shipped
   content. The violations they do produce are pinned as a baseline by
   tools/map-rules-test.cjs.

   Exposes window.CTD3MapRules.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Playfield half-extents, matching the editor's canvas bounds.
  const WORLD_HALF_X = 14;
  const WORLD_HALF_Z = 9;
  // Canonical T1 projectile reach, used by the coverage rules (H4, H12) so
  // "covered" means the same thing here as it does to a tower on wave one.
  const T1_RANGE = 7.5;
  const SAMPLE_STEP = 0.5;
  // Sampling ceiling per segment. A legal map's longest segment is ~14 tiles
  // (28 samples); this only ever binds on a hostile coordinate.
  const MAX_SAMPLES_PER_SEGMENT = 4000;

  // ─── Geometry ────────────────────────────────────────────────
  function dist(a, b) { return Math.hypot(a.x - b.x, a.z - b.z); }

  // Distance from p to segment ab, clamped to the endpoints — segment
  // distance, not waypoint distance (the rulebook is explicit about this;
  // waypoint distance would pass slots that sit far from the road it runs).
  function segDist(p, a, b) {
    const vx = b.x - a.x, vz = b.z - a.z;
    const len2 = vx * vx + vz * vz;
    if (len2 === 0) return dist(p, a);
    let t = ((p.x - a.x) * vx + (p.z - a.z) * vz) / len2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * vx), p.z - (a.z + t * vz));
  }

  // Segments with COLLINEAR RUNS MERGED. corners() already refuses to count a
  // collinear waypoint as a turn, so an unmerged segment list would disagree
  // with it: a 14-tile dead-straight run split by one redundant waypoint would
  // read as 7+7 and slip past both H3's midpoint check and H8's "at most one
  // segment ≥10u" — the exact shapes those rules exist to catch. A path
  // generator emits redundant collinear waypoints as a matter of course, and
  // the generator is this module's whole reason for existing.
  function segments(path) {
    const out = [];
    let start = 0;
    for (let i = 1; i < path.length; i++) {
      const atEnd = i === path.length - 1;
      let turns = false;
      if (!atEnd) {
        const inX = Math.sign(path[i].x - path[i - 1].x), inZ = Math.sign(path[i].z - path[i - 1].z);
        const outX = Math.sign(path[i + 1].x - path[i].x), outZ = Math.sign(path[i + 1].z - path[i].z);
        turns = (inX !== outX || inZ !== outZ);
      }
      if (turns || atEnd) {
        out.push({ a: path[start], b: path[i], len: dist(path[start], path[i]) });
        start = i;
      }
    }
    return out;
  }
  function pathLength(path) {
    return segments(path).reduce((n, s) => n + s.len, 0);
  }
  function minSegDist(p, segs) {
    return segs.reduce((m, s) => Math.min(m, segDist(p, s.a, s.b)), Infinity);
  }
  // Corner = a middle waypoint whose incoming and outgoing directions differ.
  function corners(path) {
    const out = [];
    for (let i = 1; i < path.length - 1; i++) {
      const inX = Math.sign(path[i].x - path[i - 1].x), inZ = Math.sign(path[i].z - path[i - 1].z);
      const outX = Math.sign(path[i + 1].x - path[i].x), outZ = Math.sign(path[i + 1].z - path[i].z);
      if (inX !== outX || inZ !== outZ) {
        out.push({ at: path[i], before: { a: path[i - 1], b: path[i] }, after: { a: path[i], b: path[i + 1] } });
      }
    }
    return out;
  }
  // Path sampled at a fixed interval — the shared basis for every coverage
  // rule, so H4 and H12 cannot disagree about what "covered" means.
  function samplePath(path) {
    const pts = [];
    for (const s of segments(path)) {
      // A non-finite or absurd coordinate would make `n` Infinity and hang
      // this loop forever — and a hang is the one failure the per-rule
      // try/catch in check() cannot contain. The editor's AXIS blocker stops
      // such a path before it reaches here, but the generator has no blocker
      // in front of it, and the generator is the point of this module.
      if (!Number.isFinite(s.len)) continue;
      const n = Math.min(MAX_SAMPLES_PER_SEGMENT, Math.max(1, Math.round(s.len / SAMPLE_STEP)));
      for (let i = 0; i < n; i++) {
        const t = i / n;
        pts.push({ x: s.a.x + (s.b.x - s.a.x) * t, z: s.a.z + (s.b.z - s.a.z) * t });
      }
    }
    if (path.length) pts.push(path[path.length - 1]);
    return pts;
  }
  // Is p in the corner's INSIDE quadrant — the concave side the road wraps
  // around? "Within 2u of both segments" alone is satisfied in all four
  // quadrants, including the outside of the bend, which is the worst tower
  // position and precisely the one H1 exists to rule out. The inside quadrant
  // is the one lying back along the incoming leg and forward along the
  // outgoing one.
  function insideCorner(p, c) {
    const inX = c.at.x - c.before.a.x, inZ = c.at.z - c.before.a.z;
    const outX = c.after.b.x - c.at.x, outZ = c.after.b.z - c.at.z;
    const vx = p.x - c.at.x, vz = p.z - c.at.z;
    return (vx * -inX + vz * -inZ) > 0 && (vx * outX + vz * outZ) > 0;
  }

  function edgeGap(p) {
    return Math.min(WORLD_HALF_X - Math.abs(p.x), WORLD_HALF_Z - Math.abs(p.z));
  }
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  // ─── Rules ───────────────────────────────────────────────────
  // Each returns a message string when VIOLATED, or null when satisfied.
  // Author voice, matching the editor's existing warns: name what is wrong,
  // give the measured number, say what good looks like.
  const RULES = [
    {
      code: 'H1',
      why: 'inside-corner slot',
      test(m) {
        const cs = corners(m.path);
        if (!cs.length) return null;
        const covered = cs.filter(c => m.buildSlots.some(s =>
          insideCorner(s, c) &&
          segDist(s, c.before.a, c.before.b) <= 2 && segDist(s, c.after.a, c.after.b) <= 2)).length;
        const need = Math.ceil(cs.length / 2);
        return covered >= need ? null
          : 'Only ' + covered + ' of ' + cs.length + ' turns ' + (covered === 1 ? 'has' : 'have') +
            ' a slot tucked into the inside corner — aim for ' + need +
            '. A tower on the bend covers both approaches at once.';
      }
    },
    {
      code: 'H2',
      why: 'slot-to-path proximity ceiling',
      test(m) {
        const segs = segments(m.path);
        const far = m.buildSlots.filter(s => minSegDist(s, segs) > 3);
        return far.length === 0 ? null
          : plural(far.length, 'slot sits', 'slots sit') + ' further than 3 tiles from the road (' +
            far.map(s => s.id).join(', ') + ') — a tower there will watch the raiders pass.';
      }
    },
    {
      code: 'H3',
      why: 'straight-away coverage',
      test(m) {
        const bare = segments(m.path).filter(s => s.len >= 6).filter(s => {
          const mid = { x: (s.a.x + s.b.x) / 2, z: (s.a.z + s.b.z) / 2 };
          return !m.buildSlots.some(sl => dist(sl, mid) <= 5);
        });
        return bare.length === 0 ? null
          : plural(bare.length, 'long straight has', 'long straights have') +
            ' no slot within 5 tiles of the middle — raiders cross ' +
            (bare.length === 1 ? 'it' : 'them') + ' unopposed.';
      }
    },
    {
      code: 'H4',
      why: 'synergy pair shares a segment',
      test(m) {
        const pts = samplePath(m.path);
        const slots = m.buildSlots;
        if (slots.length < 2) return 'Fewer than two slots, so no two towers can ever share a stretch of road — a map wants at least one overlapping pair.';
        let best = 0;
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            let n = 0;
            for (const p of pts) {
              const both = dist(slots[i], p) <= T1_RANGE && dist(slots[j], p) <= T1_RANGE;
              n = both ? n + 1 : 0;
              // k consecutive samples span (k−1) intervals of road, not k —
              // counting them as k would credit 2.5u of overlap as 3.0u.
              const run = Math.max(0, n - 1) * SAMPLE_STEP;
              if (run > best) best = run;
            }
          }
        }
        return best >= 3 ? null
          : 'No two slots share more than ' + best.toFixed(1) + ' tiles of road — ' +
            'a map wants at least one pair overlapping 3 tiles so towers can combine.';
      }
    },
    {
      code: 'H5',
      why: 'anchor slots at spawn and castle',
      test(m) {
        const spawn = m.path[0];
        const nearSpawn = m.buildSlots.some(s => dist(s, spawn) <= 4);
        const nearCastle = m.buildSlots.some(s => dist(s, m.castle) <= 4);
        if (nearSpawn && nearCastle) return null;
        const missing = [!nearSpawn && 'the spawn', !nearCastle && 'the keep'].filter(Boolean).join(' or ');
        return 'No slot stands within 4 tiles of ' + missing +
          ' — the first and last stretches of road are the ones a player most wants to hold.';
      }
    },
    {
      code: 'H7',
      why: 'slot diversity by role',
      test(m) {
        const cs = corners(m.path);
        const straights = segments(m.path).filter(s => s.len >= 6)
          .map(s => ({ x: (s.a.x + s.b.x) / 2, z: (s.a.z + s.b.z) / 2 }));
        const roles = { corner: false, flank: false, anchor: false };
        for (const s of m.buildSlots) {
          if (cs.some(c => dist(s, c.at) <= 2)) roles.corner = true;
          if (straights.some(mid => dist(s, mid) <= 5)) roles.flank = true;
          if (dist(s, m.castle) <= 4) roles.anchor = true;
        }
        const missing = Object.keys(roles).filter(k => !roles[k]);
        return missing.length === 0 ? null
          : 'No slot plays the ' + missing.join(' or ') + ' role — ' +
            'a map reads flat when every plinth answers the same question.';
      }
    },
    {
      code: 'H8',
      why: 'path length + turn-count budget',
      test(m) {
        const len = pathLength(m.path);
        const segs = segments(m.path);
        const turns = corners(m.path).length;
        const long = segs.filter(s => s.len >= 6).length;
        const veryLong = segs.filter(s => s.len >= 10).length;
        const faults = [];
        if (len < 28 || len > 42) faults.push('the road runs ' + len.toFixed(1) + ' tiles (want 28–42)');
        if (turns < 5 || turns > 9) faults.push('it bends ' + turns + ' times (want 5–9)');
        if (long < 2) faults.push('only ' + long + ' segment is 6 tiles or longer (want at least 2)');
        if (veryLong > 1) faults.push(veryLong + ' segments run 10 tiles or longer (want at most 1)');
        return faults.length === 0 ? null : 'Path budget: ' + faults.join('; ') + '.';
      }
    },
    {
      code: 'H10',
      why: 'spawn telegraph',
      test(m) {
        const gap = edgeGap(m.path[0]);
        return gap <= 2 ? null
          : 'The road starts ' + gap.toFixed(1) + ' tiles in from the nearest edge — ' +
            'raiders should be seen entering the field, not appearing inside it.';
      }
    },
    {
      code: 'H11',
      why: 'slot count vs path length',
      test(m) {
        const len = pathLength(m.path);
        const lo = Math.ceil(len / 7), hi = Math.floor(len / 5);
        const n = m.buildSlots.length;
        if (n >= lo && n <= hi) return null;
        return n < lo
          ? 'Only ' + plural(n, 'slot', 'slots') + ' for ' + len.toFixed(1) + ' tiles of road — want ' + lo + '–' + hi + '.'
          : plural(n, 'slot', 'slots') + ' for ' + len.toFixed(1) + ' tiles of road — want ' + lo + '–' + hi +
            '; more than that and the map defends itself.';
      }
    },
    {
      code: 'H12',
      why: 'coverage redundancy',
      test(m) {
        const pts = samplePath(m.path);
        const slots = m.buildSlots;
        if (!slots.length) return null;   // NO_SLOTS is already a blocker
        let totalCovered = 0;
        const soleCount = new Array(slots.length).fill(0);
        for (const p of pts) {
          let n = 0, lastIdx = -1;
          for (let i = 0; i < slots.length; i++) {
            if (dist(slots[i], p) <= T1_RANGE) { n++; lastIdx = i; }
          }
          if (n > 0) totalCovered++;
          if (n === 1) soleCount[lastIdx]++;
        }
        if (!totalCovered) return null;   // H2/H3 already speak to a road nothing reaches
        let worst = -1, worstShare = 0;
        soleCount.forEach((c, i) => {
          const share = c / totalCovered;
          if (share > worstShare) { worstShare = share; worst = i; }
        });
        return worstShare <= 0.30 ? null
          : 'Slot ' + slots[worst].id + ' is the only cover for ' + Math.round(worstShare * 100) +
            '% of the defended road — sell it and the map falls. Spread the load below 30%.';
      }
    }
  ];

  // Rules from docs/level-design.md deliberately NOT promoted here:
  //   H6, H8a, H9  — already enforced as editor BLOCKERS.
  //   W3, W7       — the rulebook itself marks them "(manual)": prep duration
  //                  and reward economy are judgement calls about feel, not
  //                  computations over a map object. Approximating them would
  //                  be worse than leaving them to the author.

  // ─── Entry point ─────────────────────────────────────────────
  // Returns [] for a clean map. Never throws on a partial map — the editor
  // calls this on every keystroke, and a half-drawn path is the normal case,
  // not an error.
  function check(map) {
    if (!map || !Array.isArray(map.path) || map.path.length < 2) return [];
    if (!Array.isArray(map.buildSlots) || !map.castle) return [];
    const out = [];
    for (const rule of RULES) {
      let message = null;
      try {
        message = rule.test(map);
      } catch (e) {
        // A rule that throws must not take the whole oracle down with it —
        // a generate-and-reject loop needs the other nine verdicts.
        message = 'could not be evaluated (' + (e && e.message) + ')';
      }
      if (message) out.push({ code: rule.code, message, severity: 'warn' });
    }
    return out;
  }

  const api = {
    check, RULES,
    WORLD_HALF_X, WORLD_HALF_Z, T1_RANGE, SAMPLE_STEP,
    // Geometry helpers, exported so the generator can reuse the SAME
    // definitions the oracle judges by rather than reimplementing them.
    dist, segDist, segments, pathLength, corners, samplePath, edgeGap
  };
  if (typeof window !== 'undefined') window.CTD3MapRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
