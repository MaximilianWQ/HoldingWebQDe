"use client";

import { useState } from "react";

/**
 * Стойка — то, что стоит за словом «инфраструктура», нарисованное
 * вектором, а не снятое со стока. Наведение или фокус на юните
 * показывает, что в нём живёт.
 *
 * Почему рисунок, а не фотография дата-центра: фотографий наших
 * площадок у нас нет, а чужие снимки «серверной с синей подсветкой» —
 * ровно тот стоковый приём, который на этом сайте запрещён. Схема
 * честнее: она показывает состав системы, ничего не выдумывая про
 * помещения.
 *
 * Индикаторы мигают с разным шагом — это единственное холостое
 * движение блока; при `prefers-reduced-motion` оно выключено в CSS.
 */
interface Unit {
  id: string;
  /** Сколько «дисков» рисовать в юните. */
  bays: number;
  tone?: "accent" | "lime";
}

/** Имя и пояснение юнита приходят пропсом — компонент клиентский. */
export interface UnitText { name: string; note: string }

const UNITS: Unit[] = [
  { id: "edge", bays: 8, tone: "accent" },
  { id: "balance", bays: 6 },
  { id: "panel", bays: 4, tone: "lime" },
  { id: "db", bays: 6 },
  { id: "watch", bays: 5 },
  { id: "backup", bays: 7 },
];

export default function Rack({ units }: { units: UnitText[] }) {
  const rows = UNITS.map((u, i) => ({ ...u, ...units[i] }));
  const [active, setActive] = useState<string>(rows[0].id);
  const unit = rows.find((u) => u.id === active) ?? rows[0];

  return (
    <div className="ti-rack">
      <div className="ti-rack-body" role="list">
        {rows.map((u, i) => (
          <button
            key={u.id}
            type="button"
            role="listitem"
            className={`ti-unit${active === u.id ? " is-on" : ""}${u.tone ? ` ti-unit-${u.tone}` : ""}`}
            style={{ ["--i" as string]: i }}
            onMouseEnter={() => setActive(u.id)}
            onFocus={() => setActive(u.id)}
            onClick={() => setActive(u.id)}
            aria-pressed={active === u.id}
          >
            <span className="ti-unit-name">{u.name}</span>
            <span className="ti-unit-bays" aria-hidden>
              {Array.from({ length: u.bays }, (_, k) => (
                <i key={k} style={{ ["--k" as string]: k }} />
              ))}
            </span>
            <span className="ti-unit-led" aria-hidden />
          </button>
        ))}
      </div>

      <p className="ti-rack-note" aria-live="polite">
        <b>{unit.name}</b>
        <span>{unit.note}</span>
      </p>
    </div>
  );
}
