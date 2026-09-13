import { NextRequest, NextResponse } from "next/server";
import { generateCode, sendVerificationEmail } from "@/lib/email";
import { saveCode } from "@/lib/store";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { rateLimitByIp, rateLimitByEmail, rateLimitEmailDaily } from "@/lib/rate-limit";
import { clientIpKey } from "@/lib/client-ip";

export async function POST(request: NextRequest) {
  try {
    // Rate limit by IP: 5 requests per minute
    const ipLimit = rateLimitByIp(clientIpKey(request.headers));
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Слишком много запросов. Повторите через ${ipLimit.retryAfterSeconds} сек.` },
        { status: 429 }
      );
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Введите корректный email" },
        { status: 400 }
      );
    }

    if (isDisposableEmail(email)) {
      return NextResponse.json(
        { success: false, error: "Одноразовые email не поддерживаются. Используйте постоянный почтовый ящик." },
        { status: 400 }
      );
    }

    const normalized = email.trim().toLowerCase();

    // Rate limit by email: 3 codes per 5 minutes, 15 per day
    const emailLimit = rateLimitByEmail(normalized);
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { success: false, error: `Код уже отправлен. Повторите через ${emailLimit.retryAfterSeconds} сек.` },
        { status: 429 }
      );
    }
    const dailyLimit = rateLimitEmailDaily(normalized);
    if (!dailyLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Слишком много кодов за сутки. Попробуйте завтра или напишите в поддержку." },
        { status: 429 }
      );
    }

    const code = generateCode();
    saveCode(normalized, code);

    const sent = await sendVerificationEmail(normalized, code);
    if (!sent) {
      return NextResponse.json(
        { success: false, error: "Не удалось отправить код. Попробуйте позже." },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ success: true });
    // «Отправить ещё раз» идёт сюда, а галочки согласия записал шаг почты
    // (sendCodeAction) в cookie на 10 минут. Новый код живёт 10 минут
    // от этой минуты — продлеваем и отметку, иначе при позднем вводе
    // согласие потеряется.
    const consent = request.cookies.get("pending_consent")?.value;
    if (consent === "privacy" || consent === "privacy,marketing") {
      response.cookies.set("pending_consent", consent, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/",
      });
    }
    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
