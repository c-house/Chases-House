/* ═══════════════════════════════════════════════════════════════
   Embershore — world.js
   Tile constants + room data. Hand-authored.
   PR1 ships 4 rooms in a 2×2 layout to prove the room-scroll feel.
   PR2 fills out the full 5×4 = 20 overworld + 4 dungeons.
   See docs/design/019-embershore-architecture.md §8.
   Exposes window.EmbershoreWorld.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Tile values (Uint8). Order matters only insofar as 0 is EMPTY.
  const TILES = Object.freeze({
    EMPTY: 0,
    SAND: 1,
    GRASS: 2,
    WATER: 3,
    STONE: 4,
    BUSH: 5,
    TOTEM: 6,
    INN: 7,
    FIRE: 8,
    DOOR_N: 10, DOOR_S: 11, DOOR_E: 12, DOOR_W: 13,
  });

  const COLS = 10;  // tiles per row
  const ROWS = 9;   // rows per room
  const TILE = 16;  // logical px per tile

  // Character → tile map for tilesRaw decoding
  const CHAR_MAP = {
    '.': TILES.SAND,
    'g': TILES.GRASS,
    '~': TILES.WATER,
    '#': TILES.STONE,
    'b': TILES.BUSH,
    'T': TILES.TOTEM,
    'I': TILES.INN,
    'F': TILES.FIRE,
    ' ': TILES.SAND,
  };

  // ── Walkability ──────────────────────────────────────────────
  const WALKABLE = new Set([TILES.SAND, TILES.GRASS, TILES.EMPTY]);
  function isWalkable(tile /*, player */) {
    return WALKABLE.has(tile);
  }
  function isInteractable(tile) {
    return tile === TILES.TOTEM || tile === TILES.BUSH || tile === TILES.INN || tile === TILES.FIRE;
  }

  // ── PR1 rooms — 2×2 layout for scroll testing ────────────────
  // Naming: ow_<x>_<y>. (0,0) is top-left.
  const RAW_ROOMS = {
    'ow_0_0': {
      music: 'overworld',
      tilesRaw: [
        '..........',
        '..gggg....',
        '..gggg.b..',
        '..ggT.....',
        '..........',
        '..........',
        '....bbbb..',
        '..........',
        '..........',
      ],
      objects: [],
      exits: { S: 'ow_0_1', E: 'ow_1_0' },
    },
    'ow_1_0': {
      music: 'overworld',
      tilesRaw: [
        '..........',
        '...####...',
        '..#....#..',
        '..#.gg.#..',
        '..#....#..',
        '...####...',
        '..........',
        '....b.....',
        '..........',
      ],
      objects: [],
      exits: { S: 'ow_1_1', W: 'ow_0_0' },
    },
    'ow_0_1': {
      music: 'overworld',
      tilesRaw: [
        '..........',
        '..gggggg..',
        '..gggggg..',
        '..gggggg..',
        '..........',
        '..~~~~~~..',
        '.~~~~~~~~.',
        '~~~~~~~~~~',
        '~~~~~~~~~~',
      ],
      objects: [],
      exits: { N: 'ow_0_0', E: 'ow_1_1' },
    },
    'ow_1_1': {
      music: 'overworld',
      tilesRaw: [
        '..........',
        '..b.......',
        '..........',
        '....F.....',
        '..........',
        '...gggg...',
        '..ggggggg.',
        '..gggTggg.',
        '..ggggggg.',
      ],
      objects: [],
      exits: { N: 'ow_1_0', W: 'ow_0_1' },
    },
  };

  // ── Parse: convert tilesRaw strings → Uint8Array(90) ─────────
  function parseRoom(rawDef, id) {
    const tiles = new Uint8Array(COLS * ROWS);
    for (let y = 0; y < ROWS; y++) {
      const row = rawDef.tilesRaw[y] || '..........';
      for (let x = 0; x < COLS; x++) {
        const ch = row[x] || '.';
        tiles[y * COLS + x] = CHAR_MAP[ch] != null ? CHAR_MAP[ch] : TILES.SAND;
      }
    }
    const baseTiles = new Uint8Array(tiles);  // pristine copy for respawn/reset
    return {
      id: id,
      scene: 'overworld',
      music: rawDef.music,
      tiles: tiles,
      baseTiles: baseTiles,
      objects: rawDef.objects || [],
      exits: rawDef.exits || {},
      hudSafeZone: rawDef.hudSafeZone || { x: 0, y: 0, w: 4, h: 2 },
    };
  }

  // Build the room registry once at module init
  const ROOMS = {};
  Object.keys(RAW_ROOMS).forEach(id => {
    ROOMS[id] = parseRoom(RAW_ROOMS[id], id);
  });

  function getRoom(roomId) {
    return ROOMS[roomId] || null;
  }

  // Tile lookup with bounds checking
  function tileAt(tiles, x, y) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return TILES.STONE;  // OOB = wall
    return tiles[y * COLS + x];
  }

  // Reset room mutable state (for respawn after wake-in-inn)
  function resetRoom(roomId) {
    const room = ROOMS[roomId];
    if (!room) return;
    room.tiles = new Uint8Array(room.baseTiles);
  }

  window.EmbershoreWorld = Object.assign({
    COLS: COLS,
    ROWS: ROWS,
    TILE: TILE,
    TILES: TILES,
    ROOMS: ROOMS,
    getRoom: getRoom,
    tileAt: tileAt,
    isWalkable: isWalkable,
    isInteractable: isInteractable,
    resetRoom: resetRoom,
    OVERWORLD_IDS: Object.keys(RAW_ROOMS),
  }, TILES);  // expose tile constants at top-level for convenience
})();
