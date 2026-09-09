"""Renders the stashed walk cycle to a PNG sequence, a contact sheet and a WebM.

    blender -b water_gecko_walk.blend --python render_anim.py -- --outdir walk
"""

import os
import sys

import bpy
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


OUT = os.path.abspath(arg("--outdir", "walk"))
FRAMES = os.path.join(OUT, "frames")
W = int(arg("--width", 620))
H = int(arg("--height", 400))
SAMPLES = int(arg("--samples", 26))
os.makedirs(FRAMES, exist_ok=True)

scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = SAMPLES
scene.cycles.use_adaptive_sampling = True
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 5
scene.render.resolution_x = W
scene.render.resolution_y = H
scene.render.fps = 24
scene.render.image_settings.file_format = "PNG"

# frame the whole 30 cm of travel, from a three-quarter side so the gait reads
cam = bpy.data.objects["CAM_preview"]
cam.data.type = "PERSP"
cam.data.lens = 40.0
cam.location = (0.80, -0.42, 0.240)
bpy.data.objects["CAM_target"].location = (0.0, -0.060, 0.075)

scene.render.filepath = os.path.join(FRAMES, "f_")
bpy.ops.render.render(animation=True)
print("frames rendered to", FRAMES)

# ---- contact sheet of the cycle ------------------------------------------- #
names = sorted(f for f in os.listdir(FRAMES) if f.endswith(".png"))
picks = [names[i] for i in range(0, min(len(names), 33), 4)]  # just over one cycle
tiles = []
for n in picks:
    img = bpy.data.images.load(os.path.join(FRAMES, n))
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    tiles.append(buf.reshape(h, w, 4)[::-1])
    bpy.data.images.remove(img)
cols = 3
rows = (len(tiles) + cols - 1) // cols
h, w = tiles[0].shape[:2]
sheet = np.ones((rows * h, cols * w, 4), dtype=np.float32)
for i, t in enumerate(tiles):
    r, c = divmod(i, cols)
    sheet[r * h : (r + 1) * h, c * w : (c + 1) * w] = t
res = bpy.data.images.new("sheet", cols * w, rows * h, alpha=True)
res.pixels.foreach_set(sheet[::-1].reshape(-1))
res.filepath_raw = os.path.join(OUT, "walk_sheet.png")
res.file_format = "PNG"
res.save()
print("sheet", res.filepath_raw)

# ---- encode with Blender's own ffmpeg via the sequencer -------------------- #
enc = bpy.data.scenes.new("ENCODE")
enc.render.resolution_x = W
enc.render.resolution_y = H
enc.render.fps = 24
enc.frame_start = 1
enc.frame_end = len(names)
enc.sequence_editor_create()
strip = enc.sequence_editor.sequences.new_image("walk", os.path.join(FRAMES, names[0]), 1, 1)
for n in names[1:]:
    strip.elements.append(n)
enc.render.image_settings.file_format = "FFMPEG"
enc.render.ffmpeg.format = "WEBM"
enc.render.ffmpeg.codec = "WEBM"  # Blender names the VP9 encoder "WEBM"
enc.render.ffmpeg.constant_rate_factor = "HIGH"
enc.render.ffmpeg.audio_codec = "NONE"
enc.render.filepath = os.path.join(OUT, "water_gecko_walk.webm")
bpy.context.window.scene = enc
bpy.ops.render.render(animation=True)
print("video", enc.render.filepath)
