/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — scene.js
   Scene-graph owner. State → mesh-transform diff. InstancedMesh
   pools for repeated meshes. Range decals + Warden aura rings.
   Depends on three + assets ONLY (per ADR-028 §7 M-7).
   Exposes window.CTD3Scene.
   ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

let scene = null;
let ground = null;
let pathMesh = null;
let castleMesh = null;
let slotsGroup = null;
let towersGroup = null;
let enemiesGroup = null;
let projectilesGroup = null;
let effectsGroup = null;
let decalsGroup = null;

// Registries: id → THREE.Object3D
const towerNodes = new Map();
const enemyNodes = new Map();
const projNodes  = new Map();
const effectNodes = new Map();

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
  slotsGroup       = new THREE.Group(); scene.add(slotsGroup);
  towersGroup      = new THREE.Group(); scene.add(towersGroup);
  enemiesGroup     = new THREE.Group(); scene.add(enemiesGroup);
  projectilesGroup = new THREE.Group(); scene.add(projectilesGroup);
  effectsGroup     = new THREE.Group(); scene.add(effectsGroup);
  decalsGroup      = new THREE.Group(); scene.add(decalsGroup);
}

function getScene() { return scene; }

// ─── paintTerrain: one-time per map ──────────────────────────
function paintTerrain(map) {
  // Clear previous map's terrain pieces
  if (pathMesh) { scene.remove(pathMesh); pathMesh.geometry.dispose(); pathMesh = null; }
  if (castleMesh) { scene.remove(castleMesh); castleMesh = null; }
  slotsGroup.clear();

  // Path as a wide flat ribbon (uses LineSegments along the polyline,
  // extruded as planes). Replaceable by GLB tiles once kit is available.
  const points = map.path.map(p => new THREE.Vector3(p.x, 0.01, p.z));
  const pathGeo = makeRibbonGeometry(points, 1.4);
  const pathMat = new THREE.MeshStandardMaterial({ color: 0x7a5a30, roughness: 0.95 });
  pathMesh = new THREE.Mesh(pathGeo, pathMat);
  pathMesh.receiveShadow = true;
  scene.add(pathMesh);

  // Castle — kit mesh (castle.glb = wood-structure-high.glb from kit)
  castleMesh = window.CTD3Assets.getMesh('castle');
  castleMesh.position.set(map.castle.x, 0, map.castle.z);
  castleMesh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(castleMesh);

  // Slot plinths + invisible 80×80 collider planes for raycast (ADR-028 §13)
  for (const slot of map.buildSlots) {
    const plinthGeo = new THREE.BoxGeometry(1.2, 0.2, 1.2);
    const plinthMat = new THREE.MeshStandardMaterial({ color: 0x9b9080, roughness: 0.85 });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.set(slot.x, 0.1, slot.z);
    plinth.receiveShadow = true;
    slotsGroup.add(plinth);
    // Invisible collider plane for tap targets (~2.5 world units = generous)
    const colGeo = new THREE.PlaneGeometry(2.5, 2.5);
    colGeo.rotateX(-Math.PI / 2);
    const colMat = new THREE.MeshBasicMaterial({ visible: false });
    const collider = new THREE.Mesh(colGeo, colMat);
    collider.position.set(slot.x, 0.5, slot.z);
    collider.userData = { kind: 'slot', id: slot.id };
    slotsGroup.add(collider);
  }
}

function makeRibbonGeometry(points, width) {
  // Build a triangle strip ribbon along the polyline.
  const half = width / 2;
  const positions = [];
  const indices = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    let tx = 0, tz = 0;
    if (i === 0) {
      const n = points[1];
      tx = n.x - p.x; tz = n.z - p.z;
    } else if (i === points.length - 1) {
      const pr = points[i - 1];
      tx = p.x - pr.x; tz = p.z - pr.z;
    } else {
      const pr = points[i - 1], n = points[i + 1];
      tx = n.x - pr.x; tz = n.z - pr.z;
    }
    const len = Math.hypot(tx, tz) || 1;
    // perpendicular (rotated 90° in xz)
    const px = -tz / len, pz = tx / len;
    positions.push(p.x + px * half, p.y, p.z + pz * half);
    positions.push(p.x - px * half, p.y, p.z - pz * half);
  }
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
    indices.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
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
}

// ─── Entity sync (state diff → mesh transforms) ──────────────
function sync(state) {
  syncTowers(state);
  syncEnemies(state);
  syncProjectiles(state);
  syncEffects(state);
  syncDecals(state);
}

function syncTowers(state) {
  const seen = new Set();
  for (const tw of state.towers) {
    seen.add(tw.id);
    let node = towerNodes.get(tw.id);
    if (!node) {
      const meshId = `tower_${tw.type}_t${tw.tier + 1}`;
      node = window.CTD3Assets.getMesh(meshId);
      node.position.set(tw.x, 0, tw.z);
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
        fresh.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        towerNodes.set(tw.id, fresh);
        towersGroup.add(fresh);
      }
    }
  }
  // Remove vanished
  for (const [id, node] of towerNodes) {
    if (!seen.has(id)) {
      towersGroup.remove(node);
      towerNodes.delete(id);
    }
  }
}

function syncEnemies(state) {
  const seen = new Set();
  for (const en of state.enemies) {
    seen.add(en.id);
    let node = enemyNodes.get(en.id);
    if (!node) {
      const meshId = `enemy_${en.type}`;
      node = window.CTD3Assets.getMesh(meshId);
      node.traverse(o => { if (o.isMesh) o.castShadow = true; });
      enemyNodes.set(en.id, node);
      enemiesGroup.add(node);
    }
    const yLift = (window.CTD3Entities.ENEMIES[en.type]?.isFlying) ? 1.2 : 0;
    node.position.set(en.x, yLift, en.z);
    // Hit-flash via vertex color tint (or scale pulse for placeholders)
    if (en.hitFlashMs > 0) {
      node.scale.setScalar(1.1);
    } else {
      node.scale.setScalar(1.0);
    }
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

// ─── Range/aura decals ───────────────────────────────────────
function syncDecals(state) {
  decalsGroup.clear();
  // Always-visible Warden aura rings
  for (const tw of state.towers) {
    if (tw.behavior === 'aura' && tw.auraRadius > 0) {
      decalsGroup.add(makeRing(tw.x, tw.z, tw.auraRadius, 0x9bb0d4, 0.5));
    }
  }
  // Selected tower → range circle
  const sel = state.selectedTowerId && state.towers.find(t => t.id === state.selectedTowerId);
  if (sel && sel.behavior === 'projectile' && sel.range > 0) {
    decalsGroup.add(makeRing(sel.x, sel.z, sel.range, 0xc8943e, 0.4));
  }
  // Hovered slot + palette selection → placement preview range
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

window.CTD3Scene = {
  init, getScene,
  paintTerrain, clearPlayfield,
  sync, raycastFromNormalizedPointer,
  setLowPowerShadows
};
