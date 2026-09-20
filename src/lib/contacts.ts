/**
 * Адреса компании — единственный источник (владелец, 18.09.2026).
 *
 * Раньше почты на сайте не было вовсе: страница контактов состояла из
 * одной формы, а Telegram поддержки был вписан руками в трёх местах.
 * Теперь адреса объявлены здесь, а страницы и подвал читают отсюда.
 *
 * Домен почты (`atlassecure.uk`) не совпадает с доменом сайта
 * (`qodev.dev`). Объяснение на странице контактов было и снято
 * владельцем 19.09.2026: оговорка привлекала внимание к расхождению,
 * которое посетитель сам бы не заметил. Сам вопрос остаётся в
 * COMPLIANCE-CHECK.md § 1 — решать его нужно доменом, а не сноской.
 */

export interface ContactDesk {
  /** Кому писать. */
  title: string;
  email: string;
  /** Что именно решает этот адрес — одна строка. */
  note: string;
}

export const SUPPORT_DESK: ContactDesk = {
  title: "Техническая поддержка",
  email: "support@atlassecure.uk",
  note: "Подключение, оплата, ключи — проекты Atlas Secure и QoDev",
};

export const SALES_DESK: ContactDesk = {
  title: "Отдел продаж",
  email: "sales@atlassecure.uk",
  note: "Выделенные серверы и инфраструктурные решения Atlas Secure",
};

export const DESKS: ContactDesk[] = [SUPPORT_DESK, SALES_DESK];

/** Поддержка в Telegram — тот же адрес, что на /support и в подвале. */
export const TELEGRAM_SUPPORT = { handle: "@atlas_suppbot", href: "https://t.me/atlas_suppbot" };

/**
 * Офис — единственный источник адреса (владелец, 20.09.2026).
 *
 * Адрес стоит на странице контактов и в заявке на пропуск. Писать его
 * руками во втором месте нельзя: у адреса есть свойство меняться, а
 * расхождение в адресе — это человек, приехавший не туда.
 */
export const OFFICE = {
  /** Как пишут на конверте и как ищут в карте — латиницей, одной строкой. */
  line: "17/F, Sun Life Tower, The Gateway, Harbour City, 21 Canton Road, Tsim Sha Tsui, Kowloon, Hong Kong",
  /** По частям — для вёрстки в несколько строк. */
  parts: [
    "17/F, Sun Life Tower, The Gateway",
    "Harbour City, 21 Canton Road",
    "Tsim Sha Tsui, Kowloon",
    "Hong Kong",
  ],
  /** Ближайшая станция метро — в Гонконге это первое, что спрашивают. */
  metro: "MTR Tsim Sha Tsui / East Tsim Sha Tsui",
  mapUrl: "https://maps.google.com/?q=" + encodeURIComponent("Sun Life Tower, The Gateway, Harbour City, 21 Canton Road, Tsim Sha Tsui, Hong Kong"),
} as const;

/**
 * Кем приходит гость. Список закрытый: он попадает в заявку на пропуск,
 * и свободный текст в поле, которое читает охрана бизнес-центра, не
 * нужен ни им, ни нам.
 */
export const VISITOR_ROLES = [
  { value: "employee", label: "Сотрудник" },
  { value: "head", label: "Руководитель" },
  { value: "partner", label: "Партнёр" },
  { value: "other", label: "Другое" },
] as const;

/**
 * Документ, который гость покажет на стойке.
 *
 * СОБИРАЕМ ТИП, А НЕ НОМЕР — и это намеренно. Номер паспорта или HKID
 * это чувствительные данные: их хранение пришлось бы объявлять в
 * Политике, защищать и удалять по сроку. Бизнес-центру номер заранее и
 * не нужен — документ проверяют на входе, а в заявке важно, чтобы имя
 * в пропуске совпало с именем в документе. Поэтому просим имя
 * латиницей и тип документа.
 */
export const VISITOR_DOCS = [
  { value: "passport", label: "Паспорт" },
  { value: "hkid", label: "HKID (удостоверение Гонконга)" },
] as const;
