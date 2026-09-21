import type { Metadata } from "next";
import Link from "next/link";
import VShell from "@/components/vps/VShell";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { BRAND } from "@/components/vps/links";
import { DEVICE_LIMIT, PLANS, formatRub } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { dict, fill } from "@/i18n";
import { count } from "@/lib/text/plural";
import { rich } from "@/lib/text/rich";
import { getLocale } from "@/lib/locale-server";
import { localeHref } from "@/lib/locale";
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
export async function generateMetadata(): Promise<Metadata> {
  const d = dict(await getLocale());
  return {
    title: d.support.meta.title,
    description: fill(d.support.meta.description, { brand: BRAND }),
  };
}

const TELEGRAM = "https://t.me/atlas_suppbot";

/**
 * Способы связи. Адрес и значок от языка не зависят, подпись и
 * пояснение берутся из словаря по тому же месту в списке.
 */
const CHANNELS: { href: string; external: boolean; icon: IconName; live?: boolean }[] = [
  { href: TELEGRAM, external: true, icon: "chat", live: true },
  { href: "https://vk.com/atlassecure", external: true, icon: "users" },
  { href: "/contact", external: false, icon: "send" },
];

export default async function SupportPage() {
  const locale = await getLocale();
  const d = dict(locale);
  const t = d.support;
  const to = (href: string) => localeHref(href, locale);
  const vars = {
    devices: count(locale, DEVICE_LIMIT, d.units.device),
    trial: count(locale, TRIAL_DAYS, d.units.day),
    price: formatRub(PLANS.basic[1], locale),
    countriesN: COUNTRY_COUNT,
  };
  const channels = CHANNELS.map((c, i) => ({ ...c, ...t.channels[i] }));
  return (
    <VShell>
      <section className="v-section v-center v-glow" aria-labelledby="v-support-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="v-support-title" className="v-h1">
            {t.title} <span className="v-accent">{t.titleAccent}</span>
          </h1>
          <p className="v-lead">{t.lead}</p>
          <div className="v-actions">
            <a href={TELEGRAM} target="_blank" rel="noopener noreferrer" className="v-btn v-btn-primary">
              {t.writeTg}
              <span className="v-sr">{t.newTab}</span>
            </a>
            <Link href="#faq" className="v-btn v-btn-soft">{t.faqLink}</Link>
          </div>
          <p className="vp-live-row"><span className="v-live" aria-hidden /> <b>{t.answering}</b> {t.answeringIn}</p>
        </div>
      </section>

      <section className="v-section v-reveal" style={{ paddingTop: 0 }} aria-label={t.channelsLabel}>
        <div className="v-wrap v-narrow">
          <div className="vp-channels">
            {channels.map((c) => {
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
                <a key={c.href} href={c.href} target="_blank" rel="noopener noreferrer" className="v-card v-card-field vp-channel v-lift">
                  {inner}
                  <span className="v-sr">{t.newTab}</span>
                </a>
              ) : (
                <Link key={c.href} href={to(c.href)} className="v-card v-card-field vp-channel v-lift">{inner}</Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="v-section v-center v-reveal" id="faq" aria-labelledby="v-faq-title">
        <div className="v-wrap v-narrow">
          <h2 id="v-faq-title" className="v-h2">{t.faqTitle}</h2>
          <div className="vp-faq">
            {t.faq.map((f) => (
              <details key={f.q} className="v-card v-card-field vp-faq-item">
                <summary>
                  <span className="vp-faq-q">{f.q}</span>
                  <span className="vp-faq-mark" aria-hidden><Icon name="chevron-down" size={16} /></span>
                </summary>
                <p className="vp-faq-a"><span>{rich(fill(f.a, vars), locale)}</span></p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </VShell>
  );
}
