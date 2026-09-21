# -*- coding: utf-8 -*-
"""
Матовые объекты первого экрана — «пластилиновый» набор.

ОТКУДА ЗАДАЧА. Владелец, 21.09.2026, прислал два разворота Яндекс
Практикума: «рендеры и сайт в таком стиле надо». Стиль — матовые
объёмные объекты с пескоструйной поверхностью на светлой лавандовой
плите, мягкая тень, чёрный жирный гротеск рядом.

ЧТО ИМЕННО РЕНДЕРИМ. Не срисованную «снежинку» референса, а СВОЙ знак:
четыре стрелки Atlas, повёрнутые внутрь (формы один в один из
`src/components/pixel/BrandMark.tsx`, тот же источник, что у иконки
приложения). Плюс два спутника, у каждого есть смысл:

  · тумблер с салатовой кнопкой — «включено»: одно касание, и работает;
  · коралловая линза — страна, которую выбирают в приложении.

Цвет объектов задан владельцем как часть стиля: графит, коралл,
салатовый. На сайте он живёт ТОЛЬКО в рендерах — кнопки и ссылки
остаются кобальтовыми (решение владельца 21.09.2026), иначе пришлось
бы перекрашивать кабинет, оплату и письма.

КАК ЗАПУСКАТЬ. Blender 5.2, вкладка Scripting → открыть этот файл →
Run. Скрипт собирает сцену с нуля и кладёт кадры в
`public/media/clay/`. Повторный запуск безопасен: сцена очищается.
"""

import bpy
import math
import os
from mathutils import Vector

# ─── Куда складывать кадры ───────────────────────────────────────────
# Путь от файла .blend не зависит: скрипт может быть запущен из
# несохранённой сцены, а кадры всё равно должны лечь в репозиторий.
REPO = "/Users/maximiliannovikov/Desktop/Novikov-claude-create-claude-documentation-9WUuP"
OUT = os.path.join(REPO, "public", "media", "clay")
os.makedirs(OUT, exist_ok=True)

# ─── Материалы ───────────────────────────────────────────────────────
# Графит, коралл, салатовый. Значения взяты с разворотов владельца
# пипеткой и округлены; альфа не используется — объекты непрозрачные.
GRAPHITE = (0.055, 0.055, 0.060, 1.0)
CORAL    = (0.780, 0.230, 0.090, 1.0)
SAGE     = (0.300, 0.640, 0.240, 1.0)
PLATE    = (0.870, 0.885, 0.930, 1.0)   # светлая подложка под объектом


def clear_scene():
    """Полная очистка: объекты, меши, материалы, кривые."""
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                  bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def clay(name, rgba, rough=0.62):
    """
    Матовая «пластилиновая» поверхность.

    Три вещи делают материал похожим на референс, и все три нужны:
      · высокая шероховатость — блик размазан, а не точечный;
      · лёгкий рельеф шумом — пескоструйная, а не полированная кожа;
      · слабое подповерхностное рассеяние — край объекта не выглядит
        вырезанным из картона.

    Узлы ищутся ПО ТИПУ, а не по имени: на нерусском Blender имя
    «Principled BSDF» другое, и поиск по имени вернул бы None.
    """
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")

    def put(socket, value):
        if socket in bsdf.inputs:
            bsdf.inputs[socket].default_value = value

    put("Base Color", rgba)
    put("Roughness", rough)
    put("Metallic", 0.0)
    put("Specular IOR Level", 0.32)
    put("IOR", 1.42)

    # Рельеф: мелкий шум через Bump. Сила маленькая — на рендере это
    # должно читаться как фактура материала, а не как рябь.
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = 260.0
    tex.inputs["Detail"].default_value = 6.0
    tex.inputs["Roughness"].default_value = 0.55
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.10
    bump.inputs["Distance"].default_value = 0.004
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    if "Normal" in bsdf.inputs:
        nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


# ─── Знак Atlas: четыре стрелки внутрь ───────────────────────────────
# Контуры скопированы из BrandMark.tsx (viewBox 200×200, ось Y вниз).
# Здесь они переводятся в метры сцены и переворачиваются по Y.
ARROWS = [
    [(20,15),(60,15),(60,30),(42,30),(75,63),(63,75),(30,42),(30,60),(15,60),(15,20)],
    [(180,15),(140,15),(140,30),(158,30),(125,63),(137,75),(170,42),(170,60),(185,60),(185,20)],
    [(20,185),(60,185),(60,170),(42,170),(75,137),(63,125),(30,158),(30,140),(15,140),(15,180)],
    [(180,185),(140,185),(140,170),(158,170),(125,137),(137,125),(170,158),(170,140),(185,140),(185,180)],
]
SCALE = 1.0 / 100.0   # 200 единиц SVG → 2 метра сцены


