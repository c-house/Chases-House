# ADR-034: CTD3 UI/UX Remediation v2 — Design-System Alignment

**Date:** 2026-05-31
**Status:** Accepted — **SHIPPED, all 7 groups** (Group 6 closed out 2026-07-23 via ADR-036 CH-5: T14 sheet-modal inert, T9 "Not enough gold" SR announcement, T15 quiet/spirited distinction verified — ember + ★ prefix, not color-alone; Group 5 Warden comment verified at scene.js `WARDEN_AURA_COLOR`. Group 7 closed 2026-07-23: 7a status/validation-voice/JSON/shortcuts via ADR-036 CH-6 `4e880b6`; 7b responsive shell `1008d8b` + theme wiring — `rulesForMap({id, theme})` palettes and cabin-tone preview backgrounds — via ADR-036 Sprint 2 W-1/W-2).
**Supersedes scope of:** ADR-028 §UI (visual polish only — gameplay/architecture decisions stand)
**Note on number:** Synthesis dispatched against a local clone that pre-dated `033-crawler-control-and-robots.md` landing on the remote, so the workflow drafted this as 033. On reconciliation the collision was real (crawler-control 033 has 5 commits already), so this ADR is filed as 034 and all in-content references updated. The commit subject of `378f9ab` still refers to "ADR-033" — that was the original push; the rename + reference updates land in a follow-up commit.

---

## Context

The dark "Cabin in the Woods" design system was extracted into `.design-system/` this session as the canonical brand spec (`.design-system/README.md` + `colors_and_type.css`). In parallel, an external Claude.ai design critique session diffed CTD3 against that spec and produced a headline finding: **"Two games wearing different skins."** The chrome (landing / map-select / editor form) is on-brand; the gameplay canvas is a different product — purple towers, kelly-green board (`0x6a8447`), near-black surround (`0x0a0a0b`), neon placement disc (`0x6aff5a`).

The prior CTD3 UX audit (`docs/audits/2026-05-18-ctd3-ux-audit.md`) shipped TIER 1 at `2c63dbc` and left TIER 2 (T8-T18) and TIER 3 editor items (T20-T25) open. Since that audit: Phase 5 enemies shipped (`bae9bac`), Warden aura visibility (`39cd0b3`), and Ranger muzzle-flash bleed fix (`d93925f`) all landed — but none address the brand cohesion gap, and the Warden aura's deliberate-cyan choice was never ratified.

The foundational blocker behind most chrome findings is `/styles.css` itself. Two distinct drift problems: (1) it serves pre-rebrand `--bg-deep: #0a0a0b` and `--accent-gold: #c8943e` (stale); (2) `--text-muted: #9a8e7a` and `--text-faint: #5c5347` are *wrong values*, not missing — they read brown-on-pine instead of canon's lichen `#9aa89a` / deep-moss `#5a6a5e`. Until both are fixed, even CTD3 surfaces that correctly reference canonical token names inherit incorrect colors. Group 1 below addresses this root cause; every later fix depends on it.

**Asset constraint (foundational).** Tower GLBs, landscape tiles, decoration meshes, and enemy GLBs are all kit-sourced (Kenney castle kit + KayKit) or Hyper3D-Rodin-generated and frozen. Their baked materials — purple Mage/Warden cone tops, stone Ranger, dark-wood Catapult, kelly-green grass, brown path, white snow — are immutable for this remediation. Brand cohesion in the gameplay scene is therefore achieved by warming the world *around* the kit assets (scene.background, fog, lighting, fireflies, tone mapping, CSS overlay) rather than altering the assets themselves. Group 2 below operationalizes this as an atmospheric reframe.

**What this ADR does NOT do:** It is not the implementation. It does not produce mockups (Claude Design is generating those in parallel — when they land they refine specific groups, not the structure). It does not wire the four new enemies into wave content. It does not redesign the editor mobile-first beyond the responsive collapse fix.

---

## Decision

Remediate CTD3 in seven prioritized leverage groups, root-cause first: (1) fix `/styles.css` token drift so every downstream surface resolves to canopy/window values using canonical token names, (2) atmospheric reframe — warm the world around the kit-immutable tower/landscape assets via lighting, fog, background, fireflies, and CSS overlay, (3) per-effect tokenisation pass for the gameplay scene (placement discs, hover rings, projectiles, range circles, labels) layered on top of Group 2's atmospheric core, (4) align CTD3 chrome — title / map-select / HUD — to design-system patterns, (5) ratify the Warden cyan exception in code and ADR, (6) close TIER 2 accessibility/UX gaps from the prior audit (T8-T18), (7) rebuild the Cartographer's status/validation/JSON surfaces and ship editor accessibility (T20-T25). Acceptance is browser-observable per group, verified with chrome-devtools-mcp screenshot diffs and design-token grep.

---

## Phasing & Commit Strategy

The seven groups carry uneven shipping risk. Order them as:

1. **Group 1 first, as a single atomic commit** — token bridge. Homepage-regression-tested before downstream work begins.
2. **Group 2 next, as the atmospheric core commit** — owns scene.background, scene.fog, lighting.js presets, renderer tone mapping, ground retint + AO disc, the firefly shader module, the Warden constant, and the `#grounding`/`#vignette` CSS overlay. One commit, all of spec §A–G.
3. **Group 3 after Group 2 has landed** — per-effect tokenisation pass only (placement disc, hover rings, projectiles, range circles, labels, tile-debug, label-texture). Group 3 does NOT re-touch the atmospheric values Group 2 owns.
4. **Group 4 splits into three commits**: 4a (tokens, radii, SMALLCAPS — pure CSS pass), 4b (hero artwork + motes + atmospheric layer on chrome), 4c (interaction polish: hover-lift, danger styling, tab aria, sticky underlines, gold-discipline pruning). Each is independently revertable.
5. **Groups 5, 6, 7** ship independently after Groups 1-4 land.

**Order-of-operations rule for files touched by multiple groups** (`index.html`, `scene.js`): each commit message names the Group it implements; no single commit may touch more than one Group, to keep cherry-pick and revert practical.

**Precedence rule for shared files.** `scene.js`, `lighting.js`, and `renderer.js` are touched by both Group 2 (atmospheric core) and Group 3 (per-effect tokenisation). Where the two groups overlap on the same constant or call site (scene.background, scene.fog, lighting presets, renderer.toneMapping, fireflies, WARDEN_AURA_COLOR), **Group 2 values WIN** and Group 3 does not modify those lines. Group 3 is only the per-effect tokenisation pass for the literals Group 2 does not own.

**Minimum shippable subset.** If the full ADR cannot ship, the brand-cohesion headline ("two games wearing different skins") is closed by **Groups 1 + 2** alone — roughly one week of evening work. With Group 2 reframed as atmospheric (M+S work rather than the prior XL retint), this subset is materially smaller than the v1 draft and still lands the headline shift: a warmed surround makes the kit silhouettes read as part of the scene before the precision passes (3, 4, 6, 7) compound on top.

**Effort yardstick** (replacing prior S/M/L only labels):
- **S** ≤ 2h — single-line constant swap, single-rule CSS add
- **M** ≤ 4h (half-day) — multi-file token threading, single-feature implementation
- **L** ≤ 8h (full day) — new module, responsive shell, multi-surface refactor
- **XL** multi-day — Group 7 responsive shell (3 breakpoints × per-tool QA)

**Verification budget**: G1 ~1h, G2 ~3h (includes the 9-point HSL grid sample now that fog/AgX values are pinned), G3 ~2h, G4a/b/c ~2h each, G5 ~15min, G6 ~4h, G7 ~4h. **Total ~21h verification on top of ~35-45h implementation. Plan ~3 weeks of evening work end-to-end.**

---

## Fix Groups (Prioritized by Leverage)

### Group 1: Root token bridge — fix `/styles.css` and CTD3 `:root` overrides

- **Why this leverage:** Every downstream finding assumes canonical tokens resolve correctly. Until `/styles.css` declares the cabin ladder AND fixes its wrong text values, CTD3 inherits both pre-rebrand `#0a0a0b`/`#c8943e` and the brown-gold `--text-muted`/`--text-faint`. Single file change, repo-wide effect.
- **Token-name rule:** All additions match `.design-system/colors_and_type.css` byte-for-byte on names. **Bare `--terracotta`, `--sage`, `--moss`, `--fog`, `--bark`** — NOT `--accent-` prefixed. NOT `--moss-deep`. This is the ADR-correctness verifier's #1 finding; ignoring it would re-create the parallel-universe problem this ADR is trying to eliminate.

- **Findings addressed:**
  - "Root /styles.css is stale and still serves pre-rebrand --bg-deep / --accent-gold values"
  - "Off-brand local palette overrides canonical tokens" (CTD3 index.html)
  - "Editor uses parallel design-token universe instead of brand vars"
  - "`--text-muted: #9a8e7a` / `--text-faint: #5c5347` are brown-gold WRONG VALUES, not missing — canon is lichen `#9aa89a` / deep moss `#5a6a5e`"
  - "Inputs have flat-black #0a0a0b fill against #15110d panel" (editor)

