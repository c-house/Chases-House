# Scene creation

Patterns for building Blender scenes from a brief. Works on both servers,
with a preference for typed tools on ahujasid and Python on lab.

## The three-pass approach

Real scenes are easier to build in passes than all at once:

1. **Blockout** — primitive shapes in roughly the right places. No
   materials, no lights yet. The goal is composition.
2. **Materials and lighting** — give surfaces color/roughness/metallic and
   place lights. Take a screenshot. Adjust.
3. **Detail** — add small props, tweak proportions, refine lighting.

Tell the user which pass you're in. It sets expectations.

## Blockout

### On ahujasid

Use `create_object` for each primitive. Common types: `CUBE`, `SPHERE`,
`CYLINDER`, `PLANE`, `CONE`, `TORUS`, `EMPTY`. Specify location, rotation,
scale.

After each create, capture the *returned* name — Blender will append
`.001` etc. on collisions.

### On lab (or for batch creation)

Send a Python script via `execute_blender_code`. A simple template:

```python
import bpy

# Helper to add and configure
def add_cube(name, location, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    return obj

floor = add_cube("Floor", (0, 0, 0), scale=(10, 10, 0.1))
wall_n = add_cube("Wall_N", (0, 5, 2), scale=(10, 0.1, 2))
wall_s = add_cube("Wall_S", (0, -5, 2), scale=(10, 0.1, 2))
# ...
print(f"Created {len(bpy.context.scene.objects)} objects")
```

Always `print()` something at the end so you confirm the script ran.

## Materials

Keep materials simple unless the user asks otherwise. A Principled BSDF
with base color + roughness + metallic covers 80% of cases.

### On ahujasid

`set_material(object_name, color=[r, g, b])` is the fastest path for solid
colors. For more control (roughness, metallic), drop to Python.

### On lab or for non-trivial materials

```python
import bpy

def make_material(name, color, roughness=0.5, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat

red_metal = make_material("RedMetal", (0.8, 0.05, 0.05), 0.2, 1.0)

for obj in bpy.data.objects:
    if obj.name.startswith("Car"):
        if obj.data.materials:
            obj.data.materials[0] = red_metal
        else:
            obj.data.materials.append(red_metal)
print("Applied RedMetal to Car* objects")
```

The `inputs[...]` keys vary slightly across Blender versions. If a script
fails on a key error, fall back to indexing (`bsdf.inputs[0]` for Base
Color) or look it up via `get_python_api_docs("ShaderNodeBsdfPrincipled.*")`
on the lab server.

## Lighting

Three-point lighting is a reliable default for product/character shots:
key, fill, rim. For environment lighting, prefer an HDRI via Poly Haven
(see [assets.md](assets.md)) over manually placed lights.

```python
import bpy

# Key light
bpy.ops.object.light_add(type='AREA', location=(4, -4, 5))
key = bpy.context.active_object
key.name = "Key"
key.data.energy = 500
key.data.size = 2

# Fill (softer, opposite side)
bpy.ops.object.light_add(type='AREA', location=(-4, -2, 3))
fill = bpy.context.active_object
fill.name = "Fill"
fill.data.energy = 150
fill.data.size = 3

# Rim (behind subject)
bpy.ops.object.light_add(type='SPOT', location=(0, 5, 4))
rim = bpy.context.active_object
rim.name = "Rim"
rim.data.energy = 800
print("Three-point lighting placed")
```

For "warm dungeon" / "cozy" / "moody" briefs, lower energy and shift color
toward orange (`light.data.color = (1.0, 0.7, 0.4)`).

## Cameras

Most briefs don't specify camera. A reasonable default for a hero shot:

```python
import bpy
import math

bpy.ops.object.camera_add(location=(7, -7, 5), rotation=(math.radians(65), 0, math.radians(45)))
cam = bpy.context.active_object
cam.name = "HeroCam"
bpy.context.scene.camera = cam  # make it the active render camera
print("Camera placed and set as active")
```

If the user says "isometric," switch the camera type:

```python
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 10
```

For "point the camera at the scene," parent a Track-To constraint to an
empty at the world origin:

```python
import bpy
bpy.ops.object.empty_add(location=(0, 0, 0))
target = bpy.context.active_object
target.name = "CamTarget"
constraint = cam.constraints.new(type='TRACK_TO')
constraint.target = target
constraint.track_axis = 'TRACK_NEGATIVE_Z'
constraint.up_axis = 'UP_Y'
```

## Verification

After each pass, take a screenshot. On ahujasid:
`get_viewport_screenshot()`. On lab:
`get_screenshot_of_window_as_image()`. Show the user; ask if they want
adjustments before continuing.

## Anti-patterns

- **Don't set positions in absolute world coords without inspecting first.**
  If the scene already has objects, your `location=(0, 0, 0)` may bury a
  cube inside the floor. Inspect first.
- **Don't loop creating dozens of objects in one Python call.** If the
  call fails halfway, partial state is hard to clean up. Batch in
  chunks of 5–10 with `print` checkpoints.
- **Don't enter Edit Mode in scripts unless you know what you're doing.**
  Mode state is sticky and operator context is fragile. Stay in Object
  Mode and use `bmesh` or low-level mesh APIs if you need geometry edits.
