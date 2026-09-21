"use client";

import { useState } from "react";
import { SERVER_POINTS, LOCATIONS, countryName } from "@/lib/locations";
import { pluralize } from "@/lib/text/plural";
import type { Dict } from "@/i18n";
import type { Locale } from "@/lib/locale";
import { WORLD_ROWS, CELL, MAP_W, MAP_H, project } from "@/lib/world-map";

/**
 * Карта присутствия для тёмного корпуса: материки точками, наши города
 * — оранжевыми узлами, от опорного узла к пяти дальним идут дуги с
 * бегущими пакетами.
 *
 * Данные настоящие: суша берётся из `world-map.ts` (текстовая маска, а
 * не картинка), города и координаты — из `locations.ts`. Ни одного
 * числа здесь не написано руками, поэтому карта не может разойтись со
 * страницей тарифов.
 *
 * Задержки НЕ показываем: в `locations.ts` они помечены как оценки, а
 * не замеры (COMPLIANCE-CHECK.md § 4). Наведение показывает город и
 * страну — то, что мы знаем точно.
 */

/** Опорный узел дуг — первый из списка, он же ближайший в locations.ts. */
const HUB = SERVER_POINTS.find((p) => p.code === "DE") ?? SERVER_POINTS[0];

/** Куда тянуть дуги: пять самых далёких от опорного узла точек. */
const SPOKES = [...SERVER_POINTS]
  .filter((p) => p.city !== HUB.city)
  .sort((a, b) => Math.hypot(b.lat - HUB.lat, b.lon - HUB.lon) - Math.hypot(a.lat - HUB.lat, a.lon - HUB.lon))
  .slice(0, 5);

function arc(from: { lat: number; lon: number }, to: { lat: number; lon: number }): string {
  const a = project(from.lat, from.lon);
  const b = project(to.lat, to.lon);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * 0.22;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

export default function NetMap({
  locale,
  hint,
  cityWord,
}: {
  locale: Locale;
  /** «наведите на узел» — подпись под числом городов. */
  hint: string;
  cityWord: Dict["units"]["city"];
}) {
  const [hover, setHover] = useState<string | null>(null);

  const land: string[] = [];
  WORLD_ROWS.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === "#") land.push(`M${x * CELL + CELL / 2},${y * CELL + CELL / 2}h0.01`);
    }
  });

  const active = hover ? SERVER_POINTS.find((p) => p.city === hover) : null;
  const hit = active ? LOCATIONS.find((l) => l.code === active.code) : null;
  const country = hit ? countryName(hit, locale) : null;

  return (
    <figure className="ti-map">
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} role="img" aria-label={`Узлы Atlas Secure: ${SERVER_POINTS.map((p) => p.city).join(", ")}`}>
        {/* Суша — одна линия с точечными штрихами вместо тысячи кружков:
            так карта остаётся лёгкой даже на слабом устройстве. */}
        <path className="ti-map-land" d={land.join(" ")} />

        <g className="ti-map-arcs" aria-hidden>
          {SPOKES.map((p, i) => (
            <g key={p.city} style={{ ["--i" as string]: i }}>
              <path className="ti-map-arc" d={arc(HUB, p)} />
              <circle className="ti-map-pk" r="2.6">
                <animateMotion dur={`${4.2 + i * 0.7}s`} repeatCount="indefinite" path={arc(HUB, p)} />
              </circle>
            </g>
          ))}
        </g>

        <g className="ti-map-nodes">
          {SERVER_POINTS.map((p, i) => {
            const { x, y } = project(p.lat, p.lon);
            const isHub = p.city === HUB.city;
            return (
              <g
                key={p.city}
                className={`ti-map-node${isHub ? " is-hub" : ""}${hover === p.city ? " is-on" : ""}`}
                style={{ ["--i" as string]: i }}
                onMouseEnter={() => setHover(p.city)}
                onMouseLeave={() => setHover((c) => (c === p.city ? null : c))}
                onFocus={() => setHover(p.city)}
                onBlur={() => setHover((c) => (c === p.city ? null : c))}
                tabIndex={0}
                role="button"
                aria-label={p.city}
              >
                <circle className="ti-map-halo" cx={x} cy={y} r="9" />
                <circle className="ti-map-dot" cx={x} cy={y} r={isHub ? 4 : 3} />
              </g>
            );
          })}
        </g>
      </svg>

      <figcaption className="ti-map-cap" aria-live="polite">
        {active ? (
          <>
            <b>{active.city}</b>
            <span>{country}</span>
          </>
        ) : (
          <>
            <b>{SERVER_POINTS.length} {pluralize(locale, SERVER_POINTS.length, cityWord)}</b>
            <span>{hint}</span>
          </>
        )}
      </figcaption>
    </figure>
  );
}
