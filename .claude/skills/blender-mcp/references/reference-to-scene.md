# Building a scene from a reference image

The user gives you an image and wants you to recreate the scene in
Blender. This is one of the most common — and most variable — workflows.

## What's actually possible

You can usually get **the gist** right: rough composition, dominant
colors, key objects, lighting mood. You will not get pixel-perfect
recreation, and you should be honest about that upfront.

Set expectations: "I can get the layout, lighting mood, and main
objects close. Texture detail and exact proportions will need a pass
from you in Blender."

## The workflow

### Pass 1: Read the image

Before touching Blender, list what you see in the image, in plain text:

- **Composition:** how the camera frames the scene. Wide, close, isometric, low angle, eye level?
- **Subjects:** what objects are in the frame? Group them (foreground / mid / background).
- **Lighting:** time of day, color temperature, key light direction, shadow softness, presence of HDR sky vs. directional lamp.
- **Materials:** rough surface description (matte plastic, polished metal, rough stone, fabric).
- **Style:** photoreal, stylized, low-poly, painterly, sci-fi, fantasy?

Send this to the user. Ask: "Does this match what you want, or did I
miss something?"

This is critical — if your read of the image is wrong, the build will
go off in the wrong direction.

### Pass 2: Decide on assets vs. primitives

For each subject you listed, decide:

- **Use a real asset** (Poly Haven model, Sketchfab download, Hyper3D
  generation) when the object has identifiable detail and an asset is
  available.
- **Use primitives** (cubes, cylinders, etc.) when you need a generic
  block-shape that the user will refine later.
- **Use Hyper3D Rodin** when the object is specific but no asset
  exists (e.g., "a stylized fox figurine in a cobalt blue glaze").

Tell the user the asset plan: "I'll grab a Poly Haven HDRI for the sky,
generate the dragon via Hyper3D, and block the dungeon walls and floor
with primitives." Get sign-off before downloading.

### Pass 3: Set the world (HDRI / background)

Lighting first. Set an HDRI that matches the image's mood. This
establishes the dominant color cast and shadow direction immediately,
which makes the rest of the build feel right.

If the image has clear directional lighting (sun, single window, harsh
key light), pair the HDRI with a Sun lamp aligned to match.

### Pass 4: Blockout subjects

Place primitives at rough positions for each major subject. Don't worry
about exact dimensions — the goal is composition matching the image.

After the blockout, take a screenshot and put it side-by-side with the
reference (mentally; you can describe the comparison). Adjust positions
to match framing.

### Pass 5: Replace primitives with assets

Swap blockout cubes for downloaded Poly Haven models / Hyper3D
generations. Place each at the location of the primitive it replaces,
delete the primitive.

### Pass 6: Materials and final tweaks

Apply materials to anything still using a default. Adjust lighting
intensity. Fine-tune camera framing.

## Camera matching

Matching the reference camera angle is often what makes the recreation
feel right. From a 2D image you can estimate:

- **Field of view.** Wide-angle (35mm equivalent) shows distortion at
  edges; tele lens (85mm+) flattens depth. For most reference images,
  50mm is a safe default.
- **Camera height.** Eye-level is most common. Low angle (camera near
  ground looking up) feels heroic. High angle (looking down) feels
  detached.
- **Focal point.** Roughly where in the frame the subject is. Match the
  rule-of-thirds positioning if the reference uses it.

```python
import bpy
import math

cam = bpy.data.objects.get("HeroCam") or None
if cam:
    cam.data.lens = 50  # 50mm equivalent
    cam.location = (5, -7, 1.6)  # eye-level
    cam.rotation_euler = (math.radians(85), 0, math.radians(35))
```

## Common pitfalls

- **Trying to recreate too literally.** If the reference has 30 distinct
  objects, don't model 30 objects. Pick the 5–8 that drive the
  composition; suggest the user fill in the rest.
- **Ignoring scale.** A reference of a desk scene needs objects at
  desk-scale (centimeters). A landscape needs meters or kilometers.
  Mismatched scale breaks lighting and depth-of-field.
- **Over-relying on Hyper3D for everything.** Generation is slow and
  quota-limited. Use it for the hero objects only; primitives + materials
  cover the rest.
- **Treating the image as the spec.** Reference images are guides, not
  contracts. The user's verbal brief is the spec — the image just
  illustrates it. If the user said "cozy reading nook" and the image is
  more sterile than cozy, lean toward the verbal brief.

## When the image is more abstract than literal

Sometimes the user shares an image as **mood reference**, not a literal
target — e.g., a painting, a movie still, a Pinterest collage. In that
case:

- Don't try to reproduce the image's exact subjects.
- Extract palette, lighting, atmosphere instead.
- Build a scene that *feels* like the image, with subjects appropriate
  to the user's actual brief.

Confirm the interpretation explicitly: "I'm reading this image as mood
reference for warm, autumnal lighting and earthy materials, not as a
literal scene to recreate. Right?"
