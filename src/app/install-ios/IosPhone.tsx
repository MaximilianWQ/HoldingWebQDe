"use client";

import { useEffect, useRef } from "react";
import type { Dict } from "@/i18n";
import BrandMark from "@/components/pixel/BrandMark";

/**
 * iPhone 17 Pro Max с живым экраном для /install-ios (владелец, 13.09.2026:
 * «рендеры плавные, чтобы в инструкции постепенно анимировалось, что
 * делать на iPhone 17 Pro Max»).
 *
 * Корпус — рендер Blender public/media/ios/shell.webp (фронтальная орто-
 * камера, вырез экрана прозрачный; design/blender/iphone_shell.py и
 * iphone_shell_post.py). Экран — HTML/CSS ПОД корпусом: Safari iOS 26 над
 * снимком кабинета public/media/ios/dash.webp. Размеры экрана — в пунктах
 * iPhone (440 × 956), единица --u = 100cqw / 440, стили — ios-phone.css.
 *
 * Подписи внутри нарисованного Safari приходят пропсом `t`: словарь
 * клиентский компонент не импортирует, иначе в браузер уехали бы оба
 * языка. Английские строки в словаре — те, что показывает сама iOS,
 * а не перевод русских.
 *
 * Сцены 1–5 — шаги инструкции, каждая — петля на CSS-ключах (только
 * transform и opacity). Скрипт делает две вещи: включает data-play, пока
 * телефон в кадре и вкладка видна, и в режиме "tour" (первый экран) ведёт
 * сцены подряд. При prefers-reduced-motion data-play не ставится — видна
 * ключевая статичная картинка шага.
 */

type Scene = 1 | 2 | 3 | 4 | 5;
type T = Dict["installIos"]["phone"];

// Длительности петель — те же, что --D в ios-phone.css.
const DUR: Record<Scene, number> = { 1: 4400, 2: 4600, 3: 5400, 4: 4800, 5: 5200 };
// В туре следующая сцена начинается до сброса петли: на 88 % кадр
// предыдущей совпадает с началом следующей.
const CUT = 0.88;
const TOUR: Scene[] = [1, 2, 3, 4, 5];

const LAYERS: Record<Scene, ReadonlyArray<"menu" | "share" | "add" | "home">> = {
  1: ["menu"],
  2: ["menu", "share"],
  3: ["share"],
  4: ["share", "add"],
  5: ["home"],
};

const GLYPH = {
  share: "M12 3.5v11M8.3 7.2 12 3.5l3.7 3.7M8.5 10H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1.5",
  book: "M12 6.8C10.3 5.3 7.8 4.8 4 4.8v13.4c3.8 0 6.3.5 8 2 1.7-1.5 4.2-2 8-2V4.8c-3.8 0-6.3.5-8 2zM12 6.8v13.4",
  star: "M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8z",
  search: "M10.8 17.6a6.8 6.8 0 1 0 0-13.6 6.8 6.8 0 0 0 0 13.6zM15.8 15.8l4.7 4.7",
  plus: "M12 5v14M5 12h14",
  copy: "M9 10.5A1.5 1.5 0 0 1 10.5 9h8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 9 18.5zM15 6.5v-1A1.5 1.5 0 0 0 13.5 4h-8A1.5 1.5 0 0 0 4 5.5v8A1.5 1.5 0 0 0 5.5 15h1",
  glasses: "M3 13.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0zM14 13.5a3.5 3.5 0 1 0 7 0 3.5 3.5 0 0 0-7 0zM10 13c1.2-1 2.8-1 4 0",
  home: "M7 3.5h10A3.5 3.5 0 0 1 20.5 7v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5zM12 8v8M8 12h8",
  markup: "M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM9 15l1-3 4.5-4.5 2 2L12 14z",
  print: "M7 9V4h10v5M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2M7 14h10v6H7z",
  back: "M14.5 5 7.5 12l7 7",
  close: "M7 7l10 10M17 7 7 17",
} as const;

function G({ d }: { d: keyof typeof GLYPH }) {
  return (
    <svg className="iosp-g" viewBox="0 0 24 24">
      <path d={GLYPH[d]} />
    </svg>
  );
}

