import type { Metadata } from "next";
import LegalDoc, { legalDate, type LegalSection } from "../terms/LegalDoc";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { SUPPORT_DESK, TELEGRAM_SUPPORT } from "@/lib/contacts";
import { dict, fill, type Dict } from "@/i18n";
import { count } from "@/lib/text/plural";
import { rich } from "@/lib/text/rich";
import { getLocale } from "@/lib/locale-server";
import type { Locale } from "@/lib/locale";

/**
 * /privacy — Политика конфиденциальности, редакция 2.5 (владелец,
 * 19.09.2026; юрисдикция — Гонконг).
 *
 * ТЕКСТ СВЕРЕН С КОДОМ, А НЕ ПЕРЕПИСАН С ОБРАЗЦА. В присланном
 * черновике (он и сам просил это проверить) было четыре утверждения,
 * которые расходились с тем, как сервис устроен на самом деле:
 *
 *   1. «Объём трафика в привязке к Пользователю не собирается» — для
 *      ключа усиленных серверов объём считается: на нём живут пакеты
 *      трафика с лимитом в гигабайтах, и кабинет показывает остаток.
 *   2. «IP обрабатывается в моменте и не сохраняется в истории
 *      Аккаунта» — `users.registration_ip` хранится постоянно и по нему
 *      в админке ищутся мультиаккаунты, а `audit_logs` пишет IP к
 *      событиям входа и смены ключа.
 *   3. «Хэш пароля» как обязательное поле — пароль необязателен: вход
 *      по коду из письма, пароль и passkey — по желанию.
 *   4. Сроки вида «2 года после последнего входа» — автоматической
 *      очистки в коде нет. Сроки оставлены как обязательство, и в
 *      COMPLIANCE-CHECK.md заведена строка: автоочистку `audit_logs`
 *      и удаление данных по сроку нужно реализовать, иначе обещание
 *      ложное.
 *
 * Политика «не ведём журналов сетевой активности» при этом верна и
 * сохранена: адреса назначения, DNS-запросы и содержимое трафика не
 * записываются нигде.
 *
 * Служебный блок «сверка с практикой крупных сервисов» из черновика
 * на страницу не перенесён — это внутренняя заметка, её место не на
 * витрине (тот же принцип, что с колонкой «Уточняем» на /vds).
 *
 * ТЕКСТ — ТОЛЬКО В СЛОВАРЯХ (21.09.2026), как и на /terms. Здесь
 * остаётся вёрстка: порядок абзацев, списки, жирный ввод термина,
 * ссылки (разметка `[[/terms|…]]` разворачивается `rich()`). Дата
 * редакции и номер версии — по одному значению, формат выбирает язык.
 * Английская версия открывается оговоркой `legal.notice`: силу имеет
 * русский текст.
 */
const UPDATED = "2026-09-19";
const EFFECTIVE = "2026-09-19";
const VERSION = "2.7";

