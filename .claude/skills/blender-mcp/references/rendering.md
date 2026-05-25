# Rendering and viewport capture

Three different things sit under "render," and they have different
performance profiles. Pick the right one.

| What | Cost | When |
|---|---|---|
| Viewport screenshot | Instant | Show the user the current state during iteration |
| Thumbnail render (lab only) | Seconds | Quick preview of what the camera sees |
| Full render | Seconds to many minutes | Final output for the user to keep |

Default to viewport screenshots during a build. Only do a full render
when the user asks or the work is done.

## Viewport screenshots

### On ahujasid

```
get_viewport_screenshot()
```

Returns the current 3D viewport contents as a PNG. The framing is
whatever the user (or you, via `bpy.ops.view3d.view_all()`) last set.

### On lab

Two options:

- `get_screenshot_of_window_as_image()` — entire Blender window
- `get_screenshot_of_area_as_image()` — single area; useful when you
  want just the 3D viewport without the timeline, properties panel, etc.

Plus a JSON variant:

- `get_screenshot_of_window_as_json()` — describes the layout, areas,
  active object, and selection. Useful when you want to *understand* the
  state without sending an image.

### Framing first

A screenshot of an unfocused viewport is useless. Before snapping:

- **ahujasid:** send a quick framing script:
  ```python
  import bpy
  bpy.ops.object.select_all(action='DESELECT')
  for obj in bpy.data.objects:
      if obj.type == 'MESH':
          obj.select_set(True)
  bpy.ops.view3d.view_selected()
  ```
- **lab:** `jump_to_view3d_object_by_name(name=...)` to focus a specific
  object, or use Python as above.

For "show me the whole scene from the camera," set the viewport to camera
view first:

```python
import bpy
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        for space in area.spaces:
            if space.type == 'VIEW_3D':
                space.region_3d.view_perspective = 'CAMERA'
                break
print("Switched to camera view")
```

## Thumbnail render (lab only)

`render_thumbnail_to_path(output_path)` writes a small low-quality render
to disk. Faster than a full render. Use it when:

- The user wants to preview what the *camera* sees, not what the
  viewport shows.
- You've made composition changes and want a quick sanity check.

### On ahujasid (Python equivalent)

```python
import bpy
scene = bpy.context.scene
# Save current settings
prev_x, prev_y, prev_pct = scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage
prev_engine = scene.render.engine
prev_path = scene.render.filepath

scene.render.resolution_x = 480
scene.render.resolution_y = 270
scene.render.resolution_percentage = 100
scene.render.engine = 'BLENDER_EEVEE_NEXT'  # or 'BLENDER_EEVEE' for older Blender
scene.render.filepath = "/tmp/blender_thumb.png"
bpy.ops.render.render(write_still=True)

# Restore
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = prev_x, prev_y, prev_pct
scene.render.engine = prev_engine
scene.render.filepath = prev_path
print("/tmp/blender_thumb.png")
```

Note `BLENDER_EEVEE_NEXT` is Blender 4.2+. For older Blender, use
`'BLENDER_EEVEE'` or `'CYCLES'`.

## Full render

### On lab

`render_viewport_to_path(output_path)` uses the *current* render settings
(engine, resolution, samples). Takes as long as it takes — minutes for
Cycles at production settings.

### On ahujasid

Send Python via `execute_blender_code`:

```python
import bpy
scene = bpy.context.scene
scene.render.filepath = "/tmp/final_render.png"
bpy.ops.render.render(write_still=True)
print(scene.render.filepath)
```

### Before committing to a full render

Confirm with the user:

- The output path and format (PNG, EXR, etc.).
- The expected duration. If it's Cycles with high samples, this could
  block Blender for many minutes — get explicit OK.
- That the camera is actually pointing at something. A common bug is
  rendering an empty frame because the camera was never set or
  positioned.

## Render settings cheatsheet

```python
import bpy
scene = bpy.context.scene

# Engine
scene.render.engine = 'CYCLES'  # or 'BLENDER_EEVEE_NEXT'

# Resolution
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100

# Samples (Cycles)
scene.cycles.samples = 128  # 64 for previews, 128–512 for finals

# Denoising (Cycles)
scene.cycles.use_denoising = True

# Output format
scene.render.image_settings.file_format = 'PNG'  # or 'OPEN_EXR' for HDR
scene.render.image_settings.color_mode = 'RGBA'
scene.render.film_transparent = True  # transparent background

# Output path
scene.render.filepath = "/tmp/render_"  # Blender adds frame number for animation
```

## Common pitfalls

- **No active camera.** `bpy.ops.render.render()` fails silently if
  `scene.camera` is `None`. Always set or check it.
- **Animation vs. still.** `write_still=True` renders one frame.
  `bpy.ops.render.render(animation=True)` renders the whole frame range
  — could be hundreds of frames. Don't trigger this without explicit
  confirmation.
- **Blocking the user.** A full render holds the Blender main thread.
  The user can't keep working until it's done. Make sure they expect
  the wait.
- **Output paths matter.** `/tmp/` is fine for previews. For something
  the user wants to keep, ask where to save.
