# CTD3 — Atmospheric Grounding (Three.js spec)

> **Source:** Claude Design round 3, 2026-05-31. Drop-in values for `scene.js` / `lighting.js` / `renderer.js`, tuned against the current code and the **Kenney Tower Defense Kit** (flat-shaded low-poly, `MeshStandardMaterial` + vertex colour). Because the kit lights normally, warm light + tone-mapping desaturate the baked purple toward a muted dusk-plum — **no GLB is repainted.** This is the canonical implementation reference for ADR-034 Group 2.

**Apply in this order** (each later step assumes the earlier ones): B lights → C fog/bg → D ground → E CSS grounding → A tone-mapping (dial last) → F fireflies → G Warden. Tone-mapping changes every colour, so set exposure *after* the lights look right.

---

## A. Tone mapping — `renderer.js`, right after `new THREE.WebGLRenderer(...)`

```js
renderer.toneMapping = THREE.AgXToneMapping;       // r170: gentler than ACES
renderer.toneMappingExposure = 1.06;
renderer.outputColorSpace = THREE.SRGBColorSpace;  // pin it (already the default)
```

- **Why AgX, not ACESFilmic:** ACES pushes greens yellow and *over*-saturates the neon purple before clipping it. AgX desaturates the extremes more neutrally — the purple settles into a dim plum while the gold window highlight survives. AgX darkens midtones slightly, hence exposure `1.06` + the small sun bump in B.
- `alpha:true` stays. Tone-mapping only touches GL fragments — the radial grounding (E) sits *behind* the canvas and is unaffected, which is what we want.
- Punchier alternative if AgX feels flat: `THREE.ACESFilmicToneMapping`, exposure `0.92`.

## B. Lights — `lighting.js` PRESETS (warm the whole field)

Both presets are currently identical (audit flagged the dead prepWave→inWave tween). Warm them and give the tween something to do:

```js
const PRESETS = {
  prepWave: {                  // day — building phase
    sunColor:        0xffd9a0, // was 0xffe6b3 — golden-hour, lower colour temp
    sunIntensity:    1.18,     // was 1.1  — small bump to offset AgX midtones
    hemiSkyColor:    0x9fb6c4, // was 0xb0d4f1 — cold blue → foggy sage-grey
    hemiGroundColor: 0x6a5536, // was 0x9d7f5a — warmer bark bounce
    hemiIntensity:   0.62
  },
  inWave: {                    // dusk — combat phase: cooler, tenser
    sunColor:        0xffc987,
    sunIntensity:    0.95,
    hemiSkyColor:    0x7d93a0,
    hemiGroundColor: 0x5e4a30,
    hemiIntensity:   0.50
  }
};
```

The cold-blue hemisphere (`0xb0d4f1`) was the biggest reason the purple read as neon — it lit the plastic with cool fill. Pulling it sage-grey is most of the fix on its own.

## C. Background + fog — `scene.js` `init()`

```js
scene.background = new THREE.Color(0x1a2a20);   // was 0x0a0a0b — warm pine, not void
scene.fog = new THREE.Fog(0x1a2a20, 26, 58);    // SAME colour as bg → no seam
```

With the ortho iso camera, `near ≈ 26 / far ≈ 58` starts the haze just past the tile field, so distant tiles/trees dissolve into canopy instead of hard-cutting to black. If your pan clamp shows more field, nudge `far` up. Keep fog colour === background colour.

## D. Base ground plane + fake contact-shadow — `scene.js` `init()`

The Kenney tiles render on top (InstancedMesh); the big underplane is yours:

```js
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x3c5a38, roughness: 0.95   // was 0x6a8447 — sage-moss rim = canopy shadow
});
```

Ground the playfield with a cheap radial AO disc so it doesn't float:

