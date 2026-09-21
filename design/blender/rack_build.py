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
    MATS["sand"] = mat_matte("rack_sand", rgb("#E3DDD0"), rough=0.26, coat=0.30, grain=GRAIN_BODY)
    MATS["dusk"] = mat_matte("rack_dusk", rgb("#BEB9AE"), rough=0.30, coat=0.26, grain=GRAIN_BODY)
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
# Масштаб кадра. Считается от САМОГО ШИРОКОГО объекта сцены — рамы
# (`FRAME_W` = 13.5 единиц = 600 мм), плюс запас на ножки и фаски.
# Первый набор был снят при 13.0 и раму срезало по бокам: кадр оказался
# уже того, что в нём стоит.
# Число входит в `U_PER_FRAME`, то есть напрямую в CSS. Меняя его, надо
# перезапустить `calibrate()` и пересобрать манифест, иначе модули
# поедут относительно мест стойки.
ORTHO_SCALE = 14.6
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


# ═══════════════════════════════════════════════════════════════════
#  НАБОР МОДУЛЕЙ
# ═══════════════════════════════════════════════════════════════════
#
# Модули различаются МАТЕРИАЛОМ И НАБОРОМ ДЕТАЛЕЙ НА ПАНЕЛИ, а не
# силуэтом. Это не экономия, а замер: во всей выборке Яндекса формы
# простейшие, а различает объекты материал
# (`research/08_YANDEX_3D.md`, раздел 5, пункт 6). Одинаковый силуэт
# вдобавок обязателен технически — у всех модулей одна глубина, иначе
# поворот камеры даст им разную ширину в пикселях.

def _face_base(name, u_height, tone, with_ears=True):
    """Корпус, лицевая панель, уши. Общее у всех модулей."""
    h = u_height * U
    hh = h - GAP
    fz = -DEPTH / 2
    parts = [
        box("%s_body" % name, (BODY_W, DEPTH, hh), (0, 0, 0),
            MATS["shell"], bevel=0.030, segments=5),
        box("%s_face" % name, (BODY_W - 0.06, 0.14, hh - 0.05),
            (0, fz - 0.05, 0), MATS[tone], bevel=0.026, segments=5),
    ]
    if with_ears:
        parts += build_ears(name, h)
    return parts, hh, fz


def _stripe(name, hh, fz, mat="cobalt"):
    """Метка «перёд» — единственное цветное пятно крупнее точки."""
    return box("%s_stripe" % name, (0.28, 0.10, hh * 0.62),
               (-4.86, fz - 0.12, 0), MATS[mat], bevel=0.018, segments=3)


def _port(name, hh, fz, x):
    """Гнездо под кабель плюс привязка для вёрстки."""
    return [
        box("%s_portwell" % name, (0.60, 0.09, hh * 0.34),
            (x, fz - 0.10, -hh * 0.14), MATS["port"], bevel=0.020, segments=3),
        anchor("%s.port" % name, "port", (x, fz - 0.22, -hh * 0.14)),
    ]


def _status(name, hh, fz, x0):
    """Кнопка пуска и три служебных огонька. В рендере всё погашено."""
    parts = [
        cyl("%s_btn" % name, 0.14, 0.08, (x0 + 0.30, fz - 0.13, hh * 0.16),
            (math.radians(90), 0, 0), MATS["bone_dim"], verts=24, bevel=0.018),
        anchor("%s.power" % name, "button", (x0 + 0.30, fz - 0.22, hh * 0.16)),
    ]
    for i in range(3):
        lx = x0 + 0.18 + i * 0.26
        parts.append(cyl("%s_led%d" % (name, i), 0.045, 0.05, (lx, fz - 0.13, -hh * 0.26),
                         (math.radians(90), 0, 0), MATS["off"], verts=14, bevel=0.006))
        parts.append(anchor("%s.led%d" % (name, i), "led", (lx, fz - 0.20, -hh * 0.26)))
    return parts


