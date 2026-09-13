/**
 * Daily business series for the admin, bucketed by Moscow calendar days
 * (Europe/Moscow, UTC+3 without DST since 2014).
 *
 * Expiration rule (also used for overview.funnel.expired_7d/30d):
 *   An expiration is the moment a subscription end date passed without
 *   the subscription having been extended BEFORE it passed.
 *   - From the ledger: every subscription_events row (except `refund`,
 *     which does not move dates) whose new_end lies in the window and in
 *     the past, and for which no later ledger event of the same user
 *     was created before that new_end. An admin revoke counts (it ends
 *     access now). A renewal after the end does not cancel the expiration.
 *   - Users with no ledger events at all (pre-ledger history) fall back
 *     to users.subscription_end in the window, excluding accounts that
 *     never had access (end within a minute of creation — e.g. a sign-up
 *     that was refused the trial).
 *   Panel status transitions are not stored, so they are not used.
 */

import { pool } from "./db";

export const MSK_TZ = "Europe/Moscow";
const MSK_OFFSET = "+03:00";

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: MSK_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** "YYYY-MM-DD" of the Moscow calendar day containing `d`. */
export function mskDay(d: Date): string {
  return dayFmt.format(d);
}

/** Start of a Moscow day as a Date. */
export function mskDayStart(day: string): Date {
  return new Date(`${day}T00:00:00${MSK_OFFSET}`);
}

/** The last `days` Moscow days, oldest first, ending with today. */
export function mskDayRange(days: number, now: Date = new Date()): string[] {
  const today = mskDayStart(mskDay(now)).getTime();
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(mskDay(new Date(today - i * 86400000 + 12 * 3600000)));
  return out;
}

export interface SeriesPayment {
  userId: string;
  amount: number;
  paidAt: Date | null;
  refundedAt: Date | null;
  /** The user had an earlier paid payment → this one is a renewal. */
  hasEarlierPaid: boolean;
  /** The user had a trial before this payment. */
  hadTrial: boolean;
  /** «Пакет трафика»: counted in revenue/payments and in traffic*, never as a conversion or renewal. */
  product?: "subscription" | "traffic";
}

export interface SeriesInput {
  payments: SeriesPayment[];
  registrations: Date[];
  trials: Date[];
  expirations: Date[];
}

