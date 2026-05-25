# Blender MCP gotchas

Recurring issues encountered when driving Blender via the ahujasid MCP from Claude Code, and the fix for each. Check here first when something looks off — most "weird" Blender behavior in this pipeline is on this list.

## API drift (Blender 5.x)

The MCP runs whatever Blender version is installed. Blender 5.x changed several APIs that are commonly demoed against 4.x docs.

- **`scene.node_tree` is gone.** Use `scene.compositing_node_group` instead. Set `scene.use_nodes = True`, then `scene.compositing_node_group` may be `None` until you create it: `bpy.data.node_groups.new("Compositor", "CompositorNodeTree")` and assign.
- **`Action.fcurves` is gone.** Slotted Actions in 5.x replaced the flat `fcurves` collection with a layer/strip/channelbag hierarchy. The simplest workaround: rely on Blender's default keyframe interpolation (BEZIER) and skip explicit interpolation tweaks.
- **`CompositorNodeGlare` properties moved to sockets.** `glare.glare_type = 'FOG_GLOW'` no longer works. Use `glare.inputs['Type'].default_value = 'Fog Glow'` (string with a space). Same for `'Quality'` ('High'), `'Threshold'` (float), `'Size'` (float), `'Strength'` (float).

## Sketchfab / FBX scale bug

**Symptom**: a downloaded Sketchfab model places at the right size at first glance but its instances render as ~100m-tall pillars dominating the scene.

**Cause**: many FBX exports use millimeters internally. The Sketchfab importer applies a tiny corrective scale (e.g. `0.001098`) on the parent object to bring it to 1m display size. When you detach the mesh from its parent empties to reparent it, you preserve world transform — *but the mesh data is still in millimeter-scale, with a 0.001 local scale baking compensation*. As soon as your `place()` helper assigns `new.scale = (s, s, s)` it overrides that 0.001 correction with whatever number you wanted (e.g. 0.85), and the mesh suddenly renders at ~1000× actual size.

**Fix**: apply scale on the source mesh *before* using it for instances, so the mesh data is in real-world meters with `scale = 1`:

```python
# Sources must be single-user before applying scale
# Step 1: remove any existing instances
for o in list(bpy.data.objects):
    if o.name.startswith("hero_mush_"): bpy.data.objects.remove(o, do_unlink=True)

# Step 2: apply scale on source
src.hide_viewport = False
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = src
src.select_set(True)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

# Step 3: re-create instances cleanly
```

Always check `obj.scale` on a fresh Sketchfab mesh after detaching. If it's not `(1, 1, 1)`, apply.

## `Cannot apply to a multi user`

**Symptom**: `bpy.ops.object.transform_apply` fails with "Cannot apply to a multi user: Object X, Mesh Y, aborting".

**Cause**: the object's mesh data is shared with other objects (linked duplicates).

**Fix**: remove all instances referencing that data block first, then apply, then recreate the instances. Or use `bpy.ops.object.make_single_user(...)` first if you want to keep the instances.

## Photoscanned hero models include environmental base

**Symptom**: a Sketchfab photoscanned hero (mushroom, plant, prop) imports cleanly *but* every instance has a chunky leaf-pile / forest-floor patch attached around its base.

**Cause**: the photogrammetry capture included the surrounding ground. The mesh's local Z range will betray it: e.g. a 18cm-tall mushroom has Z range `[-0.096, +0.083]` — the bottom 10cm is environmental base, not the actual subject.

**Fix**: bisect the mesh and clear the inner side. Cut plane just below where the actual subject geometry begins (often around `z = -0.025` for a stem-mushroom):

```python
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.bisect(plane_co=(0, 0, -0.025), plane_no=(0, 0, 1),
                     use_fill=False, clear_inner=True)
bpy.ops.object.mode_set(mode='OBJECT')
```

Source must be single-user (delete instances first, same as scale-apply).

## Poly Haven asset names look generic in scene

**Symptom**: imported Poly Haven assets all have mesh data named `Plane.001`, `Plane.042`, etc. — making it hard to filter instances by source variant.

**Cause**: that's how the asset was authored. Object names preserve the variant (`grass_medium_01_tall_a_LOD0`) but mesh data is anonymous.

