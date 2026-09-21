import type { ReactNode } from "react";
import VHeader from "./VHeader";
import VFooter from "./VFooter";
import ToastProvider from "./Toast";
import { HEAD_LINKS, WORK_HEAD_LINKS, MENU_LINKS, EXTRA_SECTIONS, labelAll } from "./links";
import { dict, fill } from "@/i18n";
import { count } from "@/i18n/plural";
import { getLocale } from "@/lib/locale-server";
import { localeHref } from "@/lib/locale";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import "@/app/vps.css";

/**
 * Оболочка страницы корпуса Atlas Secure VPS.
 * `work` — рабочие экраны (вход, кабинет, оплата): короткий подвал,
 * в шапке «Кабинет» вместо «Войти», если человек внутри.
 *
 * ЯЗЫК ОПРЕДЕЛЯЕТСЯ ЗДЕСЬ, ОДИН РАЗ НА СТРАНИЦУ (21.09.2026). Оболочка
 * стоит на каждой странице витрины, поэтому именно она разворачивает
 * ключи разделов в слова и приклеивает к адресам префикс `/en`.
 * Шапка — клиентский компонент и получает готовое; подвал серверный и
 * читает словарь сам.
 */
export default async function VShell({
  children,
  work = false,
  account = "guest",
}: {
  children: ReactNode;
  work?: boolean;
  account?: "guest" | "member";
}) {
  const locale = await getLocale();
  const d = dict(locale);
  const to = (href: string) => localeHref(href, locale);
  const withLocale = (list: { label: string; href: string }[]) =>
    list.map((l) => ({ label: l.label, href: to(l.href) }));

  return (
    <div className="v">
      <ToastProvider>
        <a href="#main" className="b-skip">{d.a11y.skip}</a>
        <VHeader
          account={account}
          locale={locale}
          nav={withLocale(labelAll(d, work ? WORK_HEAD_LINKS : HEAD_LINKS))}
          menu={withLocale(labelAll(d, work ? WORK_HEAD_LINKS : MENU_LINKS))}
          extra={withLocale(labelAll(d, EXTRA_SECTIONS))}
          homeHref={to("/")}
          cabinetHref={to(account === "member" ? "/dashboard" : "/auth")}
          copy={{
            cabinet: d.links.cabinet,
            login: d.links.login,
            menuOpen: d.a11y.menuOpen,
            menuClose: d.a11y.menuClose,
            mainNav: d.a11y.mainNav,
            siteSections: d.a11y.siteSections,
            toHome: d.a11y.toHome,
            tryFree: fill(d.common.tryFree, { trial: count(locale, TRIAL_DAYS, d.units.day) }),
            switchLang: locale === "ru" ? d.a11y.toEnglish : d.a11y.toRussian,
          }}
        />
        <main id="main">{children}</main>
        <VFooter slim={work} locale={locale} />
      </ToastProvider>
    </div>
  );
}
