# -*- coding: utf-8 -*-
"""
«Соберите свой дата-центр» — стойка и модули для мини-игры на главной.

ОТКУДА ЗАДАЧА. Владелец, 21.09.2026: «интересную сцену со сбором своего
дата-центра, мини-игра… рендеры серверов… в стиле Яндекса, максимально
детализированно, освещение корректно».

НАКЛОН КАМЕРЫ — ПРОВЕРЕН СКЛЕЙКОЙ, А НЕ ПРИНЯТ НА ВЕРУ.
Спецификация деталей (`research/10_RACK_SPEC.md`, вывод 2) требовала
снимать строго фронтально: «даже 5° вниз показывают верхнюю грань
модуля, которую в стойке закрывает модуль сверху». Проверено прямым
опытом: три модуля склеены из отдельных кадров ровно так, как это
сделает браузер, и сравнены с эталоном, где те же три модуля стоят в
раме в самой сцене.

    сдвиги          126.228 / 42.076 / −42.076 px
    округление      ошибка 0.228 / 0.076 / 0.076 px
    расхождение     среднее 7.98 из 255, максимум 141
    хуже 24         6.8 % кадра

Расхождение целиком лежит на крышках модулей и на отсветах внутри
рамы — это разница освещения, а не разъезд геометрии: горизонтального
сноса нет, стык юнитов точный, верхний модуль закрывает крышку нижнего
сам, порядком отрисовки снизу вверх.

Наклон ОСТАВЛЕН, и вот почему. «Эталон» физически честнее, но мы его
не показываем: на странице живёт именно склейка. Чтобы каждое сочетание
модулей было физически честным, пришлось бы рендерить все сочетания —
при пяти местах это 32 кадра вместо шести. Склейка же всегда сама себе
согласована, а фронтальный вид ценой этой согласованности отнимает
предметность: объект превращается в чертёж фасада.
Условие, при котором это работает: отрисовка СНИЗУ ВВЕРХ и ОДНА И ТА ЖЕ
глубина `DEPTH` у всех модулей — при разной глубине поворот по
горизонтали дал бы разную ширину в пикселях, и стойка поехала бы.

ГЛАВНОЕ РЕШЕНИЕ — ОРТОГРАФИЧЕСКАЯ КАМЕРА. Каждый модуль снимается
отдельным кадром, но камера, масштаб и свет у всех общие и не
двигаются. У ортографической проекции сдвиг объекта по вертикали даёт
РОВНО пропорциональный сдвиг картинки, без перспективного схождения.
Поэтому модуль высотой 1U и модуль 2U в вёрстке ложатся друг на друга
встык, а слот стойки — это просто отступ, кратный одному числу
(`PX_PER_U`, замеряется скриптом `rack_calibrate`). При перспективной
камере пришлось бы подгонять каждый модуль руками, и на любом другом
разрешении подгонка бы поехала.

ЕДИНИЦЫ СЦЕНЫ. За 1.0 принят один юнит стойки (1U). Всё остальное
пересчитано из миллиметров стандарта EIA-310:
    1U                = 44,45 мм  → 1.000
    монтажные 19″     = 482,6 мм  → 10.857
    внешняя ширина    = 600 мм    → 13.500
Глубина намеренно сжата (см. DEPTH): настоящие 750 мм в кадре 3/4
превращают модуль в длинный ящик, в котором не видно передней панели —
а для игрока узнаваема именно она.

ЦВЕТОВОЕ ПРЕОБРАЗОВАНИЕ — `Khronos PBR Neutral`.

Первый замер выбрал Standard, и это была ОШИБКА ПОСТАНОВКИ ОПЫТА: я
мерил карточку-ЭМИТТЕР. Эмиттер проходит преобразование напрямую, а
наши панели — освещённые поверхности с френелем и бликом, и ведут себя
иначе. Перемер на карточке брендового пластика, стоящей на месте
лицевой панели и освещённой боевым светом сцены:

    преобразование        цвет       ΔE76   насыщенность C*
    Khronos PBR Neutral   #4081E4     4.56   57.6
    Standard              #558CEA     8.31   54.0
    AgX                   #6790C4    32.09   31.3
    Filmic                #5E92C7    31.96   32.8
    эталон #3A85F0           —          —    61.9

ЧТО ЗАМЕР ПОКАЗАЛ ТВЁРДО: AgX и Filmic срезают у кобальта ПОЛОВИНУ
насыщенности (C* 61.9 → 31–33). Рендер лежит на странице рядом с
кобальтовой кнопкой, и выгоревший кобальт читался бы как ошибка. Эти
два преобразования исключены.

ЧЕГО ЗАМЕР НЕ ПОКАЗАЛ: явного победителя между Standard и Khronos.
На плоской карточке выигрывает Khronos (ΔE 4.56 против 8.31), но на
живой метке модуля — изогнутой, с фаской и лаком — картина
переворачивается: Standard даёт `#4684E8`, Khronos `#2D7AE2` при
эталоне `#3A85F0`, и ближе оказывается Standard. Разница между ними
внутри нескольких единиц ΔE и зависит от того, как освещена конкретная
поверхность.

Взят `Khronos PBR Neutral`: он сделан Khronos именно под точность цвета
PBR и держит бо́льшую насыщенность на ровной поверхности, а метку на
модуле можно поправить самим цветом материала. Но выбор этот —
НЕ БОЛЬШЕ ЧЕМ ПРЕДПОЧТЕНИЕ между двумя приемлемыми, и если владелец
скажет, что кобальт на рендере не совпал с кнопкой, правильный первый
ход — вернуть Standard, а не крутить материал.

КАК ЗАПУСКАТЬ. Blender 5.2, Scripting → Run. Скрипт собирает сцену с
нуля; повторный запуск безопасен.
"""

