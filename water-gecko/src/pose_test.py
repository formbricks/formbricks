"""Poses the rig hard and renders it, to expose skinning problems.

    blender -b water_gecko.blend --python pose_test.py -- --outdir poses

Rest-pose weights always look fine; the artefacts (limbs tearing out of the
torso, the skull collapsing into the neck, toes shearing) only appear at
extremes, so this pushes every chain well past what an animation would use.
"""

import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = os.path.abspath(argv[argv.index("--outdir") + 1] if "--outdir" in argv else "poses")
SIZE = int(argv[argv.index("--size") + 1] if "--size" in argv else 620)
SAMPLES = int(argv[argv.index("--samples") + 1] if "--samples" in argv else 48)
os.makedirs(OUT, exist_ok=True)

R = math.radians
rig = bpy.data.objects["RIG_water_gecko"]
pose = rig.pose


def reset():
    pose.bones["root"]["ik_front"] = 1.0
    pose.bones["root"]["ik_hind"] = 1.0
    for pb in pose.bones:
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)
        pb.scale = (1, 1, 1)


def rot(name, x=0.0, y=0.0, z=0.0):
    pose.bones[name].rotation_euler = (R(x), R(y), R(z))


def loc(name, x=0.0, y=0.0, z=0.0):
    pose.bones[name].location = (x, y, z)


# --------------------------------------------------------------------------- #
# poses
# --------------------------------------------------------------------------- #


def pose_curl():
    """Tail up over the back, spine arched, head cranked round and jaw open."""
    # +X pitches up everywhere on this rig, so the jaw opens on -X.
    for i in range(1, 7):
        rot("tail_%02d" % i, x=15)
    for n in ("spine_01", "spine_02", "spine_03"):
        rot(n, x=6)
    rot("neck", x=12, z=16)
    rot("head", x=8, z=22, y=8)
    rot("jaw", x=-24)
    for tag in "LR":
        rot("ear_01." + tag, x=28)
        rot("ear_02." + tag, x=20)
    rot("crest", x=10)


def pose_reach():
    """Front-left paw lifted and reaching on IK; hind limbs crouched."""
    loc("ctrl_hand_ik.L", 0.02, -0.07, 0.09)
    rot("ctrl_hand_ik.L", x=-46)
    loc("ctrl_foot_ik.L", 0.0, 0.03, 0.02)
    loc("ctrl_foot_ik.R", 0.0, 0.03, 0.02)
    loc("ctrl_body", 0.0, 0.0, -0.022)
    for i in range(1, 7):
        rot("tail_%02d" % i, z=12)
    rot("neck", x=-16)
    rot("head", x=-12, z=-14)
    for tag in "LR":
        for n in range(1, 5):
            rot("finger%d_01.%s" % (n, tag), x=34)
            rot("finger%d_02.%s" % (n, tag), x=40)


def pose_twist():
    """FK limbs driven hard, to test the joint bleed and the IK/FK sliders."""
    pose.bones["root"]["ik_front"] = 0.0
    pose.bones["root"]["ik_hind"] = 0.0
    for tag, sgn in (("L", 1), ("R", -1)):
        rot("clavicle." + tag, z=-16 * sgn)
        rot("upperarm." + tag, x=-42, z=24 * sgn)
        rot("forearm." + tag, x=80)
        rot("thigh." + tag, x=-34, z=-20 * sgn)
        rot("shin." + tag, x=76)
        rot("foot." + tag, x=-26)
    rot("spine_02", z=20)
    rot("spine_01", z=12)
    rot("head", z=-24, x=12)
    rot("jaw", x=16)


def pose_stride():
    """Diagonal gait pose - the real test of the shoulder and hip weights."""
    loc("ctrl_hand_ik.L", 0.01, -0.055, 0.055)
    rot("ctrl_hand_ik.L", x=-30)
    loc("ctrl_hand_ik.R", 0.0, 0.045, 0.0)
    loc("ctrl_foot_ik.R", 0.0, -0.05, 0.05)
    rot("ctrl_foot_ik.R", x=-22)
    loc("ctrl_foot_ik.L", 0.0, 0.035, 0.0)
    rot("spine_01", z=-9)
    rot("spine_02", z=-7)
    rot("spine_03", z=6)
    rot("neck", z=8)
    rot("head", z=10)
    for i in range(1, 7):
        rot("tail_%02d" % i, z=-9, x=-4)
    loc("ctrl_body", 0.0, 0.0, 0.008)


POSES = {
    "rest": lambda: None,
    "curl": pose_curl,
    "reach": pose_reach,
    "twist": pose_twist,
    "stride": pose_stride,
}
if "--poses" in argv:
    keep = argv[argv.index("--poses") + 1].split(",")
    POSES = {k: v for k, v in POSES.items() if k in keep}

# --------------------------------------------------------------------------- #

geo = bpy.data.objects["GEO_water_gecko"]
lo = Vector((1e9,) * 3)
hi = Vector((-1e9,) * 3)
for c in geo.bound_box:
    p = geo.matrix_world @ Vector(c)
    for i in range(3):
        lo[i] = min(lo[i], p[i])
        hi[i] = max(hi[i], p[i])
centre = (lo + hi) * 0.5

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 5
scene.render.resolution_x = SIZE
scene.render.resolution_y = SIZE
cam = bpy.data.objects["CAM_preview"]
bpy.data.objects["CAM_target"].location = centre
cam.data.type = "PERSP"
cam.data.lens = 55.0

paths = []
for name, fn in POSES.items():
    reset()
    fn()
    bpy.context.view_layer.update()
    for shot, camloc in (("a", (0.60, -0.52, 0.34)), ("b", (-0.16, -0.62, 0.26))):
        cam.location = camloc
        scene.render.filepath = os.path.join(OUT, "%s_%s.png" % (name, shot))
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    print("posed", name)


def sheet(paths, cols, dst):
    tiles = []
    for p in paths:
        img = bpy.data.images.load(p)
        w, h = img.size
        buf = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(buf)
        tiles.append(buf.reshape(h, w, 4)[::-1])
        bpy.data.images.remove(img)
    rows = (len(tiles) + cols - 1) // cols
    h, w = tiles[0].shape[:2]
    out = np.ones((rows * h, cols * w, 4), dtype=np.float32)
    for i, t in enumerate(tiles):
        r, c = divmod(i, cols)
        out[r * h : (r + 1) * h, c * w : (c + 1) * w] = t
    res = bpy.data.images.new("sheet", cols * w, rows * h, alpha=True)
    res.pixels.foreach_set(out[::-1].reshape(-1))
    res.filepath_raw = dst
    res.file_format = "PNG"
    res.save()
    print("sheet", dst)


sheet(paths, 2, os.path.join(OUT, "sheet_%s.png" % "_".join(POSES)))
