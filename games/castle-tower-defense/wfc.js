/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — wfc.js
   Compact Wave Function Collapse for the 2D non-path field. Used by
   scene.paintTerrain to populate the open green expanse with kit
   ambient terrain variants (tile_bump, tile_hill, tile_rock, tile_tree*,
   etc.) under adjacency constraints — fixes the "really really bare"
   visual without hand-authoring every cell.

   Pure IIFE. No Three.js, no DOM, no I/O. Deterministic given a seed.
   Pre-seed cells (path + hand-authored decorations) are honored.

   Exposes window.CTD3WFC = {
     generate({ bounds, palette, adjacency, preSeed, seed }) → Map<key,tileId>,
     hashSeed(str: string) → uint32,
     mulberry32(seed: number) → () => float in [0,1)
   };

   Plan reference: §3 Phase 3 (ADR-031 will canonicalize).
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Seeded PRNG (Mulberry32) ─────────────────────────────────
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
    };
  }

  // FNV-1a → uint32 (deterministic seed-from-string).
  function hashSeed(str) {
    let h = 0x811c9dc5;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function cellKey(x, z) { return x + ',' + z; }

  // ── Weighted-random pick from an array of { id, weight } ────
  function weightedPick(items, rand) {
    if (!items || !items.length) return null;
    let total = 0;
    for (const it of items) total += (it.weight > 0 ? it.weight : 0);
    if (total <= 0) return items[0].id;
    let r = rand() * total;
    for (const it of items) {
      r -= (it.weight > 0 ? it.weight : 0);
      if (r <= 0) return it.id;
    }
    return items[items.length - 1].id;
  }

  // ── Edge codes: 'n' +z, 's' -z, 'e' +x, 'w' -x ──────────────
  const DX = { e:  1, w: -1, n:  0, s:  0 };
  const DZ = { e:  0, w:  0, n:  1, s: -1 };
  const OPP = { e: 'w', w: 'e', n: 's', s: 'n' };

  // Given a tileId, the set of neighbor tileIds it permits on each edge.
  // adjacency: { [tileId]: { e: Set<id>, w: Set<id>, n: Set<id>, s: Set<id> } }
  // Helper: build adjacency Sets from a "compat" array-of-pairs spec.
  function buildAdjacency(spec) {
    // spec: { [tileId]: { e: [...], w: [...], n: [...], s: [...] } }
    // Convert array → Set so .has() is O(1) during propagation.
    const out = {};
    for (const id in spec) {
      out[id] = { e: new Set(), w: new Set(), n: new Set(), s: new Set() };
      for (const edge of ['e', 'w', 'n', 's']) {
        const list = (spec[id] && spec[id][edge]) || [];
        for (const nb of list) out[id][edge].add(nb);
      }
    }
    return out;
  }

  // ── Main entry ───────────────────────────────────────────────
  function generate(opts) {
    const { bounds, palette, adjacency, preSeed, seed } = opts;
    const minX = bounds.minX, maxX = bounds.maxX, minZ = bounds.minZ, maxZ = bounds.maxZ;
    const rand = mulberry32(seed >>> 0);

    // adjacency may be in array form; normalize once.
    const adj = (() => {
      // Detect: if first value is a plain object whose edges are Arrays, normalize.
      const firstId = Object.keys(adjacency || {})[0];
      if (firstId && Array.isArray((adjacency[firstId] || {}).e)) return buildAdjacency(adjacency);
      return adjacency || {};
    })();

    // Cell state: Map<key, { possible: Set<id>, collapsed: string|null }>
    const cells = new Map();
    const allIds = palette.map(p => p.id);
    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        cells.set(cellKey(x, z), { x, z, possible: new Set(allIds), collapsed: null });
      }
    }

    // Apply pre-seeds (path cells, hand-authored decorations).
    if (preSeed) {
      const it = preSeed instanceof Map ? preSeed.entries() : Object.entries(preSeed);
      for (const [key, tileId] of it) {
        const cell = cells.get(key);
        if (!cell) continue;
        cell.possible = new Set([tileId]);
        cell.collapsed = tileId;
      }
    }

    // Propagation queue: cells whose possible-set just shrank.
    const queue = [];
    for (const cell of cells.values()) {
      if (cell.collapsed) queue.push(cell);
    }

    function propagate(maxIters) {
      let iters = 0;
      while (queue.length && iters++ < maxIters) {
        const cell = queue.shift();
        for (const edge of ['e', 'w', 'n', 's']) {
          const nx = cell.x + DX[edge], nz = cell.z + DZ[edge];
          const nb = cells.get(cellKey(nx, nz));
          if (!nb || nb.collapsed) continue;
          // Neighbor must include at least one tile compatible with SOMETHING in cell.possible.
          const allowedOnNb = new Set();
          for (const id of cell.possible) {
            const rule = adj[id];
            if (!rule || !rule[edge]) continue;
            for (const v of rule[edge]) allowedOnNb.add(v);
          }
          // Intersect: keep only nb.possible ids that are in allowedOnNb.
          let changed = false;
          for (const id of Array.from(nb.possible)) {
            if (!allowedOnNb.has(id)) { nb.possible.delete(id); changed = true; }
          }
          if (changed) {
            if (nb.possible.size === 0) {
              // Contradiction — recovery: restore palette possibilities so
              // the next collapse picks something weighted-random rather than
              // crashing. Then re-apply hard constraints from any already-
              // COLLAPSED neighbors so we don't reintroduce adjacency
              // violations (e.g., tree_quad next to itself). Robust + invariant.
              nb.possible = new Set(allIds);
              for (const recheckEdge of ['e', 'w', 'n', 's']) {
                const ngx = nb.x + DX[recheckEdge], ngz = nb.z + DZ[recheckEdge];
                const ngh = cells.get(cellKey(ngx, ngz));
                if (!ngh || !ngh.collapsed) continue;
                const oppEdge = OPP[recheckEdge];
                const allowedFromNgh = adj[ngh.collapsed] && adj[ngh.collapsed][oppEdge];
                if (!allowedFromNgh) continue;
                for (const id of Array.from(nb.possible)) {
                  if (!allowedFromNgh.has(id)) nb.possible.delete(id);
                }
              }
              // Belt-and-suspenders: if STILL impossible, pin to palette[0] so
              // the algorithm completes (last-resort, never crashes).
              if (nb.possible.size === 0 && palette && palette.length) {
                nb.possible = new Set([palette[0].id]);
              }
            }
            queue.push(nb);
          }
        }
      }
    }

    propagate(50000);

    // Collapse phase: pick lowest-entropy cell, weighted-random collapse.
    function pickLowestEntropy() {
      let best = null, bestE = Infinity;
      for (const cell of cells.values()) {
        if (cell.collapsed) continue;
        const e = cell.possible.size;
        if (e <= 1) return cell;
        if (e < bestE) { bestE = e; best = cell; }
      }
      return best;
    }

    function collapse(cell) {
      // Map cell.possible → weighted palette subset.
      const subset = palette.filter(p => cell.possible.has(p.id));
      const id = weightedPick(subset.length ? subset : palette, rand);
      cell.collapsed = id;
      cell.possible = new Set([id]);
      queue.push(cell);
    }

    let safety = 1 + (maxX - minX + 1) * (maxZ - minZ + 1);
    while (safety-- > 0) {
      const cell = pickLowestEntropy();
      if (!cell) break;
      collapse(cell);
      propagate(50000);
    }

    // Build result map. Defensive fallback if the palette was empty.
    const fallbackId = (palette && palette.length) ? palette[0].id : 'tile_ground';
    const result = new Map();
    for (const [key, cell] of cells) {
      result.set(key, cell.collapsed || fallbackId);
    }
    return result;
  }

  window.CTD3WFC = { generate, hashSeed, mulberry32, buildAdjacency };
})();
