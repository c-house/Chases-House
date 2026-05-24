/* ═══════════════════════════════════════════════════════════════
   Castle Tower Defense 3D — lighting.js
   Sun + hemisphere lights, day-night interpolation driven by
   phaseTransition events. ADR-028 §3 lighting, §9 events.
   Exposes window.CTD3Lighting.
   ═══════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

// Two phase presets (day = build/prepWave, night = inWave).
const PRESETS = {
  prepWave: {
    sunColor:   0xffe6b3,
    sunIntensity: 1.1,
    hemiSkyColor: 0xb0d4f1,
    hemiGroundColor: 0x9d7f5a,
    hemiIntensity: 0.7
  },
  inWave: {
    sunColor:   0xffe6b3,
    sunIntensity: 1.1,
    hemiSkyColor: 0xb0d4f1,
    hemiGroundColor: 0x9d7f5a,
    hemiIntensity: 0.7
  }
};

let sun, hemi, scene;
let current = PRESETS.prepWave;
let target  = PRESETS.prepWave;
let tweenStartMs = 0;
let tweenDurMs   = 1200;
let inTween = false;

function init(threeScene) {
  scene = threeScene;
  sun = new THREE.DirectionalLight(PRESETS.prepWave.sunColor, PRESETS.prepWave.sunIntensity);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.width  = (window.CTD3Renderer && window.CTD3Renderer.getShadowMapSize) ? window.CTD3Renderer.getShadowMapSize() : 1024;
  sun.shadow.mapSize.height = sun.shadow.mapSize.width;
  sun.shadow.camera.left   = -14;
  sun.shadow.camera.right  =  14;
  sun.shadow.camera.top    =  14;
  sun.shadow.camera.bottom = -14;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far  = 40;
  sun.shadow.bias = -0.0005;
  scene.add(sun);

  hemi = new THREE.HemisphereLight(
    PRESETS.prepWave.hemiSkyColor,
    PRESETS.prepWave.hemiGroundColor,
    PRESETS.prepWave.hemiIntensity
  );
  scene.add(hemi);

  applyPreset(PRESETS.prepWave);
}

function applyPreset(p) {
  if (!sun || !hemi) return;
  sun.color.setHex(p.sunColor);
  sun.intensity = p.sunIntensity;
  hemi.color.setHex(p.hemiSkyColor);
  hemi.groundColor.setHex(p.hemiGroundColor);
  hemi.intensity = p.hemiIntensity;
  current = p;
}

function lerpPreset(a, b, t) {
  return {
    sunColor: lerpHex(a.sunColor, b.sunColor, t),
    sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t,
    hemiSkyColor: lerpHex(a.hemiSkyColor, b.hemiSkyColor, t),
    hemiGroundColor: lerpHex(a.hemiGroundColor, b.hemiGroundColor, t),
    hemiIntensity: a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t
  };
}

function lerpHex(a, b, t) {
  const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab_ = a & 0xff;
  const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab_ + (bb - ab_) * t);
  return (r << 16) | (g << 8) | bl;
}

function beginPhase(phase, durationMs) {
  const next = PRESETS[phase];
  if (!next) return;
  // Snapshot current values to lerp from (in case mid-tween).
  const cur = { ...current };
  current = cur;
  target  = next;
  tweenStartMs = performance.now();
  tweenDurMs   = durationMs || 1200;
  inTween = true;
}

function update(/* dtMs */) {
  if (!inTween) return;
  const now = performance.now();
  const t = Math.min(1, (now - tweenStartMs) / tweenDurMs);
  applyPreset(lerpPreset(current, target, t));
  if (t >= 1) {
    inTween = false;
    current = target;
  }
}

window.CTD3Lighting = { init, beginPhase, update };
