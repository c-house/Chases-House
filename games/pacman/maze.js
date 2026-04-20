(function () {
  'use strict';

  const WALL = 1;
  const DOT = 2;
  const PELLET = 3;
  const EMPTY = 0;
  const GATE = 4;
  const TUNNEL = 5;

  const COLS = 28;
  const ROWS = 31;

  // Classic-inspired 28x31 Pac-Man maze.
  // '#' wall, '.' dot, 'o' power pellet, ' ' empty corridor,
  // '-' ghost-house gate, 'T' tunnel empty.
  const LAYOUT = [
    '############################',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#o####.#####.##.#####.####o#',
    '#.####.#####.##.#####.####.#',
    '#..........................#',
    '#.####.##.########.##.####.#',
    '#.####.##.########.##.####.#',
    '#......##....##....##......#',
    '######.##### ## #####.######',
    '######.##### ## #####.######',
    '######.##          ##.######',
    '######.## ###--### ##.######',
    '######.## #      # ##.######',
    'TTTTTT.   #      #   .TTTTTT',
    '######.## #      # ##.######',
    '######.## ######## ##.######',
    '######.##          ##.######',
    '######.## ######## ##.######',
    '######.## ######## ##.######',
    '#............##............#',
    '#.####.#####.##.#####.####.#',
    '#.####.#####.##.#####.####.#',
    '#o..##.......  .......##..o#',
    '###.##.##.########.##.##.###',
    '###.##.##.########.##.##.###',
    '#......##....##....##......#',
    '#.##########.##.##########.#',
    '#.##########.##.##########.#',
    '#..........................#',
    '############################',
  ];

  function parse() {
    const tiles = new Uint8Array(COLS * ROWS);
    let dotCount = 0;
    let pelletCount = 0;
    for (let y = 0; y < ROWS; y++) {
      const row = LAYOUT[y];
      for (let x = 0; x < COLS; x++) {
        const ch = row.charAt(x);
        let v = EMPTY;
        if (ch === '#') v = WALL;
        else if (ch === '.') { v = DOT; dotCount++; }
        else if (ch === 'o') { v = PELLET; pelletCount++; }
        else if (ch === '-') v = GATE;
        else if (ch === 'T') v = TUNNEL;
        tiles[y * COLS + x] = v;
      }
    }
    return { tiles, dotCount, pelletCount };
  }

  const PACMAN_SPAWN = { x: 13, y: 23, subX: 12, subY: 0 }; // between 13 and 14

  // Ghost house and key positions
  const HOUSE_EXIT = { x: 13, y: 11 };       // tile just above gate
  const HOUSE_INSIDE = { x: 13, y: 14 };     // centre of pen
  const GHOSTS_SPAWN = {
    blinky: { x: 13, y: 11, subX: 12, subY: 0, exitDelay: 0 },
    pinky:  { x: 13, y: 14, subX: 12, subY: 0, exitDelay: 120 },  // 2s at 60fps
    inky:   { x: 11, y: 14, subX: 0,  subY: 0, exitDelay: 360 },  // 6s
    clyde:  { x: 15, y: 14, subX: 0,  subY: 0, exitDelay: 540 },  // 9s
  };

  const SCATTER_TARGETS = {
    blinky: { x: 25, y: 0 },
    pinky:  { x: 2,  y: 0 },
    inky:   { x: 27, y: 30 },
    clyde:  { x: 0,  y: 30 },
  };

  const TUNNEL_ROW = 14;

  function tileAt(tiles, x, y) {
    if (y < 0 || y >= ROWS) return WALL;
    // horizontal wrap through tunnel row
    if (y === TUNNEL_ROW) {
      if (x < 0) x = COLS + x;
      if (x >= COLS) x = x - COLS;
    } else {
      if (x < 0 || x >= COLS) return WALL;
    }
    return tiles[y * COLS + x];
  }

  function isWalkable(v) {
    return v !== WALL;
  }

  function isWalkableForPac(v) {
    return v !== WALL && v !== GATE;
  }

  function isWalkableForGhost(v, ghost) {
    if (v === WALL) return false;
    if (v === GATE) {
      // ghost can pass gate when leaving house or returning as eyes
      return ghost && (ghost.houseState === 'leaving' || ghost.mode === 'eaten' || ghost.houseState === 'returning');
    }
    return true;
  }

  window.PacmanMaze = {
    WALL, DOT, PELLET, EMPTY, GATE, TUNNEL,
    COLS, ROWS, TUNNEL_ROW,
    LAYOUT,
    parse,
    tileAt,
    isWalkable,
    isWalkableForPac,
    isWalkableForGhost,
    PACMAN_SPAWN,
    GHOSTS_SPAWN,
    HOUSE_EXIT,
    HOUSE_INSIDE,
    SCATTER_TARGETS,
  };
})();