import bpy
import math
import os

REPO = "/Users/maximiliannovikov/Desktop/Novikov-claude-create-claude-documentation-9WUuP"
OUT = os.path.join(REPO, "public", "media", "rack")

# ─── Единицы ─────────────────────────────────────────────────────────
MM = 1.0 / 44.45          # миллиметр в единицах сцены (1U = 44,45 мм)
U = 1.0
RACK_W = 482.6 * MM       # монтажные 19″ — ширина лицевой панели модуля
FRAME_W = 600.0 * MM      # внешняя ширина стойки
DEPTH = 4.2               # сжатая глубина: см. комментарий в шапке
RACK_U = 12               # высота стойки в юнитах

# ─── Палитра ─────────────────────────────────────────────────────────
# Хексы сайта переведены в линейное пространство: Blender ждёт линейные
# значения, и вбитый напрямую sRGB дал бы заметно светлее нужного.

def s2l(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(hexstr, alpha=1.0):
    h = hexstr.lstrip("#")
    return (s2l(int(h[0:2], 16)), s2l(int(h[2:4], 16)), s2l(int(h[4:6], 16)), alpha)


INK      = rgb("#17171B")   # корпус стойки, графит
BONE     = rgb("#F4F2ED")   # лицевые панели модулей, тёплая кость
BONE_DIM = rgb("#CFCCC4")   # салазки и решётка — на тон глубже
SHELL    = rgb("#46433C")   # корпус за панелью — тёмный, чтобы лицо было лицом
SLOT     = rgb("#232019")   # прорези решётки: это ОТВЕРСТИЯ, а не накладки
COBALT   = rgb("#3A85F0")   # индикаторы и ручки — цвет действия на сайте
LIME     = rgb("#CBF52A")   # ровно одна точка «работает»
STEEL    = rgb("#9AA0A8")   # винты, направляющие
CORAL    = rgb("#C7502A")   # тёплая метка на одном модуле, чтобы не было моно


def clear():
    """
    Полная очистка: сцена собирается с нуля при каждом запуске.

    Список привязок обнуляется здесь же: иначе при повторном прогоне в
    манифест попали бы объекты уже удалённой сцены, и вёрстка получила
    бы координаты от прошлой версии модуля.
    """
    ANCHORS.clear()
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.lights,
                bpy.data.cameras, bpy.data.curves, bpy.data.collections):
        for it in list(blk):
            if it.users == 0:
                blk.remove(it)


# ─── Материалы ───────────────────────────────────────────────────────

def _bsdf(mat):
    """Узел ищется ПО ТИПУ: на нерусском Blender имя другое, и поиск
    по имени вернул бы None."""
    return next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED")


def _put(b, key, value):
    if key in b.inputs:
        b.inputs[key].default_value = value


def _grain(mat, scale, detail, strength, distance):
    """
    Едва заметное зерно. Без него матовая панель выглядит пластиком из
    набора иконок: свет ложится ровным пятном, и поверхности нечем себя
    показать.

    Два замера, которые меняют привычные значения:

    · `Detail` зерно ОСЛАБЛЯЕТ, а не усиливает: Detail 0 даёт амплитуду
      1.28/255, Detail 8 — 0.84. Высокий Detail — это потраченное время
      счёта и более гладкий результат. Поэтому 2.0, а не 12–15.
    · Значение имеет ПРОИЗВЕДЕНИЕ Strength × Distance, а не Strength
      само по себе.

    И главное ограничение, о котором в туториалах не пишут: у WebP свой
    пол сглаживания около 0.22/255. Всё, что слабее ~0.5/255, из файла
    исчезает бесследно. Зерно доживает до браузера только при амплитуде
    от 0.25 % габарита И качестве сжатия не ниже 85.
    """
    nt = mat.node_tree
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = scale
    tex.inputs["Detail"].default_value = detail
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = strength
    bump.inputs["Distance"].default_value = distance
    nt.links.new(tex.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], _bsdf(mat).inputs["Normal"])


# Зерно на весь корпус — одно. Разные зёрна на соседних панелях в
# кадре читаются как разные материалы, а у нас материал один.
#
#   Scale     = ширина объекта в пикселях / длина волны зерна.
#               Зерно читается при длине волны 2–5 px в ГОТОВОМ кадре;
#               панель шириной 10 ед. занимает ≈1000 px при кадре 1300,
#               то есть 100 px на единицу → Scale ≈ 100/3 × 10 ≈ 330 на
#               единицу сцены. Берём 300: ближе к 3,3 px волны.
#   Detail    = 2.0. Больше — ГЛАДЧЕ (замер), а не наоборот.
#   Strength × Distance = 0.0035 × габарит (10.0) = 0.035. Слабее —
#               зерно не переживёт сжатие WebP.
GRAIN_BODY = (300.0, 2.0, 0.35, 0.10)


