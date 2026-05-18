# Spec — CTD3 UX audit TIER 2/3 remediation

**Spec path:** `docs/audits/2026-05-18-ctd3-ux-remediation.spec.md`
**Source audit:** `docs/audits/2026-05-18-ctd3-ux-audit.md`
**Branch:** `refactor/castle-tower-defense-3d`
**Predecessor commit:** `2c63dbc` (TIER 1 shipped)

This spec defines 8 sequenced commits closing 17 of the 18 outstanding audit items. T24 is excluded (see §1 manifest note).

---

## 1. File manifest

| Commit | Files | Action |
|---|---|---|
| C1 | `games/castle-tower-defense/index.html` | modify |
| C1 | `games/castle-tower-defense/ui.js` | modify |
| C1 | `games/castle-tower-defense/scene.js` | modify |
| C2 | `games/castle-tower-defense/audio.js` | modify |
| C2 | `games/castle-tower-defense/game.js` | modify |
| C3 | `games/castle-tower-defense/index.html` | modify |
| C3 | `games/castle-tower-defense/ui.js` | modify |
| C3 | `games/castle-tower-defense/game.js` | modify |
| C4 | `games/castle-tower-defense/index.html` | modify |
| C4 | `games/castle-tower-defense/ui.js` | modify |
| C5 | `games/castle-tower-defense/assets.js` | modify |
| C5 | `games/castle-tower-defense/scene.js` | modify (only if WFC palette IDs are imported there) |
| C6 | `games/castle-tower-defense/tools/map-editor.html` | modify |
| C7 | `games/castle-tower-defense/tools/map-editor.html` | modify |
| C8 | `games/castle-tower-defense/tools/map-editor.html` | modify |

T24 (`wfc-rules.js` theme palette branching) is excluded from this spec — tracked separately as "open / blocked on asset variety."

No new files. No files deleted. No new ADRs.

---

## 2. Interfaces

### 2.1 New / modified function signatures

**`ui.js`** (additions, `window.CTD3Ui`):
- `motionAllowed() → boolean` — returns `!document.body.classList.contains('reduced-motion')`.
- `setScreen(name: string) → void` — existing function. Behavior extended to also toggle `inert` attribute on every `.screen` element such that the active screen has `inert` removed and all others have `inert` set. The toggle uses `document.querySelectorAll('.screen')` evaluated at each call. No `inert` attributes appear in the HTML markup.

**`audio.js`** (additions, `window.CTD3Audio`):
- `uiSfx(kind: 'click' | 'error') → void` — `kind` names the role, not direction. `'click'` is the generic UI acknowledgment used for any forward or backward UI action (sheet open/close, pause/resume, sell/upgrade ok, map-select, etc.). `'error'` is the negative-result variant.
  - `'click'` calls `play('ui_back', { gain: 0.4 })`. (Underlying asset filename is `ui_back.ogg`; the kind name does NOT imply backward navigation.)
  - `'error'` calls `play('ui_back', { gain: 0.5, rate: 0.7 })`.

**`tools/map-editor.html`** IIFE-local additions, exposed on `window.__editorHistory` for test access:
- `push(snapshot: Snapshot) → void` — appends `structuredClone(snapshot)` to `_stack`, truncating any entries above `_pointer`, increments `_pointer`. Early-returns if `_restoring === true`. No debounce. NOT called from inside `refresh()` — called explicitly at mutation sites.
- `undo() → void` — if `_pointer === 0`: no-op. Otherwise: decrement `_pointer`; set `_restoring=true`; copy `_stack[_pointer]` fields into live `state`; call `refresh()`; set `_restoring=false`. Stack empty: no-op (no error).
- `redo() → void` — if `_pointer >= _stack.length - 1`: no-op. Otherwise: symmetric to undo with `_pointer++`.
- `depth() → { pointer: int, length: int }` — returns `{ pointer: _pointer, length: _stack.length }` for test inspection.
- `seedBoot() → void` — called once, after `restoreFromAutosave()` returns. Pushes the current state as `_stack[0]`. If autosave was empty, pushes the editor's default-empty snapshot. Always sets `_pointer = 0`.
- `importJson(text: string) → { ok: boolean, error?: string }` — parses, hydrates state on success (replaces ALL fields in the Snapshot shape), calls `refresh()` THEN `push(currentSnapshot)`. On parse failure (invalid JSON, missing required `path` field, missing `castle`): returns `{ ok: false, error: <reason> }` and leaves state unmodified. Boundary cases:
  - Empty `path` array: accepted (renders empty path).
  - Missing `castle`: rejected with `error: 'missing castle'`.
  - Missing `slots`: defaults to `[]`.
  - Missing `decorations`: defaults to `[]`.
  - Missing `meta`: defaults to `{ id: 'imported', displayName: 'Imported', theme: 'plains', wfcMode: 'augment', wfcSeed: 0 }`.
  - Slot IDs colliding with existing `slotCounter`: replace `slotCounter` with `max(existing slot id numeric suffix) + 1`.
  - `wavesJson` shape: if payload contains string `wavesJson`, use as-is. Else if payload contains array `map.waves`, set `wavesJson = JSON.stringify(map.waves, null, 2)`.

