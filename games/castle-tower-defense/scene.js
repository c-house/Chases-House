/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — scene.js
   Scene-graph owner. State → mesh-transform diff. InstancedMesh
   pools for repeated meshes. Range decals + Warden aura rings.
   Depends on three + assets ONLY (per ADR-028 §7 M-7).
   Exposes window.CTD3Scene.
   ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

// ─── Brand palette (ADR-034 Group 3) ───────────────────────
// Canonical cabin tokens mirrored from .design-system/colors_and_type.css.
// New per-effect color literals should reference TOKENS.X rather than raw
// hex. WARDEN_AURA value duplicates WARDEN_AURA_COLOR (Group 2-owned, kept
// at its declaration site for the Decision A comment block).
const TOKENS = {
  BG_DEEP:      0x0d1410,
  BG_MAIN:      0x152821,
  BG_SURFACE:   0x1f3329,
  ACCENT_GOLD:  0xe8b75a,
  ACCENT_GLOW:  0xf4cc6e,
  ACCENT_EMBER: 0xa06828,
  TERRACOTTA:   0xb05a3a,
  SAGE:         0x7a9460,
  MOSS:         0x4a6a4e,
  FOG:          0x6e8a7a,
  BARK:         0x3a2a1c,
  TEXT_PRIMARY: 0xf0e6d3,
  WARDEN_AURA:  0x8fc6cf
};

// ─── Animation constants (ADR-030 Appendix A) ───────────────
const MUZZLE_FLASH_MS = 80;
const MUZZLE_FLASH_EMISSIVE_HEX = TOKENS.ACCENT_GOLD;
const MUZZLE_FLASH_INTENSITY = 0.6;
const WARDEN_AURA_PERIOD_MS = 800;
const WARDEN_AURA_SCALE_AMP = 0.05;
const WARDEN_AURA_OPACITY_BASE = 0.85;
const WARDEN_AURA_OPACITY_AMP = 0.15;
const WARDEN_AURA_FILL_OPACITY_BASE = 0.22;
const WARDEN_AURA_FILL_OPACITY_AMP = 0.07;
// Warden aura — single sanctioned cool-blue exception per ADR-034 Deliberate
// Decision A. Mistier frost replaces prior neon 0x6fd0e0; never push back
// toward neon 0x00d4ff. Constrained to aura ring + hover preview only.
const WARDEN_AURA_COLOR = 0x8fc6cf;
// Ground clearance for flat decals, and `makeRing`'s default y. Flat ground and
// path tiles stand 0.2 world units tall, so the previous 0.05 clearance sat
// INSIDE the terrain: the Warden aura and its hover preview rendered on no map
// at all — found by the ADR-037 C-4 re-check, which could not judge a colour
// that never reached the screen — and the selected tower's range circle, the
// last caller still taking `makeRing`'s default, was buried the same way until
// the ADR-037 sprint-5 residuals pass (R-1); the sprint-6 leak+burial pass
// (H-1/H-2) then settled `makeDisc` onto this constant too. BOTH flat-decal
// factories (`makeRing`, `makeDisc`) now default y to GROUND_DECAL_Y, and
// tools/sim-harness.cjs guards it — the `decal-*` source-level checks — so the
// burial trap cannot return via a new default or a buried call-site literal.
// 0.24 is the same clearance the slot ring already used over the 0.22-tall
// slot slab, and staying at 0.24 keeps the aura UNDER the slot affordances
// (ring 0.24, place-here disc 0.25) rather than inverting that layering.
// Not a universal clearance: path CORNER tiles reach 0.296 and clip roughly
// 2-5% of a ring's circumference, which is accepted. Taller scenery (hills
// 0.57, rocks 0.75, trees 0.96+) is meant to occlude a ground decal.
const GROUND_DECAL_Y = 0.24;
// Ghost body alpha (ADR-041 D36(b)). The figure-ground lever's differential half.
// This value is scene.js's OWN presentation choice — written onto materials this
// file clones PER INSTANCE and records in userData.ownedMaterials, never a
// property of enemy_ghost2.glb. Provenance checked rather than assumed
// (`git log -S "opacity = 0.55"`): it entered in bae9bac, two months BEFORE the
// ADR-039 roster swap, for the PREVIOUS ghost model, and c562919 carried it
// through untouched — so 0.55 was never tuned for the model now on screen.
// Raising it is
// therefore not the post-load material retinting ADR-034 Decision C excludes:
// alpha is not colour, and no hue/saturation/lightness of the asset is overridden.
//
// It was 0.55, and that was the measured defect rather than a taste call. At 0.55
// the green field blends THROUGH the body, so the ghost rendered green and sat at
// delta-a* +0.6..+4.9 against a reference cohort at +15..+27 — the only type in
// the roster failing to separate from the field on the green-red axis, on all
// three maps it appears on. The measured green was the FIELD, not the ghost.
// 0.78 restores the body while keeping the spectral read (at 1.0 the type stops
// being a ghost, and the change would no longer be a readability fix).
// ADR-041 permits 0.70-0.85; outside that range is a fresh decision.
//
// This is the WHOLE of the figure-ground lever. ADR-041 D36(a) also specified a
// warm rim/kicker DirectionalLight; it was built, measured, and REMOVED, because
// it moved the metric by ~0.25 dE while the alpha moved it by ~8 (see the
// ADR-041 addendum of 2026-07-26). lighting.js is therefore untouched by this
// sprint and ADR-034 Group 2's lighting acceptance is NOT amended after all.
const GHOST_OPACITY = 0.78;
const ENEMY_BOB_RATE_GROUND = 4;
const ENEMY_BOB_RATE_FLYING = 1.6;
const ENEMY_BOB_AMP_GROUND = 0.05;
const ENEMY_BOB_AMP_FLYING = 0.18;

// ─── Enemy presentation table (ADR-039 D27) ─────────────────
// ONE keyed table, not literals scattered through syncEnemies. Every value here
// is presentation only and is never read from or written to an engine entity
// (ADR-030 C-1). ADR-038 D18 is NOT amended by this table: `entities.js` ENEMIES
// keeps its exact hp/speed/armor/bounty/sizeWorld — a monster that looks heavier
// is not heavier.
//
//   model     asset id (10 models cover 11 types — slime and mini_slime are the
//             same creature at two scales, matching the RODIN_Slime /
//             RODIN_Slime.002 pair they replace)
//   scale     uniform scale. Derived, not guessed: targetHeight / measuredHeight,
//             where measuredHeight is the loaded model's world-space bbox height
//             (Quaternius monsters author at ~1.9-3.5 units; the outgoing
//             Kenney/Rodin meshes sat at ~0.5-0.95) and targetHeight is set from
//             the type's design weight so captain still reads biggest.
//   yOffset   corrects models authored off the ground plane. The two Flying-pack
//             models sit above their own origin (skirmisher +0.787, ghost +0.245
//             pre-scale), which would stack on top of the flying baseY — so this
//             normalises each model's base to y=0 and leaves the existing
//             baseY/bob logic to do the elevating.
//   moveClip  which shipped clip loops while walking. Ground types have
//             Walk + Run; the Flying pack ships Fast_Flying / Flying_Idle and no
//             walk at all, which is why the airborne types name a flying clip.
//   animSpeed AnimationAction.timeScale — the clips are authored at one cadence
//             and these creeps move at speeds from 1.1 to 4.5, so a slow heavy
//             must not scurry. Starting values; M-3 tunes them against the eye.
const ENEMY_VIS = {
  footman:    { model: 'enemy_footman2',    scale: 0.278, yOffset: 0,      moveClip: 'Walk',        animSpeed: 1.00 },
  heavy:      { model: 'enemy_heavy2',      scale: 0.398, yOffset: 0,      moveClip: 'Walk',        animSpeed: 0.75 },
  runner:     { model: 'enemy_runner2',     scale: 0.292, yOffset: 0,      moveClip: 'Run',         animSpeed: 1.25 },
  shielded:   { model: 'enemy_shielded2',   scale: 0.264, yOffset: 0,      moveClip: 'Walk',        animSpeed: 0.85 },
  skirmisher: { model: 'enemy_skirmisher2', scale: 0.299, yOffset: -0.235, moveClip: 'Fast_Flying', animSpeed: 1.00 },
  captain:    { model: 'enemy_captain2',    scale: 0.464, yOffset: 0,      moveClip: 'Walk',        animSpeed: 0.70 },
  juggernaut: { model: 'enemy_juggernaut2', scale: 0.491, yOffset: 0,      moveClip: 'Walk',        animSpeed: 0.75 },
  slime:      { model: 'enemy_slime2',      scale: 0.394, yOffset: 0,      moveClip: 'Walk',        animSpeed: 1.00 },
  mini_slime: { model: 'enemy_slime2',      scale: 0.262, yOffset: 0,      moveClip: 'Walk',        animSpeed: 1.15 },
  ghost:      { model: 'enemy_ghost2',      scale: 0.304, yOffset: -0.074, moveClip: 'Fast_Flying', animSpeed: 1.00 },
  // ADR-040 D29. Follows the same targetHeight/measuredHeight rule as every
  // row above — an earlier draft argued for a wingspan-derived scale instead
  // and was wrong twice over: the span it cited was mis-measured, and at a
  // flyer-appropriate height the span never becomes a problem.
  // Measured bind-pose (world[joint] x inverseBindMatrix, weight-blended, the
  // only method that reproduces skirmisher's +0.787 and ghost's +0.245):
  // 2.438 tall, 3.592 across, base +0.771 above its own origin.
  // targetHeight 1.05 = the heavy's rendered height, which lands the drake at
  // 1.05 tall x 1.55 wide: joint-widest with the juggernaut, comfortably under
  // the captain, and clearly the largest flyer (ghost 0.95, skirmisher 0.70) —
  // which is what an air TANK has to look like.
  drake:      { model: 'enemy_drake2',      scale: 0.431, yOffset: -0.332, moveClip: 'Fast_Flying', animSpeed: 0.70 }
};