def mat_matte(name, color, rough=0.46, sheen=0.0, grain=None, coat=0.0):
    """
    Корпусный материал.

    `coat` — тонкий лак поверх. Он и отличает «предмет» от «серой
    заливки»: у Практикума на объектах Roughness 0,15–0,25 с лёгким
    лаком, и именно лак кладёт тот длинный мягкий блик, по которому
    форма читается без единой тени (`research/08_YANDEX_3D.md`, раздел
    2.3). Матовая поверхность без лака на прозрачном фоне выглядит
    вырезанной из бумаги.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = _bsdf(m)
    _put(b, "Base Color", color)
    _put(b, "Roughness", rough)
    _put(b, "Metallic", 0.0)
    # IOR керамики 1.50. Раньше стояло 1.47 вместе с заниженным
    # «Specular IOR Level» — два параметра делали одну работу и уводили
    # материал от керамики. Блик гасится размером источника, а не
    # занижением отражения.
    _put(b, "IOR", 1.50)
    _put(b, "Specular IOR Level", 0.5)
    if sheen:
        _put(b, "Sheen Weight", sheen)
    if coat:
        _put(b, "Coat Weight", coat)
        _put(b, "Coat Roughness", 0.10)
    if grain:
        _grain(m, *grain)
    return m


def mat_metal(name, color, rough=0.34):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = _bsdf(m)
    _put(b, "Base Color", color)
    _put(b, "Metallic", 1.0)
    _put(b, "Roughness", rough)
    _grain(m, *GRAIN_BODY)
    return m


def mat_glow(name, color, strength=2.4):
    """Индикатор. Светится слабо — это лампочка на панели, а не фонарь:
    сильное свечение засвечивает соседнюю панель и ломает матовость."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = _bsdf(m)
    _put(b, "Base Color", color)
    _put(b, "Roughness", 0.22)
    _put(b, "Emission Color", color)
    _put(b, "Emission Strength", strength)
    return m


MATS = {}


def build_materials():
    MATS.clear()
    MATS["ink"] = mat_matte("rack_ink", INK, rough=0.52, sheen=0.18, grain=GRAIN_BODY)
    MATS["bone"] = mat_matte("rack_bone", BONE, rough=0.24, coat=0.32, grain=GRAIN_BODY)
    MATS["bone_dim"] = mat_matte("rack_bone_dim", BONE_DIM, rough=0.30, coat=0.22, grain=GRAIN_BODY)
    MATS["shell"] = mat_matte("rack_shell", SHELL, rough=0.54, sheen=0.12, grain=GRAIN_BODY)
    # Решётка матовая почти до конца: отверстие не бликует.
    MATS["slot"] = mat_matte("rack_slot", SLOT, rough=0.72, grain=None)
    MATS["cobalt"] = mat_matte("rack_cobalt", COBALT, rough=0.20, coat=0.35)
    MATS["coral"] = mat_matte("rack_coral", CORAL, rough=0.42)
    MATS["steel"] = mat_metal("rack_steel", STEEL)
    MATS["lime"] = mat_glow("rack_lime", LIME, 3.0)
    # Погашенный индикатор: тёмное стекло. Именно он идёт в рендер —
    # огонёк зажигает разметка (см. раздел про привязки).
    MATS["off"] = mat_matte("rack_off", rgb("#2B2E33"), rough=0.28, grain=None)
    MATS["port"] = mat_matte("rack_port", rgb("#1C1E22"), rough=0.60, grain=None)
    MATS["cobalt_glow"] = mat_glow("rack_cobalt_glow", COBALT, 2.0)
    return MATS


# ─── Примитивы с фаской ──────────────────────────────────────────────
# Фаска обязательна на каждой детали: острое ребро не ловит свет, и
# объект читается как плоская заливка. Ширина фаски задана в долях
# юнита, а не в процентах от объекта, — иначе у длинной панели фаска
# уезжала бы в разы шире, чем у короткой.

def box(name, size, loc=(0, 0, 0), mat=None, bevel=0.012, segments=4):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = segments
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(40)
        b.harden_normals = True
    bpy.ops.object.shade_smooth()
    if mat:
        o.data.materials.append(mat)
    return o


def cyl(name, radius, depth, loc=(0, 0, 0), rot=(0, 0, 0), mat=None, verts=32, bevel=0.004):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=verts,
                                        location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    if bevel:
        b = o.modifiers.new("Bevel", "BEVEL")
        b.width = bevel
        b.segments = 3
        b.limit_method = "ANGLE"
        b.angle_limit = math.radians(40)
    bpy.ops.object.shade_smooth()
    if mat:
        o.data.materials.append(mat)
    return o


# ─── Студия ──────────────────────────────────────────────────────────
# Свет один на все модули и не двигается между кадрами: иначе одинаковые
# детали в наборе получили бы разные блики и рядом на странице читались
# бы как сделанные в разное время.