### 2.2 DOM contracts

**`index.html` HUD counter spans** (added attributes). Targets are existing elements identified by `data-bind`:
- `<span class="v" data-bind="gold">` (line 547) → add `aria-live="polite" aria-atomic="true"`
- `<span class="v" data-bind="lives">` (line 554) → add `aria-live="polite" aria-atomic="true"`
- Wave wrapper at index.html line 549 currently reads:
  ```html
  <span class="wave">Wave <span data-bind="waveNum">0</span> <span data-bind="waveOf">of 0</span></span>
  ```
  Modify in place by adding `aria-live="polite" aria-atomic="true"` to the existing `<span class="wave">` element. Do NOT introduce a new wrapper.

**`index.html` icon buttons** (added attributes):
- Send-wave (▶): `aria-label="Send next wave"`
- Sheet close (×): `aria-label="Close"`
- Return-link (◂): `aria-label="Return to map select"`
- Star strings (`★★☆`): wrapping span gets `role="img"` and `aria-label="N of 3 stars"`.

**`index.html` new screen:**
```html
<div class="screen restart-confirm" data-screen="restart-confirm">
  <div class="confirm-modal">
    <h2>Restart will erase current progress.</h2>
    <button data-action="confirm-restart">Restart</button>
    <button data-action="cancel-restart">Cancel</button>
  </div>
</div>
```

**`index.html` new screen CSS rule** (sibling of the existing `body[data-screen="pause"] .screen.pause` family at lines 96–112):
```css
body[data-screen="restart-confirm"] .screen.restart-confirm {
  display: grid; place-items: center;
  background: rgba(10,10,11,0.85);
  pointer-events: auto;
}
```

**`index.html` help-modal structure** (refactored):

HTML: `.help-modal` contains two children — `.body` (wrapping h2 / .goal / legend sections / .tips) and `.footer` (wrapping the GOT IT button only).

CSS:
```css
.help-modal {
  display: flex;
  flex-direction: column;
  max-height: 92vh;
  overflow: hidden;            /* replaces existing overflow-y: auto at line 123 */
}
.help-modal > .body   { flex: 1 1 auto; overflow-y: auto; min-height: 0; }
.help-modal > .footer { flex: 0 0 auto; padding-top: 0.8rem; }
```

**`index.html` HUD safe-area padding:**
- `.hud-top { padding-top: max(0.5rem, env(safe-area-inset-top)); padding-left: max(0.5rem, env(safe-area-inset-left)); padding-right: max(0.5rem, env(safe-area-inset-right)); }`
- `.hud-bottom { padding-bottom: max(0.5rem, env(safe-area-inset-bottom)); padding-left: ...; padding-right: ...; }`

**`index.html` map-select Spirited button:**
- Adds class `btn-spirited`. CSS rule:
  ```css
  .btn-spirited {
    border-color: var(--ember, #a06828);
    color: var(--ember, #a06828);
  }
  ```
- Label text changes from `"Spirited"` to `"★ Spirited"` (leading star glyph; no aria-label change since the label is read directly).

**`index.html` CSS additions for reduced motion:**
- `body.reduced-motion .loading-bar { animation: none; }`
- `body.reduced-motion button:active { transform: none; }`
- `body.reduced-motion .sheet { animation: none; transition: none; }`
- `body.reduced-motion .gold-flash { animation: none; }`

