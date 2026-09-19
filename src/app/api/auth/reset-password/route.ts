import { NextRequest, NextResponse } from "next/server";
import { verifyCode, resetUserPassword, getUserByEmail } from "@/lib/store";
import { consumeResetToken } from "@/lib/reset-tokens";
import { passwordProblem } from "@/lib/password-policy";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIpKey } from "@/lib/client-ip";

/**
 * POST /api/auth/reset-password — новый пароль.
 *
 * Основной путь: `resetToken` из `/api/auth/reset-password/verify`
 * (код уже проверен сервером, токен одноразовый и привязан к почте).
 * Запасной путь для вкладок, открытых до обновления: `code` —
 * проверяется здесь же. Без одного из них пароль не меняется.
 *
 * Ответы нейтральные: по форме сброса нельзя узнать, зарегистрирована
 * ли почта.
 */
const FAIL = "Не удалось сменить пароль. Запросите новый код и попробуйте ещё раз.";

export async function POST(request: NextRequest) {
  try {
    // Предел на адрес (аудит 19.09.2026). Здесь его не было вовсе: и
    // подбор кода из письма, и перебор токена восстановления ничего
    // не стоили — в отличие от входа по паролю, где предел стоял.
    const rl = checkRateLimit(`reset:${clientIpKey(request.headers)}`, 20, 10 * 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: `Слишком много попыток. Повторите через ${rl.retryAfterSeconds} сек.` },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = body?.password;
    const resetToken = typeof body?.resetToken === "string" ? body.resetToken : "";
    const code = typeof body?.code === "string" ? body.code : "";

    if (!email || !password || (!resetToken && !code)) {
      return NextResponse.json({ success: false, error: "Все поля обязательны" }, { status: 400 });
    }
    // Требования те же, что при смене пароля в кабинете: единый
    // источник `password-policy.ts` (аудит 19.09.2026). Прежде здесь
    // хватало шести знаков — более слабое правило стояло на пути,
    // которым пользуется тот, кто добрался до чужой почты.
    const problem = passwordProblem(password);
    if (problem) {
      return NextResponse.json({ success: false, error: problem }, { status: 400 });
    }

    // Сначала — доказательство владения почтой (токен или код), потом
    // всё остальное: до проверки ничего не раскрываем.
    if (resetToken) {
      if (!consumeResetToken(resetToken, email)) {
        return NextResponse.json({ success: false, error: FAIL }, { status: 400 });
      }
    } else {
      const result = verifyCode(email, code);
      if (!result.valid) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json({ success: false, error: FAIL }, { status: 400 });
    }

    const ok = await resetUserPassword(email, password);
    if (!ok) {
      return NextResponse.json({ success: false, error: FAIL }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 });
  }
}
