"""Кадр первого экрана → WebP для сайта.

    python design/blender/hero_post.py <hero.png> public/media/hero

Из прозрачного PNG (hero_build.py) делает два файла с прозрачностью:
`stage-860.webp` и `stage-1720.webp` — под ширину показа (не больше
860 CSS px) и её же удвоение для плотных экранов. Прозрачность оставлена намеренно: прежний постер ноутбука
лежал на белом и подмешивался к странице через `mix-blend-mode: multiply`,
из-за чего края темнели на любом фоне, кроме чистого белого.

Кадр обрезается по непрозрачным точкам с небольшим полем: тень —
часть изображения, её обрезать нельзя, а пустые поля вокруг съедают
разрешение.
"""
import sys, os
from PIL import Image

src = sys.argv[1]
out_dir = sys.argv[2] if len(sys.argv) > 2 else "public/media/hero"
os.makedirs(out_dir, exist_ok=True)

im = Image.open(src).convert("RGBA")
alpha = im.getchannel("A")

# Порог 24, а не 1: у ловца тени почти весь кадр слабо непрозрачен,
# и обрезка по «любой ненулевой точке» не обрезала бы ничего.
mask = alpha.point(lambda v: 255 if v > 24 else 0)
box = mask.getbbox() or (0, 0, im.width, im.height)
pad = round(im.width * 0.012)
box = (
    max(0, box[0] - pad),
    max(0, box[1] - pad),
    min(im.width, box[2] + pad),
    min(im.height, box[3] + pad),
)
im = im.crop(box)
print("crop", box, "->", im.size)

for width, limit_kb, quality in ((1720, 260, 88), (860, 110, 86)):
    if width > im.width:
        continue
    h = round(im.height * width / im.width)
    dst = os.path.join(out_dir, f"stage-{width}.webp")
    q = quality
    while True:
        im.resize((width, h), Image.LANCZOS).save(dst, "WEBP", quality=q, method=6)
        kb = os.path.getsize(dst) / 1024
        if kb <= limit_kb or q <= 62:
            break
        q -= 4
    print(f"{dst} {width}x{h} q={q} {kb:.0f} KB")