- **Concrete changes:**

  | File:line | Current | Proposed | Token | Effort |
  |---|---|---|---|---|
  | `styles.css:5` | `--bg-deep: #0a0a0b` | `--bg-deep: #0d1410` | canopy | S |
  | `styles.css:6` | `--bg-main: #141416` | `--bg-main: #152821` | pine shadow | S |
  | `styles.css:7` | `--bg-surface: #1e1e21` | `--bg-surface: #1f3329` | moss stone | S |
  | `styles.css:8` | `--bg-elevated: #28282c` | `--bg-elevated: #2a4234` | fern | S |
  | `styles.css:12` | `--text-muted: #9a8e7a` (WRONG — brown-gold) | `--text-muted: #9aa89a` (lichen) | --text-muted | S |
  | `styles.css:13` | `--text-faint: #5c5347` (WRONG — brown-gold) | `--text-faint: #5a6a5e` (deep moss) | --text-faint | S |
  | `styles.css:15` | `--accent-gold: #c8943e` | `--accent-gold: #e8b75a` | window-glow | S |
  | `styles.css:16` | `--accent-glow: #e8b04a` | `--accent-glow: #f4cc6e` | hover glow | S |
  | `styles.css:19` | `--sage: #6a7d5a` | `--sage: #7a9460` | sage | S |
  | `styles.css` (add) | (missing) | `--moss: #4a6a4e;` `--fog: #6e8a7a;` `--mist: #a8bfaf;` `--bark: #3a2a1c;` | full cabin palette | S |
  | `styles.css` (add) | (missing) | `--radius-sm: 3px; --radius-md: 6px; --radius-lg: 8px;` | notched-log scale | S |
  | `games/castle-tower-defense/index.html:30-45` | Local `:root` redeclares `--aged-gold:#c8943e --ink:#1a1410 --leaf --wine` | Replace with bridge: `--aged-gold: var(--accent-gold); --ember: var(--accent-ember); --warm-stone: var(--text-primary); --ink: var(--bg-deep);` drop `--leaf` and `--wine` | bridge | M |
  | `games/castle-tower-defense/tools/map-editor.html:34` | Local `:root` token block | Same bridge as index.html | bridge | M |
  | `games/castle-tower-defense/index.html:49` | `body { background:#0a0a0b }` fallback | `body { background: var(--bg-deep) }` | --bg-deep | S |
  | `games/castle-tower-defense/index.html:110-114` | Scrims `rgba(10,10,11,X)` | `rgba(13,20,16,X)` | --bg-deep alpha | S |
  | `games/castle-tower-defense/tools/map-editor.html:160` | input bg `#0a0a0b` | `var(--bg-deep)` `#0d1410` | --bg-deep | S |

- **Brand exception allowlist (drives Group 1 grep acceptance).** Sanctioned non-cabin literals, one allowlist line per (file, literal, justification):
  - `scene.js:20 0x8fc6cf` — Warden aura, per Deliberate Decision A (post-Group 2 value; pre-Group 2 the literal is `0x6fd0e0`)
  - `scene.js:702 (hover ring)` — Warden aura reuse
  - `index.html:517-526 #9fe` — dev-only test overlay, scope-exempt per Group 4 exemption comment

  Acceptance grep: `grep -rn '#0a0a0b\|#c8943e' styles.css games/castle-tower-defense/` matches **only** lines in the allowlist above.

- **Acceptance:**
  - Token-name audit (pre-commit): every token added to `styles.css` already exists in `.design-system/colors_and_type.css` (lines 28-63), OR is added to canon in the same commit. Canon and `styles.css` stay byte-equivalent on names.
  - Allowlist grep above returns only sanctioned literals.
  - `getComputedStyle(document.body).backgroundColor` on every CTD3 screen resolves to `rgb(13, 20, 16)` or deeper cabin ladder, never `rgb(10, 10, 11)`.
  - `getComputedStyle(document.querySelector('.btn.primary')).backgroundColor` resolves to `rgb(232, 183, 90)`.
  - `getComputedStyle(el-with-text-muted).color` resolves to `rgb(154, 168, 154)` (lichen), never `rgb(154, 142, 122)` (brown-gold).
  - chrome-devtools-mcp screenshot of homepage shows no visible regression.

---

### Group 2: Atmospheric Reframe — warm the world, not the towers

- **Why this leverage:** Tower + landscape kit assets are immutable (Kenney castle kit / KayKit / Hyper3D Rodin enemies — see Decision C). We achieve brand cohesion by warming the SURROUND — lighting, fog, background, fireflies — so the kit silhouettes read as part of the scene rather than alien cones in a kelly void. The thesis flips from "kill the purple cones" to "make the world warm enough that the cones read as deliberate fantasy-tower lighting."

  > **Canonical implementation source:** [docs/design/ctd3-atmospheric-grounding-three-js.md](../../docs/design/ctd3-atmospheric-grounding-three-js.md) (Claude Design round 3, 2026-05-31). The table below summarises the drop-in values; consult the spec for full code, apply-order, and QA checklist.

- **Apply order (matters, per spec):** B lights → C fog/bg → D ground → E CSS → A tone-map → F fireflies → G Warden. Tone-map late so the lighting hex values are tuned against AgX, not ACES.

- **Ownership.** This group owns every line on scene.background, scene.fog, lighting.js PRESETS, renderer.toneMapping, the ground plane + AO disc, the firefly shader module, the `#grounding`/`#vignette` CSS overlay, and `WARDEN_AURA_COLOR`. Group 3 must not modify any of these. Where the body of Group 3 still references file:line slots for these values, treat Group 2 as the source of truth and Group 3 as no-op for those slots.

- **Findings addressed:**
  - "Tower meshes appear purple, violating the no-cool-color brand rule" — **achieved indirectly via Group 2 atmospheric reframe; tower materials remain kit-default per Decision C.**
  - "Gameplay scene lacks any warm-family ambient — even neutral lighting reads cold against the kit greens and purples" — **directly addressed by warming DirectionalLight + HemisphereLight + fog + background + AgX tone map + fireflies.**
  - "Scene background is near-black void (0x0a0a0b)" — set to warm pine `0x1a2a20`.
  - "Ground plane fallback is kelly green (0x6a8447)" — set to sage-moss rim `0x3c5a38`.
  - "Hemisphere sky color is cool baby-blue (0xb0d4f1)" — pulled to sage-grey `0x9fb6c4` (prepWave) / `0x7d93a0` (inWave).
  - "Day-night phase presets are identical — phaseTransition tween is dead code" — revived as a measurable delta between prepWave and inWave.
  - "Fog is not enabled — playfield clips abruptly into background void" — linear `THREE.Fog(0x1a2a20, 26, 58)` matching bg colour.
  - "Drifting motes layer is absent from gameplay canvas" — shader-based firefly Points module.

- **Concrete changes** (code-side, scene.js + lighting.js + renderer.js + CSS):

  | File / target | Current | Proposed | Token / rationale | Effort |
  |---|---|---|---|---|
  | `renderer.js` — tone mapping | (probably none or `NoToneMapping`) | AgX (`THREE.AgXToneMapping`) at `toneMappingExposure: 1.06`, `outputColorSpace: THREE.SRGBColorSpace` (pinned), `alpha: true` preserved | AgX neutrally desaturates the kit's neon purple; ACES oversaturates the purple before clipping. Punchier fallback: `ACESFilmicToneMapping` at exposure 0.92. See spec §A. | S |
  | `lighting.js` — `PRESETS.prepWave` (day / build phase) | `sunColor: 0xffe6b3 @ 1.1`; `hemiSkyColor: 0xb0d4f1` (cold blue!) / `hemiGroundColor: 0x9d7f5a`; identical to inWave (dead tween) | `sunColor: 0xffd9a0 @ 1.18` (golden-hour, lower colour temp; bump offsets AgX midtones); `hemiSkyColor: 0x9fb6c4` (cold blue → sage-grey); `hemiGroundColor: 0x6a5536` (warmer bark bounce); `hemiIntensity: 0.62` | Cold-blue hemisphere `0xb0d4f1` was the biggest reason the purple read as neon — pulling it sage-grey is most of the fix on its own. See spec §B. | S |
  | `lighting.js` — `PRESETS.inWave` (dusk / combat phase) | (currently identical to prepWave — dead tween audit flagged) | `sunColor: 0xffc987 @ 0.95`; `hemiSkyColor: 0x7d93a0`; `hemiGroundColor: 0x5e4a30`; `hemiIntensity: 0.50` | Revives the dead prepWave→inWave tween. Cooler/tenser dusk-combat vs warmer day-build. See spec §B. | S |
  | `scene.js` — `scene.background` (init) | `0x0a0a0b` (void) | `new THREE.Color(0x1a2a20)` (warm pine, not void) | Warm pine reads as forest canopy rather than empty space. See spec §C. | S |
  | `scene.js` — `scene.fog` (init) | (likely none / default) | `new THREE.Fog(0x1a2a20, 26, 58)` — LINEAR fog (NOT exp2); `fog.color === background.color` | Same colour as bg eliminates the hard black seam at field edge. `near=26`/`far=58` tuned for ortho iso camera (haze starts just past the tile field). See spec §C. | S |
  | `scene.js` — base ground plane material | `color: 0x6a8447` (kelly fallback) | `color: 0x3c5a38` (sage-moss rim = canopy shadow), `roughness: 0.95` | Underplane only — Kenney tiles render on top and are unchanged per Decision C. See spec §D. | S |
  | `scene.js` — add radial AO disc (new) | (none) | `PlaneGeometry(46, 30)` rotated `-PI/2`, `MeshBasicMaterial` with canvas-drawn radial-gradient alpha texture (256×256 canvas, `rgba(0,0,0,1)` center → `rgba(0,0,0,0)` edge), `color: 0x000000`, `transparent: true`, `opacity: 0.5`, `depthWrite: false`, `position.y = 0.02` (just above underplane, below tiles) | Cheap fake contact-shadow so the playfield doesn't float over the warm-pine background. See spec §D for the `makeRadialAlpha()` helper. | S |
  | `index.html` — CSS `#grounding` behind canvas | (none) | `z-index: -1, pointer-events: none`. Three radial-gradient layers + base: `radial-gradient(120% 90% at 18% 8%, rgba(232,183,90,0.10), transparent 55%), radial-gradient(120% 100% at 88% 96%, rgba(122,148,96,0.09), transparent 55%), radial-gradient(80% 70% at 50% 46%, rgba(40,66,52,0.55), transparent 72%), #11180f` | Sits behind canvas via `alpha: true` renderer. Gold top-left, sage bottom-right, fern center-fill. See spec §E for exact gradient strings. | S |
  | `index.html` — CSS `#vignette` above canvas | (none) | `z-index: 1, pointer-events: none`; `box-shadow: inset 0 0 320px 80px rgba(5,8,6,0.85)` | Above canvas (z-index 0), below HUD (z-index 10). Tightens the frame edges. See spec §E. | S |
  | `scene.js` — firefly module (new) | (none) | `initFireflies(scene, {count: 14})` + `tickFireflies(dtMs)` from render/update loop. Shader-based additive `THREE.Points` with custom vertex+fragment shader. `uniforms: { uTime: 0, uColor: THREE.Color(0xf4cc6e), uSize: 90 }`. Position: x random `-22..22`, y `0.6..4.6`, z `-14..14`. Per-particle `aSeed` (0..2π). Vertex: y += `mod(uTime*0.35 + aSeed*1.4, 5.0)` for rise+wrap; sway via sin/cos at 0.5/0.4 freq; twinkle `vTw = 0.5 + 0.5*sin(uTime*1.6 + aSeed*3.0)`. Fragment: smooth circle (`discard d > 0.5`), opacity `smoothstep(0.5,0.0,d) * vTw * 0.9`. `transparent: true, depthWrite: false, blending: AdditiveBlending`, `pts.frustumCulled = false`. Color `0xf4cc6e` (matches `--accent-glow`). | `prefers-reduced-motion: reduce` returns BEFORE creating (T13 honored); low-power caps count to 6 via `window.CTD3Renderer?.isLowPower()`. See spec §F for full shader source. | M |
  | `scene.js` — `WARDEN_AURA_COLOR` | `0x6fd0e0` (neon cyan) | `0x8fc6cf` (mistier frost — neon dropped) | Cold cue kept (Warden = freeze), but pulled toward the warmed surround. Same color stays in the inner-fill disc. See spec §G. | S |

