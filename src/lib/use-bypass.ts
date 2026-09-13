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
export function useBypassLive(enabled: boolean, reloadKey = 0): { live: BypassLive | null; status: "idle" | "loading" | "done" | "failed" } {
  const [live, setLive] = useState<BypassLive | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "failed">(enabled ? "loading" : "idle");

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4_500);
    setStatus("loading");
    fetch("/api/user/bypass", { signal: ctrl.signal })
      .then((r) => r.json())
      .then((j) => {
        if (j?.success) {
          setLive(j.data as BypassLive);
          setStatus("done");
        } else setStatus("failed");
      })
      .catch(() => setStatus("failed"))
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      ctrl.abort();
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
