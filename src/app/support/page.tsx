import Chars from "@/components/atlas/Chars";
import type { Metadata } from "next";
import Link from "next/link";
import AtlasShell from "@/components/atlas/AtlasShell";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { DEVICE_LIMIT, PLANS, formatRub } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";
import "./support-atlas.css";

/**
 * /support — лист 14 «Атлас-издания».
 *
 * Серверный компонент: у страницы нет состояния. Прежняя клиентская
 * версия держала `useRouter` ради одной кнопки «Назад» — её роль
 * выполняет шапка листа.
 *
 * Блоки:
 *   01 первый экран — заголовок буквами, одно главное действие
 *   02 куда написать — строки каналов, наведение переворачивает строку
 *   03 частые вопросы — <details>, раскрытие без скрипта
 *   04 финал — кобальтовая плита, одно действие
 *
 * Формы на этой странице нет и не было: обращение письмом — на /contact.
 * Сроки ответа здесь не называются: они не подтверждены регламентом
 * (COMPLIANCE-CHECK.md, «Срок ответа»).
 *
 * Весь моушн — support-atlas.css, раздел «Движение».
 */
export const metadata: Metadata = {
  title: "Поддержка и помощь с настройкой",
  description:
    "Не подключается, не открывается сайт, вопрос по оплате — поможем. Быстрее всего в Telegram. Ответы на частые вопросы: как подключить, сколько устройств, пробный период, цены.",
  alternates: { canonical: "/support" },
};

const TELEGRAM = "https://t.me/atlas_suppbot";
const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;
const DEVICE_WORD = plural(DEVICE_LIMIT, ["устройстве", "устройствах", "устройствах"]);
const COUNTRY_WORD = plural(COUNTRY_COUNT, ["страна", "страны", "стран"]);

const H1_A = "поможем";
const H1_B = "разобраться";

const CHANNELS: { name: string; value: string; note: string; href: string; external: boolean; icon: IconName }[] = [
  { name: "Telegram", value: "@atlas_suppbot", note: "Быстрее всего. Пишите в любое время", href: TELEGRAM, external: true, icon: "chat" },
  { name: "ВКонтакте", value: "vk.com/atlassecure", note: "Сообщество Atlas Secure", href: "https://vk.com/atlassecure", external: true, icon: "users" },
  { name: "Письмом", value: "форма обратной связи", note: "Если удобнее почта", href: "/contact", external: false, icon: "send" },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Как подключить?",
    a: (
      <>
        Откройте <Link href="/devices">страницу устройств</Link>, выберите своё — там три шага
        для iPhone, Android, Mac, Windows и телевизора. Ключ ждёт в личном кабинете.
      </>
    ),
  },
  {
    q: "Сколько устройств можно подключить?",
    a: <>Одна подписка работает на {DEVICE_LIMIT} {DEVICE_WORD}: телефон, ноутбук, планшет, телевизор.</>,
  },
  {
    q: "Можно попробовать бесплатно?",
    a: (
      <>
        Да, {TRIAL} без карты — достаточно <Link href="/auth">войти по почте</Link>. Автосписаний нет:
        не понравится — просто не продлевайте.
      </>
    ),
  },
  {
    q: "Сколько стоит?",
    a: (
      <>
        От {formatRub(PLANS.basic[1])} ₽ в месяц, при оплате за год — дешевле. Оба тарифа и цены за
        каждый срок — на <Link href="/pricing">странице тарифов</Link>.
      </>
    ),
  },
  {
    q: "Сайт всё равно не открывается",
    a: (
      <>
        Выключите и снова включите Atlas в приложении или выберите другую страну — их {COUNTRY_COUNT}.
        Не помогло — напишите в Telegram, какой сайт и на каком устройстве, разберёмся.
      </>
    ),
  },
  {
    q: `В какой стране сервер?`,
    a: <>{COUNTRY_COUNT} {COUNTRY_WORD} на выбор. Чем ближе сервер, тем быстрее; страну меняете сами в приложении.</>,
  },
  {
    q: "Как сменить устройство?",
    a: (
      <>
        Поставьте приложение на новое устройство и добавьте тот же ключ из кабинета — по шагам
        на <Link href="/devices">странице устройств</Link>.
      </>
    ),
  },
];

/** Переносит длинные адреса только по «@», «.» и «/» — никогда не рвёт
 *  слово посередине («secur|e»), как это делал `overflow-wrap: anywhere»
 *  на узкой карточке телефона (QA 16.09.2026). */
function Breakable({ text }: { text: string }) {
  const parts = text.split(/(?<=[@./])/);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 ? <wbr /> : null}
        </span>
      ))}
    </>
  );
}