### 2.3 Action dispatcher additions (`game.js`, switch block starting at line 240)

Existing action names verified from `game.js:242-269`. Use these names exactly:

| Action case | Audio call added |
|---|---|
| `sheet-close`, `dismiss-help`, `dismiss-tutorial`, `dismiss-first-load-notice` | `CTD3Audio.uiSfx('click')` |
| `pause`, `resume`, `restart`, `play-again`, `confirm-restart`, `cancel-restart` | `CTD3Audio.uiSfx('click')` |
| `sheet-pick` | `CTD3Audio.uiSfx('click')` |
| `start-map`, `quit-to-map-select`, `show-help` | `CTD3Audio.uiSfx('click')` |
| `actions.upgrade` and `actions.sell` helpers (NOT dispatcher cases) | inside the helper body, AFTER `engine.upgrade/sell` returns: `result === 'ok'` → `uiSfx('click')`; `result === 'unaffordable'` → `uiSfx('error')`. Mutually exclusive. Other return values (`'invalid'`, etc.) fire neither — stays silent per existing behavior at game.js:289. |
| Unaffordable placement in `actions.selectSlot` (the line currently at game.js:288, inside the `if (result === 'unaffordable')` arm) | `CTD3Audio.uiSfx('error')` alongside existing `setGoldFlash`. Other `engine.place` returns (`'invalid'`, `'occupied'`) remain silent. |
| Unaffordable placement in `actions.placeFromSheet` (line currently at game.js:315) | `CTD3Audio.uiSfx('error')` alongside existing `setGoldFlash`. `result === 'ok'` already calls `closeSheets()` — add `uiSfx('click')` immediately after that close. |
| `select-tower` dispatcher case | unchanged — `play('ui_click')` at game.js:281 preserved. |

Audio call ordering for dispatcher cases (all rows except the helper-internal ones above): `uiSfx` fires AFTER the existing action call. Example: `case 'pause': actions.pause(); CTD3Audio.uiSfx('click'); break;`.

Audio call ordering for helper-internal rows (upgrade/sell/selectSlot/placeFromSheet): fired inside the helper body, after engine returns, scoped by the `if (result === ...)` arm. The dispatcher cases for `'upgrade'` and `'sell'` themselves do NOT call `uiSfx` (the helper already does).

New action handlers (add as new `case` entries in the dispatcher switch):
- `case 'confirm-restart':` → calls `actions.restart()` (existing helper) THEN `CTD3Audio.uiSfx('click')`. No separate "events clear" step — `actions.restart()` already invokes `startMap` which resets state.events via `engine.startMap`.
- `case 'cancel-restart':` → `window.CTD3Ui.setScreen('pause')` THEN `CTD3Audio.uiSfx('click')`.

**Pause-menu Restart button rewiring:**
- The pause-screen Restart button's `data-action` attribute changes from `"restart"` to `"show-restart-confirm"`.
- Add `case 'show-restart-confirm': window.CTD3Ui.setScreen('restart-confirm'); CTD3Audio.uiSfx('click'); break;` to the dispatcher.
- The `restart` and `play-again` action cases remain unchanged (game-over screen still uses `play-again` for immediate restart).

### 2.4 Keyboard shortcuts (`tools/map-editor.html`)

All bindings sit inside the existing `keydown` handler at `tools/map-editor.html:887`, after the existing `INPUT`/`TEXTAREA`/`SELECT` target early-return.

| Key combo | Action | preventDefault |
|---|---|---|
| `Ctrl+S` or `Cmd+S` | trigger Copy JSON button click | always |
| `Ctrl+Z` or `Cmd+Z` (without Shift) | `EditorHistory.undo()` | always |
| `Ctrl+Shift+Z` or `Cmd+Shift+Z` | `EditorHistory.redo()` | always |
| `Delete` or `Backspace` | if `state.selection != null`: remove selected element + push snapshot; else no-op | always (Backspace browser-back must be suppressed) |
| `Escape` | priority chain: (1) if `state.drag != null`: clear drag, no snapshot push; (2) else if `state.selection != null`: clear selection; (3) else: no-op | always |

### 2.5 Selection model (`tools/map-editor.html`) — new