let scene = null;
let ground = null;
let castleMesh = null;
const groundInstancedMeshes = new Map();  // ADR-031 §3 — tileId → InstancedMesh; one per WFC variant
let pathGroup = null;                  // ADR-030 §9 — cloned kit path tiles
let decorationsGroup = null;           // ADR-030 §10 — cloned decoration meshes
let slotsGroup = null;
let towersGroup = null;
let enemiesGroup = null;
let projectilesGroup = null;
let effectsGroup = null;
let decalsGroup = null;
let wardenAurasGroup = null;  // persistent — separate from decalsGroup (ADR-030 §12, CRIT-3)

// Registries: id → THREE.Object3D
const towerNodes = new Map();
const enemyNodes = new Map();
const projNodes  = new Map();
const effectNodes = new Map();
const wardenAuraNodes = new Map();  // tower.id → ring mesh (persistent across frames)

// Raycaster + reusable plane intersection target
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const tmpHit = new THREE.Vector3();

function init() {
  scene = new THREE.Scene();
  // ADR-034 Group 2 §C — warm pine background + linear fog at the same colour,
  // so the field edge dissolves into canopy rather than hard-cutting to black.
  scene.background = new THREE.Color(0x1a2a20);
  scene.fog = new THREE.Fog(0x1a2a20, 26, 58);

  // Ground plane (large, flat). ADR-034 Group 2 §D — sage-moss rim under the
  // Kenney tile InstancedMesh; rendered visible only when tiles are absent.
  const groundGeo = new THREE.PlaneGeometry(60, 40);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3c5a38, roughness: 0.95 });
  ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // Radial AO disc — cheap fake contact-shadow so the playfield grounds
  // visually against the warm-pine background (ADR-034 Group 2 §D).
  const aoGeo = new THREE.PlaneGeometry(46, 30).rotateX(-Math.PI / 2);
  const aoMat = new THREE.MeshBasicMaterial({
    map: makeRadialAlpha(),
    color: 0x000000,
    transparent: true,
    opacity: 0.5,
    depthWrite: false
  });
  const ao = new THREE.Mesh(aoGeo, aoMat);
  ao.position.y = 0.02;             // just above the underplane, below tiles
  scene.add(ao);

  // Grouping for easy management
  pathGroup        = new THREE.Group(); scene.add(pathGroup);
  decorationsGroup = new THREE.Group(); scene.add(decorationsGroup);
  slotsGroup       = new THREE.Group(); scene.add(slotsGroup);
  towersGroup      = new THREE.Group(); scene.add(towersGroup);
  enemiesGroup     = new THREE.Group(); scene.add(enemiesGroup);
  projectilesGroup = new THREE.Group(); scene.add(projectilesGroup);
  effectsGroup     = new THREE.Group(); scene.add(effectsGroup);
  decalsGroup      = new THREE.Group(); scene.add(decalsGroup);
  wardenAurasGroup = new THREE.Group(); scene.add(wardenAurasGroup);

  // ADR-034 Group 2 §F — shader-based firefly motes. Reduced-motion +
  // low-power gating handled inside initFireflies().
  initFireflies(scene, { count: 14 });
}

// ─── AO disc texture + firefly module (ADR-034 Group 2 §D, §F) ───
function makeRadialAlpha() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 12, 128, 128, 128);
  grd.addColorStop(0, 'rgba(0,0,0,1)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let ffMat = null;
let ffPoints = null;

function initFireflies(s, { count = 14 } = {}) {
  // T13 honored before creation — reduced-motion produces zero Points.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.CTD3Renderer && window.CTD3Renderer.isLowPower && window.CTD3Renderer.isLowPower()) {
    count = Math.min(count, 6);
  }
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * 44;   // x across field
    pos[i * 3 + 1] = 0.6 + Math.random() * 4;      // y just above ground
    pos[i * 3 + 2] = (Math.random() - 0.5) * 28;   // z
    seed[i] = Math.random() * 6.28;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed',    new THREE.BufferAttribute(seed, 1));
  ffMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime:  { value: 0 },
      uColor: { value: new THREE.Color(0xf4cc6e) },   // matches --accent-glow
      uSize:  { value: 90 }
    },
    vertexShader: `
      attribute float aSeed;
      uniform float uTime, uSize;
      varying float vTw;
      void main() {
        vec3 p = position;
        p.y += mod(uTime * 0.35 + aSeed * 1.4, 5.0);   // slow rise + wrap
        p.x += sin(uTime * 0.5 + aSeed) * 0.6;
        p.z += cos(uTime * 0.4 + aSeed * 1.3) * 0.6;
        vTw = 0.5 + 0.5 * sin(uTime * 1.6 + aSeed * 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uSize * vTw / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vTw;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, d) * vTw * 0.9);
      }`
  });
  ffPoints = new THREE.Points(geo, ffMat);
  ffPoints.frustumCulled = false;
  s.add(ffPoints);
}

function tickFireflies(dtMs) {
  if (ffMat) ffMat.uniforms.uTime.value += dtMs * 0.001;
}

function getScene() { return scene; }

// Remove all WFC-emitted ground InstancedMeshes. Geometry/material are
// shared cache refs (do not dispose); only per-instance GPU buffers
// (instanceMatrix/instanceColor) belong to the InstancedMesh.
function clearGroundInstancedMeshes() {
  groundInstancedMeshes.forEach((mesh) => {
    scene.remove(mesh);
    if (typeof mesh.dispose === 'function') mesh.dispose();
  });
  groundInstancedMeshes.clear();
}

