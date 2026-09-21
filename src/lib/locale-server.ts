import { headers } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_HEADER, PATH_HEADER, isLocale, type Locale } from "./locale";

/**
 * Язык текущего запроса — для серверных компонентов и
 * `generateMetadata`.
 *
 * Отдельным файлом от `locale.ts`, потому что `next/headers` нельзя
 * импортировать в клиентском компоненте: сборка падает на самом
 * импорте, даже если функция не вызывается. Поэтому чистые функции
 * (адреса, префиксы) лежат в `locale.ts`, а чтение запроса — здесь.
 *
 * Префикс `/en` срезает middleware, оно же кладёт язык в заголовок.
 * Значение по умолчанию — русский: если заголовка нет (прямой вызов,
 * статическая отдача), страница выйдет русской, а не сломанной.
 */
export async function getLocale(): Promise<Locale> {
  const v = (await headers()).get(LOCALE_HEADER);
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

/**
 * Путь текущей страницы без префикса языка — для `alternates`.
 * Значение кладёт middleware; если его нет, считаем, что это корень:
 * пара ссылок на главную безобиднее отсутствующей пары.
 */
export async function getPath(): Promise<string> {
  const v = (await headers()).get(PATH_HEADER);
  return v && v.startsWith("/") ? v : "/";
}