`state.selection := { kind: 'path' | 'slot' | 'decoration' | 'castle', idx: number } | null`. Idx is omitted for `castle` (singleton).

Selection establishment uses the existing `pickAt(sx, sy)` function in `tools/map-editor.html` (returns `{ kind, idx } | null` and is already the hit-test for drag). When `onPointerDown` calls `pickAt` and gets a non-null hit: set `state.selection = hit` IN ADDITION to setting `state.drag = hit`. Hit priority and radius are whatever `pickAt` already implements — selection inherits the existing hit-test exactly. On `onPointerUp` after a non-drag (pointer-move delta < 4px), the selection persists; after a drag, `state.drag` is cleared and `state.selection` remains pointed at the moved element.

Selection clearing: clicking empty canvas clears selection. Tool change clears selection. Pressing `Escape` clears selection per §2.4.

Selection rendering: the selected element renders with a 2px gold (`#c8943e`) ring overlay drawn by the existing 2D canvas render pass. No 3D preview change — selection is a 2D-only affordance to avoid new mesh-instance plumbing.

Delete semantics (per §2.4):
- `kind === 'path'`: `state.path.splice(idx, 1)` then `state.selection = null`.
- `kind === 'slot'`: `state.slots.splice(idx, 1)` then `state.selection = null`.
- `kind === 'decoration'`: `state.decorations.splice(idx, 1)` then `state.selection = null`.
- `kind === 'castle'`: no-op (castle is required).
After delete: `refresh()` then `EditorHistory.push(currentSnapshot)`.

---

## 3. Schemas

### 3.1 `Snapshot` (EditorHistory entry shape)

```
Snapshot := {
  path:          Array<{ x: number, z: number }>,
  castle:        { x: number, y: number, z: number } | null,
  slots:         Array<{ id: string, x: number, z: number }>,
  decorations:   Array<{ type: string, x: number, z: number, size?: 'large' }>,
  slotCounter:   integer,
  meta:          { id: string, displayName: string, theme: string, wfcMode: string, wfcSeed: string | number, ...passthrough fields },
  wavesJson:     string,
  selection:     { kind: 'path' | 'slot' | 'decoration' | 'castle', idx?: number } | null,
  tool:          string,
  decorBrush:    string,
  decorBrushSize: 'normal' | 'large'
}
```

Excluded fields (NOT in Snapshot — transient/UI-only):
- `state.drag` — pointer-interaction transient; cleared by undo.
- `state.cursor` — pointer-position transient.

Clone via `structuredClone(snapshot)` at push and at restore. After restore, undo/redo MUST also:
1. Set `state.drag = null`.
2. Re-derive imperatively-set DOM state:
   - Tool buttons: call existing `setTool(state.tool)` (named function at line 897).
   - Decor-brush buttons (no named function exists; inline the two-line equivalent of the inline handler at line 908-909):
     ```js
     document.querySelectorAll('[data-decor]').forEach(b => {
       b.classList.toggle('active', b.dataset.decor === state.decorBrush);
     });
     ```
   - Decor-size button: inline equivalent of the line-916 update — read `state.decorBrushSize` and update the `Size: <value>` button label text.
   Without these re-derive steps, `.active` classes drift from `state.tool` / `state.decorBrush`.
3. Re-render `data-bind` form fields by re-running the existing `meta`/`wavesJson` binding loop (currently in `refresh()` — confirmed safe to call because it reads from `state`, not the event target).

### 3.2 ImportJSON payload

Accepted at `importJson(text)`:

```
ImportPayload := registerMapInvocation | bareMap | directMap

registerMapInvocation := { type: 'registerMap', map: MapShape, decorations?: Array }
bareMap                := { map: MapShape, decorations?: Array }
directMap              := MapShape   // top-level fields ARE the map
```

`MapShape` required fields (rejection-check after unwrap):
- `path: Array<{ x: number, z: number }>` (may be empty)
- `castle: { x: number, y?: number, z: number }` (REQUIRED — rejection on absence)
- `slots: Array<{ id: string, x: number, z: number }>` (defaults to `[]` if absent)
- `meta` OR top-level fields equivalent to meta: `id`, `displayName`, `theme`, `wfcMode`, `wfcSeed` (defaults per §2.1 boundary case)
- `waves` (array) OR `wavesJson` (string) — at least one (else `wavesJson` defaults to `"[]"`)