def _sleds(name, hh, fz, x0, x1, count):
    """
    Салазки дисков. В 1U диск 2,5″ нельзя поставить на ребро —
    внутренней высоты ≈40 мм не хватает, поэтому салазки ЛЕЖАТ. Именно
    на этой раскладке чаще всего врут стоковые иллюстрации.
    """
    parts = []
    step = (x1 - x0) / count
    for i in range(count):
        x = x0 + step * (i + 0.5)
        parts.append(box("%s_sled%d" % (name, i), (step * 0.86, 0.10, hh * 0.70),
                         (x, fz - 0.10, 0), MATS["bone_dim"], bevel=0.020, segments=4))
        parts.append(box("%s_sledh%d" % (name, i), (0.10, 0.09, hh * 0.50),
                         (x - step * 0.32, fz - 0.16, 0), MATS["steel"], bevel=0.016, segments=3))
        parts.append(cyl("%s_sledd%d" % (name, i), 0.052, 0.05,
                         (x + step * 0.30, fz - 0.16, hh * 0.22), (math.radians(90), 0, 0),
                         MATS["off"], verts=16, bevel=0.008))
        parts.append(anchor("%s.disk%d" % (name, i), "led",
                            (x + step * 0.30, fz - 0.20, hh * 0.22)))
    return parts


def _jacks(name, hh, fz, x0, x1, count, rows=1):
    """Ряд гнёзд: так выглядит и коммутатор, и панель с гнёздами."""
    parts = []
    step = (x1 - x0) / count
    for r in range(rows):
        z = 0 if rows == 1 else (hh * 0.22 if r == 0 else -hh * 0.22)
        for i in range(count):
            x = x0 + step * (i + 0.5)
            parts.append(box("%s_j%d_%d" % (name, r, i), (step * 0.62, 0.10, hh * 0.34),
                             (x, fz - 0.09, z), MATS["port"], bevel=0.018, segments=3))
    return parts


