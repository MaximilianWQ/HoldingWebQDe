"use client";

import { useEffect, useState } from "react";
import { onlineAt } from "@/lib/online-counter";

/**
 * Главная кабинета · плитка «Сеть сейчас» (`.v-tile.v-span-2`). Число
 * «на связи» считает детерминированная функция времени
 * (src/lib/online-counter.ts) — у всех посетителей в одну секунду одно
 * и то же значение; график — те же 12 минут истории с шагом 10 с, что
 * и в прежнем кабинете (просто спарклайн, без осей).
 *
 * Список стран и «ещё N стран» здесь убран как повтор: тот же список
 * уже есть на /devices и на карте главной страницы, а в компактной
 * плитке бенто ему не было места.
 *
 * ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ ВЛАДЕЛЬЦЕМ: число «на связи» — не замер, а
 * расчётная кривая (правило CLAUDE.md о числах).
 */
const TICK_MS = 10_000;
const HISTORY_TICKS = 72;

function initialHistory(): number[] {
  const now = Math.floor(Date.now() / 1000);
  return Array.from({ length: HISTORY_TICKS }, (_, k) => onlineAt(now - (HISTORY_TICKS - 1 - k) * 10));
}

export default function CabinetNetwork() {
  const [online, setOnline] = useState<number>(() => onlineAt());
  const [history, setHistory] = useState<number[]>(() => initialHistory());

  useEffect(() => {
    const id = setInterval(() => {
      const next = onlineAt();
      setOnline(next);
      setHistory((prev) => [...prev.slice(1), next]);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  const lo = Math.min(...history);
  const range = Math.max(1, Math.max(...history) - lo);
  const W = 200;
  const H = 48;
  const line = history
    .map((v, k) => `${k ? "L" : "M"}${((k / (history.length - 1)) * W).toFixed(1)},${(H - 4 - ((v - lo) / range) * (H - 8)).toFixed(1)}`)
    .join(" ");

  return (
    <section className="v-tile v-span-2 v-lift vc-net-tile" aria-labelledby="vc-net-h">
      <span className="v-tile-icon vc-net-live" aria-hidden><i className="v-live" /></span>
      <h3 id="vc-net-h">Сеть сейчас</h3>
      <p className="vc-net-num">{online.toLocaleString("ru-RU")}</p>
      <svg className="vc-net-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden focusable="false">
        <path className="vc-net-spark-area" d={`${line} L${W},${H} L0,${H} Z`} />
        <path className="vc-net-spark-line" d={line} />
      </svg>
      <p className="vc-net-cap">подключены прямо сейчас</p>
    </section>
  );
}