Unwrap order:
1. If `payload.type === 'registerMap'` and `payload.map` exists: use `payload.map`; `decorations` from `payload.decorations`.
2. Else if `payload.map` exists: use `payload.map`; `decorations` from `payload.decorations`.
3. Else: treat `payload` as a direct MapShape; `decorations` from `payload.decorations`.

Castle rejection check applies to the UNWRAPPED MapShape's `castle` field, not the outer envelope.

On parse failure: returns `{ ok: false, error: string }`, leaves state unmodified.
On parse success: replaces live state with unwrapped fields, calls `refresh()`, calls `EditorHistory.push(currentSnapshot)`.

### 3.3 `THEME_BG` map (`tools/map-editor.html` preview module)

```
const THEME_BG = {
  plains:        0x6a8447,
  forest:        0x5a6a3a,
  mountain:      0x6a7a4a,
  snowfall_pass: 0xb8c8d8,
};
```

Insertion site: inside `async function refresh(state)` (signature at line 1302), AFTER the `if (!initialized) ensureScene();` guard (line 1307). Resolution:

```js
scene.background = new three.Color(THEME_BG[(state.meta && state.meta.theme) || 'plains'] ?? THEME_BG.plains);
```

Leave the existing assignment at line 1260 inside `ensureScene()` unmodified.

### 3.4 C5 critical-path asset ID list

Replace `assets.js:99` (currently `const critical = meshes.slice(0, 10);`) with an explicit ID allowlist:

```js
const CRITICAL_IDS = new Set([
  // Towers (preserve existing critical-path)
  'tower_ranger', 'tower_catapult', 'tower_mage', 'tower_warden',
  // Path tiles (always)
  'tile_path_straight', 'tile_path_corner_round',
  'tile_path_end_round', 'tile_path_spawn_end_round',
  // Standard WFC palette
  'tile_ground', 'tile_hill', 'tile_rock', 'tile_tree',
  'tile_tree_double', 'tile_tree_quad', 'tile_crystal',
  // Snow WFC palette (loaded eagerly to support warm-cache theme swaps without re-flash)
  'snow_tile_ground', 'snow_tile_hill', 'snow_tile_rock', 'snow_tile_tree',
  'snow_tile_tree_double', 'snow_tile_tree_quad', 'snow_tile_crystal',
  // Decorations
  'detail_tree', 'detail_rocks', 'detail_crystal',
]);
const critical = meshes.filter(m => CRITICAL_IDS.has(m.id));
```

The existing `meshes.slice(10).forEach(...)` background-fetch at `assets.js:104` becomes `meshes.filter(m => !CRITICAL_IDS.has(m.id)).forEach(...)`. Towers that exist in the manifest but are NOT in `CRITICAL_IDS` remain background-loaded.

Castle, decorations beyond the three listed, and any other mesh stays in the background-fetch tier.

If a `CRITICAL_IDS` entry is absent from the manifest at runtime, the filter quietly skips it (no error). The §6.1 rollback "drop tile_tree_quad and tile_crystal" rule removes those two IDs from the set.

---

## 4. Task list

Sequence enforced. Each task closes the audit items in its row.

### C1 — A11y baseline

Closes T13, T16, T17, T18.

Acceptance criteria (all must hold):
- `window.CTD3Ui.motionAllowed` exists; returns a boolean.
- No remaining call to `document.body.classList.contains('reduced-motion')` in `ui.js` or `scene.js`. Search confirms zero matches.
- `scene.js:sync()` early-returns aura-pulse and enemy-bob updates when `motionAllowed() === false`.
- Counter spans in §2.2 carry `aria-live="polite"` and `aria-atomic="true"`.
- Icon buttons in §2.2 carry the specified `aria-label`s.
- `★`-string spans carry `role="img"` and `aria-label` matching the count.
- HUD wave counter is empty (or absent from DOM) when `state.waveTotal === 0`.
- Reduced-motion CSS rules in §2.2 present.

### C2 — Audio breadth

Closes T8, T9.

