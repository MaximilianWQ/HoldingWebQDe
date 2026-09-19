"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Icon from "@/components/pixel/Icon";
import { Spin } from "@/app/admin/AdminConfirm";
import { formatDateTime, getJson, num } from "@/app/admin/admin-shared";
import { BlockError, Dot } from "./Viz";
import AdminPushButton from "./AdminPushButton";

/**
 * «Обращения» — одна лента на все формы сайта (владелец, 19.09.2026:
 * «специальная вкладка: отклики на вакансию и любые формы обратной
 * связи; любой файл, любую фотографию, которую прикрепляют, мы должны
 * просматривать; почта, ФИО, дата — всё корректно»).
 *
 * ПОЧЕМУ РАЗДЕЛ, А НЕ ДВЕ КАРТОЧКИ В «СЕРВИСЕ». Обращение живёт по
 * своим правилам: его читают, на него отвечают и его закрывают. В
 * «Сервисе» лежат редкие операции над системой, и список писем от
 * людей там терялся между сверкой панели и рассылками. Прежние
 * карточки «Заявки с сайта» и «Отклики на вакансии» отсюда убраны:
 * два списка одного и того же — два места, где можно пропустить.
 *
 * КАРТИНКИ ПОКАЗЫВАЮТСЯ, ОСТАЛЬНОЕ СКАЧИВАЕТСЯ. Растровое изображение
 * видно прямо в карточке (щелчок открывает во всю ширину), документ —
 * строкой со скрепкой, именем и размером. Почему так строго, написано
 * в `src/app/api/admin/inbox/file/route.ts`.
 *
 * ШАПКА ЗАПИСИ — ФИО, почта, дата и время полностью. Дата «12 мин
 * назад» хороша в ленте уведомлений, но в переписке с человеком нужна
 * точная: её называют в ответном письме.
 */
interface Attachment {
  id: string;
  filename: string;
  mime: string;
  size: number;
  image: boolean;
}

interface InboxItem {
  id: string;
  kind: "career" | "contact";
  topic: string;
  name: string;
  email: string;
  contact: string | null;
  message: string | null;
  status: string;
  createdAt: string;
  attachments: Attachment[];
}

type Kind = "all" | "career" | "contact";
type Status = "new" | "done" | "all";

const KINDS: Array<{ key: Kind; label: string }> = [
  { key: "all", label: "Все формы" },
  { key: "career", label: "Отклики" },
  { key: "contact", label: "Заявки" },
];
const STATUSES: Array<{ key: Status; label: string }> = [
  { key: "new", label: "Ждут ответа" },
  { key: "done", label: "Разобраны" },
  { key: "all", label: "Все" },
];

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

function fileUrl(id: string) {
  return `/api/admin/inbox/file?id=${encodeURIComponent(id)}`;
}

