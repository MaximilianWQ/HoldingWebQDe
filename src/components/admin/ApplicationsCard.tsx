"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Spin } from "@/app/admin/AdminConfirm";
import { formatShort, getJson, num } from "@/app/admin/admin-shared";
import { BlockError, Dot } from "./Viz";

/**
 * Отклики на вакансии — GET /api/admin/careers.
 *
 * Владелец, 19.09.2026: «и также в админ-дашборд пусть приходит».
 * Письмо — сигнал, эта карточка — память: письмо можно потерять в
 * почте, а список никуда не денется.
 *
 * Резюме скачивается по ссылке на `/api/admin/careers/file` — файл
 * отдаётся вложением и только администратору. Показывать его прямо
 * на странице нельзя: содержимое прислал посторонний человек.
 */
interface ApplicationItem {
  id: string;
  vacancyTitle: string;
  name: string;
  email: string;
  contact: string | null;
  message: string | null;
  resumeName: string;
  resumeSize: number;
  status: string;
  createdAt: string;
}

type Filter = "new" | "done" | "all";
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "new", label: "Ждут ответа" },
  { key: "done", label: "Разобраны" },
  { key: "all", label: "Все" },
];

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function ApplicationsCard({ i = 0, reloadKey = 0 }: { i?: number; reloadKey?: number }) {
  const [filter, setFilter] = useState<Filter>("new");
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    const r = await getJson<ApplicationItem[]>(`/api/admin/careers?status=${filter}&limit=100`);
    if (my !== seq.current) return;
    setLoading(false);
    if (r.ok) {
      setItems(r.data);
      const c = r.raw.counts;
      setCounts(c && typeof c === "object" ? (c as Record<string, number>) : {});
      setError(null);
    } else setError(r.error);
  }, [filter]);

  useEffect(() => { load(); }, [load, reloadKey]);

  const mark = async (id: string, status: "new" | "done") => {
    setBusy(id);
    const r = await getJson(`/api/admin/careers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    await load();
  };

  const waiting = counts.new ?? 0;

  return (
    <section className="ak-card adm-s-jobs adm-still" data-sheet="24" style={{ "--i": i } as CSSProperties} aria-labelledby="adm-jobs-h">
      <div className="ak-card-head">
        <h2 id="adm-jobs-h" className="ak-eyebrow">Отклики на вакансии</h2>
        <span className="ak-plan a-num">
          {loading && <Spin />} {waiting > 0 ? `${num(waiting)} ждут ответа` : "все разобраны"}
        </span>
      </div>

      {error && <BlockError title="Отклики не загрузились" text={error} />}

      <div className="adm-filters" role="group" aria-label="Статус откликов">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className="adm-chip adm-filter" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.key === "new" && <Dot tone={waiting > 0 ? "warn" : "idle"} />}
            {f.label}
          </button>
        ))}
      </div>

      {loading && items.length === 0 ? (
        <div className="ak-skel adm-rows-skel" aria-hidden />
      ) : items.length === 0 ? (
        <p className="adm-empty">
          {filter === "new" ? "Новых откликов нет." : filter === "done" ? "Разобранных откликов нет." : "Откликов пока нет."}
        </p>
      ) : (
        <div className="adm-rows-box adm-rows-short" aria-busy={loading}>
          <ul className="adm-rows">
            {items.map((a) => (
              <li key={a.id} className="adm-contact-row">
                <span className="adm-contact-main">
                  <b>{a.name}</b>
                  <span className="adm-job-vac">{a.vacancyTitle}</span>
                  <a href={`mailto:${a.email}`} className="adm-contact-mail">{a.email}</a>
                  {a.contact ? <span className="adm-muted">{a.contact}</span> : null}
                  {a.message ? <span className="adm-contact-msg">{a.message}</span> : null}
                  <a className="adm-chip adm-job-file" href={`/api/admin/careers/file?id=${encodeURIComponent(a.id)}`} download>
                    Скачать резюме · {a.resumeName} · {size(a.resumeSize)}
                  </a>
                </span>
                <span className="adm-contact-side">
                  <span className="adm-muted">{formatShort(a.createdAt)}</span>
                  <button
                    type="button"
                    className="adm-chip"
                    disabled={busy === a.id}
                    onClick={() => mark(a.id, a.status === "done" ? "new" : "done")}
                  >
                    {busy === a.id ? <Spin /> : a.status === "done" ? "Вернуть в работу" : "Разобрано"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