```js
function makeRadialAlpha() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128,128,12, 128,128,128);
  grd.addColorStop(0,'rgba(0,0,0,1)'); grd.addColorStop(1,'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0,0,256,256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const ao = new THREE.Mesh(
  new THREE.PlaneGeometry(46, 30).rotateX(-Math.PI/2),
  new THREE.MeshBasicMaterial({ map: makeRadialAlpha(), color: 0x000000,
    transparent: true, opacity: 0.5, depthWrite: false })
);
ao.position.y = 0.02; scene.add(ao);   // just above the underplane, below tiles
```

## E. Radial grounding + vignette — CSS (matches the gameplay mock 1:1)

Highest impact, zero GL cost. `alpha:true` lets a layer *behind* the canvas show through. Put one layer behind `#canvas` and a vignette above it but under the HUD:

```css
#grounding {                 /* behind the canvas */
  position: fixed; inset: 0; z-index: -1; pointer-events: none;
  background:
    radial-gradient(120% 90% at 18% 8%,   rgba(232,183,90,0.10), transparent 55%),
    radial-gradient(120% 100% at 88% 96%, rgba(122,148,96,0.09), transparent 55%),
    radial-gradient(80% 70% at 50% 46%,   rgba(40,66,52,0.55),  transparent 72%),
    #11180f;
}
#vignette {                  /* above canvas (z between canvas and .hud) */
  position: fixed; inset: 0; z-index: 1; pointer-events: none;
  box-shadow: inset 0 0 320px 80px rgba(5,8,6,0.85);
}
```

(`#canvas` is `z-index:0`; HUD is `z-index:10`, so a `z-index:1` vignette slots between cleanly.)

## F. Fireflies — additive `THREE.Points`, GPU twinkle (drop-in module)

```js
import * as THREE from 'three';
let ffMat = null;

export function initFireflies(scene, { count = 14 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;        // T13
  if (window.CTD3Renderer?.isLowPower?.()) count = Math.min(count, 6);
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random()-0.5)*44;   // x across field
    pos[i*3+1] = 0.6 + Math.random()*4;    // y just above ground
    pos[i*3+2] = (Math.random()-0.5)*28;   // z
    seed[i] = Math.random()*6.28;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSeed',    new THREE.BufferAttribute(seed, 1));
  ffMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime:{value:0}, uColor:{value:new THREE.Color(0xf4cc6e)}, uSize:{value:90} },
    vertexShader: `
      attribute float aSeed; uniform float uTime, uSize; varying float vTw;
      void main(){
        vec3 p = position;
        p.y += mod(uTime*0.35 + aSeed*1.4, 5.0);   // slow rise + wrap (matches 0.6..5.6 band)
        p.x += sin(uTime*0.5 + aSeed)*0.6;          // sway
        p.z += cos(uTime*0.4 + aSeed*1.3)*0.6;
        vTw = 0.5 + 0.5*sin(uTime*1.6 + aSeed*3.0); // twinkle
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_PointSize = uSize * vTw / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uColor; varying float vTw;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        gl_FragColor = vec4(uColor, smoothstep(0.5,0.0,d) * vTw * 0.9);
      }`
  });
  const pts = new THREE.Points(geo, ffMat);
  pts.frustumCulled = false;
  scene.add(pts);
}
export function tickFireflies(dtMs){ if (ffMat) ffMat.uniforms.uTime.value += dtMs*0.001; }
```

Call `tickFireflies(dtMs)` from the existing render/update loop. Reduced-motion returns before creating anything; low-power caps at 6. Gold `0xf4cc6e` matches `--accent-glow`.

## G. Warden aura — `scene.js`

```js
const WARDEN_AURA_COLOR = 0x8fc6cf;   // was 0x6fd0e0 — mistier frost, neon dropped
```

---

### Quick QA checklist after wiring

- Purple Mage/Warden tops read as dim plum, not neon, under the new hemisphere.
- No hard black seam at the field edge (fog colour === bg colour).
- Gold mage-tip / window highlight still punches (don't over-expose down).
- Fireflies hover above the grass, never below it (y-band vs wrap range match).
- `prefers-reduced-motion` kills fireflies; low-power caps them.
