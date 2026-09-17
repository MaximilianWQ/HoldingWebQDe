"use client";

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
import VShell from "@/components/vps/VShell";
import "./devices-vps.css";

/**
 * /devices — корпус Atlas Secure VPS (образец IMG_1767/1768: заголовок
 * с синим словом, короткий лид, плитки устройств, пунктирные шаги
 * `.v-steps`).
 *
 * Логика прежняя (fetchKey, ключ 1 «Основной», ключ 2 «Обход», выбор
 * приложения, ручные шаги, QR, copy-to-clipboard) — упрощена только
 * витрина: вместо мастера из двух экранов с синхронизацией в адресной
 * строке шаги для выбранной платформы стоят прямо под плитками и
 * обновляются вживую при переключении устройства (так устроен образец:
 * шаги — не отдельный шаг мастера, а содержимое одного экрана).
 */

// ─── Types ──────────────────────────────────────────────────

type Platform = "ios" | "android" | "macos" | "windows" | "tv";

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

/** Подпись кнопки магазина: «Скачать с сайта» уже глагол, остальные — «Открыть App Store». */
function storeAction(label: string): string {
  return /^скачать/i.test(label) ? label : `Открыть ${label}`;
}

function prefersStill(): boolean {
  return (
    document.documentElement.hasAttribute("data-static") ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function DevicesView({ hasSession }: { hasSession: boolean }) {
  const [platform, setPlatform] = useState<Platform>("ios");
  const [appIndex, setAppIndex] = useState(0);

  // Старые ссылки вида /devices?step=setup&platform=android (бот, письма,
  // закладки) открывают сразу нужную платформу.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("platform");
    if (q && PLATFORMS.some((p) => p.id === q)) setPlatform(q as Platform);
  }, []);

  const [vpnKey, setVpnKey] = useState<string | null>(null);
  /** null — ещё грузим, true/false — ответ получен. */
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  /** Ключ 2 («Обход»/«Усиленный») из БД — без ожидания панели. */
  const [bk, setBk] = useState<SubscriptionData["bypassKey"] | null>(null);
  const [owed, setOwed] = useState(0);
  /** Какой ключ скопирован / у какого открыт QR: 0 — ни у какого. */
  const [copied, setCopied] = useState<0 | 1 | 2>(0);
  const [showQR, setShowQR] = useState<0 | 1 | 2>(0);
  const stepsRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  // Живой остаток ключа 2 — после первой отрисовки и только вошедшему.
  const { live, status: liveStatus } = useBypassLive(signedIn === true && !!(bk?.known || bk?.maybe || owed > 0));
  // Слова: гостю — «Основной» / «Усиленный», вошедшему — «Основной VPN» / «Обход».
  const aud: KeyAudience = hasSession && signedIn !== false ? "member" : "guest";

  const fetchKey = useCallback(async () => {
    // Гостю запрос не отправляется вовсе — иначе браузер пишет в
    // консоль 401 на каждом открытии страницы незалогиненным человеком.
    if (!hasSession) {
      setSignedIn(false);
      return;
    }
    try {
      const res = await fetch("/api/user/subscription");
      if (res.status === 401) {
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
  // так на проде у обоих ключей (это та же подписка Remnawave, только
  // другая сущность).
  const forApp = useCallback(
    (raw: string | null) => (raw ? (currentApp?.jsonFormat ? withJsonFormat(raw) : raw) : null),
    [currentApp]
  );

  const handleSelectPlatform = (p: Platform) => {
    setPlatform(p);
    setAppIndex(0);
    setShowQR(0);
    setCopied(0);
    // На телефоне плитки и шаги не помещаются в один экран — подводим
    // взгляд к шагам, чтобы выбор не выглядел так, будто ничего не
    // случилось. На первой отрисовке шаги уже в кадре — не дёргаем.
    if (firstRender.current) return;
    setTimeout(() => {
      stepsRef.current?.scrollIntoView({ behavior: prefersStill() ? "auto" : "smooth", block: "start" });
    }, 20);
  };

  useEffect(() => { firstRender.current = false; }, []);

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

  /** Кнопки одного ключа: открыть в приложении, скопировать, QR. */
  const keyActions = (n: 1 | 2, url: string | null, what: string) => (
    <>
      <div className="vd-actions">
        {currentApp.deepLink && (
          <button
            type="button"
            onClick={() => handleAutoInstall(url)}
            disabled={!url}
            className={`v-btn v-btn-sm ${n === 1 ? "v-btn-primary" : "v-btn-outline"}`}
          >
            Открыть в приложении<span className="v-sr"> — {what}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => handleCopy(n, url)}
          disabled={!url}
          className="v-btn v-btn-sm v-btn-outline"
        >
          {copied === n ? (
            <>
              <Icon name="check" size={16} />
              Скопировано
            </>
          ) : (
            "Скопировать ссылку"
          )}
          <span className="v-sr"> — {what}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowQR((v) => (v === n ? 0 : n))}
          disabled={!url}
          aria-pressed={showQR === n}
          className="v-btn v-btn-sm v-btn-outline"
        >
          {showQR === n ? "Скрыть QR-код" : "Показать QR-код"}
          <span className="v-sr"> — {what}</span>
        </button>
      </div>
      {showQR === n && url && (
        <figure className="vd-qr">
          <QRCodeSVG value={url} size={176} bgColor="#ffffff" fgColor="#0B0B0F" level="M" />
          <figcaption>Наведите камеру приложения на код — ключ добавится сам.</figcaption>
        </figure>
      )}
    </>
  );

  return (
    <VShell account={hasSession ? "member" : "guest"}>
      <section className="v-section v-center" aria-labelledby="vd-title">
        <div className="v-wrap v-narrow">
          <h1 id="vd-title" className="v-h2">
            Инструкция по <span className="v-accent">подключению</span>
          </h1>
          <p className="v-lead">
            Выберите устройство — покажем, что нажать. Приложение бесплатное, одна подписка работает
            на {DEVICE_LIMIT} {DEVICE_WORD}, первые {TRIAL} — без оплаты.
          </p>

          {/* ── Плитки устройств ─────────────────────────────────── */}
          <div className="vd-grid" role="group" aria-label="Устройство">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="vd-tile"
                aria-pressed={platform === p.id}
                onClick={() => handleSelectPlatform(p.id)}
              >
                <Icon name={p.icon} size={26} className="vd-tile-icon" />
                <span className="vd-tile-copy">
                  <span className="vd-tile-name">{p.name}</span>
                  <span className="vd-tile-detail">{p.detail}</span>
                </span>
              </button>
            ))}
          </div>

          {/* ── Шаги для выбранной платформы ─────────────────────── */}
          <div ref={stepsRef} style={{ scrollMarginTop: "var(--v-head-h)" }}>
            <ol className="v-steps" key={platform}>
              <li className="v-step">
                <div className="v-step-head">
                  <span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span>
                  <h3>Установите приложение</h3>
                </div>
                <p>{currentApp.searchHint}</p>
                {selectedApps.length > 1 && (
                  <div className="v-seg vd-apps" role="tablist" aria-label="Приложение">
                    {selectedApps.map((a, i) => (
                      <button key={a.id} type="button" role="tab" aria-selected={i === appIndex} onClick={() => handleSelectApp(i)}>
                        {a.name}
                      </button>
                    ))}
                  </div>
                )}
                <a
                  href={currentApp.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="v-btn v-btn-outline v-btn-block"
                >
                  {storeAction(currentApp.storeLabel)}
                  <span className="v-sr"> (откроется в новой вкладке)</span>
                </a>
              </li>

              <li className="v-step">
                <div className="v-step-head">
                  <span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span>
                  <h3>Добавьте подписку</h3>
                </div>

                {signedIn === false ? (
                  <div className="vd-guest">
                    <p>
                      Ключ появится сразу после входа по почте — вместе с {TRIAL} бесплатно. Карта не нужна.
                    </p>
                    <Link href="/auth" className="v-btn v-btn-primary v-btn-block">Войти и получить ключ</Link>
                  </div>
                ) : (
                  <>
                    <p className="vd-kicker">{MAIN_KEY[aud].title}</p>
                    <p style={{ margin: "0 0 4px", color: "var(--v-ink-3)", fontSize: 15 }}>{MAIN_KEY[aud].text}</p>
                    {keyUrl ? (
                      <div className="vd-key">{keyUrl}</div>
                    ) : (
                      <div className="vd-key" aria-busy="true">Секунду, загружаем ключ…</div>
                    )}
                    {keyActions(1, keyUrl, MAIN_KEY[aud].title)}

                    {/* Ключ 2 · Обход — только вошедшему: пробные мегабайты или купленный пакет. */}
                    {aud === "member" && (
                      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--v-line)" }}>
                        <p className="vd-kicker">{BYPASS_KEY[aud].title}</p>
                        <p style={{ margin: "0 0 4px", color: "var(--v-ink-3)", fontSize: 15 }}>{BYPASS_KEY[aud].text}</p>
                        {liveStatus === "loading" && !key2Url ? (
                          <div className="vd-key" aria-busy="true">Секунду, проверяем ключ…</div>
                        ) : key2Url ? (
                          <>
                            {live?.state === "ok" && !live.unlimited && (
                              <p className="vd-left">
                                Осталось <b>{formatBytes(live.remainingBytes ?? 0)}</b> из {formatBytes(live.limitBytes ?? 0)}
                              </p>
                            )}
                            <div className="vd-key">{key2Url}</div>
                            {keyActions(2, key2Url, BYPASS_KEY[aud].title)}
                            <div className="vd-actions">
                              <Link href={BUY_TRAFFIC_HREF} className="v-btn v-btn-sm v-btn-outline">Докупить гигабайты</Link>
                            </div>
                          </>
                        ) : owedNow > 0 ? (
                          <p style={{ color: "var(--v-ink-3)", fontSize: 15 }}>
                            Гигабайты оплачены и зачисляются — ключ появится здесь через пару минут.
                          </p>
                        ) : (
                          <div className="vd-guest">
                            <p>Ключа «Обход» пока нет. Купите пакет трафика — ключ появится сразу после оплаты.</p>
                            <Link href={BUY_TRAFFIC_HREF} className="v-btn v-btn-primary v-btn-block">Получить ключ «Обход»</Link>
                          </div>
                        )}
                      </div>
                    )}

                    {aud === "guest" && signedIn === true && (
                      <p style={{ marginTop: 14, color: "var(--v-ink-3)", fontSize: 15 }}>
                        Усиленный ключ появится вместе с пробным периодом — в нём {TRAFFIC_TRIAL_MB} МБ.{" "}
                        <Link href="/pricing#traffic" className="v-link">Пакеты трафика</Link>
                      </p>
                    )}
                  </>
                )}
                <p className="v-sr" role="status" aria-live="polite">
                  {copied ? `Ссылка скопирована: ${copied === 1 ? MAIN_KEY[aud].title : BYPASS_KEY[aud].title}` : ""}
                </p>
              </li>

              <li className="v-step">
                <div className="v-step-head">
                  <span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span>
                  <h3>Подключитесь</h3>
                </div>
                <p>
                  Нажмите кнопку подключения в {currentApp.name}. Выберите страну из списка — дальше всё
                  работает само.
                </p>
                {aud === "member" && <p className="vd-switch">{SWITCH_HINT[aud]}</p>}

                <details className="vd-manual">
                  <summary>Не сработало? Шаги вручную</summary>
                  <ol>
                    {currentApp.steps.map((s, i) => (
                      <li key={i}>
                        <b aria-hidden>{i + 1}</b>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </details>

                <Link href="/support" className="v-btn v-btn-primary v-btn-block" style={{ marginTop: 20 }}>
                  <Icon name="chat" size={20} /> Поддержка
                </Link>
              </li>
            </ol>
          </div>

          <p className="v-small vd-note">
            Не нашли своё устройство?{" "}
            <Link href="/contact" className="v-link" style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>Напишите нам</Link> — поможем.
          </p>
        </div>
      </section>
    </VShell>
  );
}
