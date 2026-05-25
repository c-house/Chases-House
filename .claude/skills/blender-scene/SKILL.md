---
name: blender-scene
description: Build, iterate, and render Blender scenes via the ahujasid Blender MCP — Sketchfab + Poly Haven asset pipeline, Cycles, AgX, headless animation rendering, ffmpeg encoding, and HTML wrapping. Use when the user asks to set up a 3D scene, render a still or animation, encode an MP4 from Blender, build a moodboard render, or troubleshoot Blender MCP problems.
allowed-tools: mcp__blender__execute_blender_code, mcp__blender__get_scene_info, mcp__blender__get_viewport_screenshot, mcp__blender__get_object_info, mcp__blender__search_polyhaven_assets, mcp__blender__search_sketchfab_models, mcp__blender__download_polyhaven_asset, mcp__blender__download_sketchfab_model, mcp__blender__get_polyhaven_status, mcp__blender__get_sketchfab_status, mcp__blender__get_polyhaven_categories, mcp__blender__get_sketchfab_model_preview, mcp__blender__set_texture, Bash, PowerShell, Read, Write, Edit, Glob, Grep, TodoWrite
shell: powershell
---

Workflow guide for building cinematic 3D renders with the Blender MCP. Follows a tested protocol that avoids known pitfalls (FBX scale bugs, multi-user mesh data, MCP timeouts, low-poly card variants in ground cover, etc.). See [gotchas.md](gotchas.md) when anything looks wrong.

## Stack

- **Blender 5.x** running locally with the **ahujasid/blender-mcp** addon enabled (N-panel → "Start Server"). The Blender MCP is the only way Claude drives Blender — there is no in-process Python.
- **Sketchfab** + **Poly Haven** asset pipelines exposed through MCP tools.
- **ffmpeg** on PATH for animation encoding.
- **PowerShell** for headless Blender + ffmpeg invocations.

## Pre-flight check

Before doing anything else, do **one** ping. If it hangs (4-min MCP timeout), STOP and tell the user to verify the addon is running — do NOT retry blindly.

```
mcp__blender__get_scene_info
```

If alive and the user wants to use Sketchfab / Poly Haven, also confirm:
- `mcp__blender__get_polyhaven_status`
- `mcp__blender__get_sketchfab_status`

## Build sequence

### 1. Scene baseline

- Wipe default cube/light/camera if present.
- Engine = **Cycles**, GPU device, **AgX** color management (`scene.view_settings.view_transform = 'AgX'`, `look = 'AgX - Medium High Contrast'`).
- Drop a ground plane (subdivided), a camera with reasonable framing, and a world node tree containing both a Background node *and* a Volume Principled (for fog).
- Set volume sampling: `volume_step_rate = 0.4`, `volume_max_steps = 256-512`.

### 2. Asset shortlist (BEFORE downloading heavily)

- Search Sketchfab + Poly Haven. Get **thumbnails** with `get_sketchfab_model_preview` for the focal hero asset(s). Poly Haven has no preview tool — trust the curation, but check categories with `get_polyhaven_categories`.
- Show the user a curated shortlist with reasoning: poly count, license, fitness for the scene, scale issues to watch for.
- Wait for go-ahead before batching downloads. Then download in **parallel** in a single tool-call block.
- Heads-up on Poly Haven categories: the names are not always intuitive. `rocks` (not `rock`), `trees` (not `tree`), `ground cover` (with space). The `pine_forest` and `verdant_trail` collections are gold for forest scenes.

### 3. Cleanup imports

Sketchfab models almost always need cleanup:

- They arrive nested under empty parents (`Sketchfab_model > <hash>.fbx > RootNode > <part>_low > <part>_low_default_0`). Detach the actual mesh with `obj.matrix_world = obj.matrix_world.copy(); obj.parent = None; obj.matrix_world = wm`.
- Multi-piece models (separate cap/stem/etc) — join them into a single source with `bpy.ops.object.join()` after detaching.
- Photoscanned models often include **environmental base geometry** attached (forest floor, leaves, etc.). Bisect it off:

  ```python
  bpy.ops.mesh.bisect(plane_co=(0, 0, -0.025), plane_no=(0, 0, 1),
                       use_fill=False, clear_inner=True)
  ```

### 4. Library + linked duplicates pattern

For any scene with repeated assets (mushrooms, trees, rocks, grass tufts):

- Move source meshes to **X = -1000** (off-camera library), set `hide_render=True` and `hide_viewport=True`.
- Use `obj.copy()` to make instances. The copy shares `obj.data` (mesh + materials), so 30 trees referencing one mesh use ~1× the memory of one tree.
- Override `location`, `rotation_euler`, `scale`, and `hide_viewport=False` on each instance.

### 5. Lighting + atmosphere

