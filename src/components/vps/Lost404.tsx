"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import { TRIAL } from "./links";
import "@/app/not-found-404.css";

/**
 * Экран «страница не найдена» — разворот на две колонки: слева текст и
 * выход, справа объёмные цифры 404 (владелец, 19.09.2026: прислал
 * стоковую заставку с изометрическим «404» — «хочу примерно такую, но
 * переработай под наш дизайн»).
 *
 * ЧТО ВЗЯТО У РЕФЕРЕНСА: разворот «текст слева — объём справа»,
 * изометрия, пунктирная рамка вокруг сцены, мелкие квадраты вразброс,
 * средняя цифра другого цвета.
 *
 * ЧТО НЕ ВЗЯТО: чёрные мультяшные обводки, пазл и курсор-стрелка,
 * точки-слайдер внизу. Это язык стоковой иллюстрации, а корпус сайта —
 * Apple-подобный: белое поле, системный шрифт, синий только на
 * действии. Поэтому объём набран самим шрифтом страницы, а не рисунком:
 * цифра — стопка из DEPTH копий глифа, каждая глубже и темнее
 * предыдущей. Ни картинки, ни канваса, ни библиотеки: масштабируется
 * без размытия и весит ноль.
 *
 * Средняя цифра серая намеренно — она и есть то, чего не хватает.
 *
 * ДВИЖЕНИЕ. Сцена медленно качается сама (одно холостое движение на
 * экран) и доворачивается за курсором. Поворот пишется в переменные
 * --rx/--ry одним слушателем на сцену, значение считает rAF, React при
 * этом не перерисовывается. На грубом указателе слушателя нет вовсе,
 * при prefers-reduced-motion — тоже (общее правило корпуса гасит и
 * качание: `.v *` в разделе 14 vps.css).
 */
/* Двадцать шесть слоёв, а не шестнадцать: на шестнадцати боковая
 * грань шла заметной лесенкой. Шаг при этом уменьшен, общая глубина
 * прежняя. */
const DEPTH = 26;

function Digit({ ch, tone }: { ch: string; tone: "blue" | "grey" }) {
  return (
    <span className={`v4-d v4-d-${tone}`} aria-hidden>
      {Array.from({ length: DEPTH }, (_, k) => (
        <span key={k} className="v4-l" style={{ "--z": DEPTH - 1 - k } as CSSProperties}>
          {ch}
        </span>
      ))}
    </span>
  );
}

export default function Lost404() {
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let x = 0;
    let y = 0;
    const draw = () => {
      raf = 0;
      el.style.setProperty("--ry", `${x * 14}deg`);
      el.style.setProperty("--rx", `${y * -10}deg`);
    };
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      x = (e.clientX - r.left) / r.width - 0.5;
      y = (e.clientY - r.top) / r.height - 0.5;
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const onLeave = () => {
      x = 0;
      y = 0;
      if (!raf) raf = requestAnimationFrame(draw);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="v4" aria-labelledby="v4-title">
      <div className="v-wrap v4-grid">
        <div className="v4-text v-stagger">
          <span className="v4-kicker">Ошибка 404</span>
          <h1 id="v4-title" className="v-h1 v4-h1">
            Страница <span className="v4-accent">не найдена</span>
          </h1>
          <p className="v-lead v4-lead">
            Такого адреса на сайте нет: скорее всего, опечатка или страница переехала.
            Связь при этом в порядке — начните с главной.
          </p>
          <div className="v-actions v4-actions">
            <Link href="/" className="v-btn v-btn-primary">
              На главную
            </Link>
            <Link href="/pricing" className="v-btn v-btn-soft">
              Тарифы
            </Link>
          </div>
          <p className="v-small v4-note">
            {TRIAL} бесплатно, без карты. Не нашли нужное —{" "}
            <Link href="/support" className="v-link">
              напишите в поддержку
            </Link>
            .
          </p>
        </div>

        <div className="v4-scene" ref={stage} aria-hidden>
          <div className="v4-frame" />
          <div className="v4-float">
            <div className="v4-digits">
              <Digit ch="4" tone="blue" />
              <Digit ch="0" tone="grey" />
              <Digit ch="4" tone="blue" />
            </div>
            <i className="v4-dot v4-dot-1" />
            <i className="v4-dot v4-dot-2" />
            <i className="v4-dot v4-dot-3" />
            <i className="v4-dot v4-dot-4" />
            <i className="v4-dot v4-dot-5" />
          </div>
        </div>
      </div>
    </section>
  );
}
