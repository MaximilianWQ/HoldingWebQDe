/**
 * Тарифы — единственный источник правды.
 *
 * До этого цены были продублированы в трёх местах: обработчик оплаты,
 * секция тарифов на главной и страница /pricing. Любое расхождение
 * между ними означает, что посетитель видит на витрине одну сумму, а в
 * кассе другую — то есть худший из возможных багов на платящем экране.
 *
 * Значения ниже — рубли за весь период (не за месяц).
 */

import type { Locale } from "./locale";

export const PERIODS = [1, 3, 6, 12] as const;
export type Period = (typeof PERIODS)[number];
export type PlanId = "basic" | "plus";

export const PLANS: Record<PlanId, Record<Period, number>> = {
  basic: { 1: 199, 3: 499, 6: 899, 12: 1599 },
  plus: { 1: 349, 3: 899, 6: 1499, 12: 2599 },
};

/**
 * Сколько дней подписки даёт оплаченный период (месяц = 30 дней) —
 * единственный источник для обработчика оплаты. Раньше таблица была
 * скопирована в пять файлов.
 */
export const PERIOD_DAYS: Record<Period, number> = { 1: 30, 3: 90, 6: 180, 12: 365 };

export function periodDays(period: number): number | null {
  return isPeriod(period) ? PERIOD_DAYS[period] : null;
}

export const PERIOD_LABEL: Record<Period, { full: string; short: string; accusative: string }> = {
  1: { full: "1 месяц", short: "1 мес", accusative: "месяц" },
  3: { full: "3 месяца", short: "3 мес", accusative: "три месяца" },
  6: { full: "6 месяцев", short: "6 мес", accusative: "полгода" },
  12: { full: "12 месяцев", short: "12 мес", accusative: "год" },
};

/**
 * Английские подписи сроков.
 *
 * ПОЧЕМУ ЗДЕСЬ, А НЕ В СЛОВАРЕ. Подпись срока неотделима от самого
 * срока: добавится период — его придётся назвать обоими языками в
 * одном месте, иначе один из них забудут. Тип общий с русским
 * (`typeof PERIOD_LABEL`), поэтому забытый ключ роняет сборку ровно
 * так же, как в словарях.
 *
 * `accusative` в английском не склоняется — это та же форма, что
 * `full`; поле оставлено ради общей формы записи.
 */
const PERIOD_LABEL_EN: typeof PERIOD_LABEL = {
  1: { full: "1 month", short: "1 mo", accusative: "1 month" },
  3: { full: "3 months", short: "3 mo", accusative: "3 months" },
  6: { full: "6 months", short: "6 mo", accusative: "6 months" },
  12: { full: "12 months", short: "12 mo", accusative: "a year" },
};

export function periodLabel(locale: Locale): typeof PERIOD_LABEL {
  return locale === "ru" ? PERIOD_LABEL : PERIOD_LABEL_EN;
}

/** Цена за месяц при выбранном периоде — то, что видит покупатель крупно. */
export function pricePerMonth(plan: PlanId, period: Period): number {
  return Math.round(PLANS[plan][period] / period);
}

/** Экономия против помесячной оплаты за тот же срок. */
export function savings(plan: PlanId, period: Period): number {
  return PLANS[plan][1] * period - PLANS[plan][period];
}

/** Скидка в процентах — для подписи на переключателе периода. */
export function discountPercent(plan: PlanId, period: Period): number {
  const base = PLANS[plan][1] * period;
  if (base === 0) return 0;
  return Math.round((savings(plan, period) / base) * 100);
}

export function formatRub(n: number, locale: Locale = "ru"): string {
  return n.toLocaleString(locale === "ru" ? "ru-RU" : "en-US");
}

/**
 * Дробное число на языке страницы: «6,6» против «6.6».
 *
 * Десятичная запятая в английском тексте читается как разделитель
 * разрядов — «6,6 ₽» выглядит как шестьдесят шесть. Поэтому цена за
 * день и за гигабайт форматируются отдельно от целых сумм.
 */
export function formatDecimal(n: number, locale: Locale, digits = 1): string {
  return n.toLocaleString(locale === "ru" ? "ru-RU" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Скорость канала на тарифе, Гбит/с — единственный источник этого
 * числа. Оно попадает и в первый экран, и в секцию «скорость канала»,
 * и в состав тарифа ниже: три места, которые обязаны говорить одно и
 * то же. Слово «магистраль» из публичного текста убрано — покупателю
 * оно ничего не сообщает.
 */
export const PLAN_SPEED: Record<PlanId, number> = {
  basic: 25,
  plus: 75,
};

/**
 * Сколько устройств можно держать на одной подписке — единственный
 * источник этого числа.
 *
 * На сайте стояло «безлимит устройств»: и в составе тарифа, и в
 * превью кабинета, и в ответах на /pricing. Это неверно и хуже, чем
 * просто неточность, — обещание, которое продукт не выполняет.
 */
export const DEVICE_LIMIT = 14;

/** Состав тарифов. Живёт рядом с ценами, чтобы витрина и касса не разъезжались. */
export const PLAN_CONTENT: Record<PlanId, { name: string; tagline: string; features: string[] }> = {
  basic: {
    name: "Basic",
    tagline: "Стабильное соединение для повседневного интернета",
    features: [
      "Канал 25 Гбит/с",
      "Надёжное шифрование",
      `До ${DEVICE_LIMIT} устройств`,
      "Сайт доступен всегда",
    ],
  },
  plus: {
    name: "Plus",
    tagline: "Приоритетный канал для игр, стримов и созвонов",
    features: [
      "Канал 75 Гбит/с — приоритет для игр и стримов",
      "Выделенные серверы в нескольких странах",
      "Резервные каналы — доступ работает всегда",
      "Всё из Basic",
    ],
  },
};

/**
 * То же по-английски. Имена тарифов не переводятся: Basic и Plus —
 * это имена, а не слова. Скорость внутри строки повторяет PLAN_SPEED
 * ниже; менять её надо в обоих языках сразу, поэтому они рядом.
 */
const PLAN_CONTENT_EN: typeof PLAN_CONTENT = {
  basic: {
    name: "Basic",
    tagline: "A steady connection for everyday internet",
    features: [
      "Carries 25 Gbit/s",
      "Strong encryption",
      `Up to ${DEVICE_LIMIT} devices`,
      "The site is always reachable",
    ],
  },
  plus: {
    name: "Plus",
    tagline: "A priority channel for games, streaming and calls",
    features: [
      "Carries 75 Gbit/s — priority for games and streaming",
      "Dedicated servers in several countries",
      "Backup routes — access keeps working",
      "Everything in Basic",
    ],
  },
};

export function planContent(locale: Locale): typeof PLAN_CONTENT {
  return locale === "ru" ? PLAN_CONTENT : PLAN_CONTENT_EN;
}

/**
 * Проверка значений, пришедших из тела запроса.
 *
 * Обработчик оплаты индексирует тарифную таблицу тем, что прислал
 * клиент. Без явной проверки это индексация нетипизированным значением:
 * ошибка в имени тарифа тихо превращалась бы в `undefined`, а сумма
 * платежа — в NaN. Поэтому обе величины сужаются здесь, а не на месте.
 */
export function isPlanId(v: unknown): v is PlanId {
  return v === "basic" || v === "plus";
}

export function isPeriod(v: unknown): v is Period {
  return typeof v === "number" && (PERIODS as readonly number[]).includes(v);
}
