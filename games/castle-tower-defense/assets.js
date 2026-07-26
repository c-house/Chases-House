/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — assets.js
   GLTFLoader cache, instance pools, icon URLs, shared material.
   Single owner of all third-party asset loading. ADR-028 §4, §10.
   Exposes window.CTD3Assets.
   ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// SkeletonUtils.clone is the ONLY correct way to copy a skinned mesh:
// Object3D.clone(true) copies the SkinnedMesh and the bone hierarchy but leaves
// the copy's skeleton bound to the ORIGINAL bones, so every clone deforms from
// one shared pose. ADR-039 D27. Cheap for non-skinned assets is not the point —
// getMesh only routes here when the cached scene actually contains a SkinnedMesh.
import { clone as cloneSkinnedHierarchy } from 'three/addons/utils/SkeletonUtils.js';

const MANIFEST_URL = 'assets/MANIFEST.json';
const ICON_DIR     = 'assets/icons/';
const MODEL_DIR    = 'assets/';

const loader = new GLTFLoader();
const cache  = new Map();        // id → THREE.Group (parsed scene)
const clipCache = new Map();     // id → AnimationClip[] (ADR-039 D27; empty for static kit assets)
const skinnedIds = new Map();    // id → bool, memoized "does this scene contain a SkinnedMesh?"
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
        // Animated assets (ADR-039 monster roster) carry clips. AnimationClip is
        // immutable sample data and AnimationMixer keys its bindings by root, so
        // one cached clip array is safely shared by every live instance's mixer.
        if (gltf.animations && gltf.animations.length) clipCache.set(id, gltf.animations);
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
  // Marked so callers can tell "the asset is still in flight" from "this is the
  // model". scene.js's low-power mixer recovery needs it: a placeholder has none
  // of the model's bones, so binding a mixer to one emits a PropertyBinding
  // warning per track and animates nothing.
  group.userData.isPlaceholder = true;
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
  // Critical-path: explicit ID allowlist (towers + path + WFC palette + decorations).
  // Then background-fetch the rest.
  const meshes = manifest.filter(m => m.kind === 'mesh');
  const CRITICAL_IDS = new Set([
    'tower_ranger_t1', 'tower_ranger_t2', 'tower_ranger_t3',
    'tower_catapult_t1', 'tower_catapult_t2', 'tower_catapult_t3',
    'tower_mage_t1', 'tower_mage_t2', 'tower_mage_t3',
    'tower_warden_t1', 'tower_warden_t2', 'tower_warden_t3',
    'keep_bottom', 'keep_middle', 'keep_roof',
    'tile_path_straight', 'tile_path_corner_round',
    'tile_path_end_round', 'tile_path_spawn_end_round',
    'tile_ground', 'tile_hill', 'tile_rock', 'tile_tree',
    'tile_tree_double', 'tile_tree_quad', 'tile_crystal',
    'snow_tile_ground', 'snow_tile_hill', 'snow_tile_rock', 'snow_tile_tree',
    'snow_tile_tree_double', 'snow_tile_tree_quad', 'snow_tile_crystal',
    'detail_tree', 'detail_rocks', 'detail_crystal'
  ]);
  const critical = meshes.filter(m => CRITICAL_IDS.has(m.id));
  await Promise.all(critical.map(m => loadOne(m.id, m.path)));
  critReady = true;
  fireReady();
  // Background-fetch the rest (fire and forget).
  meshes.filter(m => !CRITICAL_IDS.has(m.id)).forEach(m => loadOne(m.id, m.path));
}

// True iff the cached scene for `id` contains a SkinnedMesh. Memoized — the
// answer is a property of the asset, and the traverse is otherwise repeated on
// every single spawn.
function isSkinned(id) {
  if (skinnedIds.has(id)) return skinnedIds.get(id);
  const g = cache.get(id);
  if (!g) return false;                 // unknown until loaded; don't memoize a miss
  let found = false;
  g.traverse(o => { if (o.isSkinnedMesh) found = true; });
  skinnedIds.set(id, found);
  return found;
}

// The animation clips shipped with `id`, or null. Shared, not cloned (see
// loadOne). Callers build their own AnimationMixer per instance.
function getClips(id) {
  return clipCache.get(id) || null;
}

