/**
 * Согласия пользователя (решение владельца, 13.09.2026).
 *
 *   privacy   — обязательное при регистрации: политика конфиденциальности
 *               и условия. Храним момент и версию документа.
 *   marketing — необязательное, по умолчанию выключено: «Хочу получать
 *               новости и специальные предложения». Рекламные рассылки
 *               (email_campaigns.kind = 'marketing') уходят ТОЛЬКО тем, у
 *               кого marketing_consent_at IS NOT NULL AND
 *               marketing_opt_out_at IS NULL. Служебные — всем.
 *
 * Отписка по ссылке из письма — это setMarketingConsent(false, 'unsubscribe').
 * Колонки добавляет db.ts; сами функции работают внутри транзакции
 * вызывающего (или на пуле) — `c` может быть PoolClient, Pool или фейком.
 */

export const PRIVACY_POLICY_VERSION = "2026-09-13";

export type MarketingConsentSource = "signup" | "dashboard" | "bot" | "unsubscribe" | "admin";
export const MARKETING_CONSENT_SOURCES: readonly MarketingConsentSource[] = ["signup", "dashboard", "bot", "unsubscribe", "admin"];

export interface ConsentQueryable {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
}

/** Согласие с политикой и условиями (версия документа — на момент согласия). */
export async function recordPrivacyConsent(c: ConsentQueryable, userId: string, version: string = PRIVACY_POLICY_VERSION): Promise<void> {
  await c.query("UPDATE users SET privacy_consent_at = NOW(), privacy_consent_version = $2 WHERE id = $1", [userId, version]);
}

/**
 * Включить или выключить согласие на рекламные письма.
 *   on = true  → marketing_consent_at = NOW(), источник, отписка снимается;
 *   on = false → согласие снимается, marketing_opt_out_at = момент отказа
 *                (первый — повторный отказ его не сдвигает).
 * Возвращает changed = false, если состояние уже было таким.
 */
export async function setMarketingConsent(
  c: ConsentQueryable,
  userId: string,
  on: boolean,
  source: MarketingConsentSource
): Promise<{ changed: boolean }> {
  const r = on
    ? await c.query(
        `UPDATE users SET marketing_consent_at = NOW(), marketing_consent_source = $2, marketing_opt_out_at = NULL
         WHERE id = $1 AND (marketing_consent_at IS NULL OR marketing_opt_out_at IS NOT NULL)
         RETURNING id`,
        [userId, source]
      )
    : await c.query(
        `UPDATE users SET marketing_consent_at = NULL, marketing_consent_source = $2,
                marketing_opt_out_at = COALESCE(marketing_opt_out_at, NOW())
         WHERE id = $1 AND (marketing_consent_at IS NOT NULL OR marketing_opt_out_at IS NULL)
         RETURNING id`,
        [userId, source]
      );
  return { changed: r.rows.length > 0 };
}

/** Можно ли слать человеку рекламу — то же правило, что в SQL рассылок. */
export function canReceiveMarketing(u: { marketingConsentAt: unknown; marketingOptOutAt: unknown }): boolean {
  return u.marketingConsentAt != null && u.marketingOptOutAt == null;
}

export async function getMarketingConsent(c: ConsentQueryable, userId: string): Promise<{ on: boolean; consentAt: string | null; optOutAt: string | null } | null> {
  const r = await c.query("SELECT marketing_consent_at, marketing_opt_out_at FROM users WHERE id = $1", [userId]);
  const row = r.rows[0];
  if (!row) return null;
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return {
    on: canReceiveMarketing({ marketingConsentAt: row.marketing_consent_at, marketingOptOutAt: row.marketing_opt_out_at }),
    consentAt: iso(row.marketing_consent_at),
    optOutAt: iso(row.marketing_opt_out_at),
  };
}
