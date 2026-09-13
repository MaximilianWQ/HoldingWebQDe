import { NextRequest, NextResponse } from "next/server";
import { startTelegramLogin, TG_LOGIN_COOKIE, TG_LOGIN_COOKIE_PATH, TG_LOGIN_TTL_MS } from "@/lib/telegram-login";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";
import { botStartUrl } from "@/lib/telegram-link-tokens";

/**
 * POST /api/auth/telegram-start — begin "sign in with Telegram".
 *
 * Creates a nonce bound to THIS browser (httpOnly cookie `tg_login`,
 * path /api/auth, 5 minutes). The page opens the bot with
 * `/start tglogin_<nonce>` and shows `confirmCode`; the bot shows the same
 * code and asks the person to confirm. Then the page polls
 * /api/auth/telegram-check?nonce=… .
 *
 * `botUrl` — botStartUrl (the main bot, env TELEGRAM_BOT_USERNAME overrides).
 */

export async function POST(request: NextRequest) {
  const ip = clientIpFrom(request.headers);
  const limit = checkRateLimit(`tg-start:${ip || "unknown"}`, 10, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: `Слишком много попыток. Повторите через ${limit.retryAfterSeconds} сек.` },
      { status: 429 }
    );
  }

  try {
    const s = await startTelegramLogin({ ip, userAgent: request.headers.get("user-agent") });
    const startParam = `tglogin_${s.nonce}`;

    const response = NextResponse.json({
      success: true,
      data: {
        nonce: s.nonce,
        startParam,
        botUrl: botStartUrl(startParam),
        confirmCode: s.confirmCode,
        expiresAt: s.expiresAt.toISOString(),
      },
    });
    response.cookies.set(TG_LOGIN_COOKIE, s.secret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: TG_LOGIN_COOKIE_PATH,
      maxAge: Math.floor(TG_LOGIN_TTL_MS / 1000),
    });
    return response;
  } catch (err) {
    console.error("[AUTH/TELEGRAM-START] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
