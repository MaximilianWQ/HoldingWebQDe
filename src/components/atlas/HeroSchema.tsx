import type { CSSProperties } from "react";
import { DEVICE_LIMIT, PLANS, formatRub } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { plural } from "@/lib/ru-words";
import HeroSchemaMotion from "./HeroSchemaMotion";

/**
 * Первый экран главной — иллюстрация «Схема» справа (владелец,
 * 14.09.2026: «пуш в главную», вариант лаборатории 7). Язык Yandex Tech
 * нашими средствами:
 *   · в центре — знак Atlas (четыре стрелки из BrandMark / icon.tsx)
 *     огромной сплошной чёрной фигурой;
 *   · модули — скруглённые плиты с четырьмя отверстиями, фаска и
 *     внутренняя тень: кобальт «19 СТРАН», персик «ОТ 199 ₽», белый
 *     «14 УСТРОЙСТВ», контурный «VPS · VDS» (на телефоне убран); числа
 *     только из src/lib;
 *   · пластина шлифованного металла с четырьмя винтами и гравировкой
 *     «ATLAS SECURE» — объёмный акцент;
 *   · тонкие провода с клеммами, бледные лавандовые контуры сзади,
 *     одна лаймовая точка.
 * Три слоя глубины (контуры, знак, передний план) — за рукой и по
 * прокрутке сдвигаются на разную величину (HeroSchemaMotion, стили —
 * src/app/home-hero.css, префикс a-hs-).
 *
 * Координаты — рамка 1000 × 800 (соотношение сцены 1,25): SVG-слои в
 * этой системе, HTML-модули и пластина — в процентах той же рамки.
 * Иллюстрация целиком декоративная (aria-hidden): те же факты — в
 * тексте и карточках экрана.
 */

const COUNTRY_WORD = plural(COUNTRY_COUNT, ["страна", "страны", "стран"]);
const DEVICE_WORD = plural(DEVICE_LIMIT, ["устройство", "устройства", "устройств"]);
const PRICE = formatRub(PLANS.basic[1]);

/** Знак Atlas — пути из src/components/pixel/BrandMark.tsx (= src/app/icon.tsx), рамка 200 × 200. */
const MARK = [
  "M20 15 L60 15 L60 30 L42 30 L75 63 L63 75 L30 42 L30 60 L15 60 L15 20 Z",
  "M180 15 L140 15 L140 30 L158 30 L125 63 L137 75 L170 42 L170 60 L185 60 L185 20 Z",
  "M20 185 L60 185 L60 170 L42 170 L75 137 L63 125 L30 158 L30 140 L15 140 L15 180 Z",
  "M180 185 L140 185 L140 170 L158 170 L125 137 L137 125 L170 158 L170 140 L185 140 L185 180 Z",
];
/* Знак — масштаб 3,45 вокруг (540, 400): рамка знака x 247…833, y 107…693;
   центр пустой (x 453…626, y 272…527). Модули садятся на внутренние
   концы стрелок — наружные «уголки» стрелок остаются видны. */
const MARK_T = "translate(195 55) scale(3.45)";

type Tone = "peach" | "white" | "graphite";
/** Провода: от пластины к модулям и к лаймовой точке на знаке. Белый — только
 *  поверх чёрного (на светлом поле он терялся), над светлым — графитовый. */
const WIRES: { id: string; d: string; tone: Tone; dot: string; dur: number; begin: number; minor?: boolean }[] = [
  { id: "a-hs-w1", d: "M569 165 C 470 165 300 228 202 228", tone: "peach", dot: "#FFFFFF", dur: 4.2, begin: 2.3 },
  { id: "a-hs-w2", d: "M412 418 C 482 418 508 488 578 488", tone: "graphite", dot: "#1432B8", dur: 3.2, begin: 2.7 },
  { id: "a-hs-w3", d: "M692 602 C 760 602 790 618 860 618", tone: "white", dot: "#CBF52A", dur: 2.6, begin: 3.1, minor: true },
  { id: "a-hs-w4", d: "M767 165 C 767 206 740 234 712 234", tone: "peach", dot: "#FFFFFF", dur: 2.8, begin: 2.5 },
];
/** Клеммы на концах проводов (центры отверстий модулей). */
const TERMINALS: { x: number; y: number; tone: Tone; minor?: boolean }[] = [
  { x: 202, y: 228, tone: "peach" },
  { x: 412, y: 418, tone: "graphite" },
  { x: 578, y: 488, tone: "graphite" },
  { x: 692, y: 602, tone: "white", minor: true },
  { x: 860, y: 618, tone: "white", minor: true },
];

