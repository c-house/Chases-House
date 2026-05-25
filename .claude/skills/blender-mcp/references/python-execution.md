# Python execution

Both servers expose `execute_blender_code`. It runs LLM-generated Python
in the live Blender instance with full `bpy` access. Powerful and
irreversible. Both projects' docs warn explicitly that there's no
sandbox.

This file covers idioms that work, traps that don't, and the safety
rules for using it well.

## Safety rules (recap from main SKILL.md)

1. **Confirm save state** before any destructive operation.
2. **Prefer typed tools** (ahujasid `create_object`, `set_material`,
   etc.) over Python when they cover the use case.
3. **Be additive** — create new things, don't wipe existing ones,
   unless asked exactly.
4. **Print, don't return** — bare expressions don't come back. Use
   `print()`.
5. **Never `bpy.ops.wm.save_mainfile()` or `read_factory_settings()`
   without explicit permission.**

## The output channel

The addon captures stdout. So:

```python
import bpy
result = len(bpy.data.objects)
result  # ← does NOT come back to you
```

Do this instead:

```python
import bpy
result = len(bpy.data.objects)
print(f"object_count={result}")
```

For structured output, `print(json.dumps(...))` is reliable:

```python
import bpy, json
out = {
    "scene_name": bpy.context.scene.name,
    "object_count": len(bpy.data.objects),
    "active": bpy.context.active_object.name if bpy.context.active_object else None,
}
print(json.dumps(out))
```

## Operator context (the #1 trap)

`bpy.ops.*` operators depend on the current context (active area, active
object, mode, selection). Many fail with `RuntimeError: Operator bpy.ops.X
requires Y` when called from a script context that doesn't match the UI.

**Fix 1: use the data API instead of operators when you can.**

Bad:
```python
bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
bpy.context.active_object.name = "MyCube"
```

Better (avoids operator):
```python
import bpy
mesh = bpy.data.meshes.new("MyCubeMesh")
obj = bpy.data.objects.new("MyCube", mesh)
bpy.context.scene.collection.objects.link(obj)
# Then build geometry into mesh via bmesh if needed
```

**Fix 2: use `bpy.context.temp_override` for operators that need
context.**

```python
import bpy
for area in bpy.context.screen.areas:
    if area.type == 'VIEW_3D':
        with bpy.context.temp_override(area=area):
            bpy.ops.view3d.view_all()
        break
```

**Fix 3: select and activate before operating.**

Many object operators want a selected, active object:
```python
obj = bpy.data.objects["Cube"]
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
```

## Mode switching

Operators often require a specific mode (Object, Edit, Sculpt). Switching
mid-script is fine, but switch back:

```python
import bpy
prev_mode = bpy.context.mode
bpy.ops.object.mode_set(mode='EDIT')
# ...do edit-mode work...
bpy.ops.object.mode_set(mode='OBJECT' if 'EDIT' in prev_mode else prev_mode)
```

Note `bpy.context.mode` returns strings like `'EDIT_MESH'`, not
`'EDIT'` — there's an asymmetry between getter and setter. The
`mode_set` operator takes the short form (`'OBJECT'`, `'EDIT'`,
`'SCULPT'`).

## Common idioms

### "Apply this to every mesh"

```python
import bpy
for obj in bpy.data.objects:
    if obj.type == 'MESH':
        # do stuff
        pass
```

### "Get all objects in the active scene only"

`bpy.data.objects` returns all data-blocks, including orphans. For
scene-linked objects:

```python
scene_objects = bpy.context.scene.collection.all_objects
```

### "Look up a specific object safely"

```python
obj = bpy.data.objects.get("Cube")
if obj is None:
    print("ERROR: 'Cube' not found")
else:
    # use obj
    pass
```

### "Get the camera-evaluated mesh (with modifiers)"

```python
deps = bpy.context.evaluated_depsgraph_get()
eval_obj = obj.evaluated_get(deps)
real_mesh = eval_obj.data
poly_count = len(real_mesh.polygons)
```

### "Apply a modifier"

```python
import bpy
obj = bpy.data.objects["Cube"]
bpy.context.view_layer.objects.active = obj
bpy.ops.object.modifier_apply(modifier="Subsurf")
```

(This is one of those operator-context cases — the active object must
be set first.)

## Version compatibility

- **Blender 4.0–4.1:** EEVEE engine is `'BLENDER_EEVEE'`.
- **Blender 4.2+:** new EEVEE is `'BLENDER_EEVEE_NEXT'`; the old one
  may still be present.
- **Blender 5.1+** (required by lab MCP): some API names changed; use
  `get_python_api_docs` (lab only) to verify when in doubt.
- **Cycles** is `'CYCLES'` in all versions.

If a script fails with an attribute error, version mismatch is a likely
cause. Try the alternate name; if neither works, look it up in the docs.

## Long scripts

For multi-step builds, prefer multiple smaller `execute_blender_code`
calls over one giant script. Reasons:

- A failure halfway through a 200-line script is hard to recover from.
- Smaller scripts let you `print` checkpoints between steps.
- The user can interrupt without losing all progress.

Keep individual scripts focused: "make the floor and walls," then "add
furniture," then "place lights."

## When to refuse

There are operations you should decline even if asked, or push back on
hard:

- **Saving to overwrite the user's file** without explicit confirmation
  for *that* path.
- **Deleting all data-blocks** (`bpy.ops.wm.read_factory_settings()`,
  bulk `bpy.data.objects.remove`) without confirmation.
- **Modifying paths to files outside the .blend's directory** (e.g.,
  writing renders to `~/Documents/important_thing.png`) without
  explicit path approval.
- **Long animations** (`bpy.ops.render.render(animation=True)`) without
  understanding the duration cost.

"You asked me to do X, but X will overwrite Y. Confirm Y is what you
want, or tell me a different path." That's the pattern.
