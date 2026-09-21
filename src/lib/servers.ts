/**
 * Линейка выделенных серверов — единственный источник правды.
 *
 * ПОЧЕМУ ФАЙЛ ПОЯВИЛСЯ. Цены серверов были записаны прямо в разметке
 * страницы `/vds` — в четырёх местах сразу, тогда как цены подписки
 * живут в `plans.ts` и оттуда же берутся кассой. Два разных порядка
 * работы с ценой в одном проекте — это гарантированное расхождение
 * витрины с тем, что человек в итоге платит.
 *
 * ПОЧЕМУ ЛИНЕЙКА РАСТЁТ ПО ПОЛОСЕ, А НЕ ПО ПРОЦЕССОРУ. Разбор рынка
 * на 8 сентября 2026 (docs/01_VDS_MARKET.md):
 *
 *   32 ГБ, 6 ядер, порт 10 Гбит/с            ≈ $190/мес
 *   128 ГБ, 32 ядра Granite Rapids,
 *   но порт 1 Гбит/с (Hetzner EX131)          € 560,70/мес
 *   10 Гбит/с без учёта трафика (Leaseweb)   от ≈ $770/мес
 *
 * Вторая машина втрое мощнее и втрое дороже, а для сетевой нагрузки
 * хуже первой: узкое место — порт, а не ядра. Прежняя страница
 * предлагала четыре карточки, различавшиеся только моделью CPU, и
 * стартовала с $80 за 32-ядерный EPYC — цена ниже рынка примерно в
 * пять-семь раз.
 *
 * ЗАЩИТЫ ОТ АТАК ЗДЕСЬ НЕТ. У каждой ступени было своё поле `ddos`
 * («L3/L4», «L3/L4/L7», «расширенная»), и эта лестница была выдумана:
 * защита на всех наших серверах одна и та же (владелец, 19.09.2026).
 * Её имя и описание — `src/lib/protection.ts`.
 *
 * ЧТО ЗДЕСЬ ЕЩЁ НЕ ПРАВДА. Каждое поле, помеченное `confirm`, ждёт
 * подтверждения владельцем: себестоимость, реальные площадки, порог
 * fair use, срок выдачи и наличие компенсации в SLA. Эти строки
 * перечислены в COMPLIANCE-CHECK.md и на странице показываются как
 * требующие уточнения, а не как обещание.
 */

import type { Locale } from "./locale";

export type ServerId = "meridian" | "parallel" | "azimuth" | "zenith";

export interface ServerTier {
  id: ServerId;
  /** Имя по слоям атласа: чем выше слой, тем шире полоса. */
  name: string;
  /** Одна строка о том, для чего эта ступень. */
  role: string;
  /** То же по-английски — поле обязательное. */
  roleEn: string;
  /** Доллары в месяц. `from: true` — «от», конфигурация собирается. */
  usd: number;
  from?: boolean;
  /** Гарантированная полоса порта, Гбит/с — ось, по которой строится линейка. */
  portGbps: number;
  /** Трафик считается или нет. */
  meteredTraffic: boolean;
  cpu: string;
  cpuEn: string;
  ramGb: number;
  disks: string;
  disksEn: string;
  ip: string;
  ipEn: string;
  /** Поля, которые ещё не подтверждены владельцем. */
  confirm: string[];
  confirmEn: string[];
}

export const SERVERS: ServerTier[] = [
  {
    id: "meridian",
    name: "Meridian",
    role: "Один проект: сайт, база данных, панель управления",
    roleEn: "A single project: a site, a database, a control panel",
    usd: 300,
    portGbps: 1,
    meteredTraffic: false,
    cpu: "8–12 физических ядер",
    cpuEn: "8–12 physical cores",
    ramGb: 64,
    disks: "2 × 1,92 ТБ NVMe, зеркало",
    disksEn: "2 × 1.92 TB NVMe, mirrored",
    ip: "IPv4 + подсеть IPv6",
    ipEn: "IPv4 + an IPv6 subnet",
    confirm: ["поколение процессора", "порог fair use", "срок выдачи"],
    confirmEn: ["processor generation", "fair use threshold", "delivery time"],
  },
  {
    id: "parallel",
    name: "Parallel",
    role: "Проект с большим трафиком",
    roleEn: "A project with heavy traffic",
    usd: 550,
    portGbps: 10,
    meteredTraffic: true,
    cpu: "16–24 ядра",
    cpuEn: "16–24 cores",
    ramGb: 128,
    disks: "2 × 3,84 ТБ NVMe, зеркало",
    disksEn: "2 × 3.84 TB NVMe, mirrored",
    ip: "IPv4 + подсеть IPv6, до /29 опцией",
    ipEn: "IPv4 + an IPv6 subnet, up to /29 as an option",
    confirm: ["гарантированная полоса", "лимит трафика или 95-й перцентиль"],
    confirmEn: ["guaranteed bandwidth", "traffic cap or 95th percentile"],
  },
  {
    id: "azimuth",
    name: "Azimuth",
    role: "Полная скорость порта без учёта трафика",
    roleEn: "Full port speed with traffic unmetered",
    usd: 900,
    portGbps: 10,
    meteredTraffic: false,
    cpu: "32 ядра",
    cpuEn: "32 cores",
    ramGb: 256,
    disks: "4 × 3,84 ТБ NVMe, RAID 10",
    disksEn: "4 × 3.84 TB NVMe, RAID 10",
    ip: "IPv4 + подсеть IPv6, приватный VLAN",
    ipEn: "IPv4 + an IPv6 subnet, a private VLAN",
    confirm: ["доступность в конкретных площадках"],
    confirmEn: ["availability in specific data centres"],
  },
  {
    id: "zenith",
    name: "Zenith",
    role: "Собирается под задачу",
    roleEn: "Built to order",
    usd: 1800,
    from: true,
    portGbps: 25,
    meteredTraffic: false,
    cpu: "до 64 ядер, два сокета",
    cpuEn: "up to 64 cores, dual socket",
    ramGb: 1024,
    disks: "до 8 × NVMe, RAID 10",
    disksEn: "up to 8 × NVMe, RAID 10",
    ip: "по спецификации",
    ipEn: "to specification",
    confirm: ["доступность порта 25 Гбит/с", "сроки поставки железа"],
    confirmEn: ["availability of a 25 Gbit/s port", "hardware delivery times"],
  },
];