type Mod = { key: string; x: number; y: number; top: string; bottom?: string; minor?: boolean; k: number };
const MODS: Mod[] = [
  { key: "white", x: 70, y: 96, top: String(DEVICE_LIMIT), bottom: DEVICE_WORD.toUpperCase(), k: 0 },
  { key: "cobalt", x: 280, y: 400, top: String(COUNTRY_COUNT), bottom: COUNTRY_WORD.toUpperCase(), k: 1 },
  { key: "peach", x: 560, y: 470, top: `ОТ ${PRICE} ₽`, bottom: "В МЕСЯЦ", k: 2 },
  { key: "line", x: 842, y: 600, top: "VPS · VDS", minor: true, k: 3 },
];
const modPos = (m: Mod) => ({ "--x": `${m.x / 10}%`, "--y": `${m.y / 8}%`, "--k": m.k }) as CSSProperties;
const depth = (d: number) => ({ "--depth": d }) as CSSProperties;
const k = (n: number) => ({ "--k": n }) as CSSProperties;

export default function HeroSchema() {
  return (
    <div className="a-hero-stage a-hs-host" aria-hidden>
      <div className="a-hs-frame">
        {/* Слой 1 — бледные технические контуры (самый дальний). */}
        <div className="a-hs-layer a-hs-back" style={depth(4)}>
          <svg viewBox="0 0 1000 800" preserveAspectRatio="none" className="a-hs-outlines" focusable="false">
            <path d="M30 520 H 238 a 22 22 0 0 1 22 22 V 770 H 520" />
            <path d="M30 520 V 770 H 120" />
            <rect x="806" y="196" width="178" height="300" rx="22" />
            <path d="M806 300 H 760 a 16 16 0 0 0 -16 16 V 430" />
            <rect x="872" y="44" width="96" height="96" rx="20" />
            <circle cx="62" cy="556" r="6" />
            <circle cx="82" cy="556" r="6" />
            <circle cx="480" cy="738" r="9" />
            <circle cx="930" cy="468" r="5" />
            <circle cx="930" cy="448" r="5" />
          </svg>
        </div>

        {/* Слой 2 — знак Atlas огромной сплошной фигурой. */}
        <div className="a-hs-layer a-hs-mid" style={depth(9)}>
          <svg viewBox="0 0 1000 800" preserveAspectRatio="none" className="a-hs-mark" focusable="false">
            <g transform={MARK_T}>
              {MARK.map((d) => (
                <path key={d} d={d} />
              ))}
            </g>
          </svg>
        </div>

        {/* Слой 3 — передний план: модули, провода, пластина. */}
        <div className="a-hs-layer a-hs-front" style={depth(16)}>
          {MODS.map((m) => (
            <div key={m.key} className="a-hs-mod" data-tone={m.key} data-minor={m.minor ? "" : undefined} style={modPos(m)}>
              <div className="a-hs-mod-body">
                <i className="a-hs-hole" data-h="tl" />
                <i className="a-hs-hole" data-h="tr" />
                <i className="a-hs-hole" data-h="bl" />
                <i className="a-hs-hole" data-h="br" />
                <span className="a-hs-mod-label">
                  <b data-long={m.top.length > 4 ? "" : undefined}>{m.top}</b>
                  {m.bottom ? <small>{m.bottom}</small> : null}
                </span>
              </div>
            </div>
          ))}

          <svg viewBox="0 0 1000 800" preserveAspectRatio="none" className="a-hs-wires" focusable="false">
            {WIRES.map((w, n) => (
              <path key={w.id} id={w.id} d={w.d} pathLength={1} className="a-hs-wire" data-tone={w.tone} data-minor={w.minor ? "" : undefined} style={k(n)} />
            ))}
            {TERMINALS.map((t, n) => (
              <circle key={`${t.x}-${t.y}`} cx={t.x} cy={t.y} r="7" className="a-hs-term" data-tone={t.tone} data-minor={t.minor ? "" : undefined} style={k(n)} />
            ))}
            {/* Лаймовая точка на знаке: мягко «дышит». */}
            <circle cx="712" cy="234" r="18" className="a-hs-lime-ring" />
            <circle cx="712" cy="234" r="9" className="a-hs-lime" />
            {/* Пакеты данных бегут по проводам (SMIL; вне кадра — пауза). */}
            {WIRES.map((w) => (
              <circle key={`dot-${w.id}`} r="4.5" fill={w.dot} opacity="0" className="a-hs-dot" data-minor={w.minor ? "" : undefined}>
                <animateMotion dur={`${w.dur}s`} begin={`${w.begin}s`} repeatCount="indefinite" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.45 0 0.25 1">
                  <mpath href={`#${w.id}`} />
                </animateMotion>
                <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.14;0.86;1" dur={`${w.dur}s`} begin={`${w.begin}s`} repeatCount="indefinite" />
              </circle>
            ))}
          </svg>

          {/* Пластина шлифованного металла: четыре винта, гравировка. */}
          <div className="a-hs-plate">
            <i className="a-hs-screw" data-h="tl" />
            <i className="a-hs-screw" data-h="tr" />
            <i className="a-hs-screw" data-h="bl" />
            <i className="a-hs-screw" data-h="br" />
            <span className="a-hs-engrave">ATLAS SECURE</span>
          </div>
        </div>
      </div>
      <HeroSchemaMotion />
    </div>
  );
}
