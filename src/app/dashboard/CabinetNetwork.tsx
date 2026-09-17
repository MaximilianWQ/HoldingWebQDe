"use client";

import { useEffect, useState } from "react";
import { onlineAt } from "@/lib/online-counter";
import { COUNTRY_COUNT, LOCATIONS, citiesLabel, plural } from "@/lib/locations";

/**
 * Профиль · «Сеть сейчас», компактно (владелец 17.09.2026: кабинет —
 * рабочий экран, минимум украшений). Число «на связи» считает
 * детерминированная функция времени (src/lib/online-counter.ts) — у
 * всех посетителей в одну секунду одно и то же значение.
 *
 * Прежняя мини-диаграмма (часовая история) снята как декоративная:
 * единственное число уже отвечает на вопрос «сеть жива?», спарклайн
 * не добавлял решения. Обновляется раз в 10 с, как раньше.
 *
 * ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ ВЛАДЕЛЬЦЕМ: число «на связи» — не замер, а
 * расчётная кривая (правило CLAUDE.md о числах).
 */
const TICK_MS = 10_000;
const PILL_LIMIT = 6;
const REGIONS = LOCATIONS.slice(0, PILL_LIMIT).map((l) => ({ code: l.code, label: `${l.country} · ${citiesLabel(l)}` }));
const HIDDEN = COUNTRY_COUNT - REGIONS.length;

export default function CabinetNetwork() {
  const [online, setOnline] = useState<number>(() => onlineAt());

  useEffect(() => {
    const id = setInterval(() => setOnline(onlineAt()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section aria-labelledby="vc-net-h">
      <div className="vc-kblock-head">
        <h3 id="vc-net-h">Сеть сейчас</h3>
        <span className="v-badge v-badge-green">Работает</span>
      </div>
      <div className="vc-net-row">
        <p className="vc-value" style={{ marginBottom: 0 }}>
          <span className="vc-net-count">{online.toLocaleString("ru-RU")}</span>
          <small>подключены прямо сейчас</small>
        </p>
      </div>
      <div className="vc-net-codes">
        {REGIONS.map((r) => (
          <span key={r.code} className="vc-code" title={r.label}>
            <i aria-hidden />
            {r.code}
          </span>
        ))}
      </div>
      {HIDDEN > 0 && (
        <p className="vc-fine">
          Всего {COUNTRY_COUNT} {plural(COUNTRY_COUNT, ["страна", "страны", "стран"])}: ещё {HIDDEN} — от Дубая до Токио.
        </p>
      )}
    </section>
  );
}
