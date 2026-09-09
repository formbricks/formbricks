"""A lateral-sequence walk cycle, generated analytically onto the rig.

Sprawling reptiles do not walk like dogs: the feet come down in the order
hind-left, front-left, hind-right, front-right, and the spine adds a standing
lateral wave that the tail carries on past the hips.  Both are driven from one
phase variable here, which is what keeps them in step.

The IK foot controls are children of `root`, so their keyed offsets are
*relative to a body that is already moving forward*.  A planted foot therefore
has to slide backward through the stance at exactly the root's speed, which is
what the rising `stride * (t - duty/2)` ramp in `foot_offset` is: add the root's
travel back on and the foot's world position is constant.  Getting this wrong
in either direction makes the feet skate and drags the body down.
"""

import math

import bpy
from mathutils import Vector

# foot control -> phase within the cycle, and the digits it drags along
FEET = [
    ("ctrl_foot_ik.L", 0.00, "toe%d_%02d.L"),
    ("ctrl_hand_ik.L", 0.25, "finger%d_%02d.L"),
    ("ctrl_foot_ik.R", 0.50, "toe%d_%02d.R"),
    ("ctrl_hand_ik.R", 0.75, "finger%d_%02d.R"),
]


def foot_offset(t, stride, duty, lift):
    """Local (y, z) offset and pitch for one foot at cycle phase t in [0, 1)."""
    if t < duty:  # stance: slides back under the body at exactly the root speed
        return stride * (t - duty * 0.5), 0.0, 0.0
    u = (t - duty) / (1.0 - duty)  # swing
    s = 0.5 - 0.5 * math.cos(math.pi * u)
    y = stride * duty * (0.5 - s)
    return y, lift * math.sin(math.pi * u), math.radians(-16.0) * math.sin(math.pi * u)


def build_walk(rig, name="ACT_walk", period=32, cycles=3, stride=0.100, duty=0.62, lift=0.024):
    """Keys a forward-travelling walk onto `rig`; returns (action, last frame)."""
    D = math.radians
    pose = rig.pose
    inv = {b.name: b.matrix_local.to_3x3().inverted() for b in rig.data.bones}

    def world_loc(bone, v):
        """Set a pose-bone offset given in world axes (parents are untwisted)."""
        pose.bones[bone].location = inv[bone] @ Vector(v)

    rig.animation_data_create()
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action

    keyed = set()
    last = cycles * period + 1
    for frame in range(1, last + 1):
        g = (frame - 1) / period  # elapsed cycles
        w = 2.0 * math.pi * g

        for pb in pose.bones:
            pb.location = (0, 0, 0)
            pb.rotation_euler = (0, 0, 0)

        # ---- forward travel + body bob ----------------------------------- #
        world_loc("root", (0.0, -stride * g, 0.0))
        world_loc("ctrl_body", (0.006 * math.sin(w), 0.0, 0.004 * math.sin(2 * w + 0.9)))
        pose.bones["ctrl_body"].rotation_euler = (D(1.6) * math.sin(2 * w), D(3.0) * math.sin(w + 0.4), 0.0)

        # ---- feet ---------------------------------------------------------- #
        for ctrl, phase, digit in FEET:
            t = (g + phase) % 1.0
            y, z, pitch = foot_offset(t, stride, duty, lift)
            world_loc(ctrl, (0.0, y, z))
            pose.bones[ctrl].rotation_euler = (pitch, 0.0, 0.0)
            swing = 0.0 if t < duty else math.sin(math.pi * (t - duty) / (1.0 - duty))
            for n in range(1, 5):
                pose.bones[digit % (n, 1)].rotation_euler = (D(14.0) * swing, 0, 0)
                pose.bones[digit % (n, 2)].rotation_euler = (D(18.0) * swing, 0, 0)

        # ---- lateral wave: spine into neck, then on down the tail ---------- #
        for bone, amp, lag in (("spine_01", 5.0, 0.0), ("spine_02", 5.5, 0.5),
                               ("spine_03", 4.5, 1.0), ("neck", 4.0, 1.5)):
            pose.bones[bone].rotation_euler = (0.0, 0.0, D(amp) * math.sin(w + lag))
        pose.bones["pelvis"].rotation_euler = (D(1.5) * math.sin(2 * w), 0.0, D(3.5) * math.sin(w - 0.5))
        for i in range(1, 7):
            pose.bones["tail_%02d" % i].rotation_euler = (
                D(1.6) * math.sin(2 * w - 0.4 * i),
                0.0,
                D(3.0 + 1.1 * i) * math.sin(w - 0.42 * i),
            )

        # ---- head holds steady while the shoulders swing under it ---------- #
        pose.bones["head"].rotation_euler = (D(2.2) * math.sin(2 * w + 1.2), 0.0, D(-5.0) * math.sin(w + 1.9))
        pose.bones["jaw"].rotation_euler = (D(-1.5) - D(1.5) * math.sin(2 * w), 0, 0)
        for tag, sgn in (("L", 1.0), ("R", -1.0)):
            pose.bones["ear_01." + tag].rotation_euler = (D(5.0) * math.sin(w - 0.8), 0, D(3.0) * sgn * math.sin(w))
            pose.bones["ear_02." + tag].rotation_euler = (D(7.0) * math.sin(w - 1.4), 0, 0)
        pose.bones["crest"].rotation_euler = (D(2.0) * math.sin(2 * w - 0.6), 0, 0)
        world_loc("ctrl_eyes", (0.010 * math.sin(w * 0.5), 0.0, 0.004 * math.sin(w * 0.33)))

        # ---- key everything we touched ------------------------------------- #
        for bone in ["root", "ctrl_body", "ctrl_eyes", "pelvis", "spine_01", "spine_02", "spine_03",
                     "neck", "head", "jaw", "crest"] + ["tail_%02d" % i for i in range(1, 7)] + [
                        "ear_%02d.%s" % (i, t) for i in (1, 2) for t in "LR"]:
            pb = pose.bones[bone]
            pb.keyframe_insert("rotation_euler", frame=frame, group=bone)
            if bone in ("root", "ctrl_body", "ctrl_eyes"):
                pb.keyframe_insert("location", frame=frame, group=bone)
            keyed.add(bone)
        for ctrl, _phase, digit in FEET:
            pose.bones[ctrl].keyframe_insert("location", frame=frame, group=ctrl)
            pose.bones[ctrl].keyframe_insert("rotation_euler", frame=frame, group=ctrl)
            keyed.add(ctrl)
            for n in range(1, 5):
                for j in (1, 2):
                    b = digit % (n, j)
                    pose.bones[b].keyframe_insert("rotation_euler", frame=frame, group=ctrl)
                    keyed.add(b)

    for fc in _fcurves(action):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    action.use_fake_user = True
    return action, last, len(keyed)


def _fcurves(action):
    """Blender 4.4+ keeps f-curves under layers/slots; fall back for older files."""
    out = list(action.fcurves)
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for bag in getattr(strip, "channelbags", []):
                out.extend(bag.fcurves)
    return out