# Выбрано развёрткой 78/84/88°: при 78° крышка отъедает треть кадра,
# при 88° пропадает объём. 84° оставляет объём и отдаёт главное место
# лицевой панели — по ней игрок и узнаёт модуль.
CAM_ROT = (math.radians(84.0), 0.0, math.radians(-14.0))
# Масштаб кадра. Ровно 13.0, и это НЕ произвольное число: при нём
# монтажные 19″ (10.857) занимают 81% ширины кадра — остаётся запас на
# уши, фаски и тень, и ничего не обрезается. Замер шага юнита сделан
# при этом значении; меняя его, надо перезапустить `calibrate()` и
# поправить CSS, иначе модули поедут относительно мест стойки.
ORTHO_SCALE = 13.0
# Мощность ключа. 110 Вт — рабочая точка МАЛЕНЬКОЙ калибровочной сцены
# (шар Ø 1 м, лампа в 4 м). Здесь объект в двадцать раз крупнее и лампы
# втрое дальше, поэтому число пришлось перемерить заново — лестницей с
# замером пикселя лицевой панели (материал `bone`, #F4F2ED):
#
#     множитель   панель     крышка
#     ×1.0        #C4C3C1    серо, материал не узнаётся
#     ×1.45       #D9D8D5    всё ещё темнее материала
#     ×1.85       ≈#EAE8E4   рабочая точка
#     ×2.0        #F0EEEB    материал в тон, запаса нет
#     ×2.5        #FFFFFD    пересвет, фаски выгорели
#
# Взят ×1.85: панель попадает в свой тон, а запас до пересвета остаётся
# бликам на фасках. Пропорции ламп от ключа — ниже, их менять нельзя
# отдельно от этого числа.
KEY_ENERGY = 204.0


def aim_camera(cam, rot, dist=40.0):
    """
    Камера отводится назад ВДОЛЬ СВОЕГО ВЗГЛЯДА — так поворот меняется
    одной строкой, без пересчёта координат руками.

    Направление берётся из самих углов, а НЕ из `cam.matrix_world`:
    матрица объекта пересчитывается только вместе с зависимостями, и
    чтение её сразу после присваивания `rotation_euler` возвращает
    ПРЕЖНИЙ поворот. На развёртке по углам это дало пустые кадры —
    камера уезжала мимо сцены, а сцена была на месте.
    """
    from mathutils import Euler, Vector
    cam.rotation_euler = rot
    fwd = Euler(tuple(rot), "XYZ").to_quaternion() @ Vector((0, 0, -1))
    cam.location = -fwd * dist


def setup_stage(res_x=1400, res_y=520):
    scn = bpy.context.scene
    try:
        scn.render.engine = "CYCLES"
    except TypeError as err:            # движок — динамический enum
        print("движок не переключился:", err)

    if scn.render.engine == "CYCLES":
        # Качество регулируется ПОРОГОМ ШУМА, а не числом сэмплов:
        # выше 512 сэмплов ошибка не двигается, а порог 0.05 → 0.005
        # меняет её с 0.790 до 0.551. Ниже 0.005 время растёт на треть
        # без видимой разницы.
        scn.cycles.samples = 1024
        scn.cycles.adaptive_threshold = 0.005
        scn.cycles.use_denoising = True
        scn.cycles.denoiser = "OPENIMAGEDENOISE"
        scn.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
        scn.cycles.denoising_prefilter = "ACCURATE"
        try:
            scn.cycles.denoising_quality = "HIGH"
        except (AttributeError, TypeError):
            pass
        scn.cycles.max_bounces = 8
        scn.cycles.diffuse_bounces = 3
        scn.cycles.glossy_bounces = 4
        scn.cycles.transmission_bounces = 8
        scn.cycles.volume_bounces = 0
        scn.cycles.transparent_max_bounces = 8
        scn.cycles.caustics_reflective = False
        scn.cycles.caustics_refractive = False
        scn.cycles.blur_glossy = 1.0
        # Прямой свет не режем, непрямой ограничиваем: иначе редкие
        # яркие отскоки дают «светлячков», которые шумодав размазывает
        # в пятна.
        scn.cycles.sample_clamp_direct = 0.0
        scn.cycles.sample_clamp_indirect = 10.0

    scn.render.resolution_x = res_x
    scn.render.resolution_y = res_y
    scn.render.resolution_percentage = 100      # проверено: 50 молча режет кадр
    scn.render.film_transparent = True
    scn.render.image_settings.file_format = "PNG"
    scn.render.image_settings.color_mode = "RGBA"

    # Перечисление view_transform RNA недосчитывает (отдаёт только
    # 'NONE') — присваиваем в try, с откатом на Standard.
    for name in ("Khronos PBR Neutral", "Standard"):
        try:
            scn.view_settings.view_transform = name
            break
        except TypeError:
            continue
    scn.view_settings.look = "None"
    scn.view_settings.exposure = 0.0

    # Камера. Положение считается от направления взгляда: так поворот
    # можно менять одной строкой, не пересчитывая координаты руками.
    bpy.ops.object.camera_add(location=(0, 0, 0), rotation=CAM_ROT)
    cam = bpy.context.object
    cam.name = "RackCam"
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ORTHO_SCALE
    scn.camera = cam
    aim_camera(cam, CAM_ROT)

    # Ключ — большой площадной сверху-слева-спереди. Он один отвечает
    # за форму: тень от него читается, остальные лампы только открывают
    # теневую сторону и отбивают край.
    def area(name, loc, rot, energy, size, color=(1, 1, 1)):
        bpy.ops.object.light_add(type="AREA", location=loc)
        L = bpy.context.object
        L.name = name
        L.data.energy = energy
        L.data.size = size
        L.data.shape = "SQUARE"
        L.data.color = color
        L.rotation_euler = rot
        return L

    # СВЕТ — ДВЕ ЛАМПЫ, И ЭТО ЗАМЕР, А НЕ ВКУС. Разбор двенадцати
    # страниц Яндекса (`research/08_YANDEX_3D.md`, раздел 5) даёт один и
    # тот же сетап на 360, Практикуме и yandex.ru/company: одна большая
    # мягкая площадка сверху-слева размером в 2–3 габарита объекта и
    # вторая, слабая, снизу-справа. Больше ламп там нет нигде.
    #
    # У меня их было четыре, и каждая добавляла свой блик: панель
    # получала три пересекающихся отсвета и читалась грязной. Убраны
    # контровой и лобовая; их работу делает «небо».
    area("Key", (-11.0, -14.0, 9.0),
         (math.radians(54), math.radians(-8), math.radians(-36)), KEY_ENERGY * 13, 26.0)

    # Отражённый снизу-справа. Он НЕ рисует тени — только открывает
    # теневую сторону и кладёт длинный блик по нижней фаске.
    area("Bounce", (13.0, -12.0, -5.0),
         (math.radians(112), 0, math.radians(46)), KEY_ENERGY * 2.6, 24.0,
         (0.92, 0.94, 1.0))

    # Небо: без него тени проваливаются в чёрный и матовый корпус
    # выглядит вырезанным из бумаги.
    w = scn.world or bpy.data.worlds.new("World")
    scn.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.88, 0.90, 0.94, 1.0)
    # Небо подняли с 0.30 до 0.55: оно теперь работает за две убранные
    # лампы — даёт отражения матовому лаку и не даёт теням провалиться.
    bg.inputs["Strength"].default_value = 0.55
    return cam


