"""Proportions for the water gecko.

Orientation follows Blender's character convention: -Y is forward (the snout),
+Z is up, +X is the creature's own left.  Everything is authored for the left
side and mirrored, so `.L` parts are the ones defined here.

Every list of "stations" is a centreline control point plus the cross-section
there: rx = half width, rz = half height, belly < 1 flattens the underside,
widelow > 1 pears the section out toward the belly.
"""

import math

from mathutils import Vector

import wglib as W

# --------------------------------------------------------------------------- #
# palette (sRGB hex - converted to linear at material build time)
# --------------------------------------------------------------------------- #

COL_BODY = "#1E79CC"  # main blue
COL_ACCENT = "#93DCEC"  # pale cyan markings: fins, crest, toes, brows, belly
COL_INK = "#0C2033"  # mouth line and nostrils
COL_EYE_DARK = "#241733"
COL_EYE_PINK = "#E8A3C2"
COL_EYE_PINK_LO = "#F4CBDE"

# --------------------------------------------------------------------------- #
# body: one continuous sweep from snout tip to tail tip
# --------------------------------------------------------------------------- #

BODY = [
    # snout ---------------------------------------------------------------- #
    dict(pos=(0, -0.640, 0.585), rx=0.058, rz=0.050, belly=0.95),
    dict(pos=(0, -0.592, 0.592), rx=0.140, rz=0.118, belly=0.82, widelow=1.06),
    dict(pos=(0, -0.512, 0.612), rx=0.202, rz=0.172, belly=0.83, widelow=1.05),
    # head ----------------------------------------------------------------- #
    dict(pos=(0, -0.412, 0.646), rx=0.258, rz=0.230, belly=0.89, widelow=1.03),
    dict(pos=(0, -0.292, 0.678), rx=0.300, rz=0.286, belly=0.94),
    dict(pos=(0, -0.162, 0.678), rx=0.288, rz=0.280, belly=0.94),
    dict(pos=(0, -0.048, 0.640), rx=0.220, rz=0.216, belly=0.96),
    # neck ----------------------------------------------------------------- #
    dict(pos=(0, 0.040, 0.560), rx=0.158, rz=0.146),
    # torso ---------------------------------------------------------------- #
    dict(pos=(0, 0.130, 0.478), rx=0.190, rz=0.168, belly=0.94),
    dict(pos=(0, 0.270, 0.432), rx=0.208, rz=0.176, belly=0.86, widelow=1.07),
    dict(pos=(0, 0.420, 0.416), rx=0.206, rz=0.174, belly=0.85, widelow=1.07),
    dict(pos=(0, 0.570, 0.414), rx=0.190, rz=0.166, belly=0.88, widelow=1.05),
    # tail ----------------------------------------------------------------- #
    dict(pos=(0, 0.700, 0.414), rx=0.130, rz=0.126, belly=0.94),
    dict(pos=(0, 0.822, 0.410), rx=0.084, rz=0.084),
    dict(pos=(0, 0.938, 0.402), rx=0.072, rz=0.074),
    dict(pos=(0, 1.058, 0.400), rx=0.120, rz=0.126),
    dict(pos=(0, 1.192, 0.402), rx=0.196, rz=0.200),
    dict(pos=(0, 1.316, 0.408), rx=0.190, rz=0.194),
    dict(pos=(0, 1.412, 0.414), rx=0.124, rz=0.128),
    dict(pos=(0, 1.466, 0.418), rx=0.040, rz=0.042),
]
BODY_RINGS = 92
BODY_SIDES = 26

# Skeleton stations along the body, given as Y positions (the build converts
# them to arc positions so bones and skin weights share one parameter).
SPINE_Y = dict(
    snout=-0.640,
    head=-0.500,  # head bone tail (points into the snout)
    skull=-0.056,  # head bone head / neck bone tail
    neck=0.084,
    chest=0.240,
    spine2=0.386,
    spine1=0.528,
    pelvis=0.700,
)
TAIL_Y = [0.700, 0.826, 0.944, 1.064, 1.196, 1.330, 1.466]

