/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense — maps.js
   Three hand-authored maps. Pure data — no per-map functions.
   Coords are in playfield SVG viewBox space: 0..1200 × 0..640.
   To add a 4th map: append a new entry; nothing else changes.
   Exposes window.CTDMaps.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─── Wave shorthand ──────────────────────────────────────────
  // group(type, count, spacing[, delay]) builds a wave entry.
  function g(type, count, spacing, delay) {
    return { type, count, spacing, delay: delay || 0 };
  }
  function wave(groups, reward, opts) {
    return Object.assign({ enemies: groups, reward: reward || 20, isBoss: false }, opts || {});
  }

  // ─── MAP 1 — The Plains ──────────────────────────────────────
  // Open path with gentle curves; archers + cannons see far.
  const PLAINS = {
    id: 'plains',
    displayName: 'The Plains',
    roman: 'Field the First',
    chip: 'Open Field',
    chipKind: 'gold',
    description: 'Gentle hills and an unbroken road. The keep holds open ground; archers will see far.',
    thumbSprite: 'map-plains',
    unlockRequirement: 0,
    castle: { x: 1140, y: 290 },
    path: [
      { x: -30, y: 480 }, { x: 130, y: 440 }, { x: 280, y: 400 }, { x: 420, y: 420 },
      { x: 560, y: 470 }, { x: 700, y: 400 }, { x: 840, y: 320 }, { x: 980, y: 320 },
      { x: 1080, y: 300 }, { x: 1140, y: 290 }
    ],
    buildSlots: [
      { id: 's1', x: 200, y: 360 }, { id: 's2', x: 360, y: 340 },
      { id: 's3', x: 480, y: 540 }, { id: 's4', x: 620, y: 350 },
      { id: 's5', x: 760, y: 250 }, { id: 's6', x: 900, y: 400 },
      { id: 's7', x: 1010, y: 240 }
    ],
    waves: [
      // 1: tutorial — single goblin (slow). Engine pauses spawns until tutorial dismissed.
      wave([ g('goblin', 1, 0, 0) ], 15),
      // 2: small goblin trickle
      wave([ g('goblin', 6, 700, 0) ], 18),
      // 3: introduces flying — surprise!
      wave([ g('goblin', 4, 600, 0), g('flying', 2, 1100, 4500) ], 22),
      // 4: orcs
      wave([ g('orc', 3, 1400, 0), g('goblin', 5, 500, 5000) ], 25),
      // 5: mixed
      wave([ g('wolfrider', 4, 700, 0), g('goblin', 6, 500, 4000) ], 28),
      // 6: shielded
      wave([ g('shielded', 3, 1300, 0), g('goblin', 4, 500, 5000) ], 30),
      // 7: flight pressure
      wave([ g('flying', 5, 800, 0), g('orc', 2, 1800, 5500) ], 32),
      // 8: heavy ground
      wave([ g('orc', 4, 1100, 0), g('shielded', 3, 1200, 6000), g('wolfrider', 4, 600, 12000) ], 36),
      // 9: rush
      wave([ g('wolfrider', 8, 500, 0), g('flying', 4, 900, 5000) ], 40),
      // 10: finale — everything
      wave([ g('orc', 4, 1300, 0), g('shielded', 4, 1100, 5500),
             g('flying', 4, 900, 9000), g('wolfrider', 6, 550, 13000) ], 60)
    ]
  };

  // ─── MAP 2 — The Whispering Wood ─────────────────────────────
  // Tighter winding path; less line-of-sight; more wolfriders + flying.
  const FOREST = {
    id: 'forest',
    displayName: 'The Whispering Wood',
    roman: 'Field the Second',
    chip: 'Tight Path',
    chipKind: '',
    description: 'Trees crowd the road. Sight lines are short — set thy towers wisely, for the wolves run fast.',
    thumbSprite: 'map-forest',
    unlockRequirement: 0,
    castle: { x: 60, y: 540 },
    path: [
      { x: 1240, y: 100 }, { x: 1080, y: 120 }, { x: 940, y: 200 }, { x: 980, y: 320 },
      { x: 860, y: 380 }, { x: 700, y: 320 }, { x: 540, y: 380 }, { x: 420, y: 280 },
      { x: 280, y: 320 }, { x: 200, y: 440 }, { x: 320, y: 520 }, { x: 180, y: 560 },
      { x: 60, y: 540 }
    ],
    buildSlots: [
      { id: 's1', x: 1080, y: 220 }, { id: 's2', x: 940, y: 100 },
      { id: 's3', x: 820, y: 260 }, { id: 's4', x: 700, y: 420 },
      { id: 's5', x: 540, y: 280 }, { id: 's6', x: 380, y: 380 },
      { id: 's7', x: 280, y: 220 }, { id: 's8', x: 250, y: 600 }
    ],
    waves: [
      wave([ g('goblin', 8, 600, 0) ], 18),
      wave([ g('wolfrider', 5, 700, 0), g('goblin', 4, 500, 4500) ], 22),
      wave([ g('flying', 4, 900, 0), g('goblin', 6, 500, 5000) ], 26),
      wave([ g('orc', 3, 1300, 0), g('wolfrider', 5, 600, 5500) ], 30),
      wave([ g('shielded', 4, 1100, 0), g('flying', 3, 1000, 6000) ], 32),
      wave([ g('wolfrider', 10, 450, 0), g('orc', 2, 1800, 6000) ], 36),
      wave([ g('flying', 8, 700, 0), g('shielded', 3, 1200, 7000) ], 40),
      wave([ g('orc', 5, 1000, 0), g('wolfrider', 6, 500, 6000), g('flying', 4, 900, 11000) ], 44),
      wave([ g('shielded', 6, 950, 0), g('wolfrider', 8, 450, 7000) ], 48),
      wave([ g('orc', 6, 1100, 0), g('shielded', 4, 1100, 7000),
             g('flying', 6, 750, 11000), g('wolfrider', 8, 450, 15000) ], 70)
    ]
  };

  // ─── MAP 3 — The Stone Gate ──────────────────────────────────
  // Long pass; harder; ends with the boss.
  const MOUNTAIN = {
    id: 'mountain',
    displayName: 'The Stone Gate',
    roman: 'Field the Third',
    chip: 'Sealed',
    chipKind: 'locked',
    description: 'A narrow pass between black peaks. They say a Warlord walks here when the moon is full.',
    thumbSprite: 'map-mountain',
    unlockRequirement: 5,
    castle: { x: 1140, y: 540 },
    path: [
      { x: -30, y: 100 }, { x: 140, y: 130 }, { x: 280, y: 200 }, { x: 200, y: 300 },
      { x: 380, y: 380 }, { x: 540, y: 340 }, { x: 660, y: 220 }, { x: 800, y: 240 },
      { x: 880, y: 360 }, { x: 760, y: 460 }, { x: 880, y: 540 }, { x: 1040, y: 500 },
      { x: 1140, y: 540 }
    ],
    buildSlots: [
      { id: 's1', x: 140, y: 220 }, { id: 's2', x: 280, y: 100 },
      { id: 's3', x: 380, y: 280 }, { id: 's4', x: 460, y: 280 },
      { id: 's5', x: 580, y: 440 }, { id: 's6', x: 720, y: 320 },
      { id: 's7', x: 940, y: 400 }, { id: 's8', x: 760, y: 580 },
      { id: 's9', x: 1000, y: 420 }
    ],
    waves: [
      wave([ g('goblin', 10, 550, 0) ], 22),
      wave([ g('orc', 3, 1300, 0), g('wolfrider', 4, 700, 4500) ], 26),
      wave([ g('flying', 5, 850, 0), g('shielded', 2, 1500, 5000) ], 30),
      wave([ g('shielded', 5, 1000, 0), g('orc', 2, 1700, 6000) ], 34),
      wave([ g('wolfrider', 10, 450, 0), g('flying', 4, 900, 6000) ], 38),
      wave([ g('orc', 6, 1000, 0), g('shielded', 4, 1100, 6500) ], 42),
      wave([ g('flying', 10, 600, 0), g('shielded', 4, 1100, 7000) ], 46),
      wave([ g('orc', 6, 1000, 0), g('wolfrider', 8, 500, 6000), g('flying', 6, 800, 12000) ], 50),
      wave([ g('shielded', 8, 800, 0), g('wolfrider', 10, 400, 7500) ], 54),
      wave([ g('orc', 8, 900, 0), g('shielded', 6, 950, 6000),
             g('flying', 8, 700, 11000), g('wolfrider', 10, 400, 16000) ], 70),
      // 11 — BOSS
      wave([ g('orc', 4, 1400, 0), g('shielded', 4, 1300, 6000),
             g('boss', 1, 0, 14000), g('wolfrider', 6, 600, 18000) ], 250, { isBoss: true })
    ]
  };

  const MAPS = [ PLAINS, FOREST, MOUNTAIN ];

  // ─── Lookup helpers ──────────────────────────────────────────
  function byId(id) { return MAPS.find(m => m.id === id) || null; }

  // Compute total possible stars across all maps × difficulties:
  //   3 stars × 3 difficulties × N maps. Used by HUD progress label.
  function maxStars() { return MAPS.length * 3 * 3; }

  window.CTDMaps = { MAPS, byId, maxStars };
})();
