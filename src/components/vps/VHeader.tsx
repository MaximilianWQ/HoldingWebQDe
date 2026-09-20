"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { HEAD_LINKS, WORK_HEAD_LINKS, MENU_LINKS, TRIAL, currentSection } from "./links";

/**
 * Шапка-островок: скруглённая стеклянная капсула над страницей.
 * Широкий экран — ссылки в «дорожке» с белой пилюлей под активным или
 * наведённым пунктом (пилюля плавно переезжает) и кнопка «Кабинет»/«Войти».
 * Телефон — круглая кнопка меню; меню — скруглённая карточка под капсулой
 * с затемнением фона. При прокрутке капсула уплотняется.
 */
export default function VHeader({ account = "guest", work = false }: { account?: "guest" | "member"; work?: boolean }) {
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
  const extra = currentSection(pathname);
  // На рабочих экранах — свой список, без «Главной» (см. WORK_HEAD_LINKS).
  const base = work ? WORK_HEAD_LINKS : HEAD_LINKS;
  const navLinks = extra && !base.some((l) => l.href === extra.href) ? [...base, extra] : base;
  const cabinet = account === "member"
    ? { href: "/dashboard", label: "Кабинет" }
    : { href: "/auth", label: "Войти" };

  return (
    <header className="v-head" ref={headRef}>
      <div className="v-head-in">
        <Logo />
        <nav className="v-nav" aria-label="Основная навигация" ref={navRef} onMouseLeave={toActive}>
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
          <Link href={cabinet.href} prefetch={false} className={`v-btn ${account === "member" ? "v-btn-dark" : "v-btn-primary"}`}>
            {cabinet.label}
          </Link>
        </div>
        <button
          type="button"
          className="v-burger"
          aria-expanded={open}
          aria-controls="v-menu"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          onClick={() => setOpen((o) => !o)}
        >
          <i aria-hidden><span /></i>
        </button>
      </div>
      <div className="v-menu-scrim" hidden={!open} onClick={() => setOpen(false)} aria-hidden />
      <nav id="v-menu" className="v-menu" hidden={!open} aria-label="Разделы сайта">
        <ul>
          {(work ? WORK_HEAD_LINKS : MENU_LINKS).map((l, i) => (
            <li key={l.href} style={{ ["--i" as string]: i }}>
              <Link href={l.href} aria-current={current(l.href)} onClick={() => setOpen(false)}>{l.label}</Link>
            </li>
          ))}
        </ul>
        <div className="v-menu-foot">
          {account === "guest" ? (
            <Link href="/auth" prefetch={false} className="v-btn v-btn-primary v-btn-block">Попробовать {TRIAL} бесплатно</Link>
          ) : null}
          <Link href={cabinet.href} prefetch={false} className={`v-btn v-btn-block ${account === "guest" ? "v-btn-soft" : "v-btn-dark"}`}>{cabinet.label}</Link>
        </div>
      </nav>
    </header>
  );
}
