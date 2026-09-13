import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId, getLoyaltyInfo } from "@/lib/store";
import { getBypassForUser } from "@/lib/bypass";
import { verifyBotApiKey, unauthorizedResponse } from "../auth";
import { bypassJson } from "../link-http";

/**
 * GET /api/bot/status?telegram_id=XXX
 *
 * Full synced status for a Telegram user. For a linked person this is
 * how the bot learns the SHARED key: `panelUserId` + `subscriptionUrl`
 * (the bot must not create or extend its own `tg_{id}_premium` then).
 * `vpnKey` is kept for the old bot and carries the same link.
 * `bypass` — the person's bypass (обход) entity when known; null when
 * none or the panel did not answer within ~2.5 s.
 */
export async function GET(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();

  try {
    const telegramId = request.nextUrl.searchParams.get("telegram_id") || request.nextUrl.searchParams.get("telegramId");
    if (!telegramId) {
      return NextResponse.json({ success: false, error: "telegram_id required" }, { status: 400 });
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found", code: "NOT_LINKED", data: { linked: false } }, { status: 404 });
    }

    const msLeft = Math.max(0, new Date(user.subscriptionEnd).getTime() - Date.now());
    const totalMinutes = Math.floor(msLeft / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);
    const isExpired = msLeft === 0;
    const link = isExpired ? null : user.subscriptionUrl;
    const plan = isExpired ? "expired" : (user.subscriptionPlan || "trial");
    const bypass = await getBypassForUser(user).catch(() => null);

    return NextResponse.json({
      success: true,
      data: {
        linked: true,
        userId: user.id,
        email: user.email,
        telegramId: user.telegramId,
        telegramLinked: user.telegramLinked,
        panelUserId: user.panelUserId,
        linkKept: user.linkKept,
        daysLeft: Math.floor(totalHours / 24),
        hoursLeft: totalHours % 24,
        minutesLeft: totalMinutes % 60,
        isExpired,
        hasActiveSubscription: !isExpired && !!user.subscriptionUrl,
        subscriptionEnd: user.subscriptionEnd,
        plan,
        subscriptionPlan: plan,
        vpnKey: link,
        subscriptionUrl: link,
        xrayUuid: null,
        bypass: bypassJson(bypass),
        referralCode: user.referralCode,
        referrals: user.referrals,
        paidReferrals: user.paidReferrals,
        balance: user.balance,
        balanceRubles: user.balance / 100,
        cashbackPercent: getLoyaltyInfo(user.paidReferrals).percent,
        loyaltyTier: getLoyaltyInfo(user.paidReferrals).tier,
      },
    });
  } catch (err) {
    console.error("[BOT/STATUS] error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
