import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId, botOverwriteSubscription, createNotificationForUser, createAuditLog } from "@/lib/store";
import { syncUserToPanel } from "@/lib/subscription-sync";
import { verifyBotApiKey, unauthorizedResponse } from "../auth";
import { botSyncDisabledResponse } from "../sync-guard";

// Reject implausibly far-future dates from the bot (legacy 10-year bug).
const MAX_SUB_END_MS_AHEAD = 400 * 24 * 60 * 60 * 1000;

/**
 * POST /api/bot/sync — action = "overwrite_site": set the site's
 * subscription end + plan from the bot (plan "none" or a date ≤ epoch
 * means revocation). Goes through the ledger and is pushed to the panel
 * right away (revocation → the panel user is DISABLED).
 */
export async function POST(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  const disabled = await botSyncDisabledResponse();
  if (disabled) return disabled;

  try {
    const body = await request.json();
    const { telegramId, action } = body;
    if (!telegramId || !action) {
      return NextResponse.json({ success: false, error: "telegramId and action required" }, { status: 400 });
    }
    if (action !== "overwrite_site") {
      return NextResponse.json({ success: false, error: "Unknown action. Use: overwrite_site" }, { status: 400 });
    }

    const user = await getUserByTelegramId(String(telegramId));
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found. Link Telegram first." }, { status: 404 });
    }

    const plan = typeof body.plan === "string" ? body.plan : null;
    const subscriptionEnd = body.subscriptionEnd ? new Date(body.subscriptionEnd) : null;
    if (!subscriptionEnd || isNaN(subscriptionEnd.getTime())) {
      return NextResponse.json({ success: false, error: "Valid subscriptionEnd required" }, { status: 400 });
    }

    const isRevocation = plan === "none" || subscriptionEnd.getTime() <= 0;
    if (!isRevocation && subscriptionEnd.getTime() > Date.now() + MAX_SUB_END_MS_AHEAD) {
      console.warn(`[BOT/SYNC] REJECTED overwrite: ${user.email} end=${subscriptionEnd.toISOString()} > now+400d`);
      return NextResponse.json(
        { success: false, error: "subscriptionEnd must be within 400 days from now", code: "sub_end_too_far" },
        { status: 400 }
      );
    }

    const newPlan = isRevocation ? "trial" : plan && ["trial", "basic", "plus"].includes(plan) ? plan : null;
    const end = isRevocation ? new Date() : subscriptionEnd;
    const result = await botOverwriteSubscription(user.id, end, newPlan, String(telegramId), { revocation: isRevocation });
    if (!result.ok) {
      // Общий ключ не укорачиваем (ТЗ 4.3): продление — только /api/bot/extend,
      // отзыв — plan "none". Срок сайта не меняется, в панель ничего не уходит.
      console.warn(`[BOT/SYNC] REJECTED overwrite: ${user.email} end=${end.toISOString()} < current=${result.currentEnd.toISOString()}`);
      await createAuditLog("sync.overwrite_rejected", `Bot→Site: end=${end.toISOString()} раньше текущего ${result.currentEnd.toISOString()} — не укорачиваем`, user.id, user.email);
      return NextResponse.json(
        {
          success: false,
          error: "subscriptionEnd is earlier than the current end; use plan \"none\" to revoke, /api/bot/extend to extend",
          code: "WOULD_SHORTEN",
          data: { subscriptionEnd: result.currentEnd.toISOString() },
        },
        { status: 409 }
      );
    }
    const updated = result.user;
    if (!updated) {
      return NextResponse.json({ success: false, error: "Failed to update" }, { status: 500 });
    }

    const sync = await syncUserToPanel(user.id);
    if (!sync.ok) console.warn(`[BOT/SYNC] ${user.email}: panel sync deferred — ${sync.reason} ${sync.panelError ?? ""}`);

    await createAuditLog("sync.overwrite", `Bot→Site: plan=${updated.subscriptionPlan}, end=${updated.subscriptionEnd}, panel=${sync.action}`, user.id, user.email);
    await createNotificationForUser(user.id, "Подписка синхронизирована", "Данные подписки обновлены из Telegram-бота.");

    return NextResponse.json({
      success: true,
      data: {
        userId: updated.id,
        email: updated.email,
        subscriptionEnd: updated.subscriptionEnd,
        subscriptionPlan: updated.subscriptionPlan,
        telegramLinked: updated.telegramLinked,
      },
    });
  } catch (err) {
    console.error("[BOT/SYNC] Error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
