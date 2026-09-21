/**
 * Описание стойки для раздела «Соберите свой дата-центр».
 *
 * Здесь лежит только то, что НЕ ЗАВИСИТ ОТ ЯЗЫКА: ключ модуля, его
 * высота в местах, место в стойке, есть ли у него гнездо под провод и
 * координаты огней. Подписи приходят из словаря по тому же ключу.
 *
 * Числа геометрии взяты из `public/media/rack/manifest.json`, который
 * пишет сама сцена Blender (`design/blender/rack_build.py`). Правило
 * простое: ни одной координаты в CSS и в этом файле не подбирается на
 * глаз — всё считается от `UNIT_PER_FRAME`.
 */

/** Доля ширины кадра, которую занимает одно место стойки. */
export const UNIT_PER_FRAME = 0.06812;

/** Сколько мест в стойке. */
export const RACK_SLOTS = 8;

/** Запас у кадра рамы сверху и снизу, в местах (крышка, цоколь, ножки). */
export const RACK_PAD_UNITS = 0.62;

/** Запас у кадра модуля сверху и снизу, в пикселях кадра шириной 1400. */
export const MODULE_PAD_PX = 26;

/** Ширина кадра, для которой посчитаны `MODULE_PAD_PX` и высоты. */
export const FRAME_W = 1400;

export const RACK_VERSION = "v1";

export interface RackAnchor {
  name: string;
  kind: "led" | "port" | "button";
  /** Доля кадра модуля от левого верхнего угла. */
  x: number;
  y: number;
}

export interface RackUnit {
  /** Совпадает с ключом в словаре. */
  id: string;
  /** Высота в местах стойки. */
  u: number;
  /** Нижнее место, которое он занимает (0 — самое нижнее). */
  slot: number;
  /** Высота кадра в пикселях при ширине 1400. */
  frameH: number;
  /** Модуль уже стоит в стойке — его не ставит игрок. */
  preset?: boolean;
  /** Модулю нужен провод. Видно по гнезду на панели, а не по подписи. */
  port?: RackAnchor;
  /** Огни, которые зажигает разметка: в рендере они погашены. */
  leds: RackAnchor[];
}

/**
 * Порядок здесь — порядок, в котором игрок ставит модули. Он же
 * порядок снизу вверх: тяжёлое вниз, провода наверх.
 *
 * Провод нужен тому, кто разговаривает с миром. У трёх модулей гнездо
 * на панели нарисовано, у полки и замка его нет — это видно, и
 * объяснять правило не приходится.
 */
export const RACK_UNITS: RackUnit[] = [
  {
    id: "power",
    u: 2,
    slot: 0,
    frameH: 243,
    preset: true,
    leds: [
      { name: "led0", kind: "led", x: 0.78932, y: 0.66 },
      { name: "led1", kind: "led", x: 0.8066, y: 0.658 },
      { name: "led2", kind: "led", x: 0.82388, y: 0.656 },
    ],
  },
  {
    id: "countries",
    u: 1,
    slot: 2,
    frameH: 147,
    port: { name: "port", kind: "port", x: 0.37562, y: 0.77746 },
    leds: [
      { name: "disk0", kind: "led", x: 0.57555, y: 0.51157 },
      { name: "disk1", kind: "led", x: 0.65973, y: 0.49068 },
      { name: "disk2", kind: "led", x: 0.74391, y: 0.46978 },
      { name: "led0", kind: "led", x: 0.78932, y: 0.74499 },
      { name: "led1", kind: "led", x: 0.8066, y: 0.74071 },
      { name: "led2", kind: "led", x: 0.82388, y: 0.73642 },
    ],
  },
  {
    id: "channel",
    u: 1,
    slot: 3,
    frameH: 147,
    port: { name: "port", kind: "port", x: 0.31, y: 0.79 },
    leds: [
      { name: "led0", kind: "led", x: 0.78932, y: 0.74499 },
      { name: "led1", kind: "led", x: 0.8066, y: 0.74071 },
      { name: "led2", kind: "led", x: 0.82388, y: 0.73642 },
    ],
  },
  {
    id: "devices",
    u: 1,
    slot: 4,
    frameH: 147,
    leds: [
      { name: "disk0", kind: "led", x: 0.5, y: 0.53 },
      { name: "disk1", kind: "led", x: 0.575, y: 0.512 },
      { name: "disk2", kind: "led", x: 0.65, y: 0.494 },
      { name: "disk3", kind: "led", x: 0.725, y: 0.476 },
      { name: "led0", kind: "led", x: 0.78932, y: 0.74499 },
      { name: "led1", kind: "led", x: 0.8066, y: 0.74071 },
      { name: "led2", kind: "led", x: 0.82388, y: 0.73642 },
    ],
  },
  {
    id: "power2",
    u: 1,
    slot: 5,
    frameH: 147,
    port: { name: "port", kind: "port", x: 0.37562, y: 0.77746 },
    leds: [
      { name: "disk0", kind: "led", x: 0.57555, y: 0.51157 },
      { name: "disk1", kind: "led", x: 0.65973, y: 0.49068 },
      { name: "disk2", kind: "led", x: 0.74391, y: 0.46978 },
      { name: "led0", kind: "led", x: 0.78932, y: 0.74499 },
      { name: "led1", kind: "led", x: 0.8066, y: 0.74071 },
      { name: "led2", kind: "led", x: 0.82388, y: 0.73642 },
    ],
  },
  {
    id: "lock",
    u: 1,
    slot: 6,
    frameH: 147,
    leds: [
      { name: "led0", kind: "led", x: 0.78932, y: 0.74499 },
      { name: "led1", kind: "led", x: 0.8066, y: 0.74071 },
      { name: "led2", kind: "led", x: 0.82388, y: 0.73642 },
    ],
  },
  { id: "patch", u: 1, slot: 7, frameH: 147, preset: true, leds: [] },
];

/** Те, кого ставит игрок, в порядке постановки. */
export const PLAYABLE = RACK_UNITS.filter((u) => !u.preset);

/** Адрес кадра. Версия в имени обязательна: /media кешируется на неделю. */
export function rackSrc(id: string, w: 700 | 1400): string {
  return `/media/rack/${id}.${RACK_VERSION}-${w}.webp`;
}

/**
 * Сдвиг кадра модуля от верха кадра рамы, В ДОЛЯХ ШИРИНЫ КАДРА.
 *
 * Считается той же формулой, по которой модуль стоял в сцене Blender:
 * центр места минус половина собственного кадра. Поэтому в вёрстке нет
 * ни одной поправки руками — проверено склейкой против эталонного
 * рендера (горизонтальный снос 0,000 px).
 */
export function unitTop(u: RackUnit): number {
  const rackH = (RACK_SLOTS + 2 * RACK_PAD_UNITS) * UNIT_PER_FRAME;
  const centre =
    rackH / 2 - (-RACK_SLOTS / 2 + u.slot + u.u / 2) * UNIT_PER_FRAME;
  return centre - (u.frameH / FRAME_W) / 2;
}
