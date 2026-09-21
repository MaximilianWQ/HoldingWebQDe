import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { BRAND } from "@/components/vps/links";
import { DEVICE_LIMIT, PLANS, formatRub } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";
import "@/app/vps-info.css";

/**
 * /support — корпус Atlas Secure VPS (владелец, 17.09.2026: «очень
 * простой, очень приятный сайт стилистики Apple»).
 *
 * Серверный компонент без состояния: способы связи — те же ссылки,
 * что были на «Атлас-издании» (Telegram, ВКонтакте, форма письма),
 * частые вопросы раскрываются нативным `<details>` без скрипта.
 * Формы на этой странице нет и не было — письмо отправляется на
 * /contact.
 */
export const metadata: Metadata = {
  title: "Поддержка",
  description:
    `Свяжитесь с ${BRAND}: быстрее всего отвечаем в Telegram. Ответы на частые вопросы — подключение, устройства, пробный период, цены.`,
};

const TELEGRAM = "https://t.me/atlas_suppbot";
const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;
const DEVICE_WORD = plural(DEVICE_LIMIT, ["устройстве", "устройствах", "устройствах"]);

const CHANNELS: { name: string; note: string; href: string; external: boolean; icon: IconName; live?: boolean }[] = [
  { name: "Telegram", note: "Отвечаем быстрее всего", href: TELEGRAM, external: true, icon: "chat", live: true },
  { name: "ВКонтакте", note: "Сообщество Atlas Secure", href: "https://vk.com/atlassecure", external: true, icon: "users" },
  { name: "Письмом", note: "Форма обратной связи", href: "/contact", external: false, icon: "send" },
];

const FAQ: { q: string; a: React.ReactNode }[] = [
  {
    q: "Как подключить?",
    a: (
      <>
        Откройте <Link href="/devices" className="v-link">страницу устройств</Link>, выберите своё — три
        коротких шага, ключ ждёт в личном кабинете.
      </>
    ),
  },
  {
    q: "Сколько устройств можно подключить?",
    a: <>Одна подписка работает на {DEVICE_LIMIT} {DEVICE_WORD}.</>,
  },
  {
    q: "Можно попробовать бесплатно?",
    a: (
      <>
        Да, {TRIAL} без карты — достаточно войти по почте. Автосписаний нет: не понравится —
        просто не продлевайте.
      </>
    ),
  },
  {
    q: "Сколько стоит?",
    a: (
      <>
        От {formatRub(PLANS.basic[1])} ₽ в месяц. Все тарифы и цены — на{" "}
        <Link href="/pricing" className="v-link">странице тарифов</Link>.
      </>
    ),
  },
  {
    q: "Сайт всё равно не открывается",
    a: (
      <>
        Переключитесь на другую страну в приложении — их {COUNTRY_COUNT}. Не помогло — напишите в
        Telegram, какой сайт и на каком устройстве.
      </>
    ),
  },
  {
    q: "Как сменить устройство?",
    a: <>Поставьте приложение на новое устройство и добавьте тот же ключ из личного кабинета.</>,
  },
];

export default function SupportPage() {
  return (
    <VShell>
      <section className="v-section v-center v-glow" aria-labelledby="v-support-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="v-support-title" className="v-h1">
            Чем <span className="v-accent">помочь?</span>
          </h1>
          <p className="v-lead">Не подключается, вопрос по оплате — напишите нам. Быстрее всего отвечаем в Telegram.</p>
          <div className="v-actions">
            <a href={TELEGRAM} target="_blank" rel="noopener noreferrer" className="v-btn v-btn-primary">
              Написать в Telegram
              <span className="v-sr"> (откроется в новой вкладке)</span>
            </a>
            <Link href="#faq" className="v-btn v-btn-soft">Частые вопросы</Link>
          </div>
          <p className="vp-live-row"><span className="v-live" aria-hidden /> <b>Отвечаем сейчас</b> в Telegram</p>
        </div>
      </section>

      <section className="v-section v-reveal" style={{ paddingTop: 0 }} aria-label="Способы связи">
        <div className="v-wrap v-narrow">
          <div className="vp-channels">
            {CHANNELS.map((c) => {
              const inner = (
                <>
                  <span className="vp-channel-icon" aria-hidden><Icon name={c.icon} size={22} /></span>
                  <span className="vp-channel-main">
                    <b>{c.name}</b>
                    <span>{c.live ? <><span className="v-live" aria-hidden style={{ marginRight: 6 }} />{c.note}</> : c.note}</span>
                  </span>
                  <span className="vp-channel-go" aria-hidden><Icon name="arrow-right" size={20} /></span>
                </>
              );
              return c.external ? (
                <a key={c.name} href={c.href} target="_blank" rel="noopener noreferrer" className="v-card v-card-field vp-channel v-lift">
                  {inner}
                  <span className="v-sr"> (откроется в новой вкладке)</span>
                </a>
              ) : (
                <Link key={c.name} href={c.href} className="v-card v-card-field vp-channel v-lift">{inner}</Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="v-section v-center v-reveal" id="faq" aria-labelledby="v-faq-title">
        <div className="v-wrap v-narrow">
          <h2 id="v-faq-title" className="v-h2">Частые вопросы</h2>
          <div className="vp-faq">
            {FAQ.map((f) => (
              <details key={f.q} className="v-card v-card-field vp-faq-item">
                <summary>
                  <span className="vp-faq-q">{f.q}</span>
                  <span className="vp-faq-mark" aria-hidden><Icon name="chevron-down" size={16} /></span>
                </summary>
                <p className="vp-faq-a"><span>{f.a}</span></p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </VShell>
  );
}
