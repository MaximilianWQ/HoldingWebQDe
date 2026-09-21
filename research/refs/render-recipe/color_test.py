import bpy, os, sys, json

OUT = os.path.dirname(os.path.abspath(__file__))

def srgb_to_linear(c):
    return c/12.92 if c <= 0.04045 else ((c+0.055)/1.055)**2.4
def linear_to_srgb(c):
    c = max(0.0, min(1.0, c))
    return c*12.92 if c <= 0.0031308 else 1.055*(c**(1/2.4))-0.055

HEX = "3A85F0"
rgb_srgb = [int(HEX[i:i+2],16)/255 for i in (0,2,4)]
rgb_lin  = [srgb_to_linear(c) for c in rgb_srgb]

# clean scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 64
scene.cycles.use_denoising = False
scene.render.resolution_x = 64
scene.render.resolution_y = 64
scene.render.film_transparent = False
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGB'
scene.render.image_settings.color_depth = '8'

# world: uniform white
world = bpy.data.worlds.new("W"); scene.world = world
world.use_nodes = True
bg = next(n for n in world.node_tree.nodes if n.type == 'BACKGROUND')
bg.inputs[0].default_value = (1,1,1,1)

# plane facing camera
bpy.ops.mesh.primitive_plane_add(size=20, location=(0,0,0))
plane = bpy.context.active_object
mat = bpy.data.materials.new("M"); mat.use_nodes = True
plane.data.materials.append(mat)
bsdf = next(n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
def sock(name):
    return bsdf.inputs[name]
sock("Base Color").default_value = (*rgb_lin, 1.0)
sock("Roughness").default_value = 0.5
sock("Metallic").default_value = 0.0

cam_data = bpy.data.cameras.new("C"); cam_data.type = 'ORTHO'; cam_data.ortho_scale = 4
cam = bpy.data.objects.new("C", cam_data); scene.collection.objects.link(cam)
cam.location = (0,0,5); cam.rotation_euler = (0,0,0)
scene.camera = cam

vt_items = ['Standard','Khronos PBR Neutral','AgX','Filmic','ACES 2.0']
print("VIEW_TRANSFORMS:", vt_items)
looks = ['None']
print("LOOKS_COUNT:", len(looks))


def read_hex(path):
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = 'Non-Color'
    px = list(img.pixels)
    w = img.size[0]; h = img.size[1]
    i = ((h//2)*w + (w//2))*4
    v = px[i:i+3]
    bpy.data.images.remove(img)
    return "%02X%02X%02X" % tuple(round(max(0,min(1,c))*255) for c in v), v

results = {}
for strength in (1.0, 2.0, 4.0):
    bg.inputs[1].default_value = strength
    for vt in vt_items:
        if vt in ('False Color','Raw','Filmic Log'): continue
        scene.view_settings.view_transform = vt
        
        try: scene.view_settings.look = 'None'
        except TypeError:
            try: scene.view_settings.look = 'AgX - Base Contrast'
            except TypeError: pass
        p = os.path.join(OUT, f"t_{vt.replace(' ','_')}_{strength}.png")
        scene.render.filepath = p
        bpy.ops.render.render(write_still=True)
        h, v = read_hex(p)
        results.setdefault(str(strength), {})[vt] = h
        print(f"RESULT strength={strength} vt={vt} -> #{h}  linear={[round(x,4) for x in v]}")

print("TARGET:", HEX)
print(json.dumps(results, indent=1))
