import type { CSSProperties } from "react";
import { WORLD_ROWS, COLS, ROWS, CELL, project } from "@/lib/world-map";
import { LOCATIONS, SERVER_POINTS, COUNTRY_COUNT, CITY_COUNT, CLOSEST, plural } from "@/lib/locations";
import PresenceSchemaMotion from "./PresenceSchemaMotion";

/**
 * Раздел 03 — карта присутствия (владелец, 14.09.2026: «глобус — говно
 * полное… сделай адекватным, красивым или другое»). Вместо 3D-глобуса —
 * графика в языке первого экрана (HeroSchema): спокойная техническая
 * панель с тонкой лавандовой рамкой, ровная точечная карта мира,
 * наши города кобальтовыми узлами с мягким пульсом, несколько проводов
 * с бегущими пакетами, регионы пилюлями.
 *
 * ТОЧКИ. Суша — сетка 3° × 3° из src/lib/world-map.ts. Точки — узор
 * одного круга, вырезанный маской суши: сетка строго ровная (никаких
 * «колец» у полюсов, как у глобуса), разметка — несколько сотен
 * прямоугольников-пробегов, а не тысяча кругов.
 *
 * ТЕЛЕФОН. Весь мир в ширину телефона — узлы и провода не читались.
 * На узком экране показан увеличенный кадр наших локаций (Европа →
 * Ближний Восток → Центральная Азия → Япония и Сингапур): слой карты
 * (.a-pm-view) растянут и сдвинут так, что кадр CROP заполняет окно
 * карты целиком. Узлы США остаются за краем — на их месте метка
 * «← США» у левой кромки, пилюля «Америка» в списке остаётся.
 * Проекция линейная (равнопромежуточная), поэтому кадр — это просто
 * доли рамки: --c-x0/--c-y0/--c-w/--c-h (home-map.css).
 *
 * ЧИСЛА — только из src/lib/locations.ts: страны, города, регионы
 * (подсчётом). Задержек нет — они не подтверждены замером.
 *
 * Движение и отклик — PresenceSchemaMotion (провода прочерчиваются на
 * входе, пульс и пакеты — пока панель в кадре, ближайший к читателю
 * город по часовому поясу, закрепление региона по нажатию); стили —
 * src/app/home-map.css, префикс a-pm-.
 */

/** Кадр карты в градусах: от Калифорнии до Японии, от Скандинавии до Австралии. */
const LON_MIN = -130;
const LON_MAX = 160;
const LAT_MAX = 72;
const LAT_MIN = -44;
const TL = project(LAT_MAX, LON_MIN);
const BR = project(LAT_MIN, LON_MAX);
const VB = { x: TL.x, y: TL.y, w: BR.x - TL.x, h: BR.y - TL.y };
const VIEWBOX = `${VB.x.toFixed(1)} ${VB.y.toFixed(1)} ${VB.w.toFixed(1)} ${VB.h.toFixed(1)}`;
/** Доли кадра — для HTML-слоя (пульс, подпись) поверх SVG. */
const pct = (lat: number, lon: number) => {
  const p = project(lat, lon);
  return { x: ((p.x - VB.x) / VB.w) * 100, y: ((p.y - VB.y) / VB.h) * 100 };
};

/** Кадр телефона: наши локации без США (Лондон … Токио, Хельсинки … Сингапур). */
const CROP = { lonMin: -13, lonMax: 146, latMax: 66, latMin: -4 };
const C0 = pct(CROP.latMax, CROP.lonMin);
const C1 = pct(CROP.latMin, CROP.lonMax);
const CROP_VARS = {
  x0: C0.x / 100,
  y0: C0.y / 100,
  w: (C1.x - C0.x) / 100,
  h: (C1.y - C0.y) / 100,
};
const CROP_ASPECT = (CROP_VARS.w * VB.w) / (CROP_VARS.h * VB.h);

/** Суша пробегами: подряд идущие ячейки ряда — один прямоугольник. */
function landRuns(): string {
  const parts: string[] = [];
  for (let r = 0; r < ROWS; r++) {
    let start = -1;
    for (let c = 0; c <= COLS; c++) {
      const land = c < COLS && WORLD_ROWS[r][c] === "#";
      if (land && start < 0) start = c;
      if (!land && start >= 0) {
        parts.push(`M${start * CELL} ${r * CELL}h${(c - start) * CELL}v${CELL}h-${(c - start) * CELL}z`);
        start = -1;
      }
    }
  }
  return parts.join("");
}
const LAND = landRuns();

