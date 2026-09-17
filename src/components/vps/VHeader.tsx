"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "./Logo";
import { HEAD_LINKS, MENU_LINKS, TRIAL } from "./links";

/**
 * Шапка: знак и имя слева; на широком экране — ссылки и «Войти», на
 * телефоне — круглая серая кнопка меню. Меню — лист на всё окно под
 * шапкой, закрывается переходом, Esc и повторным нажатием.
 */
export default function VHeader({ account = "guest" }: { account?: "guest" | "member" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = (href: string) => (href === pathname ? "page" : undefined);
  const cabinet = account === "member"
    ? { href: "/dashboard", label: "Кабинет" }
    : { href: "/auth", label: "Войти" };

  return (
    <header className="v-head">
      <div className="v-wrap v-head-in">
        <Logo />
        <nav className="v-nav" aria-label="Основная навигация">
          {HEAD_LINKS.map((l) => (
            <Link key={l.href} href={l.href} aria-current={current(l.href)}>{l.label}</Link>
          ))}
          <Link href={cabinet.href} prefetch={false} className="v-btn v-btn-soft v-btn-sm v-head-login">
            {cabinet.label}
          </Link>
        </nav>
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
      <nav id="v-menu" className="v-menu" hidden={!open} aria-label="Разделы сайта">
        <ul>
          {MENU_LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={current(l.href)} onClick={() => setOpen(false)}>{l.label}</Link>
            </li>
          ))}
        </ul>
        <div className="v-menu-foot">
          {account === "guest" ? (
            <Link href="/auth" prefetch={false} className="v-btn v-btn-primary v-btn-block">Попробовать {TRIAL} бесплатно</Link>
          ) : null}
          <Link href={cabinet.href} prefetch={false} className="v-btn v-btn-soft v-btn-block">{cabinet.label}</Link>
        </div>
      </nav>
    </header>
  );
}
