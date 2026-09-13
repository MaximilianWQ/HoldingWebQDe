/**
 * Пакеты трафика («Обход» в кабинете и боте) — единственный источник.
 *
 * Отдельный продукт от подписки: ключ обхода (bypass-сущность панели)
 * живёт без срока (`expireAt` 2099), ограничен гигабайтами; купленный
 * пакет прибавляется к остатку (`trafficLimitBytes`, NO_RESET).
 * Цены — решение владельца 13.09.2026, те же, что в боте. Витрина,
 * оплата и админка берут числа только отсюда.
 *
 * На публичных страницах продукт называется «Пакеты трафика».
 */

export interface TrafficPack {
  /** Идентификатор пакета в платеже и журнале. */
  id: `gb${number}`;
  gb: number;
  /** Цена в рублях. */
  priceRub: number;
}

export const TRAFFIC_PACKS: readonly TrafficPack[] = [
  { id: "gb15", gb: 15, priceRub: 89 },
  { id: "gb50", gb: 50, priceRub: 269 },
  { id: "gb75", gb: 75, priceRub: 389 },
  { id: "gb100", gb: 100, priceRub: 469 },
  { id: "gb150", gb: 150, priceRub: 669 },
  { id: "gb200", gb: 200, priceRub: 859 },
  { id: "gb300", gb: 300, priceRub: 1199 },
  { id: "gb600", gb: 600, priceRub: 2299 },
  { id: "gb1000", gb: 1000, priceRub: 4399 },
  { id: "gb2000", gb: 2000, priceRub: 7899 },
  { id: "gb5000", gb: 5000, priceRub: 17999 },
] as const;

/** Пробный обход вместе с пробным периодом подписки (как в боте). */
export const TRAFFIC_TRIAL_MB = 500;

export const GB = 1024 ** 3;

export function trafficPackById(id: string): TrafficPack | undefined {
  return TRAFFIC_PACKS.find((p) => p.id === id);
}

/** Самый дешёвый пакет — для «от N ₽» на витрине. */
export const TRAFFIC_ENTRY_RUB = Math.min(...TRAFFIC_PACKS.map((p) => p.priceRub));