export default function InboxSection({ reloadKey = 0 }: { reloadKey?: number }) {
  const [kind, setKind] = useState<Kind>("all");
  const [status, setStatus] = useState<Status>("new");
  const [items, setItems] = useState<InboxItem[]>([]);
  const [counts, setCounts] = useState<{ career: number; contact: number; total: number }>({ career: 0, contact: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState<Attachment | null>(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    const r = await getJson<InboxItem[]>(`/api/admin/inbox?kind=${kind}&status=${status}&limit=200`);
    if (my !== seq.current) return;
    setLoading(false);
    if (r.ok) {
      setItems(r.data);
      const c = r.raw.counts as { career?: number; contact?: number; total?: number } | undefined;
      setCounts({ career: c?.career ?? 0, contact: c?.contact ?? 0, total: c?.total ?? 0 });
      setError(null);
    } else setError(r.error);
  }, [kind, status]);

  useEffect(() => { load(); }, [load, reloadKey]);

  // Просмотр картинки закрывается по Esc — как любое окно поверх.
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoom(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [zoom]);

  const mark = async (it: InboxItem, next: "new" | "done") => {
    setBusy(it.id);
    const r = await getJson(`/api/admin/inbox`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: it.id, kind: it.kind, status: next }),
    });
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    await load();
  };

  return (
    <div className="adm-grid adm-inbox">
      <section className="ak-card adm-s-inbox adm-still" data-sheet="24" style={{ "--i": 1 } as CSSProperties} aria-labelledby="adm-inbox-h">
        <div className="ak-card-head">
          <h2 id="adm-inbox-h" className="ak-eyebrow">Обращения с сайта</h2>
          <span className="ak-plan a-num">
            {loading && <Spin />}{" "}
            {counts.total > 0 ? `${num(counts.total)} ждут ответа` : "все разобраны"}
          </span>
        </div>

        <p className="adm-inbox-lead">
          Отклики на вакансии и заявки с форм «Контакты» и «Для бизнеса» — в одном списке, новые сверху.
          Приложенные файлы открываются здесь же.
        </p>

        <AdminPushButton />

        {error && <BlockError title="Обращения не загрузились" text={error} />}

        <div className="adm-filters" role="group" aria-label="Тип формы">
          {KINDS.map((k) => (
            <button key={k.key} type="button" className="adm-chip adm-filter" aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
              {k.label}
              {k.key === "career" && counts.career > 0 && <span className="adm-inbox-n">{counts.career}</span>}
              {k.key === "contact" && counts.contact > 0 && <span className="adm-inbox-n">{counts.contact}</span>}
            </button>
          ))}
        </div>
        <div className="adm-filters" role="group" aria-label="Статус обращения">
          {STATUSES.map((s) => (
            <button key={s.key} type="button" className="adm-chip adm-filter" aria-pressed={status === s.key} onClick={() => setStatus(s.key)}>
              {s.key === "new" && <Dot tone={counts.total > 0 ? "warn" : "idle"} />}
              {s.label}
            </button>
          ))}
        </div>

        {loading && items.length === 0 ? (
          <div className="ak-skel adm-rows-skel" aria-hidden />
        ) : items.length === 0 ? (
          <p className="adm-empty">
            {status === "new" ? "Новых обращений нет." : status === "done" ? "Разобранных обращений нет." : "Обращений пока нет."}
          </p>
        ) : (
          <ul className="adm-inbox-list" aria-busy={loading}>
            {items.map((it) => (
              <li key={`${it.kind}:${it.id}`} className="adm-inbox-item" data-done={it.status === "done" ? "" : undefined}>
                <div className="adm-inbox-top">
                  <span className="adm-inbox-topic" data-kind={it.kind}>{it.topic}</span>
                  <time className="adm-inbox-date" dateTime={it.createdAt}>{formatDateTime(it.createdAt)}</time>
                </div>

                <p className="adm-inbox-name">{it.name}</p>

                <dl className="adm-inbox-fields">
                  <div>
                    <dt>Почта</dt>
                    <dd><a href={`mailto:${it.email}`}>{it.email}</a></dd>
                  </div>
                  {it.contact && (
                    <div>
                      <dt>Связь</dt>
                      <dd>{it.contact}</dd>
                    </div>
                  )}
                </dl>

                {it.message && <p className="adm-inbox-msg">{it.message}</p>}

                {it.attachments.length > 0 && (
                  <div className="adm-inbox-files">
                    {it.attachments.map((a) =>
                      a.image ? (
                        <button
                          key={a.id}
                          type="button"
                          className="adm-inbox-thumb"
                          onClick={() => setZoom(a)}
                          title={`${a.filename} · ${size(a.size)}`}
                        >
                          {/* Файл прислал посторонний человек: обычный <img>,
                              а не next/image — оптимизатору такое не отдают. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={fileUrl(a.id)} alt={a.filename} loading="lazy" />
                          <span>{a.filename}</span>
                        </button>
                      ) : (
                        <a key={a.id} className="adm-inbox-file" href={fileUrl(a.id)} download>
                          <Icon name="download" size={16} />
                          <span>{a.filename}</span>
                          <b>{size(a.size)}</b>
                        </a>
                      )
                    )}
                  </div>
                )}

                <div className="adm-inbox-actions">
                  <a className="adm-chip" href={`mailto:${it.email}?subject=${encodeURIComponent(it.topic)}`}>
                    Ответить письмом
                  </a>
                  <button
                    type="button"
                    className="adm-chip"
                    disabled={busy === it.id}
                    onClick={() => mark(it, it.status === "done" ? "new" : "done")}
                  >
                    {busy === it.id ? <Spin /> : it.status === "done" ? "Вернуть в работу" : "Разобрано"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {zoom && (
        <div className="adm-lightbox" role="dialog" aria-modal="true" aria-label={zoom.filename} onClick={() => setZoom(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl(zoom.id)} alt={zoom.filename} />
          <p className="adm-lightbox-cap">{zoom.filename} · {size(zoom.size)} — нажмите, чтобы закрыть</p>
        </div>
      )}
    </div>
  );
}