export interface SeriesPoint {
  day: string;
  revenue: number;
  refunds: number;
  refundsCount: number;
  payments: number;
  registrations: number;
  trials: number;
  conversions: number;
  renewals: number;
  expirations: number;
  /** «Пакеты трафика»: сумма и число оплат (уже входят в revenue и payments). */
  trafficRevenue: number;
  trafficPayments: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const zeroPoint = (day: string): SeriesPoint => ({
  day,
  revenue: 0,
  refunds: 0,
  refundsCount: 0,
  payments: 0,
  registrations: 0,
  trials: 0,
  conversions: 0,
  renewals: 0,
  expirations: 0,
  trafficRevenue: 0,
  trafficPayments: 0,
});

/** Pure: bucket raw events into Moscow days. Events outside `range` are ignored. */
export function buildDailySeries(input: SeriesInput, range: string[]): SeriesPoint[] {
  const map = new Map<string, SeriesPoint>(range.map((day) => [day, zeroPoint(day)]));
  const at = (d: Date | null) => (d ? map.get(mskDay(d)) : undefined);

  for (const p of input.payments) {
    const paid = at(p.paidAt);
    if (paid) {
      paid.revenue += p.amount;
      paid.payments += 1;
      if (p.product === "traffic") {
        paid.trafficRevenue += p.amount;
        paid.trafficPayments += 1;
      } else if (p.hasEarlierPaid) paid.renewals += 1;
      else if (p.hadTrial) paid.conversions += 1;
    }
    const refunded = at(p.refundedAt);
    if (refunded) {
      refunded.refunds += p.amount;
      refunded.refundsCount += 1;
    }
  }
  for (const d of input.registrations) {
    const b = at(d);
    if (b) b.registrations += 1;
  }
  for (const d of input.trials) {
    const b = at(d);
    if (b) b.trials += 1;
  }
  for (const d of input.expirations) {
    const b = at(d);
    if (b) b.expirations += 1;
  }
  return range.map((day) => {
    const p = map.get(day)!;
    return { ...p, revenue: round2(p.revenue), refunds: round2(p.refunds), trafficRevenue: round2(p.trafficRevenue) };
  });
}

export const EXPIRATIONS_SQL = `
  SELECT e.user_id, e.new_end AS ended_at
  FROM subscription_events e
  WHERE e.kind <> 'refund'
    AND e.new_end >= $1 AND e.new_end <= NOW()
    AND NOT EXISTS (
      SELECT 1 FROM subscription_events e2
      WHERE e2.user_id = e.user_id AND e2.kind <> 'refund'
        AND (e2.created_at > e.created_at OR (e2.created_at = e.created_at AND e2.id > e.id))
        AND e2.created_at <= e.new_end
    )
  UNION ALL
  SELECT u.id AS user_id, u.subscription_end AS ended_at
  FROM users u
  WHERE u.subscription_end >= $1 AND u.subscription_end <= NOW()
    AND u.subscription_end > u.created_at + INTERVAL '1 minute'
    AND NOT EXISTS (SELECT 1 FROM subscription_events e WHERE e.user_id = u.id)`;

export async function getExpirations(since: Date): Promise<Array<{ userId: string; endedAt: Date }>> {
  const r = await pool.query<{ user_id: string; ended_at: Date }>(EXPIRATIONS_SQL, [since]);
  return r.rows.map((x) => ({ userId: x.user_id, endedAt: new Date(x.ended_at) }));
}

export interface DailySeries {
  days: number;
  timezone: string;
  from: string;
  to: string;
  points: SeriesPoint[];
  totals: Omit<SeriesPoint, "day">;
  notes: string[];
}

export async function getDailySeries(days: number, now: Date = new Date()): Promise<DailySeries> {
  const range = mskDayRange(days, now);
  const since = mskDayStart(range[0]);

  const [payments, regs, trials, expirations] = await Promise.all([
    pool.query<{ user_id: string; amount: number; paid_at: Date | null; refunded_at: Date | null; has_earlier: boolean; had_trial: boolean; product: string | null }>(
      `SELECT p.user_id, p.amount::float AS amount, p.paid_at, p.refunded_at, p.product,
              EXISTS (SELECT 1 FROM payments q WHERE q.user_id = p.user_id AND q.status IN ('confirmed','refunded')
                      AND q.product = 'subscription' AND q.paid_at < p.paid_at) AS has_earlier,
              (u.trial_used_at IS NOT NULL AND u.trial_used_at < p.paid_at) AS had_trial
       FROM payments p JOIN users u ON u.id = p.user_id
       WHERE p.status IN ('confirmed', 'refunded') AND (p.paid_at >= $1 OR p.refunded_at >= $1)`,
      [since]
    ),
    pool.query<{ created_at: Date }>("SELECT created_at FROM users WHERE created_at >= $1", [since]),
    pool.query<{ trial_used_at: Date }>("SELECT trial_used_at FROM users WHERE trial_used_at >= $1", [since]),
    getExpirations(since),
  ]);

  const points = buildDailySeries(
    {
      payments: payments.rows.map((r) => ({
        userId: r.user_id,
        amount: Number(r.amount),
        paidAt: r.paid_at ? new Date(r.paid_at) : null,
        refundedAt: r.refunded_at ? new Date(r.refunded_at) : null,
        hasEarlierPaid: r.has_earlier,
        hadTrial: r.had_trial,
        product: r.product === "traffic" ? ("traffic" as const) : ("subscription" as const),
      })),
      registrations: regs.rows.map((r) => new Date(r.created_at)),
      trials: trials.rows.map((r) => new Date(r.trial_used_at)),
      expirations: expirations.map((e) => e.endedAt),
    },
    range
  );

  const totals = points.reduce(
    (t, p) => {
      for (const k of Object.keys(t) as Array<keyof typeof t>) t[k] += p[k];
      return t;
    },
    (({ day: _day, ...rest }) => rest)(zeroPoint(""))
  );
  totals.revenue = round2(totals.revenue);
  totals.refunds = round2(totals.refunds);
  totals.trafficRevenue = round2(totals.trafficRevenue);

  return {
    days,
    timezone: MSK_TZ,
    from: range[0],
    to: range[range.length - 1],
    points,
    totals,
    notes: [
      "revenue — оплаты сайта (confirmed и позже возвращённые) по дню оплаты; оплаты в боте сюда не входят",
      "refunds — сумма исходного платежа по дню возврата",
      "conversions — первая оплата подписки пользователем, у которого до неё был пробный период",
      "renewals — оплата подписки пользователем, у которого уже была более ранняя оплата подписки",
      "traffic — пакеты трафика: входят в выручку и число платежей, в конверсии и продления не входят",
      "expirations — окончание подписки без продления до момента окончания (журнал; для истории до журнала — дата окончания)",
    ],
  };
}