Acceptance criteria:
- `typeof window.CTD3Audio.uiSfx === 'function'`.
- For each action case in §2.3 table row 1-4: pressing the corresponding UI control fires exactly one `'back'` sound per dispatch (verifiable by audio-event log when DevTools "Capture screenshots / Web Audio" is on).
- `actions.upgrade` and `actions.sell`: on `result === 'ok'` exactly one `'back'` sound fires; on `result === 'unaffordable'` exactly one `'error'` sound fires; the two are never both fired in the same call.
- `actions.selectSlot` and `actions.placeFromSheet`: on unaffordable arm, `uiSfx('error')` fires alongside the existing `setGoldFlash(true)`.
- `select-tower` dispatcher case does NOT call `uiSfx`; its existing `play('ui_click')` call is preserved.

### C3 — Modal robustness

Closes T11, T12, T14.

Acceptance criteria:
- `.help-modal` contains `.body` and `.footer` children; CSS gives `.footer` `flex: 0 0 auto`; `.body` `overflow-y: auto`.
- `data-screen="restart-confirm"` exists in `index.html`.
- Pause-menu Restart button dispatches `setScreen('restart-confirm')`; no longer dispatches `restart` directly.
- `confirm-restart` action handler exists and calls the existing restart logic.
- `cancel-restart` action handler exists and calls `setScreen('pause')`.
- `setScreen(name)` iterates `document.querySelectorAll('.screen')` and sets `inert` on each whose `dataset.screen !== name`; removes `inert` from the active one.

### C4 — Mobile + map-select

Closes T10, T15.

Acceptance criteria:
- `.hud-top` and `.hud-bottom` CSS rules in §2.2 present.
- Spirited map-select button carries class `btn-spirited`; CSS for `.btn-spirited` distinguishes it from Quiet (border + glyph).

### C5 — Cold-start preload

Closes T7.

Acceptance criteria:
- Critical-path preload in `assets.js:107` enumerates every ID listed in §3.4.
- For `map.theme === 'snowfall_pass'`, the snow palette set is selected instead of standard.
- `scene.paintTerrain` emits `performance.mark('first-map-render-complete')` exactly once per `startMap` call, at the end of the function.
- Cold-cache load test (hard refresh + DevTools "Disable cache"): no magenta placeholder mesh visible after first frame of map render.

### C6 — Editor history + import

Closes T19, T20.

Acceptance criteria:
- `window.__editorHistory.depth()` exists and returns `{ pointer: number, length: number }`.
- `EditorHistory.push` is NOT called from inside `refresh()`. A code grep for `__editorHistory.push` (or the IIFE-local `push(`) shows call sites only at mutation handlers: `onPointerDown` (after path-add / castle / slot / decor add — line 793 area), `onPointerUp` (after drag commit), all delete handlers, all `data-bind` form-field handlers listening on the `change` event (NOT `input` — keystroke-level pushes are forbidden), `state.tool`/`state.decorBrush` change handlers, `importJson`.
- `EditorHistory.push` early-returns when `_restoring === true` (verifiable: call `__editorHistory.push(snapshot)` while `_restoring=true` — `depth().length` stays unchanged).
- `undo()` and `redo()` set `_restoring=true` before assigning live state, call `refresh()`, set `_restoring=false` after.
- `EditorHistory.seedBoot()` is called exactly once, after `restoreFromAutosave()`, regardless of whether autosave was present.
- `EditorHistory` does NOT write to `localStorage['ctd3:cartographer:v1']`. Inspectable: clear the key → use editor for 10 mutations → re-check `localStorage.getItem('ctd3:cartographer:v1')` is only being touched by autosave logic (single value, not array of snapshots).
- All 5 keyboard shortcuts in §2.4 call `ev.preventDefault()` per the table's `preventDefault` column.
- All 5 keyboard shortcuts sit AFTER the existing `INPUT`/`TEXTAREA`/`SELECT` target early-return at the `keydown` handler (line 887).
- Import JSON button + textarea exist sibling to the existing Copy JSON button.
- `importJson(text)` accepts all three payload forms in §3.2 and produces a `{ ok, error? }` return.
- Each successful import triggers exactly one `EditorHistory.push` (verifiable via `depth().length` delta of +1).
- Mid-drag `Esc` sets `state.drag = null` and calls `refresh()`; `depth().length` is unchanged (Esc does NOT push).
- `state.selection` field exists and is updated per §2.5 selection model.
- Selected element renders with the 2px gold ring overlay in the 2D canvas per §2.5.