// SkeletonUtils.clone gives every SkinnedMesh its OWN Skeleton, even when the
// meshes were bound to a single shared skeleton in the source. Because the kit's
// models split one character into one primitive per material, that turns a
// 6-material creature into 6 skeletons — and three.js uploads each skeleton's
// bone matrices into its own bone TEXTURE every frame, so the per-frame skinning
// bandwidth and the live texture count both multiply by the material count
// (measured: 6 bone textures per enemy, ~11 for the footman model).
//
// Meshes may share a Skeleton only when they came from the SAME glTF skin. A
// Skeleton is (bones, boneInverses) — and matching `bones` is NOT sufficient:
// three's GLTFLoader builds one Skeleton per skin INDEX, each carrying that
// skin's own `inverseBindMatrices`, and these models ship skins whose joint
// lists are byte-identical while their bind matrices deliberately differ.
//
// That is a direct consequence of the KHR_mesh_quantization pass documented in
// assets/LICENSE.txt: for a skinned mesh the node transform is ignored, so
// glTF-Transform folds each mesh's de-quantization into its inverse bind
// matrices — and when one source skin serves meshes with different quantization
// volumes it must SPLIT the skin. Measured in the shipped roster:
//
//   enemy_footman2  skin0 Orc (9 prims)            / skin1 Orc_Weapon (2)   IBM ratio 0.399
//   enemy_captain2  skin0 MushroomKing (5)         / skin1 Mushroom (2)     IBM ratio 0.389
//   enemy_slime2    skin0 Green_Blob.001 eyes (2)  / skin1 Green_Blob body  IBM ratio 2.713
//
// Keying on bone identity therefore COLLIDES on those three and rebinds the
// second skin onto the first's bind matrices — the footman's sword at 2.5x, the
// captain boss's mushroom at 2.57x, the slime's body at 0.37x with full-size
// eyes. It reads like a bad ENEMY_VIS.scale and sends you to the wrong table.
//
// `SkeletonUtils.clone` passes the SOURCE skeleton's `boneInverses` ARRAY through
// by reference, so within one cloned root "same boneInverses object" is exactly
// "same source skin". Group on that identity and the dedupe is precise: the
// footman still collapses 11 Skeletons to 2, keeping nearly all the per-frame
// bone-texture win, with no deformation change at all.
function shareSkeletons(root) {
  const bySourceSkin = new Map();    // boneInverses array (object identity) → Skeleton
  root.traverse(o => {
    if (!o.isSkinnedMesh || !o.skeleton) return;
    const key = o.skeleton.boneInverses;
    if (!key) return;
    const existing = bySourceSkin.get(key);
    if (!existing) { bySourceSkin.set(key, o.skeleton); return; }
    if (existing === o.skeleton) return;
    const dead = o.skeleton;
    // Pass bindMatrix EXPLICITLY. With it undefined, SkinnedMesh.bind calls
    // skeleton.calculateInverses(), which would overwrite the bind matrices of
    // the skeleton we are sharing — and boneInverses is shared by reference with
    // the cached asset, so that would corrupt every future instance of the type.
    o.bind(existing, o.bindMatrix);
    // Free the surplus Skeleton's GPU resource so the dedupe cannot itself leak.
    // Pre-render its boneTexture is still null, making this a no-op today; it is
    // here so the invariant holds if clone-time ever moves after first render.
    if (typeof dead.dispose === 'function') dead.dispose();
  });
  return root;
}

function getMesh(id) {
  const g = cache.get(id);
  // Skinned assets MUST go through SkeletonUtils.clone — a plain clone(true)
  // leaves the copy driven by the source's bones (ADR-039 D27). Routing on
  // content rather than on a caller-supplied flag means a future skinned asset
  // cannot silently regress by using the wrong entry point.
  if (g) return isSkinned(id) ? shareSkeletons(cloneSkinnedHierarchy(g)) : g.clone(true);
  // Not loaded — return placeholder and trigger lazy load.
  // Look up the manifest path. Falling back to bare `${id}.glb` was a
  // legacy ADR-028 hack that 404s for the 24 ADR-030 tile/decoration
  // assets (their on-disk paths are `models/${id}.glb`). Use the manifest
  // entry's path when available.
  if (manifest && manifest.length) {
    const entry = manifest.find(m => m.id === id);
    if (entry) {
      loadOne(id, entry.path);
      return makePlaceholderMesh();
    }
  }
  loadOne(id, id + '.glb');
  return makePlaceholderMesh();
}

// True iff the asset manifest declares this id.
// Synchronous. Used by scene.paintDecorations to choose between _large mesh
// swap and a 1.5× scale fallback (ADR-030 §6, MAJ-2).
//
// Manifest-only — NOT cache presence. preload()'s critical path covers only
// the first 10 entries (towers); tile + decoration meshes background-load,
// so cache presence is non-deterministic at the moment paintDecorations runs.
// "Does the kit ship this id?" is the actual question for the dispatch.
function hasMesh(id) {
  if (!manifest || !manifest.length) return false;
  return manifest.some(m => m.id === id);
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
  preload, getMesh, hasMesh, getInstanced, getIconUrl, getMaterialAtlas,
  getClips, isSkinned,
  isReady, onReady
};
