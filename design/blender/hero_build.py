"""Первый экран главной — ноутбук и телефон в ОДНОЙ сцене.

Запуск (headless, из корня репозитория):

    /Applications/Blender.app/Contents/MacOS/Blender -b \
      design/blender/atlas_laptop.blend -S AtlasLaptop -P design/blender/hero_build.py \
      -- --out /tmp/hero.png --samples 64 --width 1200

Зачем сцена одна. До 18.09.2026 первый экран складывали из двух разных
рендеров: ноутбук — перспектива 60 мм с мягкой студийной тенью, телефон —
фронтальная ортокамера без тени вообще (его корпус снимали для /install-ios,
где экран живой HTML). Рядом это читается как аппликация: у предметов
разная перспектива, разный свет и тень, нарисованная CSS-фильтром. Здесь
оба предмета стоят на одном полу, под одним светом и в одном объективе —
тень телефона падает на тот же пол, что и тень ноутбука.

Модели не пересобираются: ноутбук уже собран в atlas_laptop.blend
(laptop_build.py), телефон прилинковывается из atlas_iphone.blend
(iphone_shell.py, корень IP_A). Экраны — снимки живого кабинета
(laptop-screen/dash.cjs и iphone-screens/dash.cjs).

Кадр рендерится с прозрачным фоном: белый фон накладывает уже
hero_post.py, он же кодирует WebP.
"""
import bpy, os, sys, math, mathutils

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None):
    return argv[argv.index(name) + 1] if name in argv else default


HERE = os.path.dirname(bpy.data.filepath) or "design/blender"
IPHONE_BLEND = os.path.join(HERE, "atlas_iphone.blend")
PHONE_PNG = os.path.join(HERE, "iphone-screens", "dash-440.png")

OUT = arg("--out", "/tmp/hero.png")
SAMPLES = int(arg("--samples", "64"))
WIDTH = int(arg("--width", "1200"))
# Высота кадра берётся с запасом (0,72 вместо 0,643 от ширины): при
# прежней пропорции тень под телефоном упиралась в нижний край кадра и
# после обрезки давала прямой шов — владелец 18.09.2026: «резкий переход
# с рендеров, там тень». Обрезка всё равно ужимает кадр по содержимому,
# так что лишняя высота ничего не стоит.
HEIGHT = int(round(WIDTH * float(arg("--aspect", "0.72"))))

sc = bpy.context.scene
sc.frame_set(sc.frame_end)  # крышка открыта, экран горит

# ── Телефон из соседнего файла ────────────────────────────────────
# Линкуем именно объекты (не коллекцию): в atlas_iphone.blend модель
# лежит прямо в сцене AtlasIphone, коллекции у неё нет.
with bpy.data.libraries.load(IPHONE_BLEND) as (src, dst):
    dst.objects = [n for n in src.objects if n.startswith("IP_A")]
phone_objs = [o for o in dst.objects if o]
for o in phone_objs:
    sc.collection.objects.link(o)
root = next(o for o in phone_objs if o.name.startswith("IP_A") and o.type == "EMPTY")

# ── Экран телефона: снимок кабинета как свечение ──────────────────
screen = next((o for o in phone_objs if o.name.endswith("_Screen")), None)
if screen is not None:
    mat = bpy.data.materials.new("HERO_PhoneScreen")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    img = bpy.data.images.load(PHONE_PNG, check_existing=True)
    img.reload()
    img.colorspace_settings.name = "sRGB"
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Cubic"
    tex.extension = "EXTEND"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = float(arg("--phone-glow", "1.55"))
    bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
    bsdf.inputs["Roughness"].default_value = 0.08
    screen.data.materials.clear()
    screen.data.materials.append(mat)

# ── Постановка: телефон стоит слева впереди, чуть развёрнут ───────
# Плоский телефон смотрит экраном в +Z. Поворот по X на 78° ставит его
# почти вертикально и наклоняет экран к камере (она выше предмета).
root.rotation_euler = (math.radians(float(arg("--phone-tilt", "78"))), 0.0, math.radians(float(arg("--phone-yaw", "17"))))
root.location = (float(arg("--phone-x", "-0.255")), float(arg("--phone-y", "-0.145")), 0.0)
bpy.context.view_layer.update()


def bbox(objs):
    lo = mathutils.Vector((1e9, 1e9, 1e9))
    hi = mathutils.Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(c)
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    return lo, hi


lo, hi = bbox(phone_objs)
root.location.z -= lo.z  # ставим ровно на пол, без провала и без парения
bpy.context.view_layer.update()

# ── Камера кадра: шире, чем у одного ноутбука ────────────────────
# Камера наводится ограничителем Track To на точку между предметами:
# так кадр строится тремя понятными числами — расстояние, азимут и
# высота, — и его можно править, не пересчитывая углы Эйлера.
AIM = (float(arg("--aim-x", "-0.055")), float(arg("--aim-y", "0.015")), float(arg("--aim-z", "0.082")))
DIST = float(arg("--dist", "1.02"))
AZ = math.radians(float(arg("--az", "-26")))     # 0° — прямо спереди, минус — левее
EL = math.radians(float(arg("--el", "15.5")))    # высота взгляда над предметом

aim = bpy.data.objects.new("HERO_Aim", None)
aim.location = AIM
sc.collection.objects.link(aim)

cam_data = bpy.data.cameras.new("HERO_CamData")
cam_data.lens = float(arg("--lens", "58"))
cam = bpy.data.objects.new("HERO_Cam", cam_data)
sc.collection.objects.link(cam)
cam.location = (
    AIM[0] + DIST * math.cos(EL) * math.sin(AZ),
    AIM[1] - DIST * math.cos(EL) * math.cos(AZ),
    AIM[2] + DIST * math.sin(EL),
)
tt = cam.constraints.new("TRACK_TO")
tt.target = aim
tt.track_axis = "TRACK_NEGATIVE_Z"
tt.up_axis = "UP_Y"
sc.camera = cam
bpy.context.view_layer.update()

# ── Свет: контактная тень ────────────────────────────────────────
# Отражатель в пол (LT_LFloor) поставлен для одиночного ноутбука и
# почти съедал тень под предметами — вдвоём они начинали «парить».
# Гасим его настолько, чтобы предметы стояли, а не висели.
floor_light = sc.objects.get("LT_LFloor")
if floor_light is not None:
    floor_light.data.energy = float(arg("--floor-light", "255"))

# ── Рендер ────────────────────────────────────────────────────────
r = sc.render
r.resolution_x, r.resolution_y = WIDTH, HEIGHT
r.resolution_percentage = 100
r.film_transparent = True
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGBA"
r.image_settings.color_depth = "8"
sc.cycles.samples = SAMPLES
sc.cycles.use_denoising = True
r.filepath = OUT
bpy.ops.render.render(write_still=True)
print("hero rendered:", OUT, WIDTH, "x", HEIGHT, SAMPLES, "samples")