- **Acceptance:**
  - chrome-devtools-mcp screenshot of plains gameplay at `prepWave` state → 9-point grid HSL-sample (excluding tower pixel zones) → at least 6 of 9 samples shift warmward (H toward [15°, 50°]) vs baseline. This check moves to Group 2 (rather than the prior 3b) now that fog/AgX values are pinned and not subject to per-evening retuning.
  - `evaluate_script` returns `scene.background.getHex() === 0x1a2a20`.
  - `scene.fog instanceof THREE.Fog` (linear, NOT FogExp2) AND `scene.fog.color.getHex() === 0x1a2a20` AND `scene.fog.near === 26` AND `scene.fog.far === 58`.
  - `renderer.toneMapping === THREE.AgXToneMapping` AND `renderer.toneMappingExposure === 1.06`.
  - `PRESETS.prepWave` + `PRESETS.inWave` hex codes match spec §B verbatim (prepWave sun `0xffd9a0 @ 1.18` + hemi sky `0x9fb6c4` / ground `0x6a5536` @ 0.62; inWave sun `0xffc987 @ 0.95` + hemi sky `0x7d93a0` / ground `0x5e4a30` @ 0.50).
  - DirectionalLight intensity differs by ≥0.20 between prepWave (1.18) and inWave (0.95). HemisphereLight intensity differs by 0.12 (0.62 → 0.50). Screenshot diff between presets shows visible warmth shift.
  - `scene.children.find(c => c.isPoints)` returns the firefly module; count between 8 and 14 inclusive (6 if low-power); zero Points when `prefers-reduced-motion: reduce` (T13 honored before creation).
  - `#grounding` computed style contains all three `radial-gradient(...)` substrings (gold 10%, sage 9%, fern 55%) + `#11180f` base, `z-index: -1`, `pointer-events: none`.
  - `#vignette` computed style contains `inset 0 0 320px 80px rgba(5, 8, 6, 0.85)`, `z-index: 1`.
  - Visual: no hard black seam at field edge (manual check — fog color === bg color).
  - Visual: Mage/Warden cone tops read as dim plum, not neon (manual check — the smoking-gun observation; AgX + sage-grey hemisphere combine for the fix).

---

### Group 3: Per-effect tokenisation pass — placement discs, hover rings, projectiles, range circles, labels

- **Precedence:** Where Group 3 touches files also owned by Group 2 (scene.js bg/fog/ground/AO/Warden, lighting.js presets, renderer.js tone-map, fireflies), **Group 2 values WIN**. Group 3 is only the per-effect tokenisation pass for the literals Group 2 does not own. Any row below that overlaps a Group 2 slot is intentionally absent — see "Out of scope for Group 3" at the foot of this section.

- **Why this leverage:** With the atmospheric reframe (Group 2) warming the surround, this group tokenizes the per-effect color literals (placement discs, hover rings, projectiles, range circles, labels) so they participate in the cabin palette rather than defaulting to legacy gold/kelly/neon hexes.

- **Findings addressed:**
  - "Empty-slot 'place here' disc is vivid neon-green (0x6aff5a)"
  - "Hover-preview ring for aura towers is cool-blue (0x9bb0d4)"
  - "Range-circle decal uses legacy gold (0xc8943e)"
  - "Projectile color literals are not tokenized"
  - "Tile-debug origin marker is hot-pink (0xff0066)"
  - "Label-texture background and gold text use legacy hex literals"

- **Out of scope for Group 3 (owned by Group 2):** scene.background, scene.fog, base ground plane colour + AO disc, lighting.js PRESETS, renderer.toneMapping, the firefly module, and WARDEN_AURA_COLOR. If you find yourself editing any of those lines while doing Group 3, stop and check the Group 2 table.

- **Concrete changes:**

  | File:line | Current | Proposed | Token | Effort |
  |---|---|---|---|---|
  | `games/castle-tower-defense/scene.js` (top) | (literals scattered) | Add `TOKENS` constant block: `BG_DEEP=0x0d1410, BG_MAIN=0x152821, BG_SURFACE=0x1f3329, ACCENT_GOLD=0xe8b75a, ACCENT_GLOW=0xf4cc6e, ACCENT_EMBER=0xa06828, TERRACOTTA=0xb05a3a, SAGE=0x7a9460, MOSS=0x4a6a4e, FOG=0x6e8a7a, BARK=0x3a2a1c, TEXT_PRIMARY=0xf0e6d3, WARDEN_AURA=0x8fc6cf` — names match canon. `WARDEN_AURA` is set here so call sites can reference `TOKENS.WARDEN_AURA`; the underlying constant `WARDEN_AURA_COLOR` is still Group 2 owned. | TOKENS | S |
  | `scene.js` — scene.background / scene.fog | — | **Group 2 owned (spec §C). Do NOT re-touch in Group 3.** | — | — |
  | `scene.js` — base ground plane / AO disc / 0x6a8447 fallback | — | **Group 2 owned (spec §D). Do NOT re-touch in Group 3. Tile-debug fallback (`paintTileDebug`) is handled below.** | — | — |
  | `scene.js:777` | `paintTileDebug` uses `0x6a8447` | `TOKENS.BG_SURFACE` `0x1f3329` (debug-only path, distinct from the base ground plane Group 2 owns) | --bg-surface | S |
  | `lighting.js` PRESETS | — | **Group 2 owned (spec §B). Group 3 does NOT modify lighting.js.** | — | — |
  | `renderer.js` tone-map / output colorspace | — | **Group 2 owned (spec §A). Group 3 does NOT modify renderer.js.** | — | — |
  | Firefly module | — | **Group 2 owned (spec §F). Group 3 does NOT add a second mote system.** | — | — |
  | `scene.js:690` | Empty-slot disc `0x6aff5a` neon | **`TOKENS.ACCENT_GLOW` `0xf4cc6e`** at opacity 0.35-0.55 (reconciled with Deliberate Decision B — Decision B says glow, not gold; the disc is ambient affordance, the hover-active is gold) | --accent-glow | S |
  | `scene.js:702` (aura branch) | Aura-tower hover ring `0x9bb0d4` cool periwinkle | `TOKENS.WARDEN_AURA` `0x8fc6cf` (matches Warden gameplay color per Group 5; `WARDEN_AURA_COLOR` itself is Group 2 owned, this site just reuses the constant via TOKENS) | --warden-aura | S |
  | `scene.js:702` (projectile branch) | Projectile-tower hover ring `0xa06828` literal | `TOKENS.ACCENT_EMBER` | --accent-ember | S |
  | `scene.js:674,687` | Range/empty-slab rings `0xc8943e` legacy gold | `TOKENS.ACCENT_GOLD` `0xe8b75a` | --accent-gold | S |
  | `scene.js:12` | `MUZZLE_FLASH_EMISSIVE_HEX = 0xc8943e` | `TOKENS.ACCENT_GOLD` `0xe8b75a` | --accent-gold | S |
  | `scene.js:545-547` | Projectile literals `0x1a1410 / 0xc8943e / 0xe8d5a8` | **`TOKENS.BARK` `0x3a2a1c`** (use canonical `--bark` rather than introducing a new `BARK_DARK` token — keeps canon and TOKENS byte-equivalent on names) / `TOKENS.ACCENT_GOLD` / `TOKENS.TEXT_PRIMARY` `0xf0e6d3` | tokenized | S |
  | `scene.js:578` | Splash literal `0xa06828` | `TOKENS.ACCENT_EMBER` | --accent-ember | S |
  | `scene.js:266,277` | Slab `0xd4c498` / rim `0x6a5a40` one-offs | Slab `0xd8c8b0` (paper-warm shade), rim `0x6a4a28` (ember-shadow). Note: these are intentional one-offs in the paper/ember family — no canon token, so they stay literal but are flagged in commit message | paper/ember family | S |
  | `scene.js:815` | Tile-debug origin `0xff0066` hot-pink | `TOKENS.TERRACOTTA` `0xb05a3a` | --terracotta | S |
  | `scene.js:832-836` | Label canvas `rgba(20,15,10,0.85)` / `#c8943e` | `rgba(13,20,16,0.88)` / `#e8b75a` | --bg-deep/--accent-gold | S |
  | cabin-bg behind 3D canvas | (not present) | **DEFERRED pending design-mockup feedback.** One verifier argues this should not ship at all (3D canvas is its own environment; cabin painting is the chrome's hero, not gameplay's wallpaper). The other verifier proposed cover-sized blur-24 at opacity 0.08. Decide once title-screen treatment (Group 4b) lands. | hero artwork | — |

