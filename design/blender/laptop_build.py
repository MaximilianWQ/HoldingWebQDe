"""Laptop of home section 06 — MacBook Pro 14" form, procedural.

Run in Blender 5.2 with design/blender/atlas_laptop.blend open (Scripting ->
Run Script). Rebuilds ONLY the model (LT_Root and everything under it) in
scene «AtlasLaptop»; lights, reflection card, shadow-catcher floor, world,
camera and render settings stay as they are. Then it re-keys the 60-frame
opening (lid 0 -> 115 deg, whole laptop turns -4 deg, screen lights up over
the last third).

Dimensions — Apple tech specs, MacBook Pro 14-inch (M4 2024 / M5 2025):
support.apple.com/en-us/121552, support.apple.com/en-us/125405,
apple.com/macbook-pro/specs:
  body 31.26 x 22.12 x 1.55 cm; display 14.2" Liquid Retina XDR
  3024 x 1964 px at 254 ppi -> active area 302.4 x 196.4 mm, rounded top
  corners, camera in a notch; 12 full-height function keys + Touch ID;
  Force Touch trackpad; six speakers (grilles either side of the keyboard);
  MagSafe 3 + 2 x Thunderbolt + headphone jack on the left,
  HDMI + Thunderbolt + SDXC on the right; Space Black / Silver.
No logo and no lettering anywhere on the model (trademarks): form only.

Screen texture: laptop-screen/screen-1512.png (laptop-screen/dash.cjs).
Globals you may set before running: FINISH = "silver" | "black".
"""
import bpy, bmesh, math, os
from mathutils import Vector

sc = bpy.data.scenes["AtlasLaptop"]
bpy.context.window_manager.windows[0].scene = sc
HERE = os.path.dirname(bpy.data.filepath) or "."
SCREEN_PNG = globals().get("SCREEN_PNG") or os.path.join(HERE, "laptop-screen", "screen-1512.png")
FINISH = globals().get("FINISH", "silver")

# ---------------------------------------------------------------- clean the old model
def kill(o):
    for c in list(o.children):
        kill(c)
    bpy.data.objects.remove(o, do_unlink=True)

if "LT_Root" in bpy.data.objects:
    kill(bpy.data.objects["LT_Root"])
for o in list(bpy.data.objects):
    if o.name.startswith("LT_tmp"):
        bpy.data.objects.remove(o, do_unlink=True)
for coll in (bpy.data.meshes, bpy.data.curves):
    for m in list(coll):
        if m.users == 0:
            coll.remove(m)

def link(o):
    sc.collection.objects.link(o)
    return o

