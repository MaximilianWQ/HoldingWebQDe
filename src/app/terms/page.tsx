import type { Metadata } from "next";
import LegalDoc, { legalDate, type LegalSection } from "./LegalDoc";
import { TRIAL_DAYS, TELEGRAM_BONUS_DAYS } from "@/lib/brand-facts";
import { DEVICE_LIMIT } from "@/lib/plans";
import { LOYALTY_TIERS, tierName } from "@/lib/loyalty";
import { TRAFFIC_TRIAL_MB } from "@/lib/traffic-packs";
import { SUPPORT_DESK, TELEGRAM_SUPPORT } from "@/lib/contacts";
import { dict, fill, type Dict } from "@/i18n";
import { count, pluralize } from "@/i18n/plural";
import { rich } from "@/i18n/rich";
import { getLocale } from "@/lib/locale-server";
import type { Locale } from "@/lib/locale";

/**
 * /terms — Пользовательское соглашение, редакция 3.2 (владелец,
 * 19.09.2026: «обновляем соглашение, максимально под защиту нашего же
 * сервиса»; юрисдикция — Гонконг).
 *
 * ЧИСЛА БЕРУТСЯ ИЗ КОДА. Пробный период, бонус за Telegram, лимит
 * устройств и ступени кешбэка — из `src/lib`, как и на витрине.
 * Правовой документ, в котором срок или процент разошёлся с тарифом, —
 * это не опечатка, а расхождение оферты с фактом оказания услуги.
 *
 * ТЕКСТ — ТОЛЬКО В СЛОВАРЯХ (21.09.2026). Здесь остаётся вёрстка
 * документа: порядок абзацев и списков, жирный ввод термина, ссылки.
 * Ссылка внутри фразы записана в словаре разметкой `[[/privacy|…]]` и
 * разворачивается `rich()`: резать юридическую фразу на куски нельзя,
 * в английском ссылка встаёт в другое место.
 *
 * ДАТА И ВЕРСИЯ — здесь, в одном экземпляре. Формат выбирает язык
 * (`legalDate`), само значение одно на обе версии: разъехавшаяся дата
 * редакции в двух переводах одного документа — это два разных
 * документа.
 *
 * Английская версия открывается оговоркой `legal.notice`: русский
 * текст согласован и имеет силу, английский дан для удобства. У
 * русской версии эта строка пустая.
 *
 * ЧЕМ ЭТА РЕДАКЦИЯ ОТЛИЧАЕТСЯ ОТ ПРЕЖНЕЙ (3.1):
 *   · раздел 06 «Запрещённое использование» развёрнут до списка,
 *     которым можно обосновать блокировку, а не до трёх общих строк;
 *   · появился раздел 07 о личном характере подписки: передача,
 *     публикация ключей и перепродажа — главная причина, по которой
 *     сервис теряет деньги, и раньше он ею не закрывался;
 *   · появился раздел 08 о приостановке и блокировке с правом решать
 *     по данным собственного мониторинга;
 *   · появился раздел о пакетах трафика — второй продукт в прежней
 *     редакции не был описан вовсе;
 *   · прямо сказано, что автосписаний нет: это и обещание витрины, и
 *     защита от претензий «у меня списали без спроса».
 *
 * ОДНО ОТСТУПЛЕНИЕ ОТ ПРИСЛАННОГО ТЕКСТА. В черновике компенсация за
 * недоступность начислялась «автоматически». Автоматического начисления
 * в продукте нет, и обещать его в оферте — значит обещать то, чего мы
 * не делаем. Здесь компенсация предоставляется по обращению в течение
 * 30 дней; для Сервиса это даже безопаснее. Строка внесена в
 * COMPLIANCE-CHECK.md: появится автоматика — вернём формулировку.
 */
const UPDATED = "2026-09-19";
const EFFECTIVE = "2026-09-19";
const VERSION = "3.2";