# ─── Модуль: сервер 1U ───────────────────────────────────────────────
# Пропорции честные: монтажные 19″ (482,6 мм) — это ширина ПО УШАМ, сам
# корпус уже, 17,5″ (444,5 мм). В единицах сцены это ровно 10.0 — из-за
# этого совпадения вся разметка модулей считается в круглых числах.

BODY_W = 444.5 * MM          # = 10.0
EAR_W = (RACK_W - BODY_W) / 2.0
GAP = 0.08                   # зазор между соседними юнитами


def build_ears(parent_name, u_height, z=0.0):
    """Уши крепления с винтами — та деталь, по которой модуль читается
    как стоечный, а не как «коробка»."""
    parts = []
    for side in (-1, 1):
        x = side * (BODY_W / 2 + EAR_W / 2)
        ear = box("%s_ear%d" % (parent_name, side), (EAR_W, 0.26, u_height - GAP),
                  (x, -DEPTH / 2 + 0.13, z), MATS["bone_dim"], bevel=0.008)
        parts.append(ear)
        # Винты: два на ухо у 1U, по одному на юнит выше.
        n = max(2, int(u_height))
        for i in range(n):
            zz = z + (i - (n - 1) / 2.0) * (u_height / max(1, n)) * 0.9
            s = cyl("%s_screw%d_%d" % (parent_name, side, i), 0.085, 0.10,
                    (x, -DEPTH / 2 + 0.02, zz), (math.radians(90), 0, 0),
                    MATS["steel"], verts=16, bevel=0.012)
            parts.append(s)
    return parts


def vent_slots(name, x0, x1, z, height, count, mat, depth_z=-DEPTH / 2 - 0.11):
    """Решётка забора воздуха: ряд скруглённых прорезей. Рисуется
    накладкой, а не вырезом: булев вырез на такой мелочи даёт рваную
    кромку, а на рендере 1400px разницы не видно."""
    parts = []
    step = (x1 - x0) / count
    w = step * 0.46
    for i in range(count):
        x = x0 + step * (i + 0.5)
        s = box("%s_v%d" % (name, i), (w, 0.05, height), (x, depth_z, z), mat, bevel=0.016, segments=3)
        parts.append(s)
    return parts


