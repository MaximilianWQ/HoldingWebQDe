import { NextRequest, NextResponse } from "next/server";
import { claimTelegramLogin, TG_LOGIN_COOKIE, TG_LOGIN_COOKIE_PATH } from "@/lib/telegram-login";
import { setSessionCookie, startSession } from "@/lib/session";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";
import { createAuditLog } from "@/lib/store";

/**
 * GET /api/auth/telegram-check?nonce=XXX
 *
 * The site polls this after POST /api/auth/telegram-start. The session is
 * issued only to the browser that started the login (tg_login cookie)
 * and only once the bot has confirmed it (see src/lib/telegram-login.ts).
 * A nonce without the matching cookie always reads "pending": a stranger
 * polling someone else's nonce learns nothing and gets nothing.
 */
export async function GET(request: NextRequest) {
  const ip = clientIpFrom(request.headers);
  const limit = checkRateLimit(`tg-check:${ip || "unknown"}`, 90, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ success: false, error: "Слишком часто" }, { status: 429 });
  }

  try {
    const nonce = request.nextUrl.searchParams.get("nonce");
    if (!nonce) {
      return NextResponse.json({ success: false, error: "nonce required" }, { status: 400 });
    }

    const secret = request.cookies.get(TG_LOGIN_COOKIE)?.value ?? "";
    const claim = await claimTelegramLogin(nonce, secret);
    if (claim.status !== "ok") {
      return NextResponse.json({ success: false, status: claim.status === "invalid" ? "pending" : claim.status });
    }

    const { token } = await startSession(claim.userId, { ip, userAgent: request.headers.get("user-agent") , authMethod: "telegram" });
    await createAuditLog("user.login", "telegram", claim.userId, undefined, ip || undefined);

    const response = NextResponse.json({ success: true, data: { userId: claim.userId } });
    setSessionCookie(response, token);
    response.cookies.set(TG_LOGIN_COOKIE, "", { path: TG_LOGIN_COOKIE_PATH, maxAge: 0, httpOnly: true });
    return response;
  } catch (err) {
    console.error("[AUTH/TELEGRAM-CHECK] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ success: false, error: "Ошибка сервера" }, { status: 500 });
  }
}
