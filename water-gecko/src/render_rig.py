"""Renders the skeleton inside a ghosted body.

    blender -b water_gecko.blend --python render_rig.py -- --outdir rig

Bones are viewport-only in Blender, so Cycles cannot see them.  This rebuilds
each one as the same octahedral solid the viewport draws and renders that
through a translucent copy of the skin.
"""

import math
import os
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


OUT = os.path.abspath(arg("--outdir", "rig"))
W = int(arg("--width", 880))
H = int(arg("--height", 560))
SAMPLES = int(arg("--samples", 40))
os.makedirs(OUT, exist_ok=True)

rig = bpy.data.objects["RIG_water_gecko"]
geo = bpy.data.objects["GEO_water_gecko"]


def emissive(name, rgb, strength, alpha=1.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = rgb + (1.0,)
    bsdf.inputs["Roughness"].default_value = 0.35
    bsdf.inputs["Emission Color"].default_value = rgb + (1.0,)
    bsdf.inputs["Emission Strength"].default_value = strength
    bsdf.inputs["Alpha"].default_value = alpha
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m


MATS = [
    emissive("MAT_bone_deform", (1.00, 0.46, 0.06), 5.0),
    emissive("MAT_bone_ctrl", (0.10, 0.72, 1.00), 6.0),
]

bm = bmesh.new()
layer_faces = []


def octahedron(head, tail, xax, zax, thin=1.0):
    d = tail - head
    L = d.length
    if L < 1e-6:
        return []
    y = d / L
    r = L * 0.11 * thin
    ring = [head + y * (L * 0.12) + xax * r, head + y * (L * 0.12) + zax * r,
            head + y * (L * 0.12) - xax * r, head + y * (L * 0.12) - zax * r]
    vh = bm.verts.new(head)
    vt = bm.verts.new(tail)
    vr = [bm.verts.new(p) for p in ring]
    out = []
    for i in range(4):
        j = (i + 1) % 4
        out.append(bm.faces.new((vh, vr[i], vr[j])))
        out.append(bm.faces.new((vr[j], vr[i], vt)))
    return out


for bone in rig.data.bones:
    m = bone.matrix_local
    xax = Vector((m[0][0], m[1][0], m[2][0])).normalized()
    zax = Vector((m[0][2], m[1][2], m[2][2])).normalized()
    idx = 0 if bone.use_deform else 1
    for f in octahedron(bone.head_local.copy(), bone.tail_local.copy(), xax, zax, 1.0 if idx == 0 else 0.7):
        layer_faces.append((f, idx))

me = bpy.data.meshes.new("GEO_bones")
bm.to_mesh(me)
bm.free()
for m in MATS:
    me.materials.append(m)
for i, (_f, idx) in enumerate(layer_faces):
    me.polygons[i].material_index = idx
bones_obj = bpy.data.objects.new("GEO_bones", me)
bones_obj.matrix_world = rig.matrix_world
bpy.context.scene.collection.objects.link(bones_obj)

# ghost the skin so the skeleton shows through
ghost = bpy.data.materials.new("MAT_ghost")
ghost.use_nodes = True
gn = ghost.node_tree
gn.nodes.clear()
gout = gn.nodes.new("ShaderNodeOutputMaterial")
mixer = gn.nodes.new("ShaderNodeMixShader")
transp = gn.nodes.new("ShaderNodeBsdfTransparent")
glow = gn.nodes.new("ShaderNodeEmission")
glow.inputs["Color"].default_value = (0.30, 0.66, 1.0, 1.0)
glow.inputs["Strength"].default_value = 1.2
fres = gn.nodes.new("ShaderNodeFresnel")
fres.inputs["IOR"].default_value = 1.5
ramp = gn.nodes.new("ShaderNodeMapRange")
ramp.inputs["From Min"].default_value = 0.0
ramp.inputs["From Max"].default_value = 1.0
ramp.inputs["To Min"].default_value = 0.06
ramp.inputs["To Max"].default_value = 0.70
gn.links.new(fres.outputs["Fac"], ramp.inputs["Value"])
gn.links.new(ramp.outputs["Result"], mixer.inputs[0])
gn.links.new(transp.outputs["BSDF"], mixer.inputs[1])
gn.links.new(glow.outputs["Emission"], mixer.inputs[2])
gn.links.new(mixer.outputs["Shader"], gout.inputs["Surface"])
geo.data.materials.clear()
geo.data.materials.append(ghost)

# a dark studio: the bones carry their own light, so anything else just washes
# the diagram out
for name in ("GEO_floor", "LGT_KEY", "LGT_FILL", "LGT_RIM"):
    ob = bpy.data.objects.get(name)
    if ob:
        bpy.data.objects.remove(ob, do_unlink=True)
world = bpy.context.scene.world
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.012, 0.020, 0.032, 1.0)
bg.inputs["Strength"].default_value = 1.0

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.transparent_max_bounces = 32
scene.view_settings.view_transform = "Standard"
scene.render.film_transparent = False
scene.render.resolution_x = W
scene.render.resolution_y = H
cam = bpy.data.objects["CAM_preview"]
cam.data.type = "PERSP"
cam.data.lens = 72.0
bpy.data.objects["CAM_target"].location = (0.0, 0.055, 0.078)

paths = []
for name, loc in (("rig_side", (0.95, 0.06, 0.16)), ("rig_quarter", (0.62, -0.50, 0.34)),
                  ("rig_top", (0.02, 0.055, 0.85)), ("rig_front", (0.10, -0.62, 0.20))):
    cam.location = loc
    scene.render.filepath = os.path.join(OUT, "%s.png" % name)
    bpy.ops.render.render(write_still=True)
    paths.append(scene.render.filepath)
    print("rendered", name)

tiles = []
for p in paths:
    img = bpy.data.images.load(p)
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    tiles.append(buf.reshape(h, w, 4)[::-1])
    bpy.data.images.remove(img)
h, w = tiles[0].shape[:2]
out = np.zeros((2 * h, 2 * w, 4), dtype=np.float32)
for i, t in enumerate(tiles):
    r, c = divmod(i, 2)
    out[r * h : (r + 1) * h, c * w : (c + 1) * w] = t
res = bpy.data.images.new("sheet", 2 * w, 2 * h, alpha=True)
res.pixels.foreach_set(out[::-1].reshape(-1))
res.filepath_raw = os.path.join(OUT, "rig_sheet.png")
res.file_format = "PNG"
res.save()
print("sheet", res.filepath_raw)
