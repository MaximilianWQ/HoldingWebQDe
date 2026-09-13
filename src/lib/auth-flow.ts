/**
 * Shared email sign-in: code check → user (with trial on creation) →
 * audit → welcome notification → panel sync request.
 *
 * Used by the server action (the UI) and by /api/auth/verify-code, so
 * there is exactly one trial path.
 */

import { TRIAL_DAYS } from "./brand-facts";
import { isDisposableEmail } from "./disposable-emails";
import { createAuditLog, createNotificationForUser, getOrCreateUser, getUserByEmail, NewUserResult, verifyCode } from "./store";
import { requestPanelSync } from "./subscription-sync";
import { requestBypassApply } from "./bypass-grants";
import { adoptVerifiedPanelAccount } from "./telegram-link";
import { plural } from "./ru-words";
import { pool } from "./db";
import { recordPrivacyConsent, setMarketingConsent } from "./consent";

export type SignInResult = { ok: true; user: NewUserResult } | { ok: false; error: string };

export const DISPOSABLE_EMAIL_ERROR = "Одноразовые email не поддерживаются. Используйте постоянный почтовый ящик.";

export async function completeEmailSignIn(input: {
  email: string;
  code: string;
  referralCode?: string;
  fingerprint?: string;
  ip: string | null;
  /** Отметки с шага почты: Политика (обязательная в UI) и рассылки (по желанию). */
  consent?: { privacy: boolean; marketing: boolean };
}): Promise<SignInResult> {
  const email = input.email.trim().toLowerCase();
  if (isDisposableEmail(email)) return { ok: false, error: DISPOSABLE_EMAIL_ERROR };

  const check = verifyCode(email, input.code);
  if (!check.valid) return { ok: false, error: check.error || "Неверный код" };

  // E (13.09.2026): no account yet, but the panel holds a key whose email
  // was proven through our Telegram link flow (marker
  // atlas-email-verified) → the new account takes that key, no trial.
  let adopted: NewUserResult | null = null;
  if (!(await getUserByEmail(email))) {
    adopted = await adoptVerifiedPanelAccount(email, { ip: input.ip }).catch((err) => {
      console.error("[AUTH] panel adoption failed — ordinary registration:", err instanceof Error ? err.message : err);
      return null;
    });
  }
  const user = adopted ?? (await getOrCreateUser(email, input.referralCode || undefined, input.ip || undefined, input.fingerprint || undefined));
  const wasAdopted = !!adopted && adopted.isNew;

  // Согласия (владелец, 13.09.2026): Политика — версия и момент отметки;
  // рассылки — только если человек сам отметил (снять — ссылкой в письме
  // или в кабинете). Сбой записи согласия не должен ломать вход.
  if (input.consent?.privacy) {
    await recordPrivacyConsent(pool, user.id).catch((err) =>
      console.error("[AUTH] privacy consent not recorded:", err instanceof Error ? err.message : err)
    );
  }
  if (input.consent?.marketing) {
    await setMarketingConsent(pool, user.id, true, "signup").catch((err) =>
      console.error("[AUTH] marketing consent not recorded:", err instanceof Error ? err.message : err)
    );
  }

  await createAuditLog(
    user.isNew ? "user.register" : "user.login",
    user.isNew
      ? wasAdopted
        ? "panel key adopted (atlas-email-verified), no trial"
        : user.trialGranted
          ? "trial granted"
          : `trial not granted: ${user.trialBlockedReason}`
      : undefined,
    user.id,
    user.email,
    input.ip || undefined
  );

  if (wasAdopted) {
    await createNotificationForUser(
      user.id,
      "Подписка подключена",
      "Мы нашли подписку, привязанную к этой почте через Telegram-бот, — она и её ключ теперь в кабинете."
    );
  } else if (user.isNew) {
    if (user.trialGranted) {
      await createNotificationForUser(
        user.id,
        "Добро пожаловать в Atlas Secure!",
        `Ваш пробный период активирован на ${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}. В личном кабинете доступен QR-код и кнопки для подключения в Happ и V2RayTun.`
      );
      // The panel users are created by the sync; do it now so the keys are
      // ready by the time the dashboard loads. Failures stay pending for
      // the worker. Two entities: the premium key (ST…) and the bypass
      // with the trial 500 MB (ST…_bp) — independent, separate locks.
      requestPanelSync(user.id, "signup");
      requestBypassApply(user.id, "signup");
    }
  }

  return { ok: true, user };
}
