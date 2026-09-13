import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId } from "@/lib/store";
import { unlinkTelegramAccount } from "@/lib/telegram-link";
import { verifyBotApiKey, unauthorizedResponse } from "../auth";
import { botSyncDisabledResponse } from "../sync-guard";

/**
 * POST /api/bot/unlink { telegramId }
 *
 * Unlinks Telegram from the site account. The subscription and the key
 * STAY with the site account (the panel user loses its telegramId and
 * gets the marker atlas-unlinked); the +7 bonus is never paid again.
 * After this the bot must treat the person as not linked and must NOT
 * adopt that key back (see docs/bot/TZ_BOT_EMAIL_LINK.md).
 */
export async function POST(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  const disabled = await botSyncDisabledResponse();
  if (disabled) return disabled;

  try {
    const body = await request.json().catch(() => null);
    const telegramId = body?.telegramId != null ? String(body.telegramId).trim() : "";
    if (!telegramId) {
      return NextResponse.json({ success: false, error: "telegramId required" }, { status: 400 });
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found or not linked", code: "NOT_LINKED" }, { status: 404 });
    }
    const r = await unlinkTelegramAccount(user.id, "bot");
    if (!r.ok) return NextResponse.json({ success: false, error: r.error, code: r.code }, { status: r.status });

    return NextResponse.json({
      success: true,
      data: {
        userId: r.user.id,
        email: r.user.email,
        unlinked: true,
        panelUserId: r.user.panelUserId,
        keyStaysWithAccount: true,
      },
    });
  } catch (err) {
    console.error("[BOT] Unlink error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
