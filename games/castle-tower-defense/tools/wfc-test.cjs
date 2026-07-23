#!/usr/bin/env node
/*
 * WFC determinism + adjacency self-test (ADR-031 §5 gate #3).
 *
 * Run from repo root:   node games/castle-tower-defense/tools/wfc-test.cjs
 * Exit 0 on PASS, 1 on FAIL.
 *
 * Verifies:
 *   1. same seed → bit-identical output (determinism)
 *   2. different seeds → meaningfully different output (entropy)
 *   3. pre-seed cells stay pinned through propagation
 *   4. snow palette produces snow-prefixed tiles for snowfall_pass
 *   5. tile_tree_quad never sits next to itself (adjacency restriction)
 *   6. theme-keyed palettes (ADR-034 Group 7b): forest raises tree weight,
 *      mountain excludes tile_tree_quad, an unknown theme falls back to
 *      STANDARD; forest fills generate denser tree cover than plains
 *
 * Pure Node (no browser, no Three.js). The wfc.js / wfc-rules.js modules
 * are pure IIFEs gated on `window`, so we stub a window object.
 */
'use strict';

global.window = { location: { search: '' } };
require('../wfc.js');
require('../wfc-rules.js');

const { generate, hashSeed } = global.window.CTD3WFC;
const { rulesForMap, STANDARD_PALETTE, SNOW_PALETTE } = global.window.CTD3WFCRules;

let pass = 0, fail = 0;
function assert(label, cond, detail) {
  if (cond) { pass++; console.log('  PASS', label); }
  else      { fail++; console.log('  FAIL', label, detail || ''); }
}

// ─── Test 1: determinism ─────────────────────────────────────
{
  const rules = rulesForMap({ id: 'plains' });
  const bounds = { minX: 0, maxX: 9, minZ: 0, maxZ: 5 };
  const seed = hashSeed('plains');
  const r1 = generate({ bounds, palette: rules.palette, adjacency: rules.adjacency, preSeed: null, seed });
  const r2 = generate({ bounds, palette: rules.palette, adjacency: rules.adjacency, preSeed: null, seed });
  let identical = r1.size === r2.size;
  if (identical) {
    for (const [k, v] of r1) {
      if (r2.get(k) !== v) { identical = false; break; }
    }
  }
  assert('determinism (same seed → bit-identical)', identical);
}

// ─── Test 2: entropy ─────────────────────────────────────────
{
  const rules = rulesForMap({ id: 'plains' });
  const bounds = { minX: 0, maxX: 9, minZ: 0, maxZ: 5 };
  const r1 = generate({ bounds, palette: rules.palette, adjacency: rules.adjacency, preSeed: null, seed: hashSeed('plains-a') });
  const r2 = generate({ bounds, palette: rules.palette, adjacency: rules.adjacency, preSeed: null, seed: hashSeed('plains-b') });
  let diff = 0;
  for (const [k, v] of r1) if (r2.get(k) !== v) diff++;
  assert('entropy (different seeds → >= 30% cells differ)', diff / r1.size >= 0.30, `${diff}/${r1.size}`);
}

// ─── Test 3: pre-seed pinning ────────────────────────────────
{
  const rules = rulesForMap({ id: 'plains' });
  const bounds = { minX: 0, maxX: 9, minZ: 0, maxZ: 5 };
  const pre = new Map();
  pre.set('3,2', 'tile_path_straight');
  pre.set('3,3', 'tile_path_corner_round');
  pre.set('7,4', 'tile_path_end_round');
  const r = generate({ bounds, palette: rules.palette, adjacency: rules.adjacency, preSeed: pre, seed: hashSeed('plains') });
  assert('preSeed honored (3,2)', r.get('3,2') === 'tile_path_straight');
  assert('preSeed honored (3,3)', r.get('3,3') === 'tile_path_corner_round');
  assert('preSeed honored (7,4)', r.get('7,4') === 'tile_path_end_round');
}

