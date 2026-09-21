"use client";

import { useEffect, useState } from "react";
import type { BypassLive } from "@/types";

/**
 * Ключ 2 («Обход») вживую — GET /api/user/bypass ПОСЛЕ первой
 * отрисовки: страница не ждёт панель (владелец, 13.09.2026). Сервер
 * отвечает не дольше ~2,5 с; здесь свой предел на случай медленной сети.
 *
 *   status "loading"  — ждём ответ (показываем скелет в блоке ключа 2);
 *   status "done"     — `live` пришёл (state ok | none | unavailable);
 *   status "failed"   — сети нет или не успели: страница остаётся
 *                        рабочей со ссылкой из БД, без чисел.
 */
/**
 * Один запрос на страницу, а не по одному на каждый блок (21.09.2026).
 *
 * На кабинете хук вызывают ДВА разных места: блок ключа и плашка
 * профиля. Каждое открывало свой запрос к `/api/user/bypass`, а тот
 * ходит в панель — то есть один заход человека стоил двух походов. В
 * логе это видно как `Error: aborted ECONNRESET`: второй запрос
 * обрывался своим же таймаутом.
 *
 * Здесь общий кеш на страницу: запрос в полёте переиспользуется, ответ
 * живёт 30 секунд — ровно столько же, сколько кеш на сервере. Больше
 * держать нельзя: остаток трафика меняется, и человек, купивший
 * гигабайты, должен увидеть их сразу.
 *
 * Кеш сбрасывается по `reloadKey` — после покупки или начисления.
 */
type Shared = { at: number; key: number; promise: Promise<BypassLive | null> };
const SHARED_TTL_MS = 30_000;
let shared: Shared | null = null;

function loadBypass(reloadKey: number): Promise<BypassLive | null> {
  const now = Date.now();
  if (shared && shared.key === reloadKey && now - shared.at < SHARED_TTL_MS) return shared.promise;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4_500);
  const promise = fetch("/api/user/bypass", { signal: ctrl.signal })
    .then((r) => r.json())
    .then((j) => (j?.success ? (j.data as BypassLive) : null))
    .catch(() => null)
    .finally(() => clearTimeout(timer));

  shared = { at: now, key: reloadKey, promise };
  // Неудачу не кешируем: следующий блок должен попробовать заново.
  promise.then((v) => {
    if (v === null && shared?.promise === promise) shared = null;
  });
  return promise;
}

export function useBypassLive(enabled: boolean, reloadKey = 0): { live: BypassLive | null; status: "idle" | "loading" | "done" | "failed" } {
  const [live, setLive] = useState<BypassLive | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "failed">(enabled ? "loading" : "idle");

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    let alive = true;
    setStatus("loading");
    loadBypass(reloadKey).then((v) => {
      if (!alive) return;
      if (v) {
        setLive(v);
        setStatus("done");
      } else setStatus("failed");
    });
    return () => {
      alive = false;
    };
  }, [enabled, reloadKey]);

  return { live, status };
}

/** «7,5 ГБ» / «500 МБ» — объём для экрана (двоичные единицы, как в панели). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 3) return `${Math.round(bytes / 1024 ** 2).toLocaleString("ru-RU")} МБ`;
  const v = bytes / 1024 ** 3;
  return `${v.toLocaleString("ru-RU", { maximumFractionDigits: v < 10 ? 1 : 0 })} ГБ`;
}

/** Ссылка подписки для Happ — в формате json (как у основного ключа на проде). */
export function withJsonFormat(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}format=json`;
}
