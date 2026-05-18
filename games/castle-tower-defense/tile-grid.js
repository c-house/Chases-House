/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — tile-grid.js
   Pure IIFE. No Three.js, no DOM, no state. Shared between the
   runtime renderer (scene.paintTerrain) and the editor 3D preview
   (tools/map-editor.html). ADR-030 §6, §8.

   Exposes window.CTD3TileGrid = { classifyPathCells, GRID_SIZE }.

   classifyPathCells(waypoints) -> discriminated union; NEVER throws.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const GRID_SIZE = 1;

  // Direction encoding: 'x+', 'x-', 'z+', 'z-'.
  // Kit's convention (verified by vertex inspection): default orientation
  // points along +Z. tile-straight.glb at rot 0 has its path band running
  // x ∈ [-0.38, +0.38], z ∈ [-0.5, +0.5] (centered in X, full-length in Z).
  // tile-end-round.glb at rot 0 has its mouth at the +z edge (band reaches
  // z=+0.5; rounded back at z=-0.38). To make a tile "face" direction D,
  // rotate by the angle that maps +z → D around the y-axis.
  const DIR_ROTATION = { 'x+': Math.PI / 2, 'z+': 0, 'x-': -Math.PI / 2, 'z-': Math.PI };

  // Corner rotation table — derived from Three.js Y-rotation matrix.
  // Kit's tile-corner-round.glb at rotation 0 has its path band in the
  // tile-local NE quadrant (connects local +x edge to local +z edge).
  // Three.js Y-rotation: (x, z) → (x cos θ + z sin θ, -x sin θ + z cos θ).
  //   θ=0     → local (+x, +z) → world (+x, +z)
  //   θ=π/2   → local (+x, +z) → world (-z, +x)   (open edges: -z, +x)
  //   θ=π     → local (+x, +z) → world (-x, -z)
  //   θ=-π/2  → local (+x, +z) → world (+z, -x)   (open edges: +z, -x = -x, +z)
  // For each (prevDir, nextDir), open edges are {-prevDir, +nextDir}:
  //   prev cell is at -prevDir of current → entry via -prevDir edge
  //   next cell is at +nextDir of current → exit via +nextDir edge
  // Match open-edge set to rotation:
  const CORNER_ROTATION = {
    // Open edges {+x, +z} → rotation 0
    'x-|z+': 0,           // entry -x, exit +z → world edges +x, +z
    'z-|x+': 0,           // entry +z, exit +x → world edges +z, +x
    // Open edges {-x, +z} → rotation -π/2
    'x+|z+': -Math.PI / 2, // entry -x, exit +z
    'z-|x-': -Math.PI / 2, // entry +z, exit -x
    // Open edges {-x, -z} → rotation π
    'x+|z-': Math.PI,     // entry -x, exit -z
    'z+|x-': Math.PI,     // entry -z, exit -x
    // Open edges {+x, -z} → rotation π/2
    'z+|x+': Math.PI / 2, // entry -z, exit +x
    'x-|z-': Math.PI / 2  // entry +x, exit -z
  };

  function dirOf(dx, dz) {
    if (dx > 0) return 'x+';
    if (dx < 0) return 'x-';
    if (dz > 0) return 'z+';
    if (dz < 0) return 'z-';
    return null;
  }

  function classifyPathCells(waypoints) {
    if (!Array.isArray(waypoints) || waypoints.length < 2) {
      return { ok: false, error: 'waypoints must be an array of length >= 2' };
    }

    // ── Validation phase ────────────────────────────────────────
    for (let i = 0; i < waypoints.length; i++) {
      const w = waypoints[i];
      if (!w || !Number.isInteger(w.x) || !Number.isInteger(w.z)) {
        return {
          ok: false,
          error: 'waypoint ' + i + ' has non-integer coord',
          badSegment: { i, a: waypoints[i - 1] || null, b: w || null }
        };
      }
    }
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i], b = waypoints[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z;
      if (dx === 0 && dz === 0) {
        return { ok: false, error: 'duplicate waypoint at index ' + i, badSegment: { i, a, b } };
      }
      if (dx !== 0 && dz !== 0) {
        return { ok: false, error: 'diagonal segment at index ' + i, badSegment: { i, a, b } };
      }
    }

    // ── Walk phase: emit one cell per integer coord traversed ───
    const cells = [];
    cells.push({ x: waypoints[0].x, z: waypoints[0].z, tileType: '', rotation: 0 });
    for (let i = 0; i < waypoints.length - 1; i++) {
      const a = waypoints[i], b = waypoints[i + 1];
      const dxStep = Math.sign(b.x - a.x);
      const dzStep = Math.sign(b.z - a.z);
      let cx = a.x, cz = a.z;
      while (cx !== b.x || cz !== b.z) {
        cx += dxStep;
        cz += dzStep;
        cells.push({ x: cx, z: cz, tileType: '', rotation: 0 });
      }
    }

    // ── Classification phase: examine prev / next direction ────
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      const prev = i > 0 ? cells[i - 1] : null;
      const next = i < cells.length - 1 ? cells[i + 1] : null;
      const prevDir = prev ? dirOf(cell.x - prev.x, cell.z - prev.z) : null;
      const nextDir = next ? dirOf(next.x - cell.x, next.z - cell.z) : null;

      if (prevDir === null) {
        // First cell — spawn end
        cell.tileType = 'tile_path_end_round';
        cell.rotation = DIR_ROTATION[nextDir];
      } else if (nextDir === null) {
        // Last cell — castle end; rounded back faces along prevDir, mouth faces -prevDir
        cell.tileType = 'tile_path_end_round';
        const opposite = { 'x+': 'x-', 'x-': 'x+', 'z+': 'z-', 'z-': 'z+' }[prevDir];
        cell.rotation = DIR_ROTATION[opposite];
      } else if (prevDir === nextDir) {
        cell.tileType = 'tile_path_straight';
        // Straight tiles have bilateral symmetry along their long axis, so
        // pointing them in the direction-of-travel (DIR_ROTATION[nextDir]) is
        // visually equivalent to pointing them either way along that axis.
        // Single source of truth: same lookup table as end_round (DRY).
        cell.rotation = DIR_ROTATION[nextDir];
      } else {
        cell.tileType = 'tile_path_corner_round';
        cell.rotation = CORNER_ROTATION[prevDir + '|' + nextDir] || 0;
      }
    }

    return { ok: true, cells };
  }

  // ── Self-test (URL-guarded) ───────────────────────────────────
  if (typeof window !== 'undefined' && window.location && window.location.search.includes('tile-grid-test')) {
    const log = (label, result) => {
      console.log('[tile-grid-test]', label, result.ok ? 'ok' : 'err', result.ok ? (result.cells.length + ' cells') : result.error);
    };
    log('valid 4-corner', classifyPathCells([
      { x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 0, z: 4 }, { x: 0, z: 0 }
    ]));
    log('diagonal', classifyPathCells([{ x: 0, z: 0 }, { x: 2, z: 2 }]));
    log('duplicate', classifyPathCells([{ x: 0, z: 0 }, { x: 0, z: 0 }]));
    log('non-integer', classifyPathCells([{ x: 0.5, z: 0 }, { x: 1, z: 0 }]));
  }

  window.CTD3TileGrid = { classifyPathCells, GRID_SIZE };
})();
