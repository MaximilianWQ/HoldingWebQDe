/**
 * Локации сети — единственный источник правды.
 *
 * До этого список был продублирован в четырёх местах: секция локаций
 * на главной, бегущая строка под первым экраном, карточка статуса в
 * кабинете и метрика «страны присутствия» в герое. Любое расхождение
 * между ними означает, что на одной странице сайт обещает одно, а на
 * соседней — другое.
 *
 * ТРЕБУЕТ ПОДТВЕРЖДЕНИЯ ЭКСПЛУАТАЦИЕЙ (правило CLAUDE.md о числах):
 * состав стран задан владельцем сервиса, но города и задержки —
 * консервативные оценки: типовой RTT из Москвы до ближайшей точки
 * региона. Их нужно заменить фактическими замерами, как только
 * появится мониторинг. Число стран нигде не пишется руками — оно
 * считается из этого массива (COUNTRY_COUNT).
 *
 * Порядок — по возрастанию задержки: ближайшее к пользователю сверху.
 */

import type { Locale } from "./locale";
export interface Location {
  /** Двухбуквенная монограмма для кубика-марки. Не флаг: эмодзи-флаги
   *  по-разному рисуются в разных ОС. */
  code: string;
  country: string;
  /** То же по-английски. Поле ОБЯЗАТЕЛЬНОЕ: новая страна без имени на
   *  втором языке не соберётся, и английская версия сайта не покажет
   *  русское слово посреди списка. */
  countryEn: string;
  /** Городов может быть несколько — в США сеть разнесена по побережьям. */
  cities: string[];
  /** Те же города по-английски, в том же порядке. */
  citiesEn: string[];
  /** Ориентировочный RTT из Москвы, мс. */
  latencyMs: number;
  /** Координаты первого города — для карты присутствия. */
  lat: number;
  lon: number;
  /** Координаты остальных городов из `cities` (для глобуса главной). */
  more?: { city: string; lat: number; lon: number }[];
}

export const LOCATIONS: Location[] = [
  { code: "BY", country: "Беларусь", countryEn: "Belarus",
    cities: ["Минск"], citiesEn: ["Minsk"],
    latencyMs: 12, lat: 53.9, lon: 27.6 },
  { code: "FI", country: "Финляндия", countryEn: "Finland",
    cities: ["Хельсинки"], citiesEn: ["Helsinki"],
    latencyMs: 20, lat: 60.2, lon: 24.9 },
  { code: "PL", country: "Польша", countryEn: "Poland",
    cities: ["Варшава"], citiesEn: ["Warsaw"],
    latencyMs: 22, lat: 52.2, lon: 21.0 },
  { code: "DE", country: "Германия", countryEn: "Germany",
    cities: ["Франкфурт"], citiesEn: ["Frankfurt"],
    latencyMs: 24, lat: 50.1, lon: 8.7 },
  { code: "NL", country: "Нидерланды", countryEn: "Netherlands",
    cities: ["Амстердам"], citiesEn: ["Amsterdam"],
    latencyMs: 32, lat: 52.4, lon: 4.9 },
  { code: "RO", country: "Румыния", countryEn: "Romania",
    cities: ["Бухарест"], citiesEn: ["Bucharest"],
    latencyMs: 35, lat: 44.4, lon: 26.1 },
  { code: "CH", country: "Швейцария", countryEn: "Switzerland",
    cities: ["Цюрих"], citiesEn: ["Zurich"],
    latencyMs: 38, lat: 47.4, lon: 8.5 },
  { code: "AT", country: "Австрия", countryEn: "Austria",
    cities: ["Вена"], citiesEn: ["Vienna"],
    latencyMs: 38, lat: 48.2, lon: 16.4 },
  { code: "GB", country: "Британия", countryEn: "United Kingdom",
    cities: ["Лондон"], citiesEn: ["London"],
    latencyMs: 40, lat: 51.5, lon: -0.1 },
  { code: "FR", country: "Франция", countryEn: "France",
    cities: ["Париж"], citiesEn: ["Paris"],
    latencyMs: 45, lat: 48.9, lon: 2.4 },
  { code: "TR", country: "Турция", countryEn: "Turkey",
    cities: ["Стамбул"], citiesEn: ["Istanbul"],
    latencyMs: 45, lat: 41.0, lon: 29.0 },
  { code: "AM", country: "Армения", countryEn: "Armenia",
    cities: ["Ереван"], citiesEn: ["Yerevan"],
    latencyMs: 55, lat: 40.2, lon: 44.5 },
  { code: "KZ", country: "Казахстан", countryEn: "Kazakhstan",
    cities: ["Алматы"], citiesEn: ["Almaty"],
    latencyMs: 60, lat: 43.2, lon: 76.9 },
  { code: "IR", country: "Иран", countryEn: "Iran",
    cities: ["Тегеран"], citiesEn: ["Tehran"],
    latencyMs: 80, lat: 35.7, lon: 51.4 },
  { code: "AE", country: "ОАЭ", countryEn: "UAE",
    cities: ["Дубай"], citiesEn: ["Dubai"],
    latencyMs: 90, lat: 25.2, lon: 55.3 },
  { code: "US", country: "США", countryEn: "United States",
    cities: ["Нью-Йорк", "Лос-Анджелес", "Майами"], citiesEn: ["New York", "Los Angeles", "Miami"],
    latencyMs: 120, lat: 40.7, lon: -74.0,
    more: [{ city: "Лос-Анджелес", lat: 34.05, lon: -118.24 }, { city: "Майами", lat: 25.76, lon: -80.19 }] },
  { code: "JP", country: "Япония", countryEn: "Japan",
    cities: ["Токио"], citiesEn: ["Tokyo"],
    latencyMs: 130, lat: 35.7, lon: 139.7 },
  { code: "CN", country: "Китай", countryEn: "China",
    cities: ["Гонконг", "Шанхай"], citiesEn: ["Hong Kong", "Shanghai"],
    latencyMs: 150, lat: 22.3, lon: 114.2,
    more: [{ city: "Шанхай", lat: 31.23, lon: 121.47 }] },
  { code: "SG", country: "Сингапур", countryEn: "Singapore",
    cities: ["Сингапур"], citiesEn: ["Singapore"],
    latencyMs: 160, lat: 1.3, lon: 103.8 },
];

