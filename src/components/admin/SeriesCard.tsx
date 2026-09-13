"use client";

import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import { Spin } from "@/app/admin/AdminConfirm";
import { dayLong, dayShort, getJson, money, num, type DailySeries, type SeriesPoint } from "@/app/admin/admin-shared";
import { BlockError, Skel, Tile } from "./Viz";

/**
 * «По дням» — GET /api/admin/overview/series?days=30|90 (московские сутки).
 *
 * Три графика на одной шкале дней, SVG без библиотек:
 *   выручка столбиками вверх, возвраты — вниз от оси (та же шкала);
 *   регистрации, пробные и оплатившие после пробного — линиями;
 *   продления вверх, окончания без продления — вниз.
 * Выбранный день общий для всех трёх: наведение, тап или стрелки на
 * клавиатуре (график в фокусе). Для скринридера — сводка и скрытая
 * таблица по дням.
 */

const NOTE_KEYS: Record<string, string> = {
  revenue: "Выручка",
  refunds: "Возвраты",
  conversions: "Оплатили после пробного",
  renewals: "Продления",
  expirations: "Окончания",
  traffic: "Пакеты трафика",
};

function Axis({ pts }: { pts: SeriesPoint[] }) {
  const n = pts.length;
  if (!n) return null;
  return (
    <div className="adm-ch-x a-num" aria-hidden>
      <span>{dayShort(pts[0].day)}</span>
      <span>{dayShort(pts[Math.floor((n - 1) / 2)].day)}</span>
      <span>{dayShort(pts[n - 1].day)}</span>
    </div>
  );
}

/** Прозрачные колонки поверх графика: наведение и тап выбирают день. */
function Hits({ n, onPick }: { n: number; onPick: (k: number) => void }) {
  return (
    <>
      {Array.from({ length: n }, (_, k) => (
        <rect key={k} className="adm-ch-hit" x={k * 10} y={0} width={10} height={100} onPointerEnter={() => onPick(k)} onClick={() => onPick(k)} />
      ))}
    </>
  );
}

