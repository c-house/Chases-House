# Asset workflows

These are **ahujasid-only** capabilities. The lab server has no asset
library integration; if the user wants assets there, you'll need to use
Python to download and import manually.

**Every tool in this file accepts a `user_prompt` parameter.** Pass a
one-line description of why you're calling the tool — it's the only
telemetry signal the maintainer gets. Defaults to empty if omitted.

## Poly Haven (HDRIs, textures, models)

Poly Haven is CC0 — free and open. It's the right default for environment
HDRIs and PBR textures.

### Pre-flight

Always check the toggle first:

```
get_polyhaven_status()
```

If it returns disabled, tell the user explicitly:

> "Poly Haven is disabled in your Blender add-on prefs. To enable, go to
> the BlenderMCP sidebar in the 3D viewport (press N if hidden), find the
> 'Poly Haven' checkbox, and tick it. I'll wait."

You cannot enable it programmatically.

### Three asset types

Poly Haven has three categories. Use the right one:

- `hdris` — environment lighting (sky, indoor, sunset, etc.)
- `textures` — PBR materials (wood, fabric, brick, ground)
- `models` — 3D objects (rocks, plants, props, furniture)

### Workflow

1. **Browse categories** if the user is vague:
   `get_polyhaven_categories(asset_type="hdris")`
2. **Search** with a category filter:
   `search_polyhaven_assets(asset_type="hdris", categories="outdoor")`
3. **Download** a chosen ID:
   `download_polyhaven_asset(asset_id="kloppenheim_06", asset_type="hdris", resolution="2k")`

Resolutions: HDRIs typically `1k`, `2k`, `4k`, `8k`. Default to `2k` for
viewport work, `4k` for renders. Don't go higher unless the user asks —
file sizes are large and download can be slow.

### Common briefs

- **"Set up a sunset" / "make the lighting golden hour"** → search HDRIs
  with categories like `sunset`, `outdoor`, `nature`, pick one with warm
  tones.
- **"Make this look like a forest floor"** → texture with categories
  `outdoor`, `floor`, `nature`. Apply via `set_texture(object_name,
  texture_id)`.
- **"Add some rocks"** → models with categories `nature`, `rock`. Place
  them with small Python tweaks after import to avoid overlap.

### After import

- HDRIs replace the world environment. The previous environment is lost.
- Texture downloads come with multiple maps (color, normal, roughness,
  displacement). `set_texture` wires them up automatically; for custom
  setups you'll need Python.
- Models import as new objects. Their names won't necessarily match the
  asset ID — inspect after import.

## Sketchfab

Sketchfab is broader (millions of models, mixed licenses). Use when Poly
Haven doesn't have what you need — but warn about licensing.

### Pre-flight

```
get_sketchfab_status()
```

Returns whether the integration is enabled and whether the user's API
token is set (downloads need a token; search/preview do not). If
disabled, instruct the user to enable it in the BlenderMCP panel
checkbox AND paste their Sketchfab API token (from
sketchfab.com/settings/password — "API Token" section).

### Workflow

1. `search_sketchfab_models(query, count=20, downloadable=True)` —
   returns matches with model UIDs.
2. `get_sketchfab_model_preview(uid)` — fetches the thumbnail PNG so
   you can visually confirm before committing to a download. **Use this
   liberally** — it's free and saves wasted downloads of
   wrong-shape/wrong-style models.
3. `download_sketchfab_model(uid)` — downloads and imports.

### Search query length pitfall

Multi-word queries often return zero results because the Sketchfab API
ANDs tokens against a relatively shallow tag/title index. Empirically:

| Query | Results |
|---|---|
| `"hookah"` | 12 |
| `"hookah shisha ornate brass"` | 0 |
| `"caterpillar"` | 12 |
| `"absolem caterpillar wonderland"` | 0 |
| `"alice in wonderland disney"` | 12 (mostly costume parts) |

**Strategy**: when a 3+ word query returns nothing, retry with the
single most-distinctive word and visually filter the broader result
set with `get_sketchfab_model_preview`. Two single-word searches with
preview-based filtering is almost always faster than tweaking a long
query.

### Important caveats

- **Licensing varies.** Many models are CC-BY (require attribution),
  some are CC-BY-NC (no commercial), some are paid. The MCP doesn't
  automatically respect commercial restrictions. If the user is doing
  client work, surface the license before downloading.
- **Quality varies.** Some models are 100k+ polys with 4k textures;
  others are barely usable. The preview thumbnail and the `face_count`
  in search results are your two cheapest signals.
- **Photogrammetry models often include attached environment.** A
  scanned mushroom may have a chunk of forest floor attached. After
  import, inspect with `get_object_info(name)` and bisect off the
  floor geometry if needed (see `references/scene-creation.md` for the
  bisect snippet).
- **Origin and scale.** Sketchfab models often import nested under
  empty parents (`Sketchfab_model > <hash>.fbx > RootNode > <part>_low`)
  with weird scales or off-origin pivots. Expect to detach with
  `obj.matrix_world = obj.matrix_world.copy(); obj.parent = None;
  obj.matrix_world = wm` and apply scale.

## Hyper3D Rodin (AI generation)

Generates 3D models from a text prompt or image. Useful when no real
asset matches what the user wants.

### Pre-flight

```
get_hyper3d_status()
```

Returns whether the integration is enabled, which API mode (`MAIN_SITE`
vs. `FAL_AI`), and whether the key is the free trial or a private key.
The free trial has a daily generation limit.

### Workflow (asynchronous)