def build_unit(name, kind, u_height=1, label=None, tone="bone"):
    """
    Один модуль стойки. Вид задаётся `kind`; геометрия общая.

    Раскладка панели — зонами, и зоны НЕ ПЕРЕСЕКАЮТСЯ: проверка стоит
    прямо здесь, потому что первый заход дал надпись поверх салазки и
    гнездо поверх решётки, и на рендере это читалось не сразу.
    """
    parts, hh, fz = _face_base(name, u_height, tone)
    parts.append(_stripe(name, hh, fz))
    used = [(-5.00, -4.72)]

    def take(a, b):
        for (l, r) in used:
            assert b <= l or a >= r, "зона (%.2f..%.2f) в %s пересекается" % (a, b, name)
        used.append((a, b))

    label_at = None

    if kind == "server":
        take(-4.55, -2.95); parts += vent_slots(name, -4.55, -2.95, 0, hh * 0.52, 9, MATS["slot"])
        take(-2.75, -2.15); parts += _port(name, hh, fz, -2.45)
        label_at = -1.35
        take(-1.95, -0.75)
        take(-0.45, 3.35);  parts += _sleds(name, hh, fz, -0.45, 3.35, 3)
        take(3.60, 4.95);   parts += _status(name, hh, fz, 3.60)

    elif kind == "switch":
        # Коммутатор: панель почти целиком из гнёзд, решётка узкая.
        take(-4.55, -3.75); parts += vent_slots(name, -4.55, -3.75, 0, hh * 0.52, 4, MATS["slot"])
        take(-3.55, -2.95); parts += _port(name, hh, fz, -3.25)
        label_at = -2.15
        take(-2.75, -1.55)
        take(-1.35, 3.35);  parts += _jacks(name, hh, fz, -1.35, 3.35, 12)
        take(3.60, 4.95);   parts += _status(name, hh, fz, 3.60)

    elif kind == "shelf":
        # Полка устройств: только салазки, гнезда нет — разговаривать
        # с миром ей не нужно, и это видно, а не читается.
        take(-4.55, -3.35); parts += vent_slots(name, -4.55, -3.35, 0, hh * 0.52, 6, MATS["slot"])
        label_at = -2.55
        take(-3.15, -1.95)
        take(-1.75, 3.35);  parts += _sleds(name, hh, fz, -1.75, 3.35, 5)
        take(3.60, 4.95);   parts += _status(name, hh, fz, 3.60)

    elif kind == "lock":
        # Замок: глухая панель, широкая решётка и утопленная скважина.
        take(-4.55, -2.15); parts += vent_slots(name, -4.55, -2.15, 0, hh * 0.52, 13, MATS["slot"])
        label_at = -1.35
        take(-1.95, -0.75)
        take(1.20, 2.20)
        parts.append(cyl("%s_keyhole" % name, 0.22, 0.10, (1.70, fz - 0.10, 0),
                         (math.radians(90), 0, 0), MATS["port"], verts=28, bevel=0.03))
        parts.append(box("%s_keyslot" % name, (0.12, 0.10, hh * 0.34),
                         (1.70, fz - 0.11, -hh * 0.13), MATS["port"], bevel=0.02))
        take(3.60, 4.95);   parts += _status(name, hh, fz, 3.60)

    elif kind == "power":
        # Питание и охлаждение, 2U: четыре вентилятора и два тумблера.
        take(-4.55, 1.85)
        for i in range(4):
            x = -4.25 + i * 1.55
            parts.append(cyl("%s_fan%d" % (name, i), hh * 0.30, 0.10, (x, fz - 0.09, 0),
                             (math.radians(90), 0, 0), MATS["slot"], verts=40, bevel=0.03))
            parts.append(cyl("%s_hub%d" % (name, i), hh * 0.09, 0.12, (x, fz - 0.14, 0),
                             (math.radians(90), 0, 0), MATS["bone_dim"], verts=24, bevel=0.02))
        take(2.20, 3.35)
        for i in range(2):
            parts.append(box("%s_sw%d" % (name, i), (0.34, 0.10, hh * 0.22),
                             (2.45 + i * 0.55, fz - 0.11, 0), MATS["bone_dim"],
                             bevel=0.02, segments=3))
        take(3.60, 4.95);   parts += _status(name, hh, fz, 3.60)

    elif kind == "patch":
        # Панель с гнёздами: два ряда, ничего больше. Ушей у неё нет —
        # это просто планка.
        take(-4.55, 4.95); parts += _jacks(name, hh, fz, -4.45, 4.85, 12, rows=2)

    else:
        raise ValueError("неизвестный вид модуля: %s" % kind)

    if label and label_at is not None:
        # Место надписи задаёт сам вид модуля: искать «первый свободный
        # промежуток» нельзя — зона надписи занята ею же, и поиск
        # ничего не находил.
        parts.append(emboss("%s_label" % name, label, hh * 0.46,
                            (label_at, fz - 0.10, 0), MATS[tone]))

    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for p in parts:
        p.parent = root
    return root


# Набор игры. Порядок снизу вверх — он же порядок мест в стойке.
# Ключи совпадают с ключами словаря `home.rack.modules`.
# `tone` — тон корпуса. Их три, и они идут ступенями: уже стоящие в
# стойке модули (питание, панель гнёзд) темнее, ставимые игроком —
# светлые. Так собранная часть видна одним взглядом, без подписей.
# Цветной на объекте по-прежнему только один элемент — кобальтовая
# метка «перёд»: медиана по выборке Яндекса ровно два цвета на объект.
UNITS_SPEC = [
    {"id": "power",     "kind": "power",  "u": 2, "label": None, "slot": 0, "preset": True,  "tone": "dusk"},
    {"id": "countries", "kind": "server", "u": 1, "label": "19", "slot": 2, "tone": "bone"},
    {"id": "channel",   "kind": "switch", "u": 1, "label": "75", "slot": 3, "tone": "sand"},
    {"id": "devices",   "kind": "shelf",  "u": 1, "label": "14", "slot": 4, "tone": "bone"},
    {"id": "power2",    "kind": "server", "u": 1, "label": "2x", "slot": 5, "tone": "sand"},
    {"id": "lock",      "kind": "lock",   "u": 1, "label": None, "slot": 6, "tone": "bone"},
    {"id": "patch",     "kind": "patch",  "u": 1, "label": None, "slot": 7, "preset": True,  "tone": "dusk"},
]
RACK_UNITS = 8