- **Acceptance:**
  - All per-effect literal swaps above land without re-touching any Group 2 slot (scene.background / scene.fog / ground plane / lighting PRESETS / renderer.toneMapping / firefly module / WARDEN_AURA_COLOR).
  - Fog + bg checks live in Group 2 acceptance (linear `THREE.Fog`, near 26, far 58, color `0x1a2a20`). Group 3 verification confirms these are unchanged from Group 2's commit.
  - Placement preview with palette tower selected: sampled disc pixels resolve to a warm hue (H ∈ [25°, 50°]) — gold/glow range, never green or cyan.
  - DirectionalLight intensity differs by ≥0.20 between prepWave (1.18) and inWave (0.95) — same delta Group 2 acceptance enforces; if this check fails at Group 3 it means a Group 3 commit silently re-touched lighting.js, which is the precedence violation we are guarding against.
  - `grep -n '0x6a8447\|0x6aff5a\|0x9bb0d4\|0xff0066\|0xb0d4f1' scene.js lighting.js` returns zero matches.
  - `grep -n 'FogExp2\|0\\.018' scene.js` returns zero matches — these were earlier-draft placeholders for the fog system; Group 2 ships linear `THREE.Fog(0x1a2a20, 26, 58)` instead.
  - `prefers-reduced-motion: reduce` browser emulation leaves the Group 2 firefly module static (zero Points); Group 3 introduces no second motion system to also gate.

---

### Group 4: CTD3 chrome alignment — title, map-select, HUD, modals

- **Commit split:** **4a** = tokens + radii + SMALLCAPS pass (pure CSS). **4b** = hero artwork on title + map-select + motes layer. **4c** = interaction polish (hover-lift, danger styling, tab aria, sticky underlines, gold-discipline pruning).
- **Radii reference rule:** After Group 1 defines `--radius-sm/md/lg`, **all** radius declarations in Group 4 reference tokens (`var(--radius-md)`, `var(--radius-lg)`, `var(--radius-sm)`). No literal px values for radii in Group 4 patches.

- **Findings addressed:**
  - "Forest cabin hero artwork never used on title screen"
  - "Title wordmark line-breaks with mixed-weight three-CTA row"
  - "Eyebrow + h1 break the SMALLCAPS pattern range"
  - "Card borders are translucent-gold rgba instead of 1px solid ember"
  - "No hover lift or focus emphasis on tower-cards / sheet picks / btns"
  - "Map-select tabs lack visible active-state distinction"
  - "Locked-card + star ambiguity not styleable from chrome alone"
  - "Pause modal Restart shares visual weight with Resume; Pause CARD itself uses var(--aged-gold) border — competes with Resume CTA"
  - "2× fast-forward button is unlabeled mystery box"
  - "Bottom HUD palette + Send wave force huge mouse travel"
  - "Top HUD lacks SMALLCAPS labels and ember dividers"
  - "Gold/lives flash always uses terracotta — no positive feedback"
  - "Help modal panel + headers use ad-hoc rgba instead of tokens + gradient underline"
  - "Pause modal divider uses solid warm-stone hr"
  - "Border-radius values off the 3/6/8 notched-log scale"
  - "Return link 'GAMES' tracks above SMALLCAPS ceiling"
  - "Tutorial popup lacks eyebrow framing + display headline"
  - "Wave-clear flourish under-used — no place/upgrade celebration"
  - "Slot-pick sheet hardcoded 4 columns truncates on narrow phones"
  - "Sheet picks lack ember-border-to-gold-on-hover treatment"
  - "First-load notice radii + dismiss button border off-scale"
  - "Dev-only test overlay uses cyan but isn't scope-exempt-flagged"
  - "Map-select lacks cabin atmosphere; level cards have no ember borders"
  - "Gold accent overused across HUD/tray — breaks finite-resource discipline"
  - "Title and hero pages skip the optional drifting-motes ambient layer"
  - "Header underline pattern missing from title/map-select/help-modal"
  - "Help-modal and pause-card use flat bark-brown surface, not canonical card gradient"

- **Concrete changes (selected — see prior draft for full table; below are the deltas the verifiers required):**

  | File:line | Current | Proposed | Token | Effort |
  |---|---|---|---|---|
  | `index.html:549-561` (title) | Centered text card over bare canvas | Add hero layer above canvas while `data-screen='title'`: `<img src='/assets/forest-house-landscape.png' class='hero-art' alt=''>` cover-sized + linear-gradient overlay `(180deg, rgba(13,20,16,0.55) 0%, transparent 15%, transparent 78%, rgba(13,20,16,0.80) 100%)` | hero artwork | M |
  | `index.html:259-267` (title h1) | h1 line-breaks awkwardly | Force break OR `max-width:8ch` | — | S |
  | `index.html:555-559` (title CTAs) | 3 mixed-weight buttons | One primary "Begin the Watch" (gold). Demote "How to Play" to ghost link; move "Map Editor" behind cog | gold discipline | S |
  | `index.html:252-267` | `.eyebrow letter-spacing:0.22em`, h1 `WONK 1`, `.loading-status 0.15em` | `.eyebrow: 0.10em` weight 600 color `var(--accent-gold)`; remove `WONK` (keep `SOFT`); `.loading-status: 0.10em` | SMALLCAPS pattern | S |
  | `index.html:67-77` (return-link) | `letter-spacing:0.16em` | `letter-spacing: 0.10em`, `color: var(--text-muted)`, hover `var(--accent-gold)` | --text-muted | S |
  | `index.html` (card borders — sweep file for the rgba pattern, replace each match) | `border: rgba(200,148,62, 0.25-0.5)` translucent | `border: 1px solid var(--accent-ember)` everywhere; hover `var(--accent-gold)` + `translateY(-4px)` lift. Commit message must list every line modified | --accent-ember | M |
  | `index.html` (hover lift) | Cards transition border-color only | Add hover `translateY(-4px)`; `.btn:hover translateY(-2px)`. Note: hover-lift is preserved under reduced-motion (see Group 6) — only animated transitions are neutered | hover lift | S |
  | `index.html:570-574` (map-select tabs) | Plain `.btn`, no active distinction | `role='tablist'` + `role='tab'` + `aria-selected`. `.btn[aria-selected='true']` solid `var(--accent-gold)`. Fraunces uppercase 0.10em weight 600 | SMALLCAPS / tab pattern | S |
  | `index.html:575` (map cards) | `mapGrid` hydrated, no styles | Define `.map-card`: `1px solid var(--accent-ember)` border, gold-on-hover lift; `.map-card.locked` overlay lock SVG + 35% opacity; stars use filled `var(--accent-gold)` + outlined ember pips (not literal `★★☆`) | map-card system | M |
  | `index.html:632-637` (pause modal) | Restart same weight as Resume **AND** card border uses `var(--aged-gold)` (competing solid-gold surface with Resume CTA) | (1) Add `.btn.danger`: transparent bg + `var(--terracotta)` border/text. Apply to Restart + Quit. Resume retains sole gold. **(2) Demote pause-card border from `var(--aged-gold)` to `1px solid var(--accent-ember)` so Resume stays the only gold surface on the pause screen.** | --terracotta / --accent-ember | S |
  | `index.html:638` (pause divider) | Solid `<hr>` | `<div style='background:linear-gradient(90deg,transparent,var(--accent-ember),transparent);height:1px;'>` | --accent-ember gradient | S |
  | `index.html:602` (2× button) | `2×` unlabeled | `▶▶ 2× speed` label + `aria-label='Toggle fast-forward (currently {state})'`; toggle `.active` class. Move to top HUD next to wave counter | speed control | S |
  | `index.html:598-604` (HUD bottom) | Palette flex:1, ctrl-stack right | Wrap palette + ctrl-stack in centered `max-width: 680px` strip | — | M |
  | `index.html:584-597` (HUD top) | Inline 0.15em spans, no dividers | `.hud-label` class: weight 600, 0.10em, `var(--text-muted)`. 1px `var(--accent-ember)` vertical dividers between stat / wave / stat. "of N" in `var(--text-faint)` | SMALLCAPS + ember dividers | S |
  | `index.html:369-370` (stat flash) | `.stat.flash` always terracotta | Add `.stat.flash-good` tinting to `var(--sage)` for gold gain; ui.js dispatches `flash-good` on gain | --sage | S |
  | `index.html:117-170` (help modal) | `rgba(40,28,18,0.97)`; h3 border-bottom solid | Surface `linear-gradient(180deg, rgba(40,40,44,0.88), rgba(30,30,33,0.94))`. h3 border-bottom → `linear-gradient(90deg,transparent,var(--accent-ember),transparent)` at 30% | gradient underline | S |
  | `index.html` (header underlines) | Missing on title h1 / map-select h1 / sheet h3 | Add `::after { ... background: linear-gradient(90deg,transparent,var(--accent-ember),transparent); opacity: 0.3; }` | --accent-ember gradient | S |
  | `index.html` (radii everywhere — token-referenced) | Mix of 4/5/10px literals | Snap to scale and **reference tokens, not literals**: `.btn / .ctrl-btn / tower-card / legend-card / sheet .pick → var(--radius-md)`; `.help-modal / pause / game-over / tutorial / restart panels → var(--radius-lg)`; pip/tags → `var(--radius-sm)`. **No `border-radius: 6px` literal in Group 4 patches.** | tokens | S |
  | `index.html:316-345` (first-load) | Panel 6px, dismiss 3px | Panel → `var(--radius-lg)`; dismiss → `var(--radius-md)` + `1px solid var(--accent-ember)` | --accent-ember | S |
  | `index.html:678-688` (tutorial popup) | Single `<p>` no eyebrow | Add eyebrow span "THE WATCH BEGINS" smallcaps gold; split copy into two short paragraphs; `<strong>` colored `var(--accent-gold)` | eyebrow pattern | S |
  | `index.html:490-505` (wave-clear) | One flourish only | Add `@keyframes` tower-place (radial ember pulse 400ms) and upgrade-success (gold ring expand 500ms). Existing `body.reduced-motion` silences | --accent-ember/--accent-gold | M |
  | **`index.html:478` (sheet picks)** | No defined border/hover | **`.sheet .pick { border: 1px solid var(--accent-ember); transition: border-color 0.2s, transform 0.2s; } .sheet .pick:hover { border-color: var(--accent-gold); transform: translateY(-4px); }`** — sheet picks were slipping through the ember-border discipline pass | --accent-ember/gold | S |
  | `index.html:470-488` (sheet grid) | `grid-template-columns:repeat(4,1fr)` truncates ≤360px | `repeat(auto-fit, minmax(110px, 1fr))`; min-height 76 → 96px | — | S |
  | `index.html:517-526` (test overlay) | Cyan #9fe on black, no exemption note | Add comment: `/* Dev-overlay — exempt from cabin brand scope; cyan deliberate for dev contrast */` | exemption note | S |
  | `index.html` (title + map-select hero pages) | No motes | Add `.motes` overlay (6 spans, 14-21s staggered drift, 3-5px circle, `var(--accent-glow)` bg + `0 0 8px rgba(232,183,90,0.45)` box-shadow, pointer-events none). Honor `prefers-reduced-motion` | --accent-glow | S |
  | `index.html:280-308` (gold finite-resource) | 10+ gold surfaces per screen | Demote secondaries to `1px solid var(--accent-ember)` (ember → gold on hover). Solid gold reserved for one CTA per screen. Inactive `ctrl-btn` → ember border. Scrollbar thumb → `--accent-ember`. Stat labels → `--text-muted`, values → `--text-heading` | gold discipline | M |

