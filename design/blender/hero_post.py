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

# ── Снять «плиту» под кадром ──────────────────────────────────────
# Ловец тени отдаёт слабую непрозрачность по ВСЕМУ кадру (рассеянный
# свет, отражения), а не только там, где лежит тень: у трети пикселей
# alpha 1–7. На белой странице это читается как серый прямоугольник со
# швом по краю картинки — владелец 18.09.2026: «этот фон просто ужас».
# Поэтому нижние значения гасим, средние плавно поднимаем, а настоящую
# тень (alpha ≥ HIGH) не трогаем.
LOW, HIGH = 10, 46
lut = [0 if v <= LOW else (round(v * (v - LOW) / (HIGH - LOW)) if v < HIGH else v) for v in range(256)]
im.putalpha(im.getchannel("A").point(lut))
alpha = im.getchannel("A")

# Плита уже снята выше, поэтому обрезаем по НИЗКОМУ порогу: всё, что
# осталось ненулевым, — настоящая тень, и резать её краем кадра нельзя
# (иначе у картинки появляется прямая серая грань там, где тень
# оборвалась).
mask = alpha.point(lambda v: 255 if v > 2 else 0)
box = mask.getbbox() or (0, 0, im.width, im.height)
pad = round(im.width * 0.02)
box = (
    max(0, box[0] - pad),
    max(0, box[1] - pad),
    min(im.width, box[2] + pad),
    min(im.height, box[3] + pad),
)
im = im.crop(box)
print("crop", box, "->", im.size)

# Имена и размеры постоянные: на них ссылается srcset первого экрана.
# Обрезка зависит от кадра и может оказаться чуть уже 1720 — тогда
# картинка немного растягивается, это незаметно и лучше, чем менять
# разметку под каждый рендер.
for width, limit_kb, quality in ((1720, 260, 88), (860, 110, 86)):
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