// ─── paintTerrain: one-time per map (ADR-030 §9) ─────────────
// Replaces makeRibbonGeometry-based ribbon with kit ground InstancedMesh
// + cloned path tiles + cloned decorations. Themes select snow_tile_* by
// map.id (no theme-enum widening — review-#1 C-3).
function paintTerrain(map) {
  // Clear previous map's terrain pieces.
  // Do NOT dispose the InstancedMesh's geometry/material — those are shared
  // references owned by the assets cache (review-#3 MAJOR-2). InstancedMesh's
  // own dispose() releases only the per-instance GPU buffers, not the
  // underlying geometry/material — safe to call.
  clearGroundInstancedMeshes();
  if (castleMesh) { scene.remove(castleMesh); castleMesh = null; }
  pathGroup.clear();
  decorationsGroup.clear();
  slotsGroup.clear();
  // Hide the placeholder green ground plane — kit ground tiles replace it.
  if (ground) ground.visible = false;

  // 1. Compute playfield bounds from path + castle + slots, with 4-cell padding.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const include = (x, z) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  };
  for (const p of map.path) include(p.x, p.z);
  include(map.castle.x, map.castle.z);
  for (const s of map.buildSlots) include(s.x, s.z);
  minX = Math.floor(minX) - 4;  maxX = Math.ceil(maxX) + 4;
  minZ = Math.floor(minZ) - 4;  maxZ = Math.ceil(maxZ) + 4;

  // 2. Theme variants — snow override is by map.id, not theme tag.
  const isSnow = (map.id === 'snowfall_pass');
  const pathPrefix = isSnow ? 'snow_tile_path_' : 'tile_path_';
  const fallbackGroundId = isSnow ? 'snow_tile_ground' : 'tile_ground';

  // 3a. Path: classify FIRST so we can skip ground placement under path cells
  // (kit ground + path tiles share y-extent → z-fighting if stacked).
  const result = window.CTD3TileGrid.classifyPathCells(map.path);
  const pathCellSet = new Set();
  if (!result.ok) {
    console.error('[scene] path invalid for', map.id, '—', result.error, result.badSegment);
  } else {
    for (const cell of result.cells) {
      pathCellSet.add(cell.x + ',' + cell.z);
    }
  }

  // 3a-bis. Reserved cells get plain ground from WFC instead of a variant.
  // Reservations:
  //   - slot cells (plinth visibility — no tree/rock obscuring)
  //   - castle cell
  //   - 1-cell halo around every path cell (so WFC variants don't crowd the
  //     road — keeps the path visually clear and gives the player room to
  //     read the route).
  const reservedGroundCellSet = new Set();
  for (const s of map.buildSlots) reservedGroundCellSet.add(Math.round(s.x) + ',' + Math.round(s.z));
  reservedGroundCellSet.add(Math.round(map.castle.x) + ',' + Math.round(map.castle.z));
  // Path halo: every cell within Chebyshev distance 1 of any path cell.
  for (const cellKey of pathCellSet) {
    const [pxs, pzs] = cellKey.split(',');
    const px = parseInt(pxs, 10), pz = parseInt(pzs, 10);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;  // path cell itself handled separately
        reservedGroundCellSet.add((px + dx) + ',' + (pz + dz));
      }
    }
  }

  // 3b. Ground: WFC-driven variants per non-path cell (ADR-031 §3 Phase 4).
  // wfcMode: 'off' uses uniform fallback ground tile (ADR-030 behavior);
  //          'augment' / 'fill' run WFC for terrain variety.
  const wfcMode = map.wfcMode || 'augment';
  const cellToTileId = new Map();  // key → tileId
  if (wfcMode === 'off' || !window.CTD3WFC || !window.CTD3WFCRules) {
    // Uniform fallback (preserves pre-ADR-031 visuals).
    for (let cz = minZ; cz <= maxZ; cz++) {
      for (let cx = minX; cx <= maxX; cx++) {
        const k = cx + ',' + cz;
        if (pathCellSet.has(k)) continue;
        cellToTileId.set(k, fallbackGroundId);
      }
    }
  } else {
    const rules = window.CTD3WFCRules.rulesForMap(map);
    // Pre-seed path cells with their classified IDs so WFC respects them as
    // immutable neighbors.
    const preSeed = new Map();
    if (result.ok) {
      for (const cell of result.cells) {
        const pathId = pathPrefix + cell.tileType.replace('tile_path_', '');
        preSeed.set(cell.x + ',' + cell.z, pathId);
      }
    }
    const seed = (typeof map.wfcSeed === 'number')
      ? (map.wfcSeed >>> 0)
      : window.CTD3WFC.hashSeed(map.id || 'plains');
    const wfcOut = window.CTD3WFC.generate({
      bounds: { minX, maxX, minZ, maxZ },
      palette: rules.palette,
      adjacency: rules.adjacency,
      preSeed,
      seed
    });
    for (const [k, id] of wfcOut) {
      if (pathCellSet.has(k)) continue;  // path cells handled separately
      // Slot + castle cells get plain ground so plinth / castle isn't
      // visually competing with a tree/hill/rock sharing the same cell.
      cellToTileId.set(k, reservedGroundCellSet.has(k) ? fallbackGroundId : id);
    }
  }

  // 3c. Group cells by tileId so we use one InstancedMesh per variant.
  const cellsByTile = new Map();  // tileId → [{x, z}]
  for (const [k, tileId] of cellToTileId) {
    if (!cellsByTile.has(tileId)) cellsByTile.set(tileId, []);
    const [xs, zs] = k.split(',');
    cellsByTile.get(tileId).push({ x: parseInt(xs, 10), z: parseInt(zs, 10) });
  }

  // 3d. Build one InstancedMesh per tileId (skips path tiles — those render
  // as cloned meshes in step 4 so corner rotations are honored).
  const tmpMat = new THREE.Matrix4();
  for (const [tileId, cells] of cellsByTile) {
    if (!window.CTD3Assets.hasMesh(tileId)) continue;
    const handle = window.CTD3Assets.getInstanced(tileId, cells.length);
    if (!handle || !handle.mesh) continue;
    for (let i = 0; i < cells.length; i++) {
      tmpMat.makeTranslation(cells[i].x, 0, cells[i].z);
      handle.setMatrixAt(i, tmpMat);
    }
    handle.setCount(cells.length);
    handle.commit();
    handle.mesh.receiveShadow = true;
    groundInstancedMeshes.set(tileId, handle.mesh);
    scene.add(handle.mesh);
  }

  // 4. Path: place kit path tiles at classified cells. y=0 (same elevation as
  // ground tiles, no z-fight because ground is skipped at these cells).
  if (result.ok) {
    for (const cell of result.cells) {
      const tileId = pathPrefix + cell.tileType.replace('tile_path_', '');
      const mesh = window.CTD3Assets.getMesh(tileId);
      mesh.position.set(cell.x, 0, cell.z);
      mesh.rotation.y = cell.rotation;
      mesh.traverse(o => { if (o.isMesh) { o.receiveShadow = true; } });
      pathGroup.add(mesh);
    }
  }

  // 5. Castle — stacked square keep (kit: tower-square-bottom + middle + roof).
  // Each kit piece is 0.5u tall (measured at runtime, not 1u). Stack at
  // half-unit offsets so pieces share a flush seam with no gap or overlap.
  const keep = new THREE.Group();
  const keepBot  = window.CTD3Assets.getMesh('keep_bottom');
  const keepMid  = window.CTD3Assets.getMesh('keep_middle');
  const keepRoof = window.CTD3Assets.getMesh('keep_roof');
  keepBot.position.set(0, 0,   0);
  keepMid.position.set(0, 0.5, 0);
  keepRoof.position.set(0, 1.0, 0);
  keep.add(keepBot, keepMid, keepRoof);
  keep.position.set(map.castle.x, 0, map.castle.z);
  keep.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  castleMesh = keep;
  scene.add(castleMesh);

  // 6. Slot stone slabs + invisible collider planes for raycast (ADR-028 §13).
  // A flat, low stone slab (0.9 × 0.12 × 0.9) that doesn't compete on z-height
  // with WFC terrain features. Cool grey-stone color (#a8a39c) reads
  // distinctly against grass-green; slight darker rim suggests an inset.
  // Empty buildable slots glow green when the user has a tower selected
  // — handled separately in syncDecals so the highlight is reactive.
  for (const slot of map.buildSlots) {
    // Slab — flat stone tile, ground-aware. Warm cream contrasts grass green.
    const slabGeo = new THREE.BoxGeometry(0.95, 0.22, 0.95);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0xd8c8b0, roughness: 0.88, metalness: 0.0
    });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(slot.x, 0.11, slot.z);
    slab.castShadow = true;
    slab.receiveShadow = true;
    slot._slabRef = slab;
    slotsGroup.add(slab);
    // Rim — wider darker base so the slab reads as inset / mortared.
    const rimGeo = new THREE.BoxGeometry(1.08, 0.06, 1.08);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x6a4a28, roughness: 0.95
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(slot.x, 0.03, slot.z);
    rim.receiveShadow = true;
    slotsGroup.add(rim);
    // Invisible collider plane for tap targets (~2.5 world units = generous)
    const colGeo = new THREE.PlaneGeometry(2.5, 2.5);
    colGeo.rotateX(-Math.PI / 2);
    const colMat = new THREE.MeshBasicMaterial({ visible: false });
    const collider = new THREE.Mesh(colGeo, colMat);
    collider.position.set(slot.x, 0.15, slot.z);
    collider.userData = { kind: 'slot', id: slot.id };
    slotsGroup.add(collider);
  }

  // 7. Decorations — read window.CTD3Decorations[map.id].
  paintDecorations(map.id);

  performance.mark('first-map-render-complete');
}