function Words({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="a-word" style={{ ["--i" as string]: i }}>{w}</span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

export default function SupportPage() {
  return (
    <AtlasShell sheetNo="14" sheetTitle="Поддержка">
      <main id="main" className="a-main as">
        {/* ── 01 · Первый экран ──────────────────────────────────── */}
        <section className="a-sheet as-cover" data-sheet="14" data-title="Поддержка" aria-labelledby="as-title">
          <div className="a-field">
            <h1 id="as-title" className="as-h1" aria-label={`${H1_A} ${H1_B}`}>
              <span className="as-h1-line" aria-hidden><Chars text={H1_A} /></span>
              <span className="as-h1-line as-h1-2" aria-hidden><Chars text={H1_B} start={H1_A.length} /></span>
            </h1>

            <div className="as-cover-grid">
              <p className="a-lead a-settle" style={{ ["--i" as string]: 2 }}>
                Не подключается, не открывается сайт, вопрос по оплате — напишите нам.
                Быстрее всего отвечаем в Telegram.
              </p>
              <div>
                <div className="a-actions a-settle" style={{ ["--i" as string]: 3 }}>
                  <a href={TELEGRAM} target="_blank" rel="noopener noreferrer" className="a-btn a-btn-primary">
                    Написать в Telegram
                  </a>
                  <Link href="#faq" className="a-btn a-btn-quiet">Частые вопросы</Link>
                </div>
                <p className="as-live a-fine a-settle" style={{ ["--i" as string]: 4 }}>
                  <span className="as-dot a-idle" aria-hidden /> чат @atlas_suppbot
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── 02 · Куда написать ─────────────────────────────────── */}
        <section className="a-sheet as-channels-sheet" data-sheet="14" data-title="Куда написать" aria-labelledby="as-ch-title">
          <div className="a-field">
            <h2 id="as-ch-title" className="a-h2 a-settle">
              <span className="a-no">02</span>куда написать
            </h2>
            <ul className="as-channels">
              {CHANNELS.map((c, i) => {
                const inner = (
                  <>
                    <span className="as-ch-icon" aria-hidden><Icon name={c.icon} size={20} /></span>
                    <span className="as-ch-name a-wide">{c.name}</span>
                    <span className="as-ch-value"><Breakable text={c.value} /></span>
                    <span className="as-ch-note">{c.note}</span>
                    <span className="as-ch-go" aria-hidden><Icon name="arrow-right" size={22} /></span>
                  </>
                );
                return (
                  <li key={c.name} className="a-slide" style={{ ["--i" as string]: i, ["--dir" as string]: i % 2 ? 1 : -1 }}>
                    {c.external ? (
                      <a href={c.href} target="_blank" rel="noopener noreferrer" className="as-ch">
                        {inner}
                        <span className="b-sr"> (откроется в новой вкладке)</span>
                      </a>
                    ) : (
                      <Link href={c.href} className="as-ch">{inner}</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* ── 03 · Частые вопросы ────────────────────────────────── */}
        <section className="a-sheet as-faq-sheet" data-sheet="14" data-title="Частые вопросы" id="faq" aria-labelledby="as-faq-title">
          <div className="a-field">
            <h2 id="as-faq-title" className="a-h2 a-settle">
              <span className="a-no">03</span>частые вопросы
            </h2>
            <div className="as-faq">
              {FAQ.map((f, i) => (
                <details key={f.q} className="as-qa a-settle" style={{ ["--i" as string]: i + 1 }}>
                  <summary>
                    <span className="as-qa-no a-wide" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                    <span className="as-qa-q">{f.q}</span>
                    <span className="as-qa-mark" aria-hidden />
                  </summary>
                  <div className="as-qa-a">
                    <p>{f.a}</p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── 04 · Финал ─────────────────────────────────────────── */}
        <section className="a-sheet a-plate a-final as-final" data-sheet="14" data-title="Написать" aria-labelledby="as-final-title">
          <div className="a-field">
            <h2 id="as-final-title" className="a-h2">
              <span className="a-no">04</span>
              <Words text="не нашли ответ? спросите нас" />
            </h2>
            <p className="a-p a-settle" style={{ ["--i" as string]: 6 }}>
              Опишите, что происходит и на каком устройстве, — подскажем, что нажать.
            </p>
            <div className="a-actions a-settle" style={{ ["--i" as string]: 8 }}>
              <a href={TELEGRAM} target="_blank" rel="noopener noreferrer" className="a-btn a-btn-invert a-idle">
                Написать в Telegram
              </a>
            </div>
          </div>
        </section>
      </main>
    </AtlasShell>
  );
}