def render_set(out_dir=None, width=1400, samples=None):
    """
    Рендерит раму и каждый модуль отдельным кадром одной и той же
    камерой, плюс манифест для вёрстки.

    КАДР У ВСЕХ ОДИН И ТОТ ЖЕ по ширине и по положению камеры — на этом
    держится стыковка в вёрстке. Высота кадра у модуля своя, по его
    юнитам: незачем возить вокруг однорядного модуля пустоту в восемь
    рядов. Обрезка считается арифметикой от `U_PER_FRAME`, а не
    подбирается по прозрачности: подбор дал бы у каждого модуля свой
    край, и стык поехал бы.
    """
    out_dir = out_dir or OUT
    os.makedirs(out_dir, exist_ok=True)
    scn = bpy.context.scene
    if samples:
        scn.cycles.samples = samples

    px_u = px_per_unit(width)
    frame_h = int(round(px_u * RACK_UNITS))

    def shoot(path, h_px, shift_units=0.0):
        """
        Кадр высотой `h_px`. `shift_units` сдвигает камеру по вертикали,
        чтобы объект попал в центр укороченного кадра.
        """
        scn.render.resolution_x = width
        scn.render.resolution_y = h_px
        cam = scn.camera
        # Ортографический масштаб привязан к БОЛЬШЕЙ стороне кадра.
        # Ширина у всех кадров одна, значит и масштаб один — менять его
        # при смене высоты нельзя, иначе модули станут разного размера.
        cam.data.ortho_scale = ORTHO_SCALE * max(1.0, h_px / float(width))
        cam.data.shift_y = 0.0
        base = list(CAM_ROT)
        aim_camera(cam, base)
        if shift_units:
            from mathutils import Euler, Vector
            up = Euler(tuple(base), "XYZ").to_quaternion() @ Vector((0, 1, 0))
            cam.location = cam.location + up * (shift_units * math.sin(CAM_ROT[0]))
        scn.render.filepath = path
        bpy.ops.render.render(write_still=True)

    made = []

    # Рама выше своих восьми мест: сверху крышка, снизу цоколь с
    # ножками. Без запаса их срезало краем кадра. Запас одинаковый
    # сверху и снизу, поэтому центр кадра по-прежнему совпадает с
    # центром стойки — и та же формула места работает и здесь.
    rack_pad = int(round(px_u * RACK_PAD_U))
    rack_h = int(round(px_u * RACK_UNITS)) + 2 * rack_pad
    clear_units()
    build_rack("rack", RACK_UNITS)
    shoot(os.path.join(out_dir, "rack"), rack_h)
    made.append({"id": "rack", "u": RACK_UNITS, "file": "rack.png",
                 "w": width, "h": rack_h, "pad": rack_pad})

    # Модули — каждый в кадре по своей высоте, объект в центре
    for spec in UNITS_SPEC:
        clear_units()
        ANCHORS.clear()
        build_unit(spec["id"], spec["kind"], spec["u"], spec.get("label"),
                   tone=spec.get("tone", "bone"))
        h_px = int(round(px_u * spec["u"])) + 2 * PAD_PX
        shoot(os.path.join(out_dir, spec["id"]), h_px)
        made.append({
            "id": spec["id"], "kind": spec["kind"], "u": spec["u"],
            "slot": spec["slot"], "preset": bool(spec.get("preset")),
            "file": "%s.png" % spec["id"], "w": width, "h": h_px,
            "anchors": [dict(name=a["name"].split(".", 1)[1], kind=a["kind"],
                             x=project(a["object"])[0], y=project(a["object"])[1])
                        for a in ANCHORS],
        })

    export_manifest(os.path.join(out_dir, "manifest.json"),
                    {"units": RACK_UNITS, "pad": PAD_PX,
                     "rackPadUnits": RACK_PAD_U, "modules": made})
    print("готово, кадров:", len(made))
    return made


