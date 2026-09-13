import { NextRequest, NextResponse } from "next/server";
import { getUserById, rowToPayment } from "@/lib/store";
import { syncUserToPanel } from "@/lib/subscription-sync";
import { reconcilePaymentWithYooKassa } from "@/lib/payments";
import { applyBypassGrants } from "@/lib/bypass-grants";
import { checkRateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";
import { pool } from "@/lib/db";

/**
 * POST /api/user/force-resync — the dashboard's "Обновить" button.
 *
 *   1. Re-ask YooKassa about THIS user's pending/expired payments of the
 *      last 7 days (catches "paid but the webhook never landed"); a
 *      success goes through the same atomic confirmPayment as the webhook.
 *   2. Sync the panel.
 *   3. Return a before/after diff for the message in the dashboard.
 */

interface ReconciledPayment {
  paymentId: string;
  product: "subscription" | "traffic";
  plan: string;
  period: number;
  outcome: "applied" | "canceled" | "still_pending" | "lookup_failed";
  errorMessage?: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 });
    }
    const before = auth.user;

    const limit = checkRateLimit(`force-resync:${before.id}`, 3, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: `Слишком часто. Повторите через ${limit.retryAfterSeconds} сек.` },
        { status: 429 }
      );
    }

    const beforeEnd = before.subscriptionEnd;

    const pending = (
      await pool.query(
        `SELECT * FROM payments
         WHERE user_id = $1
           AND status IN ('pending', 'expired')
           AND transaction_id IS NOT NULL
           AND created_at > NOW() - INTERVAL '7 days'
         ORDER BY created_at DESC`,
        [before.id]
      )
    ).rows.map(rowToPayment);

    const reconciled: ReconciledPayment[] = [];
    let appliedCount = 0;
    for (const p of pending) {
      const r = await reconcilePaymentWithYooKassa(p, "force_resync");
      const outcome: ReconciledPayment["outcome"] =
        r.outcome === "applied" || r.outcome === "already_applied"
          ? "applied"
          : r.outcome === "canceled"
            ? "canceled"
            : r.outcome === "lookup_failed"
              ? "lookup_failed"
              : "still_pending";
      if (r.outcome === "applied") appliedCount += 1;
      reconciled.push({ paymentId: p.id, product: p.product, plan: p.plan, period: p.period, outcome, ...(r.error ? { errorMessage: r.error } : {}) });
    }

    const syncResult = await syncUserToPanel(before.id);
    // Owed bypass gigabytes (a pack paid while the panel was down, the
    // trial 500 MB) — pushed here too. Idempotent; never touches premium.
    const bypass = await applyBypassGrants(before.id);

    const after = await getUserById(before.id);
    const afterEnd = after?.subscriptionEnd ?? beforeEnd;
    const dateChanged = new Date(beforeEnd).getTime() !== new Date(afterEnd).getTime();

    return NextResponse.json({
      success: true,
      data: {
        beforeSubscriptionEnd: beforeEnd,
        afterSubscriptionEnd: afterEnd,
        changed: dateChanged || appliedCount > 0 || bypass.applied > 0,
        paymentsScanned: pending.length,
        paymentsApplied: appliedCount,
        bypassApplied: bypass.applied,
        bypassOwed: bypass.ok ? 0 : bypass.owed,
        reconciled,
        panelAction: syncResult.action,
        panelUuid: syncResult.uuid,
        subscriptionUrl: after?.subscriptionUrl ?? syncResult.subscriptionUrl,
        reason: syncResult.reason,
      },
    });
  } catch (err) {
    console.error("[USER/FORCE-RESYNC] error:", err);
    return NextResponse.json({ success: false, error: "Не удалось обновить подписку" }, { status: 500 });
  }
}
