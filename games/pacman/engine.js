(function () {
  'use strict';

  const M = window.PacmanMaze;
  const TILE = 8;  // internal logical pixels per tile

  const DIR = {
    up:    { x: 0,  y: -1 },
    down:  { x: 0,  y: 1 },
    left:  { x: -1, y: 0 },
    right: { x: 1,  y: 0 },
    none:  { x: 0,  y: 0 },
  };
  const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left', none: 'none' };

  // Speeds in logical pixels per 60Hz frame
  const PAC_SPEED = 0.75;
  const GHOST_SPEED = 0.72;
  const FRIGHT_SPEED = 0.50;
  const EATEN_SPEED = 1.40;
  const TUNNEL_SLOWDOWN = 0.60; // multiplier when in tunnel row

  // Durations (frames at 60Hz)
  const READY_FRAMES = 150;            // ~2.5 s
  const DYING_FRAMES = 110;            // ~1.8 s
  const LEVEL_CLEAR_FRAMES = 120;      // 2 s
  const FRIGHT_FRAMES = 360;           // 6 s
  const FRIGHT_FLASH_FRAMES = 120;     // last 2 s flash
  const MODE_CYCLE = [
    { mode: 'scatter', frames: 7 * 60 },
    { mode: 'chase',   frames: 20 * 60 },
    { mode: 'scatter', frames: 7 * 60 },
    { mode: 'chase',   frames: 20 * 60 },
    { mode: 'scatter', frames: 5 * 60 },
    { mode: 'chase',   frames: 20 * 60 },
    { mode: 'scatter', frames: 5 * 60 },
    { mode: 'chase',   frames: Infinity },
  ];

  function tileIndex(e) {
    return { x: Math.floor(e.x / TILE), y: Math.floor(e.y / TILE) };
  }

  function tileCenter(tx, ty) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }

  function isCenteredAxis(coord, axis) {
    const tile = Math.floor(coord / TILE);
    const center = tile * TILE + TILE / 2;
    return Math.abs(coord - center) < 0.75;
  }

  function tileAt(state, x, y) { return M.tileAt(state.tiles, x, y); }

  function walkableForPac(state, x, y) {
    return M.isWalkableForPac(tileAt(state, x, y));
  }

  function walkableForGhost(state, x, y, ghost) {
    return M.isWalkableForGhost(tileAt(state, x, y), ghost);
  }

  function tryTurn(entity, state, walkable) {
    if (!entity.desiredDir || entity.desiredDir === entity.dir) return;
    const d = DIR[entity.desiredDir];
    if (!d || (d.x === 0 && d.y === 0)) return;

    const isHoriz = d.x !== 0;
    const centered = isHoriz
      ? isCenteredAxis(entity.y, 'y')
      : isCenteredAxis(entity.x, 'x');

    // Allow 180° reversal even mid-tile (pac feels better that way)
    const reverse = entity.desiredDir === OPPOSITE[entity.dir];

    if (!centered && !reverse) return;

    const cur = tileIndex(entity);
    const targetOk = walkable(state, cur.x + d.x, cur.y + d.y, entity);
    if (!targetOk) return;

    entity.dir = entity.desiredDir;
    if (isHoriz) entity.y = cur.y * TILE + TILE / 2;
    else entity.x = cur.x * TILE + TILE / 2;
  }

  function moveEntity(entity, speed, state, walkable) {
    if (!entity.dir || entity.dir === 'none') return;
    const d = DIR[entity.dir];
    let nx = entity.x + d.x * speed;
    let ny = entity.y + d.y * speed;

    // Tunnel wrap
    const ty = Math.floor(ny / TILE);
    const maxX = M.COLS * TILE;
    if (ty === M.TUNNEL_ROW) {
      if (nx < -TILE / 2) nx += maxX;
      else if (nx >= maxX + TILE / 2) nx -= maxX;
    }

    // Look ahead at the front of the entity to see if the next tile is blocked
    const frontX = nx + d.x * (TILE / 2);
    const frontY = ny + d.y * (TILE / 2);
    const fx = Math.floor(frontX / TILE);
    const fy = Math.floor(frontY / TILE);

    if (!walkable(state, fx, fy, entity)) {
      const cur = tileIndex(entity);
      if (d.x !== 0) nx = cur.x * TILE + TILE / 2;
      if (d.y !== 0) ny = cur.y * TILE + TILE / 2;
      entity.dir = 'none';
    }

    entity.x = nx;
    entity.y = ny;
  }

  function spawnPac(index, config) {
    const s = M.PACMAN_SPAWN;
    const colors = ['#FFFF00', '#FF4DFF', '#00E5FF', '#80FF80'];
    return {
      id: index,
      slot: index,
      role: 'pac',
      x: s.x * TILE + TILE,       // between tile 13 and 14
      y: s.y * TILE + TILE / 2,
      startX: s.x * TILE + TILE,
      startY: s.y * TILE + TILE / 2,
      dir: 'left',
      desiredDir: 'left',
      alive: true,
      score: 0,
      color: colors[index % colors.length],
      lives: (config.lives === 'shared-5') ? 0 : config.lives,
      animFrame: 0,
      deathFrame: 0,
      pelletBoostUntil: 0,
      canEatRivals: false,
      canEatUntil: 0,
      lastDir: 'left',
    };
  }

  function spawnGhost(name, controlledBy, slot, config) {
    const s = M.GHOSTS_SPAWN[name];
    const colors = { blinky: '#FF0000', pinky: '#FFB8FF', inky: '#00FFFF', clyde: '#FFB852' };
    const g = {
      id: name,
      name,
      controlledBy,
      slot: slot == null ? null : slot,
      role: 'ghost',
      x: s.x * TILE + TILE / 2 + (s.subX || 0),
      y: s.y * TILE + TILE / 2 + (s.subY || 0),
      startX: s.x * TILE + TILE / 2 + (s.subX || 0),
      startY: s.y * TILE + TILE / 2 + (s.subY || 0),
      dir: name === 'blinky' ? 'left' : 'up',
      desiredDir: name === 'blinky' ? 'left' : 'up',
      color: colors[name],
      mode: 'scatter',
      houseState: name === 'blinky' ? 'out' : 'in',
      exitAt: s.exitDelay || 0,
      frightenedUntil: 0,
      respawnAt: 0,
    };
    return g;
  }

  function createState(config) {
    const parsed = M.parse();
    const state = {
      config,
      tiles: parsed.tiles,
      dotsRemaining: parsed.dotCount,
      pelletsRemaining: parsed.pelletCount,
      totalDots: parsed.dotCount + parsed.pelletCount,
      phase: 'ready',
      tick: 0,
      readyTimer: READY_FRAMES,
      dyingTimer: 0,
      clearTimer: 0,
      modeTimerIdx: 0,
      modeTimerRemaining: MODE_CYCLE[0].frames,
      currentGhostMode: MODE_CYCLE[0].mode,
      frightenedUntil: 0,
      level: 1,
      lives: (config.lives === 'shared-5') ? 5
           : (typeof config.lives === 'number') ? config.lives
           : 1,
      eatGhostCombo: 0,
      events: [],  // transient per-frame events for audio/render
      lastEatFrame: 0,
      pacs: [],
      ghosts: [],
      scores: {},  // persistent per-pac scores (survives death)
      winnerId: null,
      gameOver: false,
      gameOverReason: null,
    };

    // Spawn pacs
    for (let i = 0; i < config.pacCount; i++) {
      const p = spawnPac(i, config);
      state.pacs.push(p);
      state.scores[p.id] = 0;
    }

    // Spawn ghosts (order: blinky, pinky, inky, clyde)
    const ghostNames = ['blinky', 'pinky', 'inky', 'clyde'];
    const humanGhostCount = config.humanGhostCount || 0;
    for (let i = 0; i < 4; i++) {
      const name = ghostNames[i];
      const isHuman = i < humanGhostCount;
      const slot = isHuman ? (config.pacCount + i) : null;
      state.ghosts.push(spawnGhost(name, isHuman ? 'human' : 'ai', slot, config));
    }

    return state;
  }

  function pushEvent(state, type, data) {
    state.events.push(Object.assign({ type }, data || {}));
  }

  function resetPositionsForDeath(state) {
    for (const pac of state.pacs) {
      pac.x = pac.startX;
      pac.y = pac.startY;
      pac.dir = 'left';
      pac.desiredDir = 'left';
      pac.alive = true;
      pac.deathFrame = 0;
      pac.canEatRivals = false;
    }
    const ghostNames = ['blinky', 'pinky', 'inky', 'clyde'];
    state.ghosts.forEach((g, i) => {
      const s = M.GHOSTS_SPAWN[ghostNames[i]];
      g.x = g.startX; g.y = g.startY;
      g.dir = g.name === 'blinky' ? 'left' : 'up';
      g.desiredDir = g.dir;
      g.mode = state.currentGhostMode;
      g.houseState = g.name === 'blinky' ? 'out' : 'in';
      g.exitAt = (s.exitDelay || 0) / 2;  // faster release on respawn
      g.frightenedUntil = 0;
    });
    state.eatGhostCombo = 0;
    state.frightenedUntil = 0;
  }

  function pacTouchingGhost(pac, ghost) {
    const dx = pac.x - ghost.x, dy = pac.y - ghost.y;
    return dx * dx + dy * dy < (TILE * 0.85) * (TILE * 0.85);
  }

  function pacTouchingPac(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy < (TILE * 0.75) * (TILE * 0.75);
  }

  function handleDotEating(state) {
    for (const pac of state.pacs) {
      if (!pac.alive) continue;
      const t = tileIndex(pac);
      const idx = t.y * M.COLS + t.x;
      if (t.x < 0 || t.x >= M.COLS || t.y < 0 || t.y >= M.ROWS) continue;
      const v = state.tiles[idx];
      if (v === M.DOT) {
        state.tiles[idx] = M.EMPTY;
        state.dotsRemaining--;
        state.scores[pac.id] += 10;
        pac.score = state.scores[pac.id];
        state.lastEatFrame = state.tick;
        pushEvent(state, 'dot', { pacId: pac.id });
      } else if (v === M.PELLET) {
        state.tiles[idx] = M.EMPTY;
        state.pelletsRemaining--;
        state.scores[pac.id] += 50;
        pac.score = state.scores[pac.id];
        state.lastEatFrame = state.tick;
        state.frightenedUntil = state.tick + FRIGHT_FRAMES;
        state.eatGhostCombo = 0;
        for (const g of state.ghosts) {
          if (g.mode !== 'eaten') {
            g.mode = 'frightened';
            g.frightenedUntil = state.frightenedUntil;
            // reverse direction
            g.dir = OPPOSITE[g.dir] || g.dir;
            g.desiredDir = g.dir;
          }
        }
        // Battle-royale: this pac can eat rivals
        if (state.config.friendlyFire === 'pellet-only') {
          pac.canEatRivals = true;
          pac.canEatUntil = state.tick + FRIGHT_FRAMES;
        }
        pushEvent(state, 'pellet', { pacId: pac.id });
      }
    }
  }

  function handleGhostPacCollisions(state) {
    for (const pac of state.pacs) {
      if (!pac.alive) continue;
      for (const g of state.ghosts) {
        if (!pacTouchingGhost(pac, g)) continue;
        if (g.mode === 'eaten') continue;
        if (g.mode === 'frightened' && g.houseState !== 'in') {
          // pac eats ghost
          g.mode = 'eaten';
          g.houseState = 'returning';
          state.eatGhostCombo += 1;
          const points = [200, 400, 800, 1600][Math.min(state.eatGhostCombo - 1, 3)];
          state.scores[pac.id] += points;
          pac.score = state.scores[pac.id];
          pushEvent(state, 'eat_ghost', { pacId: pac.id, points, ghostId: g.id, x: g.x, y: g.y });
        } else if (g.mode !== 'frightened') {
          // pac dies
          killPac(state, pac);
          return;
        }
      }
    }
  }

  function handlePacPacCollisions(state) {
    if (state.config.friendlyFire !== 'pellet-only') return;
    for (let i = 0; i < state.pacs.length; i++) {
      const a = state.pacs[i];
      if (!a.alive) continue;
      for (let j = 0; j < state.pacs.length; j++) {
        if (i === j) continue;
        const b = state.pacs[j];
        if (!b.alive) continue;
        if (!pacTouchingPac(a, b)) continue;
        if (a.canEatRivals && !b.canEatRivals) {
          // a eats b
          state.scores[a.id] += 400;
          a.score = state.scores[a.id];
          pushEvent(state, 'eat_rival', { eaterId: a.id, victimId: b.id, x: b.x, y: b.y });
          b.alive = false;
          b.deathFrame = state.tick;
        }
      }
    }
  }

  function killPac(state, pac) {
    pac.alive = false;
    pac.deathFrame = state.tick;
    state.dyingTimer = DYING_FRAMES;
    state.phase = 'dying';
    state.dyingPacId = pac.id;
    pushEvent(state, 'death', { pacId: pac.id });
  }

  function advanceModeTimer(state) {
    if (state.currentGhostMode === 'frightened') return; // paused during fright
    if (state.modeTimerRemaining === Infinity) return;
    state.modeTimerRemaining--;
    if (state.modeTimerRemaining <= 0) {
      state.modeTimerIdx++;
      if (state.modeTimerIdx >= MODE_CYCLE.length) state.modeTimerIdx = MODE_CYCLE.length - 1;
      const c = MODE_CYCLE[state.modeTimerIdx];
      state.currentGhostMode = c.mode;
      state.modeTimerRemaining = c.frames;
      // reverse non-frightened, non-eaten ghosts when mode flips
      for (const g of state.ghosts) {
        if (g.mode === 'scatter' || g.mode === 'chase') {
          g.mode = c.mode;
          g.dir = OPPOSITE[g.dir] || g.dir;
          g.desiredDir = g.dir;
        }
      }
    }
  }

  function applyFrightenedState(state) {
    if (state.tick >= state.frightenedUntil) {
      for (const g of state.ghosts) {
        if (g.mode === 'frightened') {
          g.mode = state.currentGhostMode;
        }
      }
      for (const p of state.pacs) {
        if (p.canEatRivals && state.tick >= p.canEatUntil) p.canEatRivals = false;
      }
    }
  }

  function getGhostSpeed(state, g) {
    if (g.mode === 'eaten') return EATEN_SPEED;
    if (g.mode === 'frightened') return FRIGHT_SPEED;
    const t = tileIndex(g);
    if (t.y === M.TUNNEL_ROW) return GHOST_SPEED * TUNNEL_SLOWDOWN;
    return GHOST_SPEED;
  }

  function getPacSpeed(state, p) {
    const t = tileIndex(p);
    const baseSpeed = PAC_SPEED;
    if (t.y === M.TUNNEL_ROW) return baseSpeed * 0.9;
    return baseSpeed;
  }

  function step(state, inputProvider) {
    state.events.length = 0;
    state.tick++;

    if (state.phase === 'ready') {
      state.readyTimer--;
      if (state.readyTimer <= 0) {
        state.phase = 'playing';
        pushEvent(state, 'round_start', {});
      }
      return;
    }

    if (state.phase === 'dying') {
      state.dyingTimer--;
      if (state.dyingTimer <= 0) {
        if (state.config.friendlyFire === 'pellet-only') {
          // Battle royale: dead pac stays dead; others keep playing.
          state.phase = 'playing';
          state.dyingPacId = null;
          return;
        }
        state.lives--;
        if (state.lives <= 0) {
          state.phase = 'game_over';
          state.gameOver = true;
          state.gameOverReason = 'out_of_lives';
          pushEvent(state, 'game_over', { reason: 'out_of_lives' });
          return;
        }
        resetPositionsForDeath(state);
        state.readyTimer = Math.floor(READY_FRAMES * 0.7);
        state.phase = 'ready';
      }
      return;
    }

    if (state.phase === 'level_clear') {
      state.clearTimer--;
      if (state.clearTimer <= 0) {
        // Rebuild level
        const cfg = state.config;
        const newState = createState(cfg);
        newState.scores = state.scores;
        newState.level = state.level + 1;
        newState.lives = state.lives;
        for (const p of newState.pacs) p.score = newState.scores[p.id] || 0;
        Object.assign(state, newState);
      }
      return;
    }

    if (state.phase !== 'playing') return;

    // 1) Read input desires for ALL entities; inputProvider handles AI vs human.
    for (const p of state.pacs) {
      if (!p.alive) continue;
      const d = inputProvider(p, state);
      if (d) p.desiredDir = d;
    }
    for (const g of state.ghosts) {
      const d = inputProvider(g, state);
      if (d) g.desiredDir = d;
    }

    // 2) Mode timer + frightened expiry
    advanceModeTimer(state);
    applyFrightenedState(state);

    // 3) Ghost house exits (timer-based)
    for (const g of state.ghosts) {
      if (g.houseState === 'in') {
        g.exitAt--;
        if (g.exitAt <= 0) g.houseState = 'leaving';
      }
      if (g.houseState === 'returning') {
        // When ghost arrives at house interior, revive
        const t = tileIndex(g);
        if (t.x === M.HOUSE_INSIDE.x && t.y === M.HOUSE_INSIDE.y &&
            Math.abs(g.x - (t.x * TILE + TILE / 2)) < 1 &&
            Math.abs(g.y - (t.y * TILE + TILE / 2)) < 1) {
          g.mode = state.currentGhostMode;
          g.houseState = 'leaving';
        }
      } else if (g.houseState === 'leaving') {
        // When centered on HOUSE_EXIT tile, switch to 'out'
        const t = tileIndex(g);
        if (t.x === M.HOUSE_EXIT.x && t.y === M.HOUSE_EXIT.y) {
          g.houseState = 'out';
        }
      }
    }

    // 4) Move ghosts (desiredDir set by AI elsewhere via inputProvider or by engine calling AI hook)
    for (const g of state.ghosts) {
      tryTurn(g, state, walkableForGhost);
      moveEntity(g, getGhostSpeed(state, g), state, walkableForGhost);
    }

    // 5) Move pacs
    for (const p of state.pacs) {
      if (!p.alive) continue;
      tryTurn(p, state, walkableForPac);
      moveEntity(p, getPacSpeed(state, p), state, walkableForPac);
      if (p.dir !== 'none') { p.animFrame++; p.lastDir = p.dir; }
    }

    // 6) Eat dots/pellets
    handleDotEating(state);

    // 7) Collisions
    handleGhostPacCollisions(state);
    if (state.phase !== 'dying') handlePacPacCollisions(state);

    // 8) Win check
    if (state.dotsRemaining <= 0 && state.pelletsRemaining <= 0) {
      state.phase = 'level_clear';
      state.clearTimer = LEVEL_CLEAR_FRAMES;
      // Determine winner for battle mode
      if (state.config.win === 'mostDotsWhenCleared') {
        let topId = null, top = -1;
        for (const pid in state.scores) {
          if (state.scores[pid] > top) { top = state.scores[pid]; topId = pid; }
        }
        state.winnerId = topId;
      }
      pushEvent(state, 'level_clear', {});
    }

    // Battle royale sole survivor
    if (state.config.win === 'mostDotsWhenCleared') {
      const alive = state.pacs.filter(p => p.alive);
      if (state.pacs.length > 1 && alive.length === 1) {
        state.phase = 'game_over';
        state.gameOver = true;
        state.winnerId = alive[0].id;
        state.gameOverReason = 'last_standing';
        pushEvent(state, 'game_over', { reason: 'last_standing', winnerId: alive[0].id });
      }
    }
  }

  window.PacmanEngine = {
    TILE,
    DIR,
    OPPOSITE,
    PAC_SPEED, GHOST_SPEED, FRIGHT_SPEED, EATEN_SPEED,
    READY_FRAMES, DYING_FRAMES, FRIGHT_FRAMES, FRIGHT_FLASH_FRAMES,
    MODE_CYCLE,
    createState,
    step,
    tileIndex,
    tileCenter,
    walkableForPac,
    walkableForGhost,
    resetPositionsForDeath,
  };
})();