### C7 — Editor responsive + validation

Closes T21, T22, T23.

Acceptance criteria:
- Below 1100px viewport width, `.app` uses single-column stacked layout with this exact CSS:
  ```css
  @media (max-width: 1100px) {
    .app {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto 1fr auto;
      grid-template-areas: "topbar" "meta" "canvas" "side";
    }
    .topbar { grid-area: topbar; }
    .meta-panel { grid-area: meta; }
    .canvas-wrap { grid-area: canvas; min-height: 60vh; }
    .sidebar { grid-area: side; }
  }
  ```
- Canvas validation pill displays when `validate(state)` returns `ok === false` for ANY rule, not only `badSegment`.
- Pill text equals the first failing rule's `reason` field (the rule-failure return from `validate()` at line 1044 uses field name `reason`, not `message`).
- Decor Size toggle carries `aria-pressed="true"` when `state.decorBrushSize === 'large'`, `"false"` otherwise.
- Decor Size toggle CSS applies a visible `background: rgba(200,148,62,0.25)` fill in the `aria-pressed="true"` state.

### C8 — Editor preview theming

Closes T25.

Acceptance criteria:
- `THEME_BG` constant exists per §3.3.
- `scene.background` is assigned per `state.meta.theme` inside the preview refresh path.
- Falling back to `THEME_BG.plains` when `state.meta.theme` is unset.

---

## 5. Test strategy

### 5.1 Per-commit automated checks

For every commit:
- `node --check` against every modified `.js` file → must exit 0.
- `node games/castle-tower-defense/tools/wfc-test.cjs` → must exit 0.
- Page load of `games/castle-tower-defense/index.html` and `games/castle-tower-defense/tools/map-editor.html` over `python -m http.server 3003` → must complete with zero console errors and zero failed network requests.

### 5.2 Per-commit acceptance gates (manual browser verification)

| Commit | Gate |
|---|---|
| C1 | Toggle reduced-motion in settings → reload → confirm aura, enemy bob, sheet slide, button :active, loading bar all static. VoiceOver enabled → place a tower → "Gold N" announced. Tab through HUD → screen reader reads aria-labels. Reload Plains → no "Wave 0 of 0" visible. |
| C2 | Open sheet, pause, sell tower → each emits audible click. Attempt placement with insufficient gold → low-pitched negative tone plays. Console clean. |
| C3 | Help modal at 320×568 viewport → GOT IT remains visible at bottom. Mid-wave pause → Restart → confirm dialog appears → Cancel restores prior pause state without wave loss → Confirm wipes. Help open → Tab cannot reach cog or return-link. |
| C4 | iPhone 14 Pro device emulation → HUD respects notch + home-indicator. Map-select Quiet vs Spirited visibly distinct. |
| C5 | Cold cache + hard refresh → no magenta mesh visible at first frame of any map. |
| C6 | Build 5-mutation map → Ctrl+Z 5× returns to empty state. Ctrl+Shift+Z 5× restores. Copy JSON → paste into Import JSON → hydrate → `path`, `slots`, `decorations`, `castle` arrays/object match exported values index-by-index (compare via `JSON.stringify` of each individual field; full-payload equality not required because `slotCounter` is normalized on import per §2.1 boundary case). Mid-drag Esc cancels without committing. Click a slot → press Delete → slot disappears + `window.__editorHistory.depth()` reports `pointer` incremented; press Ctrl+Z → slot restored. Ctrl+S does NOT open browser Save dialog. Record `__editorHistory.depth().length` before clicking Re-validate, click Re-validate, record again — counts must be identical. |
| C7 | Editor at 768px wide → sidebars stack below canvas; all controls reachable. Delete all slots → canvas pill shows "no slots placed" in red. Size toggle visible state changes per click. |
| C8 | Switch theme dropdown to forest / mountain / snowfall_pass → preview background tint changes accordingly. |

### 5.3 End-to-end gate (after C8 lands)

All criteria in §4 task list pass simultaneously. Plus:
- Lighthouse mobile FCP ≤ 2.0s on a cold cache against the static-server localhost build.
- Console error count = 0.
- Network 4xx/5xx count = 0 (excluding the documented pre-existing 404s on `bgm_loop.ogg`, `ambient_loop.ogg`).

