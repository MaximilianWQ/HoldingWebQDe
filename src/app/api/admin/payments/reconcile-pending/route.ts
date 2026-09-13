import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { rowToPayment } from "@/lib/store";
import { reconcilePaymentWithYooKassa } from "@/lib/payments";
import { periodDays } from "@/lib/plans";
import { formatTraffic } from "@/lib/traffic-packs";
import { verifyAdmin } from "../../middleware";

/**
 * Reconcile pending AND locally-expired payments of the last 7 days
 * against YooKassa. A success goes through confirmPayment — the same
 * atomic, idempotent path as the webhook — so running this while the
 * webhook arrives cannot extend twice. Safe to re-run.
 */
export async function POST() {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }

  try {
    const rows = (
      await pool.query(
        `SELECT * FROM payments
         WHERE status IN ('pending', 'expired')
           AND transaction_id IS NOT NULL
           AND created_at > NOW() - INTERVAL '7 days'
         ORDER BY created_at DESC`
      )
    ).rows.map(rowToPayment);

    const result = {
      scanned: rows.length,
      applied: 0,
      canceled: 0,
      still_pending: 0,
      failed: 0,
      details: [] as Array<{ payment_id: string; user_id: string; outcome: string }>,
    };

    for (const p of rows) {
      try {
        const r = await reconcilePaymentWithYooKassa(p, "admin_reconcile");
        let outcome: string = r.outcome;
        if (r.outcome === "applied") {
          result.applied += 1;
          outcome = p.product === "traffic" ? `applied +${p.trafficBytes ? formatTraffic(p.trafficBytes) : "?"}` : `applied +${periodDays(p.period) ?? "?"}d`;
        } else if (r.outcome === "canceled") result.canceled += 1;
        else if (r.outcome === "lookup_failed") {
          result.failed += 1;
          outcome = `yookassa lookup failed: ${(r.error || "").slice(0, 80)}`;
        } else result.still_pending += 1;
        result.details.push({ payment_id: p.id, user_id: p.userId, outcome });
      } catch (err) {
        result.failed += 1;
        result.details.push({ payment_id: p.id, user_id: p.userId, outcome: `apply failed: ${(err as Error).message?.slice(0, 80)}` });
        console.error(`[ADMIN/RECONCILE-PENDING] ${p.id} failed:`, err);
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error("[ADMIN/RECONCILE-PENDING] error:", err);
    return NextResponse.json({ success: false, error: "Внутренняя ошибка" }, { status: 500 });
  }
}