def build_server(name, u_height=1, sleds=3, label=None, tone="bone"):
    """
    Сервер. Передняя панель — единственное, по чему игрок узнаёт модуль,
    поэтому её раскладка задана ТАБЛИЦЕЙ ЗОН, а не расставлена на глаз.

    Панель шириной `BODY_W` = 10.0 единиц (это ровно 444,5 мм — корпус
    без ушей). Зоны идут слева направо и НЕ ПЕРЕСЕКАЮТСЯ; проверка
    непересечения стоит прямо здесь, потому что первый заход дал
    надпись поверх салазки и гнездо поверх решётки, и на рендере это
    было видно не сразу.
    """
    h = u_height * U
    hh = h - GAP                      # видимая высота панели
    fz = -DEPTH / 2                   # плоскость лицевой панели
    parts = []

    # ── Таблица зон: (ключ, левый край, правый край) ─────────────────
    ZONES = [
        ("stripe", -5.00, -4.72),     # кобальтовая метка «перёд»
        ("vents",  -4.55, -2.95),     # решётка забора воздуха
        ("port",   -2.75, -2.15),     # гнездо под кабель
        ("label",  -1.95, -0.75),     # рельефная надпись
        ("sleds",  -0.45,  3.35),     # салазки дисков
        ("panel",   3.60,  4.95),     # кнопка пуска и индикаторы
    ]
    Z = {k: (a, b) for k, a, b in ZONES}
    for (k1, _, r1), (k2, l2, _) in zip(ZONES, ZONES[1:]):
        assert r1 <= l2, "зоны %s и %s пересекаются" % (k1, k2)
    assert ZONES[0][1] >= -BODY_W / 2 and ZONES[-1][2] <= BODY_W / 2, "зона вышла за панель"

    mid = lambda k: (Z[k][0] + Z[k][1]) / 2
    wid = lambda k: Z[k][1] - Z[k][0]

    # ── Корпус и лицевая панель ──────────────────────────────────────
    parts.append(box("%s_body" % name, (BODY_W, DEPTH, hh), (0, 0, 0),
                     MATS["shell"], bevel=0.030, segments=5))
    # Панель чуть выступает: тонкий шов по стыку не даёт модулю
    # читаться цельным бруском. Зазор между юнитами в жизни 0,79 мм —
    # на экране это меньше двух пикселей, поэтому шов приходится
    # РИСОВАТЬ фаской, иначе стойка выглядит сплошной плитой.
    face = box("%s_face" % name, (BODY_W - 0.06, 0.14, hh - 0.05),
               (0, fz - 0.05, 0), MATS[tone], bevel=0.026, segments=5)
    parts.append(face)

    parts += build_ears(name, h)

    # ── Метка «перёд» — единственное цветное пятно крупнее точки ─────
    parts.append(box("%s_stripe" % name, (wid("stripe"), 0.10, hh * 0.62),
                     (mid("stripe"), fz - 0.12, 0), MATS["cobalt"],
                     bevel=0.018, segments=3))

    # ── Решётка ──────────────────────────────────────────────────────
    parts += vent_slots(name, Z["vents"][0], Z["vents"][1], 0, hh * 0.52, 9,
                        MATS["slot"])

    # ── Гнездо под кабель: цель, к которой игрок ведёт провод ────────
    pz = -hh * 0.14
    parts.append(box("%s_portwell" % name, (wid("port"), 0.09, hh * 0.34),
                     (mid("port"), fz - 0.10, pz), MATS["port"],
                     bevel=0.020, segments=3))
    parts.append(anchor("%s.port" % name, "port", (mid("port"), fz - 0.22, pz)))

    # ── Рельефная надпись ────────────────────────────────────────────
    if label:
        lb = emboss("%s_label" % name, label, hh * 0.46,
                    (mid("label"), fz - 0.10, 0), MATS[tone])
        parts.append(lb)

    # ── Салазки дисков ───────────────────────────────────────────────
    # В 1U диск 2,5″ нельзя поставить на ребро: внутренней высоты ≈40 мм
    # не хватает. Поэтому салазки ЛЕЖАТ — так они и лежат в настоящих
    # машинах, и по этой раскладке сток чаще всего и врёт.
    sx0, sx1 = Z["sleds"]
    step = (sx1 - sx0) / sleds
    for i in range(sleds):
        x = sx0 + step * (i + 0.5)
        parts.append(box("%s_sled%d" % (name, i), (step * 0.86, 0.10, hh * 0.70),
                         (x, fz - 0.10, 0), MATS["bone_dim"], bevel=0.020, segments=4))
        parts.append(box("%s_sledh%d" % (name, i), (0.10, 0.09, hh * 0.50),
                         (x - step * 0.32, fz - 0.16, 0), MATS["steel"],
                         bevel=0.016, segments=3))
        dz = hh * 0.22
        parts.append(cyl("%s_sledd%d" % (name, i), 0.052, 0.05,
                         (x + step * 0.30, fz - 0.16, dz), (math.radians(90), 0, 0),
                         MATS["off"], verts=16, bevel=0.008))
        parts.append(anchor("%s.disk%d" % (name, i), "led",
                            (x + step * 0.30, fz - 0.20, dz)))

    # ── Кнопка пуска и служебные индикаторы ──────────────────────────
    # В рендере НИ ОДИН огонёк не горит: состояние зажигает разметка.
    bx = Z["panel"][0] + 0.30
    bz = hh * 0.16
    parts.append(cyl("%s_btn" % name, 0.14, 0.08, (bx, fz - 0.13, bz),
                     (math.radians(90), 0, 0), MATS["bone_dim"], verts=24, bevel=0.018))
    parts.append(anchor("%s.power" % name, "button", (bx, fz - 0.22, bz)))
    for i in range(3):
        lx = Z["panel"][0] + 0.18 + i * 0.26
        lz = -hh * 0.26
        parts.append(cyl("%s_led%d" % (name, i), 0.045, 0.05, (lx, fz - 0.13, lz),
                         (math.radians(90), 0, 0), MATS["off"], verts=14, bevel=0.006))
        parts.append(anchor("%s.led%d" % (name, i), "led", (lx, fz - 0.20, lz)))

    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for p in parts:
        p.parent = root
    return root