- **Acceptance:**
  - chrome-devtools-mcp screenshot of title screen shows forest-cabin artwork at hero scale behind the title card; mote layer animates (or sits static under reduced-motion emulation).
  - Title screen has exactly one `--accent-gold` solid-fill CTA ("Begin the Watch"); "How to Play" is a ghost link.
  - **Gold-discipline check (revised — matches canon's "≈5 gold surfaces per view" ceiling rather than the over-strict "≤1"):** `evaluate_script` counts computed-color matches across visible elements per screen. **Exactly one solid-fill `var(--accent-gold)` background per screen (the primary CTA); total gold surfaces (outline + text + active-nav + brand mark + active state) ≤ 5 per screen, verified by counting any computed color in {`rgb(232, 183, 90)`, `rgb(244, 204, 110)`}.**
  - Map-select tab clicked → `aria-selected='true'` set, background resolves to `rgb(232, 183, 90)`.
  - Hovering a tower-card translates Y by exactly -4px (sample via `getBoundingClientRect()` before/after). Same for sheet picks (new in this revision).
  - Pause modal: Restart and Quit have terracotta-bordered danger styling; Resume is the only gold CTA; pause-card border is `var(--accent-ember)`, not `var(--aged-gold)`.
  - `grep -n 'border-radius: *[0-9]\+px' index.html` returns zero matches inside Group 4 changes (all radii are `var(--radius-*)` token refs).
  - All `<h1>`, `<h2>`, `<h3>` on title / map-select / modals have a gradient `::after` underline.
  - `list_console_messages types:['error']` returns empty on title, map-select, play, pause, help, game-over, restart screens.

---

### Group 5: Warden cyan aura — codify the exception

- **Why this leverage:** Ratifies a deliberate decision so future audits stop re-flagging it.
- **Findings addressed:**
  - "Warden aura cyan is the only cool-blue in the scene — needs deliberate ADR decision"

- **Concrete changes:**

  | File:line | Current | Proposed | Token | Effort |
  |---|---|---|---|---|
  | `scene.js:20` | `const WARDEN_AURA_COLOR = 0x6fd0e0;` no comment | The constant itself is **Group 2 owned** — Group 2 ships the value swap to `0x8fc6cf` per spec §G. Group 5's contribution is the block comment ratifying the exception (see **Deliberate Decisions § A** below) and the reuse via `TOKENS.WARDEN_AURA` (set in Group 3's TOKENS block). | --warden-aura | S |
  | `scene.js:702, ring decal site` | (handled in Group 3 — reuse `TOKENS.WARDEN_AURA`) | — | --warden-aura | — |

- **Acceptance:**
  - `grep -n 'WARDEN_AURA\|0x8fc6cf' scene.js` returns the constant + comment + one reuse at line 702 + one reuse at the ring decal. No other cyan literals in the codebase.
  - `grep -n '0x6fd0e0' scene.js` returns zero matches (the pre-Group-2 neon literal is fully replaced).
  - This ADR's "Deliberate Decisions" section is referenced from the inline comment.

---

### Group 6: Prior-audit TIER 2 — accessibility + gameplay-state UX (T8-T18)

- **Why this leverage:** Six-month-old known gaps. Bundling avoids a third visit.
- **Findings addressed (rescoped to drop already-shipped items the verifier flagged):**
  - T8 — Only selectTower plays ui_click; sheet/pause/sell/upgrade/map-select silent
  - T9 — Unaffordable placement silent for SR users
  - T10 — iPhone notch/home-indicator clipping; no safe-area-inset
  - T11 — Help modal GOT IT scrolls below fold on short viewports
  - T12 — Pause→Restart same weight as Resume, no confirm (visual half landed in Group 4)
  - T13 — `prefers-reduced-motion` only kills wave-clear wipe
  - T14 — Cog reachable via Tab through open modal
  - T15 — Quiet vs Spirited visually identical (handled via Group 4 map-card system)
  - **T16 (rescoped):** Gold (`index.html:587`), Wave (`589`), Lives (`594`) already have `aria-live="polite" aria-atomic="true"`. **Only novel work: promote lives counter to `aria-live="assertive"`.** Gold and wave stay polite.
  - **T17 (rescoped):** Cog (`596` `aria-label="Pause / settings"`), Send Wave (`601`), sheet × (`611`, `618`) already labeled. **Only novel work: 2× fast-forward button at `index.html:602` lacks aria-label; star strings `★★☆` in `ui.js` lack `role='img'` + aria-label; range sliders lack aria-label.**
  - T18 — Phantom "Wave 0 of 0" between startMap and first tick

- **Concrete changes:**

  | File:line | Current | Proposed | Token | Effort |
  |---|---|---|---|---|
  | `game.js` action dispatch | Only `selectTower` → `ui_click` | Add `playUiSound(actionType)` dispatcher: forward/confirm → `ui_click`; cancel/close/sheet-dismiss → `ui_back`. Wire on sheet open/close, pause, sell, upgrade, map-select | — | S |
  | `game.js:288,315,328` (denial paths) | Gold-flash only | Play denial sting + aria-live `'Not enough gold'` on gold counter | — | S |
  | `index.html:529-547, 590-597` (mobile safe areas) | `viewport-fit=cover` but no env() consumers | `.hud-top { padding-top: max(8px, env(safe-area-inset-top)) }`; `.hud-bottom { padding-bottom: max(12px, env(safe-area-inset-bottom)) }` | — | S |
  | `index.html:122` (.help-modal) | Whole modal scrolls as one block | Flex column: body `overflow-y:auto`; sticky footer holding GOT IT with `1px solid var(--accent-ember)` top border on `var(--bg-elevated)` | --bg-elevated | S |
  | `game.js:350-358` (Restart confirm) | One-tap wipes mid-wave | Add confirm overlay with terracotta confirm button | --terracotta | M |
  | `index.html` (global @media) | Only wave-clear-wipe respects reduced-motion | **`@media (prefers-reduced-motion: reduce) { .sheet, .gold-flash, .loading-bar { animation-duration: 0.01ms; } }`. Also kill warden aura pulse + enemy bob in scene.js (skip per-frame sin/cos), and freeze firefly motion to static placement. PRESERVE `.game-card:hover { transform: translateY(-4px) }` and `.btn:hover { transform: translateY(-2px) }` — hover-lift is a brand-signature affordance, expressible without animation; only animated transitions get neutered.** | — | M |
  | `index.html` (screen containers) | No `inert` on inactive screens | `setScreen()` applies `inert` to non-active screen containers; modal open applies `inert` to play-screen | — | S |
  | `index.html:594` (lives counter) | `aria-live="polite"` | Promote to `aria-live="assertive"`. Gold and wave stay polite per rescoped T16 | — | S |
  | `index.html:602` (2× button) | No aria-label | `aria-label='Toggle fast-forward (currently {state})'` | — | S |
  | `ui.js:290,299,318` (star strings) | Literal `★★☆` | `<span role='img' aria-label='2 of 3 stars earned'>★★☆</span>` | — | S |
  | range sliders (music/sfx volume) | No aria-label | `aria-label='Music volume'` / `aria-label='SFX volume'` | — | S |
  | `index.html:535` + `ui.js:230-236` | Phantom "Wave 0 of 0" | Seed `.wave-counter` from `map.waves.length` inside `startMap` before `ui.show`, OR `visibility: hidden` until first tick | — | S |