### 5.4 C6 high-risk gate

Before C6 commit lands: dispatch a fresh-context `feature-dev:code-reviewer` subagent. Brief = `git diff` of C6 only + this spec's C6 section. Block commit if reviewer reports CRITICAL or MAJOR findings.

---

## 6. Observability hooks

### 6.1 C5 cold-load budget

C5 introduces a new `performance.mark` named `'first-map-render-complete'` emitted by `scene.paintTerrain` at the end of the function (after WFC dispatch + InstancedMesh commits).

Measurement protocol (run 3 trials each for pre-C5 and post-C5, take median):
1. Open DevTools Network panel → check "Disable cache" → hard reload (`Ctrl+Shift+R`).
2. Click BEGIN → click Plains map.
3. Read `performance.getEntriesByName('first-map-render-complete').at(-1).startTime`. Use `.at(-1)` to pick the most-recent mark in case the page session contains earlier renders.
4. Close the page between trials (do not soft-reload).

Budget:
- post-C5 median - pre-C5 median ≤ 500ms.

Rollback trigger:
- If delta > 500ms: drop `tile_tree_quad` and `tile_crystal` from §3.4 critical-path list. Re-measure. If still > 500ms: revert C5.

### 6.2 C6 undo-stack memory budget

Measurement protocol:
1. Boot editor with no autosave (clear `localStorage['ctd3:cartographer:v1']`).
2. Perform 200 mutations programmatically by pasting into DevTools console:
   ```js
   for (let i = 0; i < 200; i++) {
     state.path.push({ x: i % 20, z: Math.floor(i / 20) });
     window.__editorHistory.push(structuredClone(state));
   }
   ```
3. Verify `window.__editorHistory.depth().length >= 201` (200 + boot seed).
4. DevTools → Memory → Take heap snapshot → search for "EditorHistory" or the IIFE's `_stack` array → record retained size in bytes.

Budget:
- Retained size ≤ 2 MB.

Rollback trigger:
- If > 2 MB: add a 50-entry FIFO cap to `_stack`. Re-measure.

### 6.3 Lighthouse mobile FCP

Measurement: Lighthouse CI mobile preset against the static-server localhost build after C8 lands.

Budget: FCP ≤ 2.0s.

---

## 7. Rollback

### 7.1 Per-commit rollback procedure

For each commit `Ci`:
- `git revert <Ci-sha> --no-edit` → produces a single revert commit.
- All commits are independent of any commit after them at the file level, EXCEPT:
  - C3 references C1's `motionAllowed()` for the sheet-slide gate. Reverting C1 requires also reverting C3 OR re-inlining the `classList.contains('reduced-motion')` check at C3's call site.
  - C7's responsive editor layout has no dependency on C6's `EditorHistory`. Either commit may be reverted independently.
  - No other cross-commit dependencies.

### 7.2 Reversible state changes

No commit in this spec modifies:
- Database / persistent server state (none exists; site is static).
- Existing localStorage keys, except C6 which only READS `ctd3:cartographer:v1` at boot.
- Existing audio asset files in `assets/sfx/`.
- Existing GLB asset files in `assets/models/`.

All rollbacks complete via `git revert` alone. No data migration, no key cleanup.

### 7.3 Persistent-data impact

No commit in this spec writes to any persistent store except:
- C6 reads `localStorage['ctd3:cartographer:v1']` at editor boot; does not write.
- Autosave (pre-existing from TIER 1 commit `2c63dbc`) continues to write that key; not touched by any commit in this spec.

Reverting any commit causes zero data loss in `localStorage`, IndexedDB, or any file under `assets/`.

---

## 8. Out of scope

- T24 (theme dropdown ↔ WFC palette wiring).
- Performance feel polish (camera swell, wave-clear flash beyond wipe, tower placement scale-in).
- Audio palette breadth beyond `ui_back` reuse.
- `?test=1` "+10 lives" star-ratio inflation.
- `backToMapSelect` stale pan offset.
- New CC0 audio sourcing for an error sting (C2 ships with pitched `ui_back`).
- `decorationCounter` introduction (decorations remain index-keyed in this spec).