# ─── Каркас стойки ───────────────────────────────────────────────────
# Стойка рендерится ОТДЕЛЬНЫМ кадром и в вёрстке лежит подложкой: в неё
# игрок и ставит модули. Поэтому у неё открытый перёд — ни двери, ни
# стекла: дверь закрыла бы ровно то, ради чего игра.

POST_W = 30.0 * MM            # ширина стойки монтажного профиля
HOLE = 9.5 * MM               # квадратное монтажное отверстие, EIA-310
HOLE_OFFSETS = (-15.875 * MM, 0.0, 15.875 * MM)   # три на юнит


def build_rack(name="rack", units=8):
    """
    Стойка на `units` юнитов. Высота считается от юнитов, а не задаётся
    числом: поменяв количество мест в игре, кадр не придётся пересобирать
    руками.
    """
    parts = []
    inner_h = units * U
    half = inner_h / 2.0

    # Монтажные профили: два спереди, два сзади. Именно они задают
    # ширину 19″ и по ним модуль «садится».
    for sx in (-1, 1):
        for sy, dy in ((-1, -DEPTH / 2 + POST_W / 2), (1, DEPTH / 2 - POST_W / 2)):
            x = sx * (RACK_W / 2 + POST_W / 2)
            post = box("%s_post%d%d" % (name, sx, sy),
                       (POST_W, POST_W, inner_h + 0.5), (x, dy, 0),
                       MATS["ink"], bevel=0.02, segments=4)
            parts.append(post)

        # Отверстия — только на передних профилях: задних в кадре нет.
        x = sx * (RACK_W / 2 + POST_W / 2)
        for u in range(units):
            z0 = -half + (u + 0.5) * U
            for off in HOLE_OFFSETS:
                h = box("%s_hole%d_%d_%d" % (name, sx, u, int(off * 1000)),
                        (HOLE, 0.06, HOLE),
                        (x, -DEPTH / 2 + POST_W / 2 - POST_W / 2 - 0.03, z0 + off),
                        MATS["slot"], bevel=0.012, segments=2)
                parts.append(h)

    # Боковины и крыша: тонкие панели, чтобы стойка читалась объёмом, а
    # не двумя палками. Перёд намеренно пуст.
    for sx in (-1, 1):
        side = box("%s_side%d" % (name, sx),
                   (0.10, DEPTH - 0.2, inner_h + 0.5),
                   (sx * (FRAME_W / 2 - 0.05), 0, 0), MATS["ink"], bevel=0.02)
        parts.append(side)

    top = box("%s_top" % name, (FRAME_W, DEPTH, 0.34), (0, 0, half + 0.42),
              MATS["ink"], bevel=0.05, segments=5)
    parts.append(top)

    # Цоколь: модуль не должен «висеть», у стойки обязана быть опора.
    base = box("%s_base" % name, (FRAME_W, DEPTH, 0.52), (0, 0, -half - 0.5),
               MATS["ink"], bevel=0.06, segments=5)
    parts.append(base)
    for sx in (-1, 1):
        for sy in (-1, 1):
            foot = cyl("%s_foot%d%d" % (name, sx, sy), 0.13, 0.22,
                       (sx * (FRAME_W / 2 - 0.35), sy * (DEPTH / 2 - 0.35), -half - 0.86),
                       (0, 0, 0), MATS["steel"], verts=20, bevel=0.03)
            parts.append(foot)

    # Задняя стенка — глубокая тень: без неё пустые места читались бы
    # дырами в никуда, и модуль некуда было бы «ставить».
    back = box("%s_back" % name, (RACK_W + POST_W * 2, 0.12, inner_h),
               (0, DEPTH / 2 - POST_W - 0.1, 0), MATS["slot"], bevel=0.02)
    parts.append(back)

    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for p in parts:
        p.parent = root
    return root


def slot_z(units, index):
    """Высота центра места `index` (0 — нижнее) в стойке на `units`."""
    return -units * U / 2.0 + (index + 0.5) * U


# ─── Шаг юнита в пикселях ────────────────────────────────────────────
# ЭТО ЧИСЛО — ДОГОВОР МЕЖДУ BLENDER И CSS. Стойка и модули снимаются
# одной камерой; в вёрстке модуль ставится в место сдвигом, кратным
# одному шагу. Шаг задан ДОЛЕЙ ШИРИНЫ КАДРА, а не пикселями: так он
# верен и для кадра 900, и для 1800, и при любом масштабе на странице.
#
#     U_PER_FRAME = sin(наклон камеры) / ORTHO_SCALE
#
# Замер (кадр 900×900, ortho_scale 13.0, наклон 84°), маркером-точкой:
#     по соседним местам   68.931 px
#     по четырём местам    68.817 px
#     расчёт               68.85  px
#     снос по горизонтали на 4U — 0.000 px
# Совпадение замера с расчётом и нулевой снос и есть доказательство,
# что ортографическая схема работает: при перспективной камере снос был
# бы, и каждый модуль пришлось бы сажать руками.
U_PER_FRAME = math.sin(CAM_ROT[0]) / ORTHO_SCALE      # ≈ 0.07650


