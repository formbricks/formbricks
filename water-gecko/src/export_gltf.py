"""Exports a portable GLB (subdivided, skinned, with the walk baked in).

    blender -b water_gecko_walk.blend --python export_gltf.py -- --out water_gecko.glb

glTF cannot carry the shipped skin material (its base colour comes from an
Attribute node) nor the rig's IK constraints and drivers.  So this swaps in
equivalent vertex-colour materials and forces the animation to be sampled per
frame, which bakes the IK solve into plain bone transforms.
"""

import os
import sys

import bpy

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
OUT = os.path.abspath(argv[argv.index("--out") + 1] if "--out" in argv else "water_gecko.glb")
LEVEL = int(argv[argv.index("--subdiv") + 1] if "--subdiv" in argv else 1)

geo = bpy.data.objects["GEO_water_gecko"]
rig = bpy.data.objects["RIG_water_gecko"]

# the preview set is scaffolding, not part of the asset
for name in ("PREVIEW", "WGT_widgets"):
    coll = bpy.data.collections.get(name)
    if coll:
        for ob in list(coll.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.collections.remove(coll)

for m in geo.modifiers:
    if m.type == "SUBSURF":
        m.levels = LEVEL

# swap the Attribute-driven skin shader for a vertex-colour one glTF understands
skin = geo.data.materials[0]
nt = skin.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
for link in list(bsdf.inputs["Base Color"].links):
    nt.links.remove(link)
vcol = nt.nodes.new("ShaderNodeVertexColor")
vcol.layer_name = "Col"
vcol.location = (-40, -40)
nt.links.new(vcol.outputs["Color"], bsdf.inputs["Base Color"])

for ob in bpy.data.objects:
    ob.select_set(ob in (geo, rig))
bpy.context.view_layer.objects.active = rig

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_apply=True,  # bakes subdivision; armature modifiers are kept
    export_yup=True,
    export_animations=True,
    export_force_sampling=True,  # bakes the IK solve into bone transforms
    export_skins=True,
    export_def_bones=False,
    export_vertex_color="MATERIAL",
    export_vertex_color_name="Col",
)
print("wrote %s (%.1f MB)" % (OUT, os.path.getsize(OUT) / 1e6))
