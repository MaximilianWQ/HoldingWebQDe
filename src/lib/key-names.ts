/**
 * Два ключа подключения — имена и строки в одном месте (владелец,
 * 13.09.2026). Одинаковые в кабинете, на /devices, /add-device и в боте
 * (docs/bot/TZ_BOT_EMAIL_LINK.md, раздел 6).
 *
 *   ключ 1 — подписка (премиум): безлимитный трафик, основные серверы;
 *   ключ 2 — обход (bypass): отдельные улучшенные серверы, расходует
 *            гигабайты пакета (пробные 500 МБ или купленные пакеты).
 *
 * Два набора слов:
 *   guest  — публичный вид (гость на /devices, витрина): без «VPN» и
 *            «обход» — «Основной» / «Усиленный»;
 *   member — экраны только для вошедших (кабинет, /add-device,
 *            /subscribe, /devices с сессией): «VPN» и «Обход» можно —
 *            так понятнее.
 */

import { COUNTRY_COUNT } from "./locations";
import { plural } from "./ru-words";

export type KeyAudience = "guest" | "member";

const IN_COUNTRIES = `во всех ${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["стране", "странах", "странах"])}`;
const ALL_COUNTRIES = `все ${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["страна", "страны", "стран"])}`;

export interface KeyText {
  /** «Ключ 1 · Основной VPN» */
  title: string;
  /** «Основной VPN» — без номера. */
  name: string;
  /** Одна строка: что это за ключ. */
  text: string;
}

export const MAIN_KEY: Record<KeyAudience, KeyText> = {
  guest: { title: "Ключ 1 · Основной", name: "Основной", text: `Безлимитный трафик, основные серверы ${IN_COUNTRIES}.` },
  member: { title: "Ключ 1 · Основной VPN", name: "Основной VPN", text: `Безлимитный трафик, ${ALL_COUNTRIES}.` },
};

export const BYPASS_KEY: Record<KeyAudience, KeyText> = {
  guest: {
    title: "Ключ 2 · Усиленный",
    name: "Усиленный",
    text: "Отдельные улучшенные серверы на случай, когда основной подключается плохо. Расходует гигабайты пакета.",
  },
  member: {
    title: "Ключ 2 · Обход",
    name: "Обход",
    text: "Улучшенные серверы для обхода блокировок. Расходует гигабайты пакета.",
  },
};

/** Как переключаться между ключами в приложении — одна фраза. */
export const SWITCH_HINT: Record<KeyAudience, string> = {
  guest: "Если основной не подключается — выберите в приложении усиленный.",
  member: "Если основной VPN не подключается — выберите в приложении ключ «Обход».",
};

/** Покупка гигабайт для ключа 2 (оплата: пакет трафика). */
export const BUY_TRAFFIC_HREF = "/subscribe?product=traffic";