# --------------------------------------------------------------------------- #
# front limb (left).  Station indices are referenced by the rig, so the order
# matters: 0 root, 1 shoulder, 3 elbow, 5 wrist, 7 knuckles.
# --------------------------------------------------------------------------- #

ARM = [
    dict(pos=(0.020, 0.146, 0.452), rx=0.116, rz=0.110),  # 0 buried in the chest
    dict(pos=(0.128, 0.126, 0.412), rx=0.098, rz=0.094),  # 1 shoulder
    dict(pos=(0.202, 0.086, 0.320), rx=0.078, rz=0.076),  # 2 upper arm
    dict(pos=(0.250, 0.048, 0.226), rx=0.068, rz=0.068),  # 3 elbow
    dict(pos=(0.272, -0.024, 0.132), rx=0.060, rz=0.060),  # 4 forearm
    dict(pos=(0.278, -0.086, 0.062), rx=0.052, rz=0.050),  # 5 wrist
    dict(pos=(0.280, -0.126, 0.042), rx=0.060, rz=0.038),  # 6 palm
    dict(pos=(0.281, -0.158, 0.035), rx=0.054, rz=0.032),  # 7 knuckles
]
ARM_RINGS = 44
ARM_SIDES = 14

# --------------------------------------------------------------------------- #
# hind limb (left).  1 hip, 3 knee, 5 ankle, 7 toe base.
# --------------------------------------------------------------------------- #

LEG = [
    dict(pos=(0.020, 0.556, 0.420), rx=0.126, rz=0.118),  # 0 buried in the hip
    dict(pos=(0.136, 0.582, 0.382), rx=0.112, rz=0.108),  # 1 hip
    dict(pos=(0.222, 0.618, 0.296), rx=0.090, rz=0.088),  # 2 thigh
    dict(pos=(0.266, 0.634, 0.212), rx=0.074, rz=0.074),  # 3 knee
    dict(pos=(0.272, 0.566, 0.130), rx=0.062, rz=0.062),  # 4 shin
    dict(pos=(0.270, 0.498, 0.062), rx=0.054, rz=0.052),  # 5 ankle
    dict(pos=(0.268, 0.458, 0.044), rx=0.062, rz=0.040),  # 6 foot
    dict(pos=(0.266, 0.424, 0.037), rx=0.056, rz=0.034),  # 7 toe base
]
LEG_RINGS = 44
LEG_SIDES = 14

# --------------------------------------------------------------------------- #
# digits: four splayed toes per limb, gecko-style, with a pad at the tip
# --------------------------------------------------------------------------- #

# (angle from the limb's forward axis, length) - positive angles fan outward
HAND_DIGITS = [(-62.0, 0.098), (-21.0, 0.130), (21.0, 0.138), (62.0, 0.110)]
FOOT_DIGITS = [(-58.0, 0.102), (-19.0, 0.136), (19.0, 0.144), (58.0, 0.114)]
DIGIT_RINGS = 11
DIGIT_SIDES = 8


def digit_stations(base, fwd, angle_deg, length, r_scale=1.0, ground=0.030):
    """Stations for one toe: fans out from `base`, arches, lands on a fat pad."""
    a = math.radians(angle_deg)
    ca, sa = math.cos(a), math.sin(a)
    d = Vector((fwd.x * ca - fwd.y * sa, fwd.x * sa + fwd.y * ca, 0.0)).normalized()
    b = Vector(base)
    r = [0.031, 0.027, 0.023, 0.026, 0.010]
    dz = [0.0, 0.011, 0.002, -0.002, -0.004]
    at = [0.0, 0.30, 0.66, 0.90, 1.0]
    out = []
    for i in range(5):
        p = b + d * (length * at[i])
        z = W.lerp(b.z, ground, at[i]) + dz[i]
        out.append(dict(pos=(p.x, p.y, z), rx=r[i] * r_scale, rz=r[i] * r_scale * (0.92 if i < 3 else 0.80)))
    return out


