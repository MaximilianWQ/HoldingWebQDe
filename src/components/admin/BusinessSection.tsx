"use client";

import type { CSSProperties } from "react";
import { PERIOD_LABEL, type Period } from "@/lib/plans";
import {
  LEDGER_LABELS,
  PLAN_LABELS,
  bytes,
  isErr,
  money,
  num,
  pct,
  pcs,
  type Overview,
  type OverviewFunnel,
  type OverviewRevenue,
} from "@/app/admin/admin-shared";
import { Bars, BlockError, Meter, Skel, Stack, Tile } from "./Viz";
import SeriesCard from "./SeriesCard";

/**
 * «Бизнес» — деньги, воронка и аудитория из GET /api/admin/overview
 * (revenue, funnel, ledger30d). Каждая панель читает свой блок и
 * показывает свою ошибку.
 *
 * Суммы в revenue.gross включают платежи, по которым потом был возврат
 * (status confirmed | refunded), поэтому «чистыми» = 30 дней − возвраты
 * за 30 дней. Средний чек — 30 дней / число платежей за 30 дней.
 * Динамики по дням в API нет — вместо графика честные средние за день
 * по трём окнам.
 */

const at = (i: number) => ({ "--i": i }) as CSSProperties;

const periodLabel = (p: number) => PERIOD_LABEL[p as Period]?.short ?? `${p} мес`;

export default function BusinessSection({ ov, ovError, reloadKey = 0 }: { ov: Overview | null; ovError: string | null; reloadKey?: number }) {
  const revenue = ov ? ov.revenue : null;
  const funnel = ov ? ov.funnel : null;
  const ledger = ov ? ov.ledger30d : null;
  const whole = !ov && ovError;
  return (
    <div className="adm-grid adm-biz">
      {whole && (
        <div className="adm-span-all">
          <BlockError title="Сводка не загрузилась" text={ovError || undefined} />
        </div>
      )}
      <RevenuePlate r={revenue} />
      <PaceCard r={revenue} />
      <SeriesCard i={3} reloadKey={reloadKey} />
      <PlansCard r={revenue} />
      <FunnelCard f={funnel} r={revenue} />
      <AudienceCard f={funnel} />
      <TrafficCard r={revenue} />
      <LedgerCard l={ledger} />
    </div>
  );
}

/* ─── Выручка · 30 дней (тёмная плита) ───────────────────────────── */

function RevenuePlate({ r }: { r: Overview["revenue"] | null }) {
  const v: OverviewRevenue | null = r && !isErr(r) ? r : null;
  const net = v ? v.gross.d30 - v.refunds30d.amount : 0;
  const avg = v && v.gross.count30 > 0 ? v.gross.d30 / v.gross.count30 : 0;
  return (
    <section className="ak-card ak-dark adm-rev" data-sheet="24" style={at(1)} aria-labelledby="adm-rev-h">
      <div className="ak-card-head">
        <h2 id="adm-rev-h" className="ak-eyebrow">Выручка · 30 дней</h2>
        {v && <span className="ak-plan">{v.currency === "RUB" ? "рубли" : v.currency}</span>}
      </div>
      {r === null ? (
        <Skel />
      ) : !v ? (
        <BlockError title="Выручка не посчиталась" text={isErr(r) ? r.error : undefined} />
      ) : (
        <>
          <p className="ak-value ak-value-live adm-rev-v"><span className="a-num">{money(v.gross.d30)}</span></p>
          <p className="adm-rev-net a-num">чистыми {money(net)} после возвратов</p>
          <p className="ak-fine adm-rev-note">Суммы — подтверждённые платежи, включая те, по которым потом был возврат. «Чистыми» — минус возвраты за те же 30 дней.</p>
          <ul className="adm-verdict-kpi">
            <li><span>Платежей</span><b className="a-num">{num(v.gross.count30)}</b></li>
            <li><span>Средний чек</span><b className="a-num">{money(avg)}</b></li>
            <li><span>За всё время</span><b className="a-num">{money(v.gross.all_time)}</b></li>
          </ul>
        </>
      )}
    </section>
  );
}

