"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Logo from "./Logo";
import LangSwitch from "./LangSwitch";
import { currentSection, type VItem } from "./links";
import type { Locale } from "@/lib/locale";

/**
 * Шапка-островок: скруглённая стеклянная капсула над страницей.
 * Широкий экран — ссылки в «дорожке» с белой пилюлей под активным или
 * наведённым пунктом (пилюля плавно переезжает) и кнопка «Кабинет»/«Войти».
 * Телефон — круглая кнопка меню; меню — скруглённая карточка под капсулой
 * с затемнением фона. При прокрутке капсула уплотняется.
 *
 * ТЕКСТ ПРИХОДИТ ПРОПСАМИ, А НЕ ИЗ СЛОВАРЯ (21.09.2026). Компонент
 * клиентский: импортируй он словарь — в браузер уехали бы оба языка
 * целиком, и с каждой переведённой страницей этот груз рос бы. Подписи
 * разворачивает `VShell` на сервере, где язык запроса уже известен.
 * Адреса приходят с префиксом языка, поэтому сравнение с `pathname`
 * работает как прежде.
 */
export interface HeaderCopy {
  cabinet: string;
  login: string;
  menuOpen: string;
  menuClose: string;
  mainNav: string;
  siteSections: string;
  toHome: string;
  tryFree: string;
  switchLang: string;
}

export default function VHeader({
  account = "guest",
  locale,
  nav,
  menu,
  extra,
  copy,
  homeHref,
  cabinetHref,
}: {
  account?: "guest" | "member";
  locale: Locale;
  nav: VItem[];
  menu: VItem[];
  extra: VItem[];
  copy: HeaderCopy;
  homeHref: string;
  cabinetHref: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const headRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Уплотнение капсулы при прокрутке — один слушатель, атрибут без перерисовки React.
  useEffect(() => {
    const head = headRef.current;
    if (!head) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => head.toggleAttribute("data-scrolled", window.scrollY > 12));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); };
  }, []);

  const moveTo = useCallback((el: HTMLElement | null) => {
    const pill = pillRef.current;
    const nav = navRef.current;
    if (!pill || !nav) return;
    if (!el) { pill.style.opacity = "0"; return; }
    const n = nav.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    pill.style.width = `${r.width}px`;
    pill.style.transform = `translateX(${r.left - n.left}px)`;
    pill.style.opacity = "1";
  }, []);
  const toActive = useCallback(() => {
    const active = navRef.current?.querySelector<HTMLElement>('a[aria-current="page"]:not(.v-btn)') ?? null;
    moveTo(active);
  }, [moveTo]);
  useLayoutEffect(() => { toActive(); }, [pathname, toActive]);
  useEffect(() => {
    window.addEventListener("resize", toActive);
    return () => window.removeEventListener("resize", toActive);
  }, [toActive]);

  const current = (href: string) => (href === pathname ? "page" : undefined);
  // Открытый раздел, которого нет в узком списке шапки, показывается
  // отдельным пунктом — иначе на нём дорожка пустая и непонятно, где ты.
  const section = currentSection(pathname, [...nav, ...menu, ...extra], nav);
  const navLinks = section ? [...nav, section] : nav;
  const cabinet = account === "member"
    ? { href: cabinetHref, label: copy.cabinet }
    : { href: cabinetHref, label: copy.login };

  return (
    <header className="v-head" ref={headRef}>
      <div className="v-head-in">
        <Logo href={homeHref} home={copy.toHome} />
        <nav className="v-nav" aria-label={copy.mainNav} ref={navRef} onMouseLeave={toActive}>
          <span className="v-nav-pill" ref={pillRef} aria-hidden />
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={current(l.href)}
              onMouseEnter={(e) => moveTo(e.currentTarget)}
              onFocus={(e) => moveTo(e.currentTarget)}
              onBlur={toActive}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="v-head-cta">
          <LangSwitch locale={locale} label={copy.switchLang} />
          <Link href={cabinet.href} prefetch={false} className={`v-btn ${account === "member" ? "v-btn-dark" : "v-btn-primary"}`}>
            {cabinet.label}
          </Link>
        </div>
        <button
          type="button"
          className="v-burger"
          aria-expanded={open}
          aria-controls="v-menu"
          aria-label={open ? copy.menuClose : copy.menuOpen}
          onClick={() => setOpen((o) => !o)}
        >
          <i aria-hidden><span /></i>
        </button>
      </div>
      <div className="v-menu-scrim" hidden={!open} onClick={() => setOpen(false)} aria-hidden />
      <nav id="v-menu" className="v-menu" hidden={!open} aria-label={copy.siteSections}>
        <ul>
          {menu.map((l, i) => (
            <li key={l.href} style={{ ["--i" as string]: i }}>
              <Link href={l.href} aria-current={current(l.href)} onClick={() => setOpen(false)}>{l.label}</Link>
            </li>
          ))}
        </ul>
        <div className="v-menu-foot">
          {/* Переключатель языка на телефоне живёт в меню: в капсуле
              шапки рядом с круглой кнопкой меню для него нет места, а
              ужимать его до неразличимого — то же самое, что спрятать. */}
          <LangSwitch locale={locale} label={copy.switchLang} block />
          {account === "guest" ? (
            <Link href={cabinetHref} prefetch={false} className="v-btn v-btn-primary v-btn-block">{copy.tryFree}</Link>
          ) : null}
          <Link href={cabinet.href} prefetch={false} className={`v-btn v-btn-block ${account === "guest" ? "v-btn-soft" : "v-btn-dark"}`}>{cabinet.label}</Link>
        </div>
      </nav>
    </header>
  );
}