def px_per_unit(frame_px):
    """Сколько пикселей в одном юните при кадре шириной `frame_px`."""
    return U_PER_FRAME * frame_px


def calibrate(frame_px=900):
    """Печатает числа для CSS. Запускать после любой правки камеры."""
    print("ширина кадра      : %d px" % frame_px)
    print("шаг юнита         : %.3f px  (%.5f ширины кадра)"
          % (px_per_unit(frame_px), U_PER_FRAME))
    print("высота стойки 8U  : %.3f px" % (px_per_unit(frame_px) * 8))
    return U_PER_FRAME


# ─── Точки привязки и манифест для вёрстки ───────────────────────────
#
# ПОЧЕМУ ЭТО ГЛАВНАЯ ЧАСТЬ ФАЙЛА. Индикаторы и разъёмы на странице
# рисует НЕ рендер, а разметка. Причины три, и каждая обязательная:
#
#   · состояний у индикатора четыре (не подключён / идёт подключение /
#     готов / работает). Рендерить четыре кадра на каждый модуль —
#     четырёхкратный вес набора при бюджете ≈130 КБ на всё;
#   · `prefers-reduced-motion` в корпусе `v-` гасит анимацию через
#     `!important` у всего внутри `.v`. Состояние, живущее в картинке,
#     в этом режиме показать нечем; состояние в разметке — читается
#     всегда, в том числе скринридером;
#   · цветом одним показывать состояние нельзя (дальтонизм). Разметке
#     можно добавить форму и подпись, картинке — нет.
#
# Значит, рендер отдаёт ЖЕЛЕЗО БЕЗ ОГНЕЙ, а куда посадить огонёк — берём
# отсюда: пустышка ставится в сцене там же, где отверстие под индикатор,
# и её положение проецируется камерой в долю кадра. Ни одной координаты
# «на глаз» в CSS не появляется.

ANCHORS = []


def anchor(name, kind, location):
    """Пустышка-привязка: индикатор, разъём или ручка."""
    e = bpy.data.objects.new("anchor_%s" % name, None)
    e.empty_display_size = 0.12
    e.location = location
    bpy.context.collection.objects.link(e)
    ANCHORS.append({"name": name, "kind": kind, "object": e})
    return e


def project(obj, scene=None):
    """
    Точка сцены → доля кадра (0..1 от левого верхнего угла).

    Y переворачивается: Blender считает снизу, CSS — сверху.
    """
    from bpy_extras.object_utils import world_to_camera_view
    scene = scene or bpy.context.scene
    co = world_to_camera_view(scene, scene.camera, obj.matrix_world.translation)
    return round(co.x, 5), round(1.0 - co.y, 5)


def export_manifest(path, extra=None):
    """
    Пишет JSON для вёрстки: шаг юнита долей кадра и все привязки.

    Вёрстка берёт отсюда ВСЁ, что касается попадания элементов друг в
    друга. Пересобрали сцену — перезаписали файл, и CSS ничего не
    правит: он считает от этих долей.
    """
    import json
    scn = bpy.context.scene
    data = {
        "unitPerFrame": round(U_PER_FRAME, 5),
        "orthoScale": ORTHO_SCALE,
        "camera": {"elevation": round(math.degrees(CAM_ROT[0]), 2),
                   "yaw": round(math.degrees(CAM_ROT[2]), 2)},
        "frame": {"w": scn.render.resolution_x, "h": scn.render.resolution_y},
        "anchors": [],
    }
    for a in ANCHORS:
        x, y = project(a["object"])
        data["anchors"].append({"name": a["name"], "kind": a["kind"], "x": x, "y": y})
    if extra:
        data.update(extra)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("манифест:", path, "привязок:", len(data["anchors"]))
    return data


# ─── Рельефная надпись ───────────────────────────────────────────────
# Подпись вдавлена в тело модуля тем же материалом, с фаской и
# собственным бликом. Плоских наклеек на объект не кладём: во всей
# выборке Яндекса их нет ни одной, а надпись рельефом — их фирменный
# приём (`research/08_YANDEX_3D.md`, раздел 2.3, пункт 2).

def emboss(name, text, size, loc, mat, depth=0.055, bevel=0.010):
    """
    Выдавленная надпись. Шрифт НЕ задаётся: на чужой машине нужного
    начертания может не быть, и Blender молча подставит своё — лучше
    сразу работать со встроенным, чем получить другой рисунок букв.
    """
    cu = bpy.data.curves.new(name, type="FONT")
    cu.body = text
    cu.size = size
    cu.align_x = "CENTER"
    cu.align_y = "CENTER"
    cu.extrude = depth
    cu.bevel_depth = bevel
    cu.bevel_resolution = 3
    o = bpy.data.objects.new(name, cu)
    bpy.context.collection.objects.link(o)
    # Буквы лежат в плоскости XY, а нужны на отвесной лицевой панели.
    o.rotation_euler = (math.radians(90), 0, 0)
    o.location = loc
    o.data.materials.append(mat)
    return o
