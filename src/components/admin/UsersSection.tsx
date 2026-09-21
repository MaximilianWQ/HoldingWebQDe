"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Icon from "@/components/pixel/Icon";
import AdminUserDetail from "@/app/admin/AdminUserDetail";
import { Spin } from "@/app/admin/AdminConfirm";
import {
  PLAN_LABELS,
  daysLeft,
  formatDate,
  getJson,
  num,
  planTone,
  type UserFilter,
  type UserInfo,
  type UserSort,
  type UsersPage,
  type UsersStats,
} from "@/app/admin/admin-shared";
import { BlockError } from "./Viz";
import BulkGrant from "./BulkGrant";

/**
 * «Пользователи» — поиск и фильтры на сервере:
 *   GET /api/admin/users?q=&filter=&sort=&limit=60[&cursor=]
 *   → { users, stats, counts, total, nextCursor }
 * Поиск (email, ID, IP, имя или номер в панели) уходит через 300 мс после
 * последней буквы; счётчики у фильтров — `counts` для текущего запроса;
 * «Показать ещё» — следующая страница по курсору.
 *
 * Выбранный пользователь может быть не на текущей странице (переход из
 * «Состояния» или журнала) — тогда карточка берёт его отдельным запросом
 * по точному ID (?q=<id>).
 */

const FILTERS: Array<{ key: UserFilter; label: string }> = [
  { key: "all", label: "Все" },
  { key: "active", label: "Активные" },
  { key: "paid", label: "Платные" },
  { key: "trial", label: "Пробные" },
  { key: "expiring", label: "Истекают ≤ 3 дн" },
  { key: "expired", label: "Истёкшие" },
  { key: "sync_error", label: "Ошибка синхронизации" },
  { key: "shared_ip", label: "Общий IP" },
  { key: "no_link", label: "Без ссылки" },
];

const SORTS: Array<{ key: UserSort; label: string }> = [
  { key: "new", label: "Новые сначала" },
  { key: "old", label: "Старые сначала" },
  { key: "soon", label: "Скоро истекают" },
  { key: "long", label: "Дольше всех" },
  { key: "last_payment", label: "По последней оплате" },
  { key: "email", label: "По email" },
];

const PAGE = 60;

interface Props {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  reloadKey: number;
  onChanged: () => void;
  onMeta?: (stats: UsersStats) => void;
}