function sectionsOf(t: Dict["privacy"], locale: Locale): LegalSection[] {
  const p = (s: string) => rich(s, locale);
  const list = (items: readonly string[]) => (
    <ul className="al-list">
      {items.map((x) => (
        <li key={x}>{x}</li>
      ))}
    </ul>
  );
  /** Список «термин — расшифровка». У части пунктов 3.2 разделитель — двоеточие. */
  const defs = (items: readonly { term: string; def: string; dash?: boolean }[]) => (
    <ul className="al-list">
      {items.map((x) => (
        <li key={x.term}>
          <strong>{x.term}</strong>
          {x.dash === false ? ": " : " — "}
          {x.def}
        </li>
      ))}
    </ul>
  );

  return [
    {
      n: "01",
      t: t.s01.t,
      body: (
        <>
          <p>{t.s01.p11}</p>
          <p>{t.s01.p12}</p>
          <p>{p(t.s01.p13)}</p>
          <p>{t.s01.p14}</p>
          <p>{t.s01.p15}</p>
        </>
      ),
    },
    {
      n: "02",
      t: t.s02.t,
      body: (
        <>
          <p>{t.s02.p21}</p>
          {list(t.s02.l21)}
          <p>{t.s02.p22}</p>
          <p>{t.s02.p23}</p>
        </>
      ),
    },
    {
      n: "03",
      t: t.s03.t,
      body: (
        <>
          <p>{t.s03.p31}</p>
          {defs(t.s03.l31)}
          <p>{t.s03.p32}</p>
          {defs(t.s03.l32)}
          <p>{t.s03.p33}</p>
          <p>{t.s03.p34}</p>
          <p>{t.s03.p35}</p>
          <p>
            {t.s03.p37a} <strong>{t.s03.p37b}</strong>: {t.s03.p37c}
          </p>
          <p>{t.s03.p36}</p>
        </>
      ),
    },
    {
      n: "04",
      t: t.s04.t,
      body: (
        <>
          <p>{t.s04.p41}</p>
          {defs(t.s04.l41)}
          <p>{t.s04.p42}</p>
          <p>{t.s04.p43}</p>
          <p>{t.s04.p44}</p>
          <p>{t.s04.p45}</p>
        </>
      ),
    },
    {
      n: "05",
      t: t.s05.t,
      body: (
        <>
          <p>{t.s05.p51}</p>
          {list(t.s05.l51)}
          <p>{t.s05.p52}</p>
          <p>{t.s05.p53}</p>
          <p>{t.s05.p54}</p>
          <p>{t.s05.p55}</p>
          <p>{t.s05.p56}</p>
          <p>{t.s05.p57}</p>
        </>
      ),
    },
    {
      n: "06",
      t: t.s06.t,
      body: (
        <>
          <p>{t.s06.p61}</p>
          <p>{t.s06.p62}</p>
          <p>{t.s06.p63}</p>
          <p>{t.s06.p64}</p>
          <p>{t.s06.p65}</p>
          <p>{t.s06.p66}</p>
          <p>{t.s06.p67}</p>
          <p>{t.s06.p68}</p>
        </>
      ),
    },
    {
      n: "07",
      t: t.s07.t,
      body: (
        <>
          <p>{t.s07.p71}</p>
          <p>{t.s07.p72}</p>
          {defs(t.s07.l72)}
          <p>{t.s07.p73}</p>
          <p>{t.s07.p74}</p>
          <p>{t.s07.p75}</p>
          <p>{t.s07.p76}</p>
        </>
      ),
    },
    {
      n: "08",
      t: t.s08.t,
      body: (
        <>
          <p>{t.s08.p81}</p>
          <p>{t.s08.p82}</p>
        </>
      ),
    },
    {
      n: "09",
      t: t.s09.t,
      body: (
        <>
          <p>{t.s09.p91}</p>
          {list(t.s09.l91)}
          <p>{t.s09.p92}</p>
          <p>{t.s09.p93}</p>
          <p>{t.s09.p94}</p>
          <p>{t.s09.p95}</p>
        </>
      ),
    },
    {
      n: "10",
      t: t.s10.t,
      body: <p>{fill(t.s10.p101, { trial: count(locale, TRIAL_DAYS, dict(locale).units.day) })}</p>,
    },
    {
      n: "11",
      t: t.s11.t,
      body: (
        <>
          <p>{t.s11.p111}</p>
          <p>{t.s11.p112}</p>
        </>
      ),
    },
    {
      n: "12",
      t: t.s12.t,
      body: (
        <p>
          {p(
            fill(t.s12.p121, {
              email: SUPPORT_DESK.email,
              tgHref: TELEGRAM_SUPPORT.href,
              tgHandle: TELEGRAM_SUPPORT.handle,
            }),
          )}
        </p>
      ),
    },
  ];
}

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = dict(await getLocale()).privacy;
  return { title: meta.title, description: meta.description };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const d = dict(locale);
  const t = d.privacy;
  return (
    <LegalDoc
      sheetTitle={t.sheetTitle}
      title={t.title}
      meta={[
        <time key="u" dateTime={UPDATED}>
          {fill(d.legal.updated, { date: legalDate(UPDATED, locale) })}
        </time>,
        <time key="e" dateTime={EFFECTIVE}>
          {fill(d.legal.effective, { date: legalDate(EFFECTIVE, locale) })}
        </time>,
        fill(d.legal.version, { v: VERSION }),
      ]}
      notice={d.legal.notice}
      tocLabel={t.tocLabel}
      tocHead={d.legal.toc}
      sections={sectionsOf(t, locale)}
    />
  );
}
