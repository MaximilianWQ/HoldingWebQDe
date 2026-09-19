import { NextRequest, NextResponse } from "next/server";
import { verifyUserPassword } from "@/lib/store";
import { rateLimitLogin, rateLimitLoginEmail } from "@/lib/rate-limit";
import { clientIpFrom } from "@/lib/client-ip";
import { setSessionCookie, startSession } from "@/lib/session";

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 login attempts per 15 minutes per IP …
    const ip = clientIpFrom(request.headers);
    const limit = rateLimitLogin(ip || "unknown");
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: `Слишком много попыток. Повторите через ${limit.retryAfterSeconds} сек.` },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const email = body?.email;
    const password = body?.password;

    if (!email || !password || typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { success: false, error: "Email и пароль обязательны" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // … and 10 per 15 minutes per account, whatever the IP.
    const accountLimit = rateLimitLoginEmail(normalizedEmail);
    if (!accountLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Слишком много попыток. Повторите через ${accountLimit.retryAfterSeconds} сек. или войдите по коду из письма.` },
        { status: 429 }
      );
    }

    const user = await verifyUserPassword(normalizedEmail, password);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Неверный email или пароль" },
        { status: 401 }
      );
    }

    const { token } = await startSession(user.id, { ip, userAgent: request.headers.get("user-agent") , authMethod: "password" });
    const response = NextResponse.json({
      success: true,
      data: { userId: user.id, email: user.email },
    });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error("[AUTH] login failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { success: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