# Запас по краям кадра модуля. Уши и фаски вылезают за габарит юнита, и
# без запаса их срезало бы краем. Запас одинаковый сверху и снизу —
# значит центр кадра по-прежнему совпадает с центром юнита, и вёрстке
# достаточно вычесть его один раз.
PAD_PX = 26

# Запас у кадра рамы, в юнитах на сторону: крышка, цоколь и ножки.
RACK_PAD_U = 0.62


def clear_units():
    """Убирает модули и раму, оставляя камеру, свет и материалы."""
    keep = {"CAMERA", "LIGHT"}
    for ob in list(bpy.data.objects):
        if ob.type not in keep:
            bpy.data.objects.remove(ob, do_unlink=True)
    ANCHORS.clear()


# ═══════════════════════════════════════════════════════════════════
#  ШТЕКЕР И ГНЕЗДО — детали, которые игрок таскает рукой
# ═══════════════════════════════════════════════════════════════════
#
# ЧЕСТНОЕ ОГРАНИЧЕНИЕ, которое надо понимать. Провод, который тянется
# за рукой, отрендерить нельзя: рендер — жёсткая картинка, а шнур
# обязан гнуться в любую сторону на любое расстояние. Поэтому деталь
# разделена:
#
#   · ШТЕКЕР — рендер. Он и есть то, что берут «в руку»: объект того же
#     материала и под тем же светом, что вся стойка;
#   · ШНУР — кривая в разметке, которая тянется от гнезда к штекеру.
#     Она подкрашена под тот же материал, но она вектор, а не картинка.
#
# Пытаться отрендерить шнур пачкой кадров под все положения — это
# сотни кадров ради того, что вектор делает бесплатно и точнее.

def build_plug(name="plug"):
    """
    Штекер: корпус с защёлкой и коротким хвостом шнура.

    Кадр у него свой, маленький: деталь мелкая, и гонять вокруг неё
    кадр шириной со стойку значило бы возить пустоту.
    """
    parts = []
    # Корпус — скруглённый брусок. Пропорции от настоящего разъёма:
    # шире, чем толще, с заметной фаской спереди.
    body = box("%s_body" % name, (0.62, 0.86, 0.46), (0, 0, 0),
               MATS["dusk"], bevel=0.05, segments=5)
    parts.append(body)

    # Защёлка — язычок сверху. Именно по ней разъём узнаётся.
    parts.append(box("%s_latch" % name, (0.26, 0.44, 0.10),
                     (0, -0.10, 0.27), MATS["dusk"], bevel=0.03, segments=4))

    # Контакты в торце: тонкие полоски, видны при подлёте.
    for i in range(4):
        parts.append(box("%s_pin%d" % (name, i), (0.07, 0.06, 0.20),
                         (-0.21 + i * 0.14, -0.44, -0.06), MATS["steel"],
                         bevel=0.012, segments=2))

    # Хвост шнура: короткий отрезок, чтобы штекер не выглядел обрубком.
    # Дальше шнур продолжает вектор в разметке.
    parts.append(cyl("%s_boot" % name, 0.17, 0.34, (0, 0.52, 0),
                     (math.radians(90), 0, 0), MATS["ink"], verts=24, bevel=0.04))
    parts.append(cyl("%s_cord" % name, 0.10, 0.50, (0, 0.88, 0),
                     (math.radians(90), 0, 0), MATS["ink"], verts=20, bevel=0.02))

    # Кобальтовая метка — тот же язык, что у модулей: цветное пятно одно.
    parts.append(box("%s_mark" % name, (0.30, 0.06, 0.10),
                     (0, -0.44, 0.14), MATS["cobalt"], bevel=0.02, segments=3))

    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for p in parts:
        p.parent = root
    return root