// ─── paintDecorations (ADR-030 §10, extended ADR-031 §3.4) ────
// Honors map.wfcMode: 'fill' SKIPS hand-authored decorations so the WFC
// terrain output is the sole source of visual fill. 'augment' (default)
// and 'off' render hand-authored decorations as anchors on top.
function paintDecorations(mapId) {
  const map = (window.CTD3Maps && typeof window.CTD3Maps.byId === 'function')
    ? window.CTD3Maps.byId(mapId)
    : null;
  if (map && map.wfcMode === 'fill') return;
  const decorations = (window.CTD3Decorations && window.CTD3Decorations[mapId]) || [];
  for (const d of decorations) {
    if (!d || typeof d.type !== 'string') continue;
    const targetId = (d.size === 'large') ? `${d.type}_large` : d.type;
    let node;
    if (d.size === 'large' && !window.CTD3Assets.hasMesh(targetId)) {
      // Defensive fallback — currently dead (kit ships _large for tree, rocks,
      // and crystal as of Phase 2), kept for hypothetical future types.
      node = window.CTD3Assets.getMesh(d.type);
      node.scale.setScalar(1.5);
    } else if (!window.CTD3Assets.hasMesh(targetId)) {
      console.warn('[scene] decoration mesh missing:', targetId);
      continue;
    } else {
      node = window.CTD3Assets.getMesh(targetId);
    }
    node.position.set(d.x, 0, d.z);
    node.rotation.y = (typeof d.rotation === 'number') ? d.rotation : (Math.random() * Math.PI * 2);
    node.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    decorationsGroup.add(node);
  }
}

// ─── clearPlayfield: between runs ────────────────────────────
function clearPlayfield() {
  towerNodes.forEach(n => towersGroup.remove(n));
  // Second of the two enemy teardown sites (the first is the despawn loop in
  // syncEnemies). Leaving a map mid-wave must free the live enemies' mixers and
  // per-instance skeletons too, or every map change leaks a wave's worth —
  // exactly the one-site-fixed-two-sites-needed shape of ADR-037 H-1.
  enemyNodes.forEach(n => { disposeEnemyNode(n); enemiesGroup.remove(n); });
  // The ?test=roster sheet registers its nodes in enemyNodes (so the loop above
  // reaches them); drop its mixer list too, or tickRosterDebug keeps advancing
  // mixers whose roots have just been uncached.
  rosterDebugMixers.length = 0;
  projNodes.forEach(n => projectilesGroup.remove(n));
  effectNodes.forEach(n => effectsGroup.remove(n));
  towerNodes.clear();
  enemyNodes.clear();
  projNodes.clear();
  effectNodes.clear();
  // Transient decals own per-instance GPU buffers (makeRing/makeDisc allocate
  // fresh each) — dispose before clearing, same as the Warden auras below, so
  // leaving a map does not leak the last frame's decals (ADR-037 sprint-6 H-1).
  for (const o of decalsGroup.children) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  }
  decalsGroup.clear();
  // Persistent Warden aura registry (ADR-030 §12, CRIT-2). Nodes are Groups
  // containing ring + fill children — traverse to dispose both.
  wardenAuraNodes.forEach((node) => {
    wardenAurasGroup.remove(node);
    node.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  });
  wardenAuraNodes.clear();
  // Terrain assets are also map-scoped — drop them when leaving a map.
  // See paintTerrain note on InstancedMesh disposal (review-#3 MAJOR-2).
  if (pathGroup) pathGroup.clear();
  if (decorationsGroup) decorationsGroup.clear();
  clearGroundInstancedMeshes();
  if (castleMesh) { scene.remove(castleMesh); castleMesh = null; }
}

// ─── Entity sync (state diff → mesh transforms) ──────────────
// `dtMs` is the caller's frame delta, already scaled for fast-forward. It exists
// for the skinned-enemy mixers (ADR-039 D27): taking the game's dt rather than
// re-deriving wall-clock time here keeps walk cycles in step with path movement
// at 2x instead of the feet sliding. Optional — updateEnemyMixers falls back to
// a nominal frame time if it is absent, so an older call site still animates.
function sync(state, dtMs) {
  syncTowers(state);
  syncEnemies(state);
  syncProjectiles(state);
  syncEffects(state);
  syncWardenAuras(state);
  syncDecals(state);
  updateEnemyMixers(dtMs);
}

// Object3D.clone(true) shares materials by reference, so mutating one tower's
// emissive (muzzle flash) bleeds to every other tower instance that started
// from the same source mesh. Clone every material on a freshly-built tower
// node so per-instance emissive writes stay local.
function clonePerInstanceMaterials(node) {
  node.traverse(o => {
    if (o.isMesh && o.material) {
      o.material = o.material.clone();
    }
  });
}

function syncTowers(state) {
  const seen = new Set();
  const now = performance.now();
  for (const tw of state.towers) {
    seen.add(tw.id);
    let node = towerNodes.get(tw.id);
    if (!node) {
      const meshId = `tower_${tw.type}_t${tw.tier + 1}`;
      node = window.CTD3Assets.getMesh(meshId);
      clonePerInstanceMaterials(node);
      node.position.set(tw.x, 0, tw.z);
      node.userData.meshId = meshId;
      node.userData.towerId = tw.id;
      node.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      towerNodes.set(tw.id, node);
      towersGroup.add(node);
    } else {
      // Tier may have changed → swap mesh
      const desiredMeshId = `tower_${tw.type}_t${tw.tier + 1}`;
      if (node.userData.meshId !== desiredMeshId) {
        towersGroup.remove(node);
        const fresh = window.CTD3Assets.getMesh(desiredMeshId);
        clonePerInstanceMaterials(fresh);
        fresh.position.set(tw.x, 0, tw.z);
        fresh.userData.meshId = desiredMeshId;
        fresh.userData.towerId = tw.id;
        // Preserve any in-flight muzzle-flash deadline across tier swaps.
        if (node.userData.flashUntilMs) fresh.userData.flashUntilMs = node.userData.flashUntilMs;
        fresh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        towerNodes.set(tw.id, fresh);
        towersGroup.add(fresh);
        node = fresh;
      }
    }
    // Muzzle flash via emissive pulse (ADR-030 §11.4).
    applyMuzzleFlash(node, now);
  }
  // Remove vanished
  for (const [id, node] of towerNodes) {
    if (!seen.has(id)) {
      towersGroup.remove(node);
      towerNodes.delete(id);
    }
  }
}

function applyMuzzleFlash(node, now) {
  const deadline = node.userData.flashUntilMs || 0;
  const flashing = now < deadline;
  node.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    // Skip materials lacking emissive (MeshBasicMaterial etc.)
    if (!o.material.emissive) return;
    if (!o.userData._origEmissiveCached) {
      o.userData._origEmissiveHex = o.material.emissive.getHex();
      o.userData._origEmissiveIntensity = o.material.emissiveIntensity ?? 0;
      o.userData._origEmissiveCached = true;
    }
    if (flashing) {
      o.material.emissive.setHex(MUZZLE_FLASH_EMISSIVE_HEX);
      o.material.emissiveIntensity = MUZZLE_FLASH_INTENSITY;
    } else {
      o.material.emissive.setHex(o.userData._origEmissiveHex);
      o.material.emissiveIntensity = o.userData._origEmissiveIntensity;
    }
  });
}

function flashTower(towerId) {
  const node = towerNodes.get(towerId);
  if (!node) return;
  node.userData.flashUntilMs = performance.now() + MUZZLE_FLASH_MS;
}

// ─── Skinned-enemy animation lifecycle (ADR-039 D27) ─────────
// Are skeletal mixers allowed to run at all? Two independent gates, both
// pre-existing project rules rather than new policy:
//   - reduced motion (T13 / CTD3Ui.motionAllowed) — a walk cycle is motion
//   - low power (CTD3Renderer.isLowPower) — a mixer per live enemy is the
//     per-frame cost this mode exists to shed, so it is disabled outright
//     rather than capped. Enemies then stop advancing their clip and fall back to
//     the procedural bob below, which is what shipped before this sprint.
function mixersAllowed() {
  const ui = window.CTD3Ui;
  if (ui && typeof ui.motionAllowed === 'function' && !ui.motionAllowed()) return false;
  const r = window.CTD3Renderer;
  if (r && typeof r.isLowPower === 'function' && r.isLowPower()) return false;
  return true;
}