function sectionsOf(t: Dict["terms"], locale: Locale): LegalSection[] {
  const p = (s: string) => rich(s, locale);
  const list = (items: readonly string[]) => (
    <ul className="al-list">
      {items.map((x) => (
        <li key={x}>{rich(x, locale)}</li>
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
          <p>{t.s01.p13}</p>
          <p>{t.s01.p14}</p>
          <ul className="al-list">
            {t.s01.defs.map((d) => (
              <li key={d.term}>
                <strong>{d.term}</strong> — {d.def}
              </li>
            ))}
          </ul>
          <p>{p(t.s01.p15)}</p>
          <p>{t.s01.p16}</p>
        </>
      ),
    },
    {
      n: "02",
      t: t.s02.t,
      body: (
        <>
          <p>{t.s02.p21}</p>
          <p>{t.s02.p22}</p>
          {list(t.s02.l22)}
          <p>{t.s02.p23}</p>
          <p>{t.s02.p24}</p>
          <p>{t.s02.p25}</p>
        </>
      ),
    },
    {
      n: "03",
      t: t.s03.t,
      body: (
        <>
          <p>{t.s03.p31}</p>
          <p>{t.s03.p32}</p>
          <p>{t.s03.p33}</p>
          <p>{t.s03.p34}</p>
          <p>{t.s03.p35}</p>
          <p>{t.s03.p36}</p>
          <p>{t.s03.p37}</p>
        </>
      ),
    },
    {
      n: "04",
      t: t.s04.t,
      body: (
        <>
          <p>{p(t.s04.p41)}</p>
          <p>
            {fill(t.s04.p42, {
              devices: `${DEVICE_LIMIT} ${pluralize(locale, DEVICE_LIMIT, t.deviceForms)}`,
            })}
          </p>
          <p>
            4.3. <strong>{t.s04.p43b}</strong> {t.s04.p43}
          </p>
          <p>{t.s04.p44}</p>
          {list(
            t.s04.l44.map((x) =>
              fill(x, {
                trial: count(locale, TRIAL_DAYS, dict(locale).units.day),
                tg: count(locale, TELEGRAM_BONUS_DAYS, dict(locale).units.day),
                mb: TRAFFIC_TRIAL_MB,
              }),
            ),
          )}
          <p>{t.s04.p45}</p>
          <ul className="al-list">
            {LOYALTY_TIERS.map((tier) => (
              <li key={tier.tier}>
                <strong>{tier.percent}%</strong> —{" "}
                {tier.from === 0 ? t.s04.loyaltyFirst : fill(t.s04.loyaltyFrom, { n: tier.from })} (
                {tierName(tier, locale)})
              </li>
            ))}
          </ul>
          <p>{t.s04.p46}</p>
          <p>{t.s04.p47}</p>
          <p>{t.s04.p48}</p>
          <p>{t.s04.p49}</p>
        </>
      ),
    },
    {
      n: "05",
      t: t.s05.t,
      body: (
        <>
          <p>{t.s05.p51}</p>
          <p>{t.s05.p52}</p>
          <p>{t.s05.p53}</p>
          <p>{t.s05.p54}</p>
          <p>{t.s05.p55}</p>
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
          {list(t.s06.l66)}
          <p>{t.s06.p67}</p>
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
          {list(t.s07.l72)}
          <p>{t.s07.p73}</p>
          {list(t.s07.l73)}
          <p>{t.s07.p74}</p>
          {list(t.s07.l74)}
          <p>{t.s07.p75}</p>
          {list(t.s07.l75)}
          <p>{t.s07.p76}</p>
          {list(t.s07.l76)}
          <p>{t.s07.p77}</p>
          {list(t.s07.l77)}
          <p>{t.s07.p78}</p>
          <p>{t.s07.p79}</p>
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
          {list(t.s08.l82)}
          <p>{t.s08.p83}</p>
          <p>{t.s08.p84}</p>
          <p>{t.s08.p85}</p>
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
          <p>{t.s09.p96}</p>
          <p>{t.s09.p97}</p>
          <p>{p(t.s09.p98)}</p>
        </>
      ),
    },
    {
      n: "10",
      t: t.s10.t,
      body: (
        <>
          <p>{t.s10.p101}</p>
          <p>{t.s10.p102}</p>
          <p>{t.s10.p103}</p>
          <p>{t.s10.p104}</p>
          <p>{t.s10.p105}</p>
        </>
      ),
    },
    {
      n: "11",
      t: t.s11.t,
      body: (
        <>
          <p>{t.s11.p111}</p>
          <p>{t.s11.p112}</p>
          {list(t.s11.l112)}
          <p>{t.s11.p113}</p>
          <p>{t.s11.p114}</p>
          <p>{t.s11.p115}</p>
          <p>{t.s11.p116}</p>
          <p>{t.s11.p117}</p>
        </>
      ),
    },
    {
      n: "12",
      t: t.s12.t,
      body: (
        <>
          <p>{t.s12.p121}</p>
          <p>{t.s12.p122}</p>
        </>
      ),
    },
    {
      n: "13",
      t: t.s13.t,
      body: (
        <>
          <p>{t.s13.p131}</p>
          <p>{t.s13.p132}</p>
          <p>{p(t.s13.p133)}</p>
          <p>{t.s13.p134}</p>
          <p>{t.s13.p135}</p>
          <p>{t.s13.p136}</p>
          <p>{t.s13.p137}</p>
        </>
      ),
    },
    {
      n: "14",
      t: t.s14.t,
      body: (
        <p>
          {p(
            fill(t.s14.p141, {
              tgHref: TELEGRAM_SUPPORT.href,
              tgHandle: TELEGRAM_SUPPORT.handle,
              email: SUPPORT_DESK.email,
            }),
          )}
        </p>
      ),
    },
  ];
}

export async function generateMetadata(): Promise<Metadata> {
  const { meta } = dict(await getLocale()).terms;
  return { title: meta.title, description: meta.description };
}

export default async function TermsPage() {
  const locale = await getLocale();
  const d = dict(locale);
  const t = d.terms;
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
