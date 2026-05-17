/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — renderer.js
   Three.js WebGLRenderer, orthographic camera, resize, DPR,
   low-power mode, perf monitor. ADR-028 §3, §13.
   Exposes window.CTD3Renderer.
   ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const DPR_DESKTOP_MAX = 2.0;
const DPR_MOBILE_MAX  = 1.5;
const DPR_LOW_POWER   = 1.0;
const PERF_TRIGGER_THRESHOLD_MS = 33;
const PERF_TRIGGER_FRAMES       = 60;
const SHADOW_MAP_DESKTOP = 1024;
const SHADOW_MAP_MOBILE  = 512;

// Stardew-like ¾ angle: ~30° elevation, ~45° yaw.
// Orthographic with one DOF (zoom). No orbit, no pan.
const CAMERA_FRUSTUM_BASE = 12;     // half-height in world units at zoom 1
const CAMERA_DISTANCE     = 30;
const CAMERA_ELEV_DEG     = 30;
const CAMERA_YAW_DEG      = 45;

let renderer = null;
let camera   = null;
let canvas   = null;
let zoom     = 1.0;
let lowPower = false;
let frameStreak = 0;
let lowPowerListeners = [];

function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function init(canvasEl) {
  canvas = canvasEl;
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,           // FXAA handled separately on desktop
    powerPreference: 'high-performance',
    alpha: true                 // lets dark site bg show through
  });
  applyDpr();
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  camera = new THREE.OrthographicCamera();
  positionCamera();

  window.addEventListener('resize', onResize, { passive: true });
  onResize();
}

function applyDpr() {
  if (!renderer) return;
  const max = lowPower ? DPR_LOW_POWER : (isMobile() ? DPR_MOBILE_MAX : DPR_DESKTOP_MAX);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, max));
}

function positionCamera() {
  const elev = THREE.MathUtils.degToRad(CAMERA_ELEV_DEG);
  const yaw  = THREE.MathUtils.degToRad(CAMERA_YAW_DEG);
  // Position the camera on a sphere of radius CAMERA_DISTANCE looking at origin.
  const horiz = Math.cos(elev) * CAMERA_DISTANCE;
  camera.position.set(
    Math.sin(yaw) * horiz,
    Math.sin(elev) * CAMERA_DISTANCE,
    Math.cos(yaw) * horiz
  );
  camera.lookAt(0, 0, 0);
  updateFrustum();
}

function updateFrustum() {
  if (!camera || !canvas) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const aspect = w > 0 && h > 0 ? w / h : 1;
  const halfH = CAMERA_FRUSTUM_BASE / zoom;
  const halfW = halfH * aspect;
  camera.left   = -halfW;
  camera.right  =  halfW;
  camera.top    =  halfH;
  camera.bottom = -halfH;
  camera.near   = 0.1;
  camera.far    = 100;
  camera.updateProjectionMatrix();
}

function onResize() {
  if (!canvas || !renderer) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width  = w;
  canvas.height = h;
  renderer.setSize(w, h, false);
  updateFrustum();
}

function setZoom(z) {
  zoom = Math.max(0.7, Math.min(1.4, z));
  updateFrustum();
}

function getZoom() { return zoom; }

function setLowPower(on) {
  if (lowPower === !!on) return;
  lowPower = !!on;
  applyDpr();
  renderer.shadowMap.enabled = !lowPower;
  lowPowerListeners.forEach(cb => { try { cb(lowPower); } catch (e) {} });
}

function isLowPower() { return lowPower; }

function onLowPowerChange(cb) { lowPowerListeners.push(cb); }

function trackFrame(dtMs) {
  if (dtMs > PERF_TRIGGER_THRESHOLD_MS) frameStreak++;
  else frameStreak = 0;
  if (frameStreak >= PERF_TRIGGER_FRAMES && !lowPower) {
    setLowPower(true);
    console.info('[renderer] auto-switched to low-power mode');
  }
}

function getShadowMapSize() {
  return isMobile() ? SHADOW_MAP_MOBILE : SHADOW_MAP_DESKTOP;
}

function renderFrame(scene) {
  if (!renderer || !camera || !scene) return;
  renderer.render(scene, camera);
}

window.CTD3Renderer = {
  init, renderFrame,
  getRenderer: () => renderer,
  getCamera: () => camera,
  getCanvas: () => canvas,
  setLowPower, isLowPower, onLowPowerChange,
  trackFrame, setZoom, getZoom,
  getShadowMapSize,
  isMobile
};
