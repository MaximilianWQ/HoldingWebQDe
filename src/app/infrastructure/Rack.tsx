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
  name: string;
  note: string;
  /** Сколько «дисков» рисовать в юните. */
  bays: number;
  tone?: "accent" | "lime";
}

const UNITS: Unit[] = [
  { id: "edge", name: "Пограничный узел", note: "Принимает соединение и держит туннель до устройства", bays: 8, tone: "accent" },
  { id: "balance", name: "Балансировка", note: "Раскидывает подключения между машинами площадки", bays: 6 },
  { id: "panel", name: "Панель управления", note: "Ключи, сроки, устройства — состояние каждой подписки", bays: 4, tone: "lime" },
  { id: "db", name: "База и журнал", note: "Источник правды по срокам и оплатам, события пишутся один раз", bays: 6 },
  { id: "watch", name: "Наблюдаемость", note: "Метрики, логи, алерты — дежурный видит инцидент раньше вас", bays: 5 },
  { id: "backup", name: "Резерв", note: "Запасные каналы и копии: площадка выпадает — доступ остаётся", bays: 7 },
];

export default function Rack() {
  const [active, setActive] = useState<string>(UNITS[0].id);
  const unit = UNITS.find((u) => u.id === active) ?? UNITS[0];

  return (
    <div className="ti-rack">
      <div className="ti-rack-body" role="list">
        {UNITS.map((u, i) => (
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