- **Acceptance:**
  - Lighthouse a11y audit on play screen ≥ 95. (Note: canvas-heavy SPA may fail this — pragmatism verifier flagged it as dubious. If <95, attach an explanation of which Lighthouse subscore failed and confirm semantic HUD passes manual NVDA/VoiceOver test instead.)
  - Tab key with help modal open does not focus the cog.
  - Reduced-motion emulation: Warden aura ring shows static, enemies show static, sheet appears without slide, gold-flash is instant color swap, firefly motes static. **Hover-lift on cards and buttons still works** (transform set instantly, no animation).
  - iPhone 14 emulation: HUD-top fully visible below notch; HUD-bottom not covered by home indicator.
  - Pause → Restart triggers confirm overlay, not immediate restart.
  - Screen-reader test (NVDA or VoiceOver): lives loss announced **assertively** (gold gain still polite); star-row read as "2 of 3 stars earned"; 2× button announces "Toggle fast-forward (currently off/on)".

---

### Group 7: Cartographer editor — status, validation, JSON, accessibility (T20-T25)

- **Why this leverage:** Editor has the most under-designed states and the same brand-drift root cause. Bundle to prevent further accumulation.
- **T21 clarification:** `map-editor.html:81-90` already has `@media (max-width: 1100px)` collapsing the 3-col grid to a single column. The prior audit's "shatters below ~1024px" describes the existing collapse's bad UX, not a missing rule. The fix below distinguishes between the existing collapse and the proposed bottom-sheet shell.

- **Findings addressed:**
  - "Validation error language is dev-speak"
  - "Right rail leads with 'NOT READY' in terracotta-on-dark"
  - "Live JSON dump eats the bottom half of the right rail"
  - "2D authoring canvas color does not match in-game look"
  - "Tool palette badges 1-5 read as quantities, not shortcuts"
  - "Waves PASSTHROUGH textarea is a competence cliff"
  - "Existing 1100px responsive collapse has bad UX (no bottom-sheet shell, no desktop-required banner)" (T21)
  - "Theme dropdown does not change WFC palette in preview" (T24)
  - "3D preview hardcodes plains background regardless of theme" (T25)
  - "Decor Size toggle is invisible-state button" (T23)
  - "Canvas pill stacks blocker + warning issues in raw error voice"
  - "Import textarea + Share/Publish actions buried below preview JSON"
  - "Editor topbar lacks signature brand treatment"
  - "No keyboard-shortcut overlay / discoverability for Ctrl+S, Ctrl+Z, Delete, Esc, 1-5" (T20)

- **Concrete changes:**

  | File:line | Current | Proposed | Token | Effort |
  |---|---|---|---|---|
  | `tools/map-editor.html:1432` (validator) | Dev codes: "segment 1 (-4,4)→(-4,2) is 2u, below H8a 3u floor" | Author voice: "This stretch of path is too short — needs 3 tiles between bends." Keep code in faint span: `<code class='hint-code'>H8a</code>` | --text-faint | M |
  | `tools/map-editor.html:1540` (right rail header) | "NOT READY" bold terracotta as first thing | Reframe as progress checklist. Unchecked → ember muted; checked → sage with ✓. Terracotta reserved for active rule violations only | --sage / --accent-ember | L |
  | `tools/map-editor.html:550` (JSON preview) | Always-on `<pre>` 30-50 line block | Wrap in `<details><summary>View raw JSON ▸</summary>` closed by default | --accent-ember | S |
  | `tools/map-editor.html:47` (canvas color) | Flat `--canvas-plains #6a8447` kelly | Paint `var(--bg-main) #152821` + two radial gradients (gold top-left 3.5%, sage bottom-right 2.5%). Path stroke `var(--accent-ember)` with `var(--bark)` shadow dash. **Theme-keyed palette (plains/forest/mountain) is a Group 7 follow-up beyond this initial canvas re-ground** — see Out of Scope | --bg-main + radials | M |
  | `tools/map-editor.html:428` (tool badges) | `'Path <span class="kbd">1</span>'` reads as count | Move `.kbd` to right with `margin-left:auto`, opacity 0.55. Prefix "KEY". Smallcaps treatment | SMALLCAPS | S |
  | `tools/map-editor.html:510` (Waves JSON) | Raw textarea after polished form | Add SMALLCAPS ember divider "WAVES — RAW JSON (visual editor coming)" + "Validate JSON" button + inline parse-error highlight | header underline + --terracotta | M |
  | `tools/map-editor.html:81-90` (existing 1100px @media) | Single-column collapse exists but quality is poor (no bottom-sheet, no desktop banner) | Above 1100px keep current 3-col. Add 900-1100px breakpoint → narrow 3-col `220px 1fr 280px`. **Below 900px: replace existing single-column collapse with explicit bottom-sheet shell** (sticky topbar + canvas full-bleed + tabbed bottom sheet with Header / Status / Export segments). Below 700px: "Editor needs a desktop" banner with terracotta border | — | XL |
  | `tools/map-editor.html:2095` (theme dropdown) | `rulesForMap({ id })` only branches on id | `rulesForMap({ id, theme })`. `wfc-rules.js` exposes theme-keyed palettes for plains/forest/mountain alongside id-keyed snowfall_pass | — | L |
  | `tools/map-editor.html:2002` (3D preview bg) | `scene.background = 0x6a8447` hardcoded | Read `state.meta.theme` in `ensureScene()`, seed `scene.background` from `THEME_BG[theme]` rebuilt with cabin tones (pine `0x152821` / moss `0x1f3329` / sage-stone `0x2a4234`). Default `0x152821` | --bg-main | S |
  | `tools/map-editor.html:441` (Decor Size) | Single button "Size: normal" no visual state | Two-segment pill `[normal | large]`. Active segment filled `var(--accent-gold)`; inactive ember outline. **Note: this is the editor's sole gold-filled active state — counts toward the screen's gold budget** | --accent-gold | S |
  | `tools/map-editor.html:1580` (canvas pill) | Stacked list of 5 issues at top-center, blocks canvas | Show MOST relevant issue inline at cursor (or as ember marker on offending element). Multi-issue lists move to right-rail checklist. Single-line pill, terracotta, auto-fade 2.5s | --terracotta | M |
  | `tools/map-editor.html:554` (right-rail order) | Save / Share / Publish similar weight; Import buried | Reorder: Status → Wave shape → Action row (Save = gold filled primary, Share + Publish = ember outlined secondary) → Import (`<details>` closed) → JSON preview (`<details>` closed) | gold discipline | M |
  | `tools/map-editor.html:93` (topbar) | `gradient #1a1410 → #0a0a0b`, h1 + dot-separated sub | Gradient bottom-border `linear-gradient(90deg, transparent, var(--accent-ember), transparent)` 30%. Sub styled SMALLCAPS 0.12em weight 600 `var(--text-muted)`. "PHASE A2" → ember-bordered tag | --accent-ember | S |
  | `tools/map-editor.html:971` (shortcut discovery) | No UI for Ctrl+S, Ctrl+Z, Delete, Esc, 1-5 | Add `?` button to topbar opening sheet listing shortcuts. Onboarding pill: "Tip: Ctrl+Z undoes · 1-5 swap tools · Esc deselects" ember, 4s, bottom-right | SMALLCAPS | M |
  | `tools/map-editor.html:879-887` (undo/redo/Ctrl+S/Delete/Esc) | None bound | Snapshot history ring (cap 30) pushed on each `refresh()`. Bind Ctrl+Z / Ctrl+Shift+Z → pop/redo; Ctrl+S → copyJson(); Delete → remove `state.selected`; Esc → clear `state.drag`. Topbar footer strip shows keymap in SMALLCAPS `var(--text-muted)` | SMALLCAPS | L |

- **Acceptance:**
  - Loading a blank editor session: right rail shows "Lay down a path" in ember (not "NOT READY" in terracotta).
  - Triggering H8a violation: pill reads "This stretch of path is too short — needs 3 tiles between bends." with `H8a` code in faint span.
  - Theme dropdown: switching plains → forest produces a visibly different procedural-fill within 150ms; 3D preview background tone differs.
  - JSON preview is collapsed by default; clicking the disclosure expands and rebinds.
  - **Responsive shell, distinguished from existing collapse:** Editor at 1024-1100px → narrow 3-col layout per spec (220px / 1fr / 280px), no overflow. Below 900px → replaces existing single-column collapse with explicit bottom-sheet shell. Below 700px → "Editor needs a desktop" banner with terracotta border.
  - Ctrl+Z restores last `refresh()` state. Delete removes `state.selected`. Esc clears `state.drag`. Ctrl+S triggers `copyJson()` (clipboard verified via `evaluate_script(navigator.clipboard.readText())`).
  - `?` button opens shortcut sheet listing all bindings.

---

## Deliberate Decisions

### A. Warden cyan aura — keep as the one sanctioned cool-blue

**Conflict:** Brand spec says no cool-blues. Warden's gameplay role is freezing/slow — frost reads cold, and cyan is the universal frost color.

**Option A (recommended):** Keep a desaturated cyan, shifted from the prior `0x6fd0e0` to `0x8fc6cf` per CD round-2 recommendation (lower saturation reads closer to the warmed surround without losing frost legibility). Codify as the single sanctioned exception. Add inline comment at `scene.js:20` referencing this ADR. Constrain the exception: aura ring + aura hover preview only. Any other cold-coded effect uses `--fog #6e8a7a` instead.

**Option B (rejected):** Pull to frost-amber `0xb8d4c8` or moonlight `0xd4d4b8`. Stays warm-family but loses instant "this slows enemies" legibility.

