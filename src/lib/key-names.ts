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
 *
 * С 21.09.2026 — ещё и два языка. Ограничение владельца о слове «VPN»
 * держится в обоих: на английской витрине его тоже нет, гость видит
 * “Main” и “Boosted”, а вошедший — “Main VPN” и “Bypass”.
 */

import type { Locale } from "./locale";
import { COUNTRY_COUNT } from "./locations";
import { plural } from "./ru-words";
import { pluralize } from "@/i18n/plural";

export type KeyAudience = "guest" | "member";

const IN_COUNTRIES = `во всех ${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["стране", "странах", "странах"])}`;
const ALL_COUNTRIES = `все ${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["страна", "страны", "стран"])}`;
const COUNTRIES_EN = `all ${COUNTRY_COUNT} ${pluralize("en", COUNTRY_COUNT, ["country", "countries", "countries"])}`;

export interface KeyText {
  /** «Ключ 1 · Основной VPN» */
  title: string;
  /** «Основной VPN» — без номера. */
  name: string;
  /** Одна строка: что это за ключ. */
  text: string;
}

type ByAudience = Record<KeyAudience, KeyText>;

const MAIN_RU: ByAudience = {
  guest: { title: "Ключ 1 · Основной", name: "Основной", text: `Безлимитный трафик, основные серверы ${IN_COUNTRIES}.` },
  member: { title: "Ключ 1 · Основной VPN", name: "Основной VPN", text: `Безлимитный трафик, ${ALL_COUNTRIES}.` },
};

const MAIN_EN: ByAudience = {
  guest: { title: "Key 1 · Main", name: "Main", text: `Unlimited traffic, main servers in ${COUNTRIES_EN}.` },
  member: { title: "Key 1 · Main VPN", name: "Main VPN", text: `Unlimited traffic, ${COUNTRIES_EN}.` },
};

const BYPASS_RU: ByAudience = {
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

const BYPASS_EN: ByAudience = {
  guest: {
    title: "Key 2 · Boosted",
    name: "Boosted",
    text: "Separate reinforced servers for when the main one connects badly. Uses up your pack's gigabytes.",
  },
  member: {
    title: "Key 2 · Bypass",
    name: "Bypass",
    text: "Reinforced servers for getting around blocks. Uses up your pack's gigabytes.",
  },
};

const SWITCH_RU: Record<KeyAudience, string> = {
  guest: "Если основной не подключается — выберите в приложении усиленный.",
  member: "Если основной VPN не подключается — выберите в приложении ключ «Обход».",
};

const SWITCH_EN: Record<KeyAudience, string> = {
  guest: "If the main one will not connect, pick the boosted key in the app.",
  member: "If the main VPN will not connect, pick the “Bypass” key in the app.",
};

export function mainKey(aud: KeyAudience, locale: Locale): KeyText {
  return (locale === "ru" ? MAIN_RU : MAIN_EN)[aud];
}
export function bypassKey(aud: KeyAudience, locale: Locale): KeyText {
  return (locale === "ru" ? BYPASS_RU : BYPASS_EN)[aud];
}
/** Как переключаться между ключами в приложении — одна фраза. */
export function switchHint(aud: KeyAudience, locale: Locale): string {
  return (locale === "ru" ? SWITCH_RU : SWITCH_EN)[aud];
}

/**
 * Русские имена без выбора языка — для писем, бота и админки: они
 * пишутся по-русски независимо от того, какой язык открыт на сайте.
 */
export const MAIN_KEY = MAIN_RU;
export const BYPASS_KEY = BYPASS_RU;
export const SWITCH_HINT = SWITCH_RU;

/** Покупка гигабайт для ключа 2 (оплата: пакет трафика). */
export const BUY_TRAFFIC_HREF = "/subscribe?product=traffic";
