import { NextRequest, NextResponse } from "next/server";
import { setUserPassword, verifyUserPassword } from "@/lib/store";
import { getSessionUser } from "@/lib/session";
import { revokeAllSessions } from "@/lib/session-store";
import { rateLimitLoginEmail } from "@/lib/rate-limit";
import { passwordProblem } from "@/lib/password-policy";

/**
 * A session that has just been opened by a code from the email is proof
 * of owning the mailbox — the "set a password after sign-in" step runs
 * inside this window. Later, REPLACING an existing password needs the
 * current one: a stolen session alone must not be able to lock the
 * owner out.
 */
const FRESH_SESSION_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const auth = await getSessionUser(request);
    if (!auth) {
      return NextResponse.json(
        { success: false, error: "Не авторизован" },
        { status: 401 }
      );
    }
    const user = auth.user;

    const body = await request.json().catch(() => null);
    const password = body?.password;
    const currentPassword = body?.currentPassword;

    // Требования к паролю — из общего источника `password-policy.ts`
    // (аудит 19.09.2026): то же правило действует при восстановлении.
    const problem = passwordProblem(password);
    if (problem) {
      return NextResponse.json({ success: false, error: problem }, { status: 400 });
    }

    const sessionAge = Date.now() - auth.session.createdAt.getTime();
    const freshEmailCode = auth.session.authMethod === "email_code" && sessionAge <= FRESH_SESSION_MS;
    if (user.passwordHash && !freshEmailCode) {
      const limit = rateLimitLoginEmail(user.email);
      if (!limit.allowed) {
        return NextResponse.json(
          { success: false, error: `Слишком много попыток. Повторите через ${limit.retryAfterSeconds} сек.` },
          { status: 429 }
        );
      }
      const ok = typeof currentPassword === "string" && currentPassword.length > 0 && !!(await verifyUserPassword(user.email, currentPassword));
      if (!ok) {
        return NextResponse.json(
          { success: false, error: "Введите текущий пароль или смените его через «Забыли пароль?»", code: "current_password_required" },
          { status: 403 }
        );
      }
    }

    const ok = await setUserPassword(user.id, password);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Не удалось сохранить пароль" },
        { status: 500 }
      );
    }

    // New password → every OTHER session of this account is signed out.
    await revokeAllSessions(user.id, auth.session.id).catch((err) =>
      console.error("[SET-PASSWORD] could not revoke other sessions:", err instanceof Error ? err.message : err)
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SET-PASSWORD] Error:", err);
    return NextResponse.json(
      { success: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
