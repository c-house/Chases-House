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
      waves: [
        wave([ g('footman', 1, 0, 0) ], 15),
        wave([ g('footman', 6, 700, 0) ], 18),
        wave([ g('footman', 4, 600, 0), g('skirmisher', 2, 1100, 4500) ], 22),
        wave([ g('heavy', 3, 1400, 0), g('footman', 5, 500, 5000) ], 25),
        wave([ g('runner', 4, 700, 0), g('footman', 6, 500, 4000) ], 28),
        wave([ g('shielded', 3, 1300, 0), g('footman', 4, 500, 5000) ], 30),
        wave([ g('skirmisher', 5, 800, 0), g('heavy', 2, 1800, 5500) ], 32),
        wave([ g('heavy', 4, 1100, 0), g('shielded', 3, 1200, 6000), g('runner', 4, 600, 12000) ], 60)
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
      waves: [
        wave([ g('footman', 8, 600, 0) ], 18),
        wave([ g('runner', 5, 700, 0), g('footman', 4, 500, 4500) ], 22),
        wave([ g('skirmisher', 4, 900, 0), g('footman', 6, 500, 5000) ], 26),
        wave([ g('heavy', 3, 1300, 0), g('runner', 5, 600, 5500) ], 30),
        wave([ g('shielded', 4, 1100, 0), g('skirmisher', 3, 1000, 6000) ], 32),
        wave([ g('runner', 10, 450, 0), g('heavy', 2, 1800, 6000) ], 36),
        wave([ g('skirmisher', 8, 700, 0), g('shielded', 3, 1200, 7000) ], 44),
        wave([ g('shielded', 6, 950, 0), g('runner', 8, 450, 7000), g('skirmisher', 4, 900, 11000) ], 70)
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
      waves: [
        wave([ g('footman', 10, 550, 0) ], 22),
        wave([ g('heavy', 3, 1300, 0), g('runner', 4, 700, 4500) ], 26),
        wave([ g('skirmisher', 5, 850, 0), g('shielded', 2, 1500, 5000) ], 30),
        wave([ g('shielded', 5, 1000, 0), g('heavy', 2, 1700, 6000) ], 34),
        wave([ g('runner', 10, 450, 0), g('skirmisher', 4, 900, 6000) ], 38),
        wave([ g('heavy', 6, 1000, 0), g('shielded', 4, 1100, 6500) ], 42),
        wave([ g('skirmisher', 10, 600, 0), g('shielded', 4, 1100, 7000) ], 50),
        wave([ g('heavy', 4, 1400, 0), g('shielded', 4, 1300, 6000),
               g('captain', 1, 0, 14000), g('runner', 6, 600, 18000) ], 250, { isBoss: true })
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
      waves: [
        wave([ g('footman', 6, 700, 0) ], 18),
        wave([ g('footman', 5, 500, 0), g('runner', 3, 800, 4000) ], 22),
        wave([ g('heavy', 3, 1300, 0), g('footman', 6, 500, 5000) ], 28)
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
      waves: [
        wave([ g('footman', 10, 550, 0) ], 22),
        wave([ g('runner', 6, 600, 0), g('footman', 4, 500, 4000) ], 26),
        wave([ g('skirmisher', 5, 850, 0), g('shielded', 2, 1500, 5000) ], 30),
        wave([ g('heavy', 4, 1200, 0), g('skirmisher', 4, 850, 5500) ], 34),
        wave([ g('shielded', 5, 1000, 0), g('runner', 6, 600, 6000) ], 38),
        wave([ g('runner', 12, 400, 0), g('heavy', 3, 1700, 7000) ], 44),
        wave([ g('skirmisher', 10, 600, 0), g('shielded', 4, 1100, 7000) ], 52),
        wave([ g('heavy', 5, 1300, 0), g('shielded', 5, 1100, 6000),
               g('skirmisher', 8, 700, 14000), g('runner', 8, 500, 18000) ], 120)
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
      waves: [
        wave([ g('footman', 8, 550, 0) ], 20),
        wave([ g('runner', 6, 550, 0), g('footman', 4, 500, 4500) ], 24),
        wave([ g('skirmisher', 5, 750, 0), g('runner', 5, 600, 5000) ], 28),
        wave([ g('runner', 10, 450, 0), g('shielded', 3, 1300, 5500) ], 32),
        wave([ g('skirmisher', 8, 650, 0), g('heavy', 2, 1700, 6500) ], 36),
        wave([ g('runner', 14, 380, 0), g('skirmisher', 4, 750, 7500) ], 42),
        wave([ g('shielded', 6, 950, 0), g('runner', 10, 450, 7000) ], 50),
        wave([ g('runner', 16, 400, 0), g('skirmisher', 8, 600, 8000),
               g('shielded', 4, 1200, 14000), g('heavy', 3, 1500, 18000) ], 110)
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