def svg_polygon(name, pts, depth=0.34, bevel=0.035):
    """Плоский контур из SVG → объёмная деталь со скруглённой кромкой."""
    verts = [(x * SCALE - 1.0, -(y * SCALE - 1.0), 0.0) for (x, y) in pts]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], [list(range(len(verts)))])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)

    solid = obj.modifiers.new("Solidify", "SOLIDIFY")
    solid.thickness = depth
    solid.offset = 0.0

    bev = obj.modifiers.new("Bevel", "BEVEL")
    bev.width = bevel
    bev.segments = 6
    bev.limit_method = "ANGLE"
    bev.angle_limit = math.radians(40)

    obj.modifiers.new("Smooth", "SUBSURF").levels = 0
    return obj


def build_mark():
    """Знак Atlas: четыре стрелки, чуть приподнятые и развёрнутые."""
    mat = clay("clay_graphite", GRAPHITE)
    parts = []
    for i, pts in enumerate(ARROWS):
        o = svg_polygon(f"AtlasArrow{i}", pts)
        o.data.materials.append(mat)
        # Каждая стрелка приподнята по-своему: набор не плоский, и
        # тени между деталями дают объём, которого нет у плоской иконки.
        o.location.z = 0.05 * (i % 2)
        parts.append(o)

    root = bpy.data.objects.new("AtlasMark", None)
    bpy.context.collection.objects.link(root)
    for o in parts:
        o.parent = root
    return root


def build_toggle():
    """Тумблер: графитовая капсула и салатовая кнопка в положении «вкл»."""
    body_mat = clay("clay_toggle_body", GRAPHITE)
    knob_mat = clay("clay_toggle_knob", SAGE, rough=0.55)

    bpy.ops.mesh.primitive_cylinder_add(radius=0.40, depth=0.34, vertices=64,
                                        rotation=(math.radians(90), 0, 0))
    left = bpy.context.object
    bpy.ops.mesh.primitive_cylinder_add(radius=0.40, depth=0.34, vertices=64,
                                        rotation=(math.radians(90), 0, 0),
                                        location=(0.62, 0, 0))
    right = bpy.context.object
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.31, 0, 0))
    middle = bpy.context.object
    middle.scale = (0.62, 0.34, 0.80)

    for o in (left, right, middle):
        o.select_set(True)
    bpy.context.view_layer.objects.active = left
    bpy.ops.object.join()
    body = bpy.context.object
    body.name = "ToggleBody"
    body.data.materials.append(body_mat)
    b = body.modifiers.new("Bevel", "BEVEL")
    b.width = 0.03
    b.segments = 5

    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.30, segments=48, ring_count=24,
                                         location=(0.62, -0.06, 0.02))
    knob = bpy.context.object
    knob.name = "ToggleKnob"
    knob.scale = (1.0, 0.72, 1.0)
    knob.data.materials.append(knob_mat)
    bpy.ops.object.shade_smooth()

    root = bpy.data.objects.new("Toggle", None)
    bpy.context.collection.objects.link(root)
    body.parent = root
    knob.parent = root
    return root


def build_lens():
    """Коралловая линза — страна, которую выбирают в приложении."""
    mat = clay("clay_lens", CORAL, rough=0.58)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.52, depth=0.20, vertices=96)
    o = bpy.context.object
    o.name = "Lens"
    o.data.materials.append(mat)
    b = o.modifiers.new("Bevel", "BEVEL")
    b.width = 0.07
    b.segments = 8
    bpy.ops.object.shade_smooth()
    return o


# ─── Свет и камера ───────────────────────────────────────────────────

