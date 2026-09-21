import Link from "next/link";
import Logo from "./Logo";
import { FOOT_LINKS, FOOT_APPS, LEGAL, SUPPORT_TG, BRAND } from "./links";
import { SUPPORT_DESK } from "@/lib/contacts";
import { COUNTRY_COUNT, CITY_COUNT } from "@/lib/locations";
import { FOUNDED } from "@/lib/nav";
import { PLANS, formatRub } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { dict, fill } from "@/i18n";
import { count } from "@/lib/text/plural";
import { localeHref, type Locale } from "@/lib/locale";

/**
 * Подвал — чёрная плита.
 *
 * Полный (витрина). Владелец 18.09.2026: «низ сайта сделай как в прошлой
 * нашей версии, он очень понравился» — то есть подвал «Атлас-издания»:
 * знак, фраза пользы и главное действие слева, четыре колонки ссылок
 * справа, контурное имя во всю ширину, строка реквизитов. Здесь тот же
 * состав, набранный материалом корпуса VPS (белое поле, синие кнопки).
 *
 * Последний экран сайта — это ещё одна возможность начать: человек,
 * докрутивший до низа, ищет либо ответ, либо кнопку. Поэтому в подвале
 * стоят обе: действие и адрес поддержки.
 *
 * `slim` — рабочие экраны (кабинет, оплата, вход): только реквизиты и
 * документы, без разделов.
 *
 * Компонент серверный, поэтому словарь читает сам: в браузер он не
 * уезжает. Клиентская шапка получает подписи пропсами — см. `VShell`.
 */
export default function VFooter({ slim = false, locale }: { slim?: boolean; locale: Locale }) {
  const d = dict(locale);
  const to = (href: string) => localeHref(href, locale);
  const year = new Date().getFullYear();
  const span = year > FOUNDED ? `${FOUNDED}–${year}` : String(FOUNDED);

  const base = (
    <div className="v-foot-base">
      <p>© {span} {BRAND} · {d.footer.rights}</p>
      <p className="v-foot-legal">
        {LEGAL.map((l) => (
          <Link key={l.href} href={to(l.href)} prefetch={false}>{d.links[l.k]}</Link>
        ))}
      </p>
    </div>
  );

  if (slim) {
    return (
      <footer className="v-foot v-foot-slim">
        <div className="v-wrap">{base}</div>
      </footer>
    );
  }

  return (
    <footer className="v-foot">
      <div className="v-wrap">
        <div className="v-foot-top">
          <div className="v-foot-brand">
            <Logo href={to("/")} home={d.a11y.toHome} />
            <p className="v-foot-pitch">
              {d.footer.pitch} <span>{d.footer.claim}</span>
            </p>
            <div className="v-foot-cta">
              <Link href={to("/auth")} prefetch={false} className="v-btn v-btn-white">
                {fill(d.common.tryFree, { trial: count(locale, TRIAL_DAYS, d.units.day) })}
              </Link>
              <Link href={to("/pricing")} className="v-btn v-btn-ghost">
                {fill(d.common.pricingFrom, { price: formatRub(PLANS.basic[1]) })}
              </Link>
            </div>
            <p className="v-foot-support">
              {d.footer.askBefore}{" "}
              <a href={SUPPORT_TG.href} target="_blank" rel="noopener noreferrer">{SUPPORT_TG.handle}</a>{" "}
              {d.footer.orMail}{" "}
              <a href={`mailto:${SUPPORT_DESK.email}`}>{SUPPORT_DESK.email}</a>
            </p>
          </div>

          <nav className="v-foot-cols" aria-label={d.a11y.siteSections}>
            {FOOT_LINKS.map((group, i) => (
              <div key={group.title} style={{ ["--i" as string]: i }}>
                <p className="v-foot-group-title">{d.groups[group.title]}</p>
                <ul className="v-foot-links">
                  {group.links.map((l) => (
                    <li key={l.href}><Link href={to(l.href)} prefetch={false}>{d.links[l.k]}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <p className="v-foot-apps">
          {d.footer.worksIn} <b>{FOOT_APPS}</b> ·{" "}
          {fill(d.footer.serversIn, {
            countries: count(locale, COUNTRY_COUNT, d.units.countryIn),
            cities: count(locale, CITY_COUNT, d.units.city),
          })}
        </p>

        {/* Контурное имя во всю ширину — тот приём из прошлой версии,
            из-за которого низ сайта перестал выглядеть пустым. */}
        <div className="v-foot-word" aria-hidden>
          <p>atlas secure</p>
        </div>

        {base}
      </div>
    </footer>
  );
}
