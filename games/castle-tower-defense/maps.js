/* Map design — see docs/level-design.md for the H1–H12 rulebook.
   New maps must pass tools/map-editor.html validate() (which now
   enforces H6 — no slot on path). */
/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — maps.js
   Hand-authored maps. World units (x/z plane; y is up, ground = 0).
   Playfield is roughly 24 wide × 16 deep, centered at (0,0,0).
   ADR-028 §3 (3 maps, 2 difficulties, 5–8 slots/map) +
   ADR-030 §14 (registerMap helper) + §15 (axis-aligned paths) +
   §10 (decorations live in window.CTD3Decorations, NOT on Map shape).
   Exposes window.CTD3Maps.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function g(type, count, spacing, delay) {
    return { type, count, spacing, delay: delay || 0 };
  }
  function wave(groups, reward, opts) {
    return Object.assign({ enemies: groups, reward: reward || 20, isBoss: false }, opts || {});
  }

  // ─── Map registry (ADR-030 §6 + §14) ─────────────────────────
  // Splits a combined export (from the Cartographer Phase A2) into
  // a map array and the parallel CTD3Decorations registry.
  //
  // Two arrays, one ingestion path:
  //   OFFICIAL_MAPS — code-defined maps, populated at module-load by
  //     the registerMap() calls below. Source of truth: this file.
  //   USER_MAPS — player-authored maps, hydrated from localStorage
  //     'ctd3:userMaps' on init and persisted on each mutation.
  // Both flow through _ingestMap() which holds the shared validate +
  // push + decorations-registry logic. Wraps in try/catch so one bad
  // paste degrades to "that map missing", not "site doesn't boot"
  // (review-#2 MIN-3).
  const OFFICIAL_MAPS = [];
  const USER_MAPS = [];
  const USER_MAPS_KEY = 'ctd3:userMaps';
  window.CTD3Decorations = window.CTD3Decorations || {};

  function _ingestMap(combined, targetArray) {
    try {
      if (!combined || !combined.map || !combined.map.id) {
        console.error('[maps] _ingestMap: missing combined.map.id', combined);
        return false;
      }
      targetArray.push(combined.map);
      window.CTD3Decorations[combined.map.id] = combined.decorations || [];
      return true;
    } catch (e) {
      console.error('[maps] _ingestMap failed:', e, combined);
      return false;
    }
  }

  function registerMap(combined) { _ingestMap(combined, OFFICIAL_MAPS); }

  // Hydrate user maps from localStorage. Stored shape mirrors the editor's
  // combined export: { map, decorations, meta }. meta is preserved but not
  // surfaced through byId — runtime only needs map + decorations.
  (function hydrateUserMaps() {
    const stored = (window.SharedStorage && window.SharedStorage.safeGet)
      ? window.SharedStorage.safeGet(USER_MAPS_KEY, [])
      : [];
    if (!Array.isArray(stored)) return;
    for (const entry of stored) _ingestMap(entry, USER_MAPS);
  })();

  function persistUserMaps() {
    if (!window.SharedStorage || !window.SharedStorage.safeSet) return;
    // Round-trip the user maps as combined exports so reload reconstructs
    // the same decorations registry.
    const out = USER_MAPS.map(m => ({
      map: m,
      decorations: window.CTD3Decorations[m.id] || [],
      meta: m._meta || {}
    }));
    window.SharedStorage.safeSet(USER_MAPS_KEY, out);
  }

  function saveUserMap(combined) {
    if (!combined || !combined.map || !combined.map.id) return false;
    // Reject ids that collide with official maps. User ids are expected to
    // already carry the 'user:' prefix per the editor's id-generator.
    if (OFFICIAL_MAPS.some(m => m.id === combined.map.id)) {
      console.error('[maps] saveUserMap: id collides with official map', combined.map.id);
      return false;
    }
    // Replace-or-append semantics.
    const idx = USER_MAPS.findIndex(m => m.id === combined.map.id);
    if (idx >= 0) {
      USER_MAPS.splice(idx, 1);
      // Decorations are overwritten by _ingestMap below.
    }
    if (combined.meta) combined.map._meta = combined.meta;
    const ok = _ingestMap(combined, USER_MAPS);
    if (ok) persistUserMaps();
    return ok;
  }

  function deleteUserMap(id) {
    const idx = USER_MAPS.findIndex(m => m.id === id);
    if (idx < 0) return false;
    USER_MAPS.splice(idx, 1);
    delete window.CTD3Decorations[id];
    persistUserMaps();
    return true;
  }

  function renameUserMap(id, newDisplayName) {
    const m = USER_MAPS.find(x => x.id === id);
    if (!m) return false;
    m.displayName = String(newDisplayName);
    if (m._meta) m._meta.updatedAt = Date.now();
    persistUserMaps();
    return true;
  }

  function listOfficial() { return OFFICIAL_MAPS.slice(); }
  function listUserMaps() { return USER_MAPS.slice(); }

  // ─── MAP 1 — The Plains ──────────────────────────────────────
  // Old (ribbon) path: (-12,4) (-8,3) (-4,2) (0,3) (3,5) (6,2) (8,-2) (11,-2)
  //   — gentle SE drift with smooth diagonals.
  // New (tile-grid) path (ADR-030 §15): axis-aligned staircase preserving
  // the rough "drift south then east" shape. 7 segments, 1 corner each turn.
  registerMap({
    map: {
      id: 'plains',
      displayName: 'The Plains',
      roman: 'Field the First',
      chip: 'Open Field',
      chipKind: 'gold',
      description: 'Gentle hills and an unbroken road. The keep holds open ground; archers will see far.',
      thumbIcon: 'map_plains',
      unlockRequirement: 0,
      theme: 'plains',
      castle: { x: 11, y: 0, z: -2 },
      path: [
        { x: -12, z: 4 }, { x: -4, z: 4 },
        { x: -4, z: 1 }, { x: 3, z: 1 },
        { x: 3, z: 5 }, { x: 6, z: 5 },
        { x: 6, z: -2 }, { x: 11, z: -2 }
      ],
      buildSlots: [
        { id: 's1', x: -7, z: 0 },
        { id: 's2', x: -3, z: -1 },
        { id: 's3', x: 1, z: 7 },
        { id: 's4', x: 4, z: 0 },
        { id: 's5', x: 8, z: 1 },
        { id: 's6', x: 9, z: -4 }
      ],
      // ─── ADR-040 D28 — PLAINS: the teaching field ───────────
      // Signature: the teaching arc itself. One new idea per wave, in the
      // order mass → speed → bulk → flight → armor → combination. This map
      // deliberately carries NO slime, ghost, juggernaut or drake: the first
      // field teaches the base five and nothing else.
      // Group delays leave ≥3.5s between groups (editor rule W2, "rebuild
      // room") — which is why wave 2 arrives as two ranks of the same
      // creature rather than one long file.
      waves: [
        // w1 "First Light" — Rabble: footman x1
        wave([ g('footman', 1, 0, 0) ], 14),
        // w2 "The Marching Line" — Rabble: footman x6
        wave([ g('footman', 3, 700, 0), g('footman', 3, 700, 4900) ], 16),
        // w3 "Outriders" — Swarm: runner x4, footman x3
        wave([ g('runner', 4, 650, 0), g('footman', 3, 600, 5450) ], 18),
        // w4 "The Iron Few" — Tank line: heavy x3, footman x1
        wave([ g('heavy', 3, 1500, 0), g('footman', 1, 600, 6500) ], 20),
        // w5 "First Wings" — Air raid: skirmisher x7, heavy x1, footman x3
        wave([ g('skirmisher', 7, 800, 0), g('heavy', 1, 1500, 8300), g('footman', 3, 550, 11800) ], 22),
        // w6 "The Shield Wall" — Shield wall: shielded x5, footman x3, heavy x2
        wave([ g('shielded', 5, 1150, 0), g('footman', 3, 550, 8100), g('heavy', 2, 1400, 12700) ], 24),
        // w7 "Open-Field Muster" — Mixed arms: skirmisher x6, shielded x5, runner x2, heavy x3
        wave([ g('skirmisher', 6, 800, 0), g('shielded', 3, 1150, 7500), g('runner', 2, 650, 13300),
               g('heavy', 3, 1400, 17450), g('shielded', 2, 1150, 23750) ], 26),
        // w8 "The Long Muster" — Mixed arms: shielded x7, runner x6, skirmisher x3, heavy x7
        wave([ g('shielded', 5, 1200, 0), g('runner', 6, 550, 8300), g('skirmisher', 3, 900, 14550),
               g('heavy', 7, 1100, 19850), g('shielded', 2, 1200, 29950) ], 60)
      ]
    },
    decorations: [
      { type: 'detail_tree',        x: -10.5, z: 7.2 },
      { type: 'detail_tree_large',  x: -8.4,  z: 6.5 },
      { type: 'detail_rocks',       x: -6.3,  z: 6.8 },
      { type: 'detail_tree',        x: -2,    z: 6.8 },
      { type: 'detail_rocks_large', x: -1.5,  z: -3.5 },
      { type: 'detail_tree',        x: 1.2,   z: -3.2 },
      { type: 'detail_tree_large',  x: 5,     z: -4.5 },
      { type: 'detail_rocks',       x: 4.7,   z: 8.2 },
      { type: 'detail_tree',        x: 8.5,   z: 4.4 },
      { type: 'detail_tree',        x: 10.2,  z: 1.8 }
    ]
  });

  // ─── MAP 2 — The Whispering Wood ─────────────────────────────
  // Old path (Field the Second): smooth wandering polyline with 10 diagonals.
  // New: axis-aligned. 7 segments. Slot adjustments below (review-#2 MAJ-5):
  //   - s2 (6,1) → (8,1) (was ON new x=6 segment)
  //   - s4 (0,4) → (0,6) (was ON new z=4 segment)
  //   - s6 (-6,4) → (-6,6) (was ON new z=4 segment)
  registerMap({
    map: {
      id: 'forest',
      displayName: 'The Whispering Wood',
      roman: 'Field the Second',
      chip: 'Tight Path',
      chipKind: '',
      description: 'Trees crowd the road. Sight lines are short — set thy towers wisely, for the wolves run fast.',
      thumbIcon: 'map_forest',
      unlockRequirement: 0,
      theme: 'forest',
      castle: { x: -11, y: 0, z: 5 },
      path: [
        { x: 12, z: -6 }, { x: 6, z: -6 },
        { x: 6, z: 2 },   { x: 3, z: 2 },
        { x: 3, z: 5 },   { x: -2, z: 5 },
        { x: -2, z: 8 },  { x: -11, z: 8 },
        { x: -11, z: 5 }
      ],
      buildSlots: [
        { id: 's1', x: 9,  z: -3 },
        { id: 's2', x: 8,  z: 1 },
        { id: 's3', x: 3,  z: 0 },
        { id: 's4', x: 0,  z: 6 },
        { id: 's5', x: -3, z: 5 },
        { id: 's6', x: -6, z: 6 }
      ],
      // ─── ADR-040 D28 — THE WHISPERING WOOD: swarm ───────────
      // Signature: SWARM. The map's own description says "the wolves run
      // fast", and its tight path and short sight lines are exactly what a
      // running crowd punishes. Wave 7 is that signature undiluted (18
      // runners); wave 8 leads it into a mixed climax. Slime is its texture,
      // ghost a mid-wave guest — Snowfall owns spectral.
      waves: [
        // w1 "Under the Boughs" — Rabble: footman x5
        wave([ g('footman', 2, 800, 0), g('footman', 3, 700, 4300) ], 14),
        // w2 "Wolves at the Trail" — Swarm: runner x4, footman x1
        wave([ g('runner', 4, 600, 0), g('footman', 1, 550, 5300) ], 16),
        // w3 "The Ooze" — Split mass: slime x2, footman x3
        wave([ g('slime', 2, 1200, 0), g('footman', 3, 550, 4700) ], 18),
        // w4 "Fleet of Foot" — Swarm: runner x6, slime x1, footman x1
        wave([ g('runner', 6, 550, 0), g('slime', 1, 1200, 6250), g('footman', 1, 550, 9750) ], 20),
        // w5 "Thicket Guard" — Shield wall: shielded x5, skirmisher x3, footman x1
        wave([ g('shielded', 5, 1150, 0), g('skirmisher', 3, 850, 8100), g('footman', 1, 550, 13300) ], 22),
        // w6 "Cold Lanterns" — Spectral: ghost x9, runner x4, heavy x1
        wave([ g('ghost', 9, 780, 0), g('runner', 4, 600, 9740), g('heavy', 1, 1400, 15040) ], 24),
        // w7 "The Running Tide" — Swarm: runner x18, slime x2, shielded x4
        wave([ g('runner', 15, 470, 0), g('slime', 2, 1100, 10080), g('shielded', 4, 1150, 14680),
               g('runner', 3, 470, 21630) ], 26),
        // w8 "The Wood Wakes" — Mixed arms: runner x10, shielded x7, skirmisher x4, heavy x9
        wave([ g('runner', 10, 450, 0), g('shielded', 6, 1000, 7550), g('skirmisher', 4, 750, 16050),
               g('heavy', 9, 1200, 21800), g('shielded', 1, 1000, 34900) ], 70)
      ]
    },
    decorations: [
      { type: 'detail_tree_large', x: 10.3, z: -3.8 },
      { type: 'detail_tree',       x: 9.2,  z: -4.8 },
      { type: 'detail_tree_large', x: 4,    z: -3 },
      { type: 'detail_tree',       x: 2.6,  z: -4.5 },
      { type: 'detail_tree_large', x: 4.4,  z: 4.2 },
      { type: 'detail_tree',       x: 2,    z: 5.2 },
      { type: 'detail_tree_large', x: -4.5, z: -1 },
      { type: 'detail_tree',       x: -5.3, z: 7.5 },
      { type: 'detail_tree',       x: -10.5, z: 7.8 },
      { type: 'detail_tree_large', x: -10.6, z: 1.5 },
      { type: 'detail_rocks',      x: -3.5, z: -2.8 },
      { type: 'detail_rocks',      x: -7,   z: -1.5 }
    ]
  });

  // ─── MAP 3 — The Stone Gate ──────────────────────────────────
  // Old path (Field the Third): zigzag with 12 diagonals.
  // New: axis-aligned, 11 segments. Slot adjustments:
  //   - s2 (-6,-6) → (-4,-6) (was ON new x=-12..-6 z=-6 segment)
  //   - s3 (-4,0)  → (-4,2)  (was ON new z=0 segment from x=-6 to x=-1)
  //   - s6 (5,1)   → (7,1)   (was ON new x=5 z=-2..2 segment)
  registerMap({
    map: {
      id: 'mountain',
      displayName: 'The Stone Gate',
      roman: 'Field the Third',
      chip: 'Sealed',
      chipKind: 'locked',
      description: 'A narrow pass between black peaks. They say a Captain walks here when the moon is full.',
      thumbIcon: 'map_mountain',
      unlockRequirement: 5,
      theme: 'mountain',
      castle: { x: 11, y: 0, z: 3 },
      path: [
        { x: -12, z: -7 }, { x: -6, z: -7 },
        { x: -6, z: 0 },   { x: 0, z: 0 },
        { x: 0, z: -4 },   { x: 7, z: -4 },
        { x: 7, z: 3 },    { x: 11, z: 3 }
      ],
      buildSlots: [
        { id: 's1', x: -9, z: -5 },
        { id: 's2', x: -8, z: -2 },
        { id: 's3', x: -3, z: -2 },
        { id: 's4', x: 2,  z: -2 },
        { id: 's5', x: 4,  z: -2 },
        { id: 's6', x: 5,  z: 0 },
        { id: 's7', x: 9,  z: 1 }
      ],
      // ─── ADR-040 D28 — THE STONE GATE: siege, then the boss ──
      // Signature: SIEGE, and JUGGERNAUT IS EXCLUSIVE TO THIS MAP (it used to
      // appear on three). Wave 6 is one juggernaut with escort, wave 7 two —
      // and wave 8 is the campaign's only boss, which is this map's deliberate
      // exception to "wave 8 = signature leading a mixed climax".
      // The bespoke reward ladder (18/24/30/38/48/60, then 26, then a 250 boss
      // purse) is deliberate: w7 is 1,200 HP of indivisible juggernaut and w8
      // an 1,800-HP captain, so the curve needs more cumulative gold beneath
      // both. The dip to 26 before the boss is what holds the finale spike at
      // 1.57 instead of letting it slide toward the other maps' 1.30.
      waves: [
        // w1 "At the Gate" — Rabble: footman x5
        wave([ g('footman', 2, 800, 0), g('footman', 3, 650, 4300) ], 18),
        // w2 "Stone and Bone" — Tank line: heavy x1, footman x3
        wave([ g('heavy', 1, 0, 0), g('footman', 3, 600, 3500) ], 24),
        // w3 "The Narrow Watch" — Shield wall: shielded x2, skirmisher x2, footman x1
        wave([ g('shielded', 2, 1300, 0), g('skirmisher', 2, 900, 4800), g('footman', 1, 600, 9200) ], 30),
        // w4 "Hammerfall" — Tank line: heavy x3, shielded x1
        wave([ g('heavy', 3, 1450, 0), g('shielded', 1, 1300, 6400) ], 38),
        // w5 "The Warband" — Mixed arms: runner x6, skirmisher x4, heavy x1, footman x1
        wave([ g('runner', 6, 550, 0), g('skirmisher', 4, 850, 6250), g('heavy', 1, 1500, 12300),
               g('footman', 1, 600, 15800) ], 48),
        // w6 "First Siege" — Siege: juggernaut x1, footman x5, heavy x1
        wave([ g('juggernaut', 1, 0, 0), g('footman', 3, 550, 3500), g('heavy', 1, 1600, 8100),
               g('footman', 2, 550, 11600) ], 60),
        // w7 "Second Siege" — Siege: juggernaut x2, skirmisher x3, footman x1
        wave([ g('juggernaut', 2, 2400, 0), g('skirmisher', 3, 850, 5900), g('footman', 1, 550, 11100) ], 26),
        // w8 "The Captain Walks" — Boss: captain x1, runner x2, shielded x2, heavy x1, footman x4
        wave([ g('captain', 1, 0, 0), g('runner', 2, 600, 3500), g('shielded', 2, 1300, 7600),
               g('heavy', 1, 1500, 12400), g('footman', 4, 550, 15900) ], 250, { isBoss: true })
      ]
    },
    decorations: [
      { type: 'detail_rocks_large', x: -10.5, z: -3.2 },
      { type: 'detail_rocks',       x: -11.2, z: -1.4 },
      { type: 'detail_rocks_large', x: -8.4,  z: 2.5 },
      { type: 'detail_crystal',     x: -2.4,  z: -7.2 },
      { type: 'detail_rocks',       x: 0.8,   z: -5.3 },
      { type: 'detail_rocks_large', x: 8.5,   z: 1.2 },
      { type: 'detail_crystal',     x: 1.4,   z: 5.5 },
      { type: 'detail_crystal', size: 'large', x: -3.6, z: 5.5 },
      { type: 'detail_rocks',       x: 9.5,   z: -3 },
      { type: 'detail_rocks_large', x: 4.8,   z: 8.8 }
    ]
  });

  // ─── MAP 4 — Tidewater Bend (re-tiled) ───────────────────────
  // Authored 2026-05-17 with The Cartographer (ADR-029 Phase A1).
  // Re-tiled 2026-05-18 to axis-aligned path per ADR-030 §15.
  // Original path preserved here for the user's reference (diagonals):
  //   (-12,5) (-8,3) (-4,-2) (2,0) (6,-3) (10,1)
  // New path: staircase that follows the same overall SE-drift shape.
  registerMap({
    map: {
      id: 'tidewater',
      displayName: 'Tidewater Bend',
      roman: 'Field the Fourth',
      chip: 'River Pass',
      chipKind: '',
      description: 'The river winds slow under the trees. Mind the hidden trails.',
      thumbIcon: 'map_forest',
      unlockRequirement: 0,
      theme: 'forest',
      castle: { x: 10, y: 0, z: 1 },
      path: [
        { x: -12, z: 5 },  { x: -8, z: 5 },
        { x: -8, z: -2 },  { x: 2, z: -2 },
        { x: 2, z: 1 },    { x: 6, z: 1 },
        { x: 6, z: -3 },   { x: 10, z: -3 },
        { x: 10, z: 1 }
      ],
      buildSlots: [
        { id: 's1', x: -10, z: 6 },
        { id: 's2', x: -6,  z: -3 },
        { id: 's3', x: 0,   z: -3 },
        { id: 's4', x: 4,   z: 3 },
        { id: 's5', x: 9,   z: 0 },
        { id: 's6', x: -7,  z: 0 },
        { id: 's7', x: 1,   z: 0 }
      ],
      // ─── ADR-040 D28 — TIDEWATER BEND: split mass ───────────
      // Signature: SPLIT MASS. "Mind the hidden trails" — what you kill
      // reveals more. Wave 7 is seven slimes undiluted (21 bodies).
      // Wave 8 is deliberately LED by heavy+shielded with only two slimes as
      // texture: the ADR-040 anchor rule keeps low-contrast types (ghost,
      // slime) to ≤30% of an anchor wave's bodies and never the HP lead,
      // until the roster-polish surround work lands. Here that is 6/25 = 24%.
      waves: [
        // w1 "Slack Water" — Rabble: footman x5
        wave([ g('footman', 2, 800, 0), g('footman', 3, 700, 4300) ], 14),
        // w2 "The First Bloom" — Split mass: slime x1, footman x3
        wave([ g('slime', 1, 0, 0), g('footman', 3, 550, 3500) ], 16),
        // w3 "Driftwood" — Tank line: heavy x2, footman x2
        wave([ g('heavy', 2, 1500, 0), g('footman', 2, 550, 5000) ], 18),
        // w4 "The Second Bloom" — Split mass: slime x2, runner x3, footman x1
        wave([ g('slime', 2, 1200, 0), g('runner', 3, 650, 4700), g('footman', 1, 550, 9500) ], 20),
        // w5 "Bank and Bar" — Shield wall: shielded x4, heavy x1, footman x2
        wave([ g('shielded', 4, 1150, 0), g('heavy', 1, 1500, 6950), g('footman', 2, 550, 10450) ], 22),
        // w6 "Reedwing" — Air raid: skirmisher x10, slime x2, runner x2
        wave([ g('skirmisher', 10, 800, 0), g('slime', 2, 1100, 10700), g('runner', 2, 620, 15300) ], 24),
        // w7 "The Tide Comes In" — Split mass: slime x7, skirmisher x4, shielded x3
        wave([ g('slime', 7, 1000, 0), g('skirmisher', 4, 800, 9500), g('shielded', 3, 1150, 15400) ], 26),
        // w8 "The Tide Divides" — Mixed arms: shielded x5, slime x2, runner x4, heavy x8, footman x2
        wave([ g('shielded', 5, 1150, 0), g('slime', 2, 1000, 8100), g('runner', 4, 600, 12600),
               g('heavy', 8, 1250, 17900), g('footman', 2, 550, 30150) ], 60)
      ]
    },
    decorations: [
      { type: 'detail_tree',       x: -11, z: 7.5 },
      { type: 'detail_tree_large', x: -9.5, z: 8 },
      { type: 'detail_tree',       x: -5.5, z: -5 },
      { type: 'detail_tree_large', x: -3,   z: -5.2 },
      { type: 'detail_rocks',      x: 0.5,  z: 1.5 },
      { type: 'detail_tree',       x: 4.4,  z: -5.3 },
      { type: 'detail_tree_large', x: 4.6,  z: 5 },
      { type: 'detail_rocks',      x: 8.7,  z: 2.4 },
      { type: 'detail_tree',       x: 9.5,  z: -5.8 },
      { type: 'detail_rocks_large', x: -3,  z: 7.6 }
    ]
  });

  // ─── MAP 5 — Snowfall Pass (ADR-030 §16, Phase 5) ────────────
  // Theme: 'mountain'; runtime substitutes snow_tile_* by map.id (review-#1
  // C-3). Unlock at 14★ — effectively post-Mountain (review-#2 MIN-1).
  // No captain in waves (Mountain owns the captain).
  registerMap({
    map: {
      id: 'snowfall_pass',
      displayName: 'Snowfall Pass',
      roman: 'Field the Fifth',
      chip: 'Frozen',
      chipKind: '',
      description: 'A high col between the peaks. The crystals remember every step.',
      thumbIcon: 'map_mountain',
      unlockRequirement: 14,
      theme: 'mountain',
      castle: { x: 12, y: 0, z: 1 },
      path: [
        { x: -13, z: 0 }, { x: -9, z: 0 },
        { x: -9, z: 4 },  { x: -4, z: 4 },
        { x: -4, z: -2 }, { x: 3, z: -2 },
        { x: 3, z: 1 },   { x: 12, z: 1 }
      ],
      buildSlots: [
        { id: 's1', x: -11, z: 2 },
        { id: 's2', x: -7,  z: 2 },
        { id: 's3', x: -6,  z: -3 },
        { id: 's4', x: 0,   z: 1 },
        { id: 's5', x: 5,   z: -1 },
        { id: 's6', x: 10,  z: 3 }
      ],
      // ─── ADR-040 D28 — SNOWFALL PASS: spectral ──────────────
      // Signature: SPECTRAL. "The crystals remember every step." Wave 7 is
      // that signature at full strength — seventeen ghosts, the largest
      // spectral wall in the campaign. Juggernaut is gone (Mountain owns
      // siege); the drake visits at w6 and w8.
      // Wave 8 is LED by drake+heavy per the anchor rule, with ghosts present
      // in volume but neither the HP lead nor >30% of bodies (5/20 = 25%).
      waves: [
        // w1 "First Snow" — Rabble: footman x5
        wave([ g('footman', 2, 800, 0), g('footman', 3, 650, 4300) ], 14),
        // w2 "The Cold Road" — Swarm: runner x4, footman x1
        wave([ g('runner', 4, 600, 0), g('footman', 1, 550, 5300) ], 16),
        // w3 "Pale Company" — Spectral: ghost x4, footman x2
        wave([ g('ghost', 4, 850, 0), g('footman', 2, 550, 6050) ], 18),
        // w4 "Frostbacks" — Shield wall: shielded x4, footman x4
        wave([ g('shielded', 4, 1150, 0), g('footman', 4, 550, 6950) ], 20),
        // w5 "The Long Cold" — Mixed arms: runner x4, skirmisher x3, heavy x2, footman x3
        wave([ g('runner', 4, 550, 0), g('skirmisher', 3, 800, 5150), g('heavy', 2, 1450, 10250),
               g('footman', 3, 550, 15200) ], 22),
        // w6 "Rimeguard" — Shield wall: drake x2, shielded x4, footman x2
        //   Labelled Shield wall, not Air raid, on the evidence: only 2 of 8
        //   bodies fly. Riverbend owns Air raid outright; this is Snowfall's
        //   armour wave, and the drakes are the beat that says armour now
        //   comes from above too.
        wave([ g('drake', 2, 2200, 0), g('shielded', 4, 1150, 5700), g('footman', 2, 550, 12650) ], 24),
        // w7 "What the Crystals Keep" — Spectral: ghost x17, skirmisher x6, shielded x1
        wave([ g('ghost', 13, 720, 0), g('skirmisher', 6, 750, 12140), g('shielded', 1, 1150, 19390),
               g('ghost', 4, 720, 22890) ], 26),
        // w8 "The Pass Remembers" — Mixed arms: drake x5, ghost x5, shielded x4, heavy x4, footman x2
        wave([ g('drake', 5, 1800, 0), g('ghost', 5, 730, 10700), g('shielded', 4, 1150, 17120),
               g('heavy', 4, 1250, 24070), g('footman', 2, 550, 31320) ], 120)
      ]
    },
    decorations: [
      { type: 'detail_crystal',                   x: -11.2, z: 6.4 },
      { type: 'detail_crystal',  size: 'large',   x: -7,    z: -4 },
      { type: 'detail_rocks_large',               x: -12,   z: -3.2 },
      { type: 'detail_rocks_large',               x: -2,    z: 4.5 },
      { type: 'detail_crystal',                   x: -3,    z: 6.2 },
      { type: 'detail_rocks_large',               x: 1.4,   z: -5.5 },
      { type: 'detail_crystal',  size: 'large',   x: 6.8,   z: 5.4 },
      { type: 'detail_rocks_large',               x: 4.2,   z: 5.6 },
      { type: 'detail_crystal',                   x: 10.5,  z: -3.4 },
      { type: 'detail_rocks_large',               x: 11.2,  z: -4 }
    ]
  });

  // ─── MAP 6 — Riverbend (ADR-030 §16, Phase 5) ────────────────
  // Theme: 'forest'. Unlock at 13★ — mid-late game. River decorations
  // (tile_river_*) sit along path edges; one bridge at a path crossing.
  // Wave composition leans runner + skirmisher for a mobility test.
  registerMap({
    map: {
      id: 'riverbend',
      displayName: 'Riverbend',
      roman: 'Field the Sixth',
      chip: 'River Pass',
      chipKind: '',
      description: 'The river curls slow. A footbridge keeps the keep dry — for now.',
      thumbIcon: 'map_forest',
      unlockRequirement: 13,
      theme: 'forest',
      castle: { x: 12, y: 0, z: -2 },
      path: [
        { x: -13, z: 3 }, { x: -5, z: 3 },
        { x: -5, z: -2 }, { x: 2, z: -2 },
        { x: 2, z: 1 },   { x: 8, z: 1 },
        { x: 8, z: -2 },  { x: 12, z: -2 }
      ],
      buildSlots: [
        { id: 's1', x: -9, z: 5 },
        { id: 's2', x: -3, z: 0 },
        { id: 's3', x: 4,  z: -4 },
        { id: 's4', x: 5,  z: 3 },
        { id: 's5', x: 10, z: 1 },
        { id: 's6', x: -4, z: 5 }
      ],
      // ─── ADR-040 D28 — RIVERBEND: air raid ──────────────────
      // Signature: AIR RAID, and home of the DRAKE. "A footbridge keeps the
      // keep dry" — fliers do not need the bridge. Waves 3, 5, 6 and 7 are all
      // air-led and wave 7 is the undiluted version.
      // The drake is what makes this map possible: a wave-8 air budget of
      // ~2,500 HP built from 38-HP skirmishers and 55-HP ghosts alone would
      // need 46+ bodies against a 35-spawn ceiling, and the 26-ghost version
      // that does fit reads as Snowfall's spectral signature rather than this
      // map's. Six drakes carry the same HP in 26 effective spawns.
      waves: [
        // w1 "Low Water" — Rabble: footman x5
        wave([ g('footman', 2, 800, 0), g('footman', 3, 650, 4300) ], 14),
        // w2 "The Ford" — Swarm: runner x4, footman x1
        wave([ g('runner', 4, 600, 0), g('footman', 1, 550, 5300) ], 16),
        // w3 "Wings over the Bend" — Air raid: skirmisher x7, footman x1
        wave([ g('skirmisher', 5, 800, 0), g('skirmisher', 2, 800, 6700), g('footman', 1, 550, 11000) ], 18),
        // w4 "Bridgework" — Tank line: heavy x3, runner x3
        wave([ g('heavy', 3, 1450, 0), g('runner', 3, 620, 6400) ], 20),
        // w5 "The Second Flight" — Air raid: skirmisher x9, ghost x5
        wave([ g('skirmisher', 6, 780, 0), g('ghost', 5, 800, 7400), g('skirmisher', 3, 780, 14100) ], 22),
        // w6 "Ironwing" — Air raid: skirmisher x5, runner x2, drake x3
        wave([ g('skirmisher', 4, 800, 0), g('runner', 2, 600, 5900), g('drake', 3, 2000, 10000),
               g('skirmisher', 1, 800, 17500) ], 24),
        // w7 "Nothing Uses the Bridge" — Air raid: skirmisher x6, ghost x6, drake x4
        wave([ g('skirmisher', 6, 750, 0), g('ghost', 4, 780, 7250), g('drake', 4, 1900, 13090),
               g('ghost', 2, 780, 22290) ], 26),
        // w8 "The Sky Falls" — Mixed arms: skirmisher x8, ghost x6, shielded x6, drake x6
        wave([ g('skirmisher', 8, 700, 0), g('ghost', 6, 760, 8400), g('shielded', 4, 1150, 15700),
               g('drake', 6, 1800, 22650), g('shielded', 2, 1150, 35150) ], 110)
      ]
    },
    decorations: [
      { type: 'detail_tree',         x: -11,   z: 5.4 },
      { type: 'detail_tree_large',   x: -7.5,  z: 5.6 },
      { type: 'tile_river_straight', x: -12.5, z: -1, rotation: 1.57 },
      { type: 'tile_river_straight', x: -10.5, z: -1, rotation: 1.57 },
      { type: 'detail_tree',         x: -2.5,  z: -5 },
      { type: 'tile_river_bridge',   x: 0,     z: 0,  rotation: 1.57 },
      { type: 'detail_tree_large',   x: 0,     z: 5 },
      { type: 'detail_tree',         x: 5.5,   z: -5 },
      { type: 'tile_river_corner',   x: 11,    z: 4 },
      { type: 'detail_tree_large',   x: 9.5,   z: 4 },
      { type: 'detail_tree',         x: 11,    z: -5 }
    ]
  });

  // byId attaches a derived `source` field at lookup time so callers can
  // distinguish official maps from user-authored ones without storing the
  // flag (id prefix 'user:' is the source of truth).
  function byId(id) {
    const off = OFFICIAL_MAPS.find(m => m.id === id);
    if (off) { off.source = 'official'; return off; }
    const usr = USER_MAPS.find(m => m.id === id);
    if (usr) { usr.source = 'user'; return usr; }
    return null;
  }

  // ADR-028 §3: 2 difficulties; ADR-030 §17: 6 official maps total.
  // User maps don't inflate the star ceiling.
  function maxStars() { return OFFICIAL_MAPS.length * 3 * 2; }

  window.CTD3Maps = {
    byId, maxStars,
    listOfficial, listUserMaps,
    saveUserMap, deleteUserMap, renameUserMap
  };
})();