export default function SeriesCard({ i, reloadKey }: { i: number; reloadKey: number }) {
  const [days, setDays] = useState<30 | 90>(30);
  const [data, setData] = useState<DailySeries | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<number | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    getJson<DailySeries>(`/api/admin/overview/series?days=${days}`).then((r) => {
      if (!alive) return;
      setLoading(false);
      if (r.ok) {
        setData(r.data);
        setSel(null);
      } else setErr(r.error);
    });
    return () => {
      alive = false;
    };
  }, [days, reloadKey, retry]);

  const pts = data?.points ?? [];
  const n = pts.length;
  const idx = sel === null || sel >= n ? n - 1 : sel;
  const cur = pts[idx];
  const t = data?.totals;
  const W = Math.max(n, 1) * 10;
  const empty = !!t && Object.values(t).every((v) => !v);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!n || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    setSel(e.key === "Home" ? 0 : e.key === "End" ? n - 1 : Math.max(0, Math.min(n - 1, idx + (e.key === "ArrowRight" ? 1 : -1))));
  };

  // Шкалы.
  const maxRev = Math.max(1, ...pts.map((p) => p.revenue));
  const sRev = 76 / maxRev;
  const maxFlow = Math.max(1, ...pts.flatMap((p) => [p.registrations, p.trials, p.conversions]));
  const line = (key: "registrations" | "trials" | "conversions") =>
    pts.map((p, k) => `${k * 10 + 5},${(96 - (p[key] / maxFlow) * 90).toFixed(2)}`).join(" ");
  const maxKeep = Math.max(1, ...pts.flatMap((p) => [p.renewals, p.expirations]));
  const sKeep = 46 / maxKeep;

  return (
    <section className="ak-card adm-series adm-still" data-sheet="24" style={{ "--i": i } as CSSProperties} aria-labelledby="adm-series-h">
      <div className="ak-card-head">
        <h2 id="adm-series-h" className="ak-eyebrow">
          По дням · {days} дней{data && <span className="adm-muted a-num"> · {dayShort(data.from)}–{dayShort(data.to)}, МСК</span>}
        </h2>
        <span className="adm-block-aside">
          {loading && data && <Spin />}
          <span className="adm-seg" role="group" aria-label="Период">
            {([30, 90] as const).map((d) => (
              <button key={d} type="button" className="adm-seg-btn" aria-pressed={days === d} onClick={() => setDays(d)}>
                {d} дней
              </button>
            ))}
          </span>
        </span>
      </div>

      {err ? (
        <>
          <BlockError title="Ряды по дням не посчитались" text={err} />
          <div className="adm-sub-actions">
            <button type="button" className="a-btn ak-btn-soft" onClick={() => setRetry((x) => x + 1)}>Повторить</button>
          </div>
        </>
      ) : !data || !t ? (
        <Skel rows={4} />
      ) : (
        <>
          <ul className="adm-tiles adm-tiles-sm adm-series-tot">
            <Tile label="Выручка" value={money(t.revenue)} tone="ok" />
            <Tile label="Возвраты" value={money(t.refunds)} note={`${num(t.refundsCount)} шт.`} tone={t.refundsCount > 0 ? "off" : undefined} />
            <Tile label="Платежей" value={num(t.payments)} />
            <Tile label="Пакеты трафика" value={money(t.trafficRevenue ?? 0)} note={`${num(t.trafficPayments ?? 0)} шт. · в выручке`} tone="mute" />
            <Tile label="Регистраций" value={num(t.registrations)} />
            <Tile label="Пробных" value={num(t.trials)} />
            <Tile label="Оплатили после пробного" value={num(t.conversions)} tone="ok" />
            <Tile label="Продлений" value={num(t.renewals)} />
            <Tile label="Окончаний" value={num(t.expirations)} tone={t.expirations > t.renewals ? "warn" : undefined} />
          </ul>
          {empty && <p className="adm-note" data-tone="warn">За период событий не было.</p>}

          <p className="adm-ch-read a-num" aria-live="polite">
            {cur && (
              <>
                <b>{dayLong(cur.day)}</b> · выручка {money(cur.revenue)}
                {cur.refunds > 0 && <span data-tone="off"> · возвраты {money(cur.refunds)}</span>} · платежей {num(cur.payments)}
                {(cur.trafficPayments ?? 0) > 0 && <> · из них пакеты трафика {money(cur.trafficRevenue ?? 0)} ({num(cur.trafficPayments ?? 0)})</>}
              </>
            )}
          </p>

          {/* Выручка и возвраты. */}
          <div
            className="adm-ch adm-ch-rev"
            tabIndex={0}
            role="group"
            aria-label={`Выручка по дням: всего ${money(t.revenue)}, возвраты ${money(t.refunds)}. Стрелки влево и вправо выбирают день.`}
            onKeyDown={onKey}
            onPointerLeave={() => setSel(null)}
          >
            <span className="adm-ch-max a-num" aria-hidden>{money(maxRev)}</span>
            <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" aria-hidden>
              {cur && <rect className="adm-ch-sel" x={idx * 10} y={0} width={10} height={100} />}
              <line className="adm-ch-axis" x1={0} x2={W} y1={80} y2={80} />
              {pts.map((p, k) => (
                <g key={p.day} style={{ "--k": k } as CSSProperties}>
                  {p.revenue > 0 && <rect className="adm-ch-bar" x={k * 10 + 1.5} y={80 - p.revenue * sRev} width={7} height={p.revenue * sRev} />}
                  {p.refunds > 0 && <rect className="adm-ch-neg" x={k * 10 + 1.5} y={81.5} width={7} height={Math.max(1.5, Math.min(18, p.refunds * sRev))} />}
                </g>
              ))}
              <Hits n={n} onPick={setSel} />
            </svg>
            <Axis pts={pts} />
          </div>
          <p className="adm-split-cap">
            <span data-tone="ok"><i aria-hidden />выручка — вверх</span>
            <span data-tone="off"><i aria-hidden />возвраты — вниз от оси</span>
          </p>

          <div className="adm-ch-pair">
            {/* Регистрации → пробные → оплатили. */}
            <div className="adm-ch-block">
              <p className="adm-ch-t">Регистрации и оплаты после пробного</p>
              <p className="adm-ch-sub a-num">
                {cur && <>{dayShort(cur.day)}: регистраций {num(cur.registrations)} · пробных {num(cur.trials)} · оплатили {num(cur.conversions)}</>}
              </p>
              <div
                className="adm-ch adm-ch-flow"
                tabIndex={0}
                role="group"
                aria-label={`Регистраций ${num(t.registrations)}, пробных ${num(t.trials)}, оплатили после пробного ${num(t.conversions)}.`}
                onKeyDown={onKey}
                onPointerLeave={() => setSel(null)}
              >
                <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" aria-hidden>
                  {cur && <line className="adm-ch-cursor" x1={idx * 10 + 5} x2={idx * 10 + 5} y1={0} y2={100} />}
                  <polyline className="adm-ln adm-ln-reg" points={line("registrations")} />
                  <polyline className="adm-ln adm-ln-tri" points={line("trials")} />
                  <polyline className="adm-ln adm-ln-conv" points={line("conversions")} />
                  <Hits n={n} onPick={setSel} />
                </svg>
                <Axis pts={pts} />
              </div>
              <p className="adm-split-cap">
                <span data-tone="ink"><i aria-hidden />регистрации</span>
                <span data-tone="mute"><i aria-hidden />пробные</span>
                <span data-tone="ok"><i aria-hidden />оплатили</span>
              </p>
            </div>

            {/* Продления и окончания. */}
            <div className="adm-ch-block">
              <p className="adm-ch-t">Продления и окончания</p>
              <p className="adm-ch-sub a-num">
                {cur && <>{dayShort(cur.day)}: продлений {num(cur.renewals)} · окончаний {num(cur.expirations)}</>}
              </p>
              <div
                className="adm-ch adm-ch-keep"
                tabIndex={0}
                role="group"
                aria-label={`Продлений ${num(t.renewals)}, окончаний без продления ${num(t.expirations)}.`}
                onKeyDown={onKey}
                onPointerLeave={() => setSel(null)}
              >
                <svg viewBox={`0 0 ${W} 100`} preserveAspectRatio="none" aria-hidden>
                  {cur && <rect className="adm-ch-sel" x={idx * 10} y={0} width={10} height={100} />}
                  <line className="adm-ch-axis" x1={0} x2={W} y1={50} y2={50} />
                  {pts.map((p, k) => (
                    <g key={p.day} style={{ "--k": k } as CSSProperties}>
                      {p.renewals > 0 && <rect className="adm-ch-bar" x={k * 10 + 1.5} y={50 - p.renewals * sKeep} width={7} height={p.renewals * sKeep} />}
                      {p.expirations > 0 && <rect className="adm-ch-warn" x={k * 10 + 1.5} y={51} width={7} height={p.expirations * sKeep} />}
                    </g>
                  ))}
                  <Hits n={n} onPick={setSel} />
                </svg>
                <Axis pts={pts} />
              </div>
              <p className="adm-split-cap">
                <span data-tone="ok"><i aria-hidden />продления — вверх</span>
                <span data-tone="warn"><i aria-hidden />окончания — вниз</span>
              </p>
            </div>
          </div>

          <details className="adm-details">
            <summary>Как считаем</summary>
            <ul className="adm-notes">
              {data.notes.map((note) => {
                const [key, ...rest] = note.split(" — ");
                return (
                  <li key={note}>
                    {NOTE_KEYS[key] ? <><b>{NOTE_KEYS[key]}</b> — {rest.join(" — ")}</> : note}
                  </li>
                );
              })}
              <li>Дни — московские сутки ({data.timezone}).</li>
            </ul>
          </details>

          <table className="b-sr">
            <caption>По дням с {data.from} по {data.to}</caption>
            <thead>
              <tr>
                <th scope="col">День</th>
                <th scope="col">Выручка, ₽</th>
                <th scope="col">Возвраты, ₽</th>
                <th scope="col">Платежей</th>
                <th scope="col">Пакеты трафика, ₽</th>
                <th scope="col">Пакетов трафика</th>
                <th scope="col">Регистраций</th>
                <th scope="col">Пробных</th>
                <th scope="col">Оплатили после пробного</th>
                <th scope="col">Продлений</th>
                <th scope="col">Окончаний</th>
              </tr>
            </thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.day}>
                  <th scope="row">{dayLong(p.day)}</th>
                  <td>{num(p.revenue)}</td>
                  <td>{num(p.refunds)}</td>
                  <td>{p.payments}</td>
                  <td>{num(p.trafficRevenue ?? 0)}</td>
                  <td>{p.trafficPayments ?? 0}</td>
                  <td>{p.registrations}</td>
                  <td>{p.trials}</td>
                  <td>{p.conversions}</td>
                  <td>{p.renewals}</td>
                  <td>{p.expirations}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
