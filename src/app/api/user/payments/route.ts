import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { pool } from "@/lib/db";

/**
 * GET /api/user/payments — «История платежей» в кабинете.
 * Последние 50 платежей ТЕКУЩЕГО пользователя (по сессии, как
 * /api/user/subscription) — своих данных, чужих не отдаёт.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getSessionUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 });
    }

    const result = await pool.query(
      `SELECT id, product, plan, period, traffic_pack_id, traffic_bytes, amount, currency, status, created_at, paid_at
         FROM payments
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50`,
      [auth.user.id]
    );

    const payments = result.rows.map((row) => ({
      id: row.id as string,
      product: row.product === "traffic" ? "traffic" : "subscription",
      plan: row.plan as string,
      period: Number(row.period),
      trafficPackId: row.traffic_pack_id ?? null,
      trafficBytes: row.traffic_bytes != null ? Number(row.traffic_bytes) : null,
      amount: parseFloat(row.amount),
      currency: row.currency as string,
      status: row.status as string,
      createdAt: new Date(row.created_at).toISOString(),
      paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    }));

    return NextResponse.json({ success: true, data: payments });
  } catch (err) {
    console.error("[USER/PAYMENTS] error:", err);
    return NextResponse.json({ success: false, error: "Временная ошибка, попробуйте обновить страницу" }, { status: 500 });
  }
}
