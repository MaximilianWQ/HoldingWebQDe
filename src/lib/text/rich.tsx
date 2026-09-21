import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { localeHref, type Locale } from "@/lib/locale";

/**
 * Ссылка внутри переводимой строки.
 *
 * ЗАЧЕМ. Половина ответов в вопросах и часть сносок заканчиваются
 * ссылкой: «пошагово всё показано в инструкциях». Разрезать такую
 * фразу на три куска («до», ссылка, «после») — значит зашить в код
 * русский порядок слов: в английском ссылка встанет в другое место, и
 * перевод придётся подгонять под вёрстку вместо обратного.
 *
 * Поэтому строка в словаре несёт разметку `[[/devices|инструкциях]]`,
 * а переводчик волен двигать её куда нужно. Внешние адреса
 * (`https://`, `mailto:`) остаются обычным `<a>` и открываются в новой
 * вкладке; внутренние получают префикс языка.
 *
 * Разметка НАРОЧНО БЕДНАЯ — только ссылка. Жирный, курсив и списки в
 * строке словаря означали бы, что вёрстка переехала в текст.
 */
const RE = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

export function rich(text: string, locale: Locale): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    const [whole, href, label] = m;
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(
      href.startsWith("/") ? (
        <Link key={at} href={localeHref(href, locale)}>{label}</Link>
      ) : (
        <a key={at} href={href} target="_blank" rel="noopener noreferrer">{label}</a>
      )
    );
    last = at + whole.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.map((n, i) => <Fragment key={i}>{n}</Fragment>);
}
