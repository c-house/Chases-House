/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — maps.js
   Three hand-authored maps. World units (x/z plane; y is up, ground = 0).
   Playfield is roughly 24 wide × 16 deep, centered at (0,0,0).
   ADR-028 §3: 3 maps, 2 difficulties, 5–8 slots/map.
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

  // ─── MAP 1 — The Plains ──────────────────────────────────────
  const PLAINS = {
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
      { x: -12, z: 4 }, { x: -8, z: 3 }, { x: -4, z: 2 }, { x: 0, z: 3 },
      { x: 3, z: 5 }, { x: 6, z: 2 }, { x: 8, z: -2 }, { x: 11, z: -2 }
    ],
    buildSlots: [
      { id: 's1', x: -7, z: 0 },
      { id: 's2', x: -3, z: -1 },
      { id: 's3', x: 1, z: 7 },
      { id: 's4', x: 4, z: 0 },
      { id: 's5', x: 8, z: 1 },
      { id: 's6', x: 9, z: -5 }
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
  };

  // ─── MAP 2 — The Whispering Wood ─────────────────────────────
  const FOREST = {
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
      { x: 12, z: -6 }, { x: 9, z: -5 }, { x: 6, z: -2 }, { x: 7, z: 1 },
      { x: 4, z: 3 }, { x: 1, z: 1 }, { x: -2, z: 3 }, { x: -5, z: 0 },
      { x: -8, z: 2 }, { x: -10, z: 5 }, { x: -11, z: 5 }
    ],
    buildSlots: [
      { id: 's1', x: 9, z: -3 },
      { id: 's2', x: 6, z: 1 },
      { id: 's3', x: 3, z: 0 },
      { id: 's4', x: 0, z: 4 },
      { id: 's5', x: -3, z: 0 },
      { id: 's6', x: -6, z: 4 },
      { id: 's7', x: -9, z: 0 }
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
  };

  // ─── MAP 3 — The Stone Gate ──────────────────────────────────
  const MOUNTAIN = {
    id: 'mountain',
    displayName: 'The Stone Gate',
    roman: 'Field the Third',
    chip: 'Sealed',
    chipKind: 'locked',
    description: 'A narrow pass between black peaks. They say a Captain walks here when the moon is full.',
    thumbIcon: 'map_mountain',
    unlockRequirement: 5,
    theme: 'mountain',
    castle: { x: 11, y: 0, z: 6 },
    path: [
      { x: -12, z: -6 }, { x: -9, z: -5 }, { x: -6, z: -3 }, { x: -8, z: 0 },
      { x: -4, z: 2 }, { x: -1, z: 1 }, { x: 2, z: -2 }, { x: 5, z: -1 },
      { x: 6, z: 2 }, { x: 3, z: 4 }, { x: 6, z: 6 }, { x: 9, z: 5 },
      { x: 11, z: 6 }
    ],
    buildSlots: [
      { id: 's1', x: -9, z: -3 },
      { id: 's2', x: -6, z: -6 },
      { id: 's3', x: -4, z: 0 },
      { id: 's4', x: -1, z: 4 },
      { id: 's5', x: 2, z: 2 },
      { id: 's6', x: 5, z: 1 },
      { id: 's7', x: 8, z: 3 },
      { id: 's8', x: 4, z: 7 }
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
  };

  const MAPS = [ PLAINS, FOREST, MOUNTAIN ];

  function byId(id) { return MAPS.find(m => m.id === id) || null; }

  // ADR-028 §3: 2 difficulties, not 3. So MAPS.length * 3 * 2.
  function maxStars() { return MAPS.length * 3 * 2; }

  window.CTD3Maps = { MAPS, byId, maxStars };
})();
