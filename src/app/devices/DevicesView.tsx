"use client";

import Chars from "@/components/atlas/Chars";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { DEVICE_LIMIT } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";
import { BUY_TRAFFIC_HREF, BYPASS_KEY, MAIN_KEY, SWITCH_HINT, type KeyAudience } from "@/lib/key-names";
import { formatBytes, useBypassLive, withJsonFormat } from "@/lib/use-bypass";
import { TRAFFIC_TRIAL_MB } from "@/lib/traffic-packs";
import type { SubscriptionData } from "@/types";
import "./devices-atlas.css";

/**
 * /devices — лист 12 «Атлас-издания».
 *
 * Логика прежняя, двухшаговый мастер: выбор устройства → настройка.
 * Состояние шага и платформы зеркалится в адрес
 * (`?step=setup&platform=ios`), поэтому кнопка «назад» на телефоне
 * возвращает к выбору, а обновление страницы оставляет человека там,
 * где он был. Ссылка профиля запрашивается только при наличии сессии
 * (гость не получает 401 в консоль).
 *
 * Что изменилось — только оформление:
 *   01 первый экран: заголовок буквами, строки устройств въезжают
 *      с разных сторон, наведение переворачивает строку в плиту;
 *   02 настройка: инструкция раскрывается лесенкой из четырёх шагов
 *      с крупными кобальтовыми цифрами: установить приложение, ключ 1
 *      (основной), ключ 2 (усиленный / «Обход» — гигабайты пакета),
 *      включить; при смене устройства или приложения лесенка
 *      собирается заново. Слова ключей — src/lib/key-names.ts: гостю
 *      нейтральные, вошедшему (hasSession) — «Основной VPN» / «Обход»;
 *   03 финал: кобальтовая плита, одно действие.
 *
 * Блок настройки присутствует в разметке всегда и скрыт атрибутом
 * `hidden`, пока устройство не выбрано: MotionController собирает листы
 * один раз при монтировании, и лист, добавленный позже, остался бы без
 * наблюдателя (холостой слой навсегда на паузе).
 *
 * Весь моушн — devices-atlas.css, раздел «Движение».
 */

// ─── Types ──────────────────────────────────────────────────

type Platform = "ios" | "android" | "macos" | "windows" | "tv";
type Step = "device" | "setup";

interface AppInfo {
  id: string;
  name: string;
  description: string;
  storeLabel: string;
  downloadUrl: string;
  searchHint: string;
  jsonFormat?: boolean;
  deepLink?: (url: string) => string;
  steps: string[];
}

// ─── Platform Config ────────────────────────────────────────

const PLATFORMS: { id: Platform; name: string; detail: string; icon: IconName }[] = [
  { id: "ios",     name: "iPhone / iPad", detail: "iOS 16+",    icon: "iphone" },
  { id: "android", name: "Android",       detail: "10+",        icon: "android" },
  { id: "macos",   name: "macOS",         detail: "M1 / Intel", icon: "macos" },
  { id: "windows", name: "Windows",       detail: "10 / 11",    icon: "windows" },
  { id: "tv",      name: "Android TV",    detail: "все модели", icon: "tv" },
];

const PLATFORM_IDS = PLATFORMS.map((p) => p.id);

