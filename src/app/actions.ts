"use server";

import { generateCode, sendVerificationEmail } from "@/lib/email";
import { saveCode, userHasPassword } from "@/lib/store";
import { isDisposableEmail } from "@/lib/disposable-emails";
import { checkRateLimit, rateLimitByEmail, rateLimitByIp, rateLimitEmailDaily } from "@/lib/rate-limit";
import { completeEmailSignIn, DISPOSABLE_EMAIL_ERROR } from "@/lib/auth-flow";
import { getLocale } from "@/lib/locale-server";
import { clientIpFrom } from "@/lib/client-ip";
import { setSessionCookieInStore, startSession } from "@/lib/session";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export interface SendCodeState {
  success: boolean;
  error?: string;
  email?: string;
  hasPassword?: boolean;
}

/**
 * `next` из формы входа — путь этого же сайта или ничего (та же проверка,
 * что в src/app/auth/page.tsx). Открытого редиректа на чужой адрес нет.
 */
function safeNext(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.length > 512 || /[\u0000-\u001f\\]/.test(s)) return null;
  try {
    const u = new URL(s, "https://atlas.invalid");
    return u.origin === "https://atlas.invalid" ? u.pathname + u.search + u.hash : null;
  } catch {
    return null;
  }
}

async function clientIp(): Promise<string | null> {
  return clientIpFrom(await headers());
}

export async function sendCodeAction(
  _prev: SendCodeState,
  formData: FormData
): Promise<SendCodeState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const next = safeNext(formData.get("next"));

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Введите корректный email адрес" };
  }

  // Согласия (владелец, 13.09.2026): Политика и Условия — обязательно,
  // новости и предложения — по желанию. Выбор живёт до шага кода в
  // cookie рядом с pending_email: состояние страницы при переходе на
  // /auth?step=code может не пережить.
  const consentPrivacy = formData.get("privacy") === "1";
  const consentMarketing = formData.get("marketing") === "1";
  if (!consentPrivacy) {
    return { success: false, error: "Отметьте согласие с Политикой обработки персональных данных, чтобы продолжить." };
  }

  try {
    // Same limits as /api/auth/send-code: 5 per minute per IP, 3 codes per
    // 5 minutes and 15 per day per email.
    const ipLimit = rateLimitByIp((await clientIp()) || "unknown");
    if (!ipLimit.allowed) {
      return { success: false, error: `Слишком много запросов. Повторите через ${ipLimit.retryAfterSeconds} сек.` };
    }
    if (isDisposableEmail(email)) {
      return { success: false, error: DISPOSABLE_EMAIL_ERROR };
    }

    // If user already has a password, redirect to login instead of sending code
    const hasPassword = await userHasPassword(email);
    if (hasPassword) {
      return { success: false, hasPassword: true, email };
    }

    const emailLimit = rateLimitByEmail(email);
    if (!emailLimit.allowed) {
      return { success: false, error: `Код уже отправлен. Повторите через ${emailLimit.retryAfterSeconds} сек.` };
    }
    const dailyLimit = rateLimitEmailDaily(email);
    if (!dailyLimit.allowed) {
      return { success: false, error: "Слишком много кодов за сутки. Попробуйте завтра или напишите в поддержку." };
    }

    const code = generateCode();
    saveCode(email, code);

    const sent = await sendVerificationEmail(email, code);
    if (!sent) {
      return { success: false, error: "Не удалось отправить код. Попробуйте позже." };
    }

    // Set cookie so the code screen knows which email to verify
    const cookieStore = await cookies();
    cookieStore.set("pending_email", email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60, // 10 minutes (same as code TTL)
      path: "/",
    });
    cookieStore.set("pending_consent", consentMarketing ? "privacy,marketing" : "privacy", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60,
      path: "/",
    });
  } catch (err) {
    console.error("[AUTH] sendCodeAction failed:", err);
    return { success: false, error: "Ошибка сервера. Попробуйте позже." };
  }

  // Redirect to code step — works with and without JS
  redirect(next ? `/auth?step=code&next=${encodeURIComponent(next)}` : "/auth?step=code");
}

export interface VerifyCodeState {
  success: boolean;
  error?: string;
  needsPassword?: boolean;
}

export async function verifyCodeAction(
  _prev: VerifyCodeState,
  formData: FormData
): Promise<VerifyCodeState> {
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const refCode = (formData.get("ref") as string) || undefined;
  const fingerprint = (formData.get("fingerprint") as string) || undefined;
  const next = safeNext(formData.get("next"));
  const codeDigits = [];
  for (let i = 0; i < 6; i++) {
    codeDigits.push(formData.get(`code-${i}`) as string || "");
  }
  const code = codeDigits.join("");

  if (!email || code.length !== 6) {
    return { success: false, error: "Введите код из 6 цифр" };
  }

  let needsPassword = false;
  let isNewUser = false;

  try {
    const ip = await clientIp();
    // Code guesses per IP across all mailboxes (each code also burns after 5 misses).
    const verifyLimit = checkRateLimit(`verify:${ip || "unknown"}`, 30, 10 * 60_000);
    if (!verifyLimit.allowed) {
      return { success: false, error: `Слишком много попыток. Повторите через ${verifyLimit.retryAfterSeconds} сек.` };
    }

    // One shared path with /api/auth/verify-code: code check, user +
    // trial (anti-abuse inside), audit, panel sync request.
    // Согласия с шага почты (cookie pending_consent из sendCodeAction).
    const consentParts = ((await cookies()).get("pending_consent")?.value ?? "").split(",");
    const consent = { privacy: consentParts.includes("privacy"), marketing: consentParts.includes("marketing") };
    // Язык страницы входа — он же язык будущих писем.
    const result = await completeEmailSignIn({ email, code, referralCode: refCode, fingerprint, ip, consent, locale: await getLocale() });
    if (!result.ok) {
      return { success: false, error: result.error };
    }
    const user = result.user;
    needsPassword = !user.passwordHash;
    isNewUser = user.isNew;

    const hdrs = await headers();
    const { token } = await startSession(user.id, { ip, userAgent: hdrs.get("user-agent") , authMethod: "email_code" });
    await setSessionCookieInStore(token);
    // Clean up pending_email cookie
    const cookieStore = await cookies();
    cookieStore.delete("pending_email");
    cookieStore.delete("pending_consent");
  } catch (err) {
    console.error("[AUTH] verifyCodeAction failed:", err);
    return { success: false, error: "Ошибка сервера. Попробуйте позже." };
  }

  if (needsPassword) {
    return { success: true, needsPassword: true };
  }

  redirect(next ?? (isNewUser ? "/dashboard?welcome=1" : "/dashboard"));
}
