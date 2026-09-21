/**
 * Лестница кешбэка за приглашённых — единственный источник процентов.
 *
 * Раньше пороги и проценты жили внутри `store.ts`, который тянет за
 * собой пул базы: витрина не могла назвать «до 45%», не импортировав
 * половину серверного слоя, и число пришлось бы писать руками — то
 * есть завести второй источник правды о деньгах. Здесь только таблица,
 * `store.ts` считает по ней же.
 *
 * Условия: кешбэк с каждой оплаты приглашённого на баланс. Никаких
 * «+20 дней» — снято владельцем 12.09.2026.
 */

import type { Locale } from "./locale";

export interface LoyaltyTier {
  /** Имя ступени в кабинете. */
  tier: string;
  /** То же по-английски. Поле обязательное: новая ступень без имени на
   *  втором языке не соберётся. */
  tierEn: string;
  /** Процент кешбэка с оплат приглашённых. */
  percent: number;
  /** С какого числа оплативших приглашённых действует ступень. */
  from: number;
}

/** Ступени по возрастанию порога. */
export const LOYALTY_TIERS: readonly LoyaltyTier[] = [
  { tier: "Стартовый", tierEn: "Starter", percent: 10, from: 0 },
  { tier: "Продвинутый", tierEn: "Advanced", percent: 25, from: 25 },
  { tier: "Партнёр", tierEn: "Partner", percent: 45, from: 50 },
] as const;

/** Имя ступени на языке страницы. */
export function tierName(t: LoyaltyTier, locale: Locale): string {
  return locale === "ru" ? t.tier : t.tierEn;
}

/** Ступень, на которой человек с таким числом оплативших приглашённых. */
export function loyaltyTierFor(paidReferrals: number): LoyaltyTier {
  let found = LOYALTY_TIERS[0];
  for (const t of LOYALTY_TIERS) if (paidReferrals >= t.from) found = t;
  return found;
}

/** Следующая ступень или null на верхней. */
export function loyaltyNextTier(paidReferrals: number): LoyaltyTier | null {
  return LOYALTY_TIERS.find((t) => paidReferrals < t.from) ?? null;
}

/** Процент на старте — с первой же оплаты приглашённого. */
export const CASHBACK_START = LOYALTY_TIERS[0].percent;

/** Верхний процент — «до 45%» на витрине. */
export const CASHBACK_MAX = LOYALTY_TIERS[LOYALTY_TIERS.length - 1].percent;
