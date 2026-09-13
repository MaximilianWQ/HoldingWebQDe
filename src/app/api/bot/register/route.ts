import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId, getOrCreateUser, updateUser, getUserById, getUserByEmail } from "@/lib/store";
import { syncUserToPanel } from "@/lib/subscription-sync";
import { verifyBotApiKey, unauthorizedResponse } from "../auth";
import { botSyncDisabledResponse } from "../sync-guard";

/**
 * POST /api/bot/register
 *
 * Bot calls this when a new user starts the bot and doesn't have a site account.
 * Creates a site account linked to the telegram_id. The trial goes through
 * the same eligibility checks as site sign-up (by email; the bot has no IP).
 *
 * Body: { telegramId: string, email?: string, referralCode?: string }
 */
export async function POST(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  const disabled = await botSyncDisabledResponse();
  if (disabled) return disabled;

  try {
    const { telegramId, email, referralCode } = await request.json();

    if (!telegramId) {
      return NextResponse.json({ success: false, error: "telegramId required" }, { status: 400 });
    }

    const existing = await getUserByTelegramId(String(telegramId));
    if (existing) {
      const end = new Date(existing.subscriptionEnd);
      const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
      const link = daysLeft > 0 ? existing.subscriptionUrl : null;
      return NextResponse.json({
        success: true,
        data: {
          userId: existing.id,
          email: existing.email,
          isNew: false,
          daysLeft,
          subscriptionEnd: existing.subscriptionEnd,
          vpnKey: link,
          subscriptionUrl: link,
          referralCode: existing.referralCode,
          subscriptionPlan: daysLeft > 0 ? (existing.subscriptionPlan || "trial") : "expired",
        },
      });
    }

    const userEmail = (typeof email === "string" ? email.trim().toLowerCase() : "") || `telegram_${telegramId}@tg.atlassecure.uk`;

    // An email the bot passes is not verified by anyone. Linking a Telegram
    // id to an EXISTING account by its email would hand that account (and,
    // through the Telegram sign-in, a session) to whoever typed the email.
    // Existing accounts are linked only by their link token (/api/bot/link).
    if (typeof email === "string" && email.trim()) {
      const taken = await getUserByEmail(userEmail);
      if (taken && taken.telegramId !== String(telegramId)) {
        console.warn(`[BOT/REGISTER] refused: email already belongs to a site account (TG:${telegramId})`);
        return NextResponse.json(
          {
            success: false,
            error: "Email already belongs to a site account. Link it with the token from the dashboard (/api/bot/link).",
            code: "EMAIL_TAKEN",
          },
          { status: 409 }
        );
      }
    }

    // No site bypass trial here: the bot gives its own trial traffic to `{telegram_id}`.
    const created = await getOrCreateUser(userEmail, referralCode || undefined, "telegram-bot", undefined, { bypassTrial: false });

    await updateUser(created.id, { telegramId: String(telegramId), telegramLinked: true });

    // The bot shows the link right away, so sync inline (failures stay queued).
    if (created.isNew && created.trialGranted) {
      const sync = await syncUserToPanel(created.id);
      if (!sync.ok) console.warn(`[BOT/REGISTER] ${userEmail}: panel sync deferred — ${sync.reason} ${sync.panelError ?? ""}`);
    }

    const user = (await getUserById(created.id)) ?? created;
    const end = new Date(user.subscriptionEnd);
    const daysLeft = Math.max(0, Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    console.log(`[BOT] Registered user ${userEmail} linked to TG:${telegramId} (trial ${created.trialGranted ? "granted" : `not granted: ${created.trialBlockedReason ?? "existing account"}`})`);

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        isNew: created.isNew,
        trialGranted: created.trialGranted,
        daysLeft,
        subscriptionEnd: user.subscriptionEnd,
        vpnKey: user.subscriptionUrl,
        subscriptionUrl: user.subscriptionUrl,
        referralCode: user.referralCode,
        telegramLinkToken: user.telegramLinkToken,
        subscriptionPlan: daysLeft > 0 ? (user.subscriptionPlan || "trial") : "expired",
      },
    });
  } catch (err) {
    console.error("[BOT] register error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