// Free everything an enemy node owns per-instance. Called from BOTH teardown
// sites (per-enemy despawn AND clearPlayfield) — sprint 6's decal leak needed
// exactly this pair, and missing either one leaks the same way.
//
// WHAT IS DELIBERATELY *NOT* DISPOSED, and why getting this wrong is worse than
// the leak it would look like it fixes: geometry and the source materials are
// SHARED BY REFERENCE with the CTD3Assets cache (getMesh clones from a cached
// gltf.scene; SkeletonUtils.clone shares BufferGeometry too). Disposing them
// here would free the GPU buffers every FUTURE spawn of that type still points
// at. This is the opposite of the transient-decal case, where every geometry was
// freshly allocated per call and therefore had to be disposed (ADR-037 H-1).
// tools/sim-harness.cjs guards the distinction in both directions.
function disposeEnemyNode(node) {
  const ud = node.userData || {};
  if (ud.mixer) {
    ud.mixer.stopAllAction();
    // Mixers retain an internal binding cache keyed by root object; dropping the
    // reference alone is not enough.
    ud.mixer.uncacheRoot(node);
    ud.mixer = null;
  }
  // SkeletonUtils.clone builds a SEPARATE Skeleton per SkinnedMesh (measured: 11
  // for the footman model, 3-7 for the rest) and each lazily allocates its own
  // bone texture on first render. Those ARE per-instance and must be freed. Set
  // -deduped in case a future asset shares one skeleton across primitives.
  const skeletons = new Set();
  node.traverse(o => { if (o.isSkinnedMesh && o.skeleton) skeletons.add(o.skeleton); });
  for (const sk of skeletons) { if (typeof sk.dispose === 'function') sk.dispose(); }
  // Materials we cloned per instance (the ghost translucency path) — these are
  // ours, unlike the shared source materials above.
  if (ud.ownedMaterials) {
    for (const m of ud.ownedMaterials) m.dispose();
    ud.ownedMaterials = null;
  }
}

// Advance every live enemy's mixer. Driven by the existing per-frame tick:
// game.js passes its already-fast-forward-scaled dt into sync(), so walk cycles
// stay in step with path movement at 2× instead of sliding.
function updateEnemyMixers(dtMs) {
  if (!mixersAllowed()) return;
  const dtSec = (typeof dtMs === 'number' && dtMs > 0 ? Math.min(dtMs, 250) : 16.7) / 1000;
  for (const node of enemyNodes.values()) {
    const m = node.userData.mixer;
    if (m) m.update(dtSec);
  }
}

// Drop every live mixer when the renderer trips into low power mid-run, so the
// saving lands on the current wave rather than only on the next one. Enemies
// alive at the moment of the switch finish their journey frozen in whatever
// pose the mixer last wrote (NOT the bind/rest pose — stopAllAction does not
// restore bound properties); new
// spawns get mixers again once low power clears. Bounded and deliberate.
function releaseAllEnemyMixers() {
  for (const node of enemyNodes.values()) {
    const ud = node.userData;
    if (ud.mixer) {
      ud.mixer.stopAllAction();
      ud.mixer.uncacheRoot(node);
      ud.mixer = null;
    }
  }
}

function syncEnemies(state) {
  const seen = new Set();
  const t = performance.now() / 1000;
  const map = state.mapDef;
  for (const en of state.enemies) {
    seen.add(en.id);
    const vis = ENEMY_VIS[en.type] || null;
    let node = enemyNodes.get(en.id);
    if (!node) {
      // Defensive fallback for an enemy type added ahead of its model. NOTE the
      // legacy `enemy_<type>` ids are no longer in MANIFEST.json — their entries
      // were dropped so preload() stops fetching a second, unused roster — so this
      // path now yields the magenta placeholder rather than an old mesh, which is
      // the louder and more honest failure. Dead today: ENEMY_VIS covers all
      // eleven ENEMIES keys and tools/sim-harness.cjs asserts that it still does.
      const meshId = (vis && vis.model) || `enemy_${en.type}`;
      node = window.CTD3Assets.getMesh(meshId);
      // Ghost: per-instance translucent material so a future fade-out doesn't
      // bleed across all ghosts (clones share materials by reference). These
      // clones are per-instance and therefore OURS to dispose — record them.
      if (en.type === 'ghost') {
        const owned = [];
        node.traverse(o => {
          if (o.isMesh && o.material) {
            o.material = o.material.clone();
            o.material.transparent = true;
            o.material.opacity = GHOST_OPACITY;
            // Stays FALSE at the raised alpha (ADR-041 D36(b)). At 0.78 the body
            // is still transparent, so depthWrite:true would clip what renders
            // behind it and would newly interact with the ground decals under
            // the creep — trading a readability fix for a sorting bug.
            o.material.depthWrite = false;
            owned.push(o.material);
          }
        });
        node.userData.ownedMaterials = owned;
      }
      node.traverse(o => { if (o.isMesh) o.castShadow = true; });
      // Per-enemy random bob offset (presentation only — never on engine entity, ADR-030 C-1).
      node.userData.bobPhase = Math.random() * Math.PI * 2;

      // One AnimationMixer per live enemy, looping its move clip.
      const clips = window.CTD3Assets.getClips(meshId);
      if (clips && clips.length && mixersAllowed()) {
        const wanted = (vis && vis.moveClip) || null;
        let clip = wanted ? THREE.AnimationClip.findByName(clips, wanted) : null;
        if (!clip) {
          // Fall back to the first NON-death clip, never blindly to clips[0]:
          // every model in this roster ships `Death` first, so a mistyped
          // moveClip would otherwise loop the death animation while walking —
          // silently, and looking like a bad model rather than a bad string.
          clip = clips.find(c => !/death/i.test(c.name)) || clips[0];
          console.warn('[scene] enemy', en.type, 'moveClip', JSON.stringify(wanted),
                       'not found in', meshId, '— falling back to', clip && clip.name,
                       '· available:', clips.map(c => c.name).join(','));
        }
        if (clip) {
          const mixer = new THREE.AnimationMixer(node);
          const action = mixer.clipAction(clip);
          action.timeScale = (vis && vis.animSpeed) || 1;
          // Desync identical creeps — a whole wave stepping in perfect unison
          // reads as one object, not a crowd.
          action.time = Math.random() * clip.duration;
          action.play();
          node.userData.mixer = mixer;
        }
      }
      enemyNodes.set(en.id, node);
      enemiesGroup.add(node);
    }
    const def = window.CTD3Entities.ENEMIES[en.type];
    const isFlying = !!def?.isFlying;
    const baseY = isFlying ? 1.2 : 0;
    const phase = node.userData.bobPhase;

    // Per-type movement personality. Slime + MiniSlime hop with squash-and-stretch;
    // Juggernaut has a slow heavy lurch with side-roll; Ghost gets stronger float
    // and a yaw wobble. Other types keep the original ground/flying bob.
    const animated = !!node.userData.mixer;

    let bobY = 0, scaleX = 1, scaleY = 1, scaleZ = 1, yawWobble = 0;
    if (!window.CTD3Ui.motionAllowed()) {
      // motion off — leave everything at neutral
    } else if (animated) {
      // A real skeletal clip now owns this creature's movement, so the
      // procedural personality below is the FALLBACK for un-animated enemies
      // rather than a layer on top of animation. Running both would double it —
      // a squash-and-stretch hop applied to a model that is already hopping, a
      // lurch on top of a walk cycle. Flying types keep their elevation, which
      // comes from baseY and not from this block. Yaw-toward-travel and the
      // hit-flash scale below still apply: neither is in the clips.
    } else if (en.type === 'slime' || en.type === 'mini_slime') {
      const hop = Math.abs(Math.sin(t * 5.0 + phase));
      const squash = 1 - hop * 0.25;
      bobY = hop * 0.22;
      scaleY = 1 / squash;
      scaleX = scaleZ = squash;
    } else if (en.type === 'juggernaut') {
      const p = t * 1.8 + phase;
      bobY = Math.abs(Math.sin(p)) * 0.04;
      yawWobble = Math.sin(p) * 0.06;
    } else if (en.type === 'ghost') {
      bobY = Math.sin(t * ENEMY_BOB_RATE_FLYING + phase) * (ENEMY_BOB_AMP_FLYING * 1.3);
      yawWobble = Math.sin(t * 1.2 + phase * 1.7) * 0.15;
    } else if (isFlying) {
      bobY = Math.sin(t * ENEMY_BOB_RATE_FLYING + phase) * ENEMY_BOB_AMP_FLYING;
    } else {
      bobY = Math.abs(Math.sin(t * ENEMY_BOB_RATE_GROUND + phase)) * ENEMY_BOB_AMP_GROUND;
    }

    node.position.set(en.x, baseY + bobY + (vis ? vis.yOffset : 0), en.z);
    // Yaw toward direction of travel (lookahead along path), plus per-type wobble.
    if (map && map.totalLength > 0) {
      const lookT = Math.min(1, en.pathT + 0.005);
      const next = window.CTD3Engine.sampleOnPath(map, lookT);
      const dx = next.x - en.x, dz = next.z - en.z;
      if (dx !== 0 || dz !== 0) {
        // FORWARD-AXIS CONVENTION. The Quaternius roster is authored facing
        // local +Z — verified on every shipped model by measuring the centroid
        // of its eye meshes against the model's bounding-box centre. The retired
        // Kenney enemy meshes faced -X, which is what the previous expression
        // (`atan2(dz, dx) + PI`) encoded. Carrying that expression over to the
        // new models rotated every creep 90 degrees off its direction of travel
        // — measured live at exactly 90 deg error, i.e. they walked sideways.
        //
        // For a +Z-forward model, rotation.y = t maps local +Z to world
        // (sin t, 0, cos t), so aligning forward with travel (dx, dz) is
        // precisely atan2(dx, dz). ADR-030's tile work established the same
        // class of gotcha for path tiles; this is its enemy-mesh counterpart.
        //
        // `yawOffset` is the per-type escape hatch for any future asset authored
        // on a different axis — the legacy `enemy_<type>` fallback meshes would
        // need one if they were ever rendered again.
        const yawBase = Math.atan2(dx, dz) + ((vis && vis.yawOffset) || 0);
        node.rotation.y = yawBase + yawWobble;
      }
    }
    // Hit-flash scales on top of the per-type base scale and (when un-animated)
    // the squash-and-stretch. The base scale is folded in HERE rather than set
    // once at creation because this line rewrites scale every frame.
    const flash = en.hitFlashMs > 0 ? 1.1 : 1.0;
    const base = vis ? vis.scale : 1;
    node.scale.set(base * scaleX * flash, base * scaleY * flash, base * scaleZ * flash);
  }
  for (const [id, node] of enemyNodes) {
    if (!seen.has(id)) {
      // Free per-instance GPU/mixer resources before dropping the node. Without
      // this, every kill leaks its mixer bindings and its per-instance skeletons'
      // bone textures — the skinned-mesh analogue of the ADR-037 decal leak.
      disposeEnemyNode(node);
      enemiesGroup.remove(node);
      enemyNodes.delete(id);
    }
  }
}

