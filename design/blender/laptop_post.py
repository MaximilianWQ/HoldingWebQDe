"""Laptop frames -> site assets (needs Pillow and numpy).

python design/blender/laptop_post.py <dir with f0001..f0120.png> public/media/laptop [total byte budget]

Blender renders 1400 x 900 RGBA (transparent film, soft shadow on a
shadow catcher). Here each frame is laid over white (the page is white),
the shadow tail is faded to pure white at the frame edge, and the sequence
is encoded as opaque WebP with ONE quality for the whole sequence (no
flicker between neighbours; every frame <= LIMIT bytes and the sequence
<= the total budget, default 1.3 x the former 60-frame set). The last frame is also
the poster (JPEG). LaptopScrub.tsx and home-v5.css expect exactly this:
f000..f119.webp + poster.jpg, 1400 x 900, no alpha.
"""
import glob, io, os, sys
import numpy as np
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
LIMIT = 40000
BUDGET = int(sys.argv[3]) if len(sys.argv) > 3 else 1730000
os.makedirs(OUT, exist_ok=True)

BAND = 48
_y = np.minimum(np.arange(900), np.arange(900)[::-1]); _x = np.minimum(np.arange(1400), np.arange(1400)[::-1])
_d = np.minimum(_y[:, None], _x[None, :]).astype(np.float64)
EDGE = np.clip((_d - 6) / (BAND - 6), 0, 1); EDGE = EDGE * EDGE * (3 - 2 * EDGE)
srcs = sorted(glob.glob(os.path.join(SRC, "f*.png")))
N = len(srcs)
assert N >= 2, N
frames = []
for p in srcs:
    a = np.asarray(Image.open(p)).astype(np.float64)
    a /= 65535.0 if a.max() > 255 else 255.0
    o = a[..., :3] * a[..., 3:4] + (1.0 - a[..., 3:4])      # alpha over white
    o = 1.0 - (1.0 - o) * EDGE[..., None]                   # shadow tail -> white at the edge
    frames.append(Image.fromarray(np.clip(np.round(o * 255), 0, 255).astype(np.uint8), "RGB"))

def enc(img, q):
    b = io.BytesIO(); img.save(b, "WEBP", quality=q, method=6); return b.getvalue()

best = None
for q in range(95, 30, -1):
    sizes = [len(enc(f, q)) for f in frames]
    if max(sizes) <= LIMIT and sum(sizes) <= BUDGET:
        best = q
        break
print("quality", best, "max", max(sizes), "total", sum(sizes))

for old in glob.glob(os.path.join(OUT, "f*.webp")):
    os.remove(old)
for i, f in enumerate(frames):
    with open(os.path.join(OUT, "f%03d.webp" % i), "wb") as fh:
        fh.write(enc(f, best))
frames[-1].save(os.path.join(OUT, "poster.jpg"), "JPEG", quality=88, optimize=True, progressive=True, subsampling=0)

dec = [np.asarray(Image.open(os.path.join(OUT, "f%03d.webp" % i)).convert("RGB")).astype(np.int16) for i in range(N)]
edge = min(int(min(d.min(axis=2)[0].min(), d.min(axis=2)[-1].min(), d.min(axis=2)[:, 0].min(), d.min(axis=2)[:, -1].min())) for d in dec)
diffs = [float(np.abs(dec[i + 1] - dec[i]).mean()) for i in range(N - 1)]
print("min edge value (want 255):", edge)
print("neighbour diff: min %.2f max %.2f" % (min(diffs), max(diffs)))
print("webp total", sum(os.path.getsize(p) for p in glob.glob(os.path.join(OUT, "f*.webp"))),
      "poster", os.path.getsize(os.path.join(OUT, "poster.jpg")),
      "size", Image.open(os.path.join(OUT, "f000.webp")).size, Image.open(os.path.join(OUT, "f000.webp")).mode, "frames", N)
