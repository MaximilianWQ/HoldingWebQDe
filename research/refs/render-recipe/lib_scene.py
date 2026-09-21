import bpy, os, math, time, json
import numpy as np

def s2l(c): return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def hex_lin(h): return tuple(s2l(int(h[i:i+2],16)/255) for i in (0,2,4))

def use_gpu():
    p = bpy.context.preferences.addons['cycles'].preferences
    try: p.compute_device_type = 'METAL'
    except TypeError: pass
    p.get_devices()
    for d in p.devices: d.use = True

def bs(node, name): return node.inputs[name]

def read(path):
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = 'Non-Color'
    w,h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    bpy.data.images.remove(img)
    return a

def lum(a): return 0.2126*a[...,0]+0.7152*a[...,1]+0.0722*a[...,2]

def boxblur(x, r):
    k = 2*r+1
    pad = np.pad(x, r, mode='edge')
    c = np.cumsum(np.cumsum(pad, 0), 1)
    c = np.pad(c, ((1,0),(1,0)))
    H,W = x.shape
    s = c[k:k+H, k:k+W] - c[0:H, k:k+W] - c[k:k+H, 0:W] + c[0:H, 0:W]
    return s/(k*k)
