"""
Корпус iPhone 17 Pro Max для /install-ios — фронтальный ортографический кадр.

Запуск: открыть design/blender/atlas_iphone.blend (сцена «AtlasIphone») и в
Blender 5.2 выполнить этот файл (Scripting → Open → Run, или
`exec(open(path).read())`). Скрипт идемпотентен: камера IP_ShellCam
создаётся один раз, правки модели ставятся абсолютными значениями.

Что делает:
1. Приводит модель к опубликованным размерам Apple (support.apple.com/125091):
   корпус 163,4 × 78,0 × 8,75 мм; активная область дисплея 6,9" =
   2868 × 1320 px при 460 ppi = 158,37 × 72,89 мм; Dynamic Island
   ~11 pt от верхнего края дисплея.
2. Гасит экран (чёрное стекло): живой экран рисует HTML/CSS страницы.
3. Рендерит 960 × 1992 px (12 px/мм, кадр 80 × 166 мм) с прозрачным фоном
   в OUT_PNG. Вырез экрана делает design/blender/iphone_shell_post.py —
   он же пишет public/media/ios/shell.webp и печатает проценты для CSS.
"""
import bpy, math

OUT_PNG = bpy.path.abspath("//iphone-screens/shell.png") if bpy.data.filepath else "/tmp/iphone_shell.png"
if "OUT_PNG_OVERRIDE" in globals():
    OUT_PNG = globals()["OUT_PNG_OVERRIDE"]
SPP = globals().get("SHELL_SPP", 384)

sc = bpy.data.scenes["AtlasIphone"]
bpy.context.window_manager.windows[0].scene = sc
A = bpy.data.objects["IP_A"]
B = bpy.data.objects.get("IP_B")

# --- 1. размеры -------------------------------------------------------------
# Меш построен 77,9 × 163,0 × 8,35 мм (iphone_build.py) — масштаб корня
# доводит его до 78,0 × 163,4 × 8,75 (изменение ≤ 0,3 % по плоскости,
# радиусы углов визуально не меняются).
A.scale = (78.0 / 77.9, 163.4 / 163.0, 8.75 / 8.35)
A.rotation_euler = (math.radians(90), 0.0, 0.0)       # экран смотрит в −Y, прямо в камеру
A.location = (0.0, 0.0, 0.0817)
# Остров: верхний край на ~11 pt (1,8 мм) от края дисплея, как у iPhone 14 Pro+.
for n in ("IP_A_Island", "IP_A_IslandCam"):
    bpy.data.objects[n].location.y = 0.0006

def hide_tree(root, flag):
    for o in [root] + list(root.children_recursive):
        o.hide_render = flag
        o.hide_viewport = flag

hide_tree(A, False)
if B:
    hide_tree(B, True)
for n in ("IP_Floor", "IP_LFloor"):
    if n in bpy.data.objects:
        bpy.data.objects[n].hide_render = True

# --- 2. экран выключен ------------------------------------------------------
scr = bpy.data.materials["IP_Screen"].node_tree.nodes["Principled BSDF"]
scr.inputs["Emission Strength"].default_value = 0.0
scr.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
# Остров — чёрные пиксели OLED, а не глянцевая капсула: без блика ключевого
# света он читался серой «таблеткой» над экраном.
isl = bpy.data.materials["IP_Island"].node_tree.nodes["Principled BSDF"]
isl.inputs["Base Color"].default_value = (0.0, 0.0, 0.0, 1.0)
isl.inputs["Roughness"].default_value = 0.6
isl.inputs["Specular IOR Level"].default_value = 0.02

# --- 3. камера и рендер -----------------------------------------------------
cd = bpy.data.cameras.get("IP_ShellCam") or bpy.data.cameras.new("IP_ShellCam")
cd.type = 'ORTHO'
cd.ortho_scale = 0.166            # по большей стороне кадра: 166 мм
cd.sensor_fit = 'AUTO'
cd.clip_start = 0.01
cd.clip_end = 5.0
cam = bpy.data.objects.get("IP_ShellCam")
if cam is None:
    cam = bpy.data.objects.new("IP_ShellCam", cd)
    sc.collection.objects.link(cam)
cam.location = (0.0, -0.6, 0.0817)
cam.rotation_euler = (math.radians(90), 0.0, 0.0)
sc.camera = cam

r = sc.render
r.engine = 'CYCLES'
sc.cycles.samples = SPP
sc.cycles.use_adaptive_sampling = True
sc.cycles.adaptive_threshold = 0.004
sc.cycles.use_denoising = True
r.film_transparent = True
r.resolution_x, r.resolution_y = 960, 1992
r.resolution_percentage = 100
r.pixel_aspect_x = r.pixel_aspect_y = 1.0
r.image_settings.file_format = 'PNG'
r.image_settings.color_mode = 'RGBA'
r.image_settings.color_depth = '16'
r.filepath = OUT_PNG
bpy.ops.render.render(write_still=True, scene=sc.name)
print("shell rendered ->", OUT_PNG)
