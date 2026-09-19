"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Spin } from "@/app/admin/AdminConfirm";
import { formatShort, getJson, num } from "@/app/admin/admin-shared";
import { BlockError, Dot } from "./Viz";

/**
 * Заявки с форм обратной связи — GET /api/admin/contact.
 *
 * Появилась 19.09.2026 (владелец: «письмо как сигнал, админка как
 * память»). До этого заявки писались в таблицу `contact_requests`, и
 * не читал их никто: единственным следом было уведомление в кабинете
 * администратора, которое легко пролистать.
 *
 * Статуса два: «ждут ответа» и «обработаны». Пометка обратима — нажали
 * не туда, вернули обратно.
 */
interface ContactItem {
  id: string;
  name: string;
  email: string;
  interest: string;
  message: string | null;
  status: string;
  createdAt: string;
}

type Filter = "new" | "done" | "all";
const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "new", label: "Ждут ответа" },
  { key: "done", label: "Обработаны" },
  { key: "all", label: "Все" },
];

export default function ContactCard({ i = 0, reloadKey = 0 }: { i?: number; reloadKey?: number }) {
  const [filter, setFilter] = useState<Filter>("new");
  const [items, setItems] = useState<ContactItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    const r = await getJson<ContactItem[]>(`/api/admin/contact?status=${filter}&limit=100`);
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
    const r = await getJson(`/api/admin/contact`, {
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
    <section className="ak-card adm-s-contact adm-still" data-sheet="24" style={{ "--i": i } as CSSProperties} aria-labelledby="adm-contact-h">
      <div className="ak-card-head">
        <h2 id="adm-contact-h" className="ak-eyebrow">Заявки с сайта</h2>
        <span className="ak-plan a-num">
          {loading && <Spin />} {waiting > 0 ? `${num(waiting)} ждут ответа` : "все разобраны"}
        </span>
      </div>

      {error && <BlockError title="Заявки не загрузились" text={error} />}

      <div className="adm-filters" role="group" aria-label="Статус заявок">
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
          {filter === "new" ? "Новых заявок нет." : filter === "done" ? "Обработанных заявок нет." : "Заявок пока нет."}
        </p>
      ) : (
        <div className="adm-rows-box adm-rows-short" aria-busy={loading}>
          <ul className="adm-rows">
            {items.map((c) => (
              <li key={c.id} className="adm-contact-row">
                <span className="adm-contact-main">
                  <b>{c.name}</b>
                  <a href={`mailto:${c.email}`} className="adm-contact-mail">{c.email}</a>
                  <span className="adm-muted">{c.interest}</span>
                  {c.message ? <span className="adm-contact-msg">{c.message}</span> : null}
                </span>
                <span className="adm-contact-side">
                  <span className="adm-muted">{formatShort(c.createdAt)}</span>
                  <button
                    type="button"
                    className="adm-chip"
                    disabled={busy === c.id}
                    onClick={() => mark(c.id, c.status === "done" ? "new" : "done")}
                  >
                    {busy === c.id ? <Spin /> : c.status === "done" ? "Вернуть в работу" : "Обработано"}
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
