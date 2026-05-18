/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — wfc-rules.js
   Tile palette + adjacency rules for the WFC procedural-fill pass.
   Two themes: standard ('plains'/'forest'/'tidewater'/'riverbend') and
   snow ('snowfall_pass'). Standard maps share one rule set; snow maps
   use a parallel set of snow_tile_* variants. Mountain uses the
   standard set tinted by lighting — no separate mountain variants
   are needed (the kit doesn't ship them).

   Pure data + a small selector. Loaded via classic <script> before
   wfc.js. Exposes window.CTD3WFCRules.

   Plan reference: ADR-031 §3 Phase 3.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ── Standard theme palette + weights ────────────────────────
  // Weights tuned so tile_ground dominates (~65%), variants form
  // believable patches of hills / rocks / trees without overwhelming.
  //
  // EXCLUDED kit variants (visual color-clash with path-band texture):
  //   - tile_ground_dirt: pure brown tile, looks like a path-tile fragment
  //   - tile_bump:        ~50% of the tile-top is the same brown as path
  //                       tiles' dirt strip; from the iso camera angle,
  //                       bump instances are indistinguishable from
  //                       fragmentary path corners/straights.
  //
  // Remaining palette is composed of variants whose 3D feature reads as
  // distinctly NOT path: hills (green slope), rocks (small mound), trees
  // (vertical cones), crystals (purple). Authors who want dirt/bump
  // patches can place them as hand-authored decoration anchors.
  const STANDARD_PALETTE = [
    { id: 'tile_ground',       weight: 65 },
    { id: 'tile_hill',         weight:  8 },
    { id: 'tile_rock',         weight: 10 },
    { id: 'tile_tree',         weight: 10 },
    { id: 'tile_tree_double',  weight:  4 },
    { id: 'tile_tree_quad',    weight:  2 },
    { id: 'tile_crystal',      weight:  1 }
  ];

  // ── Snow theme palette + weights ────────────────────────────
  // snow_tile_bump excluded for the same reason as standard tile_bump
  // (bump-area shares path-strip texture / color).
  const SNOW_PALETTE = [
    { id: 'snow_tile_ground',       weight: 60 },
    { id: 'snow_tile_hill',         weight:  7 },
    { id: 'snow_tile_rock',         weight: 10 },
    { id: 'snow_tile_tree',         weight:  7 },
    { id: 'snow_tile_tree_double',  weight:  3 },
    { id: 'snow_tile_tree_quad',    weight:  2 },
    { id: 'snow_tile_crystal',      weight:  4 },
    { id: 'tile_ground',            weight:  3 } // sparse green peek-through
  ];

  // ── Adjacency ───────────────────────────────────────────────
  // Most kit tiles are mutually compatible — they all share the same
  // flat-grass base, the visible feature (bump/rock/tree) sits ON TOP.
  // Use simple universal compatibility as the default, then add a few
  // RESTRICTIONS to prevent dense-tree fields:
  //   - tile_tree_quad (4 trees) does not sit next to itself (avoids
  //     visually solid forest blocks)
  //   - tile_rock and tile_tree_quad cannot be neighbors (rock/tree
  //     clusters stay distinct)
  function buildAdjacency(palette) {
    const ids = palette.map(p => p.id);
    const adj = {};
    for (const id of ids) {
      adj[id] = { e: ids.slice(), w: ids.slice(), n: ids.slice(), s: ids.slice() };
    }
    // Restriction helper.
    function restrict(idA, idB) {
      for (const edge of ['e', 'w', 'n', 's']) {
        adj[idA][edge] = adj[idA][edge].filter(x => x !== idB);
        adj[idB][edge] = adj[idB][edge].filter(x => x !== idA);
      }
    }
    // Universal restrictions (apply only if both tiles are in the palette).
    const hasQuad = ids.includes('tile_tree_quad') || ids.includes('snow_tile_tree_quad');
    if (hasQuad) {
      const quadId = ids.includes('tile_tree_quad') ? 'tile_tree_quad' : 'snow_tile_tree_quad';
      restrict(quadId, quadId);
      if (ids.includes('tile_rock')) restrict(quadId, 'tile_rock');
      if (ids.includes('snow_tile_rock')) restrict(quadId, 'snow_tile_rock');
    }
    // Crystals avoid neighboring trees (visual breathing room).
    for (const crystalId of ['tile_crystal', 'snow_tile_crystal']) {
      if (!ids.includes(crystalId)) continue;
      for (const treeId of ['tile_tree', 'tile_tree_double', 'tile_tree_quad',
                            'snow_tile_tree', 'snow_tile_tree_double', 'snow_tile_tree_quad']) {
        if (ids.includes(treeId)) restrict(crystalId, treeId);
      }
    }
    return adj;
  }

  // ── Path-tile adjacency: any standard or snow ground tile may
  //    sit next to a path tile. Path tiles do NOT propagate into the
  //    field-fill palette — they're pre-seeded and the WFC accepts
  //    them as "any allowed neighbor" by including them in the
  //    palette's ids when classifying path cells. We achieve this by
  //    extending the per-tile adjacency to also allow the path tile
  //    IDs we use at runtime.
  const PATH_IDS = [
    'tile_path_straight', 'tile_path_corner_round', 'tile_path_end_round',
    'snow_tile_path_straight', 'snow_tile_path_corner_round', 'snow_tile_path_end_round'
  ];
  function allowPathNeighbors(adj) {
    for (const id in adj) {
      for (const edge of ['e', 'w', 'n', 's']) {
        for (const p of PATH_IDS) {
          if (!adj[id][edge].includes(p)) adj[id][edge].push(p);
        }
      }
    }
    // Path tiles themselves: any tile may neighbor them.
    const groundIds = Object.keys(adj);
    for (const p of PATH_IDS) {
      adj[p] = { e: groundIds.concat(PATH_IDS), w: groundIds.concat(PATH_IDS), n: groundIds.concat(PATH_IDS), s: groundIds.concat(PATH_IDS) };
    }
    return adj;
  }

  // ── Theme selector (called from scene.paintTerrain) ─────────
  function paletteForMap(map) {
    if (map && map.id === 'snowfall_pass') return SNOW_PALETTE.slice();
    return STANDARD_PALETTE.slice();
  }

  function rulesForMap(map) {
    const palette = paletteForMap(map);
    const adjacency = allowPathNeighbors(buildAdjacency(palette));
    return { palette, adjacency };
  }

  window.CTD3WFCRules = {
    STANDARD_PALETTE, SNOW_PALETTE,
    paletteForMap, rulesForMap,
    PATH_IDS
  };
})();
