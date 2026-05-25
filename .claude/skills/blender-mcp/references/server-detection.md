# Server detection and tool crosswalk

There are two Blender MCP servers in common use. They share a few tool
names but have different architectures and feature sets. This file lists
the full tool inventory for each and a side-by-side crosswalk for common
tasks.

## ahujasid/blender-mcp (community)

GitHub: https://github.com/ahujasid/blender-mcp

**Two-piece install** — both must be in place or the server hangs silently:

1. **MCP server side**: `uvx blender-mcp` (configured in the MCP client's
   config, e.g. `.mcp.json`). Reads `BLENDER_HOST` and `BLENDER_PORT` env
   vars; defaults to `localhost:9876`.
2. **Blender add-on side**: download `addon.py` from the GitHub repo, then
   in Blender: Edit → Preferences → Add-ons → Install from Disk → enable
   it. In the 3D viewport's N-panel a "BlenderMCP" tab appears; click
   "Connect to MCP server" / "Start MCP Server". The add-on opens a TCP
   socket server (default port 9876) the `uvx` server connects to.

If only piece 1 is installed (server runs, no addon), the server connects
to *whatever else is on port 9876* (often the lab/official addon) and
hangs trying to negotiate. See "Running both servers simultaneously" below.

### Capability areas

- Scene/object inspection
- Viewport screenshots
- Poly Haven asset library integration (HDRIs, textures, models)
- Sketchfab search, preview, and download (requires user's Sketchfab API
  token in the BlenderMCP panel for downloads — not for search)
- Hyper3D Rodin AI 3D model generation (text → 3D, image → 3D)
- Hunyuan3D AI 3D model generation (Tencent — both cloud `OFFICIAL_API`
  and self-hosted `LOCAL_API` modes)
- Arbitrary Python execution
- Texture application

Object creation/modification/deletion is now done **via Python in
`execute_blender_code`** rather than dedicated tools (older releases
exposed `create_object`/`modify_object`/`delete_object`/`set_material` —
these have been removed).

### Currently surfaced tools (verified against a live install)

Tool names confirmed against the connected community server. Always
cross-check against the actual tool list — names drift between releases.

| Tool | Purpose |
|---|---|
| `get_scene_info(user_prompt="")` | High-level scene contents and metadata |
| `get_object_info(name, user_prompt="")` | Detailed info about one object |
| `get_viewport_screenshot(user_prompt="")` | PNG of the current viewport |
| `execute_blender_code(code, user_prompt="")` | Run Python in the live Blender |
| `set_texture(object_name, texture_id, user_prompt="")` | Apply a downloaded Poly Haven texture |
| **Poly Haven** | |
| `get_polyhaven_status(user_prompt="")` | Whether Poly Haven integration is enabled |
| `get_polyhaven_categories(asset_type, user_prompt="")` | List categories (`hdris`, `textures`, `models`, `all`) |
| `search_polyhaven_assets(asset_type, categories, user_prompt="")` | Find assets |
| `download_polyhaven_asset(asset_id, asset_type, resolution, file_format, user_prompt="")` | Fetch and import |
| **Sketchfab** | |
| `get_sketchfab_status(user_prompt="")` | Whether Sketchfab integration is enabled |
| `search_sketchfab_models(query, categories, count, downloadable, user_prompt="")` | Search; returns UIDs |
| `get_sketchfab_model_preview(uid, user_prompt="")` | Thumbnail PNG for visual confirmation |
| `download_sketchfab_model(uid, user_prompt="")` | Download and import (requires Sketchfab API token) |
| **Hyper3D Rodin** | |
| `get_hyper3d_status(user_prompt="")` | Check Hyper3D availability + key type (free trial vs. private) |
| `generate_hyper3d_model_via_text(prompt, ...)` | Submit text-to-3D job (was `create_rodin_job` in older releases) |
| `generate_hyper3d_model_via_images(...)` | Submit image-to-3D job |
| `poll_rodin_job_status(job_id)` | Poll for completion |
| `import_generated_asset(...)` | Import the finished model |
| **Hunyuan3D** | |
| `get_hunyuan3d_status(user_prompt="")` | Check Hunyuan3D availability + mode (`OFFICIAL_API` cloud vs. `LOCAL_API` self-hosted) |
| `generate_hunyuan3d_model(text_prompt, input_image_url, user_prompt="")` | Submit job; returns `job_id` |
| `poll_hunyuan_job_status(job_id)` | Poll for completion |
| `import_generated_asset_hunyuan(name, zip_file_url)` | Import the finished OBJ model |

### `user_prompt` parameter — important

