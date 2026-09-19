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