function Status({ light }: { light?: boolean }) {
  return (
    <div className={light ? "iosp-st is-w" : "iosp-st"}>
      <span>9:41</span>
      <svg className="iosp-st-i" viewBox="0 0 78 14">
        <rect x="0" y="9" width="3.2" height="4" rx="1" />
        <rect x="4.8" y="6.6" width="3.2" height="6.4" rx="1" />
        <rect x="9.6" y="4" width="3.2" height="9" rx="1" />
        <rect x="14.4" y="1.3" width="3.2" height="11.7" rx="1" />
        <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M27.6 8.8a4.8 4.8 0 0 1 6.8 0M25.2 6.3a8.2 8.2 0 0 1 11.6 0M22.8 3.8a11.6 11.6 0 0 1 16.4 0" />
          <rect x="46" y="1.5" width="25" height="11" rx="3.4" strokeWidth="1.1" opacity="0.45" />
        </g>
        <circle cx="31" cy="11.6" r="1.4" />
        <rect x="48" y="3.5" width="19" height="7" rx="1.8" />
        <rect x="72.6" y="5" width="1.7" height="4" rx="0.85" opacity="0.45" />
      </svg>
    </div>
  );
}

function AtlasIcon({ className }: { className: string }) {
  return (
    <span className={className}>
      <BrandMark size={24} />
    </span>
  );
}

function Web({ bar }: { bar: boolean }) {
  return (
    <div className="iosp-l iosp-web">
      <Status />
      <img className="iosp-page" src="/media/ios/dash.webp" alt="" width={880} height={1788} decoding="async" draggable={false} />
      {bar && (
        <div className="iosp-bar">
          <span className="iosp-btn iosp-glass"><G d="back" /></span>
          <span className="iosp-pill iosp-glass">qodev.dev</span>
          <span className="iosp-btn iosp-glass iosp-dots"><i /><i /><i /></span>
        </div>
      )}
      <i className="iosp-ind" />
    </div>
  );
}

function Menu({ t }: { t: T }) {
  return (
    <div className="iosp-menu iosp-glass">
      <div className="iosp-mrow is-t"><span className="iosp-hl" />{t.menuShare} <G d="share" /></div>
      <div className="iosp-sep" />
      <div className="iosp-mrow">{t.menuBookmark} <G d="book" /></div>
      <div className="iosp-mrow">{t.menuFavorite} <G d="star" /></div>
      <div className="iosp-mrow">{t.menuFind} <G d="search" /></div>
      <div className="iosp-sep" />
      <div className="iosp-mrow">{t.menuNewTab} <G d="plus" /></div>
    </div>
  );
}

function Share({ t }: { t: T }) {
  return (
    <div className="iosp-share">
      <div className="iosp-grab" />
      <div className="iosp-shd">
        <AtlasIcon className="iosp-ico" />
        <div className="iosp-shd-t">
          <b>{t.shareTitle}</b>
          <span>qodev.dev</span>
          <em>{t.shareOptions}</em>
        </div>
        <span className="iosp-x"><G d="close" /></span>
      </div>
      <div className="iosp-row5">
        {[0, 1, 2, 3, 4].map((k) => <span key={k} className="iosp-cell"><i className="iosp-av" /><i className="iosp-lbl" /></span>)}
      </div>
      <div className="iosp-row5">
        {[0, 1, 2, 3, 4].map((k) => <span key={k} className="iosp-cell"><i className="iosp-sq" /><i className="iosp-lbl" /></span>)}
      </div>
      <div className="iosp-grp">
        <div className="iosp-srow">{t.shareCopy} <G d="copy" /></div>
      </div>
      <div className="iosp-grp">
        <div className="iosp-srow">{t.shareReading} <G d="glasses" /></div>
        <div className="iosp-srow">{t.menuBookmark} <G d="book" /></div>
        <div className="iosp-srow">{t.menuFavorite} <G d="star" /></div>
        <div className="iosp-srow">{t.menuFind} <G d="search" /></div>
        <div className="iosp-srow is-t"><span className="iosp-hl" />{t.shareHome} <G d="home" /></div>
        <div className="iosp-srow">{t.shareMarkup} <G d="markup" /></div>
        <div className="iosp-srow">{t.sharePrint} <G d="print" /></div>
      </div>
      <i className="iosp-ind" />
    </div>
  );
}

