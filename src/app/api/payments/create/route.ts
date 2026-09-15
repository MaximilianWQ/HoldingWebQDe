import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { createPaymentRecord, setPaymentTransaction, transitionPaymentStatus } from "@/lib/store";
import { createPayment } from "@/lib/yookassa";
import { PLANS, isPeriod, isPlanId } from "@/lib/plans";
import { isTrafficPackId, trafficPackById, trafficPackBytes } from "@/lib/traffic-packs";
import { getSessionUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";

const PAYMENT_LIFETIME_MS = 15 * 60 * 1000; // 15 minutes

/** Боевой адрес сайта — умолчание в коде (как в payments.ts), env только переопределяет. */
const DEFAULT_SITE_URL = "https://qodev.dev";

/** Where YooKassa sends the buyer back. Env first, then the production address —
 *  never the request Origin (it's client-controlled). Local runs set SITE_BASE_URL. */
function siteBaseUrl(_request: NextRequest): string {
  const env = (process.env.SITE_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  return env || DEFAULT_SITE_URL;
}

/**
 * POST /api/payments/create
 *   { plan: "basic"|"plus", period: 1|3|6|12 }       — subscription (as before)
 *   { product: "traffic", packId: "gb15"|…|"gb5000" } — «Пакет трафика»
 *
 * The amount is ALWAYS taken on the server — from plans.ts or
 * traffic-packs.ts. Anything else in the body (an `amount`, a changed
 * price) is ignored.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Не авторизован" },
        { status: 401 }
      );
    }
    const user = auth.user;

    // Each call opens a real YooKassa payment: cap it per account.
    const limit = checkRateLimit(`payment-create:${user.id}`, 10, 10 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: `Слишком много попыток оплаты. Повторите через ${limit.retryAfterSeconds} сек.` },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    const isTraffic = body?.product === "traffic";

    let amount: number;
    let plan: string;
    let period: number;
    let description: string;
    let traffic: { packId: string; bytes: number } | undefined;
    const paymentId = uuidv4();
    const metadata: Record<string, string> = { paymentId, userId: user.id, product: isTraffic ? "traffic" : "subscription" };

    if (isTraffic) {
      if (!isTrafficPackId(body?.packId)) {
        return NextResponse.json({ success: false, error: "Неизвестный пакет трафика" }, { status: 400 });
      }
      const pack = trafficPackById(body.packId)!;
      amount = pack.priceRub;
      plan = "traffic";
      period = 0;
      traffic = { packId: pack.id, bytes: trafficPackBytes(pack) };
      description = `Atlas Secure — пакет трафика ${pack.gb} ГБ`;
      metadata.packId = pack.id;
    } else {
      const reqPlan = body?.plan;
      const reqPeriod = body?.period;
      // Обе величины приходят от клиента и до этой проверки не имеют
      // типа: без сужения ошибочное имя тарифа дало бы undefined, а
      // сумма платежа — NaN.
      if (!isPlanId(reqPlan) || !isPeriod(reqPeriod)) {
        return NextResponse.json(
          { success: false, error: "Неверный тариф или срок" },
          { status: 400 }
        );
      }
      amount = PLANS[reqPlan][reqPeriod];
      plan = reqPlan;
      period = reqPeriod;
      description = `Atlas Secure ${reqPlan === "plus" ? "Plus" : "Basic"} — ${reqPeriod} мес.`;
      metadata.plan = reqPlan;
      metadata.period = String(reqPeriod);
    }

    const expiresAt = new Date(Date.now() + PAYMENT_LIFETIME_MS);
    const returnUrl = `${siteBaseUrl(request)}/subscribe?payment=${paymentId}`;

    // Our record FIRST: if anything below crashes after YooKassa took the
    // money, the webhook still finds the payment (by metadata.paymentId).
    await createPaymentRecord(paymentId, user.id, plan, period, amount, null, null, expiresAt, traffic);

    let transactionId: string;
    let redirectUrl: string;
    try {
      const result = await createPayment({ amount, description, returnUrl, metadata });
      transactionId = result.transactionId;
      redirectUrl = result.redirect;
    } catch (err) {
      console.error("[PAYMENTS] YooKassa create error:", err);
      await transitionPaymentStatus(paymentId, ["pending"], "failed").catch((dbErr) =>
        console.error("[PAYMENTS] could not mark payment failed:", paymentId, dbErr)
      );
      return NextResponse.json(
        { success: false, error: "Не удалось создать платёж. Попробуйте позже." },
        { status: 502 }
      );
    }

    await setPaymentTransaction(paymentId, transactionId, redirectUrl);

    return NextResponse.json({
      success: true,
      data: {
        paymentId,
        redirectUrl,
        amount,
        product: isTraffic ? "traffic" : "subscription",
        ...(traffic ? { packId: traffic.packId, trafficBytes: traffic.bytes } : {}),
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[PAYMENTS] create failed:", err);
    return NextResponse.json(
      { success: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