/** Название страны и её городов на языке страницы. */
export function countryName(l: Location, locale: Locale): string {
  return locale === "ru" ? l.country : l.countryEn;
}
export function cityNames(l: Location, locale: Locale): string[] {
  return locale === "ru" ? l.cities : l.citiesEn;
}

/** Число стран присутствия. Считается, а не пишется руками. */
export const COUNTRY_COUNT = LOCATIONS.length;

/**
 * Все города с серверами как точки: первый город страны плюс `more`.
 * `latencyMs` — страны (ориентир для порядка), `code` — страны.
 */
export const SERVER_POINTS: { code: string; city: string; lat: number; lon: number; latencyMs: number }[] =
  LOCATIONS.flatMap((l) => [
    { code: l.code, city: l.cities[0], lat: l.lat, lon: l.lon, latencyMs: l.latencyMs },
    ...(l.more ?? []).map((m) => ({ code: l.code, city: m.city, lat: m.lat, lon: m.lon, latencyMs: l.latencyMs })),
  ]);

/** Число точек: страна может нести несколько городов. */
export const CITY_COUNT = LOCATIONS.reduce((n, l) => n + l.cities.length, 0);

/** Ближайшая точка — она же значение по умолчанию в примерах интерфейса. */
export const CLOSEST = LOCATIONS[0];

/** Подпись задержки в интерфейсе: «24 мс». */
export function latencyLabel(l: Location): string {
  return `${l.latencyMs} мс`;
}

/** Города одной строкой: «Нью-Йорк · Лос-Анджелес · Майами». */
export function citiesLabel(l: Location): string {
  return l.cities.join(" · ");
}

/**
 * Города в узкой ячейке: «Нью-Йорк +2».
 *
 * Полный перечень трёх городов в строке шириной 260px обрезается
 * многоточием посреди названия — читатель видит «Лос…» и не узнаёт
 * ничего. Счётчик честнее: он сообщает, что городов больше, и не
 * врёт про их имена.
 */
export function citiesShort(l: Location): string {
  const [first, ...rest] = l.cities;
  return rest.length ? `${first} +${rest.length}` : first;
}

/** Склонение существительного при числе: 1 город, 2 города, 5 городов. */
export function plural(n: number, forms: [string, string, string]): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  const mod10 = n % 10;
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
