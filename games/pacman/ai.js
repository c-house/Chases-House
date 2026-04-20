(function () {
  'use strict';

  const M = window.PacmanMaze;
  const E = window.PacmanEngine;
  const TILE = E.TILE;
  const DIR = E.DIR;
  const OPPOSITE = E.OPPOSITE;

  const DIRS = ['up', 'left', 'down', 'right']; // ties broken in this order (classic)

  function nearestPac(ghost, state) {
    let best = null, bestDist = Infinity;
    for (const p of state.pacs) {
      if (!p.alive) continue;
      const dx = p.x - ghost.x, dy = p.y - ghost.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
  }

  function pacTile(p) {
    return { x: Math.floor(p.x / TILE), y: Math.floor(p.y / TILE) };
  }

  function pacDirVec(p) {
    const d = DIR[p.lastDir || p.dir || 'left'] || DIR.left;
    return { x: d.x, y: d.y };
  }

  function blinkyTarget(ghost, state) {
    const pac = nearestPac(ghost, state);
    if (!pac) return M.SCATTER_TARGETS.blinky;
    return pacTile(pac);
  }

  function pinkyTarget(ghost, state) {
    const pac = nearestPac(ghost, state);
    if (!pac) return M.SCATTER_TARGETS.pinky;
    const t = pacTile(pac), d = pacDirVec(pac);
    return { x: t.x + d.x * 4, y: t.y + d.y * 4 };
  }

  function inkyTarget(ghost, state) {
    const pac = nearestPac(ghost, state);
    if (!pac) return M.SCATTER_TARGETS.inky;
    const blinky = state.ghosts.find(g => g.name === 'blinky');
    const t = pacTile(pac), d = pacDirVec(pac);
    const pivot = { x: t.x + d.x * 2, y: t.y + d.y * 2 };
    const bTile = blinky ? { x: Math.floor(blinky.x / TILE), y: Math.floor(blinky.y / TILE) } : pivot;
    return { x: 2 * pivot.x - bTile.x, y: 2 * pivot.y - bTile.y };
  }

  function clydeTarget(ghost, state) {
    const pac = nearestPac(ghost, state);
    if (!pac) return M.SCATTER_TARGETS.clyde;
    const t = pacTile(pac);
    const gT = { x: Math.floor(ghost.x / TILE), y: Math.floor(ghost.y / TILE) };
    const dx = gT.x - t.x, dy = gT.y - t.y;
    if (dx * dx + dy * dy > 64) return t;
    return M.SCATTER_TARGETS.clyde;
  }

  const TARGETS = {
    blinky: blinkyTarget, pinky: pinkyTarget, inky: inkyTarget, clyde: clydeTarget,
  };

  function getTargetTile(ghost, state) {
    if (ghost.mode === 'eaten') return M.HOUSE_INSIDE;
    if (ghost.mode === 'scatter') return M.SCATTER_TARGETS[ghost.name];
    return TARGETS[ghost.name](ghost, state);
  }

  function tileIsWall(state, x, y, ghost) {
    return !M.isWalkableForGhost(M.tileAt(state.tiles, x, y), ghost);
  }

  function pickBestDir(ghost, state, target) {
    const gT = { x: Math.floor(ghost.x / TILE), y: Math.floor(ghost.y / TILE) };
    let best = null, bestScore = Infinity;
    for (const dir of DIRS) {
      if (OPPOSITE[ghost.dir] === dir) continue;  // no reversing
      const d = DIR[dir];
      const nx = gT.x + d.x, ny = gT.y + d.y;
      if (tileIsWall(state, nx, ny, ghost)) continue;
      // Forbid up-turn on "red zone" tiles (classic restriction) - skip for simplicity
      const tc = E.tileCenter(target.x, target.y);
      const nc = E.tileCenter(nx, ny);
      const dx = nc.x - tc.x, dy = nc.y - tc.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestScore) { bestScore = dist; best = dir; }
    }
    return best;
  }

  function pickRandomDir(ghost, state) {
    const gT = { x: Math.floor(ghost.x / TILE), y: Math.floor(ghost.y / TILE) };
    const choices = [];
    for (const dir of DIRS) {
      if (OPPOSITE[ghost.dir] === dir) continue;
      const d = DIR[dir];
      if (!tileIsWall(state, gT.x + d.x, gT.y + d.y, ghost)) choices.push(dir);
    }
    if (!choices.length) return ghost.dir;
    return choices[Math.floor(Math.random() * choices.length)];
  }

  function isAtTileCenter(entity) {
    const cx = Math.floor(entity.x / TILE) * TILE + TILE / 2;
    const cy = Math.floor(entity.y / TILE) * TILE + TILE / 2;
    return Math.abs(entity.x - cx) < 0.8 && Math.abs(entity.y - cy) < 0.8;
  }

  // Ghost AI provider: returns desired direction for a ghost at this frame
  function getGhostDir(ghost, state) {
    // House logic overrides targeting
    if (ghost.houseState === 'in') {
      // bob up-down within house
      const cy = Math.floor(ghost.y / TILE) * TILE + TILE / 2;
      if (ghost.y <= cy - 2) return 'down';
      if (ghost.y >= cy + 2) return 'up';
      return ghost.dir === 'up' ? 'up' : 'down';
    }
    if (ghost.houseState === 'leaving') {
      const gT = { x: Math.floor(ghost.x / TILE), y: Math.floor(ghost.y / TILE) };
      const exit = M.HOUSE_EXIT;
      if (gT.y > exit.y) return 'up';
      if (gT.x < exit.x) return 'right';
      if (gT.x > exit.x) return 'left';
      return 'up';
    }
    if (ghost.houseState === 'returning') {
      // Target HOUSE_INSIDE
      if (!isAtTileCenter(ghost)) return ghost.dir;
      return pickBestDir(ghost, state, M.HOUSE_INSIDE) || ghost.dir;
    }

    // On tunnel row, maintain direction
    if (!isAtTileCenter(ghost)) return ghost.dir;

    if (ghost.mode === 'frightened') {
      return pickRandomDir(ghost, state);
    }

    const target = getTargetTile(ghost, state);
    return pickBestDir(ghost, state, target) || ghost.dir;
  }

  window.PacmanAI = {
    getGhostDir,
    getTargetTile,
  };
})();
