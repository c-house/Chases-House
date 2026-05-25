---
name: blender-mcp
description: Drive Blender via MCP for scene creation, asset import (Poly Haven, Sketchfab, Hyper3D Rodin, Hunyuan3D), scene analysis and debugging, rendering, viewport screenshots, reference-image-to-scene workflows, and arbitrary Python (bpy) execution. Auto-detects whether the community ahujasid/blender-mcp or the official lab/blender_mcp server is connected — both can run side-by-side if configured on different ports. Use this skill whenever the user mentions Blender, .blend files, 3D modeling, 3D scenes, viewport, render, bpy, geometry nodes, armatures, mesh, materials, lighting, Poly Haven, Sketchfab, Hyper3D, Rodin, Hunyuan, HDRI, or asks Claude to build, inspect, render, optimize, or modify a 3D scene — even when the word "MCP" is not used.
license: MIT
metadata:
  version: 0.2.0
  servers-supported:
    - ahujasid/blender-mcp
    - lab/blender_mcp
---

# Blender MCP

You are controlling Blender through an MCP server. Two different servers are
common in the wild and they have **different tool names**, so the first thing
to do every session is figure out which one you're talking to.

## 1. Detect the server (do this first)

Look at the connected MCP tools. The marker tools tell you which server you
have:

| If you see... | You're on |
|---|---|
| `get_scene_info`, `get_object_info`, `get_polyhaven_*`, `get_hyper3d_*`, `get_hunyuan3d_*`, `get_viewport_screenshot`, `search_sketchfab_models`, `set_texture` | **ahujasid/blender-mcp** (community) |
| `get_objects_summary`, `get_blendfile_summary_*`, `get_screenshot_of_window_as_*`, `jump_to_*`, `render_thumbnail_to_path`, `render_viewport_to_path`, `get_python_api_docs`, `search_api_docs`, `search_manual_docs` | **lab/blender_mcp** (Blender official) |

Both servers expose `execute_blender_code` — that one alone doesn't tell you
which server you have. Look for the marker tools above.

**Tool names drift.** Treat the marker table as a hint, not a contract.
The community server in particular has renamed and added tools across
releases (e.g. `create_rodin_job` → `generate_hyper3d_model_via_text`,
new `generate_hunyuan3d_model` family). If a name in this skill doesn't
match a connected tool, trust the connected list and adapt. See
[references/server-detection.md](references/server-detection.md) for the
full per-server inventory current as of this skill's last update.

If you see tools from both, treat it as one Blender instance with both servers
attached and pick whichever tool fits the task best. If you see neither, the
MCP isn't running — tell the user to start the Blender add-on and the MCP
server, then stop. Don't pretend.

For full per-server tool inventories, common-task crosswalks, and detection
edge cases, load **[references/server-detection.md](references/server-detection.md)**.

## 2. Read before you write

Don't act blind. The cheapest first move on either server:

- **ahujasid:** `get_scene_info()`, then `get_object_info(name=...)` for anything that looks relevant.
- **lab:** `get_objects_summary()`, then `get_blendfile_summary_path_info()` to check whether the file is saved.

Knowing what's already there prevents you from creating `Cube.001` next to a
cube that's already named the thing you wanted.

## 3. Safety rules for `execute_blender_code`

Both servers expose arbitrary Python execution against the running Blender.
This is the most powerful tool — and the most dangerous. The ahujasid README
and the Blender Lab page both warn explicitly that LLM-generated code runs
without sandboxing.

Before you call `execute_blender_code`:

- **Check save state.** On lab, call `get_blendfile_summary_path_info` — if
  the file is unsaved or has unsaved edits, tell the user to save first and
  wait for confirmation. On ahujasid, ask directly: "Have you saved? I'm
  about to run Python that modifies the scene." Don't proceed without an
  affirmative answer for anything destructive.
- **Prefer dedicated tools.** If `create_object`, `set_material`, etc. (on
  ahujasid) can do the job, use them. Reserve Python for things the typed
  tools can't express.
- **Be additive when you can.** Create new collections, new objects, new
  materials. Don't `bpy.ops.wm.read_factory_settings()` or wipe collections
  unless the user asked for that exactly.
- **Print, don't return.** The addon captures `print()` output. Bare
  expressions at the end of a script don't come back.
- **Never call `bpy.ops.wm.save_mainfile()` without permission.** Saving
  overwrites the user's file on disk. Always ask.

For Python idioms, common gotchas (operator context, mode switching,
selection state), and patterns that work reliably, load
**[references/python-execution.md](references/python-execution.md)**.

## 4. Pick the right workflow guide

Most real tasks land in one of these. Load only the file(s) you need:

- **Building a scene** (place objects, lights, cameras, materials, layouts) →
  [references/scene-creation.md](references/scene-creation.md)