1. **Submit** the job — pick the variant matching the input:
   - Text → `generate_hyper3d_model_via_text(text_prompt="a garden gnome holding a lantern", ...)`
   - Image(s) → `generate_hyper3d_model_via_images(input_image_paths=[...], ...)` or `input_image_urls=[...]`

   *(Older releases of the addon called these `create_rodin_job` /
   `create_rodin_job_with_images`. If you see those names instead,
   you're on an older addon version — same semantics.)*

   Returns a job ID.
2. **Poll** status:
   `poll_rodin_job_status(job_id)` — returns `pending`, `processing`,
   `completed`, or `failed`. Wait 10–30 seconds between polls; don't
   busy-loop.
3. **Import** when ready:
   `import_generated_asset(...)` — adds the model to the scene.

### Tips

- **Be specific in prompts.** "A red sports car" yields better than "a
  car." Style words help: "low-poly," "stylized," "realistic."
- **Use image-conditioned generation when you have a reference.**
  `generate_hyper3d_model_via_images` produces dramatically more faithful
  output than `via_text` when the user has a clear visual target. Combine
  both (image + descriptive text) for best results.
- **Generation takes minutes.** Tell the user upfront and don't repeatedly
  poll without waiting.
- **Quality varies.** Hero objects often need cleanup. Background or
  generic props are usually good enough.
- **Quota errors are real.** If `generate_hyper3d_model_via_*` returns a
  quota message, surface it cleanly: "Hyper3D's free trial cap is hit for
  today. You can wait for tomorrow's reset or get a key from hyper3d.ai."
  Don't retry.

## Hunyuan3D (Tencent's AI generation)

Alternative to Hyper3D Rodin. Tencent's open-source 3D generation model,
available in two modes — pick based on the user's hardware and privacy
preference.

### Pre-flight

```
get_hunyuan3d_status()
```

Returns whether the integration is enabled and which mode is configured:

- **`OFFICIAL_API`** — Tencent Cloud's hosted endpoint. Newer model
  (3.x at time of writing), faster (seconds per generation), uses the
  user's `SecretId` + `SecretKey` from console.cloud.tencent.com.
  200 free credits on signup, then pay-as-you-go.
- **`LOCAL_API`** — points at a self-hosted Hunyuan3D server (the
  open-source Hunyuan3D-2 / Hunyuan3D-2.1 repo) reachable at an HTTP
  URL like `http://localhost:8080`. Free, unlimited, private — but
  requires the user to have stood up the server (Docker, conda env, or
  WSL2). VRAM requirements are real:
  - Hunyuan3D-2 (older): 6 GB shape, 16 GB shape+texture
  - Hunyuan3D-2.1 (latest open release): 10 GB shape, 21 GB texture,
    29 GB shape+texture (the textured variant doesn't fit on 16 GB
    consumer cards at full quality — use shape-only or the v2-mini
    sub-variant)

If `LOCAL_API` mode is selected and the user reports the addon is
configured but the API URL field is blank, surface that clearly: the
status will report "API URL is not given."

### Workflow (asynchronous)

1. **Submit** the job:
   ```
   generate_hunyuan3d_model(
       text_prompt="a stylized blue cartoon caterpillar",
       input_image_url=None,    # OR provide a URL/local path
       user_prompt="..."
   )
   ```
   Pass either `text_prompt` or `input_image_url` (or both — image
   conditioning is supported). Returns `{"job_id": "job_xxx"}`.

   **`LOCAL_API` caveat**: at time of writing, the Hunyuan3D-2
   `api_server.py` has its text-to-3D pipeline commented out (only
   image-to-3D works). If the user's local server is v2.0 and you pass
   only `text_prompt`, it will fail. Image input is the safe path.

2. **Poll** status:
   `poll_hunyuan_job_status(job_id)` — returns `{"status": "RUN"}`
   while running, `{"status": "DONE", "ResultFile3Ds": "<zip path>"}`
   when complete. Wait 10–30 seconds between polls.

3. **Import** when ready:
   ```
   import_generated_asset_hunyuan(name="Absolem", zip_file_url="<path>")
   ```
   Imports the OBJ from inside the zip.

### Tips

- **Choose mode by hardware.** If the user has <16 GB VRAM (or Hunyuan3D
  isn't already running locally), prefer `OFFICIAL_API` — the cloud
  has the newer model anyway.
- **Background removal is automatic** in `LOCAL_API` mode (the v2.0
  server runs `BackgroundRemover()` on input images). For best results
  the user can still pre-crop on a clean background.
- **Generation parameters in `LOCAL_API`**: the BlenderMCP panel exposes
  `octree_resolution`, `num_inference_steps`, `guidance_scale`, and a
  `texture` toggle. Sensible defaults for 16 GB cards: octree=128,
  steps=5 (matches the turbo design point), guidance=5.0, texture=ON.
- **`OFFICIAL_API` returns base64 GLB** in the status response;
  `LOCAL_API` returns a zip path. The import tool handles both, but
  generation time and output format differ between modes.
- **Don't burn cloud quota.** 200 credits ≈ 3-5 Pro generations —
  treat each cloud generation as expensive, iterate via local mode if
  the user has it configured.

## When ahujasid asset tools aren't connected

If the user wants assets but only the lab server is running, you have
options:

- **HDRIs:** Tell the user to download from polyhaven.com themselves and
  drop the .exr file path into the chat. Then via Python:
  ```python
  import bpy
  world = bpy.context.scene.world
  world.use_nodes = True
  env = world.node_tree.nodes.new('ShaderNodeTexEnvironment')
  env.image = bpy.data.images.load("/path/to/hdri.exr")
  bg = world.node_tree.nodes["Background"]
  world.node_tree.links.new(env.outputs["Color"], bg.inputs["Color"])
  print("HDRI applied")
  ```
- **Models:** Same idea — user provides a .glb/.fbx path, you import via
  `bpy.ops.import_scene.gltf(filepath=...)` etc.

Don't pretend Poly Haven works on the lab server — it doesn't.