**Acknowledgment:** One verifier argued the brand spec's deliberate choice was to NOT inherit genre conventions, and proposed a player legibility test on Option B before locking Option A. For a single-author personal scratchpad project, a formal paper-test gate is overkill; the decision rests on the author's judgment that cyan-frost convention is too deeply trained in the TD genre to retrain players against. If real users later mis-read the aura, this decision is reversible at low cost (single constant swap + retest).

**Decision: Option A.** Cyan stays desaturated at `0x8fc6cf`; never push toward neon `0x00d4ff`. Document at constant site; do not extend to other effects.

**Re-check verdict — 2026-07-23 (ADR-037 C-4): `0x8fc6cf` RATIFIED against the current themed fills. The colour was never the defect; the aura was not rendering at all.**

ADR-037 §3(c) called this re-check because Sprint 2's `a97b78b` gave `rulesForMap()` theme-keyed WFC palettes, changing the ground-fill density and composition the cyan is read against in the game itself. The re-check found the ground had changed in a way the plan did not anticipate: **it got taller.** The kit's ground and path tiles stand 0.2 world units high, but the aura decal was positioned at `y = 0.05` — inside the terrain — so the Warden aura rendered on **no map at all**. Proven by lifting the node to `y = 0.30` in a live session: two rings appeared immediately where nothing had been visible before. This dates to the ADR-030/031 tile renderer, which raised the ground surface and left this one decal behind; `syncDecals` had already been updated for it (the slot ring and place-here disc sit at 0.24/0.25 with a comment naming the 0.22-tall slab), but the persistent aura group had not. A colour ratified in 2026-05 had therefore been unverifiable ever since.

Fixed at the position, not the palette: a named `GROUND_DECAL_Y = 0.24` in `scene.js`. No opacity, pulse, colour, or material constant was touched. 0.24 is not a universal clearance and the constant says so — path *corner* tiles reach 0.296 and clip roughly 2–5 % of a ring's circumference (measured by raycasting the circumference at every build slot on all six maps: plains 1.9 %, forest 1.8 %, tidewater 1.8 %, snowfall 2.1 %, riverbend 2.9 %, mountain 4.6 %). Going higher would clear that lip but would push the aura *above* the slot ring (0.24) and place-here disc (0.25), inverting a layering that currently works. The clip is accepted; taller scenery (hills 0.57, rocks 0.75, trees 0.96+) is meant to occlude a ground decal.

**The same defect had a second instance, and it is also fixed.** Decision A scopes this exception to "aura ring **+ hover preview**". The hover preview — the ring drawn when Warden is palette-selected and a slot is hovered — reads its colour through `TOKENS.WARDEN_AURA`, the *same value under a different identifier*, and called `makeRing` without a `y`, so it inherited the same 0.05 default and was equally invisible. A player selecting Warden therefore got no coverage preview at all before spending 90 g. Both sites now take `GROUND_DECAL_Y`.

**A latent bug this fix promoted, also closed.** `syncWardenAuras` built the ring geometry once, inside `if (!node)`, and an upgrade keeps the same tower id while widening `auraRadius` — so a T3 Warden drew its T1 ring (6.0 against a real 8.0: a quarter short in radius, nearly half in area). Harmless while the aura was buried; the moment it renders it becomes an affordance that lies about coverage. The geometry is now rebuilt when the radius changes (verified: T3 renders 8.0).

With the aura rendering, all six official maps were judged in-browser. Coverage is stated exactly as run — the camera is orthographic and clamped 0.7–1.4, where **0.7 is zoomed OUT and 1.4 is zoomed IN**:

| Map | Palette | Cameras judged | Verdict |
|---|---|---|---|
| plains | standard | 1.0, 1.4 | Clear — pale frost ring, unmistakably non-warm |
| forest | forest (tree-dense) | 0.7, 1.0 | Clear |
| mountain | mountain (hill/rock-heavy, no tree-quad) | 0.7, 1.0 | Clear — the highest occluding-feature density of the six |
| snowfall_pass | snow (`paletteForMap` short-circuits on map id, so its `mountain` theme is inert) | 0.7, 1.0 | **Weakest but legible** — the ring stays continuous and traceable, and its blue separates cleanly from the warm beige |
| tidewater | forest | 0.7 | Clear |
| riverbend | forest | 0.7 | Clear |

Honest coverage note: every *palette* was judged at both a normal and a zoomed-out camera. Two individual maps were not — plains lacks a 0.7 pass, and tidewater/riverbend lack a 1.0 pass; both reuse the forest palette, which was judged at both. Snowfall is the worst case and it passes, so the constant holds on the background that stresses it most.

Two adjacent findings recorded rather than acted on, both outside C-4's charter:
- **`makeRing`'s `y` default is still 0.05**, and its remaining defaulting caller is the *selected-tower range circle* (`syncDecals`). That gold circle is therefore buried and non-functional on every map today — a core affordance, one line to fix, but a different feature from the Warden cyan. Worth its own chunk.
- The Sprint-3 observation is confirmed: snowfall's pale grey path reads with markedly less contrast against its near-white ground than the terracotta paths do against green. A path/ground contrast question, not an aura one.

One allowlist entry above needs its line number refreshed rather than removed: `scene.js:702 (hover ring)` is a real and still-sanctioned site — it has moved to `scene.js:836`.

### B. Empty-slot placement disc — `--accent-glow` (not `--accent-sage`, not `--accent-gold` solid)

**Conflict:** Empty-slot placement disc currently `0x6aff5a` is banned (neon). Sage `0x7a9460` carries growth/success semantics that would compete with future state cues. Gold solid is the active CTA fill — overusing it as ambient affordance breaks finite-resource discipline.

**Option A (decision):** Use `--accent-glow` `#f4cc6e` at low opacity (0.35-0.55) for the ambient empty-slot disc. The actively-hovered slot ring uses solid `--accent-gold`. This keeps the "gold = lit window, sparingly" rule by reserving solid gold for the hover-active state, while still using a gold-family hue for the ambient affordance.

**Option B (rejected):** Sage. Visually competes with future success/growth states (post-wave bonus, build complete) and dilutes the sage token's meaning.

**Decision: Option A.** Group 3 table reflects this (disc → `TOKENS.ACCENT_GLOW`, not `ACCENT_GOLD`).

### C. Tower + landscape appearance — kit-immutable

**Conflict:** The Cabin-in-the-Woods palette excludes purple/violet/cool-blues. The Kenney/KayKit GLBs in use (towers, landscape tiles, decorations) ship with purple Mage/Warden cones, kelly-green grass, etc. — they violate the rule by construction.

**Option A (rejected):** Asset re-author in Blender. Cost: forks the kit, breaks future kit upgrades, requires per-asset retouching.

**Option B (rejected):** Post-load material retint (HSL clamp on kit meshes). Cost: brittle (kit upgrades break the heuristic), opaque (the rendered color and the GLB color disagree), and still changes the towers' appearance — the user has explicitly declined this.

**Option C (DECISION):** Kit-immutable. Tower and landscape appearance stays exactly as the kits ship. Brand cohesion is achieved through the surround: `scene.background` + `scene.fog` + lights + tone mapping + fireflies + CSS overlay, all code-side. The towers' purple cones remain visible; the warmed environment makes them read as deliberate fantasy-tower lighting rather than off-brand neon.

**Reversal trigger:** If the warmed-surround approach lands and an adversarial brand review STILL judges gameplay off-brand, escalate by: (a) asking the user to relax the asset constraint for a single retint experiment, or (b) commissioning a single-asset re-author of the most off-brand tower (likely Mage) as a delta we can A/B.

---

## Out of Scope

- **Implementation.** This ADR is the plan; tickets/commits implement.
- **Specific UI mockups.** Claude Design is producing visual mocks in parallel.
- **Wave-wiring for Juggernaut/Slime/MiniSlime/Ghost.**
- **Mobile-first redesign.** T10 (safe-area-inset) and T21 (editor responsive collapse/bottom-sheet) are in scope. A ground-up mobile-first rebuild is its own ADR.
- **Audio palette breadth.**
- **Map-editor visual wave builder.**
- **Lookout / Music / Shopping nav surfaces.**
- **Theme-keyed editor canvas palette** (plains/forest/mountain palette inversion in 2D canvas — Group 7 ships theme-keyed *3D preview background* and *WFC rule palette* but the 2D author canvas re-grounds to `--bg-main` uniformly. Per-theme 2D palette is a follow-up.)
- **`cabin-bg` blur layer behind 3D gameplay canvas.** Deferred pending design-mockup feedback; one verifier argued the painting is a chrome-hero and should not appear behind gameplay at all. Decide once Group 4b title-screen hero treatment lands.
- **Editing tower GLBs (`tower_*_t*.glb`).** Kenney/KayKit assets are immutable per Decision C.
- **Editing landscape GLBs (`tile_*.glb`, `detail_*.glb`).** Same — Kenney/KayKit immutable per Decision C.
- **Editing enemy GLBs (`enemy_*.glb`).** Kenney + Hyper3D Rodin assets are immutable.
- **Post-load material retinting** (HSL clamps or any per-mesh color override on kit meshes) — per Decision C, this is also out of scope. We change the surround, not the towers.

---

## Files Affected (Summary)

