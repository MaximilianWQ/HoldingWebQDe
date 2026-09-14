"use client";

import { useEffect } from "react";
import { registerScroller } from "@/components/brand/scroll-top";
import "@/app/smooth-scroll.css";

/**
 * Прокрутка на всех страницах корпуса: мягкое колесо и возврат на место
 * по «Назад» (владелец, 12.09.2026: «прокрутку намного мягче по сайту»,
 * затем «поправь прокрутку, есть косяки»).
 *
 * МЯГКОЕ КОЛЕСО. Lenis двигает саму страницу (window.scrollTo на каждом
 * кадре), поэтому всё, что считает шкала прокрутки — view()/scroll() в
 * CSS, закреплённые сцены, холсты HeroGL / LaptopScrub, —
 * получает уже сглаженную позицию. Только колесо и тачпад: на сенсоре
 * остаётся родная инерция системы (syncTouch выключен). reduced-motion и
 * ?static=1 — родная прокрутка, библиотека не грузится.
 *   · Вложенные прокручиваемые области (меню, шторка уведомлений, окна)
 *     прокручиваются сами: `prevent` отдаёт им колесо.
 *   · Окно, которое запирает страницу (`body { overflow: hidden }` —
 *     подробности cookie, уведомления, подсказка установки), останавливает
 *     и Lenis: иначе колесо крутило страницу под окном.
 *
 * ВОЗВРАТ ПО «НАЗАД». Браузер восстанавливает позицию до того, как
 * закреплённые сцены набрали высоту, и главная открывалась на трети пути
 * (замер: ушли с 12 354 — вернулись на 2 654, с Lenis и без). Позицию
 * запоминаем сами — перед переходом по ссылке и перед «Назад/Вперёд» — и
 * ставим после отрисовки новой страницы.
 */
const NESTED = ".a-index-panel, .ov-dialog-body, .ak-sheet-body, [data-lenis-prevent]";
const KEY = "atlas-scroll";

let popped = false;
let current = "";

const readMap = (): Record<string, number> => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
};
const remember = () => {
  if (!current) return;
  try {
    const map = readMap();
    map[current] = Math.round(window.scrollY);
    sessionStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* приватный режим — без возврата на место */
  }
};

if (typeof window !== "undefined") {
  // Слушатели на уровне модуля: страница, с которой уходим, уже
  // размонтирована к моменту, когда новая узнаёт о переходе.
  window.addEventListener("popstate", () => {
    remember();
    popped = true;
  });
  document.addEventListener(
    "click",
    (e) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (a && !a.getAttribute("href")?.startsWith("#")) remember();
    },
    true,
  );
  window.addEventListener("pagehide", remember);
}

export default function SmoothScroll() {
  useEffect(() => {
    current = location.pathname + location.search;
    const root = document.documentElement;
    let lenis: import("lenis").default | null = null;
    let cancelled = false;
    const timers: number[] = [];

    // Возврат по «Назад»: после отрисовки и ещё раз, когда догрузятся
    // картинки и сцены (высота могла вырасти).
    if (popped) {
      popped = false;
      const y = readMap()[current];
      if (y > 0) {
        const place = () => {
          if (Math.abs(window.scrollY - y) < 4) return;
          window.scrollTo({ top: y, behavior: "instant" });
          lenis?.scrollTo(y, { immediate: true, force: true });
        };
        requestAnimationFrame(() => requestAnimationFrame(place));
        timers.push(window.setTimeout(place, 350), window.setTimeout(place, 900));
      }
    }

    if (root.hasAttribute("data-static") || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return () => timers.forEach(clearTimeout);
    }

    let mo: MutationObserver | null = null;
    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      lenis = new Lenis({
        autoRaf: true,
        // Мягко, но без «ватного» опоздания за колесом (0,085 и 0,9
        // ощущались как задержка; 0,1 — «дёргающая, сделай чуть легче»,
        // владелец 14.09.2026): 0,12 — страница меньше тянется за колесом.
        lerp: 0.12,
        wheelMultiplier: 1,
        anchors: { offset: -72 },
        stopInertiaOnNavigate: true,
        prevent: (node) => !!node.closest?.(NESTED),
      });
      const l = lenis;
      registerScroller((y) => l.scrollTo(y, { immediate: true, force: true }));
      const sync = () => (document.body.style.overflow === "hidden" ? l.stop() : l.start());
      mo = new MutationObserver(sync);
      mo.observe(document.body, { attributes: true, attributeFilter: ["style"] });
      sync();
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      mo?.disconnect();
      if (lenis) {
        registerScroller(null);
        lenis.destroy();
      }
    };
  }, []);

  return null;
}