- **Sun** light for the main key (moon, sun). Set `data.color`, `data.energy` (1.5–4 typical for moonlight), and `data.angle` for soft shadows (1–3°).
- **World volume** for fog: `Density 0.05–0.10`, `Anisotropy 0.5–0.8` (higher = more god-ray look from the sun).
- **Local point lights** for accent / bounce-glow at the base of glowing objects.
- **Compositor** (Blender 5.x uses `scene.compositing_node_group`, not `scene.node_tree`):
  - `CompositorNodeGlare` with `inputs['Type'].default_value = 'Fog Glow'` (string with space, not `'FOG_GLOW'`)
  - `CompositorNodeCurveRGB` for cool grade (lift blue lows)
  - `CompositorNodeEllipseMask` → Blur → math → MixRGB(MULTIPLY) for vignette

### 6. Render preview loop

This is the iteration heartbeat. **Keep previews small.**

- **Resolution: 640–960px wide. Samples: 24–96. Denoised.** A frame at 1280×720 / 128 samples through volumetric fog already takes 30+s per frame — close to MCP's 4-minute timeout when you count overhead.
- Output PNG to disk with `bpy.ops.render.render(write_still=True)`, then `Read` the PNG to see what landed.
- **Never** render at 1920×1080 + 256 samples through the MCP — it WILL timeout. For high-quality stills, do it in the user's Blender UI (F12) or via headless Blender + PowerShell.

## Animation pipeline (≥ a few seconds)

The MCP cannot render animations. Period. Use this pattern:

1. **In MCP**: keyframe what you want animated (camera, water mapping, particle positions). Set `scene.frame_start`, `scene.frame_end`, `scene.render.fps`. Set output to PNG sequence:
   ```python
   scene.render.filepath = r"C:\path\to\anim\frame_"
   scene.render.image_settings.file_format = 'PNG'
   ```
   Save the .blend with `bpy.ops.wm.save_as_mainfile`.

2. **In PowerShell** (background): launch a separate headless Blender to render the sequence:
   ```powershell
   $blender = "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
   & $blender -b "<path>.blend" -E CYCLES -a
   ```
   Run with `run_in_background: true`. You'll be notified when it completes.

3. **In PowerShell**: encode the PNG sequence to MP4 with ffmpeg:
   ```powershell
   ffmpeg -y -framerate 24 -i "frame_%04d.png" `
     -c:v libx264 -pix_fmt yuv420p -crf 20 -preset slow -movflags +faststart `
     -vf "scale=960:540:flags=lanczos" output.mp4
   ```
   Lanczos upscale from 480×270 source produces clean edges and small files (~3-5 MB at 30s).

## Frame budget rules

- Photogrammetry trees from Poly Haven (LOD0): **5–10M verts each**. They look great but render slowly. Don't decimate unless explicitly told — users typically want the fidelity. Instead enable Cycles Simplify for viewport navigation:
  ```python
  scene.render.use_simplify = True
  scene.render.simplify_subdivision = 1            # viewport
  scene.render.simplify_subdivision_render = 6     # render quality stays full
  ```
- Subsurf modifiers on island/water — same approach: cap viewport levels at 1–2.

## Deliverable: HTML wrapper

For shipping a render to the web, use [templates/deliverable.html](templates/deliverable.html). It's a single-file page with:

- Hero `<video autoplay loop muted playsinline poster="...">` with a PNG poster fallback (if no MP4, use `<img>`)
- A live WebGL2 canvas running a Shadertoy-style mood reference
- A notes grid (scene / assets / lighting / compositing)

Edit the `<title>`, `<h1>`, hero source path, the WebGL fragment shader in the `<script>` block, and the four note sections to match the work. Keep the CSS and the WebGL plumbing as-is — they're tuned for the chases.house dark+gold aesthetic.

## File locations

- Working blends: `C:\Users\chase\Documents\blender_chase\<name>.blend`
- Renders: `C:\Users\chase\Documents\blender_chase\renders\<name>.{png,mp4}`
- Animation PNG sequences: `C:\Users\chase\Documents\blender_chase\renders\anim\frame_####.png`
- Final HTML deliverables: same renders folder; can be moved into the project at `art/<name>/index.html` if shipping to chases.house.

Save the .blend after every meaningful change. Renders go in the renders folder. PNG animation sequences are big (~120 MB for 720 frames at 480×270) — they're safe to delete once the MP4 is encoded and verified.

## When the user pushes for high quality

If the user wants a **high-resolution still** (≥1080p, ≥256 samples), set up the .blend with those render settings and ask them to hit F12 in their Blender UI — that bypasses the MCP timeout entirely. Don't try to render it through the MCP.

If they want a **higher-quality animation**, the headless PowerShell pipeline scales: bump samples in the .blend, re-launch the same `blender -b -a` command. ~6× wall time at 64 samples vs 16.
