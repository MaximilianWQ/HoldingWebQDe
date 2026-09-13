import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { botStartUrl, createTelegramLinkToken } from "@/lib/telegram-link-tokens";

/**
 * POST /api/user/telegram-link — one-time link to the bot (site first).
 * → { url: "https://t.me/<bot>?start=link_<token>" | null, startParam, expiresAt, botConfigured }
 * `url` is null when TELEGRAM_BOT_USERNAME is not set; the dashboard then
 * shows the /start command to send by hand.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUser(request);
    if (!auth) return NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 });
    const user = auth.user;
    if (user.telegramId) {
      return NextResponse.json({ success: false, error: "Telegram уже привязан", code: "ALREADY_LINKED" }, { status: 409 });
    }
    const limit = checkRateLimit(`tg-link-user:${user.id}`, 10, 10 * 60_000);
    if (!limit.allowed) {
      return NextResponse.json({ success: false, error: `Слишком часто. Повторите через ${limit.retryAfterSeconds} сек.` }, { status: 429 });
    }
    const t = await createTelegramLinkToken(user.id);
    const url = botStartUrl(t.startParam);
    return NextResponse.json({
      success: true,
      data: { url, startParam: t.startParam, expiresAt: t.expiresAt.toISOString(), botConfigured: !!url },
    });
  } catch (err) {
    console.error("[USER/TELEGRAM-LINK] error:", err);
    return NextResponse.json({ success: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