def build_socket(name="socket"):
    """
    Гнездо отдельным кадром — подсветка цели, пока игрок тянет штекер.

    На модуле гнездо уже нарисовано, но когда в руке штекер, цель
    обязана быть видна ярче остального. Рисовать её свечением в
    разметке нельзя: при `prefers-reduced-motion` свечение гасится, а
    цель обязана остаться.
    """
    parts = [
        box("%s_frame" % name, (0.74, 0.20, 0.58), (0, 0, 0),
            MATS["dusk"], bevel=0.05, segments=4),
        box("%s_hole" % name, (0.50, 0.16, 0.36), (0, -0.06, -0.04),
            MATS["port"], bevel=0.03, segments=3),
    ]
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for p in parts:
        p.parent = root
    return root


def build_toggle(name="toggle", on=False):
    """
    Тумблер питания — кликабельная деталь.

    ЗДЕСЬ Я НАРУШАЮ СОБСТВЕННОЕ ПРАВИЛО «состояние живёт в разметке, а
    не в кадре», и вот почему. У тумблера состояний ровно два, а не
    четыре, и разница между ними — это НАКЛОН ОБЪЁМНОГО РЫЧАГА. Плоский
    прямоугольник в разметке поверх рендера читался бы наклейкой:
    рычаг обязан ловить свет с той стороны, в которую опрокинут. Два
    кадра по 8 КБ дешевле, чем испорченная деталь.
    """
    tilt = math.radians(20 if on else -20)
    parts = [
        # Рамка, утопленная в панель.
        box("%s_bezel" % name, (0.68, 0.22, 0.86), (0, 0.06, 0),
            MATS["dusk"], bevel=0.05, segments=4),
        box("%s_well" % name, (0.44, 0.18, 0.62), (0, -0.02, 0),
            MATS["port"], bevel=0.03, segments=3),
    ]
    # Рычаг: опрокидывается вокруг оси X, поэтому наклон читается как
    # «вверх» или «вниз», а не как сдвиг вбок.
    lever = box("%s_lever" % name, (0.34, 0.30, 0.52), (0, -0.14, 0),
                MATS["bone"] if on else MATS["bone_dim"], bevel=0.06, segments=5)
    lever.rotation_euler = (tilt, 0, 0)
    lever.location = (0, -0.14, 0.10 if on else -0.10)
    parts.append(lever)
    if on:
        # Включённый тумблер показывает кобальтовую полоску под рычагом.
        parts.append(box("%s_lit" % name, (0.34, 0.10, 0.12),
                         (0, -0.18, -0.26), MATS["cobalt"], bevel=0.02, segments=3))
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for p in parts:
        p.parent = root
    return root


def render_parts(out_dir=None, samples=900):
    """
    Мелкие детали, которые игрок берёт рукой или щёлкает: штекер и
    тумблер в двух положениях. У них свой масштаб кадра — гонять вокруг
    разъёма кадр шириной со стойку значило бы возить пустоту.
    """
    out_dir = out_dir or OUT
    os.makedirs(out_dir, exist_ok=True)
    scn = bpy.context.scene
    scn.cycles.samples = samples
    made = []

    def shoot(name, scale, build, px=560, rot=None):
        clear_units()
        obj = build()
        if rot:
            obj.rotation_euler = rot
        cam = scn.camera
        cam.data.ortho_scale = scale
        aim_camera(cam, CAM_ROT)
        scn.render.resolution_x = px
        scn.render.resolution_y = px
        scn.render.filepath = os.path.join(out_dir, name)
        bpy.ops.render.render(write_still=True)
        made.append({"id": name, "w": px, "h": px, "file": "%s.png" % name})

    shoot("plug", 3.0, lambda: build_plug("plug"), rot=(0, 0, math.radians(55)))
    shoot("switch-off", 1.7, lambda: build_toggle("t_off", on=False))
    shoot("switch-on", 1.7, lambda: build_toggle("t_on", on=True))
    print("детали:", [m["id"] for m in made])
    return made
