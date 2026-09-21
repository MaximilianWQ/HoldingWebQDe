import bpy, os, sys, json, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from lib_scene import *
OUT = os.path.dirname(os.path.abspath(__file__))
print("FMT", [i.identifier for i in bpy.context.scene.render.image_settings.bl_rna.properties['file_format'].enum_items])

PATCH=(None,None)
def hp_of(arr, cy, cx):
    L = lum(arr)
    P = L[cy-90:cy+90, cx-90:cx+90]
    return float((P - boxblur(P,3)).std()*255), float(P.mean()*255)

# locate patch on the base render, same rule as grain2
def pick(arr):
    L = lum(arr); best=None
    for cy in range(300,1100,40):
        for cx in range(300,1100,40):
            P=L[cy-90:cy+90, cx-90:cx+90]
            if P.shape!=(180,180): continue
            m=P.mean()
            if m<0.35 or m>0.72: continue
            g=abs(P[:,:90].mean()-P[:,90:].mean())+abs(P[:90].mean()-P[90:].mean())
            if best is None or g<best[0]: best=(g,cy,cx)
    return best[1],best[2]

base_png = os.path.join(OUT,"g_base.png")
cy,cx = pick(read(base_png))
print("PATCH", cy, cx)

def to_webp(src, q):
    img = bpy.data.images.load(src)
    img.colorspace_settings.name='Non-Color'
    _ = img.pixels[0]
    dst = src.replace('.png', f'_q{q}.webp')
    img.file_format='WEBP'
    img.save(filepath=dst, quality=q)
    bpy.data.images.remove(img)
    return dst

targets = ["g_base.png",
           "g_height_s240_d2.0_di0.0_h0.0005_dn1.png",
           "g_height_s240_d2.0_di0.0_h0.001_dn1.png",
           "g_height_s240_d2.0_di0.0_h0.002_dn1.png",
           "g_height_s240_d2.0_di0.0_h0.005_dn1.png",
           "g_scale_s480_d2.0_di0.0_h0.002_dn1.png"]
res=[]
b_png = hp_of(read(base_png), cy, cx)[0]
for t in targets:
    p = os.path.join(OUT,t)
    if not os.path.exists(p):
        print("MISS", t); continue
    hp_png,_ = hp_of(read(p), cy, cx)
    row = dict(file=t, png_hp=round(hp_png,3), png_signal=round(math.sqrt(max(0,hp_png**2-b_png**2)),3))
    for q in (70,80,90,100):
        d = to_webp(p, q)
        a = read(d)
        hp,_ = hp_of(a, cy, cx)
        row[f"q{q}_hp"]=round(hp,3)
        row[f"q{q}_bytes"]=os.path.getsize(d)
    res.append(row); print("WEBP", json.dumps(row))
open(os.path.join(OUT,'webp.json'),'w').write(json.dumps(res,indent=1))
