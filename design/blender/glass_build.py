# -*- coding: utf-8 -*-
"""
Стеклянная сцена — рендеры для экрана входа и первого блока главной.

ОТКУДА ЗАДАЧА. Владелец, 21.09.2026, прислал разворот с экрана входа
Яндекс 360: «хочу такие рендеры, в таком стиле — технологичные,
красивые, проработанные. Мини-игру уберём, симулятор не нужен».

ЧТО ИМЕННО ВОСПРОИЗВОДИТСЯ. Не срисованный объект, а ПРИЁМ:
  · плита из рифлёного полупрозрачного стекла — вертикальные рёбра,
    сквозь которые фон виден полосами;
  · внутри стекла градиент от светло-голубого к насыщенному синему и
    мелкие пузырьки;
  · рядом матовый кобальтовый диск с белым знаком и тёмно-синее кольцо
    с вырезанным глифом;
  · чистое стекло тором и рифлёная капсула;
  · светло-серый фон с мягким градиентом, контактной тени нет.

ЧТО ЗАМЕНЕНО НА СВОЁ. В референсе внутри плиты стоит буква «Ю» — чужой
знак. У нас там знак Atlas: четыре стрелки из `BrandMark.tsx`, тот же
источник, что у иконки приложения. Кольцо с человеком оставлено как
есть: это общий символ учётной записи, и на экране входа он к месту.

РЁБРА СДЕЛАНЫ ГЕОМЕТРИЕЙ, А НЕ ШЕЙДЕРОМ. Волна в нормали рисует
полосы НА поверхности, но фон за плитой она полосами не ломает — а
именно это и есть весь приём. Рёбра — настоящие полуцилиндры,
приваренные к лицевой стороне, и свет через них по-настоящему
преломляется.

КАК ЗАПУСКАТЬ. Blender 5.2, Scripting → Run.
"""

import bpy
import math
import os

REPO = "/Users/maximiliannovikov/Desktop/Novikov-claude-create-claude-documentation-9WUuP"
OUT = os.path.join(REPO, "public", "media", "glass")


# ─── Цвет ────────────────────────────────────────────────────────────
# Хексы сайта переводятся в линейное пространство: Blender ждёт
# линейные значения, и вбитый напрямую sRGB даёт заметно светлее.

def s2l(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(hexstr, a=1.0):
    h = hexstr.lstrip("#")
    return (s2l(int(h[0:2], 16)), s2l(int(h[2:4], 16)), s2l(int(h[4:6], 16)), a)


COBALT = rgb("#3A85F0")      # цвет действия на сайте
NAVY   = rgb("#1E3A6E")      # тёмно-синее кольцо
GLASS  = rgb("#4FA8E8")      # дальний конец градиента внутри стекла
WHITE  = rgb("#FFFFFF")
PAPER  = rgb("#E9EAEC")      # фон


def clear():
    """Сцена собирается с нуля при каждом запуске."""
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                bpy.data.lights, bpy.data.cameras, bpy.data.node_groups):
        for it in list(blk):
            if it.users == 0:
                blk.remove(it)


# ─── Материалы ───────────────────────────────────────────────────────

def _bsdf(mat):
    """Узел ищется ПО ТИПУ: на нерусском Blender имя другое."""
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def _put(b, key, value):
    if key in b.inputs:
        b.inputs[key].default_value = value
        return True
    return False