# ---------------------------------------------------------------- geometry helpers
def rrect(w, d, r, n):
    r = max(min(r, w / 2 - 1e-6, d / 2 - 1e-6), 1e-6)
    pts = []
    for cx, cy, a0 in ((w/2-r, d/2-r, 0), (-w/2+r, d/2-r, 90), (-w/2+r, -d/2+r, 180), (w/2-r, -d/2+r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def slab(bm, w, d, r, h, rb=0.0, rt=0.0, z0=0.0, cx=0.0, cy=0.0, n=8, m=5, mat=0):
    """Rounded-rectangle slab with rounded bottom (rb) and top (rt) rims."""
    prof = []
    if rb > 0:
        for i in range(m + 1):
            ph = math.pi / 2 * i / m
            prof.append((z0 + rb - rb * math.cos(ph), rb - rb * math.sin(ph)))
    else:
        prof.append((z0, 0.0))
    if rt > 0:
        for i in range(m + 1):
            ph = math.pi / 2 * i / m
            prof.append((z0 + h - rt + rt * math.sin(ph), rt - rt * math.cos(ph)))
    else:
        prof.append((z0 + h, 0.0))
    clean = [prof[0]]
    for p in prof[1:]:
        if abs(p[0] - clean[-1][0]) > 1e-9 or abs(p[1] - clean[-1][1]) > 1e-9:
            clean.append(p)
    rings = []
    for z, ins in clean:
        pts = rrect(w - 2 * ins, d - 2 * ins, r - ins, n)
        rings.append([bm.verts.new((cx + x, cy + y, z)) for x, y in pts])
    faces = [bm.faces.new(list(reversed(rings[0])))]
    for a, b in zip(rings[:-1], rings[1:]):
        k = len(a)
        for i in range(k):
            faces.append(bm.faces.new((a[i], a[(i + 1) % k], b[(i + 1) % k], b[i])))
    faces.append(bm.faces.new(rings[-1]))
    for f in faces:
        f.material_index = mat
        f.smooth = True
    return faces

def mesh_obj(name, bm, mats, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    for mt in mats:
        o.data.materials.append(mt)
    link(o)
    if parent:
        o.parent = parent
    return o

def set_sharp(me, deg=35):
    bm = bmesh.new(); bm.from_mesh(me)
    for f in bm.faces:
        f.smooth = True
    thr = math.radians(deg)
    for e in bm.edges:
        if len(e.link_faces) != 2 or e.calc_face_angle(0) > thr:
            e.smooth = False
    bm.to_mesh(me); bm.free()

def apply_mods(o):
    vl = sc.view_layers[0]
    vl.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(ev, preserve_all_data_layers=True, depsgraph=dg)
    old = o.data
    o.modifiers.clear()
    o.data = me
    me.name = o.name
    bpy.data.meshes.remove(old)

def weighted(o):
    md = o.modifiers.new("WN", 'WEIGHTED_NORMAL')
    md.keep_sharp = True
    md.weight = 50
    md.mode = 'FACE_AREA'

def poly_obj(name, pts, z, mat, parent, uv=None):
    """Flat polygon (list of (x, y)) at height z, facing -z (the viewer side of the lid)."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z)) for x, y in pts]
    f = bm.faces.new(vs)
    bm.normal_update()
    if f.normal.z > 0:
        f.normal_flip()
    f.smooth = False
    if uv:
        uvl = bm.loops.layers.uv.new("UVMap")
        for lp in f.loops:
            lp[uvl].uv = uv(lp.vert.co.x, lp.vert.co.y)
    return mesh_obj(name, bm, [mat], parent)

def arc(cx, cy, r, a0, a1, n=10):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]

# ---------------------------------------------------------------- materials
def new_mat(name):
    mt = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mt.use_nodes = True
    nt = mt.node_tree
    if nt.animation_data:
        nt.animation_data_clear()
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(b.outputs[0], out.inputs[0])
    return mt, nt, b

def principled(name, col, metal=0.0, rough=0.5, spec=0.5, coat=0.0, coat_r=0.05):
    mt, nt, b = new_mat(name)
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    b.inputs['Specular IOR Level'].default_value = spec
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Coat Roughness'].default_value = coat_r
    return mt, nt, b

def brushed(nt, b, rough, aniso):
    """Bead-blasted aluminium: slight anisotropy along the hinge axis + micro roughness noise."""
    b.inputs['Anisotropic'].default_value = aniso
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    v = nt.nodes.new('ShaderNodeCombineXYZ'); v.inputs[0].default_value = 1.0; v.inputs[2].default_value = 0.01
    dot = nt.nodes.new('ShaderNodeVectorMath'); dot.operation = 'DOT_PRODUCT'
    nt.links.new(geo.outputs['Normal'], dot.inputs[0]); nt.links.new(v.outputs[0], dot.inputs[1])
    sc_ = nt.nodes.new('ShaderNodeVectorMath'); sc_.operation = 'SCALE'
    nt.links.new(geo.outputs['Normal'], sc_.inputs[0]); nt.links.new(dot.outputs['Value'], sc_.inputs['Scale'])
    sub = nt.nodes.new('ShaderNodeVectorMath'); sub.operation = 'SUBTRACT'
    nt.links.new(v.outputs[0], sub.inputs[0]); nt.links.new(sc_.outputs[0], sub.inputs[1])
    nrm = nt.nodes.new('ShaderNodeVectorMath'); nrm.operation = 'NORMALIZE'
    nt.links.new(sub.outputs[0], nrm.inputs[0])
    nt.links.new(nrm.outputs[0], b.inputs['Tangent'])
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nz = nt.nodes.new('ShaderNodeTexNoise'); nz.inputs['Scale'].default_value = 900.0; nz.inputs['Detail'].default_value = 2.0
    nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['To Min'].default_value = rough - 0.03; mr.inputs['To Max'].default_value = rough + 0.03
    nt.links.new(nz.outputs['Fac'], mr.inputs['Value']); nt.links.new(mr.outputs['Result'], b.inputs['Roughness'])

def alu(name, col, rough, aniso=0.3):
    mt, nt, b = principled(name, col, 1.0, rough)
    brushed(nt, b, rough, aniso)
    return mt

FIN = {
    # Silver: anodised aluminium, light; Space Black: deep anodised black-grey.
    # (values are tuned to this stage's lights: brighter silver blows out to white)
    "silver": dict(alu=(0.26, 0.265, 0.275), rough=0.34, pad=(0.24, 0.245, 0.255), pad_metal=0.9),
    "black": dict(alu=(0.034, 0.035, 0.038), rough=0.40, pad=(0.036, 0.037, 0.040), pad_metal=0.6),
}[FINISH]

M_ALU = alu("LT_Alu", FIN["alu"], FIN["rough"])
M_ALU_DARK = alu("LT_AluDark", (0.022, 0.023, 0.026), 0.36, 0.15)
M_WELL = principled("LT_Well", (0.003, 0.003, 0.0032), 0.0, 0.75, spec=0.25)[0]
M_KEY = principled("LT_Key", (0.005, 0.005, 0.0055), 0.0, 0.6, spec=0.08)[0]
M_LEG = principled("LT_Legend", (0.40, 0.40, 0.41), 0.0, 0.6, spec=0.3)[0]
M_TID = principled("LT_TouchID", (0.005, 0.005, 0.006), 0.0, 0.07, spec=0.6, coat=0.6, coat_r=0.03)[0]
M_PAD = principled("LT_Pad", FIN["pad"], FIN["pad_metal"], 0.27, coat=0.2, coat_r=0.08)[0]
M_GLASS = principled("LT_Glass", (0.004, 0.004, 0.005), 0.0, 0.035, spec=0.55)[0]
M_RUB = principled("LT_Rubber", (0.014, 0.014, 0.015), 0.0, 0.7)[0]
M_PORT = principled("LT_Port", (0.006, 0.006, 0.007), 0.0, 0.6, spec=0.3)[0]
M_LENS = principled("LT_Lens", (0.015, 0.02, 0.035), 0.0, 0.06, spec=0.7)[0]

# Speaker grille: the deck aluminium with a lattice of black micro-holes.
mt, nt, b = principled("LT_Grille", FIN["alu"], 1.0, FIN["rough"])
brushed(nt, b, FIN["rough"], 0.3)
hole = nt.nodes.new('ShaderNodeBsdfPrincipled')
hole.inputs['Base Color'].default_value = (0.003, 0.003, 0.003, 1); hole.inputs['Roughness'].default_value = 0.85
hole.inputs['Metallic'].default_value = 0.0
tc = nt.nodes.new('ShaderNodeTexCoord')
vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.feature = 'F1'; vor.distance = 'EUCLIDEAN'
vor.inputs['Scale'].default_value = 1.0 / 0.00105; vor.inputs['Randomness'].default_value = 0.0
nt.links.new(tc.outputs['Object'], vor.inputs['Vector'])
lt = nt.nodes.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.30
nt.links.new(vor.outputs['Distance'], lt.inputs[0])
mix = nt.nodes.new('ShaderNodeMixShader')
out = [n_ for n_ in nt.nodes if n_.type == 'OUTPUT_MATERIAL'][0]
nt.links.new(lt.outputs[0], mix.inputs[0]); nt.links.new(b.outputs[0], mix.inputs[1]); nt.links.new(hole.outputs[0], mix.inputs[2])
nt.links.new(mix.outputs[0], out.inputs[0])
M_GRILLE = mt

# Screen: black glass + the cabinet as emission (animated: dark until the lid is up).
mt, nt, b = principled("LT_Screen", (0.0, 0.0, 0.0), 0.0, 0.03, spec=0.35)
img = bpy.data.images.load(SCREEN_PNG, check_existing=True)
img.reload()
try:
    img.filepath = bpy.path.relpath(SCREEN_PNG)
except ValueError:
    pass
img.colorspace_settings.name = 'sRGB'
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img; tex.interpolation = 'Cubic'; tex.extension = 'EXTEND'
uvn = nt.nodes.new('ShaderNodeUVMap')
nt.links.new(uvn.outputs[0], tex.inputs[0])
nt.links.new(tex.outputs['Color'], b.inputs['Emission Color'])
b.inputs['Emission Strength'].default_value = 0.0
M_SCREEN = mt
for im in list(bpy.data.images):
    if im.users == 0 and im.name.startswith("laptop-screen"):
        bpy.data.images.remove(im)

# ---------------------------------------------------------------- dimensions (metres)
W, D = 0.3126, 0.2212           # Apple: 31.26 x 22.12 cm
R = 0.0118                      # plan-view corner radius
Z0 = 0.0008                     # feet
HB = 0.0097                     # base slab
Z1 = Z0 + HB                    # deck height
GAP = 0.0004
T = 0.0046                      # lid; Z1 + GAP + T = 15.5 mm (Apple: 1.55 cm)
PZ = Z1 + GAP + T / 2           # hinge axis
PY = D / 2 - 0.0008
DL = D - 0.0016                 # lid depth

root = link(bpy.data.objects.new("LT_Root", None))
root.empty_display_size = 0.05

# ---------------------------------------------------------------- base (unibody, flat deck)
bm = bmesh.new()
slab(bm, W, D, R, HB, rb=0.0028, rt=0.0008, z0=Z0, n=14, m=6, mat=0)
base = mesh_obj("LT_Base", bm, [M_ALU], root)

cutters = []
def cutter(name, mat, build, rot=None, loc=(0, 0, 0)):
    bm = bmesh.new(); build(bm)
    c = mesh_obj(name, bm, [mat])
    if rot: c.rotation_euler = rot
    c.location = loc
    cutters.append(c)
    md = base.modifiers.new(name, 'BOOLEAN')
    md.operation = 'DIFFERENCE'; md.solver = 'EXACT'; md.object = c
    md.material_mode = 'TRANSFER'
    return c

# keyboard: 14.5 units wide, 6 full-height rows (function row included)
P = 0.0186
KB_W, KB_H = 14.5 * P, 6 * P
WELL_M = 0.0011
WELL_W, WELL_H = KB_W + 2 * WELL_M, KB_H + 2 * WELL_M
WELL_TOP = D / 2 - 0.0098
WELL_CY = WELL_TOP - WELL_H / 2
cutter("LT_cWell", M_WELL, lambda bm: slab(bm, WELL_W, WELL_H, 0.0030, 0.02, z0=Z1 - 0.0010, cy=WELL_CY, n=8))

# Force Touch trackpad
TP_W, TP_H = 0.1330, 0.0820
TP_BOT = -D / 2 + 0.0078
TP_CY = TP_BOT + TP_H / 2
TP_GAP = 0.0004
cutter("LT_cPad", M_PORT, lambda bm: slab(bm, TP_W + 2 * TP_GAP, TP_H + 2 * TP_GAP, 0.0072 + TP_GAP, 0.02, z0=Z1 - 0.0009, cy=TP_CY, n=10))

# thumb recess in the front lip
def scoop(bm):
    bmesh.ops.create_uvsphere(bm, u_segments=64, v_segments=32, radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * 0.0150, v.co.y * 0.0055, v.co.z * 0.0020))
cutter("LT_cScoop", M_ALU, scoop, loc=(0, -D / 2, Z1))

# ports: slab w -> height (z), d -> length (y), h -> depth (x) after the Y rotation
PORT_Z = Z0 + HB * 0.5
def port(name, length, height, y, right=False, r=None):
    rr = height / 2 - 1e-5 if r is None else r
    cutter(name, M_PORT, lambda bm: slab(bm, height, length, rr, 0.006, n=8),
           rot=(0, math.radians(90), 0), loc=((W / 2 - 0.0045) if right else (-W / 2 - 0.0015), y, PORT_Z))
# left, rear -> front: MagSafe 3, Thunderbolt, Thunderbolt, headphone jack
port("LT_cMagSafe", 0.0165, 0.0031, D / 2 - 0.028)
port("LT_cTB1", 0.0086, 0.0029, D / 2 - 0.052)
port("LT_cTB2", 0.0086, 0.0029, D / 2 - 0.070)
port("LT_cJack", 0.0042, 0.0042, -D / 2 + 0.045)
# right, rear -> front: HDMI, Thunderbolt, SDXC
port("LT_cHDMI", 0.0142, 0.0048, D / 2 - 0.030, right=True, r=0.0008)
port("LT_cTB3", 0.0086, 0.0029, D / 2 - 0.058, right=True)
port("LT_cSD", 0.0245, 0.0021, -D / 2 + 0.060, right=True)

apply_mods(base)
for c in cutters:
    bpy.data.objects.remove(c, do_unlink=True)
set_sharp(base.data, 35)
weighted(base)

# ---------------------------------------------------------------- keys (black, tight gaps)
KEY_G = 0.0021
KZ0 = Z1 - 0.0010
KH = 0.00085
KTOP = KZ0 + KH
KR = 0.0013
rows = [
    [1.5] + [1] * 12 + [1],        # esc, F1-F12, Touch ID
    [1] * 13 + [1.5],              # ` 1..0 - =, delete
    [1.5] + [1] * 13,              # tab, Q..], \
    [1.75] + [1] * 11 + [1.75],    # caps lock, A..', return
    [2.25] + [1] * 10 + [2.25],    # shift, Z../, shift
    [1, 1, 1, 1.25, 5, 1.25, 1],   # fn control option command space command option (+ arrows)
]
LAB = [
    ["esc"] + ["F%d" % i for i in range(1, 13)] + [None],
    [("~", "`"), ("!", "1"), ("@", "2"), ("#", "3"), ("$", "4"), ("%", "5"), ("^", "6"), ("&", "7"), ("*", "8"), ("(", "9"), (")", "0"), ("_", "-"), ("+", "="), "delete"],
    ["tab"] + list("QWERTYUIOP") + [("{", "["), ("}", "]"), ("|", "\\")],
    ["caps lock"] + list("ASDFGHJKL") + [(":", ";"), ('"', "'"), "return"],
    ["shift"] + list("ZXCVBNM") + [("<", ","), (">", "."), ("?", "/"), "shift"],
    ["fn", "control", "option", "command", None, "command", "option"],
]
RIGHT_WORDS = {(1, 13), (3, 12), (4, 11), (5, 5), (5, 6)}
legend_jobs = []   # (text, x, y, size, align_x, align_y)

bm = bmesh.new()
bm_tid = bmesh.new()
x0 = -KB_W / 2
for ri, row in enumerate(rows):
    cy = WELL_TOP - WELL_M - P * (ri + 0.5)
    kh = P - KEY_G
    x = x0
    for ci, u in enumerate(row):
        kw = u * P - KEY_G
        cx = x + u * P / 2
        target = bm_tid if (ri == 0 and ci == len(row) - 1) else bm
        slab(target, kw, kh, KR, KH, rt=0.0004, z0=KZ0, cx=cx, cy=cy, n=5, m=3)
        lab = LAB[ri][ci]
        if isinstance(lab, tuple):
            legend_jobs.append((lab[0] + "\n" + lab[1], cx, cy, 0.0030, 'CENTER', 'CENTER'))
        elif isinstance(lab, str) and len(lab) == 1:
            legend_jobs.append((lab, cx, cy, 0.0040, 'CENTER', 'CENTER'))
        elif isinstance(lab, str) and ri == 0 and lab != "esc":
            legend_jobs.append((lab, cx, cy - kh / 2 + 0.0024, 0.0019, 'CENTER', 'BOTTOM'))
        elif isinstance(lab, str):
            right = (ri, ci) in RIGHT_WORDS
            legend_jobs.append((lab, cx + kw / 2 - 0.0018 if right else cx - kw / 2 + 0.0018, cy - kh / 2 + 0.0024, 0.0021, 'RIGHT' if right else 'LEFT', 'BOTTOM'))
        x += u * P
    if ri == 5:
        # inverted-T arrows: left/right half height at the bottom, up/down stacked
        hh = (P - KEY_G) / 2 - KEY_G / 4
        kw = P - KEY_G
        for xx in (x + P / 2, x + 2.5 * P):
            slab(bm, kw, hh, 0.0010, KH, rt=0.0004, z0=KZ0, cx=xx, cy=cy - (P - KEY_G) / 2 + hh / 2, n=5, m=3)
        slab(bm, kw, hh, 0.0010, KH, rt=0.0004, z0=KZ0, cx=x + 1.5 * P, cy=cy + (P - KEY_G) / 2 - hh / 2, n=5, m=3)
        slab(bm, kw, hh, 0.0010, KH, rt=0.0004, z0=KZ0, cx=x + 1.5 * P, cy=cy - (P - KEY_G) / 2 + hh / 2, n=5, m=3)
keys = mesh_obj("LT_Keys", bm, [M_KEY], root)
weighted(keys)
tid = mesh_obj("LT_TouchID", bm_tid, [M_TID], root)
weighted(tid)

# legends: text -> one flat mesh (no fonts needed after the build)
FONT = None
for fp in ("/System/Library/Fonts/SFNS.ttf", "/System/Library/Fonts/Supplemental/Arial.ttf"):
    if os.path.exists(fp):
        try:
            FONT = bpy.data.fonts.load(fp, check_existing=True)
            break
        except Exception:
            pass
tmp = []
for txt, x, y, size, ax, ay in legend_jobs:
    cu = bpy.data.curves.new("LT_tmp", 'FONT')
    cu.body = txt
    if FONT:
        cu.font = FONT
    cu.size = size
    cu.align_x = ax
    cu.align_y = ay
    cu.space_line = 0.95
    o = link(bpy.data.objects.new("LT_tmp", cu))
    o.location = (x, y, KTOP + 0.00003)
    tmp.append(o)
sc.view_layers[0].update()
dg = bpy.context.evaluated_depsgraph_get()
verts, faces = [], []
for o in tmp:
    me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    mw = o.matrix_world.copy()
    base_i = len(verts)
    verts.extend([tuple(mw @ v.co) for v in me.vertices])
    faces.extend([tuple(base_i + i for i in p.vertices) for p in me.polygons])
    bpy.data.meshes.remove(me)
for o in tmp:
    cu = o.data
    bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.curves.remove(cu)
me = bpy.data.meshes.new("LT_Legends")
me.from_pydata(verts, [], faces)
me.update()
leg = bpy.data.objects.new("LT_Legends", me)
me.materials.append(M_LEG)
link(leg); leg.parent = root
if FONT and FONT.users == 0:
    bpy.data.fonts.remove(FONT)

# trackpad (glass, finish-matched, flush with the deck)
bm = bmesh.new()
slab(bm, TP_W, TP_H, 0.0072, 0.0007, rt=0.0003, z0=Z1 - 0.00075, cy=TP_CY, n=10, m=3)
pad = mesh_obj("LT_Pad", bm, [M_PAD], root)
weighted(pad)

# speaker grilles either side of the keyboard, full keyboard height
for sx in (-1, 1):
    bm = bmesh.new()
    gx = sx * (WELL_W / 2 + (W / 2 - WELL_W / 2) / 2)
    gw = 0.0120
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    for v in bm.verts:
        v.co = Vector((gx + v.co.x * gw, WELL_CY + v.co.y * WELL_H, Z1 + 0.00003))
    mesh_obj("LT_Grille%s" % ("L" if sx < 0 else "R"), bm, [M_GRILLE], root)

# feet
for fx in (-1, 1):
    for fy in (-1, 1):
        bm = bmesh.new()
        slab(bm, 0.012, 0.012, 0.006, Z0 + 0.0004, rb=0.0003, z0=0.0, cx=fx * (W / 2 - 0.026), cy=fy * (D / 2 - 0.024), n=6, m=2)
        mesh_obj("LT_Foot", bm, [M_RUB], root)

# hinge: dark barrel between the deck and the display, almost full width
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=48, radius1=0.0023, radius2=0.0023, depth=W - 0.050)
for f in bm.faces: f.smooth = True
hinge = mesh_obj("LT_Hinge", bm, [M_ALU_DARK], root)
hinge.rotation_euler = (0, math.radians(90), 0)
hinge.location = (0, PY - 0.0020, PZ - 0.0004)
set_sharp(hinge.data, 40)

# ---------------------------------------------------------------- lid (origin on the hinge axis)
lid = link(bpy.data.objects.new("LT_Lid", None))
lid.parent = root
lid.location = (0, PY, PZ)
lid.empty_display_size = 0.02

bm = bmesh.new()
slab(bm, W, DL, R, T, rb=0.0007, rt=0.0016, z0=-T / 2, cy=-DL / 2, n=14, m=6)
shell = mesh_obj("LT_LidShell", bm, [M_ALU], lid)
weighted(shell)

# display side (local -z). y: 0 at the hinge, -DL at the top edge of the display.
GI = 0.0010                     # aluminium lip around the glass
BAND = 0.0072                   # black display-housing band at the hinge
Y_FAR = -DL + GI
Y_NEAR = -BAND
bm = bmesh.new()
slab(bm, W - 2 * GI + 0.0008, (Y_NEAR - Y_FAR) + 0.0008, R - GI + 0.0004, 0.0003, z0=-T / 2 - 0.00005, cy=(Y_FAR + Y_NEAR) / 2, n=14, m=2)
mesh_obj("LT_Gasket", bm, [M_RUB], lid)
bm = bmesh.new()
slab(bm, W - 2 * GI, Y_NEAR - Y_FAR, R - GI, 0.0004, rb=0.00012, z0=-T / 2 - 0.0001, cy=(Y_FAR + Y_NEAR) / 2, n=14, m=2)
glass = mesh_obj("LT_LidGlass", bm, [M_GLASS], lid)
weighted(glass)
bm = bmesh.new()
slab(bm, W - 0.0016, BAND + 0.0004, 0.0012, T * 0.55, rb=0.0006, z0=-T / 2 - 0.00008, cy=-(BAND + 0.0004) / 2 + 0.0002, n=6, m=3)
band = mesh_obj("LT_DisplayBand", bm, [M_ALU_DARK], lid)
weighted(band)

# active area 302.4 x 196.4 mm, rounded top corners, notch with the camera
SW, SH = 0.3024, 0.1964
S_TOP = -DL + 0.0049            # top edge of the picture (far from the hinge)
S_BOT = S_TOP + SH
CR = 0.0021                     # top corner radius (~10 pt)
zS = -T / 2 - 0.00013
pts = [(-SW / 2, S_BOT), (SW / 2, S_BOT)]
pts += arc(SW / 2 - CR, S_TOP + CR, CR, 0, -90)[:]        # right side up to the top-right corner
pts += arc(-SW / 2 + CR, S_TOP + CR, CR, -90, -180)[:]    # top edge to the top-left corner
uvf = lambda x, y: ((x + SW / 2) / SW, (S_BOT - y) / SH)
screen = poly_obj("LT_Screen", pts, zS, M_SCREEN, lid, uv=uvf)

NW, NH, NR = 0.0376, 0.0064, 0.0016   # 188 x 32 pt
npts = [(-NW / 2 - 0.0008, S_TOP - 0.0006), (NW / 2 + 0.0008, S_TOP - 0.0006)]
npts += [(NW / 2 + 0.0008, S_TOP)] + arc(NW / 2 + 0.0008, S_TOP + 0.0008, 0.0008, -90, -180, 6)[1:]
npts += arc(NW / 2 - NR, S_TOP + NH - NR, NR, 0, 90, 8)
npts += arc(-NW / 2 + NR, S_TOP + NH - NR, NR, 90, 180, 8)
npts += arc(-NW / 2 - 0.0008, S_TOP + 0.0008, 0.0008, 0, -90, 6)[:-1] + [(-NW / 2 - 0.0008, S_TOP)]
notch = poly_obj("LT_Notch", npts, zS - 0.00003, M_GLASS, lid)

bm = bmesh.new()
bmesh.ops.create_circle(bm, cap_ends=True, segments=32, radius=0.00105)
for v in bm.verts:
    v.co.y += S_TOP + NH * 0.5
    v.co.z = zS - 0.00006
mesh_obj("LT_Lens", bm, [M_LENS], lid)

# ---------------------------------------------------------------- light linking (existing stage)
def recv(name, objs):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    for o in list(c.objects):
        c.objects.unlink(o)
    for o in objs:
        c.objects.link(o)
    return c
model = [o for o in sc.objects if o.type == 'MESH' and o.name.startswith("LT_") and o.name not in ("LT_Floor", "LT_LReflCard")]
recv("LT_RecvLaptop", model)
recv("LT_RecvScreen", [bpy.data.objects[n] for n in ("LT_Screen", "LT_LidGlass", "LT_Notch")])

# ---------------------------------------------------------------- animation (same curve as before)
OPEN = math.radians(115)
TURN = math.radians(-4)
EM_MAX = globals().get("EM_MAX", 0.92)
def ease(t):
    return 0.75 * (1 - math.cos(math.pi * t)) / 2 + 0.25 * t
def smooth(a, b_, x):
    x = min(max((x - a) / (b_ - a), 0.0), 1.0)
    return x * x * (3 - 2 * x)
N_FRAMES = globals().get("N_FRAMES", 120)   # 120 evenly spaced frames (site: f000..f119.webp)
sc.frame_start, sc.frame_end = 1, N_FRAMES
sb = M_SCREEN.node_tree.nodes["Principled BSDF"]
for ad_owner in (lid, root, M_SCREEN.node_tree):
    ad_owner.animation_data_clear()
for f in range(1, N_FRAMES + 1):
    t = (f - 1) / (N_FRAMES - 1)
    e = ease(t)
    lid.rotation_euler = (-OPEN * e, 0, 0)
    lid.keyframe_insert("rotation_euler", index=0, frame=f)
    root.rotation_euler = (0, 0, TURN * e)
    root.keyframe_insert("rotation_euler", index=2, frame=f)
    sb.inputs['Emission Strength'].default_value = EM_MAX * smooth(0.62, 0.97, t)
    sb.inputs['Emission Strength'].keyframe_insert("default_value", frame=f)
for ad in (lid.animation_data, root.animation_data, M_SCREEN.node_tree.animation_data):
    act = ad.action
    for layer in getattr(act, "layers", []):
        for strip in layer.strips:
            for cb in strip.channelbags:
                for fc in cb.fcurves:
                    for kp in fc.keyframe_points:
                        kp.interpolation = 'LINEAR'
    for fc in getattr(act, "fcurves", []) or []:
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
sc.frame_set(N_FRAMES)
print("laptop built:", FINISH, len(model), "meshes,", len(legend_jobs), "legends, font", FONT.name if FONT else None)