/* Регион — только для группировки на витрине; состав стран и их число —
   из src/lib/locations.ts. Страна без региона попадёт в «Другие». */
type Region = "eu" | "me" | "as" | "am" | "etc";
const REGION_OF: Record<string, Region> = {
  BY: "eu", FI: "eu", PL: "eu", DE: "eu", NL: "eu", RO: "eu", CH: "eu", AT: "eu", GB: "eu", FR: "eu",
  TR: "me", AM: "me", IR: "me", AE: "me",
  KZ: "as", JP: "as", CN: "as", SG: "as",
  US: "am",
};
const REGION_NAME: Record<Region, string> = {
  eu: "Европа",
  me: "Ближний Восток и Кавказ",
  as: "Азия",
  am: "Америка",
  etc: "Другие",
};
const regionOf = (code: string): Region => REGION_OF[code] ?? "etc";
const REGIONS = (Object.keys(REGION_NAME) as Region[])
  .map((r) => ({ r, n: LOCATIONS.filter((l) => regionOf(l.code) === r).length }))
  .filter((x) => x.n > 0);

/** Узлы — все города с серверами (страна может нести несколько городов). */
const NODES = SERVER_POINTS.map((s, i) => {
  const p = project(s.lat, s.lon);
  const q = pct(s.lat, s.lon);
  return { id: `${s.code}-${i}`, code: s.code, city: s.city, r: regionOf(s.code), x: p.x, y: p.y, px: q.x, py: q.y, i };
});
/** Метка «← США» на телефоне — на широте Нью-Йорка (в кадр телефона США не входят). */
const US = NODES.find((n) => n.code === "US");

/* Провода: несколько спокойных дуг от одного узла (Франкфурт — центр
   европейской части сети на карте) к дальним городам; пакеты бегут по
   ним по очереди. Дуга выгнута вверх на четверть длины. */
const HUB = NODES.find((n) => n.city === "Франкфурт") ?? NODES[0];
const ARC_TO = ["Нью-Йорк", "Дубай", "Алматы", "Сингапур", "Токио"];
const ARCS = ARC_TO.map((city, k) => {
  const t = NODES.find((n) => n.city === city);
  if (!t) return null;
  const mx = (HUB.x + t.x) / 2;
  const my = (HUB.y + t.y) / 2;
  const len = Math.hypot(t.x - HUB.x, t.y - HUB.y);
  const cy = my - len * 0.24;
  return { id: `a-pm-arc-${k}`, d: `M${HUB.x.toFixed(1)} ${HUB.y.toFixed(1)} Q${mx.toFixed(1)} ${cy.toFixed(1)} ${t.x.toFixed(1)} ${t.y.toFixed(1)}`, tone: k % 2 ? "graphite" : "peach", x: t.x, y: t.y, k, dur: 3.6 + (k % 3) * 0.6, begin: 1.2 + k * 0.7 };
}).filter((a): a is NonNullable<typeof a> => a !== null);

const NEAR = NODES.find((n) => n.city === CLOSEST.cities[0]) ?? NODES[0];
const COUNTRY_WORD = plural(COUNTRY_COUNT, ["страна", "страны", "стран"]);
const CITY_WORD = plural(CITY_COUNT, ["город", "города", "городов"]);

