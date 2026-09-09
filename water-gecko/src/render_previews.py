"""Renders a contact sheet of the gecko.

    blender -b water_gecko.blend --python render_previews.py -- \
        --outdir shots --size 560 --samples 64 [--views front,side,...]
"""

import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


OUT = os.path.abspath(arg("--outdir", "shots"))
SIZE = int(arg("--size", 560))
SAMPLES = int(arg("--samples", 64))
os.makedirs(OUT, exist_ok=True)

geo = bpy.data.objects["GEO_water_gecko"]
lo = Vector((1e9, 1e9, 1e9))
hi = Vector((-1e9, -1e9, -1e9))
for corner in geo.bound_box:
    p = geo.matrix_world @ Vector(corner)
    for i in range(3):
        lo[i] = min(lo[i], p[i])
        hi[i] = max(hi[i], p[i])
centre = (lo + hi) * 0.5
span = hi - lo
print("bounds", tuple(round(v, 3) for v in lo), tuple(round(v, 3) for v in hi))

R = math.radians
VIEWS = {
    # name: (ortho?, camera position, euler, framing width)
    "front": (True, (0, -3, centre.z), (R(90), 0, 0), max(span.x, span.z) * 1.15),
    "back": (True, (0, 3, centre.z), (R(90), 0, R(180)), max(span.x, span.z) * 1.15),
    "side": (True, (3, centre.y, centre.z), (R(90), 0, R(90)), max(span.y, span.z) * 1.08),
    "top": (True, (0, centre.y, 3), (0, 0, 0), max(span.x, span.y) * 1.08),
    "hero": (False, (0.46, -0.60, 0.30), None, 0),
    "threequarter": (False, (0.66, -0.52, 0.44), None, 0),
    "lowfront": (False, (0.20, -0.62, 0.12), None, 0),
    "rearquarter": (False, (-0.60, 0.42, 0.38), None, 0),
    # close-ups on the face, framed on the head rather than the whole body
    "face": (False, (0.02, -0.46, 0.125), None, -1),
    "faceq": (False, (0.30, -0.36, 0.17), None, -1),
    "faceside": (False, (0.42, -0.12, 0.115), None, -1),
    "eye": (False, (0.2023, -0.2387, 0.1538), None, -2),
}
HEAD = Vector((0.0, -0.048, 0.112))
EYE = Vector((0.0232, -0.0698, 0.1131))
want = arg("--views", "front,side,top,hero,threequarter,rearquarter").split(",")

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 6
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE
scene.render.image_settings.file_format = "PNG"

cam = bpy.data.objects["CAM_preview"]
target = bpy.data.objects["CAM_target"]
target.location = centre
track = cam.constraints[0]

paths = []
for name in want:
    ortho, loc, euler, width = VIEWS[name]
    cam.data.type = "ORTHO" if ortho else "PERSP"
    cam.location = loc
    target.location = {-1: HEAD, -2: EYE}.get(width, centre)
    if ortho:
        track.mute = True
        cam.rotation_euler = euler
        cam.data.ortho_scale = width
    else:
        track.mute = False
        cam.data.lens = 105.0 if width == -2 else 62.0
    scene.render.filepath = os.path.join(OUT, "%s.png" % name)
    bpy.ops.render.render(write_still=True)
    paths.append(scene.render.filepath)
    print("rendered", name)


# ---- contact sheet, so several views can be reviewed at once -------------- #
def sheet(paths, cols, dst):
    tiles = []
    for p in paths:
        img = bpy.data.images.load(p)
        w, h = img.size
        buf = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(buf)
        tiles.append(buf.reshape(h, w, 4)[::-1])  # Blender rows run bottom-up
        bpy.data.images.remove(img)
    rows = (len(tiles) + cols - 1) // cols
    h, w = tiles[0].shape[:2]
    out = np.ones((rows * h, cols * w, 4), dtype=np.float32)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        out[r * h : (r + 1) * h, c * w : (c + 1) * w] = t
    out = out[::-1]
    res = bpy.data.images.new("sheet", cols * w, rows * h, alpha=True)
    res.pixels.foreach_set(out.reshape(-1))
    res.filepath_raw = dst
    res.file_format = "PNG"
    res.save()
    print("sheet", dst)


if len(paths) > 1:
    sheet(paths, 3 if len(paths) > 4 else 2, os.path.join(OUT, "sheet.png"))