- **Importing or generating assets** (Poly Haven HDRIs/textures/models,
  Sketchfab search, Hyper3D Rodin AI generation) →
  [references/assets.md](references/assets.md) *(ahujasid only)*
- **Analyzing or debugging a scene** (poly counts, missing files, naming
  hygiene, performance, hierarchy) →
  [references/analysis-and-debug.md](references/analysis-and-debug.md)
- **Rendering or capturing the viewport** (screenshots, thumbnails, full
  renders, render settings) →
  [references/rendering.md](references/rendering.md)
- **Building from a reference image** (image → scene reconstruction) →
  [references/reference-to-scene.md](references/reference-to-scene.md)

Combining two or three is normal — a scene-build often involves asset import
+ scene creation + a final render check.

## 5. How to plan and execute

**For vague briefs** ("make a cool dungeon scene"), commit to a small,
concrete plan in plain language *before* touching tools:

> "I'll create a stone floor, four walls, a treasure chest in the center,
> two torches with point lights for warm illumination, and a low camera
> angle. Sound right?"

This gives the user a chance to redirect before tokens are spent. Don't ask
permission for every step — ask once for the plan, then execute.

**For specific briefs** ("make this car red and metallic"), inspect first
(`get_object_info` or `get_objects_summary`), then act. Confirm the name
matches before applying.

**When something fails:** read the error, identify the wrong assumption (bad
object name, Poly Haven not enabled, asset name wrong), and tell the user
what's needed. Don't retry the same call hoping for a different result.

## 6. Common pitfalls

- **Port-9876 collision when both servers run.** Both addons listen on TCP
  9876 by default. If both are enabled, only one binds; the other server's
  `uvx` process connects to whichever addon won the race, sends a protocol
  command the other addon doesn't understand (the community sends
  `get_telemetry_consent` first), and **hangs silently** — its tools never
  finish initializing and never appear in your tool list. Diagnostic
  signature in the community server's stderr: `Connected to Blender at
  localhost:9876` immediately followed by `Sending command:
  get_telemetry_consent` then no further output. Fix: pick a non-default
  port for one server and configure both ends to match. See
  [references/server-detection.md](references/server-detection.md)
  ("Running both servers simultaneously") for the full recipe.
- **Provider integrations gated by checkboxes.** On ahujasid,
  `get_polyhaven_status`, `get_hyper3d_status`, and `get_hunyuan3d_status`
  all return the toggle state for their provider. If disabled, the user
  must tick the corresponding checkbox in the BlenderMCP sidebar panel
  *and* restart the MCP connection — you can't enable them for them.
- **`user_prompt` parameter on every community tool.** Every
  `mcp__blender-community__*` tool accepts a `user_prompt` parameter for
  telemetry. It defaults to empty. Pass a one-line description of *why*
  you're calling the tool ("scoping mushroom assets for Wonderland scene")
  — it's the only signal the maintainer gets to understand real usage.
- **Object name collisions.** Blender appends `.001`, `.002` to duplicate
  names. After creating, use the *returned* name, not the requested one.
- **Hyper3D / Hunyuan3D rate limits.** Free trial keys have daily caps;
  Hunyuan3D in `LOCAL_API` mode has hardware limits (your GPU's VRAM).
  On quota or OOM errors, surface that to the user; don't loop.
- **Sketchfab search query length pitfall.** Multi-word queries
  (e.g. `"hookah shisha ornate brass"`, `"absolem caterpillar wonderland"`)
  often return zero results because the API ANDs tokens against a shallow
  tag index. If a 3+ word query returns nothing, retry with the single
  most-distinctive word and filter the larger result set yourself.
- **Stale viewport in screenshots.** A screenshot reflects the current
  viewport. After creating something out of frame, frame it (ahujasid: a
  short Python snippet using `bpy.ops.view3d.view_all()`; lab:
  `jump_to_view3d_object_by_name`) before snapping.
- **Lab `_for_cli` tools open a background Blender.** They're for
  analyzing files without disrupting the user's session — slower, but they
  don't touch the live editor. Use them when the user names a file path
  rather than working on the open scene.
- **Long-running operations may time out.** Break complex builds into
  steps. The ahujasid README explicitly recommends this.

## 7. What this skill is *not* great at

Be honest. The MCPs as of writing don't do these well:

- **Complex animation rigging and weight painting** — possible via Python,
  but error-prone. Recommend the user do these in Blender directly.
- **Heavy geometry-nodes authoring** — readable via inspection, but
  building non-trivial node trees from scratch via Python is fragile.
- **Shader graph editing beyond Principled BSDF tweaks** — same.

If the user asks for one of these, say so and offer the simpler alternative
(e.g., "I can apply a basic Principled BSDF setup; complex node trees are
better authored in Blender directly").
