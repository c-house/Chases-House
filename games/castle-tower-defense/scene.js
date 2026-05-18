/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — scene.js
   Scene-graph owner. State → mesh-transform diff. InstancedMesh
   pools for repeated meshes. Range decals + Warden aura rings.
   Depends on three + assets ONLY (per ADR-028 §7 M-7).
   Exposes window.CTD3Scene.
   ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

// ─── Animation constants (ADR-030 Appendix A) ───────────────
const MUZZLE_FLASH_MS = 80;
const MUZZLE_FLASH_EMISSIVE_HEX = 0xc8943e;
const MUZZLE_FLASH_INTENSITY = 0.6;
const WARDEN_AURA_PERIOD_MS = 800;
const WARDEN_AURA_SCALE_AMP = 0.05;
const WARDEN_AURA_OPACITY_BASE = 0.5;
const WARDEN_AURA_OPACITY_AMP = 0.15;
const ENEMY_BOB_RATE_GROUND = 4;
const ENEMY_BOB_RATE_FLYING = 1.6;
const ENEMY_BOB_AMP_GROUND = 0.05;
const ENEMY_BOB_AMP_FLYING = 0.18;

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
  scene.background = new THREE.Color(0x0a0a0b);

  // Ground plane (large, flat).
  const groundGeo = new THREE.PlaneGeometry(60, 40);
  groundGeo.rotateX(-Math.PI / 2);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x6a8447, roughness: 0.85 });
  ground = new THREE.Mesh(groundGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

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

  // 5. Castle — kit mesh.
  castleMesh = window.CTD3Assets.getMesh('castle');
  castleMesh.position.set(map.castle.x, 0, map.castle.z);
  castleMesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(castleMesh);

  // 6. Slot stone slabs + invisible collider planes for raycast (ADR-028 §13).
  // A flat, low stone slab (0.9 × 0.12 × 0.9) that doesn't compete on z-height
  // with WFC terrain features. Cool grey-stone color (#a8a39c) reads
  // distinctly against grass-green; slight darker rim suggests an inset.
  // Empty buildable slots glow green when the user has a tower selected
  // — handled separately in syncDecals so the highlight is reactive.
  for (const slot of map.buildSlots) {
    // Slab — flat stone tile, ground-aware.
    const slabGeo = new THREE.BoxGeometry(0.9, 0.12, 0.9);
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0xa8a39c, roughness: 0.92, metalness: 0.0
    });
    const slab = new THREE.Mesh(slabGeo, slabMat);
    slab.position.set(slot.x, 0.06, slot.z);
    slab.castShadow = true;
    slab.receiveShadow = true;
    slot._slabRef = slab;  // for hover/selection state if scene wants to tint
    slotsGroup.add(slab);
    // Rim — slightly lower + wider darker stone block underneath so the slab
    // appears mortared / inset rather than floating.
    const rimGeo = new THREE.BoxGeometry(1.04, 0.04, 1.04);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x7a7670, roughness: 0.95
    });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.set(slot.x, 0.02, slot.z);
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
  enemyNodes.forEach(n => enemiesGroup.remove(n));
  projNodes.forEach(n => projectilesGroup.remove(n));
  effectNodes.forEach(n => effectsGroup.remove(n));
  towerNodes.clear();
  enemyNodes.clear();
  projNodes.clear();
  effectNodes.clear();
  decalsGroup.clear();
  // Persistent Warden aura registry (ADR-030 §12, CRIT-2)
  wardenAuraNodes.forEach((node) => {
    wardenAurasGroup.remove(node);
    if (node.geometry) node.geometry.dispose();
    if (node.material) node.material.dispose();
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
function sync(state) {
  syncTowers(state);
  syncEnemies(state);
  syncProjectiles(state);
  syncEffects(state);
  syncWardenAuras(state);
  syncDecals(state);
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

function syncEnemies(state) {
  const seen = new Set();
  const t = performance.now() / 1000;
  const map = state.mapDef;
  for (const en of state.enemies) {
    seen.add(en.id);
    let node = enemyNodes.get(en.id);
    if (!node) {
      const meshId = `enemy_${en.type}`;
      node = window.CTD3Assets.getMesh(meshId);
      node.traverse(o => { if (o.isMesh) o.castShadow = true; });
      // Per-enemy random bob offset (presentation only — never on engine entity, ADR-030 C-1).
      node.userData.bobPhase = Math.random() * Math.PI * 2;
      enemyNodes.set(en.id, node);
      enemiesGroup.add(node);
    }
    const def = window.CTD3Entities.ENEMIES[en.type];
    const isFlying = !!def?.isFlying;
    const baseY = isFlying ? 1.2 : 0;
    let bob;
    if (!window.CTD3Ui.motionAllowed()) {
      bob = 0;
    } else if (isFlying) {
      bob = Math.sin(t * ENEMY_BOB_RATE_FLYING + node.userData.bobPhase) * ENEMY_BOB_AMP_FLYING;
    } else {
      bob = Math.abs(Math.sin(t * ENEMY_BOB_RATE_GROUND + node.userData.bobPhase)) * ENEMY_BOB_AMP_GROUND;
    }
    node.position.set(en.x, baseY + bob, en.z);
    // Yaw toward direction of travel (lookahead along path)
    if (map && map.totalLength > 0) {
      const lookT = Math.min(1, en.pathT + 0.005);
      const next = window.CTD3Engine.sampleOnPath(map, lookT);
      const dx = next.x - en.x, dz = next.z - en.z;
      if (dx !== 0 || dz !== 0) {
        node.rotation.y = Math.atan2(dz, dx) + Math.PI;
      }
    }
    // Hit-flash via scale pulse (preserves existing visual feedback).
    node.scale.setScalar(en.hitFlashMs > 0 ? 1.1 : 1.0);
  }
  for (const [id, node] of enemyNodes) {
    if (!seen.has(id)) {
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
      const color = pr.kind === 'cannonball' ? 0x1a1410
                  : pr.kind === 'magebolt'   ? 0xc8943e
                  : 0xe8d5a8;
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
        const mat = new THREE.MeshBasicMaterial({ color: 0xa06828, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        node = new THREE.Mesh(geo, mat);
      } else {
        // Default: tiny pulsing point as a stand-in (e.g., goldPopup)
        const geo = new THREE.SphereGeometry(0.18, 6, 6);
        const mat = new THREE.MeshBasicMaterial({ color: 0xc8943e, transparent: true });
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
      const geo = new THREE.RingGeometry(tw.auraRadius * 0.97, tw.auraRadius, 48);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x9bb0d4,
        transparent: true,
        opacity: WARDEN_AURA_OPACITY_BASE,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      node = new THREE.Mesh(geo, mat);
      node.position.set(tw.x, 0.05, tw.z);
      node.userData.t0 = performance.now();
      wardenAuraNodes.set(tw.id, node);
      wardenAurasGroup.add(node);
    }
    if (window.CTD3Ui.motionAllowed()) {
      const elapsed = performance.now() - node.userData.t0;
      const phase = Math.sin(elapsed / WARDEN_AURA_PERIOD_MS);
      node.scale.setScalar((1 - WARDEN_AURA_SCALE_AMP) + phase * WARDEN_AURA_SCALE_AMP);
      node.material.opacity = WARDEN_AURA_OPACITY_BASE * ((1 - WARDEN_AURA_OPACITY_AMP) + phase * WARDEN_AURA_OPACITY_AMP);
    } else {
      node.scale.setScalar(1);
      node.material.opacity = WARDEN_AURA_OPACITY_BASE;
    }
  }
  // Remove rings for towers that were sold
  for (const [id, node] of wardenAuraNodes) {
    if (present.has(id)) continue;
    wardenAurasGroup.remove(node);
    if (node.geometry) node.geometry.dispose();
    if (node.material) node.material.dispose();
    wardenAuraNodes.delete(id);
  }
}

// ─── Range/aura decals (transient — rebuilt each frame) ──────
// Warden aura rings live in wardenAurasGroup (persistent), NOT here.
function syncDecals(state) {
  decalsGroup.clear();
  // Selected tower → range circle
  const sel = state.selectedTowerId && state.towers.find(t => t.id === state.selectedTowerId);
  if (sel && sel.behavior === 'projectile' && sel.range > 0) {
    decalsGroup.add(makeRing(sel.x, sel.z, sel.range, 0xc8943e, 0.4));
  }
  // When the user has a tower type chosen, every empty slot pulses a soft
  // green disc beneath it so the "build here" affordance is unmissable.
  // The currently-hovered slot adds a brighter range-circle preview on top.
  if (state.paletteSelection && state.mapDef && state.mapDef.buildSlots) {
    const t = performance.now() / 1000;
    const pulse = 0.55 + Math.sin(t * 3) * 0.15;   // 0.40 – 0.70 opacity
    for (const slot of state.mapDef.buildSlots) {
      const occupied = state.towers.some(tw => tw.slotId === slot.id);
      if (occupied) continue;
      decalsGroup.add(makeDisc(slot.x, slot.z, 0.7, 0x5aa84a, pulse));
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
      const color = def.behavior === 'aura' ? 0x9bb0d4 : 0xa06828;
      decalsGroup.add(makeRing(slot.x, slot.z, r, color, 0.4));
    }
  }
}

function makeRing(x, z, radius, color, opacity) {
  const geo = new THREE.RingGeometry(radius * 0.97, radius, 48);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, 0.05, z);
  return m;
}

// Filled disc decal (used for the green "place here" highlight under slots).
function makeDisc(x, z, radius, color, opacity) {
  const geo = new THREE.CircleGeometry(radius, 32);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, 0.07, z);  // just above the rim block (0.04 thick @ y=0.02)
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
  const oMat = new THREE.MeshBasicMaterial({ color: 0xff0066 });
  const o = new THREE.Mesh(oGeo, oMat);
  o.position.set(0, 0.5, 5);
  pathGroup.add(o);
  // Arrow ahead of origin marker pointing +x — the kit's default front for straight tiles.
  const aGeo = new THREE.ConeGeometry(0.2, 0.6, 4);
  aGeo.rotateZ(-Math.PI / 2);
  const aMat = new THREE.MeshBasicMaterial({ color: 0xc8943e });
  const arrow = new THREE.Mesh(aGeo, aMat);
  arrow.position.set(0.6, 0.5, 5);
  pathGroup.add(arrow);
}

function makeLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const cx = canvas.getContext('2d');
  cx.fillStyle = 'rgba(20,15,10,0.85)';
  cx.fillRect(0, 0, canvas.width, canvas.height);
  cx.fillStyle = '#c8943e';
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
  setLowPowerShadows
};