function syncProjectiles(state) {
  const seen = new Set();
  for (const pr of state.projectiles) {
    seen.add(pr.id);
    let node = projNodes.get(pr.id);
    if (!node) {
      const geo = pr.kind === 'cannonball'
        ? new THREE.SphereGeometry(0.18, 8, 8)
        : new THREE.SphereGeometry(0.12, 6, 6);
      const color = pr.kind === 'cannonball' ? TOKENS.BARK
                  : pr.kind === 'magebolt'   ? TOKENS.ACCENT_GOLD
                  : TOKENS.TEXT_PRIMARY;
      const mat = new THREE.MeshBasicMaterial({ color });
      node = new THREE.Mesh(geo, mat);
      projNodes.set(pr.id, node);
      projectilesGroup.add(node);
    }
    node.position.set(pr.x, pr.y || 0.6, pr.z);
    // Rotate toward velocity (Y-axis only — projectiles travel parallel to ground).
    if (pr.vx !== 0 || pr.vz !== 0) {
      node.rotation.y = Math.atan2(pr.vz, pr.vx);
    }
  }
  for (const [id, node] of projNodes) {
    if (!seen.has(id)) {
      projectilesGroup.remove(node);
      node.geometry.dispose();
      projNodes.delete(id);
    }
  }
}