export default function PresenceSchema() {
  const stageVars = {
    "--nxv": NEAR.px.toFixed(2),
    "--nyv": NEAR.py.toFixed(2),
    "--c-x0": CROP_VARS.x0.toFixed(4),
    "--c-y0": CROP_VARS.y0.toFixed(4),
    "--c-w": CROP_VARS.w.toFixed(4),
    "--c-h": CROP_VARS.h.toFixed(4),
    "--c-aspect": CROP_ASPECT.toFixed(3),
    "--us-y": (US?.py ?? 40).toFixed(2),
  } as CSSProperties;

  return (
    <div className="a-pm-panel" data-region="">
      <div className="a-pm-head" aria-hidden>
        <span>Карта присутствия</span>
        <span>
          {COUNTRY_COUNT} {COUNTRY_WORD.toUpperCase()} · {CITY_COUNT} {CITY_WORD.toUpperCase()}
        </span>
      </div>

      <div className="a-pm-stage" aria-hidden style={stageVars}>
        <div className="a-pm-map">
          {/* Слой карты: на широком экране — во всё окно; на телефоне —
              растянут и сдвинут на кадр наших локаций. */}
          <div className="a-pm-view">
            {/* Суша — ровная точечная сетка (узор + маска), отдельный слой. */}
            <svg className="a-pm-dots" viewBox={VIEWBOX} preserveAspectRatio="xMidYMid meet" focusable="false">
              <defs>
                <pattern id="a-pm-dot" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
                  <circle cx={CELL / 2} cy={CELL / 2} r="1.85" />
                </pattern>
                <mask id="a-pm-land" maskUnits="userSpaceOnUse" x={VB.x} y={VB.y} width={VB.w} height={VB.h}>
                  <path d={LAND} fill="#FFFFFF" />
                </mask>
              </defs>
              <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="url(#a-pm-dot)" mask="url(#a-pm-land)" />
            </svg>

            {/* Провода, узлы и пакеты — свой слой: перерисовки не трогают сушу. */}
            <svg className="a-pm-net" viewBox={VIEWBOX} preserveAspectRatio="xMidYMid meet" focusable="false">
              {ARCS.map((a) => (
                <path key={a.id} id={a.id} d={a.d} pathLength={1} className="a-pm-arc" data-tone={a.tone} style={{ ["--k" as string]: a.k } as CSSProperties} />
              ))}
              {NODES.map((n) => (
                <circle key={n.id} cx={n.x} cy={n.y} r="3.2" className="a-pm-node" data-r={n.r} data-id={n.id} data-near={n.id === NEAR.id ? "" : undefined} />
              ))}
              <circle cx={HUB.x} cy={HUB.y} r="5.2" className="a-pm-hub" />
              {ARCS.map((a) => (
                <circle key={`dot-${a.id}`} r="2.3" className="a-pm-packet" data-tone={a.tone} opacity="0">
                  <animateMotion dur={`${a.dur}s`} begin={`${a.begin}s`} repeatCount="indefinite" calcMode="spline" keyPoints="0;1" keyTimes="0;1" keySplines="0.45 0 0.25 1">
                    <mpath href={`#${a.id}`} />
                  </animateMotion>
                  <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.12;0.88;1" dur={`${a.dur}s`} begin={`${a.begin}s`} repeatCount="indefinite" />
                </circle>
              ))}
            </svg>

            {/* Пульс узлов — HTML поверх (transform и opacity на композиторе). */}
            <div className="a-pm-pulses">
              {NODES.map((n) => (
                <i
                  key={n.id}
                  className="a-pm-pulse"
                  data-r={n.r}
                  data-near={n.id === NEAR.id ? "" : undefined}
                  data-id={n.id}
                  style={{ left: `${n.px.toFixed(2)}%`, top: `${n.py.toFixed(2)}%`, ["--k" as string]: n.i } as CSSProperties}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Телефон: США за левым краем кадра — метка вместо узлов. */}
        {US ? <span className="a-pm-edge">← США</span> : null}

        {/* Ближайший к читателю город: по умолчанию — ближайшая точка сети
            (CLOSEST), в браузере уточняется по часовому поясу. На широком
            экране подпись стоит у верхнего края карты (над ней нет наших
            узлов) и тонкой линией указывает на город; на телефоне — строкой
            под картой, чтобы не закрывать узлы. */}
        <i className="a-pm-lead" />
        <p className="a-pm-near" data-side={NEAR.px > 62 ? "end" : NEAR.px < 18 ? "start" : undefined}>
          <i aria-hidden />
          <span>
            Ближайшая к вам — <b data-near-name>{CLOSEST.country}, {NEAR.city}</b>
          </span>
        </p>
      </div>

      {/* Регионы: наведение или фокус подсвечивает страны региона на карте,
          нажатие закрепляет подсветку. */}
      <ul className="a-pm-regions" aria-label="Регионы присутствия">
        {REGIONS.map((g) => (
          <li key={g.r}>
            <button type="button" className="a-pm-pill" data-pill={g.r} aria-pressed="false">
              <i aria-hidden />
              {REGION_NAME[g.r]} <span>· {g.n}</span>
            </button>
          </li>
        ))}
      </ul>

      <PresenceSchemaMotion nodes={NODES.map(({ id, code, city, px, py, x, y }) => ({ id, code, city, px, py, x, y }))} />
    </div>
  );
}
