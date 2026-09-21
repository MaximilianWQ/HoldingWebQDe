"use client";

import { useEffect, useRef } from "react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import BrandMark from "@/components/pixel/BrandMark";
import { mainKey, type KeyAudience } from "@/lib/key-names";
import { fill, type Dict } from "@/i18n";
import type { Locale } from "@/lib/locale";

/**
 * iPhone 17 Pro Max с живым экраном для /install-happ (владелец,
 * 17.09.2026: «анимированная инструкция, такая же по технике и
 * качеству, как /install-ios»).
 *
 * Та же техника, что IosPhone.tsx: корпус — тот же рендер Blender
 * public/media/ios/shell.webp (вырез экрана прозрачный), экран —
 * HTML/CSS ПОД корпусом в пунктах iPhone (440 × 956,
 * --u = 100cqw / 440), стили — happ-phone.css. Шесть сцен-петель:
 *   1. Наш кабинет — ключ, «Скопировать» → «Скопировано».
 *   2. Открываем Happ — нажимаем «+».
 *   3. Лист импорта — «Импорт из буфера обмена».
 *   4. Подписка добавилась — вспышка на карточке группы.
 *   5. Выбор сервера — Vienna Premium (третья строка).
 *   6. Подключение — тумблер, «Подключено», таймер сессии.
 *
 * Подписи внутри экрана приходят пропсом `t` (словарь клиентский
 * компонент не импортирует — уехали бы оба языка). Числа в мокапе
 * выдуманы и остаются здесь: это не факты о продукте, а декорация
 * нарисованного приложения. Исключение — дата: её формат у языков
 * разный, поэтому она тоже рядом, в `UNTIL`.
 *
 * Иконки — только общий набор src/components/pixel/Icon.tsx (масштаб —
 * CSS-классы happ-phone.css, а не проп size, тот же приём, что и у
 * прочих мокапов интерфейса на сайте). Своих логотипов Happ нет —
 * только отрисовка по текстовому описанию владельца.
 */

type Scene = 1 | 2 | 3 | 4 | 5 | 6;
type T = Dict["installHapp"]["phone"];

/** Выдуманные показания мокапа: остаток трафика и срок ключа. */
const GB = 398;
const UNTIL: Record<Locale, string> = { ru: "02.06.2048", en: "2 June 2048" };

const DUR: Record<Scene, number> = { 1: 4200, 2: 3400, 3: 4400, 4: 3200, 5: 3800, 6: 4200 };
const CUT = 0.88;
const TOUR: Scene[] = [1, 2, 3, 4, 5, 6];

function G({ name, className }: { name: IconName; className?: string }) {
  return <Icon name={name} size={20} className={`hp-g ${className ?? ""}`} />;
}

