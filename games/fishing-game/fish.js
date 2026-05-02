/**
 * Fishing — fish species table (pure data).
 *
 * 12 species across 4 depth tiers + 1 easter-egg species.
 *
 * AI parameters tune how each fish darts inside the reel-bar:
 *   baseSpeed   — pixels/sec the fish drifts when not darting
 *   dartFreq    — average darts per second (Poisson-ish)
 *   dartSpeed   — pixels/sec during a dart burst
 *   pauseProb   — probability per tick of pausing instead of moving
 *   reversalPref — 0..1, bias toward reversing direction on dart (1 = always)
 *   spookMul    — speed multiplier when the catch-zone is dead-on
 *
 * Sprite is a tiny pixel bitmap rendered as a silhouette in the reel-bar.
 * Catch-reveal portrait reuses the same sprite (scaled).
 */
(function () {
  'use strict';

  // 1×N strings define a row of the sprite. '#' = body, '.' = transparent.
  // Width = string length, height = number of strings.
  // The fish faces left by default (eye on left). Mirrored as needed at draw time.

  const FISH = [
    // ── Tier 1: Shallow (every cast can land these) ──────────
    {
      id: 'bluegill', name: 'Bluegill', tier: 1, rarity: 1, cash: 6,
      length: [4, 8],
      ai: { baseSpeed: 14, dartFreq: 0.7, dartSpeed: 56, pauseProb: 0.03, reversalPref: 0.55, spookMul: 1.1 },
      sprite: [
        '..#####..',
        '.##XXXX#.',
        '#XXXXXX##',
        '#XXXXXXXX',
        '#XXXXXX##',
        '.##XXXX#.',
        '..#####..',
      ],
      eye: [2, 2],
    },
    {
      id: 'sunfish', name: 'Sunfish', tier: 1, rarity: 1, cash: 8,
      length: [5, 9],
      ai: { baseSpeed: 12, dartFreq: 0.5, dartSpeed: 50, pauseProb: 0.06, reversalPref: 0.4, spookMul: 1.0 },
      sprite: [
        '...####....',
        '.##XXXX##..',
        '#XXXXXXX##.',
        '#XXXXXXXXX#',
        '#XXXXXXX##.',
        '.##XXXX##..',
        '...####....',
      ],
      eye: [2, 2],
    },
    {
      id: 'lakeworm', name: 'Lakeworm', tier: 1, rarity: 2, cash: 14,
      length: [3, 7],
      ai: { baseSpeed: 22, dartFreq: 1.4, dartSpeed: 70, pauseProb: 0.02, reversalPref: 0.7, spookMul: 1.3 },
      sprite: [
        '##############',
        'XXXXXXXXXXXXXX',
        '##############',
      ],
      eye: [1, 1],
    },

    // ── Tier 2: Mid (rod tier 2+) ────────────────────────────
    {
      id: 'trout', name: 'Trout', tier: 2, rarity: 2, cash: 22,
      length: [10, 16],
      ai: { baseSpeed: 18, dartFreq: 0.8, dartSpeed: 64, pauseProb: 0.05, reversalPref: 0.5, spookMul: 1.0 },
      sprite: [
        '...####....',
        '..#XXXX###.',
        '#XXXXXXXX##',
        '#XXXXXXXXX#',
        '#XXXXXXXX##',
        '..#XXXX###.',
        '...####....',
      ],
      eye: [2, 2],
    },
    {
      id: 'driftling', name: 'Driftling', tier: 2, rarity: 3, cash: 32,
      length: [6, 11],
      ai: { baseSpeed: 16, dartFreq: 0.4, dartSpeed: 80, pauseProb: 0.18, reversalPref: 0.85, spookMul: 1.4 },
      sprite: [
        '..####...',
        '.#XXXX##.',
        '#XXXXXXX#',
        '#XXXXXX##',
        '.#XXXX##.',
        '..####...',
      ],
      eye: [2, 2],
    },
    {
      id: 'glassfin', name: 'Glassfin', tier: 2, rarity: 3, cash: 38,
      length: [7, 12],
      ai: { baseSpeed: 24, dartFreq: 1.0, dartSpeed: 78, pauseProb: 0.08, reversalPref: 0.6, spookMul: 1.2 },
      sprite: [
        '.######....',
        '#XXXXXX###.',
        '#XXXXXXXXX#',
        '#XXXXXXXXX#',
        '#XXXXXX###.',
        '.######....',
      ],
      eye: [2, 2],
    },

    // ── Tier 3: Deep (rod tier 3+) ───────────────────────────
    {
      id: 'pike', name: 'Pike', tier: 3, rarity: 3, cash: 48,
      length: [16, 24],
      ai: { baseSpeed: 28, dartFreq: 0.9, dartSpeed: 90, pauseProb: 0.04, reversalPref: 0.5, spookMul: 1.1 },
      sprite: [
        '..######....',
        '##XXXXXX###.',
        '#XXXXXXXXX##',
        '#XXXXXXXXXXX',
        '#XXXXXXXXX##',
        '##XXXXXX###.',
        '..######....',
      ],
      eye: [2, 2],
    },
    {
      id: 'catfish', name: 'Catfish', tier: 3, rarity: 4, cash: 64,
      length: [14, 22],
      ai: { baseSpeed: 12, dartFreq: 0.35, dartSpeed: 60, pauseProb: 0.22, reversalPref: 0.4, spookMul: 0.9 },
      sprite: [
        '...#####....',
        '..#XXXXX##..',
        '##XXXXXXX##.',
        '#XXXXXXXXXX#',
        '##XXXXXXX##.',
        '..#XXXXX##..',
        '...#####....',
      ],
      eye: [2, 2],
    },
    {
      id: 'moonperch', name: 'Moonperch', tier: 3, rarity: 5, cash: 96,
      length: [9, 14],
      ai: { baseSpeed: 18, dartFreq: 1.6, dartSpeed: 95, pauseProb: 0.28, reversalPref: 0.9, spookMul: 1.6 },
      sprite: [
        '..####....',
        '.#XXXX##..',
        '#XXXXXXX##',
        '#XXXXXXX##',
        '#XXXXXXX##',
        '.#XXXX##..',
        '..####....',
      ],
      eye: [2, 2],
    },

    // ── Tier 4: Abyss (rod tier 4) ───────────────────────────
    {
      id: 'eelflame', name: 'Eelflame', tier: 4, rarity: 4, cash: 80,
      length: [18, 26],
      ai: { baseSpeed: 30, dartFreq: 1.2, dartSpeed: 92, pauseProb: 0.06, reversalPref: 0.65, spookMul: 1.3 },
      sprite: [
        '################',
        'XXXXXXXXXXXXXXXX',
        '################',
      ],
      eye: [1, 1],
    },
    {
      id: 'oarfish', name: 'Oarfish', tier: 4, rarity: 5, cash: 140,
      length: [22, 32],
      ai: { baseSpeed: 22, dartFreq: 0.5, dartSpeed: 105, pauseProb: 0.14, reversalPref: 0.8, spookMul: 1.4 },
      sprite: [
        '..#######......',
        '##XXXXXXX####..',
        '#XXXXXXXXXXX##.',
        '#XXXXXXXXXXXX##',
        '#XXXXXXXXXXX##.',
        '##XXXXXXX####..',
        '..#######......',
      ],
      eye: [2, 2],
    },
    {
      id: 'starbass', name: 'Starbass', tier: 4, rarity: 5, cash: 165,
      length: [12, 18],
      ai: { baseSpeed: 26, dartFreq: 1.3, dartSpeed: 100, pauseProb: 0.20, reversalPref: 0.85, spookMul: 1.5 },
      sprite: [
        '...#####....',
        '..#XXXXX##..',
        '##XXXXXXX###',
        '#XXXXXXXXXX#',
        '##XXXXXXX###',
        '..#XXXXX##..',
        '...#####....',
      ],
      eye: [2, 2],
    },

    // ── Easter egg (Konami code only) ────────────────────────
    {
      id: 'lochness', name: 'Loch Ness', tier: 4, rarity: 5, cash: 999,
      length: [88, 88],
      ai: { baseSpeed: 14, dartFreq: 0.3, dartSpeed: 70, pauseProb: 0.35, reversalPref: 0.6, spookMul: 1.0 },
      sprite: [
        '...##.............',
        '..####............',
        '..####............',
        '..####....##......',
        '..######.####.....',
        '##XXXXXXXXXXX##...',
        '#XXXXXXXXXXXXX###.',
        '#XXXXXXXXXXXXXXXX#',
        '#XXXXXXXXXXXXXXX##',
        '##XXXXXXXXXXXXXX#.',
      ],
      eye: [4, 5],
      hidden: true,
    },
  ];

  const BY_ID = Object.fromEntries(FISH.map(f => [f.id, f]));

  // Pool selection: which species can spawn at a given depth tier?
  // Lower-tier rods see only shallow fish; deeper rods unlock deeper pools.
  function poolForDepthTier(maxTier) {
    return FISH.filter(f => !f.hidden && f.tier <= maxTier);
  }

  window.FishingFish = {
    FISH,
    BY_ID,
    poolForDepthTier,
    getById: (id) => BY_ID[id] || null,
  };
})();