/* ─── Темп: средняя выручка в день ───────────────────────────────── */

function PaceCard({ r }: { r: Overview["revenue"] | null }) {
  const v = r && !isErr(r) ? r : null;
  const refundShare = v && v.gross.d30 > 0 ? pct(v.refunds30d.amount, v.gross.d30) : 0;
  return (
    <section className="ak-card adm-pace" data-sheet="24" style={at(2)} aria-labelledby="adm-pace-h">
      <div className="ak-card-head">
        <h2 id="adm-pace-h" className="ak-eyebrow">Темп</h2>
        <span className="ak-plan">в среднем за день</span>
      </div>
      {r === null ? (
        <Skel />
      ) : !v ? (
        <BlockError title="Нет данных о выручке" />
      ) : (
        <>
          <Bars
            label="Выручка в среднем за день"
            items={[
              { key: "t", label: "Сегодня", value: v.gross.today, shown: money(v.gross.today), note: "день ещё идёт" },
              { key: "7", label: "7 дней", value: v.gross.d7 / 7, shown: money(v.gross.d7 / 7), note: `всего ${money(v.gross.d7)}` },
              { key: "30", label: "30 дней", value: v.gross.d30 / 30, shown: money(v.gross.d30 / 30), note: `всего ${money(v.gross.d30)}` },
            ]}
          />
          <ul className="adm-tiles adm-tiles-row">
            <Tile label="Возвратов за 30 дней" value={num(v.refunds30d.n)} tone={v.refunds30d.n > 0 ? "warn" : undefined} />
            <Tile label="Сумма возвратов" value={money(v.refunds30d.amount)} note={v.gross.d30 > 0 ? `${pcs(v.refunds30d.amount, v.gross.d30)} выручки` : undefined} tone={refundShare > 5 ? "off" : undefined} />
          </ul>
        </>
      )}
    </section>
  );
}

/* ─── По тарифам ─────────────────────────────────────────────────── */

function PlansCard({ r }: { r: Overview["revenue"] | null }) {
  const v = r && !isErr(r) ? r : null;
  const rows = v ? [...v.byPlan30d].sort((a, b) => b.amount - a.amount) : [];
  const total = rows.reduce((s, x) => s + x.amount, 0);
  const basic = rows.filter((x) => x.plan === "basic").reduce((s, x) => s + x.amount, 0);
  const plus = rows.filter((x) => x.plan === "plus").reduce((s, x) => s + x.amount, 0);
  return (
    <section className="ak-card adm-plans" data-sheet="24" style={at(3)} aria-labelledby="adm-plans-h">
      <div className="ak-card-head">
        <h2 id="adm-plans-h" className="ak-eyebrow">Подписки по тарифам · 30 дней</h2>
        {total > 0 && <span className="ak-plan a-num">{money(total)}</span>}
      </div>
      {r === null ? (
        <Skel rows={4} />
      ) : !v ? (
        <BlockError title="Нет данных о выручке" />
      ) : rows.length === 0 ? (
        <p className="adm-empty">За 30 дней оплат не было.</p>
      ) : (
        <>
          <div className="adm-split">
            <Stack label={`Basic ${pcs(basic, total)}, Plus ${pcs(plus, total)}`} parts={[{ value: basic, tone: "ok" }, { value: plus, tone: "ink" }, { value: total - basic - plus, tone: "mute" }]} />
            <p className="adm-split-cap a-num">
              <span data-tone="ok"><i aria-hidden />Basic {pcs(basic, total)}</span>
              <span data-tone="ink"><i aria-hidden />Plus {pcs(plus, total)}</span>
            </p>
          </div>
          <Bars
            label="Выручка по тарифу и сроку за 30 дней"
            items={rows.map((x) => ({
              key: `${x.plan}-${x.period}`,
              label: <>{PLAN_LABELS[x.plan] || x.plan} · {periodLabel(x.period)}</>,
              value: x.amount,
              shown: money(x.amount),
              note: `${num(x.n)} ${x.n % 10 === 1 && x.n % 100 !== 11 ? "оплата" : "оплат"} · ${pcs(x.amount, total)}`,
            }))}
          />
        </>
      )}
    </section>
  );
}