**Every** community tool accepts a `user_prompt` parameter (defaults to
`""`). It's used for telemetry only — pass a one-line description of
*why* the tool is being called ("scoping mushroom assets for Wonderland
scene", "user asked for HDRI moody lighting"). It's the only signal the
maintainer gets to understand real-world agent usage. Empty strings are
honored but render the telemetry useless.

### Notes

- Poly Haven, Hyper3D, Hunyuan3D, and Sketchfab are each gated by
  checkboxes in the Blender add-on UI. Always check the corresponding
  `get_*_status` before attempting an operation; surface a clear message
  to the user if disabled. You can't enable them programmatically.
- **Telemetry**: anonymous usage data is collected by default. Users can
  disable it in add-on prefs or via the `DISABLE_TELEMETRY=true` env var.
  Don't disable on the user's behalf.
- **Telemetry-consent handshake**: on connect, the server sends a
  `get_telemetry_consent` command to the addon as its first message. If
  the addon on the other end doesn't speak the community protocol (e.g.
  it's the lab/official addon), the server **hangs forever** waiting for
  a response — its tools never finish initializing. This is the most
  common silent-failure mode (see below).

## lab/blender_mcp (Blender official, projects.blender.org/lab/blender_mcp)

Install: bundled `.mcpb` package or from source; entry point `blender-mcp`
Blender side: an extension shipped via blender.org with auto-start option.
Inside Blender, this addon registers as `bl_ext.user_default.mcp` — useful
to grep when diagnosing which addon is enabled (see `addon_utils.modules()`).
Required: Blender 5.1+

### Capability areas

- Blendfile summary and analysis (data-blocks, missing files, libraries)
- Scene introspection (objects, hierarchy, active selection)
- Workspace and viewport navigation
- Render-to-disk (thumbnails and full viewport renders)
- Window/area screenshots (image and JSON)
- Python API documentation lookup (bundled docs)
- Arbitrary Python execution (interactive and CLI/background mode)

### Tools (from the source repo)

Live mode (operate on the running Blender):

- `execute_blender_code` — run Python in the live Blender
- `get_blendfile_summary_datablocks` — data-block counts, workspace, render engine
- `get_blendfile_summary_missing_files` — missing externals (images, libs, fonts, sounds, caches)
- `get_blendfile_summary_of_linked_libraries` — tree of linked libraries
- `get_blendfile_summary_path_info` — path, save status, age, backups
- `get_blendfile_summary_usage_guess` — guess primary use-cases (scored 0–100)
- `get_object_detail_summary(name)` — structured per-object summary
- `get_objects_summary` — collection hierarchy and contents
- `get_python_api_docs(identifier)` — exact-identifier docs lookup, supports trailing-`*` discovery
- `search_api_docs(query, max_results, context, index)` — full-text search over the bundled Blender Python API reference
- `search_manual_docs(query, max_results, context, index)` — full-text search over the bundled Blender user manual
- `get_screenshot_of_area_as_image` — single area as PNG
- `get_screenshot_of_window_as_image` — full window as PNG
- `get_screenshot_of_window_as_json` — JSON of layout, areas, active object, selection
- `jump_to_tab_by_name(name)` — switch active workspace tab
- `jump_to_tab_by_space_type(space_type)` — switch to workspace by space type
- `jump_to_view3d_object_by_name(name)` — frame a 3D viewport on an object
- `jump_to_view3d_object_data_by_name(name)` — frame on object whose data matches
- `render_thumbnail_to_path(output_path)` — small low-quality render
- `render_viewport_to_path(output_path)` — full render to disk

Background mode (open a .blend in a separate Blender process — for
analyzing files without disrupting the user's session):

- `execute_blender_code_for_cli`
- `get_blendfile_summary_datablocks_for_cli`
- `get_blendfile_summary_missing_files_for_cli`
- `get_blendfile_summary_of_linked_libraries_for_cli`
- `get_blendfile_summary_path_info_for_cli`
- `get_blendfile_summary_usage_guess_for_cli`

### Notes

- Background mode (`*_for_cli`) requires synchronous responses and is the
  right choice when the user gives you a file path and just wants
  information about it. Don't use it on the live session — it opens a
  separate Blender.
- The lab server bundles Blender Python API docs (`get_python_api_docs`).
  Use it when you need to look up parameter signatures rather than
  guessing or hitting the live Blender for trial-and-error.

## Crosswalk: same task, different tool

| Task | ahujasid | lab |
|---|---|---|
| List scene contents | `get_scene_info` | `get_objects_summary` |
| Inspect one object | `get_object_info(name)` | `get_object_detail_summary(name)` |
| Take a viewport screenshot | `get_viewport_screenshot` | `get_screenshot_of_window_as_image` (or `_area_`) |
| Frame an object in viewport | Python: `bpy.ops.view3d.view_selected()` after selecting it | `jump_to_view3d_object_by_name(name)` |
| Run Python | `execute_blender_code` | `execute_blender_code` (live) or `execute_blender_code_for_cli` (background) |
| Render to disk | Python via `execute_blender_code` | `render_viewport_to_path` |
| Check if file is saved | Python: `bpy.data.is_saved`, `bpy.data.is_dirty` | `get_blendfile_summary_path_info` |
| Find missing textures/links | Python: scan `bpy.data.images`, `bpy.data.libraries` | `get_blendfile_summary_missing_files` |
| Look up Python API | Web search or guess | `get_python_api_docs(identifier)` |
| Add a Poly Haven HDRI | `search_polyhaven_assets` + `download_polyhaven_asset` | Not supported — fall back to Python download |
| Generate a 3D model from text prompt | `generate_hyper3d_model_via_text` (Rodin) or `generate_hunyuan3d_model` + poll + `import_generated_asset` | Not supported |
| Generate a 3D model from a reference image | `generate_hyper3d_model_via_images` (Rodin) or `generate_hunyuan3d_model(input_image_url=...)` + poll + import | Not supported |
| Look up a Blender Python API symbol | Web search or guess | `get_python_api_docs(identifier)` (exact) or `search_api_docs(query)` (full-text) |

## Detection edge cases

- **MCP not connected at all.** Neither set of marker tools is present.
  Tell the user to start the Blender add-on and the MCP server. The
  ahujasid setup wants "Connect to Claude" pressed in the BlenderMCP
  sidebar. The lab setup auto-starts if the user enabled that in prefs.
  Stop until reconnected — don't pretend.
- **Both servers connected.** Treat as one Blender instance; use whichever
  tool set fits the task. The ahujasid asset tools (Poly Haven, Sketchfab,
  Hyper3D) have no lab equivalent, so for asset workflows always pick
  ahujasid. For file analysis the lab summary tools are richer.
- **Tool names slightly different from this list.** Both projects evolve.
  If a tool you expect isn't there, list what *is* connected to the user
  and adapt.
- **The user names a server explicitly** ("use the Blender lab server"):
  honor that; don't second-guess.

## Running both servers simultaneously

The community and lab addons are independent; you can have both enabled in
one Blender instance and both `uvx` MCP servers configured in your client.
Doing so gives you the union of capabilities: lab's deep file analysis +
docs lookup + the official renderers, plus community's Poly Haven /
Sketchfab / Hyper3D / Hunyuan3D asset pipelines.

But by default **they collide on TCP port 9876**. Both addons try to bind
that port; only one wins. The losing-side MCP server still connects to
the bound port (because something is listening) but talks the wrong
protocol — silently hangs, never finishes registering tools, never
appears in the agent's tool list.

### Diagnostic signature

Run the community server with stderr captured. The hang signature is:

```
BlenderMCPServer - INFO - BlenderMCP server starting up
BlenderMCPServer - INFO - Connected to Blender at localhost:9876
BlenderMCPServer - INFO - Created new persistent connection to Blender
BlenderMCPServer - INFO - Sending command: get_telemetry_consent with params: None
BlenderMCPServer - INFO - Command sent, waiting for response...
[ no further output, hangs ]
```

The community server sends `get_telemetry_consent` as its very first
addon-side command. The lab addon doesn't recognize that command, so
the server waits indefinitely.

### Fix: assign one server a non-default port

Concretely:

1. **Pick a non-default port** for one server. We use **9877** for the
   community side; lab keeps the default **9876**.
2. **Configure the addon side**: in Blender's 3D viewport N-panel, find
   the BlenderMCP tab (community addon). Change its port field from
   `9876` to `9877` and click "Start MCP Server" (it'll re-bind).
3. **Configure the MCP server side**: in your MCP client config, add
   an `env` block to the community server entry so it dials the new port.
   Example for `.mcp.json`:
   ```json
   "blender-community": {
     "command": "uvx",
     "args": ["blender-mcp"],
     "env": { "BLENDER_PORT": "9877" }
   },
   "blender-official": {
     "command": "uv",
     "args": ["--directory", "C:\\path\\to\\lab\\mcp", "run", "blender-mcp"]
   }
   ```
   The community server reads `BLENDER_PORT` from the environment
   (`server.py` defaults to `9876` otherwise; see `DEFAULT_PORT`).
4. **Restart the MCP client** so it re-spawns the servers with the new
   env, then re-handshakes.

After restart, both servers' tools should surface. Verify with the marker
table at the top of this file.

### Why this matters

Newer agents land on a Blender setup expecting both servers to "just
work" because the skill encourages the "use both" pattern. Without this
fix, the community server's `get_*_status` and asset tools never appear,
and the agent silently degrades to lab-only — losing access to Poly
Haven, Sketchfab, Hyper3D Rodin, and Hunyuan3D entirely. The failure is
silent; nothing surfaces an error to the agent. So if asset tools are
"missing" but the user says they're configured, this is the first thing
to check.
