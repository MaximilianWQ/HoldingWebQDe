import { NextRequest, NextResponse } from "next/server";
import { botExtendSubscription, createNotificationForUser } from "@/lib/store";
import { verifyBotApiKey, unauthorizedResponse } from "../auth";
import { botSyncDisabledResponse } from "../sync-guard";
import { syncUserToPanel } from "@/lib/subscription-sync";
import { startFlow, endFlow, info, warn } from "@/lib/panel-log";

// Hard cap per call: anything beyond ~13 months is a caller-side bug.
const MAX_DAYS = 400;

/** Срок для человека: «3 дн.», «10 мин.», «2 ч.». */
function humanSpan(days: number): string {
  const minutes = Math.round(days * 24 * 60);
  if (minutes < 60) return `${Math.max(1, minutes)} мин.`;
  if (minutes < 24 * 60) return `${Math.round(minutes / 60)} ч.`;
  const whole = days % 1 === 0 ? days : Math.round(days * 10) / 10;
  return `${whole} дн.`;
}

/**
 * POST /api/bot/extend — the bot extends a subscription after a payment
 * in the bot (contract: SYNC_TZ.md §3).
 *
 * Idempotency: `paymentId` in the body (or an `Idempotency-Key` header)
 * makes the call fully idempotent — extension and cashback happen once
 * per key. Without it, a repeat of the same (days, plan, amount) for the
 * same user within 120 s is treated as a retry and applies nothing
 * (`duplicate: true`). paymentId stays optional: we do not control the bot.
 */
export async function POST(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  const disabled = await botSyncDisabledResponse();
  if (disabled) return disabled;

  try {
    const { telegramId, days, plan, amount, paymentId } = await request.json();

    if (!telegramId || !days) {
      return NextResponse.json({ success: false, error: "telegramId and days required" }, { status: 400 });
    }
    if (typeof days !== "number" || days <= 0 || days > MAX_DAYS) {
      warn(null, "bot-purchase.rejected", { telegramId, days, max: MAX_DAYS });
      return NextResponse.json(
        { success: false, error: `days must be a positive number ≤ ${MAX_DAYS}`, code: "days_out_of_range" },
        { status: 400 }
      );
    }

    const idempotencyKey = paymentId ? String(paymentId) : request.headers.get("idempotency-key")?.trim() || undefined;
    const ctx = startFlow("bot-purchase");
    info(ctx, "bot-purchase.received", { telegramId, days, plan, amount, paymentId, idempotencyKey: idempotencyKey ?? null });

    const res = await botExtendSubscription(String(telegramId), days, {
      plan,
      amount: typeof amount === "number" ? amount : undefined,
      idempotencyKey,
    });
    if (!res) {
      warn(ctx, "bot-purchase.user_not_linked", { telegramId });
      endFlow(ctx, "failed", { reason: "user_not_linked" });
      return NextResponse.json({ success: false, error: "User not found. Link Telegram first." }, { status: 404 });
    }

    let user = res.user;
    if (res.applied) {
      const sync = await syncUserToPanel(user.id);
      if (sync.ok) info(ctx, "bot-purchase.panel_sync.ok", { action: sync.action });
      else warn(ctx, "bot-purchase.panel_sync.deferred", { reason: sync.reason, panelError: sync.panelError });
      if (sync.ok && sync.subscriptionUrl) user = { ...user, subscriptionUrl: sync.subscriptionUrl };

      const planLabel = plan === "plus" ? "Plus" : plan === "basic" ? "Basic" : "";
      // Срок пишется по-человечески (20.09.2026). `days` бывает дробным:
      // минутные админские выдачи приходят как `минуты / 1440`, и
      // «продлена на 0.006944444444444444 дн.» человеку показывать
      // нельзя. Меньше суток — считаем в минутах.
      await createNotificationForUser(
        user.id,
        "Подписка обновлена",
        `Подписка${planLabel ? ` ${planLabel}` : ""} продлена на ${humanSpan(days)} через Telegram.`
      );
    } else {
      info(ctx, "bot-purchase.duplicate", { sourceId: res.sourceId });
    }

    const end = new Date(user.subscriptionEnd);
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    endFlow(ctx, "ok", { days, applied: res.applied, sourceId: res.sourceId, cashback: res.referral ? res.referral.rewardRubles : 0 });

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        daysLeft,
        subscriptionEnd: user.subscriptionEnd,
        // `vpnKey` kept for the bot: now carries the Remnawave subscription link.
        vpnKey: user.subscriptionUrl,
        subscriptionUrl: user.subscriptionUrl,
        subscriptionPlan: user.subscriptionPlan,
        duplicate: res.duplicate,
        referralReward: res.referral
          ? { referrerId: res.referral.referrerId, percent: res.referral.percent, rewardAmount: res.referral.rewardRubles }
          : null,
      },
    });
  } catch (err) {
    console.error("[BOT/EXTEND] error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