function syncEffects(state) {
  const seen = new Set();
  for (const ef of state.effects) {
    seen.add(ef.id);
    let node = effectNodes.get(ef.id);
    const fade = Math.max(0, ef.ttlMs / (ef.totalTtlMs || ef.ttlMs || 1));
    if (!node) {
      if (ef.kind === 'splash') {
        const geo = new THREE.RingGeometry((ef.r || 1) * 0.8, (ef.r || 1), 24);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({ color: TOKENS.ACCENT_EMBER, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        node = new THREE.Mesh(geo, mat);
      } else {
        // Default: tiny pulsing point as a stand-in (e.g., goldPopup)
        const geo = new THREE.SphereGeometry(0.18, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: TOKENS.ACCENT_GOLD, transparent: true });
        node = new THREE.Mesh(geo, mat);
      }
      effectNodes.set(ef.id, node);
      effectsGroup.add(node);
    }
    node.position.set(ef.x, (ef.kind === 'goldPopup' ? 0.5 + (1 - fade) * 1.5 : 0.1), ef.z);
    if (node.material) node.material.opacity = fade;
  }
  for (const [id, node] of effectNodes) {
    if (!seen.has(id)) {
      effectsGroup.remove(node);
      if (node.geometry) node.geometry.dispose();
      effectNodes.delete(id);
    }
  }
}

// ─── Persistent Warden aura rings (ADR-030 §12) ──────────────
// Built once per aura-behavior tower; pulsed in place each frame.
function syncWardenAuras(state) {
  const present = new Set();
  for (const tw of state.towers) {
    if (tw.behavior !== 'aura' || !(tw.auraRadius > 0)) continue;
    present.add(tw.id);
    let node = wardenAuraNodes.get(tw.id);
    if (!node) {
      // Group containing a thick outer ring + a faint inner disc so the
      // slow-area coverage reads at-a-glance against varied ground tiles.
      node = new THREE.Group();
      const ringGeo = new THREE.RingGeometry(tw.auraRadius * 0.88, tw.auraRadius, 48);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({
        color: WARDEN_AURA_COLOR,
        transparent: true,
        opacity: WARDEN_AURA_OPACITY_BASE,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const fillGeo = new THREE.CircleGeometry(tw.auraRadius * 0.88, 48);
      fillGeo.rotateX(-Math.PI / 2);
      const fillMat = new THREE.MeshBasicMaterial({
        color: WARDEN_AURA_COLOR,
        transparent: true,
        opacity: WARDEN_AURA_FILL_OPACITY_BASE,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const fill = new THREE.Mesh(fillGeo, fillMat);
      node.add(ring);
      node.add(fill);
      node.position.set(tw.x, GROUND_DECAL_Y, tw.z);
      node.userData.t0 = performance.now();
      node.userData.ring = ring;
      node.userData.fill = fill;
      node.userData.radius = tw.auraRadius;
      wardenAuraNodes.set(tw.id, node);
      wardenAurasGroup.add(node);
    } else if (node.userData.radius !== tw.auraRadius) {
      // An upgrade keeps the same tower id but widens auraRadius, and the
      // geometry above is built ONLY on first sight — so a T3 Warden used to
      // draw its T1 ring (6.0 against a real 8.0: a quarter short in radius,
      // nearly half in area). Harmless while the aura was buried; the moment
      // it renders it becomes an affordance that lies about coverage.
      node.userData.ring.geometry.dispose();
      node.userData.fill.geometry.dispose();
      const ringGeo = new THREE.RingGeometry(tw.auraRadius * 0.88, tw.auraRadius, 48);
      ringGeo.rotateX(-Math.PI / 2);
      const fillGeo = new THREE.CircleGeometry(tw.auraRadius * 0.88, 48);
      fillGeo.rotateX(-Math.PI / 2);
      node.userData.ring.geometry = ringGeo;
      node.userData.fill.geometry = fillGeo;
      node.userData.radius = tw.auraRadius;
    }
    if (window.CTD3Ui.motionAllowed()) {
      const elapsed = performance.now() - node.userData.t0;
      const phase = Math.sin(elapsed / WARDEN_AURA_PERIOD_MS);
      node.scale.setScalar((1 - WARDEN_AURA_SCALE_AMP) + phase * WARDEN_AURA_SCALE_AMP);
      node.userData.ring.material.opacity = WARDEN_AURA_OPACITY_BASE + phase * WARDEN_AURA_OPACITY_AMP;
      node.userData.fill.material.opacity = WARDEN_AURA_FILL_OPACITY_BASE + phase * WARDEN_AURA_FILL_OPACITY_AMP;
    } else {
      node.scale.setScalar(1);
      node.userData.ring.material.opacity = WARDEN_AURA_OPACITY_BASE;
      node.userData.fill.material.opacity = WARDEN_AURA_FILL_OPACITY_BASE;
    }
  }
  // Remove rings for towers that were sold (node is now a Group containing
  // ring + fill children — dispose both).
  for (const [id, node] of wardenAuraNodes) {
    if (present.has(id)) continue;
    wardenAurasGroup.remove(node);
    node.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    wardenAuraNodes.delete(id);
  }
}

// ─── Range/aura decals (transient — rebuilt each frame) ──────
// Warden aura rings live in wardenAurasGroup (persistent), NOT here.
function syncDecals(state) {
  // Transient decals allocate a fresh RingGeometry/CircleGeometry AND a fresh
  // MeshBasicMaterial every frame (makeRing/makeDisc). Group.clear() detaches
  // children but never frees their GPU buffers, so dispose them here first —
  // otherwise renderer.info.memory.geometries climbs ~3 per rendered frame,
  // unbounded, and only dispose() decrements it (ADR-037 sprint-6 H-1). Same
  // dispose shape as the Warden-aura registry in clearPlayfield/syncWardenAuras.
  for (const o of decalsGroup.children) {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  }
  decalsGroup.clear();
  // Selected tower → range circle
  const sel = state.selectedTowerId && state.towers.find(t => t.id === state.selectedTowerId);
  if (sel && sel.behavior === 'projectile' && sel.range > 0) {
    decalsGroup.add(makeRing(sel.x, sel.z, sel.range, TOKENS.ACCENT_GOLD, 0.4, GROUND_DECAL_Y));
  }
  // Empty buildable slots get TWO affordances:
  //   - Always-on: subtle aged-gold ring outline (visible without selection).
  //   - On palette-select: bright green pulsing disc on top (unmissable).
  if (state.mapDef && state.mapDef.buildSlots) {
    const t = performance.now() / 1000;
    const pulse = 0.6 + Math.sin(t * 3) * 0.2;   // 0.40 – 0.80 opacity
    for (const slot of state.mapDef.buildSlots) {
      const occupied = state.towers.some(tw => tw.slotId === slot.id);
      if (occupied) continue;
      // Always-on aged-gold ring around the slab — affordance without palette.
      // Slab is 0.95×0.22×0.95 centered at y=0.11; ring sits just above the top.
      decalsGroup.add(makeRing(slot.x, slot.z, 0.62, TOKENS.ACCENT_GOLD, 0.85, GROUND_DECAL_Y));
      if (state.paletteSelection) {
        // Bright vivid-green pulsing disc when palette tower is selected
        decalsGroup.add(makeDisc(slot.x, slot.z, 1.1, TOKENS.ACCENT_GLOW, pulse, 0.25));
      }
    }
  }
  // Hovered slot + palette selection → placement preview range circle
  if (state.paletteSelection && state.hoverSlotId) {
    const slot = state.mapDef.buildSlots.find(s => s.id === state.hoverSlotId);
    const occupied = state.towers.some(t => t.slotId === state.hoverSlotId);
    if (slot && !occupied) {
      const def = window.CTD3Entities.TOWERS[state.paletteSelection];
      const tier0 = def.tiers[0];
      const r = def.behavior === 'aura' ? tier0.auraRadius : tier0.range;
      const color = def.behavior === 'aura' ? TOKENS.WARDEN_AURA : TOKENS.ACCENT_EMBER;
      decalsGroup.add(makeRing(slot.x, slot.z, r, color, 0.4, GROUND_DECAL_Y));
    }
  }
}

function makeRing(x, z, radius, color, opacity, y) {
  const geo = new THREE.RingGeometry(radius * 0.97, radius, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y != null ? y : GROUND_DECAL_Y, z);
  return m;
}

// Filled disc decal (used for the green "place here" highlight under slots).
function makeDisc(x, z, radius, color, opacity, y) {
  const geo = new THREE.CircleGeometry(radius, 32);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y != null ? y : GROUND_DECAL_Y, z);
  return m;
}

// ─── Raycast hit-test (called by input.js) ───────────────────
// nx, nz are normalized device coords in [-1, +1].
function raycastFromNormalizedPointer(nx, ny) {
  const cam = window.CTD3Renderer.getCamera();
  if (!cam) return null;
  raycaster.setFromCamera({ x: nx, y: ny }, cam);
  // Test slot colliders first (they're the most "actionable")
  const slotHits = raycaster.intersectObjects(slotsGroup.children, false);
  for (const h of slotHits) {
    if (h.object.userData.kind === 'slot') {
      return { kind: 'slot', id: h.object.userData.id, point: h.point };
    }
  }
  // Then towers (top-level group; allow recurse)
  const towerHits = raycaster.intersectObjects(towersGroup.children, true);
  if (towerHits.length) {
    // Walk up to find the tower group with a userData.towerId
    let obj = towerHits[0].object;
    while (obj && !obj.userData.towerId) obj = obj.parent;
    if (obj) return { kind: 'tower', id: obj.userData.towerId, point: towerHits[0].point };
  }
  // Fall back to ground plane
  raycaster.ray.intersectPlane(groundPlane, tmpHit);
  return { kind: 'empty', point: { x: tmpHit.x, y: 0, z: tmpHit.z } };
}

function setLowPowerShadows(on) {
  // When on, disable shadow casting; add blob decals under entities later.
  // (Phase-2 stub.)
  scene.traverse(o => {
    if (o.isMesh) {
      if (on) o.castShadow = false;
    }
  });
  // Skinned-enemy mixers are the other per-frame cost low power exists to shed
  // (ADR-039 D27). Release the live ones the moment the renderer trips, so the
  // saving lands on the wave that triggered it rather than only on the next one.
  // mixersAllowed() independently stops new spawns from getting one while low
  // power holds; enemies already in flight finish frozen mid-stride.
  if (on) releaseAllEnemyMixers();
}

// ─── ?test=roster visual gate (ADR-039) ─────────────────────
// Renders the whole enemy roster side by side, labelled, animated, isolated from
// gameplay. Same pattern as ?test=tile-debug below: turn "did the swap look
// right?" from a screenshot somebody has to remember to take into a repeatable
// check. Deliberately bypasses low power AND reduced motion, so a contended
// machine cannot fake a pass by silently disabling the very clips under review.
//   /games/castle-tower-defense/?test=roster
//
// SCOPE — read this before citing the screen as evidence. It answers four
// questions and NO others:
//   1. did each model load             (a failure is a magenta box, unmissable)
//   2. is its configured clip playing  (static vs moving; clip name is labelled)
//   3. is the skeleton bound right     (the strongest thing here — a detached or
//      wrong-scale limb is obvious at 3x; this is what caught the boneInverses
//      collision that mis-scaled the footman's weapon and the slime's body)
//   4. relative scale hierarchy        (magnify is uniform, so ordering holds;
//      the numeric ENEMY_VIS.scale is printed per model)
//
// What it CANNOT answer, because of what it does to the frame — it clears
// pathGroup/decorationsGroup/towersGroup and magnifies 3x:
//   - COHERENCE WITH THE KENNEY KIT. Every Kenney asset has just been removed
//     from the frame. ADR-039 defers this to "the visual gate"; this screen is
//     not it. Judge it in a live match, against path tiles and towers.
//   - READABILITY AT GAMEPLAY DISTANCE, and figure-ground against the dark-green
//     field and its WFC-filled decoration. 3x scale on an emptied field is the
//     opposite of the condition being tested. Also a live-match judgement.
//   - ABSOLUTE scale against the playfield, and yOffset grounding: every model
//     floats a uniform 0.2 with no reference line, and the two flying types are
//     drawn grounded rather than at their in-game baseY of 1.2. yOffset is the
//     one ENEMY_VIS field no harness check covers.
const rosterDebugMixers = [];
const ROSTER_DEBUG_MAGNIFY = 3.0;   // display-only; ENEMY_VIS.scale is unchanged
// 2.7 not 3.0: at 10 types a 3.0 pitch spans 27 world units, which needs a
// viewport aspect >= ~0.9 to fit an orthographic 45-degree-yaw frustum. Portrait
// or half-width windows silently clipped the end types with nothing to indicate
// anything was missing.
// Lowered 2.7 -> 2.45 when ADR-040's drake made this an ELEVEN-type sheet:
// 10 gaps x 2.7 is 27.0 world units, which is exactly the span the 3.0 pitch
// was reduced to escape, and the newly added type is the one at the clipped
// edge. 2.45 restores the previous headroom (24.5). If a twelfth type lands,
// derive the pitch from types.length rather than nudging this again.
const ROSTER_DEBUG_PITCH = 2.45;

function paintRosterDebug() {
  if (!scene) return;
  pathGroup.clear();
  decorationsGroup.clear();
  slotsGroup.clear();
  towersGroup.clear();
  // Reuse the real teardown so repainting cannot leak — this repaints on a timer
  // while background asset fetches land.
  for (const n of enemiesGroup.children.slice()) {
    disposeEnemyNode(n);
    enemiesGroup.remove(n);
  }
  enemyNodes.clear();
  rosterDebugMixers.length = 0;

  const types = Object.keys(ENEMY_VIS);
  const span = (types.length - 1) * ROSTER_DEBUG_PITCH;
  types.forEach((type, i) => {
    const vis = ENEMY_VIS[type];
    const node = window.CTD3Assets.getMesh(vis.model);
    node.scale.setScalar(vis.scale * ROSTER_DEBUG_MAGNIFY);
    const x = -span / 2 + i * ROSTER_DEBUG_PITCH;
    node.position.set(x, 0.2 + vis.yOffset * ROSTER_DEBUG_MAGNIFY, 0);
    node.rotation.y = Math.PI * 0.15;   // three-quarter view reads silhouette best
    node.traverse(o => { if (o.isMesh) o.castShadow = true; });

    let clipName = '(none)';
    const clips = window.CTD3Assets.getClips(vis.model);
    if (clips && clips.length) {
      // Mirror syncEnemies' fallback EXACTLY: never blindly clips[0], which is
      // `Death` in every model of this roster. A gate that loops a death
      // animation while the game plays something else is worse than no gate —
      // it would sign off on the divergence.
      let clip = THREE.AnimationClip.findByName(clips, vis.moveClip);
      if (!clip) {
        clip = clips.find(c => !/death/i.test(c.name)) || clips[0];
        console.warn('[scene] roster gate:', type, 'moveClip', JSON.stringify(vis.moveClip),
                     'not found in', vis.model, '— using', clip && clip.name);
      }
      if (clip) {
        clipName = clip.name;
        const mixer = new THREE.AnimationMixer(node);
        const action = mixer.clipAction(clip);
        action.timeScale = vis.animSpeed || 1;
        action.time = (i / types.length) * clip.duration;   // deterministic stagger
        action.play();
        node.userData.mixer = mixer;
        rosterDebugMixers.push(mixer);
      }
    }
    // Register in enemyNodes too, so clearPlayfield — the second of the two
    // teardown sites ADR-039 D27 mandates — can actually reach these nodes. It
    // iterates the REGISTRY, not the group, so a group-only node would survive
    // a map start forever: ten magnified monsters parked across the playfield
    // with no code path able to dispose them. Unreachable while ?test=roster is
    // a UI dead end; one line to keep the D27 invariant true regardless.
    enemyNodes.set('roster:' + type, node);
    enemiesGroup.add(node);

    // Two rows so neither overflows makeLabelTexture's 256px canvas at 28px
    // monospace (~17 chars). The clip name is on the sheet deliberately: without
    // it, "wrong clip playing" is the one failure this screen cannot show.
    [type, clipName + ' ' + vis.scale].forEach((text, row) => {
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 0.5),
        new THREE.MeshBasicMaterial({ map: makeLabelTexture(text), transparent: true, depthWrite: false })
      );
      label.position.set(x, 0.3, 2.4 + row * 0.6);
      label.rotation.x = -Math.PI / 2;
      pathGroup.add(label);
    });
  });
}

// Advance the roster sheet's clips. Driven from game.js's always-on tick block,
// because sync() runs only while a match is in play and this screen has no state.
function tickRosterDebug(dtMs) {
  if (!rosterDebugMixers.length) return;
  const dtSec = (typeof dtMs === 'number' && dtMs > 0 ? Math.min(dtMs, 250) : 16.7) / 1000;
  for (const m of rosterDebugMixers) m.update(dtSec);
}

// ─── ?test=tile-debug visual gate (ADR-030 §21 R1 mitigation) ───
// Renders one of each path tile at the 4 cardinal rotations near the
// origin with a text label showing rotation in units of π. Verifies
// empirically that Kenney's GLB front-axis convention matches
// CTD3TileGrid's rotation lookup table. Run via:
//   /games/castle-tower-defense/?test=tile-debug
// The grid expected:
//   row z=2  : tile_path_straight @ 0, π/2, π, 3π/2
//   row z=0  : tile_path_corner_round @ 0, π/2, π, 3π/2
//   row z=-2 : tile_path_end_round @ 0, π/2, π, 3π/2
// Visual confirmation closes R1.
function paintTileDebug() {
  if (!scene) return;
  // Hide the green ground; surface gets crowded otherwise.
  if (ground) ground.visible = true;
  pathGroup.clear();
  decorationsGroup.clear();
  slotsGroup.clear();
  towersGroup.clear();
  enemiesGroup.clear();

  const ROTATIONS = [
    { r: 0,                 label: '0' },
    { r: Math.PI / 2,       label: 'π/2' },
    { r: Math.PI,           label: 'π' },
    { r: -Math.PI / 2,      label: '-π/2' }
  ];
  const ROWS = [
    { z:  2, tileId: 'tile_path_straight',     name: 'straight' },
    { z:  0, tileId: 'tile_path_corner_round', name: 'corner_round' },
    { z: -2, tileId: 'tile_path_end_round',    name: 'end_round' }
  ];

  for (const row of ROWS) {
    for (let i = 0; i < ROTATIONS.length; i++) {
      const x = -3 + i * 2;  // columns at x = -3, -1, 1, 3
      const mesh = window.CTD3Assets.getMesh(row.tileId);
      mesh.position.set(x, 0.01, row.z);
      mesh.rotation.y = ROTATIONS[i].r;
      pathGroup.add(mesh);
      // Label: a small canvas-texture plane above the tile.
      const tex = makeLabelTexture(row.name.split('_')[0] + ' ' + ROTATIONS[i].label);
      const labelGeo = new THREE.PlaneGeometry(1.4, 0.4);
      const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      const label = new THREE.Mesh(labelGeo, labelMat);
      label.position.set(x, 0.6, row.z + 0.7);
      label.rotation.x = -Math.PI / 2;
      pathGroup.add(label);
    }
  }
  // Origin reference cube (so "front of +x" is unambiguous).
  const oGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const oMat = new THREE.MeshBasicMaterial({ color: TOKENS.TERRACOTTA });
  const o = new THREE.Mesh(oGeo, oMat);
  o.position.set(0, 0.5, 5);
  pathGroup.add(o);
  // Arrow ahead of origin marker pointing +x — the kit's default front for straight tiles.
  const aGeo = new THREE.ConeGeometry(0.2, 0.6, 4);
  aGeo.rotateZ(-Math.PI / 2);
  const aMat = new THREE.MeshBasicMaterial({ color: TOKENS.ACCENT_GOLD });
  const arrow = new THREE.Mesh(aGeo, aMat);
  arrow.position.set(0.6, 0.5, 5);
  pathGroup.add(arrow);
}

function makeLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const cx = canvas.getContext('2d');
  cx.fillStyle = 'rgba(13,20,16,0.88)';
  cx.fillRect(0, 0, canvas.width, canvas.height);
  cx.fillStyle = '#e8b75a';
  cx.font = 'bold 28px monospace';
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

window.CTD3Scene = {
  init, getScene,
  paintTerrain, clearPlayfield,
  sync, raycastFromNormalizedPointer,
  flashTower,
  paintTileDebug,
  paintRosterDebug, tickRosterDebug,
  setLowPowerShadows,
  tickFireflies
};