def setup_stage(size_px=1600):
    """
    Студия: мягкий ключ сверху-слева, заливка справа, подложка-ловушка
    тени. Кадр квадратный — так объект одинаково садится и в широкую
    колонку, и в телефонную.
    """
    scn = bpy.context.scene
    # Cycles: мягкая тень и настоящее подповерхностное рассеяние.
    # Присваивание в try: движок — динамический enum, и RNA его
    # недосчитывает (см. инструкцию Blender MCP).
    try:
        scn.render.engine = "CYCLES"
    except TypeError as e:
        print("движок не переключился:", e)
    if scn.render.engine == "CYCLES":
        scn.cycles.samples = 256
        scn.cycles.use_denoising = True

    scn.render.resolution_x = size_px
    scn.render.resolution_y = size_px
    scn.render.film_transparent = True
    scn.render.image_settings.file_format = "PNG"
    scn.render.image_settings.color_mode = "RGBA"
    scn.view_settings.view_transform = "Standard"

    # Ключ — большой площадной источник слева сверху: именно он делает
    # тень длинной и мягкой, как на развороте владельца.
    bpy.ops.object.light_add(type="AREA", location=(-3.2, -2.6, 4.6))
    key = bpy.context.object
    key.name = "Key"
    key.data.energy = 900
    key.data.size = 6.0
    key.rotation_euler = (math.radians(34), math.radians(-18), math.radians(-28))

    # Заливка — слабее и холоднее: она только открывает теневую сторону.
    bpy.ops.object.light_add(type="AREA", location=(3.4, -1.6, 2.2))
    fill = bpy.context.object
    fill.name = "Fill"
    fill.data.energy = 200
    fill.data.size = 7.0
    fill.data.color = (0.86, 0.89, 1.0)
    fill.rotation_euler = (math.radians(66), 0, math.radians(52))

    # Подложка. Она же ловушка тени: плита не видна, видна только тень,
    # поэтому один и тот же кадр ложится на любой фон страницы.
    bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, -0.34))
    floor = bpy.context.object
    floor.name = "Floor"
    floor.data.materials.append(clay("clay_floor", PLATE, rough=0.9))
    if hasattr(floor, "is_shadow_catcher"):
        floor.is_shadow_catcher = True

    bpy.ops.object.camera_add(location=(0, -6.2, 4.4))
    cam = bpy.context.object
    cam.name = "ClayCam"
    cam.data.lens = 85
    cam.rotation_euler = (math.radians(56), 0, 0)
    scn.camera = cam
    return cam


def aim(cam, target, margin=1.5):
    """Навести камеру на объект и отодвинуть по его габариту."""
    cam.constraints.clear()
    c = cam.constraints.new("TRACK_TO")
    c.target = target
    c.track_axis = "TRACK_NEGATIVE_Z"
    c.up_axis = "UP_Y"
    bpy.context.view_layer.update()


def render_to(name):
    path = os.path.join(OUT, name)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("кадр:", path)
    return path


# ─── Значения, подобранные замером 21.09.2026 ────────────────────────
# Собранная сцена лежит в `atlas_clay.blend` — эти числа её описывают.
#
# ЗАЗОР МЕЖДУ СТРЕЛКАМИ 0,22 м. Проверено тремя пробами: на 0,14 знак
# рассыпается на четыре отдельных значка, на 0,30 стрелки слипаются в
# кирпич с прорезанным крестом. 0,22 — единственное, при котором знак
# читается целым предметом и остаётся знаком.
ARROW_GAP = 0.22

# ФАКТУРА. Шум масштаба 420 при кадре 900 px мельче пикселя: материал
# выходил полированным пластиком. Рабочие значения — масштаб 26,
# сила рельефа 1,0, дистанция 0,03. Тем же шумом меняется
# шероховатость, иначе блик лежит ровным пятном.
GRAIN = {"scale": 26.0, "detail": 15.0, "bump": 1.0, "distance": 0.030}

# СВЕТ. Ключ 380 Вт: на 900 верх линзы и кнопки уходил в белый, и
# краска читалась пастельной. Заливка 60 Вт и подсветка мира 0,45 —
# без них теневая сторона проваливается в чёрный.
LIGHT = {"key": 380, "fill": 60, "world": 0.45}

# КАМЕРА. 58–62 мм с 6,6 м. На 95 мм кадр выходил 2,5 м шириной, и
# спутники на x ≈ 1,5 оказывались за краем.
CAMERA = {"lens": 62, "location": (0.35, -6.6, 4.9)}

# ВЫВОД. `resolution_percentage` обязан стоять на 100: при меньшем
# `save_render` молча пишет уменьшенный кадр — так 900 px однажды
# превратились в 633 px.
#
# После рендера альфа чистится по пикселям: ловушка тени оставляет по
# всему кадру альфу ≈ 1/255, и на светлой плите сайта глаз ловит
# прямоугольный край картинки. Всё слабее 2 % обнуляется, остальное
# растягивается обратно. Композитор для этого не годится: в Blender
# 5.2 у сцены нет `node_tree`, а узла Map Range в компоситоре нет.
#
#     import numpy as np
#     img = bpy.data.images.load(png)
#     buf = np.empty(img.size[0] * img.size[1] * 4, dtype=np.float32)
#     img.pixels.foreach_get(buf)
#     a = buf[3::4]
#     buf[3::4] = np.clip((a - 0.02) / 0.98, 0.0, 1.0)
#     img.pixels.foreach_set(buf)
#     img.save_render(png, scene=bpy.context.scene)
