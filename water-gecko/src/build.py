"""Builds the water gecko: mesh, materials, skeleton and skin weights.

    blender --background --python build.py -- [--out water_gecko.blend]

The geometry is a set of lofted sweeps (see wglib.Sweep).  Because every sweep
records the arc position of each ring, and every bone is defined as an interval
of that same arc parameter, skin weights fall out analytically - there is no
"automatic weights" heat-diffusion step to go wrong, and disjoint islands
(eyes, ear fins, toes) are weighted just as reliably as the trunk.
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

DIR = os.path.dirname(os.path.abspath(__file__))
if DIR not in sys.path:
    sys.path.insert(0, DIR)

import anatomy as A  # noqa: E402
import walkcycle  # noqa: E402
import wglib as W  # noqa: E402

UNIT = 0.16  # normalised units -> metres (the gecko ends up ~42 cm long)
SUBDIV_VIEW = 1
SUBDIV_RENDER = 2

MAT_BODY, MAT_EYE, MAT_INK = 0, 1, 2
SIDES = (("L", 1.0), ("R", -1.0))


# --------------------------------------------------------------------------- #
# small utilities
# --------------------------------------------------------------------------- #


def srgb(hexstr):
    """#rrggbb -> linear RGBA, which is what Blender's colour sockets want."""
    h = hexstr.lstrip("#")
    out = []
    for i in (0, 2, 4):
        c = int(h[i : i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (out[0], out[1], out[2], 1.0)


def wipe_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for coll in (
        bpy.data.meshes,
        bpy.data.armatures,
        bpy.data.materials,
        bpy.data.images,
        bpy.data.actions,
        bpy.data.objects,
    ):
        for item in list(coll):
            coll.remove(item)


def new_collection(name, hide=False):
    coll = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(coll)
    if hide:
        coll.hide_viewport = True
        coll.hide_render = True
    return coll


# --------------------------------------------------------------------------- #
# 1. geometry
# --------------------------------------------------------------------------- #


def surface_normal(sweep, u, theta):
    p = sweep.surface_at(u, theta)
    du = sweep.surface_at(min(1.0, u + 2e-3), theta) - p
    dt = sweep.surface_at(u, theta + 2e-3) - p
    n = dt.cross(du)
    if n.length < 1e-9:
        return (p - sweep.point_at_u(u)).normalized()
    n.normalize()
    if n.dot(p - sweep.point_at_u(u)) < 0:
        n = -n
    return n


def limb_forward(stations, i0, i1):
    a = Vector(stations[i0]["pos"])
    b = Vector(stations[i1]["pos"])
    d = Vector((b.x - a.x, b.y - a.y, 0.0))
    return d.normalized() if d.length > 1e-6 else Vector((0.0, -1.0, 0.0))


def build_geometry():
    """Returns (MeshBuilder, dict of named sweeps, dict of placement info)."""
    mb = W.MeshBuilder()
    sw = {}
    info = {}

    # ---- trunk: snout -> head -> neck -> torso -> tail -------------------- #
    body = W.Sweep(A.BODY, A.BODY_RINGS, A.BODY_SIDES, up_hint=(0, 0, 1))
    sw["body"] = body
    mb.add_sweep(body, "body", MAT_BODY, uv_band=(0.00, 0.14))

    # ---- limbs and toes --------------------------------------------------- #
    arm = W.Sweep(A.ARM, A.ARM_RINGS, A.ARM_SIDES, up_hint=(0, 0, 1))
    leg = W.Sweep(A.LEG, A.LEG_RINGS, A.LEG_SIDES, up_hint=(0, 0, 1))
    sw["arm"] = arm
    sw["leg"] = leg
    hand_fwd = limb_forward(A.ARM, 5, 7)
    foot_fwd = limb_forward(A.LEG, 5, 7)

    for tag, mirror in SIDES:
        mb.add_sweep(arm, "arm." + tag, MAT_BODY, uv_band=(0.16, 0.30), mirror=mirror < 0)
        mb.add_sweep(leg, "leg." + tag, MAT_BODY, uv_band=(0.32, 0.46), mirror=mirror < 0)

    digits = {}
    for kind, stations, spec, fwd, idx in (
        ("finger", A.ARM, A.HAND_DIGITS, hand_fwd, 7),
        ("toe", A.LEG, A.FOOT_DIGITS, foot_fwd, 7),
    ):
        knuckle = Vector(stations[idx]["pos"])
        for n, (ang, length) in enumerate(spec, start=1):
            a = math.radians(ang)
            d = Vector((fwd.x * math.cos(a) - fwd.y * math.sin(a), fwd.x * math.sin(a) + fwd.y * math.cos(a), 0.0))
            base = knuckle + d.normalized() * 0.026
            st = A.digit_stations(base, fwd, ang, length, ground=0.028)
            s = W.Sweep(st, A.DIGIT_RINGS, A.DIGIT_SIDES, up_hint=(0, 0, 1))
            name = "%s%d" % (kind, n)
            digits[name] = s
            for tag, mirror in SIDES:
                mb.add_sweep(s, "%s.%s" % (name, tag), MAT_BODY, uv_band=(0.48, 0.60), mirror=mirror < 0)
    sw.update(digits)

    # ---- ear fins and head crest ------------------------------------------ #
    ear = W.Sweep(A.EAR, A.EAR_RINGS, A.EAR_SIDES, up_hint=A.EAR_UP)
    sw["ear"] = ear
    for tag, mirror in SIDES:
        mb.add_sweep(ear, "ear." + tag, MAT_BODY, uv_band=(0.62, 0.76), mirror=mirror < 0)

    crest = W.Sweep(A.CREST, A.CREST_RINGS, A.CREST_SIDES, up_hint=(0, 0, 1))
    sw["crest"] = crest
    mb.add_sweep(crest, "crest", MAT_BODY, uv_band=(0.78, 0.88))

    # ---- eyes: domes anchored to the head surface ------------------------- #
    fwd = Vector(A.EYE_DIR).normalized()
    up = Vector((0, 0, 1))
    up = (up - fwd * up.dot(fwd)).normalized()
    up = Matrix.Rotation(math.radians(A.EYE_TILT), 4, fwd) @ up
    side = up.cross(fwd)
    centre = Vector(A.EYE_ANCHOR) + fwd * A.EYE_OFFSET
    eye_m = Matrix(
        [
            (side.x * A.EYE_W, up.x * A.EYE_H, fwd.x * A.EYE_D, centre.x),
            (side.y * A.EYE_W, up.y * A.EYE_H, fwd.y * A.EYE_D, centre.y),
            (side.z * A.EYE_W, up.z * A.EYE_H, fwd.z * A.EYE_D, centre.z),
            (0, 0, 0, 1),
        ]
    )
    info["eye_centre"] = centre
    info["eye_axis"] = fwd
    info["eye_up"] = up
    for tag, mirror in SIDES:
        mb.add_dome(eye_m, "eye." + tag, MAT_EYE, rings=9, sides=22, arc=0.60, mirror=mirror < 0)

    # ---- mouth line: a thin tube laid along the jaw seam ------------------ #
    ts = [m[0] for m in A.MOUTH]
    us = [m[1] for m in A.MOUTH]
    th = [math.radians(m[2]) for m in A.MOUTH]
    st = []
    steps = 15
    for i in range(steps):
        t = i / (steps - 1)
        uu = W.cr_eval(us, t)
        tt = W.cr_eval(th, t)
        r = max(0.003, W.cr_eval(A.MOUTH_R, t))
        st.append(dict(pos=body.surface_at(uu, tt, A.MOUTH_OUT), rx=r, rz=r))
    mouth = W.Sweep(st, A.MOUTH_RINGS, A.MOUTH_SIDES, up_hint=(0, -0.4, -0.9))
    sw["mouth"] = mouth
    mb.add_sweep(mouth, "mouth", MAT_INK, uv_band=(0.90, 0.96))

    # ---- nostrils --------------------------------------------------------- #
    np_ = body.surface_at(A.NOSTRIL_U, A.NOSTRIL_THETA)
    nn = surface_normal(body, A.NOSTRIL_U, A.NOSTRIL_THETA)
    nup = Vector((0, 0, 1))
    nup = (nup - nn * nup.dot(nn)).normalized()
    nside = nup.cross(nn)
    nc = np_ - nn * (A.NOSTRIL_R * 0.55)
    nose_m = Matrix(
        [
            (nside.x * A.NOSTRIL_R, nup.x * A.NOSTRIL_R * 0.72, nn.x * A.NOSTRIL_R * 0.8, nc.x),
            (nside.y * A.NOSTRIL_R, nup.y * A.NOSTRIL_R * 0.72, nn.y * A.NOSTRIL_R * 0.8, nc.y),
            (nside.z * A.NOSTRIL_R, nup.z * A.NOSTRIL_R * 0.72, nn.z * A.NOSTRIL_R * 0.8, nc.z),
            (0, 0, 0, 1),
        ]
    )
    for tag, mirror in SIDES:
        mb.add_dome(nose_m, "nostril." + tag, MAT_INK, rings=5, sides=12, arc=0.55, mirror=mirror < 0)

    return mb, sw, info


# --------------------------------------------------------------------------- #
# 2. accent markings (pale cyan mask, consumed by the body material)
# --------------------------------------------------------------------------- #


def paint_accents(mb, sw, info):
    body = sw["body"]
    acc = [0.0] * len(mb.verts)

    def paint(centre, radius, strength=1.0, parts=None):
        c = Vector(centre)
        for i, v in enumerate(mb.verts):
            if parts and mb.part[i] not in parts:
                continue
            d = (v - c).length
            if d < radius:
                acc[i] = max(acc[i], strength * W.smoothstep(radius, radius * 0.42, d))

    body_parts = {"body"}
    bs0, bs1 = s_at_y(body, A.BELLY_Y[0]), s_at_y(body, A.BELLY_Y[1])
    ps0, ps1 = s_at_y(body, A.PADDLE_Y[0]), s_at_y(body, A.PADDLE_Y[1])
    for i in range(len(mb.verts)):
        part = mb.part[i]
        s = mb.sval[i]
        base = part.split(".")[0]

        if base in ("ear", "crest"):
            acc[i] = 1.0
        elif base in ("finger", "toe"):
            acc[i] = W.smoothstep(0.42, 0.74, s)  # pale toe pads
        elif base in ("arm", "leg"):
            acc[i] = 0.85 * W.smoothstep(0.90, 0.99, s)  # palms and soles
        elif part == "body":
            ring = math.sin(2.0 * math.pi * mb.tval[i])
            # belly: pale underside from the throat back to the hips
            down = W.smoothstep(-0.30, -0.88, ring)
            window = W.smoothstep(bs0 - 0.04, bs0 + 0.03, s) * (1.0 - W.smoothstep(bs1 - 0.03, bs1 + 0.04, s))
            acc[i] = max(acc[i], A.BELLY_STRENGTH * down * window)
            # tail droplet highlight, on the upper half of the paddle
            up = W.smoothstep(-0.10, 0.62, ring)
            pw = W.smoothstep(ps0 - 0.012, ps0 + 0.016, s) * (1.0 - W.smoothstep(ps1 - 0.022, ps1 + 0.012, s))
            acc[i] = max(acc[i], 0.95 * up * pw)

    # pale brow patch wrapping over each eye
    brow = info["eye_centre"] + info["eye_up"] * A.BROW_LIFT + Vector(A.BROW_OUT)
    for _tag, mirror in SIDES:
        paint((brow.x * mirror, brow.y, brow.z), A.BROW_R, 1.0, parts=body_parts)
    # throat collar
    paint(A.THROAT["centre"], A.THROAT["r"], A.THROAT["strength"], parts=body_parts)
    return acc


# --------------------------------------------------------------------------- #
# 3. mesh object
# --------------------------------------------------------------------------- #


def make_mesh_object(mb, accent, coll):
    verts = [tuple(P(v)) for v in mb.verts]
    mesh = bpy.data.meshes.new("GEO_water_gecko")
    mesh.from_pydata(verts, [], mb.faces)

    uv1 = mesh.uv_layers.new(name="UVMap")
    uv2 = mesh.uv_layers.new(name="UVEye")
    assert len(uv1.data) == len(mb.uv1), (len(uv1.data), len(mb.uv1))
    for i, (a, b) in enumerate(zip(mb.uv1, mb.uv2)):
        uv1.data[i].uv = a
        uv2.data[i].uv = b
    for i, m in enumerate(mb.face_mat):
        mesh.polygons[i].material_index = m
    for p in mesh.polygons:
        p.use_smooth = True

    attr = mesh.attributes.new("accent", "FLOAT", "POINT")
    for i, a in enumerate(accent):
        attr.data[i].value = a

    # The same mask resolved to actual colours.  The shipped material reads
    # "accent" so the palette stays editable in one place, but glTF has no
    # equivalent of that node graph, so exporters get this baked layer.
    base, pale = srgb(A.COL_BODY), srgb(A.COL_ACCENT)
    col = mesh.attributes.new("Col", "FLOAT_COLOR", "POINT")
    for i, a in enumerate(accent):
        if mb.part[i].split(".")[0] in ("eye", "nostril", "mouth"):
            # glTF multiplies COLOR_0 into every base colour, so anything not
            # using the skin shader has to carry white or it gets tinted blue.
            col.data[i].color = (1.0, 1.0, 1.0, 1.0)
        else:
            col.data[i].color = tuple(base[c] + (pale[c] - base[c]) * a for c in range(3)) + (1.0,)

    mesh.validate(verbose=False)
    obj = bpy.data.objects.new("GEO_water_gecko", mesh)
    coll.objects.link(obj)

    # outward normals per island, then drop the exact duplicates the caps leave
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return obj


# --------------------------------------------------------------------------- #
# 4. materials (the eye "texture" is drawn procedurally with numpy)
# --------------------------------------------------------------------------- #


def make_eye_image(path, size=1024):
    import numpy as np

    px = (np.arange(size) + 0.5) / size
    X, Y = np.meshgrid((px - 0.5) * 2.0, (px - 0.5) * 2.0)  # row 0 = bottom
    aa = 3.0 / size

    def sstep(e0, e1, x):
        t = np.clip((x - e0) / (e1 - e0 + 1e-12), 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)

    dark = np.array(srgb(A.COL_EYE_DARK)[:3])
    dark_hi = np.array(srgb("#3E2C57")[:3])
    pink = np.array(srgb(A.COL_EYE_PINK)[:3])
    pink_lo = np.array(srgb(A.COL_EYE_PINK_LO)[:3])

    img = np.empty((size, size, 3), dtype=np.float32)
    # upper iris: near-black with a faint lift toward the crown
    lift = sstep(-0.1, 0.95, Y)[..., None]
    img[:] = dark * (1.0 - lift) + dark_hi * lift
    # lower iris: pink, brightening toward the rim
    pk = pink * (1.0 - sstep(-0.25, -0.95, Y)[..., None]) + pink_lo * sstep(-0.25, -0.95, Y)[..., None]
    split = -0.10 + 0.10 * X
    m = sstep(split + aa * 6, split - aa * 6, Y)[..., None]
    img[:] = img * (1.0 - m) + pk * m

    # The big downward "fang" catchlight.  It is kept inside r < 0.8 on
    # purpose: the dome's UV is radial (r = sin(polar angle)), so anything
    # drawn near the rim gets smeared along the silhouette.
    top, bot = 0.70, -0.24
    t = np.clip((Y - bot) / (top - bot), 0.0, 1.0)
    half = 0.132 * np.power(t, 0.62)
    axis = -0.22 + 0.05 * (1.0 - t)
    wedge = sstep(aa * 2.0, 0.0, np.abs(X - axis) - half) * (Y > bot) * (Y < top)
    cap = sstep(aa * 2.0, 0.0, np.sqrt((X + 0.22) ** 2 + (Y - top) ** 2) - 0.132)
    fang = np.maximum(wedge, cap)
    # a soft rim light along the top of the eyeball
    rad = np.sqrt(X * X + Y * Y)
    rim = sstep(0.62, 0.80, rad) * (1.0 - sstep(0.84, 0.94, rad)) * sstep(0.05, 0.6, Y) * sstep(0.55, -0.2, X)
    white = np.array([1.0, 1.0, 1.0])
    for mask, amount in ((fang, 1.0), (rim, 0.5)):
        mm = (mask * amount)[..., None]
        img[:] = img * (1.0 - mm) + white * mm

    # Vignette to a near-black rim.  The dome meets the skull at a shallow
    # angle, and without this the pink lower iris smears out onto the cheek.
    vig = sstep(0.80, 1.02, rad)[..., None]
    img *= 1.0 - 0.85 * vig

    rgba = np.ones((size, size, 4), dtype=np.float32)
    rgba[..., :3] = img
    image = bpy.data.images.new("TEX_gecko_eye", size, size, alpha=True)
    image.pixels.foreach_set(rgba.reshape(-1))
    image.filepath_raw = path
    image.file_format = "PNG"
    image.save()
    bpy.data.images.remove(image)
    out = bpy.data.images.load(path)
    out.name = "TEX_gecko_eye"
    out.pack()  # keep the .blend self-contained
    return out


def set_input(node, name, value):
    if name in node.inputs:
        node.inputs[name].default_value = value


def make_materials(eye_image):
    mats = []

    # ---- skin ------------------------------------------------------------- #
    m = bpy.data.materials.new("MAT_gecko_skin")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (520, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (200, 0)
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.location = (-40, -40)
    attr = nt.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "accent"
    attr.location = (-260, -40)
    mix.inputs[6].default_value = srgb(A.COL_BODY)
    mix.inputs[7].default_value = srgb(A.COL_ACCENT)
    nt.links.new(attr.outputs["Fac"], mix.inputs[0])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    set_input(bsdf, "Roughness", 0.28)
    set_input(bsdf, "IOR", 1.45)
    set_input(bsdf, "Coat Weight", 0.16)
    set_input(bsdf, "Coat Roughness", 0.06)
    set_input(bsdf, "Subsurface Weight", 0.06)
    set_input(bsdf, "Subsurface Radius", (0.28, 0.12, 0.05))
    set_input(bsdf, "Subsurface Scale", 0.02)
    mats.append(m)

    # ---- eye -------------------------------------------------------------- #
    m = bpy.data.materials.new("MAT_gecko_eye")
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (520, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (200, 0)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = eye_image
    tex.extension = "EXTEND"
    tex.location = (-140, 0)
    uv = nt.nodes.new("ShaderNodeUVMap")
    uv.uv_map = "UVEye"
    uv.location = (-360, 0)
    nt.links.new(uv.outputs["UV"], tex.inputs["Vector"])
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    set_input(bsdf, "Roughness", 0.20)
    set_input(bsdf, "Specular IOR Level", 0.32)
    set_input(bsdf, "Coat Weight", 0.0)
    mats.append(m)

    # ---- ink (mouth line, nostrils) --------------------------------------- #
    m = bpy.data.materials.new("MAT_gecko_ink")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    set_input(bsdf, "Base Color", srgb(A.COL_INK))
    set_input(bsdf, "Roughness", 0.42)
    set_input(bsdf, "Coat Weight", 0.2)
    mats.append(m)
    return mats


# --------------------------------------------------------------------------- #
# 5. skeleton
# --------------------------------------------------------------------------- #

Z_OFF = 0.0  # set once the geometry is known, so the feet land on z = 0


def P(v):
    """Anatomy space -> world: drop to the ground plane, then scale to metres."""
    return Vector((v[0], v[1], v[2] + Z_OFF)) * UNIT


def s_at_y(sweep, y):
    """Arc fraction of the point on a monotonic-in-Y centreline at height `y`."""
    dp, darc, ln = sweep._dp, sweep._darc, sweep.length
    if y <= dp[0].y:
        return 0.0
    if y >= dp[-1].y:
        return 1.0
    lo, hi = 0, len(dp) - 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if dp[mid].y <= y:
            lo = mid
        else:
            hi = mid
    span = dp[hi].y - dp[lo].y
    f = 0.0 if abs(span) < 1e-12 else (y - dp[lo].y) / span
    return W.lerp(darc[lo], darc[hi], f) / ln


def hinge_axis(a, b, c):
    """Bend-plane normal for joint b, oriented so +X rotation closes the joint."""
    n = (Vector(b) - Vector(a)).cross(Vector(c) - Vector(b))
    return n.normalized() if n.length > 1e-9 else Vector((1, 0, 0))


class Skeleton:
    """Thin wrapper that records the deform/control split while building bones."""

    def __init__(self, arm_obj):
        self.obj = arm_obj
        self.arm = arm_obj.data
        self.deform = []
        self.controls = []
        self.groups = {}

    def add(self, name, head, tail, parent=None, connect=False, deform=True, roll=(0, 0, 1), group=None):
        b = self.arm.edit_bones.new(name)
        b.head = P(head)
        b.tail = P(tail)
        if (b.tail - b.head).length < 1e-6:
            b.tail = b.head + Vector((0, 0, 0.01))
        b.align_roll(Vector(roll))
        if parent:
            b.parent = self.arm.edit_bones[parent]
            b.use_connect = connect
        b.use_deform = deform
        (self.deform if deform else self.controls).append(name)
        self.groups.setdefault(group or "Body", []).append(name)
        return b


def build_skeleton(sw, info, coll):
    body, arm, leg, ear = sw["body"], sw["arm"], sw["leg"], sw["ear"]
    ad = bpy.data.armatures.new("ARM_water_gecko")
    obj = bpy.data.objects.new("RIG_water_gecko", ad)
    coll.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    sk = Skeleton(obj)

    UP = (0, 0, 1)
    spine_s = {k: s_at_y(body, y) for k, y in A.SPINE_Y.items()}
    bp = lambda s: body.point_at_s(s)  # noqa: E731

    # ---- master controls -------------------------------------------------- #
    sk.add("root", (0, 0, 0.0), (0, -0.62, 0.0), deform=False, roll=UP, group="Controls")
    cog = bp(spine_s["spine1"])
    sk.add("ctrl_body", (0, cog.y, cog.z), (0, cog.y, cog.z + 0.34), "root", deform=False, roll=(0, -1, 0),
           group="Controls")

    # ---- spine, neck, head ------------------------------------------------ #
    chain = [
        ("pelvis", "pelvis", "spine1", "ctrl_body", False),
        ("spine_01", "spine1", "spine2", "pelvis", True),
        ("spine_02", "spine2", "chest", "spine_01", True),
        ("spine_03", "chest", "neck", "spine_02", True),
        ("neck", "neck", "skull", "spine_03", True),
        ("head", "skull", "head", "neck", True),
    ]
    for name, a, b, parent, conn in chain:
        sk.add(name, bp(spine_s[a]), bp(spine_s[b]), parent, conn, roll=UP,
               group="Head" if name in ("neck", "head") else "Body")

    sk.add("jaw", (0, -0.155, 0.600), (0, -0.680, 0.566), "head", roll=UP, group="Head")
    sk.add("crest", (0, -0.500, 0.868), (0, -0.196, 0.906), "head", roll=UP, group="Head")

    # ---- tail ------------------------------------------------------------- #
    prev = "pelvis"
    for i in range(len(A.TAIL_Y) - 1):
        name = "tail_%02d" % (i + 1)
        sk.add(name, bp(s_at_y(body, A.TAIL_Y[i])), bp(s_at_y(body, A.TAIL_Y[i + 1])), prev, i > 0, roll=UP,
               group="Tail")
        prev = name

    # ---- eyes, ear fins --------------------------------------------------- #
    ec, ea = info["eye_centre"], info["eye_axis"]
    ear_split = ear.s_of_u(A.EAR_BONE_SPLIT / (len(A.EAR) - 1))
    n_ear = Vector(A.EAR_UP).normalized()
    for tag, sx in SIDES:
        m = Vector((sx, 1, 1))
        sk.add("eye." + tag, ec * m, (ec + ea * 0.20) * m, "head", roll=(sx * UP[0], UP[1], UP[2]), group="Head")
        p0, p1, p2 = ear.point_at_s(0.0), ear.point_at_s(ear_split), ear.point_at_s(1.0)
        roll = (n_ear.x * sx, n_ear.y, n_ear.z)
        sk.add("ear_01." + tag, p0 * m, p1 * m, "head", False, roll=roll, group="Head")
        sk.add("ear_02." + tag, p1 * m, p2 * m, "ear_01." + tag, True, roll=roll, group="Head")

    # ---- limbs ------------------------------------------------------------ #
    limbs = {}
    for tag, sx in SIDES:
        m = Vector((sx, 1, 1))
        n_arm = hinge_axis(A.ARM[1]["pos"], A.ARM[3]["pos"], A.ARM[5]["pos"])
        n_arm = Vector((n_arm.x * sx, n_arm.y, n_arm.z))
        n_leg = hinge_axis(A.LEG[1]["pos"], A.LEG[3]["pos"], A.LEG[5]["pos"])
        n_leg = Vector((n_leg.x * sx, n_leg.y, n_leg.z))

        def roll_for(h, t, n):
            d = (P(t) - P(h)).normalized()
            r = n.cross(d)
            return r if r.length > 1e-6 else Vector(UP)

        ap = [Vector(st["pos"]) * m for st in A.ARM]
        lp = [Vector(st["pos"]) * m for st in A.LEG]
        for name, i0, i1, parent, conn, nn, grp in (
            ("clavicle", 0, 1, "spine_03", False, None, "Arms"),
            ("upperarm", 1, 3, "clavicle", True, n_arm, "Arms"),
            ("forearm", 3, 5, "upperarm", True, n_arm, "Arms"),
            ("hand", 5, 7, "forearm", True, n_arm, "Arms"),
        ):
            pn = parent if parent == "spine_03" else parent + "." + tag
            r = UP if nn is None else roll_for(ap[i0], ap[i1], nn)
            sk.add(name + "." + tag, ap[i0], ap[i1], pn, conn, roll=r, group=grp)
        for name, i0, i1, parent, conn, grp in (
            ("thigh", 1, 3, "pelvis", False, "Legs"),
            ("shin", 3, 5, "thigh", True, "Legs"),
            ("foot", 5, 7, "shin", True, "Legs"),
        ):
            pn = parent if parent == "pelvis" else parent + "." + tag
            sk.add(name + "." + tag, lp[i0], lp[i1], pn, conn, roll=roll_for(lp[i0], lp[i1], n_leg), group=grp)

        limbs[tag] = dict(arm=ap, leg=lp, n_arm=n_arm, n_leg=n_leg,
                          hand_roll=roll_for(ap[5], ap[7], n_arm), foot_roll=roll_for(lp[5], lp[7], n_leg))

        # ---- digits ------------------------------------------------------- #
        for kind, parent in (("finger", "hand"), ("toe", "foot")):
            for n in range(1, 5):
                s = sw["%s%d" % (kind, n)]
                q = [Vector(st["pos"]) * m for st in s.stations]
                d = (q[4] - q[0]).normalized()
                roll = Vector(UP).cross(d)
                base = "%s%d" % (kind, n)
                sk.add(base + "_01." + tag, q[0], q[2], parent + "." + tag, False, roll=roll, group="Digits")
                sk.add(base + "_02." + tag, q[2], q[4], base + "_01." + tag, True, roll=roll, group="Digits")

    # ---- IK controls ------------------------------------------------------ #
    for tag, sx in SIDES:
        d = limbs[tag]
        ap, lp = d["arm"], d["leg"]
        sk.add("ctrl_hand_ik." + tag, ap[5], ap[7], "root", False, deform=False, roll=d["hand_roll"],
               group="Controls")
        sk.add("ctrl_foot_ik." + tag, lp[5], lp[7], "root", False, deform=False, roll=d["foot_roll"],
               group="Controls")
        for nm, a, b, c in (("ctrl_elbow", ap[1], ap[3], ap[5]), ("ctrl_knee", lp[1], lp[3], lp[5])):
            mid = (a + c) * 0.5
            out = (b - mid)
            out = out.normalized() if out.length > 1e-6 else Vector((0, 1, 0))
            pos = b + out * 0.34
            sk.add(nm + "." + tag, pos, pos + out * 0.14, "root", False, deform=False, roll=UP, group="Controls")

    eyes_at = ec + ea * 0.0 + Vector((0, -0.90, 0.06))
    sk.add("ctrl_eyes", (0, eyes_at.y, eyes_at.z), (0, eyes_at.y - 0.16, eyes_at.z), "head", False, deform=False,
           roll=UP, group="Controls")

    bpy.ops.object.mode_set(mode="OBJECT")

    # bone collections + colours, so the rig is navigable in the outliner
    palette = dict(Body="THEME03", Head="THEME04", Tail="THEME06", Arms="THEME01", Legs="THEME02",
                   Digits="THEME09", Controls="THEME05")
    for grp, names in sk.groups.items():
        bc = ad.collections.new(grp)
        for n in names:
            bc.assign(ad.bones[n])
            ad.bones[n].color.palette = palette.get(grp, "DEFAULT")
    obj.show_in_front = True
    ad.display_type = "OCTAHEDRAL"
    return obj, sk, limbs


# --------------------------------------------------------------------------- #
# 6. constraints: two-bone IK per limb, eye aim, IK/FK sliders
# --------------------------------------------------------------------------- #


def bone_error(rig, names):
    """How far the solved pose sits from the rest pose (0 == exact match)."""
    dg = bpy.context.evaluated_depsgraph_get()
    ev = rig.evaluated_get(dg)
    err = 0.0
    for n in names:
        pb = ev.pose.bones[n]
        rb = rig.data.bones[n]
        err = max(err, (pb.head - rb.head_local).length, (pb.tail - rb.tail_local).length)
    return err


def tune_pole_angle(rig, con, chain):
    """Pick the pole angle that leaves the rest pose untouched.

    Deriving it analytically is easy to get subtly wrong (and a wrong pole
    angle silently twists the whole limb), so solve for it instead: sweep the
    circle, keep the angle whose solved pose matches the rest pose, refine.
    """
    best, best_err = 0.0, 1e9
    for k in range(72):
        ang = -math.pi + 2.0 * math.pi * k / 72
        con.pole_angle = ang
        err = bone_error(rig, chain)
        if err < best_err:
            best, best_err = ang, err
    step = 2.0 * math.pi / 72
    for _ in range(6):
        step *= 0.4
        for ang in (best - step, best + step):
            con.pole_angle = ang
            err = bone_error(rig, chain)
            if err < best_err:
                best, best_err = ang, err
    con.pole_angle = best
    return best, best_err


def add_constraints(rig):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="POSE")
    pose = rig.pose
    report = []

    # IK/FK blend sliders live on the root bone as custom properties
    rb = pose.bones["root"]
    for prop, desc in (("ik_front", "Front limbs: 0 = FK, 1 = IK"), ("ik_hind", "Hind limbs: 0 = FK, 1 = IK")):
        rb[prop] = 1.0
        rb.id_properties_ui(prop).update(min=0.0, max=1.0, description=desc)

    def drive(con, prop):
        fcu = con.driver_add("influence")
        drv = fcu.driver
        drv.type = "SCRIPTED"
        var = drv.variables.new()
        var.name = "v"
        var.type = "SINGLE_PROP"
        var.targets[0].id = rig
        var.targets[0].data_path = 'pose.bones["root"]["%s"]' % prop
        drv.expression = "v"

    for tag, _sx in SIDES:
        for lower, upper, end, ctrl, pole, prop in (
            ("forearm", "upperarm", "hand", "ctrl_hand_ik", "ctrl_elbow", "ik_front"),
            ("shin", "thigh", "foot", "ctrl_foot_ik", "ctrl_knee", "ik_hind"),
        ):
            lo = pose.bones["%s.%s" % (lower, tag)]
            up = pose.bones["%s.%s" % (upper, tag)]
            con = lo.constraints.new("IK")
            con.target = rig
            con.subtarget = "%s.%s" % (ctrl, tag)
            con.pole_target = rig
            con.pole_subtarget = "%s.%s" % (pole, tag)
            con.chain_count = 2
            con.use_stretch = False
            ang, err = tune_pole_angle(rig, con, [up.name, lo.name])
            report.append("  %-14s pole %+7.2f deg   rest error %.6f m" % (lo.name, math.degrees(ang), err))
            # hinge: the mid joint bends on X only, and cannot hyper-extend
            lo.lock_ik_y = True
            lo.lock_ik_z = True
            lo.use_ik_limit_x = True
            lo.ik_min_x = math.radians(-4.0)
            lo.ik_max_x = math.radians(152.0)
            # keep the hand/foot planted with the control instead of the forearm
            eb = pose.bones["%s.%s" % (end, tag)]
            cr = eb.constraints.new("COPY_ROTATION")
            cr.target = rig
            cr.subtarget = "%s.%s" % (ctrl, tag)
            cr.target_space = "WORLD"
            cr.owner_space = "WORLD"
            drive(con, prop)
            drive(cr, prop)

        # eyes aim at a single control in front of the face
        eye = pose.bones["eye." + tag]
        tt = eye.constraints.new("DAMPED_TRACK")
        tt.target = rig
        tt.subtarget = "ctrl_eyes"
        tt.track_axis = "TRACK_Y"

    # Euler channels: easier to key by hand and to drive from a script than
    # quaternions, and this rig has no chain that needs to spin past 180 deg.
    for pb in pose.bones:
        pb.rotation_mode = "XYZ"

    for tag, _sx in SIDES:
        for name in ("ctrl_hand_ik", "ctrl_foot_ik", "ctrl_elbow", "ctrl_knee"):
            rig.data.bones["%s.%s" % (name, tag)].show_wire = True
    for name in ("root", "ctrl_body", "ctrl_eyes"):
        rig.data.bones[name].show_wire = True

    bpy.ops.object.mode_set(mode="OBJECT")
    return report


# --------------------------------------------------------------------------- #
# 7. skin weights, derived from the sweep parameter rather than guessed
# --------------------------------------------------------------------------- #

MAX_INFLUENCES = 4


def h_maker(sweep, k=0.62, lo=0.006, hi=0.060):
    """Blend half-width at a boundary, scaled by how thick the body is there."""

    def h(s):
        p = sweep.params_at(sweep.u_at_s(s))
        return W.clamp(k * (p["rx"] + p["rz"]) * 0.5 / sweep.length, lo, hi)

    return h


def segment_weights(segs, s, h_fn):
    w = {}
    for name, a, b in segs:
        val = 1.0
        if a > 1e-6:
            ha = max(h_fn(a), 1e-5)
            val *= W.smoothstep(a - ha, a + ha, s)
        if b < 1.0 - 1e-6:
            hb = max(h_fn(b), 1e-5)
            val *= 1.0 - W.smoothstep(b - hb, b + hb, s)
        if val > 1e-4:
            w[name] = w.get(name, 0.0) + val
    total = sum(w.values())
    if total < 1e-6:
        nearest = min(segs, key=lambda sg: abs(s - (sg[1] + sg[2]) * 0.5))[0]
        return {nearest: 1.0}
    return {k: v / total for k, v in w.items()}


def weight_spec(sw):
    """part name -> ('seg', sweep, segments) or ('rigid', bone, None)."""
    body = sw["body"]
    ss = {k: s_at_y(body, y) for k, y in A.SPINE_Y.items()}
    segs = [
        ("head", 0.0, ss["skull"]),
        ("neck", ss["skull"], ss["neck"]),
        ("spine_03", ss["neck"], ss["chest"]),
        ("spine_02", ss["chest"], ss["spine2"]),
        ("spine_01", ss["spine2"], ss["spine1"]),
        ("pelvis", ss["spine1"], ss["pelvis"]),
    ]
    last = len(A.TAIL_Y) - 2
    for i in range(last + 1):
        a = s_at_y(body, A.TAIL_Y[i])
        b = 1.0 if i == last else s_at_y(body, A.TAIL_Y[i + 1])
        segs.append(("tail_%02d" % (i + 1), a, b))

    spec = {"body": ("seg", body, segs)}

    arm, leg = sw["arm"], sw["leg"]
    a_s = [arm.s_of_u(i / (len(A.ARM) - 1)) for i in range(len(A.ARM))]
    l_s = [leg.s_of_u(i / (len(A.LEG) - 1)) for i in range(len(A.LEG))]
    for tag, _sx in SIDES:
        spec["arm." + tag] = (
            "seg",
            arm,
            [
                ("clavicle." + tag, 0.0, a_s[1]),
                ("upperarm." + tag, a_s[1], a_s[3]),
                ("forearm." + tag, a_s[3], a_s[5]),
                ("hand." + tag, a_s[5], 1.0),
            ],
        )
        spec["leg." + tag] = (
            "seg",
            leg,
            [
                ("pelvis", 0.0, l_s[1]),
                ("thigh." + tag, l_s[1], l_s[3]),
                ("shin." + tag, l_s[3], l_s[5]),
                ("foot." + tag, l_s[5], 1.0),
            ],
        )
        for kind, parent in (("finger", "hand"), ("toe", "foot")):
            for n in range(1, 5):
                base = "%s%d" % (kind, n)
                s = sw[base]
                mid = s.s_of_u(A.DIGIT_BONE_SPLIT / (len(s.stations) - 1))
                spec["%s.%s" % (base, tag)] = (
                    "seg",
                    s,
                    [
                        ("%s.%s" % (parent, tag), 0.0, 0.11),
                        ("%s_01.%s" % (base, tag), 0.11, mid),
                        ("%s_02.%s" % (base, tag), mid, 1.0),
                    ],
                )
        ear = sw["ear"]
        esp = ear.s_of_u(A.EAR_BONE_SPLIT / (len(A.EAR) - 1))
        spec["ear." + tag] = (
            "seg",
            ear,
            [("head", 0.0, 0.10), ("ear_01." + tag, 0.10, esp), ("ear_02." + tag, esp, 1.0)],
        )
        spec["eye." + tag] = ("rigid", "eye." + tag, None)
        spec["nostril." + tag] = ("rigid", "head", None)
    spec["crest"] = ("rigid", "crest", None)
    spec["mouth"] = ("rigid", "head", None)
    return spec


def compute_weights(mb, sw):
    spec = weight_spec(sw)
    hfns = {}
    out = []
    for i in range(len(mb.verts)):
        part = mb.part[i]
        kind, a, b = spec[part]
        if kind == "rigid":
            out.append({a: 1.0})
            continue
        if id(a) not in hfns:
            hfns[id(a)] = h_maker(a)
        out.append(segment_weights(b, mb.sval[i], hfns[id(a)]))

    # ---- jaw: hand the chin and throat-front over to the jaw bone --------- #
    hinge = Vector((0, -0.155, 0.600))
    plane = Vector((0, -0.20, 1)).normalized()
    for i, v in enumerate(mb.verts):
        w = out[i]
        if "head" not in w:
            continue
        below = W.smoothstep(0.030, -0.055, (v - hinge).dot(plane))
        front = W.smoothstep(-0.030, 0.070, hinge.y - v.y)
        m = below * front
        if m > 1e-4:
            take = w["head"] * m
            w["head"] -= take
            w["jaw"] = w.get("jaw", 0.0) + take

    # ---- let the torso skin follow the shoulder and hip a little ---------- #
    bleeds = []
    for tag, sx in SIDES:
        bleeds.append((Vector(A.ARM[1]["pos"]) * Vector((sx, 1, 1)), "upperarm." + tag, 0.20, 0.32))
        bleeds.append((Vector(A.LEG[1]["pos"]) * Vector((sx, 1, 1)), "thigh." + tag, 0.22, 0.32))
    for i, v in enumerate(mb.verts):
        if mb.part[i] != "body":
            continue
        w = out[i]
        for centre, bone, radius, peak in bleeds:
            d = (v - centre).length
            if d < radius:
                f = peak * W.smoothstep(radius, radius * 0.30, d)
                if f > 1e-4:
                    w[bone] = w.get(bone, 0.0) + f

    # ---- prune to 4 influences and normalise ------------------------------ #
    for i, w in enumerate(out):
        items = sorted(w.items(), key=lambda kv: -kv[1])[:MAX_INFLUENCES]
        total = sum(v for _, v in items) or 1.0
        out[i] = {k: v / total for k, v in items if v / total > 1e-4}
    return out


def apply_weights(obj, weights, deform_bones):
    groups = {n: obj.vertex_groups.new(name=n) for n in deform_bones}
    used = set()
    for i, w in enumerate(weights):
        for name, val in w.items():
            groups[name].add([i], val, "REPLACE")
            used.add(name)
    return sorted(set(deform_bones) - used)


# --------------------------------------------------------------------------- #
# 8. control widgets
# --------------------------------------------------------------------------- #


def make_widgets(coll, rig):
    def widget(name, kind):
        bm = bmesh.new()
        if kind == "cube":
            bmesh.ops.create_cube(bm, size=1.0)
        elif kind == "ring":
            bmesh.ops.create_circle(bm, cap_ends=False, segments=24, radius=1.0)
            bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
        else:
            bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(name, me)
        coll.objects.link(ob)
        return ob

    cube = widget("WGT_cube", "cube")
    ring = widget("WGT_ring", "ring")
    ball = widget("WGT_ball", "ball")

    def assign(bone, shape, scale, offset=(0, 0, 0)):
        pb = rig.pose.bones.get(bone)
        if not pb:
            return
        pb.custom_shape = shape
        pb.use_custom_shape_bone_size = False
        pb.custom_shape_scale_xyz = (scale, scale, scale)
        pb.custom_shape_translation = offset

    assign("root", ring, 0.30)
    assign("ctrl_body", ring, 0.16)
    assign("ctrl_eyes", ball, 0.030)
    for tag, _sx in SIDES:
        assign("ctrl_hand_ik." + tag, cube, 0.030)
        assign("ctrl_foot_ik." + tag, cube, 0.032)
        assign("ctrl_elbow." + tag, ball, 0.018)
        assign("ctrl_knee." + tag, ball, 0.018)


# --------------------------------------------------------------------------- #
# 9. a lit scene so the .blend renders as-is
# --------------------------------------------------------------------------- #


def build_preview_scene():
    scene = bpy.context.scene
    coll = new_collection("PREVIEW")

    target = bpy.data.objects.new("CAM_target", None)
    target.location = (0.0, 0.010, 0.085)
    coll.objects.link(target)

    cam_data = bpy.data.cameras.new("CAM_preview")
    cam_data.lens = 70.0
    cam = bpy.data.objects.new("CAM_preview", cam_data)
    cam.location = (0.62, -0.78, 0.34)
    coll.objects.link(cam)
    con = cam.constraints.new("TRACK_TO")
    con.target = target
    scene.camera = cam

    for name, loc, size, power, temp in (
        ("KEY", (-0.9, -1.1, 1.1), 1.4, 130.0, (1.0, 0.97, 0.92)),
        ("FILL", (1.3, -0.7, 0.35), 1.6, 42.0, (0.86, 0.93, 1.0)),
        ("RIM", (0.3, 1.5, 1.0), 1.2, 85.0, (0.88, 0.95, 1.0)),
    ):
        ld = bpy.data.lights.new("LGT_" + name, "AREA")
        ld.energy = power
        ld.size = size
        ld.color = temp
        lo = bpy.data.objects.new("LGT_" + name, ld)
        lo.location = loc
        coll.objects.link(lo)
        lc = lo.constraints.new("TRACK_TO")
        lc.target = target

    floor = bpy.data.meshes.new("GEO_floor")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=6.0)
    bm.to_mesh(floor)
    bm.free()
    fo = bpy.data.objects.new("GEO_floor", floor)
    coll.objects.link(fo)
    fm = bpy.data.materials.new("MAT_floor")
    fm.use_nodes = True
    bsdf = fm.node_tree.nodes["Principled BSDF"]
    set_input(bsdf, "Base Color", srgb("#E9EEF2"))
    set_input(bsdf, "Roughness", 0.55)
    floor.materials.append(fm)

    world = bpy.data.worlds.new("WRL_preview")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = srgb("#DCE7F0")
    bg.inputs["Strength"].default_value = 0.35
    scene.world = world

    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1000
    scene.render.film_transparent = False
    # AgX desaturates a saturated character to near white; the Khronos neutral
    # transform keeps the blue while still rolling off the speculars.
    try:
        scene.view_settings.view_transform = "Khronos PBR Neutral"
    except TypeError:
        scene.view_settings.view_transform = "Standard"
    return cam


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #


def main():
    global Z_OFF
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    out = argv[argv.index("--out") + 1] if "--out" in argv else os.path.join(DIR, "water_gecko.blend")
    out = os.path.abspath(out)
    outdir = os.path.dirname(out)
    os.makedirs(outdir, exist_ok=True)

    wipe_scene()
    coll = new_collection("WaterGecko")
    wcoll = new_collection("WGT_widgets", hide=True)

    mb, sw, info = build_geometry()
    accent = paint_accents(mb, sw, info)
    Z_OFF = -min(v.z for v in mb.verts)

    eye_img = make_eye_image(os.path.join(outdir, "tex_gecko_eye.png"))
    mats = make_materials(eye_img)
    obj = make_mesh_object(mb, accent, coll)
    for m in mats:
        obj.data.materials.append(m)

    rig, sk, _limbs = build_skeleton(sw, info, coll)
    report = add_constraints(rig)
    make_widgets(wcoll, rig)

    weights = compute_weights(mb, sw)
    unused = apply_weights(obj, weights, sk.deform)

    amod = obj.modifiers.new("Armature", "ARMATURE")
    amod.object = rig
    smod = obj.modifiers.new("Subdivision", "SUBSURF")
    smod.levels = SUBDIV_VIEW
    smod.render_levels = SUBDIV_RENDER
    obj.parent = rig

    build_preview_scene()

    # A ready-made walk is stashed in the file (fake user, not assigned) so the
    # rest pose is what you see on open.  water_gecko_walk.blend has it live.
    action, last, n_bones = walkcycle.build_walk(rig)
    bpy.context.scene.frame_start = 1
    bpy.context.scene.frame_end = last
    bpy.context.scene.render.fps = 24
    for pb in rig.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    walk_path = out.replace(".blend", "_walk.blend")
    bpy.ops.wm.save_as_mainfile(filepath=walk_path, compress=True)
    # Stash it the way Blender's own "Stash" button does: a muted NLA track, so
    # the action is one click away in the Action Editor without posing the rig.
    rig.animation_data.action = None
    track = rig.animation_data.nla_tracks.new()
    track.name = "[Action Stash]"
    track.strips.new(action.name, 1, action)
    track.mute = True
    bpy.context.view_layer.objects.active = rig
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)

    print("\n=== water gecko ===")
    print("cage verts %d   faces %d" % (len(obj.data.vertices), len(obj.data.polygons)))
    print("bones %d deform / %d control" % (len(sk.deform), len(sk.controls)))
    dims = obj.dimensions
    print("size  x %.3f  y %.3f  z %.3f m" % (dims.x, dims.y, dims.z))
    print("IK solve:")
    for line in report:
        print(line)
    if unused:
        print("WARNING bones with no skin weights: %s" % ", ".join(unused))
    print("walk cycle: %d frames, %d bones keyed" % (last, n_bones))
    print("saved %s" % out)
    print("saved %s" % walk_path)


main()