// ─── Test 4: snow theme ──────────────────────────────────────
{
  const rules = rulesForMap({ id: 'snowfall_pass' });
  const bounds = { minX: 0, maxX: 9, minZ: 0, maxZ: 5 };
  const r = generate({ bounds, palette: rules.palette, adjacency: rules.adjacency, preSeed: null, seed: hashSeed('snowfall_pass') });
  let snowCount = 0, totalCount = 0;
  for (const v of r.values()) {
    totalCount++;
    if (v.startsWith('snow_')) snowCount++;
  }
  assert('snow palette dominates (>=80% snow tiles)', snowCount / totalCount >= 0.80, `${snowCount}/${totalCount}`);
}

// ─── Test 5: adjacency restriction (tree_quad never neighbors itself) ─
{
  const rules = rulesForMap({ id: 'plains' });
  const bounds = { minX: 0, maxX: 12, minZ: 0, maxZ: 12 };
  const r = generate({ bounds, palette: rules.palette, adjacency: rules.adjacency, preSeed: null, seed: hashSeed('plains') });
  let quadNeighborViolations = 0;
  for (const [k, v] of r) {
    if (v !== 'tile_tree_quad') continue;
    const [xs, zs] = k.split(',');
    const x = parseInt(xs, 10), z = parseInt(zs, 10);
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nk = (x + dx) + ',' + (z + dz);
      if (r.get(nk) === 'tile_tree_quad') quadNeighborViolations++;
    }
  }
  assert('tree_quad never neighbors itself', quadNeighborViolations === 0, `${quadNeighborViolations} violations`);
}

// ─── Test 6: theme-keyed palettes (ADR-034 Group 7b) ─────────
// Exercises the theme path that Test 1-5 never touched (they pass only { id }).
function treeWeight(palette) {
  return palette.filter(p => /(^|_)tree/.test(p.id)).reduce((s, p) => s + p.weight, 0);
}
{
  const std      = rulesForMap({ id: 'plains',   theme: 'plains'      }).palette;
  const forest   = rulesForMap({ id: 'forest',   theme: 'forest'      }).palette;
  const mountain = rulesForMap({ id: 'mountain', theme: 'mountain'    }).palette;
  const bogus    = rulesForMap({ id: 'imported', theme: 'no-such-fx'  }).palette;
  // 'constructor' is a prototype-chain key: it's the case paletteForMap's
  // hasOwnProperty guard exists for (a plain `theme in THEME_PALETTES` would
  // resolve it to Object.prototype.constructor and throw on .slice()).
  const protoKey = rulesForMap({ id: 'imported', theme: 'constructor' }).palette;
  assert('forest theme raises tree weight above standard',
    treeWeight(forest) > treeWeight(std), `forest ${treeWeight(forest)} vs std ${treeWeight(std)}`);
  assert('mountain theme excludes tile_tree_quad',
    !mountain.some(p => p.id === 'tile_tree_quad') && std.some(p => p.id === 'tile_tree_quad'),
    mountain.map(p => p.id).join(','));
  assert('unknown theme falls back to STANDARD palette',
    JSON.stringify(bogus) === JSON.stringify(std), bogus.map(p => p.id).join(','));
  assert('prototype-chain theme key falls back to STANDARD (hasOwnProperty guard)',
    JSON.stringify(protoKey) === JSON.stringify(std), protoKey.map(p => p.id).join(','));
}

// ─── Test 7: themed generation density (weights reach the output) ─
{
  const bounds = { minX: 0, maxX: 12, minZ: 0, maxZ: 12 };
  function treeFraction(map, seedStr) {
    const rules = rulesForMap(map);
    const r = generate({ bounds, palette: rules.palette, adjacency: rules.adjacency, preSeed: null, seed: hashSeed(seedStr) });
    let trees = 0, total = 0;
    for (const v of r.values()) { total++; if (/(^|_)tree/.test(v)) trees++; }
    return trees / total;
  }
  // Same seed for both: the only delta is the theme's weights.
  const forestFrac = treeFraction({ id: 'forest', theme: 'forest' }, 'themed-density');
  const plainsFrac = treeFraction({ id: 'plains', theme: 'plains' }, 'themed-density');
  assert('forest fill is denser with trees than plains (same seed)',
    forestFrac > plainsFrac, `forest ${forestFrac.toFixed(2)} vs plains ${plainsFrac.toFixed(2)}`);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