def mat_glass(name, tint=GLASS, rough=0.035, ior=1.47, density=3.6, gradient=True):
    """
    Рифлёное стекло.

    ЦВЕТ ЖИВЁТ В ПРОПУСКАНИИ, А НЕ В ОБЪЁМЕ, и это вынужденно.
    Сначала здесь стояло `Volume Absorption` — честный способ: свет
    окрашивается по мере прохода сквозь толщу, тонкий край выходит
    почти белым, глубокая часть насыщенной. Но объёму нужен ЗАМКНУТЫЙ
    контур, а наша плита им не является: рёбра приварены к телу и
    срезаны булевым, внутри остались пересечения и открытые кромки.
    Cycles на такой сетке объём просто не считает — стекло выходило
    бесцветным, сколько плотности ни задай.

    Поэтому цвет положен в `Base Color` при `Transmission = 1`: это
    окраска на поверхности, не по толщине. Переход от почти белого к
    синему она сама не сделает — его рисует градиент по координатам
    объекта, ровно так, как он идёт в референсе, по диагонали.

    `density` оставлен в подписи и управляет насыщенностью дальнего
    конца шкалы: переименовывать его не стал, чтобы уже подобранное
    значение 3,6 не потеряло смысла.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    _put(b, "Roughness", rough)
    _put(b, "Metallic", 0.0)
    _put(b, "IOR", ior)
    if not _put(b, "Transmission Weight", 1.0):
        _put(b, "Transmission", 1.0)

    if gradient:
        k = min(1.0, density / 5.0)
        deep = tuple(1.0 - (1.0 - c) * k for c in tint[:3]) + (1.0,)
        tex = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Rotation"].default_value = (0, 0, math.radians(38))
        # Координаты объекта у плиты идут примерно от −1,8 до 1,8, а
        # градиент читает 0..1 — без приведения он весь выпадает за
        # края и даёт ровную заливку одним концом шкалы.
        mp.inputs["Scale"].default_value = (0.26, 0.26, 0.26)
        mp.inputs["Location"].default_value = (0.5, 0.5, 0.0)
        grad = nt.nodes.new("ShaderNodeTexGradient")
        ramp = nt.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.10
        ramp.color_ramp.elements[0].color = (0.97, 0.99, 1.0, 1)
        ramp.color_ramp.elements[1].position = 0.95
        ramp.color_ramp.elements[1].color = deep
        nt.links.new(tex.outputs["Object"], mp.inputs["Vector"])
        nt.links.new(mp.outputs["Vector"], grad.inputs["Vector"])
        nt.links.new(grad.outputs["Color"], ramp.inputs["Fac"])
        nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])
    else:
        _put(b, "Base Color", tint)
    return m


def mat_matte(name, color, rough=0.34, coat=0.25):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = _bsdf(m)
    _put(b, "Base Color", color)
    _put(b, "Roughness", rough)
    _put(b, "Metallic", 0.0)
    _put(b, "IOR", 1.50)
    _put(b, "Specular IOR Level", 0.5)
    if coat:
        _put(b, "Coat Weight", coat)
        _put(b, "Coat Roughness", 0.12)
    return m


MATS = {}


def build_materials():
    MATS.clear()
    MATS["glass"] = mat_glass("g_glass")
    MATS["glass_clear"] = mat_glass("g_clear", tint=WHITE, density=0.5, rough=0.02, gradient=False)
    # Пузырьки: крошечные шарики ВНУТРИ стекла. Материал у них не
    # светящийся — они видны тем, что преломляют иначе, чем окружающая
    # толща, и ловят свет точками.
    MATS["speck"] = mat_glass("g_speck", tint=WHITE, density=0.0, rough=0.0, ior=1.05, gradient=False)
    MATS["cobalt"] = mat_matte("g_cobalt", COBALT, rough=0.30)
    MATS["navy"] = mat_matte("g_navy", NAVY, rough=0.38, coat=0.18)
    MATS["white"] = mat_matte("g_white", WHITE, rough=0.28)
    return MATS


# ─── Примитивы ───────────────────────────────────────────────────────

def box(name, size, loc=(0, 0, 0), mat=None, bevel=0.04, seg=6, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = seg
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(40)
        b.harden_normals = True
    bpy.ops.object.shade_smooth()
    if mat:
        o.data.materials.append(mat)
    return o


def cyl(name, r, d, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, verts=96, bevel=0.02, seg=4):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d, vertices=verts,
                                        location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    if bevel:
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = seg
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(40)
    bpy.ops.object.shade_smooth()
    if mat:
        o.data.materials.append(mat)
    return o


def boolean(target, cutter, op="DIFFERENCE"):
    """Булев вырез. Резак уходит из сцены — он служебный."""
    m = target.modifiers.new("Bool", "BOOLEAN")
    m.operation = op
    m.object = cutter
    m.solver = "EXACT"
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    return target


def join(objs, name, bake=True):
    """
    Собирает детали в один объект.

    `bake` ЗАПЕКАЕТ ПОВОРОТ В СЕТКУ, и это не мелочь. Деталь собирается
    повёрнутой (диск и кольцо смотрят в камеру, капсула лежит на боку),
    а потом сцена ставит её на место через `rotation_euler` — и это
    присваивание ЗАТИРАЕТ сборочный поворот, а не добавляется к нему.
    На первых прогонах из-за этого диск, кольцо и капсула вставали
    ребром к камере: собраны они были верно, а сцена разворачивала их
    обратно. После запекания объект приходит с нулевым поворотом, и
    сцена складывает только своё.
    """
    # СНАЧАЛА СНЯТЬ ВЫДЕЛЕНИЕ СО ВСЕГО. `object.join()` берёт ВСЕ
    # выделенные объекты, а не только переданные сюда. Без этой строки
    # в склейку молча уходило то, что осталось выделенным от прошлого
    # шага: плита приклеивалась к знаку и забирала его материал, а сам
    # знак пропадал из сцены — искать такое по рендеру можно долго.
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.object
    o.name = name
    if bake:
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


# ─── Рифление ────────────────────────────────────────────────────────

def ribs(name, width, height, depth_r, count, loc=(0, 0, 0), mat=None):
    """
    Вертикальные рёбра-полуцилиндры на лицевой стороне.

    Число рёбер выбрано не на глаз: при ширине кадра 1400 px плита
    занимает около 900 px, и ребро должно быть шире трёх пикселей,
    иначе на рендере оно превращается в рябь, а при сжатии в WebP
    исчезает вовсе. Отсюда потолок примерно в двадцать рёбер на
    плиту такого размера.
    """
    step = width / count
    parts = []
    for i in range(count):
        x = -width / 2 + step * (i + 0.5)
        # Ось цилиндра и так Z — рёбра вертикальные, поворот не нужен.
        # (Первый заход клал их плашмя: с поворотом на 90° по X ось
        # уходит в Y, и вместо рифления получались валики поперёк.)
        c = cyl("%s_r%d" % (name, i), depth_r, height,
                (loc[0] + x, loc[1], loc[2]),
                (0, 0, 0), None, verts=28, bevel=0)
        # Задняя половина срезается. Целый цилиндр внутри стекла даёт
        # ВТОРУЮ линию — заднюю кромку, видную насквозь, — и рёбер на
        # рендере получается вдвое больше, чем задумано.
        cut = box("%s_c%d" % (name, i), (depth_r * 2.4, depth_r * 1.4, height * 1.2),
                  (loc[0] + x, loc[1] + depth_r * 0.7, loc[2]), None, bevel=0)
        c = boolean(c, cut)
        parts.append(c)
    o = join(parts, name)
    if mat:
        o.data.materials.append(mat)
    return o


# ─── Знак Atlas ──────────────────────────────────────────────────────
# Контуры один в один из `src/components/pixel/BrandMark.tsx` — тот же
# источник, что у иконки приложения. Свой знак в стекле вместо чужой
# буквы из референса.

ARROWS = [
    [(20,15),(60,15),(60,30),(42,30),(75,63),(63,75),(30,42),(30,60),(15,60),(15,20)],
    [(180,15),(140,15),(140,30),(158,30),(125,63),(137,75),(170,42),(170,60),(185,60),(185,20)],
    [(20,185),(60,185),(60,170),(42,170),(75,137),(63,125),(30,158),(30,140),(15,140),(15,180)],
    [(180,185),(140,185),(140,170),(158,170),(125,137),(137,125),(170,158),(170,140),(185,140),(185,180)],
]


def atlas_mark(name, size=1.0, depth=0.16, loc=(0, 0, 0), mat=None):
    """Четыре стрелки знака, плоскость XZ (лицом к камере по -Y)."""
    k = size / 200.0
    parts = []
    for i, pts in enumerate(ARROWS):
        verts = [(x * k - size / 2, 0.0, -(y * k - size / 2)) for (x, y) in pts]
        mesh = bpy.data.meshes.new("%s_a%d" % (name, i))
        mesh.from_pydata(verts, [], [list(range(len(verts)))])
        mesh.update()
        o = bpy.data.objects.new("%s_a%d" % (name, i), mesh)
        bpy.context.collection.objects.link(o)
        sol = o.modifiers.new("Solidify", "SOLIDIFY")
        sol.thickness = depth
        sol.offset = 0.0
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width = 0.012
        b.segments = 3
        b.limit_method = "ANGLE"
        parts.append(o)
    o = join(parts, name)
    o.location = loc
    if mat:
        o.data.materials.append(mat)
    return o


def person_cutter(name, size=1.0, loc=(0, 0, 0)):
    """
    Силуэт человека — резак для кольца учётной записи.

    Голова шаром, плечи — сплюснутой сферой: так силуэт читается при
    любом размере, в отличие от набранной из прямоугольников фигуры.
    """
    bpy.ops.mesh.primitive_uv_sphere_add(radius=size * 0.26, segments=48, ring_count=24,
                                         location=(loc[0], loc[1], loc[2] + size * 0.30))
    head = bpy.context.object
    head.scale = (1.0, 2.0, 1.0)

    bpy.ops.mesh.primitive_uv_sphere_add(radius=size * 0.52, segments=48, ring_count=24,
                                         location=(loc[0], loc[1], loc[2] - size * 0.52))
    body = bpy.context.object
    body.scale = (1.0, 2.0, 0.72)

    # Плечи снизу срезаются: иначе получается не человек, а снеговик.
    cut = box("%s_cut" % name, (size * 2, size * 2, size * 0.7),
              (loc[0], loc[1], loc[2] - size * 1.06), None, bevel=0)
    body = boolean(body, cut)
    return join([head, body], name)


# ─── Объекты сцены ───────────────────────────────────────────────────

def build_plate(name="plate", w=3.4, h=3.4, d=0.9, rib_count=8):
    """
    Плита рифлёного стекла.

    Два числа тут решают всё, и оба выправлены после первого прогона:

    · РЁБЕР ДВЕНАДЦАТЬ, а не двадцать. При двадцати плита читалась
      шифером: рёбра становились тоньше собственной фаски и сливались
      в рябь. У рифлёного стекла ребро заметно шире промежутка.
    · РЁБРА НЕ ДОХОДЯТ ДО КРОМКИ (`inset`). Гладкая полоса по краю —
      это и есть то, что превращает лист в ТОЛСТУЮ ПЛИТУ: видно, что у
      стекла есть торец, а рифление живёт на лицевой стороне.
    """
    body = box(name + "_body", (w, d, h), (0, 0, 0), None, bevel=0.26, seg=12)
    inset = 0.20
    r = ribs(name + "_ribs", w - inset * 2, h - inset * 2, d * 0.34, rib_count,
             (0, -d / 2 + 0.04, 0), None)
    o = join([body, r], name)
    o.data.materials.append(MATS["glass"])
    return o


def build_disc(name="disc", r=0.95, d=0.42, glyph="plus"):
    """Матовый кобальтовый диск с белым знаком."""
    base = cyl(name + "_b", r, d, (0, 0, 0), (math.radians(90), 0, 0),
               MATS["cobalt"], verts=96, bevel=0.14, seg=8)
    parts = [base]
    if glyph == "plus":
        # Крест набран двумя брусками: так он получает фаску по всем
        # рёбрам и ловит свет, чего плоская накладка не делает. Он
        # выступает ПЕРЕД лицевой стороной, иначе тонет в теле диска.
        for size in ((r * 0.58, 0.14, r * 0.17), (r * 0.17, 0.14, r * 0.58)):
            parts.append(box("%s_g%d" % (name, len(parts)), size,
                             (0, -d / 2 - 0.05, 0), MATS["white"], bevel=0.045, seg=5))
    o = join(parts, name)
    return o


def build_ring(name="ring", r=0.86, d=0.40):
    """Тёмно-синее кольцо с вырезанным силуэтом учётной записи."""
    base = cyl(name + "_b", r, d, (0, 0, 0), (math.radians(90), 0, 0),
               MATS["navy"], verts=96, bevel=0.12, seg=7)
    # Утопленное поле внутри — рамка по краю остаётся.
    well = cyl(name + "_w", r * 0.76, d * 0.55, (0, -d * 0.36, 0),
               (math.radians(90), 0, 0), None, verts=96, bevel=0)
    base = boolean(base, well)
    # Силуэт прорезается насквозь.
    cutter = person_cutter(name + "_p", size=r * 0.86, loc=(0, 0, 0))
    cutter.scale = (1.0, 4.0, 1.0)
    base = boolean(base, cutter)
    base.name = name
    bpy.ops.object.select_all(action="DESELECT")
    base.select_set(True)
    bpy.context.view_layer.objects.active = base
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return base


def build_torus(name="torus", r=0.78, minor=0.20):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=minor,
                                     major_segments=96, minor_segments=32,
                                     rotation=(math.radians(90), 0, 0))
    o = bpy.context.object
    o.name = name
    bpy.ops.object.shade_smooth()
    o.data.materials.append(MATS["glass_clear"])
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return o


def build_capsule(name="capsule", length=2.2, r=0.44, rib_count=13):
    """
    Рифлёная капсула, лежащая на боку.

    Рёбра идут КОЛЬЦАМИ ПОПЕРЁК оси, а не вдоль: на первом прогоне они
    шли вдоль и капсула вышла похожей на нить бус. Поперёк — это тот же
    рисунок, что на плите, только завёрнутый вокруг цилиндра.
    """
    body = cyl(name + "_b", r, length, (0, 0, 0), (0, math.radians(90), 0),
               None, verts=96, bevel=0.12, seg=7)
    parts = [body]
    step = (length - 0.5) / rib_count
    for i in range(rib_count):
        x = -(length - 0.5) / 2 + step * (i + 0.5)
        bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=r * 0.13,
                                         major_segments=64, minor_segments=16,
                                         location=(x, 0, 0),
                                         rotation=(0, math.radians(90), 0))
        t = bpy.context.object
        bpy.ops.object.shade_smooth()
        parts.append(t)
    o = join(parts, name)
    o.data.materials.append(MATS["glass"])
    return o



def build_specks(name="specks", count=70, w=3.0, h=3.0, d=0.6, seed=7):
    """
    Пузырьки внутри стекла.

    В референсе по толще плиты рассыпаны мелкие искорки — без них
    стекло выглядит вычищенным до стерильности, как заводской пластик.
    Делаются шариками с показателем преломления, близким к воздуху:
    тогда каждый ловит свет точкой и слегка ломает то, что за ним.

    Объёмное рассеяние здесь было бы дороже и мутнее: оно затуманивает
    всю толщу, а нужны отдельные точки.
    """
    import random
    random.seed(seed)
    parts = []
    for i in range(count):
        x = random.uniform(-w / 2, w / 2)
        y = random.uniform(-d / 2, d / 2)
        z = random.uniform(-h / 2, h / 2)
        r = random.uniform(0.010, 0.032)
        bpy.ops.mesh.primitive_ico_sphere_add(radius=r, subdivisions=2, location=(x, y, z))
        o = bpy.context.object
        bpy.ops.object.shade_smooth()
        parts.append(o)
    o = join(parts, name)
    o.data.materials.append(MATS["speck"])
    return o


# ─── Студия ──────────────────────────────────────────────────────────

def setup_stage(res=1400, transparent=False):
    """
    Свет и камера.

    СТЕКЛУ НУЖНО ОКРУЖЕНИЕ, А НЕ ЛАМПЫ. Прозрачный объект виден тем,
    что он преломляет и отражает; в пустоте он выглядит грязным пятном.
    Поэтому главный источник здесь — не площадная лампа, а сам мир с
    градиентом, плюс две большие светящиеся плоскости, которые стекло
    ловит длинными бликами по рёбрам.
    """
    scn = bpy.context.scene
    try:
        scn.render.engine = "CYCLES"
    except TypeError as err:
        print("движок:", err)

    if scn.render.engine == "CYCLES":
        scn.cycles.samples = 900
        scn.cycles.adaptive_threshold = 0.004
        scn.cycles.use_denoising = True
        scn.cycles.denoiser = "OPENIMAGEDENOISE"
        scn.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
        scn.cycles.denoising_prefilter = "ACCURATE"
        # Стеклу нужны проходы насквозь: при малом числе плита чернеет
        # там, где луч прошёл через несколько стенок подряд.
        scn.cycles.max_bounces = 24
        scn.cycles.transmission_bounces = 24
        scn.cycles.transparent_max_bounces = 24
        scn.cycles.glossy_bounces = 8
        scn.cycles.diffuse_bounces = 4
        scn.cycles.caustics_reflective = False
        scn.cycles.caustics_refractive = True
        scn.cycles.blur_glossy = 1.0
        scn.cycles.sample_clamp_indirect = 10.0

    scn.render.resolution_x = res
    scn.render.resolution_y = res
    scn.render.resolution_percentage = 100
    scn.render.film_transparent = transparent
    scn.render.image_settings.file_format = "PNG"
    scn.render.image_settings.color_mode = "RGBA"
    for name in ("Khronos PBR Neutral", "Standard"):
        try:
            scn.view_settings.view_transform = name
            break
        except TypeError:
            continue
    scn.view_settings.look = "None"
    scn.view_settings.exposure = 0.0

    # Мир — светло-серый с мягким градиентом сверху вниз.
    w = scn.world or bpy.data.worlds.new("World")
    scn.world = w
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_WORLD":
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_WORLD")
    bg = nt.nodes.new("ShaderNodeBackground")
    grad = nt.nodes.new("ShaderNodeTexGradient")
    grad.gradient_type = "LINEAR"
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[0].color = (0.62, 0.66, 0.72, 1)
    ramp.color_ramp.elements[1].position = 0.85
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1)
    tex = nt.nodes.new("ShaderNodeTexCoord")
    mapn = nt.nodes.new("ShaderNodeMapping")
    mapn.inputs["Rotation"].default_value = (0, math.radians(-90), 0)
    nt.links.new(tex.outputs["Generated"], mapn.inputs["Vector"])
    nt.links.new(mapn.outputs["Vector"], grad.inputs["Vector"])
    nt.links.new(grad.outputs["Color"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 1.0

    if transparent:
        # МИР ВИДЕН СТЕКЛУ, НО НЕ КАМЕРЕ.
        #
        # Стекло без окружения — грязное пятно: ему нечего преломлять и
        # нечего отражать. Значит фон нужен. Но кадр на сайте лежит на
        # своём фоне страницы, и запечённый серый прямоугольник
        # приходилось растворять маской — а маска съедала края предмета,
        # что видно на первой вёрстке экрана входа.
        #
        # Выход: луч, пришедший ПРЯМО ИЗ КАМЕРЫ, видит прозрачность, а
        # любой отражённый или преломлённый — обычный градиент. Объект
        # получает полноценное окружение, а вокруг него честная альфа.
        lp = nt.nodes.new("ShaderNodeLightPath")
        tr = nt.nodes.new("ShaderNodeBackground")
        tr.inputs["Strength"].default_value = 0.0
        mix = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
        nt.links.new(bg.outputs["Background"], mix.inputs[1])
        nt.links.new(tr.outputs["Background"], mix.inputs[2])
        nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    else:
        nt.links.new(bg.outputs["Background"], out.inputs["Surface"])

    # Отражатели: длинные светящиеся плоскости. Именно они дают рёбрам
    # тот вытянутый блик, по которому рифление и читается.
    def panel(name, loc, rot, size, energy):
        bpy.ops.object.light_add(type="AREA", location=loc)
        L = bpy.context.object
        L.name = name
        L.data.shape = "RECTANGLE"
        L.data.size = size[0]
        L.data.size_y = size[1]
        L.data.energy = energy
        L.rotation_euler = rot
        return L

    panel("KeyPanel", (-4.2, -5.0, 4.2),
          (math.radians(58), 0, math.radians(-38)), (10.0, 2.2), 900)
    panel("FillPanel", (5.0, -4.2, -1.2),
          (math.radians(104), 0, math.radians(48)), (9.0, 2.6), 320)
    panel("RimPanel", (0.6, 5.2, 2.4),
          (math.radians(-64), 0, math.radians(6)), (7.0, 3.0), 420)

    # Задник: без него стекло смотрит в пустоту и внутри у него нечему
    # отражаться. Плоскость стоит далеко и в кадр не попадает.
    back = box("Backdrop", (40, 0.2, 26), (0, 9.0, 0), None, bevel=0)
    bm = bpy.data.materials.new("g_backdrop")
    bm.use_nodes = True
    _put(_bsdf(bm), "Base Color", PAPER)
    _put(_bsdf(bm), "Roughness", 0.55)
    back.data.materials.append(bm)
    if transparent:
        # Задник тоже прячется от камеры, но остаётся для стекла: без
        # него в плите нечему отражаться, и рёбра теряют длинный блик,
        # по которому рифление и читается.
        back.visible_camera = False

    # Камера. 85 мм при 12 м давала кадр шириной 2,54 единицы в обе
    # стороны — кольцо на −2,78 просто не помещалось. Теперь кадр
    # покрывает ±3,2, и композиция дышит.
    bpy.ops.object.camera_add(location=(0, -15.0, 0), rotation=(math.radians(90), 0, 0))
    cam = bpy.context.object
    cam.name = "GlassCam"
    cam.data.lens = 85
    scn.camera = cam
    return cam


def build_scene():
    """
    Расстановка. Порядок по глубине важнее координат: диск и кольцо
    стоят ПЕРЕД плитой, тор и капсула — частью за ней. Тогда сквозь
    рифление видно, как их силуэты ломаются полосами, — ради этого весь
    приём и затеян.
    """
    plate = build_plate("plate")
    plate.rotation_euler = (0, math.radians(-3), math.radians(-2))

    # Знак Atlas стоит ЗА плитой, а не внутри неё.
    #
    # Внутри он пропадал дважды: стеклянным — потому что два одинаковых
    # показателя преломления границы между собой не дают, матовым —
    # потому что десять рёбер размазывают его в кашу. А вот ЗА стеклом
    # он работает на приём: рифление ломает его силуэт полосами, и
    # видно, что плита действительно прозрачная и действительно
    # толстая. Ровно так в референсе ведёт себя предмет за плитой.
    mark = atlas_mark("mark", size=2.1, depth=0.24, loc=(-0.05, 1.05, 0.0),
                      mat=MATS["cobalt"])

    specks = build_specks("specks", count=70, w=3.0, h=3.0, d=0.6)

    # Диск смотрит в камеру почти прямо: развёрнутый сильнее, он
    # показывает торец, и знак на лицевой стороне не читается.
    disc = build_disc("disc", r=0.95, d=0.44)
    disc.location = (1.62, -1.15, 1.42)
    disc.rotation_euler = (math.radians(-6), math.radians(8), math.radians(4))

    ring = build_ring("ring", r=0.88, d=0.42)
    ring.location = (-2.05, -0.70, -0.25)
    ring.rotation_euler = (math.radians(2), math.radians(-12), math.radians(-4))

    # Тор наполовину за плитой: сквозь рифление видно, как его силуэт
    # ломается полосами. Ради этого приём и затеян.
    torus = build_torus("torus", r=0.66, minor=0.18)
    torus.location = (0.70, -0.10, -0.20)

    cap = build_capsule("capsule", length=2.2, r=0.44)
    cap.location = (0.75, -0.95, -2.05)
    cap.rotation_euler = (0, 0, math.radians(-7))

    return [plate, mark, specks, disc, ring, torus, cap]


def render(path, res=1400, samples=None, transparent=False):
    scn = bpy.context.scene
    if samples:
        scn.cycles.samples = samples
    scn.render.film_transparent = transparent
    os.makedirs(os.path.dirname(path), exist_ok=True)
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("кадр:", path)


# ─── Запуск из командной строки ──────────────────────────────────────
# Стекло считается долго, и держать на нём живое соединение с Blender
# нельзя — оно отваливается. Поэтому сцена умеет собираться и в
# отдельном процессе:
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b -P \
#       design/blender/glass_build.py -- --out /tmp/glass --res 900 --samples 200

def _cli():
    import sys
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    def arg(name, default):
        return argv[argv.index(name) + 1] if name in argv else default

    out = arg("--out", "/tmp/glass")
    res = int(arg("--res", "900"))
    samples = int(arg("--samples", "200"))
    scene = arg("--scene", "auth")
    transparent = "--alpha" in argv

    clear()
    build_materials()
    cam = setup_stage(res, transparent=transparent)
    build_scene()

    scn = bpy.context.scene
    if scene == "home":
        # Первый блок главной: кадр шире и объект уходит вправо, чтобы
        # слева осталось место под заголовок и кнопку.
        scn.render.resolution_x = res
        scn.render.resolution_y = int(res * 0.78)
        cam.data.lens = 78
        cam.location = (0.55, -15.5, 0.1)
    render(os.path.join(out, scene), res=res, samples=samples, transparent=transparent)


if __name__ == "__main__":
    _cli()