function Add({ t }: { t: T }) {
  return (
    <div className="iosp-add">
      <div className="iosp-nav">
        <span className="iosp-cap">{t.addCancel}</span>
        <b>{t.addTitle}</b>
        <span className="iosp-cap is-ok">{t.addConfirm}</span>
      </div>
      <div className="iosp-card">
        <AtlasIcon className="iosp-ico is-l" />
        <div className="iosp-card-f">
          <div>Atlas Secure</div>
          <span>qodev.dev/dashboard</span>
        </div>
      </div>
      <div className="iosp-tgl">
        <span className="iosp-ring" />
        {t.addToggle}
        <span className="iosp-sw" />
      </div>
      <p className="iosp-note">{t.addNote}</p>
      <i className="iosp-ind" />
    </div>
  );
}

function Home({ t }: { t: T }) {
  return (
    <div className="iosp-l iosp-home">
      <div className="iosp-wall" />
      <Status light />
      <div className="iosp-grid">
        {Array.from({ length: 16 }, (_, k) =>
          k === 9 ? (
            <span key={k} className="iosp-cell">
              <AtlasIcon className="iosp-ico iosp-atl" />
              <b className="iosp-atl-l">Atlas Secure</b>
            </span>
          ) : (
            <span key={k} className="iosp-cell"><i className="iosp-tile" /><i className="iosp-lbl" /></span>
          ),
        )}
      </div>
      <span className="iosp-srch"><G d="search" />{t.homeSearch}</span>
      <div className="iosp-dock"><i className="iosp-tile" /><i className="iosp-tile" /><i className="iosp-tile" /><i className="iosp-tile" /></div>
      <i className="iosp-ind" />
    </div>
  );
}

function App() {
  return (
    <div className="iosp-l iosp-app">
      <Status />
      <img className="iosp-page" src="/media/ios/dash.webp" alt="" width={880} height={1788} decoding="async" draggable={false} />
      <i className="iosp-ind" />
    </div>
  );
}

export default function IosPhone({
  scene,
  label,
  t,
  eager = false,
  onScene,
}: {
  scene: Scene | "tour";
  label: string;
  /** Подписи нарисованного Safari — из словаря, отдаёт серверный родитель. */
  t: T;
  eager?: boolean;
  /** Только в scene="tour" — какой шаг сейчас на экране (для подсветки текста рядом). */
  onScene?: (s: Scene) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    let timer = 0;
    let idx = 0;

    const stop = () => {
      window.clearTimeout(timer);
      el.removeAttribute("data-play");
      if (scene === "tour") {
        el.dataset.scene = "1";
        onScene?.(1);
      }
    };
    const next = () => {
      const s = TOUR[idx];
      el.dataset.scene = String(s);
      onScene?.(s);
      timer = window.setTimeout(() => {
        idx = (idx + 1) % TOUR.length;
        next();
      }, DUR[s] * CUT);
    };
    const start = () => {
      if (mq.matches || document.hidden) return;
      el.setAttribute("data-play", "");
      if (scene === "tour") {
        idx = 0;
        next();
      }
    };
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting === visible) return;
        visible = e.isIntersecting;
        if (visible) start();
        else stop();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    const restart = () => {
      stop();
      if (visible) start();
    };
    mq.addEventListener("change", restart);
    document.addEventListener("visibilitychange", restart);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      mq.removeEventListener("change", restart);
      document.removeEventListener("visibilitychange", restart);
    };
    // onScene — стабильный сеттер состояния со страницы, в зависимостях не нужен.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene]);

  const has = (l: "menu" | "share" | "add" | "home") => scene === "tour" || LAYERS[scene].includes(l);
  const barred = scene === "tour" || scene !== 3;

  return (
    <div ref={ref} className="ios-dev" data-scene={scene === "tour" ? 1 : scene} data-mode={scene === "tour" ? "tour" : undefined} role="img" aria-label={label}>
      <span className="ios-dev-shadow" aria-hidden />
      <div className="iosp-scr" aria-hidden>
        {has("home") && <Home t={t} />}
        <Web bar={barred} />
        <div className="iosp-l iosp-dim" />
        {has("menu") && <Menu t={t} />}
        {has("share") && <Share t={t} />}
        {has("add") && <Add t={t} />}
        {has("home") && <App />}
        <span className="iosp-touch"><i /></span>
        <span className="iosp-glare" />
      </div>
      <img
        className="iosp-shell"
        src="/media/ios/shell.webp"
        alt=""
        aria-hidden
        width={960}
        height={1992}
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
        draggable={false}
      />
    </div>
  );
}