DIGIT_BONE_SPLIT = 2  # station index where <digit>_01 ends and _02 begins

# --------------------------------------------------------------------------- #
# ear fins (left) - flat leaf shapes sweeping back and out from the temples
# --------------------------------------------------------------------------- #

EAR = [
    dict(pos=(0.236, -0.294, 0.762), rx=0.052, rz=0.032),
    dict(pos=(0.306, -0.208, 0.802), rx=0.098, rz=0.034),
    dict(pos=(0.368, -0.108, 0.822), rx=0.114, rz=0.030),
    dict(pos=(0.418, 0.000, 0.824), rx=0.104, rz=0.024),
    dict(pos=(0.454, 0.100, 0.810), rx=0.072, rz=0.017),
    dict(pos=(0.474, 0.164, 0.794), rx=0.030, rz=0.010),
]
EAR_UP = (0.34, 0.06, 1.0)  # fin plane normal - the paddle is tilted outward
EAR_RINGS = 26
EAR_SIDES = 12
EAR_BONE_SPLIT = 2  # station index dividing ear_01 from ear_02

# --------------------------------------------------------------------------- #
# head crest - the light-blue water droplet lying on top of the skull
# --------------------------------------------------------------------------- #

CREST = [
    dict(pos=(0, -0.486, 0.808), rx=0.014, rz=0.010),
    dict(pos=(0, -0.418, 0.878), rx=0.050, rz=0.032),
    dict(pos=(0, -0.332, 0.952), rx=0.088, rz=0.052),
    dict(pos=(0, -0.246, 0.972), rx=0.094, rz=0.054),
    dict(pos=(0, -0.170, 0.952), rx=0.054, rz=0.031),
    dict(pos=(0, -0.128, 0.928), rx=0.013, rz=0.009),
]
CREST_RINGS = 20
CREST_SIDES = 14

# --------------------------------------------------------------------------- #
# face features
# --------------------------------------------------------------------------- #

# The eyes are big domes cut into the head: an axis out of the skull centre, a
# distance along it, and the oval's half sizes as seen face on.
EYE_ANCHOR = (0.0, -0.300, 0.678)
EYE_DIR = (0.70, -0.66, 0.16)
EYE_OFFSET = 0.202  # dome origin, measured from EYE_ANCHOR along EYE_DIR
EYE_W = 0.154  # half width  (long axis of the oval)
EYE_H = 0.130  # half height
EYE_D = 0.128  # bulge along the axis
EYE_TILT = -14.0  # roll of the oval, degrees

# Mouth: (t, body-sweep u, section angle in degrees).  Runs from the left
# cheek, forward under the snout, and back up to the right cheek.
MOUTH = [
    (0.00, 0.105, -28.0),
    (0.16, 0.075, -44.0),
    (0.34, 0.048, -64.0),
    (0.50, 0.032, -90.0),
    (0.66, 0.048, -116.0),
    (0.84, 0.075, -136.0),
    (1.00, 0.105, -152.0),
]
MOUTH_OUT = 0.004
MOUTH_R = [0.004, 0.009, 0.011, 0.011, 0.011, 0.009, 0.004]
MOUTH_RINGS = 32
MOUTH_SIDES = 8

NOSTRIL_U = 0.055
NOSTRIL_THETA = math.radians(40.0)
NOSTRIL_R = 0.013

# --------------------------------------------------------------------------- #
# accent markings
# --------------------------------------------------------------------------- #

BROW_LIFT = 0.156  # how far above the eye centre the pale brow patch sits
BROW_OUT = (0.030, 0.012, 0.0)  # nudge outward/back, clear of the nose bridge
BROW_R = 0.176
THROAT = dict(centre=(0.0, 0.010, 0.470), r=0.130, strength=0.85)
BELLY_Y = (-0.06, 0.640)  # window where the pale underside shows
BELLY_STRENGTH = 0.36
PADDLE_Y = (1.040, 1.400)  # tail droplet highlight
