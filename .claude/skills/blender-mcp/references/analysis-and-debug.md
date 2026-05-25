# Scene analysis and debugging

The lab server is much better at this than ahujasid — it has dedicated
summary tools for poly counts, missing files, linked libraries, and
data-block usage. On ahujasid you'll do most of this via Python.

## "What's slow about my scene?"

Real production files often have a few outlier objects that dominate poly
budget. Find them.

### On lab server

The Blender Lab demo workflow (from the lab/mcp-server documentation):

> "Analyze the scene and list the outliers: objects with highest polygon
> count but smaller size from the camera point of view."

Run via `execute_blender_code`:

```python
import bpy

cam = bpy.context.scene.camera
results = []

for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    # Total polys including modifier effects
    deps = bpy.context.evaluated_depsgraph_get()
    eval_obj = obj.evaluated_get(deps)
    poly_count = len(eval_obj.data.polygons) if eval_obj.data else 0

    # Approximate screen area: bounding box diagonal / camera distance
    if cam:
        center = obj.matrix_world.translation
        dist = (cam.matrix_world.translation - center).length
        bbox_diag = (obj.dimensions.x ** 2 + obj.dimensions.y ** 2 + obj.dimensions.z ** 2) ** 0.5
        screen_size = bbox_diag / max(dist, 0.001)
    else:
        screen_size = 1.0

    # "Outlier score": high poly, low screen size = optimization candidate
    score = poly_count / max(screen_size, 0.001)
    results.append((obj.name, poly_count, round(screen_size, 3), round(score, 1)))

results.sort(key=lambda x: -x[3])
print(f"{'Object':<30} {'Polys':>10} {'ScreenSz':>10} {'Score':>10}")
for r in results[:15]:
    print(f"{r[0]:<30} {r[1]:>10} {r[2]:>10} {r[3]:>10}")
```

This is the analysis from the official Blender Lab demo. It correctly
flags things like an `alphabet` mesh sitting at the back of a classroom
with 20k polys — a candidate to replace with a texture.

Important: also factor in modifiers. The lab page notes that the initial
analysis might miss `Solidify` or other modifiers that double poly count;
the script above uses `evaluated_get(depsgraph)` to include them.

### Don't forget data-block summary

Before deep analysis, the lab server's
`get_blendfile_summary_datablocks` gives you a fast overview: total
mesh count, material count, image count. Anomalies (e.g., 500 unused
materials) jump out immediately.

### On ahujasid

Same idea, just run it via `execute_blender_code` directly. There's no
typed summary tool — use `get_scene_info` for the overview, then drop
into Python for the detailed scan.

## "Are there missing textures or links?"

Common production headache: someone moved a folder and the .blend can't
find its images.

### On lab

`get_blendfile_summary_missing_files` gives a categorized report:
images, libraries, fonts, sounds, movie clips, caches, sequences. One
call.

For background analysis (file path the user gave you, not the live
session): `get_blendfile_summary_missing_files_for_cli(blend_file=...)`.

### On ahujasid (or as a Python equivalent)

```python
import bpy

missing = {"images": [], "libraries": [], "fonts": [], "sounds": []}
for img in bpy.data.images:
    if img.filepath and not img.has_data and not img.packed_file:
        missing["images"].append((img.name, img.filepath))
for lib in bpy.data.libraries:
    if lib.filepath and not lib.is_loaded():
        missing["libraries"].append((lib.name, lib.filepath))
for font in bpy.data.fonts:
    if font.filepath and font.filepath != "<builtin>":
        # No direct "loaded" check; existence on disk is the proxy
        import os
        if not os.path.exists(bpy.path.abspath(font.filepath)):
            missing["fonts"].append((font.name, font.filepath))
for sound in bpy.data.sounds:
    import os
    if sound.filepath and not os.path.exists(bpy.path.abspath(sound.filepath)):
        missing["sounds"].append((sound.name, sound.filepath))

for cat, items in missing.items():
    print(f"\n{cat.upper()}: {len(items)} missing")
    for name, path in items[:10]:
        print(f"  {name} -> {path}")
```

## "Fix typos in data-block names"

A scriptable cleanup task the lab page demos. Send the user the proposed
renames, get sign-off, then apply.

```python
import bpy

# Suggest a list of (old, new) pairs based on simple heuristics
proposed = []
for collection in [bpy.data.objects, bpy.data.materials, bpy.data.collections]:
    for item in collection:
        # Example heuristic: collapse double spaces, fix common typos
        new_name = item.name.replace("  ", " ").strip()
        # Add domain-specific replacements
        new_name = new_name.replace("Recieve", "Receive").replace("Lite", "Light")
        if new_name != item.name:
            proposed.append((collection, item.name, new_name))

print(f"Proposed {len(proposed)} renames:")
for _, old, new in proposed[:30]:
    print(f"  '{old}' -> '{new}'")
```

Print the proposed list, surface it to the user, get an OK, *then* apply
in a second script. Don't rename in the first pass.

## "Which objects use this material?"

```python
import bpy

target = "pebbles"  # the material name
users = []
for obj in bpy.data.objects:
    if obj.data and hasattr(obj.data, 'materials'):
        for slot in obj.data.materials:
            if slot and slot.name == target:
                users.append(obj.name)
                break
print(f"Material '{target}' used by {len(users)} objects:")
for name in users:
    print(f"  {name}")
```

## "What's the highest poly object?"

Cheap and fast:

```python
import bpy

deps = bpy.context.evaluated_depsgraph_get()
candidates = []
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    # Skip objects not linked to any scene
    if not any(obj.name in s.collection.all_objects.keys() for s in bpy.data.scenes):
        continue
    eval_obj = obj.evaluated_get(deps)
    if eval_obj.data:
        candidates.append((obj.name, len(eval_obj.data.polygons)))

candidates.sort(key=lambda x: -x[1])
for name, count in candidates[:10]:
    print(f"{name}: {count} polys")
```

## "Find non-uniformly scaled objects"

```python
import bpy
for obj in bpy.data.objects:
    sx, sy, sz = obj.scale
    if not (abs(sx - sy) < 0.001 and abs(sy - sz) < 0.001):
        print(f"{obj.name}: scale=({sx:.3f}, {sy:.3f}, {sz:.3f})")
```

Often these need `bpy.ops.object.transform_apply(scale=True)` to bake the
scale, but check with the user first — applying scale changes the
object's local axes.

## "Linked libraries — what depends on what?"

On lab: `get_blendfile_summary_of_linked_libraries` returns a tree.

On ahujasid:

```python
import bpy
for lib in bpy.data.libraries:
    print(f"{lib.name} ({lib.filepath})")
    # Indirect deps
    for indirect in lib.parent.libraries if hasattr(lib, 'parent') else []:
        print(f"  -> via {indirect.name}")
```

## Reporting findings

When you've finished an analysis, give the user three things:

1. **The headline:** "Two objects dominate your poly budget."
2. **Specifics:** the data table or list.
3. **A suggested fix per finding:** "`alphabet` (20k polys) sits far from
   camera — replace with a baked texture."

Don't dump raw script output without interpretation.