/** Нижняя граница линейки — число для витрины и метаданных. */
export const SERVER_ENTRY_USD = Math.min(...SERVERS.map((s) => s.usd));

/** Верхняя точка оси полосы — по ней строится шкала на странице. */
export const SERVER_MAX_GBPS = Math.max(...SERVERS.map((s) => s.portGbps));

export function formatUsd(n: number, locale: Locale = "ru"): string {
  return "$" + n.toLocaleString(locale === "ru" ? "ru-RU" : "en-US");
}

/** Характеристики ступени на языке страницы. */
export function serverText(s: ServerTier, locale: Locale) {
  return locale === "ru"
    ? { role: s.role, cpu: s.cpu, disks: s.disks, ip: s.ip, confirm: s.confirm }
    : { role: s.roleEn, cpu: s.cpuEn, disks: s.disksEn, ip: s.ipEn, confirm: s.confirmEn };
}

/**
 * За что отвечаем и что от нас не зависит.
 *
 * Разбор владельца 18.09.2026: прежний блок был «Гарантируем 3 / Не
 * гарантируем 2 / Уточняем 2», причём вторая колонка шла зачёркнутой,
 * а третья честно сообщала покупателю, что мы сами не знаем, есть ли
 * в нашем договоре компенсация. Позиция «названная граница»
 * (docs/02_BRAND.md) от этого не выигрывала: граница называется, чтобы
 * человеку было спокойнее, а не чтобы показать ему наши сомнения.
 *
 * Теперь две колонки и у каждой строки — объяснение, что это значит на
 * практике. Открытые вопросы (порог fair use, компенсация за простой)
 * ушли в COMPLIANCE-CHECK.md: до ответа их место там, а не на витрине.
 */
export interface GuaranteeItem {
  /** Короткая строка — что именно. */
  t: string;
  /** Одна фраза: что это значит для покупателя. */
  note: string;
}

type Guarantees = { own: GuaranteeItem[]; outside: GuaranteeItem[] };

export const GUARANTEES: Guarantees = {
  own: [
    {
      t: "Скорость порта",
      note: "Ту, что указана в конфигурации, — она ваша целиком и ни с кем не делится.",
    },
    {
      t: "Память и диски",
      note: "Объём и тип из карточки: не «до», не «в среднем», а ровно столько.",
    },
    {
      t: "Защиту от атак",
      note: "Enterprise Spectrum Protection стоит на каждом сервере линейки и входит в цену — доплачивать за неё не нужно.",
    },
    {
      t: "Срок выдачи",
      note: "Сервер выдаётся в срок с момента оплаты — он назван заранее, а не «в порядке очереди».",
    },
  ],
  outside: [
    {
      t: "Скорость до чужих сайтов и сервисов",
      note: "Она упирается в их сеть, а не в нашу. Наш участок пути — до нашего порта, и за него мы отвечаем.",
    },
    {
      t: "Работу вашего софта на сервере",
      note: "Что установите — ваше дело. С самим сервером и сетью поможем в любой момент.",
    },
  ],
};

/**
 * То же по-английски. Граница обязана называться одинаково на обоих
 * языках: это не украшение страницы, а то, что человек получает по
 * счёту.
 */
const GUARANTEES_EN: Guarantees = {
  own: [
    {
      t: "Port speed",
      note: "The one in the configuration — it is yours in full and shared with nobody.",
    },
    {
      t: "Memory and disks",
      note: "The amount and type from the card: not “up to”, not “on average”, but exactly that.",
    },
    {
      t: "Protection from attacks",
      note: "Enterprise Spectrum Protection is on every tier in the range and is included in the price — there is nothing extra to pay.",
    },
    {
      t: "Delivery time",
      note: "The server is delivered within the stated time from payment — a time named in advance, not “in the order of the queue”.",
    },
  ],
  outside: [
    {
      t: "Speed to other people's sites and services",
      note: "That depends on their network, not ours. Our stretch of the road runs to our port, and for that we answer.",
    },
    {
      t: "How your software runs on the server",
      note: "What you install is your business. With the server itself and the network we will help at any time.",
    },
  ],
};

export function guarantees(locale: Locale): Guarantees {
  return locale === "ru" ? GUARANTEES : GUARANTEES_EN;
}

/** Что смотреть в договоре — вместо колонки «уточняем» на витрине. */
export const CONTRACT_NOTE =
  "Порог справедливого использования и условия компенсации за простой прописаны в договоре — пришлём его до оплаты, спросите поддержку.";

const CONTRACT_NOTE_EN =
  "The fair use threshold and the terms of compensation for downtime are set out in the contract — " +
  "we will send it before you pay; just ask support.";

export function contractNote(locale: Locale): string {
  return locale === "ru" ? CONTRACT_NOTE : CONTRACT_NOTE_EN;
}

/** Скидки за срок. Сдержанные: «−70%» и таймеры запрещены. */
export const SERVER_TERMS: Array<{ months: number; discount: number }> = [
  { months: 1, discount: 0 },
  { months: 3, discount: 5 },
  { months: 6, discount: 8 },
  { months: 12, discount: 12 },
];