const APPS: Record<Platform, AppInfo[]> = {
  ios: [
    {
      id: "happ",
      name: "Happ",
      description: "Быстрое и простое приложение",
      storeLabel: "App Store",
      downloadUrl: "https://apps.apple.com/ru/app/happ-proxy-utility-plus/id6746188973",
      searchHint: "Найдите «Happ» в App Store или нажмите кнопку ниже",
      jsonFormat: true,
      deepLink: (url) => `https://api.atlassecure.ru/open/happ?url=${encodeURIComponent(url)}`,
      steps: [
        "Откройте Happ и нажмите «+» внизу экрана",
        "Выберите «Добавить подписку» или «Из буфера обмена»",
        "Конфигурация импортируется автоматически",
        "Нажмите кнопку подключения и разрешите системное подключение",
      ],
    },
  ],
  android: [
    {
      id: "v2raytun",
      name: "V2RayTun",
      description: "Простой и надёжный клиент",
      storeLabel: "Google Play",
      downloadUrl: "https://play.google.com/store/apps/details?id=com.v2raytun.android",
      searchHint: "Найдите «V2RayTun» в Google Play или нажмите кнопку ниже",
      deepLink: (url) => `v2raytun://import/${url}`,
      steps: [
        "Откройте V2RayTun и нажмите «+» вверху",
        "Выберите «Импорт из буфера обмена»",
        "Сервер добавится автоматически",
        "Нажмите кнопку подключения и разрешите системное подключение",
      ],
    },
    {
      id: "happ",
      name: "Happ",
      description: "Быстрое приложение",
      storeLabel: "Google Play",
      downloadUrl: "https://play.google.com/store/apps/details?id=com.happproxy",
      searchHint: "Найдите «Happ» в Google Play или нажмите кнопку ниже",
      jsonFormat: true,
      deepLink: (url) => `https://api.atlassecure.ru/open/happ?url=${encodeURIComponent(url)}`,
      steps: [
        "Откройте Happ и нажмите «+» внизу экрана",
        "Выберите «Добавить подписку» или «Из буфера обмена»",
        "Конфигурация импортируется автоматически",
        "Нажмите кнопку подключения и разрешите системное подключение",
      ],
    },
  ],
  macos: [
    {
      id: "happ",
      name: "Happ",
      description: "Быстрое приложение для Mac",
      storeLabel: "App Store",
      downloadUrl: "https://apps.apple.com/ru/app/happ-proxy-utility-plus/id6746188973",
      searchHint: "Найдите «Happ» в App Store на Mac или нажмите кнопку ниже",
      jsonFormat: true,
      deepLink: (url) => `https://api.atlassecure.ru/open/happ?url=${encodeURIComponent(url)}`,
      steps: [
        "Откройте Happ и нажмите «+» → «Добавить подписку»",
        "Вставьте ссылку из буфера обмена",
        "Конфигурация импортируется автоматически",
        "Нажмите подключиться, введите пароль Mac при запросе",
      ],
    },
  ],
  windows: [
    {
      id: "happ",
      name: "Happ",
      description: "Приложение для Windows",
      storeLabel: "Скачать с сайта",
      downloadUrl: "https://www.happ.su/main",
      searchHint: "Скачайте Happ с официального сайта и установите",
      jsonFormat: true,
      steps: [
        "Откройте Happ и нажмите «+» → «Добавить подписку»",
        "Вставьте ссылку из буфера обмена",
        "Конфигурация импортируется автоматически",
        "Нажмите подключиться, разрешите доступ в брандмауэре",
      ],
    },
  ],
  tv: [
    {
      id: "v2raytun",
      name: "V2RayTun",
      description: "Клиент для Android TV",
      storeLabel: "Google Play на TV",
      downloadUrl: "https://play.google.com/store/apps/details?id=com.v2raytun.android",
      searchHint: "Найдите «V2RayTun» в Google Play на телевизоре",
      steps: [
        "Откройте V2RayTun на TV и нажмите «+»",
        "Введите ссылку подписки с экранной клавиатуры или отсканируйте QR-код",
        "Сервер добавится автоматически",
        "Выберите сервер и нажмите кнопку подключения пультом",
      ],
    },
  ],
};

const DEVICE_WORD = plural(DEVICE_LIMIT, ["устройстве", "устройствах", "устройствах"]);
const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;

const H1_A = "подключим";
const H1_B = "за минуту";

/** Подпись кнопки магазина: «Скачать с сайта» уже глагол, остальные — «Открыть App Store». */
function storeAction(label: string): string {
  return /^скачать/i.test(label) ? label : `Открыть ${label}`;
}

