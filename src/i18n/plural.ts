import { DEFAULT_LOCALE, type Locale } from "@/lib/locale";
import { plural } from "@/lib/ru-words";

/**
 * Форма слова после числа на языке страницы.
 *
 * Русскому нужно три формы («1 день, 2 дня, 5 дней»), английскому —
 * две. Словари хранят по три строки для обоих языков (у английского
 * третья повторяет вторую), потому что форма словарей обязана
 * совпадать: это то, чем TypeScript ловит забытый перевод.
 *
 * ПОЧЕМУ НЕ `Intl.PluralRules`. Он вернул бы категорию («one», «few»,
 * «many»), а строки всё равно пришлось бы держать в словаре — то есть
 * добавился бы слой, но не исчез ни один. Правило выбора формы для
 * русского уже написано и проверено в `ru-words.ts`.
 */
export function pluralize(locale: Locale, n: number, forms: string[]): string {
  const [one, few, many] = forms;
  if (locale === DEFAULT_LOCALE) return plural(n, [one, few, many]);
  return n === 1 ? one : few;
}

/** Число вместе со словом: «3 дня», "3 days". */
export function count(locale: Locale, n: number, forms: string[]): string {
  return `${n} ${pluralize(locale, n, forms)}`;
}
