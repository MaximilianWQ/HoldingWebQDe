import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId } from "@/lib/store";
import { confirmTelegramLogin, peekTelegramLogin } from "@/lib/telegram-login";
import { verifyBotApiKey, unauthorizedResponse } from "../auth";
import { maskEmail } from "@/lib/unsubscribe";

/**
 * POST /api/bot/auth-login  { telegramId, nonce }
 *
 * The bot confirms a "sign in with Telegram" request.
 *
 * Flow (see src/lib/telegram-login.ts):
 * 1. The site calls POST /api/auth/telegram-start → nonce bound to the
 *    browser, shows a 4-digit confirm code, opens the bot with
 *    /start tglogin_{nonce}.
 * 2. GET  — посмотреть, НЕ подтверждая: код и устройство, чтобы бот
 *    показал их человеку.
 * 3. POST — подтвердить, после того как человек нажал «Подтвердить».
 *    Подтвердить можно только тот ключ, который создал САЙТ, один раз
 *    и в течение пяти минут; создать или перепривязать ключ бот не может.
 *
 * ПОЧЕМУ ДВА ШАГА (разбор команды бота, 20.09.2026). Раньше был только
 * POST: он подтверждал вход и лишь потом возвращал четыре цифры. То
 * есть показать их человеку можно было только ПОСЛЕ того, как вход уже
 * разрешён, — а весь смысл цифр в том, чтобы он сверил их ДО. Иначе
 * одно нажатие «Старт» по присланной ссылке впускает чужого.
 * 4. The site polls /api/auth/telegram-check → session for that browser only.
 *
 * Errors: 404 NOT_LINKED (no site account for this Telegram id),
 *         404 NONCE_INVALID (unknown, expired or already used nonce).
 */

/**
 * GET /api/bot/auth-login?nonce=…&telegramId=…
 * Ничего не меняет: отдаёт код и устройство, чтобы бот показал их
 * человеку до подтверждения.
 */
export async function GET(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  try {
    const sp = request.nextUrl.searchParams;
    const nonce = sp.get("nonce");
    const telegramId = sp.get("telegramId");
    if (!nonce || !telegramId) {
      return NextResponse.json({ success: false, error: "telegramId and nonce required" }, { status: 400 });
    }
    const user = await getUserByTelegramId(String(telegramId));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found. Not linked to any site account.", code: "NOT_LINKED" },
        { status: 404 }
      );
    }
    const peek = await peekTelegramLogin(String(nonce));
    if (!peek) {
      return NextResponse.json(
        { success: false, error: "Login request not found, expired or already used.", code: "NONCE_INVALID" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      success: true,
      data: {
        // Адрес — маскированный: боту незачем знать его целиком.
        maskedEmail: maskEmail(user.email),
        confirmCode: peek.confirmCode,
        request: {
          ip: peek.requestIp,
          userAgent: peek.requestUserAgent,
          createdAt: peek.createdAt,
          expiresAt: peek.expiresAt,
        },
      },
    });
  } catch (err) {
    console.error("[BOT] auth-login peek error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();

  try {
    const { telegramId, nonce } = await request.json();

    if (!telegramId || !nonce) {
      return NextResponse.json({ success: false, error: "telegramId and nonce required" }, { status: 400 });
    }

    const user = await getUserByTelegramId(String(telegramId));

    if (!user) {
      return NextResponse.json({
        success: false,
        error: "User not found. Not linked to any site account.",
        code: "NOT_LINKED",
      }, { status: 404 });
    }

    const confirmed = await confirmTelegramLogin(String(nonce), user.id, String(telegramId));
    if (!confirmed) {
      return NextResponse.json({
        success: false,
        error: "Login request not found, expired or already used. Start the login on the site again.",
        code: "NONCE_INVALID",
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        // Полный адрес боту не отдаём (аудит 20.09.2026): для показа
        // человеку хватает маски, а бот и так знает свой Telegram ID.
        maskedEmail: maskEmail(user.email),
        confirmCode: confirmed.confirmCode,
        request: {
          ip: confirmed.requestIp,
          userAgent: confirmed.requestUserAgent,
          createdAt: confirmed.createdAt,
          expiresAt: confirmed.expiresAt,
        },
      },
    });
  } catch (err) {
    console.error("[BOT] auth-login error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