/** Разбивка по словам для финала: слова проявляются на входе плиты. */
function Words({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="a-word" style={{ ["--i" as string]: i }}>{w}</span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

function isPlatform(v: string | null): v is Platform {
  return v !== null && (PLATFORM_IDS as string[]).includes(v);
}

function prefersStill(): boolean {
  return (
    document.documentElement.hasAttribute("data-static") ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function DevicesView({ hasSession }: { hasSession: boolean }) {
  // Wizard state — mirrored to the URL for back-button + refresh.
  const [step, setStep] = useState<Step>("device");
  const [platform, setPlatform] = useState<Platform>("ios");
  const [appIndex, setAppIndex] = useState(0);

  const [vpnKey, setVpnKey] = useState<string | null>(null);
  /** null — ещё грузим, true/false — ответ получен. */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  /** Ключ 2 («Обход»/«Усиленный») из БД — без ожидания панели. */
  const [bk, setBk] = useState<SubscriptionData["bypassKey"] | null>(null);
  const [owed, setOwed] = useState(0);
  /** Какой ключ скопирован / у какого открыт QR: 0 — ни у какого. */
  const [copied, setCopied] = useState<0 | 1 | 2>(0);
  const [showQR, setShowQR] = useState<0 | 1 | 2>(0);
  const setupRef = useRef<HTMLElement>(null);
  // Живой остаток ключа 2 — после первой отрисовки и только вошедшему.
  const { live, status: liveStatus } = useBypassLive(signedIn === true && !!(bk?.known || bk?.maybe || owed > 0));
  // Слова: гостю — «Основной» / «Усиленный», вошедшему — «Основной VPN» / «Обход».
  const aud: KeyAudience = hasSession && signedIn !== false ? "member" : "guest";

  /** Показать блок настройки: прокрутка к нему и фокус на заголовок,
   *  чтобы и глаз, и чтец экрана сразу оказались на втором шаге. */
  const revealSetup = useCallback((smooth: boolean) => {
    setTimeout(() => {
      const el = setupRef.current;
      if (!el) return;
      el.scrollIntoView({ behavior: smooth && !prefersStill() ? "smooth" : "auto", block: "start" });
      el.querySelector<HTMLElement>("#ad-setup-title")?.focus({ preventScroll: true });
    }, 20);
  }, []);

  // Read initial state from URL once the client mounts.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get("platform");
    const s = params.get("step") as Step | null;
    if (isPlatform(p)) setPlatform(p);
    if (s === "setup") {
      setStep("setup");
      revealSetup(false);
    }
    // hook browser back so leaving step 2 lands the user on step 1
    const onPop = () => {
      const q = new URLSearchParams(window.location.search);
      const stepQ = q.get("step") as Step | null;
      setStep(stepQ === "setup" ? "setup" : "device");
      const platQ = q.get("platform");
      if (isPlatform(platQ)) setPlatform(platQ);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [revealSetup]);

  const fetchKey = useCallback(async () => {
    // Гостю запрос не отправляется вовсе. Раньше страница спрашивала
    // подписку у всех подряд и получала 401 — обработан он был
    // корректно, но браузер всё равно писал ошибку в консоль на
    // каждом открытии страницы незалогиненным человеком.
    if (!hasSession) {
      setSignedIn(false);
      return;
    }
    try {
      const res = await fetch("/api/user/subscription");
      if (res.status === 401) {
        // Гость: инструкции по установке ему полезны и без ключа,
        // поэтому страница остаётся доступной, но вместо ссылки
        // профиля показывается предложение войти.
        setSignedIn(false);
        return;
      }
      const result = await res.json();
      setSignedIn(Boolean(result.success));
      if (result.success && result.data.vpnKey) {
        setVpnKey(result.data.vpnKey);
      }
      if (result.success) {
        setBk(result.data.bypassKey ?? null);
        setOwed(result.data.bypassOwedBytes ?? 0);
      }
    } catch {
      setSignedIn(false);
    }
  }, [hasSession]);

  useEffect(() => { fetchKey(); }, [fetchKey]);

  const selectedApps = APPS[platform];
  const currentApp = selectedApps[appIndex] ?? selectedApps[0];
  const platformMeta = PLATFORMS.find((p) => p.id === platform)!;

  // Ссылка для выбранного приложения: Happ получает `?format=json` —
  // так было у основного ключа на проде и так же для ключа 2 (это та же
  // подписка Remnawave, только другой сущности).
  const forApp = useCallback(
    (raw: string | null) => (raw ? (currentApp?.jsonFormat ? withJsonFormat(raw) : raw) : null),
    [currentApp]
  );

  const goToSetup = (p: Platform) => {
    setPlatform(p);
    setAppIndex(0);
    setShowQR(0);
    setCopied(0);
    setStep("setup");
    // Push a new URL so the browser back button returns to step 1.
    const url = new URL(window.location.href);
    url.searchParams.set("step", "setup");
    url.searchParams.set("platform", p);
    window.history.pushState({}, "", url.toString());
    // Шаг 2 стоит под первым экраном: даём React отрисовать его и
    // подводим к нему, иначе на телефоне кажется, что ничего не случилось.
    revealSetup(true);
  };

  const goBackToDevices = () => {
    // Prefer real back so the URL history stays clean; otherwise
    // fall back to an explicit state change.
    if (window.history.state && window.location.search.includes("step=setup")) {
      window.history.back();
    } else {
      setStep("device");
      setShowQR(0);
      setCopied(0);
      const url = new URL(window.location.href);
      url.searchParams.delete("step");
      url.searchParams.delete("platform");
      window.history.replaceState({}, "", url.pathname);
    }
    setTimeout(() => window.scrollTo({ top: 0, behavior: prefersStill() ? "auto" : "smooth" }), 20);
  };

  const handleSelectApp = (idx: number) => {
    setAppIndex(idx);
    setShowQR(0);
    setCopied(0);
  };

  const handleCopy = async (n: 1 | 2, key: string | null) => {
    if (!key) return;
    try {
      await navigator.clipboard.writeText(key);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = key;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(n);
    setTimeout(() => setCopied(0), 2500);
  };

  const handleAutoInstall = (key: string | null) => {
    if (!key || !currentApp?.deepLink) return;
    window.location.href = currentApp.deepLink(key);
  };

  const keyUrl = forApp(vpnKey);
  const key2Url = forApp(live?.subscriptionUrl ?? bk?.subscriptionUrl ?? null);
  const owedNow = live ? live.owedBytes : owed;
  const isSetup = step === "setup";

  /** Кнопки одного ключа: открыть в приложении, скопировать, QR. */
  const keyActions = (n: 1 | 2, url: string | null, what: string) => (
    <>
      <div className="a-actions ad-key-actions">
        {currentApp.deepLink && (
          <button
            type="button"
            onClick={() => handleAutoInstall(url)}
            disabled={!url}
            className={`a-btn ${n === 1 ? "a-btn-primary" : "a-btn-quiet"}`}
          >
            Открыть в приложении<span className="b-sr"> — {what}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => handleCopy(n, url)}
          disabled={!url}
          className="a-btn a-btn-quiet ad-copy"
          data-copied={copied === n || undefined}
        >
          {copied === n ? (
            <>
              <Icon name="check" size={16} />
              Скопировано
            </>
          ) : (
            "Скопировать ссылку"
          )}
          <span className="b-sr"> — {what}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowQR((v) => (v === n ? 0 : n))}
          disabled={!url}
          aria-pressed={showQR === n}
          className="a-btn a-btn-quiet"
        >
          {showQR === n ? "Скрыть QR-код" : "Показать QR-код"}
          <span className="b-sr"> — {what}</span>
        </button>
      </div>
      {showQR === n && url && (
        <figure className="ad-qr">
          <QRCodeSVG value={url} size={192} bgColor="#ffffff" fgColor="#0B1322" level="M" />
          <figcaption>Наведите камеру приложения на код — ключ добавится сам.</figcaption>
        </figure>
      )}
    </>
  );

  return (
    <main id="main" className="a-main ad" data-step={step}>
      {/* ── 01 · Выбор устройства ──────────────────────────────── */}
      <section className="a-sheet ad-cover" data-sheet="12" data-title="Устройства" aria-labelledby="ad-title">
        <div className="a-field">
          <ol className="ad-progress a-wide a-settle" aria-label="Шаги настройки">
            <li aria-current={!isSetup ? "step" : undefined}>1 · устройство</li>
            <li className="ad-progress-line" aria-hidden>
              <i className="ad-progress-fill" />
              <i className="ad-progress-glint a-idle" />
            </li>
            <li aria-current={isSetup ? "step" : undefined}>2 · настройка</li>
          </ol>

          <h1 id="ad-title" className="ad-h1" aria-label={`${H1_A} ${H1_B}`}>
            <span className="ad-h1-line" aria-hidden><Chars text={H1_A} /></span>
            <span className="ad-h1-line ad-h1-2" aria-hidden><Chars text={H1_B} start={H1_A.length} /></span>
          </h1>

          <div className="ad-cover-grid">
            <p className="a-lead a-settle" style={{ ["--i" as string]: 2 }}>
              Выберите устройство — покажем, что нажать. Приложение бесплатное, одна подписка
              работает на {DEVICE_LIMIT} {DEVICE_WORD}, первые {TRIAL} — без оплаты.
            </p>
            <div className="a-actions a-settle" style={{ ["--i" as string]: 3 }}>
              {/* Гостю «В личный кабинет» ничего не даёт — ему нужен ключ,
                  а ключ выдаётся с пробным периодом (разбор 12.09.2026). */}
              {hasSession ? (
                <Link href="/dashboard" className="a-btn a-btn-quiet">В личный кабинет</Link>
              ) : (
                <>
                  <Link href="/auth" className="a-btn a-btn-primary">Попробовать {TRIAL} бесплатно</Link>
                  <Link href="/auth" className="a-btn a-btn-quiet">Войти</Link>
                </>
              )}
            </div>
          </div>

          <div className="ad-pick">
            <h2 className="ad-pick-head a-wide a-settle" style={{ ["--i" as string]: 4 }}>на каком устройстве</h2>
            <ul className="ad-platforms">
              {PLATFORMS.map((p, i) => {
                const active = isSetup && platform === p.id;
                return (
                  <li
                    key={p.id}
                    className="a-slide"
                    style={{ ["--i" as string]: i, ["--dir" as string]: i % 2 ? 1 : -1 }}
                  >
                    {/* Доступное имя — видимый текст кнопки: голосовое
                        управление находит кнопку по надписи. */}
                    <button
                      type="button"
                      className="ad-platform"
                      aria-pressed={active}
                      onClick={() => goToSetup(p.id)}
                    >
                      <span className="ad-platform-no a-wide" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                      <Icon name={p.icon} size={28} className="ad-platform-icon" />
                      <span className="ad-platform-name">{p.name}</span>
                      <span className="ad-platform-detail">{p.detail}</span>
                      <span className="ad-platform-go" aria-hidden>
                        <Icon name={active ? "check" : "arrow-right"} size={20} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="ad-note a-settle" style={{ ["--i" as string]: 6 }}>
              Не нашли своё устройство? <Link href="/contact">Напишите нам</Link> — поможем.
            </p>
          </div>
        </div>
      </section>

      {/* ── 02 · Настройка — лесенка из трёх шагов ────────────── */}
      <section
        ref={setupRef}
        className="a-sheet ad-setup"
        data-sheet="12"
        data-title="Настройка"
        aria-labelledby="ad-setup-title"
        hidden={!isSetup}
      >
        <div className="a-field">
          <h2 id="ad-setup-title" className="a-h2" tabIndex={-1}>
            <span className="a-no">02</span>настройка на {platformMeta.name}
          </h2>

          <div className="ad-device-line">
            <Icon name={platformMeta.icon} size={22} className="ad-device-icon" />
            <span>{platformMeta.name}</span>
            <span className="ad-device-detail">{platformMeta.detail}</span>
            <button type="button" className="a-btn a-btn-quiet" onClick={goBackToDevices}>
              Сменить устройство
            </button>
          </div>

          {/* Выбор приложения — только когда для платформы их несколько. */}
          {selectedApps.length > 1 && (
            <fieldset className="ad-apps">
              <legend className="a-wide">приложение</legend>
              <div className="ad-apps-row">
                {selectedApps.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    className="ad-app"
                    aria-pressed={i === appIndex}
                    onClick={() => handleSelectApp(i)}
                  >
                    <span>{a.name}</span>
                    <small>{a.description}</small>
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {/* key: при смене устройства или приложения лесенка
              пересобирается и раскрывается заново. */}
          <ol className="ad-ladder" key={`${platform}-${currentApp.id}`}>
            <li className="ad-step" style={{ ["--i" as string]: 0 }}>
              <span className="ad-step-n" aria-hidden>1</span>
              <div className="ad-step-body">
                <h3>Установите {currentApp.name}</h3>
                <p>{currentApp.searchHint}</p>
                <a
                  href={currentApp.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="a-btn a-btn-quiet"
                >
                  {storeAction(currentApp.storeLabel)}
                  <span className="b-sr"> (откроется в новой вкладке)</span>
                </a>
              </div>
            </li>

            <li className="ad-step" style={{ ["--i" as string]: 1 }}>
              <span className="ad-step-n" aria-hidden>2</span>
              <div className="ad-step-body">
                <p className="ad-kname">{MAIN_KEY[aud].title}</p>
                <h3>{aud === "member" ? "Добавьте основной VPN" : "Добавьте основной ключ"}</h3>
                <p className="ad-kline">{MAIN_KEY[aud].text}</p>
                {keyUrl ? (
                  <>
                    <p>Ссылка ниже — только ваша. Кнопка сама откроет приложение и добавит её.</p>
                    <div className="ad-key">
                      <span className="ad-key-text">{keyUrl}</span>
                      <span className="ad-key-flow a-idle" aria-hidden />
                    </div>
                  </>
                ) : signedIn === false ? (
                  <div className="ad-guest">
                    <p>
                      Ключ появится сразу после входа по почте — вместе с {TRIAL} бесплатно.
                      Карта не нужна.
                    </p>
                    <Link href="/auth" className="a-btn a-btn-primary">Получить ключ бесплатно</Link>
                  </div>
                ) : signedIn === true ? (
                  <p>
                    Ключ появится в <Link href="/dashboard" className="ad-inline">личном кабинете</Link>.
                  </p>
                ) : (
                  <div className="ad-key" aria-busy="true">
                    <span className="ad-key-text ad-key-wait">Секунду, загружаем ключ…</span>
                    <span className="ad-key-flow a-idle" aria-hidden />
                  </div>
                )}

                {signedIn !== false && keyActions(1, keyUrl, MAIN_KEY[aud].title)}
                <p className="b-sr" role="status" aria-live="polite">
                  {copied ? `Ссылка скопирована: ${copied === 1 ? MAIN_KEY[aud].title : BYPASS_KEY[aud].title}` : ""}
                </p>
              </div>
            </li>

            <li className="ad-step" style={{ ["--i" as string]: 2 }}>
              <span className="ad-step-n" aria-hidden>3</span>
              <div className="ad-step-body">
                <p className="ad-kname">{BYPASS_KEY[aud].title}</p>
                <h3>{aud === "member" ? "Добавьте ключ «Обход»" : "Добавьте усиленный ключ"}</h3>
                <p className="ad-kline">{BYPASS_KEY[aud].text}</p>
                {signedIn === false ? (
                  <div className="ad-guest">
                    <p>
                      Усиленный ключ приходит вместе с пробным периодом — в нём {TRAFFIC_TRIAL_MB} МБ. Дальше
                      гигабайты докупаются пакетами трафика: срока у них нет, пакеты складываются.
                    </p>
                    <div className="a-actions">
                      <Link href="/auth" className="a-btn a-btn-primary">Попробовать бесплатно</Link>
                      <Link href="/pricing#traffic" className="a-btn a-btn-quiet">Пакеты трафика</Link>
                    </div>
                  </div>
                ) : signedIn === null || (liveStatus === "loading" && !key2Url) ? (
                  <div className="ad-key" aria-busy="true">
                    <span className="ad-key-text ad-key-wait">Секунду, проверяем ключ…</span>
                    <span className="ad-key-flow a-idle" aria-hidden />
                  </div>
                ) : key2Url ? (
                  <>
                    {live?.state === "ok" && !live.unlimited && (
                      <p className="ad-kleft">
                        Осталось <b className="a-num">{formatBytes(live.remainingBytes ?? 0)}</b> из {formatBytes(live.limitBytes ?? 0)}
                      </p>
                    )}
                    <div className="ad-key">
                      <span className="ad-key-text">{key2Url}</span>
                      <span className="ad-key-flow a-idle" aria-hidden />
                    </div>
                    {keyActions(2, key2Url, BYPASS_KEY[aud].title)}
                    <div className="a-actions">
                      <Link href={BUY_TRAFFIC_HREF} className="a-btn a-btn-quiet">Докупить гигабайты</Link>
                    </div>
                  </>
                ) : owedNow > 0 ? (
                  <p>Гигабайты оплачены и зачисляются — ключ появится здесь через пару минут.</p>
                ) : (
                  <div className="ad-guest">
                    <p>Ключа «Обход» пока нет. Купите пакет трафика — ключ появится сразу после оплаты.</p>
                    <Link href={BUY_TRAFFIC_HREF} className="a-btn a-btn-primary">Получить ключ «Обход»</Link>
                  </div>
                )}
              </div>
            </li>

            <li className="ad-step" style={{ ["--i" as string]: 3 }}>
              <span className="ad-step-n" aria-hidden>4</span>
              <div className="ad-step-body">
                <h3>Включите</h3>
                <p>
                  Нажмите кнопку подключения в {currentApp.name}. Дальше всё работает само.{" "}
                  <span className="ad-on a-idle">включено</span>
                </p>
                <p className="ad-switch">{SWITCH_HINT[aud]}</p>

                <details className="ad-manual">
                  <summary>
                    <span className="ad-manual-mark" aria-hidden />
                    Не сработало? Шаги вручную
                  </summary>
                  <ol>
                    {currentApp.steps.map((s, i) => (
                      <li key={i} style={{ ["--i" as string]: i }}>
                        <b className="a-num" aria-hidden>{i + 1}</b>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            </li>
          </ol>

          <div className="ad-done">
            <p className="ad-done-text">
              <Icon name="check" size={22} className="ad-done-icon" />
              Готово — при следующем запуске приложение подключится само.
            </p>
            <div className="a-actions">
              <button type="button" className="a-btn a-btn-quiet" onClick={goBackToDevices}>
                К устройствам
              </button>
              <Link href="/dashboard" className="a-btn a-btn-quiet">В кабинет</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 03 · Помощь — плита с одним действием ─────────────── */}
      <section className="a-sheet a-plate a-final ad-final" data-sheet="12" data-title="Помощь" aria-labelledby="ad-final-title">
        <div className="a-field">
          <h2 id="ad-final-title" className="a-h2">
            <span className="a-no">{isSetup ? "03" : "02"}</span>
            <Words text="не получается? настроим вместе" />
          </h2>
          <p className="a-p a-settle" style={{ ["--i" as string]: 6 }}>
            Напишите, какое у вас устройство и на каком шаге остановились, — ответим и доведём до конца.
          </p>
          <div className="a-actions a-settle" style={{ ["--i" as string]: 8 }}>
            <Link href="/contact" className="a-btn a-btn-invert a-idle">Написать в поддержку</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
