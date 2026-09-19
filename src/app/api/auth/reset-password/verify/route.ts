import { NextRequest, NextResponse } from "next/server";
import { verifyCode } from "@/lib/store";
import { issueResetToken } from "@/lib/reset-tokens";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpKey } from "@/lib/client-ip";

/**
 * POST /api/auth/reset-password/verify — шаг «код из письма» при сбросе
 * пароля. Проверяет код на сервере (попытки считаются, после пяти
 * неверных код сгорает) и обменивает верный код на одноразовый токен
 * смены пароля. Без токена шаг «новый пароль» не открывается.
 */
export async function POST(request: NextRequest) {
  try {
    // Предел на адрес (аудит 19.09.2026). Здесь его не было вовсе: и
    // подбор кода из письма, и перебор токена восстановления ничего
    // не стоили — в отличие от входа по паролю, где предел стоял.
    const rl = checkRateLimit(`reset-verify:${clientIpKey(request.headers)}`, 20, 10 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: `Слишком много попыток. Повторите через ${rl.retryAfterSeconds} сек.` },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body?.code === "string" ? body.code.replace(/\D/g, "") : "";

    if (!email || code.length !== 6) {
      return NextResponse.json({ success: false, error: "Введите код из 6 цифр" }, { status: 400 });
    }

    const result = verifyCode(email, code);
    if (!result.valid) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: { resetToken: issueResetToken(email) } });
  } catch {
    return NextResponse.json({ success: false, error: "Не удалось проверить код. Попробуйте ещё раз." }, { status: 500 });
  }
}