/* ─── Пакеты трафика ─────────────────────────────────────────────── */

const packLabel = (pack: string | null) => {
  const m = /^gb(\d+)$/.exec(pack || "");
  return m ? `${num(Number(m[1]))} ГБ` : pack || "—";
};

function TrafficCard({ r }: { r: Overview["revenue"] | null }) {
  const v = r && !isErr(r) ? r : null;
  const t = v?.traffic30d;
  const rows = t ? [...t.byPack].sort((a, b) => b.amount - a.amount) : [];
  const share = v && t && v.gross.d30 > 0 ? pcs(t.amount, v.gross.d30) : null;
  return (
    <section className="ak-card adm-traffic" data-sheet="24" style={at(6)} aria-labelledby="adm-traffic-h">
      <div className="ak-card-head">
        <h2 id="adm-traffic-h" className="ak-eyebrow">Пакеты трафика · 30 дней</h2>
        {t && t.amount > 0 && <span className="ak-plan a-num">{money(t.amount)}</span>}
      </div>
      {r === null ? (
        <Skel rows={3} />
      ) : !v ? (
        <BlockError title="Нет данных о выручке" />
      ) : !t ? (
        <p className="adm-empty">Сервер ещё не отдаёт пакеты трафика — обновите бэкенд.</p>
      ) : (
        <>
          <ul className="adm-tiles adm-tiles-row">
            <Tile label="Выручка" value={money(t.amount)} note={share ? `${share} всей выручки` : undefined} tone="ok" />
            <Tile label="Продано пакетов" value={num(t.n)} />
            <Tile label="Гигабайт" value={bytes(t.bytes)} tone="mute" />
          </ul>
          {rows.length === 0 ? (
            <p className="adm-empty">За 30 дней пакеты не покупали.</p>
          ) : (
            <Bars
              label="Выручка по пакетам трафика за 30 дней"
              items={rows.map((x) => ({
                key: x.pack || "none",
                label: packLabel(x.pack),
                value: x.amount,
                shown: money(x.amount),
                note: `${num(x.n)} ${x.n % 10 === 1 && x.n % 100 !== 11 ? "покупка" : "покупок"} · ${pcs(x.amount, t.amount)}`,
              }))}
            />
          )}
          <p className="ak-fine">Суммы входят в «Выручку · 30 дней». Конверсия и продления выше считаются только по подпискам.</p>
        </>
      )}
    </section>
  );
}

/* ─── Воронка ────────────────────────────────────────────────────── */

function FunnelCard({ f, r }: { f: Overview["funnel"] | null; r: Overview["revenue"] | null }) {
  const v: OverviewFunnel | null = f && !isErr(f) ? f : null;
  const count30 = r && !isErr(r) ? r.gross.count30 : 0;
  const rate = v?.trialConversionRate ?? null;
  return (
    <section className="ak-card adm-funnel" data-sheet="24" style={at(4)} aria-labelledby="adm-funnel-h">
      <div className="ak-card-head">
        <h2 id="adm-funnel-h" className="ak-eyebrow">Пробный → оплата</h2>
        <span className="ak-plan">когорта 30 дней</span>
      </div>
      {f === null ? (
        <Skel />
      ) : !v ? (
        <BlockError title="Воронка не посчиталась" text={isErr(f) ? f.error : undefined} />
      ) : (
        <>
          <p className="ak-value"><span className="a-num">{rate === null ? "—" : `${rate.toLocaleString("ru-RU")} %`}</span><small>конверсия</small></p>
          <Meter p={rate === null ? 0 : rate / 100} label={`Оплатили ${v.trialsConverted30d} из ${v.trials30d}`} />
          <p className="ak-fine a-num">
            Из {num(v.trials30d)} пробных за 30 дней оплатили {num(v.trialsConverted30d)}.
          </p>
          <ul className="adm-tiles adm-tiles-row">
            <Tile label="Продлений" value={num(v.renewals30d)} note={count30 > 0 ? `${pcs(v.renewals30d, count30)} платежей` : undefined} tone="ok" />
            <Tile label="Новых за 7 дней" value={num(v.users.new_7d)} />
          </ul>
        </>
      )}
    </section>
  );
}