function Status() {
  return (
    <div className="hp-st" aria-hidden>
      <span>9:41</span>
      <svg className="hp-st-i" viewBox="0 0 78 14">
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

/**
 * Сцена 1 — наш кабинет: карточка ключа и кнопка «Скопировать».
 * Подпись ключа — из общего источника src/lib/key-names.ts: гостю
 * «Основной», вошедшему «Основной VPN» (правило витрины — без «VPN»).
 */
function Site({ aud, locale, t }: { aud: KeyAudience; locale: Locale; t: T }) {
  const key = mainKey(aud, locale);
  return (
    <div className="hp-l hp-site">
      <Status />
      <div className="hp-site-head">
        <span className="hp-site-mark"><BrandMark size={18} /></span>
        <b>{t.cabinet}</b>
      </div>
      <div className="hp-card">
        <div className="hp-card-title">
          <b>{key.title}</b>
          <span className="hp-card-badge">{t.active}</span>
        </div>
        <p className="hp-card-sub">{key.text}</p>
        <div className="hp-strip">
          {/* Заглушка вместо настоящего адреса подписки: свой домен в
              рендерах не показываем (владелец, 17.09.2026). */}
          <span>sub.your-key.ru****</span>
          <span className="hp-strip-dots" aria-hidden>
            {[0, 1, 2, 3, 4].map((k) => <i key={k} />)}
          </span>
        </div>
      </div>
      <button type="button" className="hp-btn" tabIndex={-1} aria-hidden>
        <G name="copy" />
        {t.copy}
      </button>
      <div className="hp-toast">
        <G name="check" />
        {t.copied}
      </div>
      <span className="hp-ind" />
    </div>
  );
}

/** Имя первой строки переводится («Авто»), остальные — имена серверов. */
const SERVERS: { row: number; code: string; name?: string }[] = [
  { row: 0, code: "AUTO" },
  { row: 1, code: "NL", name: "Amsterdam Elite" },
  { row: 2, code: "AT", name: "Vienna Premium" },
  { row: 3, code: "EE", name: "Estonia" },
  { row: 4, code: "NL", name: "NL Elite" },
  { row: 5, code: "GB", name: "London Elite" },
];

/** Приложение Happ — тумблер, шапка групп, трафик, список серверов, вкладки. */
function Happ({ empty, locale, t }: { empty: boolean; locale: Locale; t: T }) {
  return (
    <div className="hp-l hp-app">
      <Status />

      <div className="hp-toggle-wrap">
        <span className="hp-toggle" aria-hidden><G name="bolt" /></span>
        <span className="hp-toggle-on" aria-hidden><G name="bolt" /></span>
      </div>
      <p className="hp-status">
        <span className="hp-status-off">{t.off}</span>
        <span className="hp-status-on">{t.on}</span>
      </p>

      <div className="hp-head">
        {empty ? (
          <div className="hp-head-empty">
            <b>{t.profiles}</b>
            <span className="hp-plus"><G name="plus" /></span>
          </div>
        ) : (
          <div className="hp-head-group">
            <span className="hp-grp-ico"><G name="globe" /></span>
            <span className="hp-grp-t">
              <b>{t.group}</b>
              <span>{t.groupNote}</span>
            </span>
            <span className="hp-grp-acts">
              <span className="hp-iconbtn"><G name="refresh" /></span>
              <span className="hp-iconbtn">
                <span className="hp-dots3" aria-hidden><i /><i /><i /></span>
              </span>
            </span>
          </div>
        )}
      </div>

      <div className="hp-traffic">
        <div className="hp-traffic-row">
          <b>{GB} {t.gb}</b>
          <span>{fill(t.until, { date: UNTIL[locale] })}</span>
        </div>
        <div className="hp-bar"><i /></div>
      </div>

      <div className="hp-list">
        {SERVERS.map((s) => (
          <div key={s.row} className="hp-row" data-row={s.row}>
            <span className="hp-pill">{s.code}</span>
            <span className="hp-row-t">
              <b>{s.name ?? t.auto}</b>
              <span>{t.unlimited}</span>
            </span>
            <span className="hp-row-check" aria-hidden><G name="check" /></span>
          </div>
        ))}
      </div>

      <div className="hp-timer">
        <span className="hp-timer-dot" aria-hidden />
        00:00:03
      </div>

      <div className="hp-tabbar">
        <span className="hp-tab" data-active="true">
          <G name="bolt" />
          <i className="hp-tab-dot" />
        </span>
        <span className="hp-tab">
          <G name="globe" />
          <i className="hp-tab-dot" />
        </span>
        <span className="hp-tab">
          <G name="settings" />
          <i className="hp-tab-dot" />
        </span>
      </div>
      <span className="hp-ind" />
    </div>
  );
}

/** Лист импорта — снизу, «Импорт из буфера обмена» подсвечен. */
function ImportSheet({ t }: { t: T }) {
  return (
    <div className="hp-sheet">
      <div className="hp-grab" />
      <p className="hp-sheet-title">{t.sheetTitle}</p>
      <div className="hp-srow"><span className="hp-srow-ico"><G name="qr" /></span>{t.sheetQr}</div>
      <div className="hp-srow"><span className="hp-srow-ico"><G name="key" /></span>{t.sheetManual}</div>
      <div className="hp-srow is-target">
        <span className="hp-srow-hl" />
        <span className="hp-srow-ico"><G name="copy" /></span>
        {t.sheetClipboard}
      </div>
      <div className="hp-srow"><span className="hp-srow-ico"><G name="download" /></span>{t.sheetFile}</div>
    </div>
  );
}

export default function HappPhone({
  scene,
  label,
  locale,
  t,
  eager = false,
  onScene,
  audience = "guest",
}: {
  scene: Scene | "tour";
  label: string;
  locale: Locale;
  /** Подписи нарисованного экрана — из словаря, отдаёт серверный родитель. */
  t: T;
  eager?: boolean;
  /** Только в scene="tour" — какой шаг сейчас на экране (для подсветки текста рядом). */
  onScene?: (s: Scene) => void;
  /** Чьи слова в мокапе кабинета: гость — без «VPN». */
  audience?: KeyAudience;
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

  const isSite = scene === "tour" || scene === 1;
  const isHapp = scene === "tour" || scene !== 1;
  const isEmptyHead = scene === "tour" || scene === 2 || scene === 3;
  const hasSheet = scene === "tour" || scene === 2 || scene === 3;

  return (
    <div ref={ref} className="hp-dev" data-scene={scene === "tour" ? 1 : scene} data-mode={scene === "tour" ? "tour" : undefined} role="img" aria-label={label}>
      <span className="hp-dev-shadow" aria-hidden />
      <div className="hp-scr" aria-hidden>
        {isSite && <Site aud={audience} locale={locale} t={t} />}
        {isHapp && (
          <>
            <Happ empty={isEmptyHead} locale={locale} t={t} />
            {hasSheet && <div className="hp-l hp-dim" />}
            {hasSheet && <ImportSheet t={t} />}
          </>
        )}
        <span className="hp-touch"><i /></span>
        <span className="hp-glare" />
      </div>
      <img
        className="hp-shell"
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