export default function UsersSection({ selectedId, onSelect, reloadKey, onChanged, onMeta }: Props) {
  const [q, setQ] = useState("");
  const [qd, setQd] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [sort, setSort] = useState<UserSort>("new");
  const [page, setPage] = useState<UsersPage | null>(null);
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<UserInfo | null>(null);
  // Режим выбора. Отметки живут отдельно от списка: человек может
  // отметить кого-то, подгрузить следующую страницу и отметить ещё —
  // страница при этом не перерисовывает галочки заново.
  const [pick, setPick] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const seq = useRef(0);
  const detailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setQd(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const params = useCallback(
    (cursor?: string | null) => {
      const sp = new URLSearchParams({ filter, sort, limit: String(PAGE) });
      if (qd) sp.set("q", qd);
      if (cursor) sp.set("cursor", cursor);
      return sp.toString();
    },
    [filter, sort, qd],
  );

  // Первая страница — при смене запроса, фильтра, сортировки и после действий.
  useEffect(() => {
    const my = ++seq.current;
    setLoading(true);
    getJson<UsersPage>(`/api/admin/users?${params()}`).then((r) => {
      if (my !== seq.current) return;
      setLoading(false);
      if (r.ok) {
        setPage(r.data);
        setUsers(r.data.users);
        setError(null);
        onMeta?.(r.data.stats);
      } else setError(r.error);
    });
    // onMeta — колбэк родителя, пересоздаётся на каждом рендере
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, reloadKey]);

  const loadMore = async () => {
    if (!page?.nextCursor) return;
    const my = seq.current;
    setMore(true);
    const r = await getJson<UsersPage>(`/api/admin/users?${params(page.nextCursor)}`);
    setMore(false);
    if (my !== seq.current) return;
    if (r.ok) {
      setPage(r.data);
      setUsers((list) => [...list, ...r.data.users.filter((u) => !list.some((x) => x.id === u.id))]);
    } else setError(r.error);
  };

  // Карточка: сначала из списка, затем свежая запись по точному ID.
  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    const inList = users.find((u) => u.id === selectedId);
    if (inList) setSelected(inList);
    let alive = true;
    getJson<UsersPage>(`/api/admin/users?q=${encodeURIComponent(selectedId)}&limit=5`).then((r) => {
      if (!alive || !r.ok) return;
      const u = r.data.users.find((x) => x.id === selectedId);
      if (u) setSelected(u);
    });
    return () => {
      alive = false;
    };
    // users — только для мгновенного показа; повторный запрос по ним не нужен
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, reloadKey]);

  // Телефон и планшет: карточка стоит над списком — после выбора подводим к ней.
  useEffect(() => {
    if (!selectedId || !detailRef.current) return;
    if (window.matchMedia("(min-width: 1100px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    detailRef.current.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [selectedId, selected?.id]);

  const now = Date.now();
  const counts = page?.counts;
  const total = page?.total ?? users.length;
  const all = page?.stats.total ?? 0;

  return (
    <div className="adm-users" data-split={selectedId ? "" : undefined}>
      {selectedId && (
        <div className="adm-detail-slot" ref={detailRef}>
          {selected ? (
            <AdminUserDetail key={selected.id} user={selected} onClose={() => onSelect(null)} onChanged={onChanged} />
          ) : (
            <div className="ak-skel adm-rows-skel" aria-label="Загружаем карточку пользователя" />
          )}
        </div>
      )}

      <section className="ak-card adm-list-card adm-still" data-sheet="24" style={{ "--i": 1 } as CSSProperties} aria-labelledby="adm-users-h">
        <div className="ak-card-head">
          <h2 id="adm-users-h" className="ak-eyebrow">Пользователи</h2>
          <div className="adm-users-head">
            <p className="ak-plan a-num" aria-live="polite">
              {loading && <Spin />} Найдено: {num(total)}
              {all ? ` из ${num(all)}` : ""}
            </p>
            <button
              type="button"
              className="adm-chip"
              aria-pressed={pick}
              onClick={() => {
                setPick((v) => !v);
                if (pick) setPicked(new Set());
              }}
            >
              {pick ? "Выйти из выбора" : "Выдать массово"}
            </button>
          </div>
        </div>

        {error && <BlockError title="Список не загрузился" text={error} />}

        <div className="adm-find">
          <label className="adm-search">
            <span className="b-sr">Поиск по email, ID, IP или имени в панели</span>
            <input
              type="search"
              placeholder="Email, ID, IP или имя в панели"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="adm-input"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <label className="adm-sort">
            <span className="b-sr">Порядок</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as UserSort)} className="adm-input adm-select">
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="adm-filters" role="group" aria-label="Фильтр по статусу">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className="adm-chip adm-filter"
              data-tone={f.key === "sync_error" && (counts?.sync_error || 0) > 0 ? "off" : undefined}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {counts && <span className="adm-chip-n a-num">{num(counts[f.key] || 0)}</span>}
            </button>
          ))}
        </div>

        {pick && (
          <BulkGrant
            scope={{
              ids: [...picked],
              filter,
              q: qd,
              total,
              filterLabel: FILTERS.find((f) => f.key === filter)?.label ?? "Все",
            }}
            loadedCount={users.length}
            onSelectAllLoaded={() => setPicked(new Set(users.map((u) => u.id)))}
            onClearIds={() => setPicked(new Set())}
            onClose={() => {
              setPick(false);
              setPicked(new Set());
            }}
            onDone={onChanged}
          />
        )}

        {loading && users.length === 0 ? (
          <div className="ak-skel adm-rows-skel" aria-hidden />
        ) : users.length === 0 ? (
          <p className="adm-empty">{!qd && filter === "all" ? "Пользователей пока нет." : "Никого не нашли. Проверьте запрос или сбросьте фильтр."}</p>
        ) : (
          <div className="adm-rows-box" aria-busy={loading}>
            <div className="adm-rows-head" aria-hidden>
              <span>ID</span>
              <span>Email</span>
              <span>Тариф</span>
              <span>До</span>
              <span>Оплата</span>
              <span>TG</span>
              <span>IP регистрации</span>
            </div>
            <ul className="adm-rows" data-pick={pick ? "" : undefined}>
              {users.map((u) => {
                const planKey = u.isActive ? u.subscriptionPlan : "expired";
                const on = selectedId === u.id;
                const d = daysLeft(u.subscriptionEnd, now);
                const syncErr = u.panelSyncState === "error";
                return (
                  <li key={u.id}>
                    {pick && (
                      <label className="adm-pick">
                        <input
                          type="checkbox"
                          checked={picked.has(u.id)}
                          onChange={(e) => {
                            setPicked((prev) => {
                              const next = new Set(prev);
                              if (e.target.checked) next.add(u.id);
                              else next.delete(u.id);
                              return next;
                            });
                          }}
                        />
                        <span className="b-sr">Отметить {u.email}</span>
                      </label>
                    )}
                    <button type="button" className="adm-row" aria-pressed={on} onClick={() => onSelect(on ? null : u.id)}>
                      <span className="adm-c-id a-num">{u.publicId || "—"}</span>
                      <span className="adm-c-mail">{u.email}</span>
                      <span className="adm-c-plan">
                        <span className="adm-tag" data-tone={planTone(planKey)}>{PLAN_LABELS[planKey] || planKey}</span>
                        {syncErr && (
                          <span className="adm-tag" data-tone="off" title={u.panelSyncError || undefined}>
                            <span aria-hidden>!</span>
                            <span className="b-sr">ошибка синхронизации</span>
                          </span>
                        )}
                      </span>
                      <span className="adm-c-end a-num" data-tone={u.isActive && d <= 3 ? "warn" : undefined}>
                        <i className="adm-k">До </i>
                        {formatDate(u.subscriptionEnd)}
                        {u.isActive && <small>{d} дн</small>}
                      </span>
                      <span className="adm-c-pay a-num">
                        <i className="adm-k">Оплата </i>
                        {u.lastPaymentAt ? formatDate(u.lastPaymentAt) : <span className="adm-dash">—</span>}
                      </span>
                      <span className="adm-c-tg">
                        {u.telegramLinked ? <><Icon name="send" size={14} /><i className="adm-k"> Telegram</i></> : <span className="adm-dash" aria-hidden>—</span>}
                      </span>
                      <span className="adm-c-ip a-num" data-tone={u.accountsOnIp > 2 ? "off" : u.accountsOnIp > 1 ? "warn" : undefined}>
                        {u.registrationIp ? (
                          <>
                            <i className="adm-k">IP </i>
                            <span className="adm-ip">{u.registrationIp}</span>
                            {u.accountsOnIp > 1 && <b> · {u.accountsOnIp} акк.</b>}
                          </>
                        ) : (
                          <span className="adm-dash" aria-hidden>—</span>
                        )}
                      </span>
                      {syncErr && u.panelSyncError && <span className="adm-c-err adm-break">{u.panelSyncError}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
            {page?.nextCursor && (
              <div className="adm-more">
                <button type="button" className="a-btn ak-btn-soft" onClick={loadMore} disabled={more}>
                  {more ? <><Spin />Загружаем…</> : <>Показать ещё <span className="adm-muted a-num">· показано {num(users.length)} из {num(total)}</span></>}
                </button>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
