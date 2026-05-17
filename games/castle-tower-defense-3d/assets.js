/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — assets.js
   GLTFLoader cache, instance pools, icon URLs, shared material.
   Single owner of all third-party asset loading. ADR-028 §4, §10.
   Exposes window.CTD3Assets.
   ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const MANIFEST_URL = 'assets/MANIFEST.json';
const ICON_DIR     = 'assets/icons/';
const MODEL_DIR    = 'assets/';

const loader = new GLTFLoader();
const cache  = new Map();        // id → THREE.Group (parsed scene)
const failed = new Set();        // ids that failed to load (silenced after first warn)
const readyCallbacks = [];

let manifest = null;             // [{id, role, kind, path, variantTag}]
let materialAtlas = null;        // shared MeshStandardMaterial
let critReady = false;           // true after critical-path preload completed
let manifestPromise = null;

// ─── Manifest loading ────────────────────────────────────────
async function loadManifest() {
  if (manifest) return manifest;
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL)
    .then(r => r.ok ? r.json() : Promise.reject(new Error('manifest http ' + r.status)))
    .then(data => { manifest = data; return data; })
    .catch(err => {
      console.warn('[assets] manifest unavailable — running in stub mode', err);
      manifest = [];
      return manifest;
    });
  return manifestPromise;
}

// ─── Material atlas (shared MeshStandardMaterial) ────────────
function makeFallbackMaterial() {
  // Vertex-colored material so the per-instance setColorAt path works
  // even without a texture atlas.
  return new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.7,
    metalness: 0.05
  });
}
function getMaterialAtlas() {
  if (!materialAtlas) materialAtlas = makeFallbackMaterial();
  return materialAtlas;
}

// ─── Mesh loading ────────────────────────────────────────────
function loadOne(id, path) {
  return new Promise((resolve) => {
    loader.load(
      MODEL_DIR + path,
      (gltf) => {
        cache.set(id, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      (err) => {
        if (!failed.has(id)) {
          console.warn('[assets] failed to load', id, '@', path, err && err.message);
          failed.add(id);
        }
        // Resolve with a placeholder so callers don't crash.
        const ph = makePlaceholderMesh();
        cache.set(id, ph);
        resolve(ph);
      }
    );
  });
}

// Magenta cube — visually obvious "missing asset" indicator.
function makePlaceholderMesh() {
  const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff00ff });
  const mesh = new THREE.Mesh(geo, mat);
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

// ─── Public API ──────────────────────────────────────────────
async function preload() {
  await loadManifest();
  if (!manifest.length) {
    // No manifest → mark ready so the rest of the game can boot in stub mode.
    critReady = true;
    fireReady();
    return;
  }
  // Critical-path: first 10 meshes (per ADR-028 §10). Then background-fetch the rest.
  const meshes = manifest.filter(m => m.kind === 'mesh');
  const critical = meshes.slice(0, 10);
  await Promise.all(critical.map(m => loadOne(m.id, m.path)));
  critReady = true;
  fireReady();
  // Background-fetch the rest (fire and forget).
  meshes.slice(10).forEach(m => loadOne(m.id, m.path));
}

function getMesh(id) {
  const g = cache.get(id);
  if (g) return g.clone(true);
  // Not loaded — return placeholder and trigger lazy load.
  loadOne(id, id + '.glb');
  return makePlaceholderMesh();
}

// Minimal InstancedMesh handle (capacity-bounded).
function getInstanced(id, capacity) {
  const group = cache.get(id);
  if (!group) {
    // Stub: returns a placeholder InstancedMesh of magenta cubes.
    const geo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const inst = new THREE.InstancedMesh(geo, getMaterialAtlas(), capacity);
    inst.count = 0;
    return makeHandle(inst, capacity);
  }
  // Find the first Mesh inside the loaded scene to instance.
  let sourceMesh = null;
  group.traverse((o) => { if (!sourceMesh && o.isMesh) sourceMesh = o; });
  if (!sourceMesh) {
    return getInstanced.__fallback || getInstanced(id + '__stub', capacity);
  }
  const inst = new THREE.InstancedMesh(sourceMesh.geometry, sourceMesh.material || getMaterialAtlas(), capacity);
  inst.count = 0;
  return makeHandle(inst, capacity);
}

function makeHandle(inst, capacity) {
  return {
    mesh: inst,
    capacity,
    setMatrixAt(i, matrix) { inst.setMatrixAt(i, matrix); },
    setColorAt(i, color) {
      if (!inst.instanceColor) {
        const arr = new Float32Array(capacity * 3);
        inst.instanceColor = new THREE.InstancedBufferAttribute(arr, 3);
      }
      inst.setColorAt(i, color);
    },
    setCount(n) { inst.count = Math.min(n, capacity); },
    commit() {
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    }
  };
}

function getIconUrl(towerType, tier) {
  return `${ICON_DIR}${towerType}_t${tier + 1}.png`;
}

function isReady() { return critReady; }

function onReady(cb) {
  if (critReady) cb();
  else readyCallbacks.push(cb);
}
function fireReady() {
  readyCallbacks.splice(0).forEach(cb => { try { cb(); } catch (e) { console.error(e); } });
}

window.CTD3Assets = {
  preload, getMesh, getInstanced, getIconUrl, getMaterialAtlas,
  isReady, onReady
};