/* ─── Аудитория ──────────────────────────────────────────────────── */

function AudienceCard({ f }: { f: Overview["funnel"] | null }) {
  const v = f && !isErr(f) ? f : null;
  const u = v?.users;
  const other = u ? Math.max(0, u.live - u.live_paid - u.live_trial) : 0;
  return (
    <section className="ak-card adm-aud" data-sheet="24" style={at(5)} aria-labelledby="adm-aud-h">
      <div className="ak-card-head">
        <h2 id="adm-aud-h" className="ak-eyebrow">Аудитория</h2>
        {u && <span className="ak-plan a-num">всего {num(u.total)}</span>}
      </div>
      {f === null ? (
        <Skel />
      ) : !u ? (
        <BlockError title="Нет данных об аудитории" />
      ) : (
        <>
          <p className="ak-value"><span className="a-num">{num(u.live)}</span><small>с активной подпиской</small></p>
          <Stack
            label={`Платных ${u.live_paid}, пробных ${u.live_trial}`}
            parts={[{ value: u.live_paid, tone: "ok" }, { value: u.live_trial, tone: "mute" }, { value: other, tone: "warn" }]}
          />
          <p className="adm-split-cap a-num">
            <span data-tone="ok"><i aria-hidden />платных {num(u.live_paid)} · {pcs(u.live_paid, u.live)}</span>
            <span data-tone="mute"><i aria-hidden />пробных {num(u.live_trial)}</span>
          </p>
          <ul className="adm-tiles adm-tiles-row">
            <Tile label="Истекли за 7 дней" value={num(u.expired_7d)} tone={u.expired_7d > 0 ? "warn" : undefined} />
            <Tile label="Истекли за 30 дней" value={num(u.expired_30d)} />
            <Tile label="Без подписки" value={num(Math.max(0, u.total - u.live))} tone="mute" />
          </ul>
          <p className="ak-fine">Истёкшие считаются по текущей дате окончания: кто продлил после истечения, сюда не попадает.</p>
        </>
      )}
    </section>
  );
}

/* ─── События подписок ───────────────────────────────────────────── */

function LedgerCard({ l }: { l: Overview["ledger30d"] | null }) {
  const v = l && !isErr(l) ? l : null;
  const rows = v ? Object.entries(v).sort((a, b) => b[1] - a[1]) : [];
  const total = rows.reduce((s, [, n]) => s + n, 0);
  return (
    <section className="ak-card adm-ledger" data-sheet="24" style={at(7)} aria-labelledby="adm-ledger-h">
      <div className="ak-card-head">
        <h2 id="adm-ledger-h" className="ak-eyebrow">События подписок · 30 дней</h2>
        {total > 0 && <span className="ak-plan a-num">{num(total)}</span>}
      </div>
      {l === null ? (
        <Skel rows={4} />
      ) : !v ? (
        <BlockError title="Журнал событий не посчитался" text={isErr(l) ? l.error : undefined} />
      ) : rows.length === 0 ? (
        <p className="adm-empty">Событий за 30 дней нет.</p>
      ) : (
        <Bars
          label="События подписок за 30 дней"
          items={rows.map(([kind, n]) => ({
            key: kind,
            label: LEDGER_LABELS[kind] || kind,
            value: n,
            shown: num(n),
            tone: kind === "refund" || kind === "admin_revoke" ? "off" : kind === "bot_overwrite" || kind === "ghost_repair_manual" ? "warn" : undefined,
          }))}
        />
      )}
    </section>
  );
}