| File | Type of change | Effort | Fix Groups |
|---|---|---|---|
| `styles.css` | Token rewrite — full cabin ladder + correct text values | S | 1 |
| `games/castle-tower-defense/index.html` | Token bridge + chrome restyle + a11y + safe-area + radii (token-referenced) + hero artwork + motes + danger button + flash-good + sticky footer + reduced-motion (preserving hover-lift) + inert + aria-* (rescoped per audit) + `#grounding` behind-canvas radial-gradient stack (Group 2; spec §E) + `#vignette` above-canvas inset shadow (Group 2; spec §E) | L | 1, 2, 4, 6 |
| `games/castle-tower-defense/scene.js` | **Group 2 owns:** `scene.background = 0x1a2a20` warm pine + linear `Fog(0x1a2a20, 26, 58)` (spec §C) + base ground retint `0x3c5a38` + radial AO disc (spec §D) + shader-based firefly module `initFireflies`/`tickFireflies` count=14 (cap 6 low-power, skip on reduced-motion) (spec §F) + `WARDEN_AURA_COLOR = 0x8fc6cf` mistier frost (spec §G). **Group 3 adds (no overlap with Group 2):** `TOKENS` constant block + hover-ring + range-ring + projectile (BARK not BARK_DARK) + splash + slab + tile-debug + label-texture per-effect literal swaps. **Group 5 adds:** Warden exception block comment. **Group 6 adds:** reduced-motion guards on aura pulse + enemy bob (firefly motion gating is already Group 2 owned). | L | 2, 3, 5, 6 |
| `games/castle-tower-defense/lighting.js` | **Group 2 owned, full stop.** `PRESETS.prepWave` sun `0xffd9a0 @ 1.18` + hemi sky `0x9fb6c4` sage-grey / ground `0x6a5536` @ 0.62; `PRESETS.inWave` sun `0xffc987 @ 0.95` + hemi sky `0x7d93a0` / ground `0x5e4a30` @ 0.50 (spec §B — revives the dead tween). **Group 3 does NOT modify lighting.js — all preset values are Group 2 owned.** | S | 2 |
| `games/castle-tower-defense/renderer.js` | **Group 2 owned, full stop.** `AgXToneMapping` @ exposure 1.06, `outputColorSpace: SRGBColorSpace` pinned, `alpha: true` preserved (spec §A). Group 3 does NOT modify renderer.js. | S | 2 |
| `games/castle-tower-defense/game.js` | playUiSound dispatcher + denial sting + restart confirm intercept | M | 6 |
| `games/castle-tower-defense/ui.js` | aria-selected on tabs + flash-good dispatch + star aria-label wrap + wave-counter seed + inert toggle on setScreen + map-card system render | M | 4, 6 |
| `games/castle-tower-defense/tools/map-editor.html` | Token bridge + canvas re-ground + validator rewrite + right-rail checklist + JSON `<details>` + Waves divider + responsive shell (above existing 1100px collapse) + theme→WFC wire + 3D preview theme bg + Decor Size pill + canvas pill simplification + action reorder + topbar treatment + shortcut overlay + history ring | XL | 1, 7 |
| `games/castle-tower-defense/wfc-rules.js` | Theme-keyed palettes for plains / forest / mountain | M | 7 |
| `tower_*_t*.glb` / `tile_*.glb` / `detail_*.glb` / `enemy_*.glb` | **DO NOT EDIT.** Kit assets are immutable per ADR-034 Decision C. | — | — |
| `docs/adr/034-ctd3-ui-ux-remediation-v2.md` | This ADR | — | all |

---

## Verification Plan

**Per group:**

- **Group 1 (tokens):** Token-name audit confirms every styles.css addition matches canon byte-for-byte. Allowlist grep returns only sanctioned literals. `getComputedStyle` on every CTD3 screen returns cabin ladder. `--text-muted` resolves to `rgb(154, 168, 154)` not `rgb(154, 142, 122)`. Homepage screenshot diff: zero visible regression.

- **Group 2 (atmospheric core — owns all of spec §A–G):** `evaluate_script` returns `scene.background.getHex() === 0x1a2a20` AND `scene.fog instanceof THREE.Fog` (linear, NOT FogExp2) AND `scene.fog.color.getHex() === 0x1a2a20` AND `scene.fog.near === 26` AND `scene.fog.far === 58` (fog color === bg color, no seam). `renderer.toneMapping === THREE.AgXToneMapping` AND `renderer.toneMappingExposure === 1.06`. `PRESETS.prepWave` + `PRESETS.inWave` hex codes match spec §B verbatim (prepWave sun `0xffd9a0 @ 1.18` + hemi sky `0x9fb6c4` / ground `0x6a5536` @ 0.62; inWave sun `0xffc987 @ 0.95` + hemi sky `0x7d93a0` / ground `0x5e4a30` @ 0.50). DirectionalLight intensity differs by ≥0.20 between prepWave and inWave (1.18 → 0.95); HemisphereLight intensity differs by 0.12 (0.62 → 0.50). `scene.children.find(c => c.isPoints)` returns the firefly module; count between 8 and 14 (6 if low-power); zero Points when `prefers-reduced-motion: reduce` (T13 honored before creation). `#grounding` computed style contains all three `radial-gradient(...)` substrings (gold 10%, sage 9%, fern 55%) + `#11180f` base, `z-index: -1`, `pointer-events: none`. `#vignette` computed style contains `inset 0 0 320px 80px rgba(5, 8, 6, 0.85)`, `z-index: 1`. **Pixel-sample warmward-shift check (moved into Group 2):** 9-point grid sample of gameplay canvas (excluding tower-pixel zones); ≥6 of 9 samples shift warmward (H toward [15°, 50°]) vs baseline. Atmospheric layering, not flat fill — pure `rgb(31, 51, 41)` flat fill across ≥6 samples FAILS.

- **Group 3 (per-effect tokenisation):** Fog + bg checks live in Group 2 acceptance (linear `THREE.Fog`, near 26, far 58, color `0x1a2a20`); Group 3 verification confirms these are unchanged from Group 2's commit. Placement disc HSL is warm (H ∈ [25°, 50°]). DirectionalLight intensity delta ≥0.20 still holds — if this fails, Group 3 silently re-touched lighting.js, which is the precedence violation we guard against. `grep -n '0x6a8447\|0x6aff5a\|0x9bb0d4\|0xff0066\|0xb0d4f1' scene.js lighting.js` returns zero matches. `grep -n 'FogExp2\|0\\.018' scene.js` returns zero matches (these were earlier-draft placeholders for the fog system; Group 2 ships linear `THREE.Fog` instead). Reduced-motion: Group 2's firefly module is already static; Group 3 adds no second motion system.

- **Group 4 (chrome alignment):** Lighthouse a11y on title/map-select ≥ 95 (play screen may fail due to canvas — falls back to manual NVDA pass if so). Title screenshot shows hero artwork. **Gold-discipline: exactly 1 solid-fill `--accent-gold` per screen; ≤5 total gold surfaces per screen** (revised from earlier ≤1). Hover-lift -4px before/after `getBoundingClientRect`. All `<h1>/<h2>/<h3>` have gradient `::after`. `grep -n 'border-radius: *[0-9]\+px' index.html` returns zero matches in Group 4 patches. Sheet picks lift on hover; border shifts ember→gold.

- **Group 5 (Warden exception):** `grep -n '0x8fc6cf' scene.js` returns constant + comment + ring + hover-preview only. `grep -n '0x6fd0e0' scene.js` returns zero matches.

- **Group 6 (TIER 2 a11y):** Lighthouse a11y ≥ 95 (with the canvas-SPA caveat). Manual NVDA/VoiceOver pass: lives announced *assertively* (gold/wave still polite per rescoping). Star row reads as count. iPhone emulation: notch + home indicator unblocked. Tab with help modal open does not focus cog. Reduced-motion: aura/bob/sheet/flash static, firefly motes static (already Group 2 owned), **hover-lift preserved**. Pause→Restart triggers confirm.

- **Group 7 (editor):** Right rail shows progress checklist not "NOT READY". Validator emits author-voice. Theme dropdown changes WFC palette within 150ms. **Editor at 1024-1100px renders narrow 3-col; below 900px replaces existing single-column collapse with bottom-sheet shell; below 700px shows desktop-required banner.** Ctrl+Z / Delete / Esc / Ctrl+S all functional.

**Cross-cutting:**

- `list_console_messages types:['error']` empty on every CTD3 screen post-change.
- `list_network_requests` shows no 4xx/5xx.
- Design-system contrast: `--text-primary on --bg-main` ≥ 4.5:1, `--text-heading on --bg-elevated` ≥ 4.5:1, `--accent-gold on --bg-deep` ≥ 3:1.
- Single browser-test pass per Group via `browser-test-mcp` skill.

---

## Follow-ups (Not In This ADR)

- Wave-wiring for Juggernaut / Slime / MiniSlime / Ghost.
- Mobile-first editor redesign (T21 root cause beyond responsive collapse).
- Audio palette breadth.
- Sound feedback curation across state changes.
- Visual wave-builder UI for editor (repeater pattern replacing JSON textarea).
- Per-tower-tier silhouette differentiation audit — confirm T1/T2/T3 read distinct mid-wave under the warmed-surround lighting (kit silhouettes unchanged; only ambient lighting may shift readability).
- Drifting-motes (firefly) performance budget verification on low-power Chromebooks.
- Theme-keyed editor 2D author canvas palette (Group 7 lands 3D preview theme bg + WFC theme palette; 2D canvas re-grounds uniformly to `--bg-main`).
- `cabin-bg` blur layer behind 3D gameplay canvas — decide once Group 4b title-screen hero treatment lands.
- Warden cyan reversibility: if real users mis-read the aura as healing/buff (per the deferred Option B paper-test argument), swap to `--fog` or frost-amber and retest.
- **Claude Design round 3 atmospheric spec** is now [docs/design/ctd3-atmospheric-grounding-three-js.md](../design/ctd3-atmospheric-grounding-three-js.md). Group 2 table is synthesised from §A–G of that document. If implementation tuning reveals a delta (e.g., AgX feels flat → switch to ACES at 0.92), update both files in lockstep and log a v2.1 addendum.