**Fix**: when filtering by variant, build a `data.name → object.name` map up front:

```python
src_data_to_name = {o.data.name: o.name for o in bpy.data.objects
                    if o.name.startswith("grass_medium_01_") and o.data}
bad_data = {dn for dn, sn in src_data_to_name.items() if "_tall_" in sn or "_tiny_" in sn}
# Now filter instances by `o.data.name in bad_data`
```

## Low-poly card variants look bad

**Symptom**: ground cover (especially `grass_medium_01_tall_*`, `grass_medium_01_tiny_*`, `moss_01_h/i/j/tall_*`) reads as obvious flat polygon cards in solid view, and even in render they're borderline awkward.

**Cause**: those LOD variants are 30–330 verts each — basically billboard cards.

**Fix**: filter them out at placement time. Use only mid/small/large grass variants (888–7044 verts) and moss `a–g` (16–24 verts). If you still see card artifacts, replace with a different asset family entirely.

## Poly Haven `moss_01` looks leaf-like

**Symptom**: user looks at the rendered scene and says "the leaves look weird".

**Cause**: Poly Haven's `moss_01` is a clump of small leaf-shaped fronds — not abstract moss bumps. When scaled up at all, those fronds read as tiny leaves to a viewer.

**Fix**: don't use moss_01 as scattered ground cover when you want a "mossy floor" feel. Instead, get the moss appearance from the **floor material** (procedural noise + cool green tint), and use only grass tufts as scattered geometry.

## `dry_branches_medium_01` is branches WITH foliage

**Symptom**: `dry_branches_medium_01` placements look like big flat fern fronds, not bare sticks.

**Cause**: the asset name is misleading. They're branches with dry leaves still attached.

**Fix**: skip them entirely if you wanted bare sticks. Use stumps + boulders for forest-floor anchors instead.

## MCP timeout (4 minutes)

**Symptom**: `mcp__blender__execute_blender_code` errors with "Communication error with Blender: No data received" or just hangs.

**Causes**:
1. The addon got disconnected (user clicked Stop, or Blender crashed).
2. The render or operation simply takes longer than 4 minutes (heavy volumetrics, high resolution, many samples).

**Fix**: do **one** ping (`get_scene_info`) to confirm liveness. If that succeeds, the issue is render time — chunk the work, drop quality, or move long renders to headless PowerShell. Don't blindly retry.

## Mushrooms "disappeared"

**Symptom**: user looks at viewport and reports they don't see mushrooms.

**Causes**:
1. Viewport is in solid mode and small details get lost in the geometry forest.
2. Viewport is on the wrong frame (animation playhead), so the camera is at frame 720 but mushrooms placed using frame 1 keyframes look offset.
3. Camera was moved during work.
4. A long lens (35mm at close range) gives a fisheye-like distortion that confuses scale perception.

**Fix**: take a viewport screenshot, query mushroom presence with `[o.name for o in bpy.data.objects if o.name.startswith("hero_mush_")]`, and check `scene.frame_current`. If the issue is camera framing, reset to a known-good location and use a 50mm lens at ≥3m distance to kill the fisheye feel.

## Viewport performance

**Symptom**: Blender at 80%+ CPU, viewport navigation is laggy.

**Cause**: photogrammetry trees alone can total 28M+ verts; subsurf modifiers on island/water multiply that. Material-preview shading mode further multiplies cost.

**Fix**:
- Cycles Simplify (`scene.render.use_simplify = True; scene.render.simplify_subdivision = 1`) caps subsurf in viewport but keeps render quality.
- Switch viewport to **Solid** shading for navigation; flip to Material when you need a render-approximate preview.
- Don't render previews larger than 960px through the MCP.

## "Render image is just black"

**Symptom**: a render preview comes back nearly all black with maybe a moon visible.

**Causes**:
1. Volumetric fog density too high — fog absorbs all the light.
2. Sun energy too low.
3. Background world color too dark and ambient strength near zero.

**Fix**: bump sun energy first (3–5 typical for moonlight). Drop fog density to 0.04–0.06 if god-rays are eating the scene. Confirm world surface strength is at least 0.4.
