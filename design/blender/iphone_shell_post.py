"""
Вырез экрана в рендере корпуса и кодирование в WebP.

    python design/blender/iphone_shell_post.py <shell.png> <public/media/ios/shell.webp>

Нужны Pillow и numpy. Кадр рендера — 80 × 166 мм (iphone_shell.py). Экран —
активная область iPhone 17 Pro Max 72,89 × 158,37 мм (2868 × 1320 px при
460 ppi), по центру корпуса, радиус угла концентричен корпусу
(12,2 − 2,55 = 9,65 мм ≈ 58 pt). Dynamic Island из выреза исключён: он
остаётся в картинке, живой экран лежит ПОД корпусом.
Скрипт печатает проценты для install-ios.css (--ios-scr-*).
"""
import io, sys
import numpy as np
from PIL import Image

SRC, DST = sys.argv[1], sys.argv[2]
LIMIT = 200_000

FW, FH = 80.0, 166.0              # кадр, мм
SW, SH, SR = 72.89, 158.37, 9.65  # экран, мм
# Остров (после iphone_shell.py): 21,07 × 6,25 мм, центр на 74,28 мм выше
# центра, верхний край в 1,78 мм (≈ 11 pt) от края экрана.
IW, IH, IY = 21.07, 6.245, 74.28

im = Image.open(SRC)
a = np.asarray(im).astype(np.float64)
a /= 65535.0 if a.max() > 255 else 255.0
h, w = a.shape[:2]
pxmm = w / FW
assert abs(h / pxmm - FH) < 0.1, (w, h)

SS = 4  # суперсэмплинг маски
ys = (np.arange(h * SS) + 0.5) / SS
xs = (np.arange(w * SS) + 0.5) / SS
X = xs[None, :] / pxmm - FW / 2
Y = FH / 2 - ys[:, None] / pxmm

def rrect(X, Y, hw, hh, r, cy=0.0):
    qx = np.abs(X) - (hw - r)
    qy = np.abs(Y - cy) - (hh - r)
    d = np.hypot(np.maximum(qx, 0), np.maximum(qy, 0)) + np.minimum(np.maximum(qx, qy), 0) - r
    return d <= 0

hole = rrect(X, Y, SW / 2, SH / 2, SR) & ~rrect(X, Y, IW / 2, IH / 2, IH / 2, IY)
hole = hole.reshape(h, SS, w, SS).mean(axis=(1, 3))
a[..., 3] *= 1.0 - hole
out = Image.fromarray(np.clip(np.round(a * 255), 0, 255).astype(np.uint8), "RGBA")

def enc(q):
    b = io.BytesIO(); out.save(b, "WEBP", quality=q, alpha_quality=100, method=6, exact=False); return b.getvalue()

for q in range(92, 40, -2):
    data = enc(q)
    if len(data) <= LIMIT:
        break
open(DST, "wb").write(data)
print(f"{DST}: {w}x{h} q={q} {len(data)} B")

left = (FW - SW) / 2 / FW * 100
top = (FH - SH) / 2 / FH * 100
print(f"--ios-scr-x: {left:.4f}%;  --ios-scr-y: {top:.4f}%;")
print(f"--ios-scr-w: {SW / FW * 100:.4f}%;  --ios-scr-h: {SH / FH * 100:.4f}%;")
print(f"radius: {SR / SW * 100:.4f}% / {SR / SH * 100:.4f}%  (aspect {FW}/{FH})")
