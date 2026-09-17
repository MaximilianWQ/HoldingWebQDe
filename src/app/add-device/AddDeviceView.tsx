"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { DEVICE_LIMIT } from "@/lib/plans";
import { plural } from "@/lib/ru-words";
import { BUY_TRAFFIC_HREF, BYPASS_KEY, MAIN_KEY, SWITCH_HINT } from "@/lib/key-names";
import { formatBytes, useBypassLive, withJsonFormat } from "@/lib/use-bypass";
import type { SubscriptionData } from "@/types";
import VShell from "@/components/vps/VShell";
import "./add-device-vps.css";

/**
 * /add-device — корпус Atlas Secure VPS, тот же язык, что /devices:
 * плитки устройств и пунктирные шаги в одной непрерывной ленте, без
 * отдельных экранов мастера. Экран только для вошедших — слова «VPN»
 * и «Обход» уместны (MAIN_KEY.member / BYPASS_KEY.member).
 *
 * Логика перенесена без изменений: platform → app (если их несколько)
 * → ключ 1 «Основной VPN» + ключ 2 «Обход» с остатком гигабайт, QR,
 * копирование с запасным путём через textarea, ручные шаги, «Готово» —
 * в кабинет. Запрос один: /api/user/subscription, ошибка — молча;
 * остаток ключа 2 — /api/user/bypass после первой отрисовки.
 *
 * Что убрано (декоративное/повтор, не логика):
 *   · подсказка платформы по userAgent — гость сам находит свою
 *     плитку среди пяти, как на /devices;
 *   · отдельная всегда открытая QR-плитка — QR теперь за кнопкой
 *     «Показать QR-код» у каждого ключа, как на /devices (тот же
 *     код, без второй копии на странице).
 */

// ─── Types ──────────────────────────────────────────────────

type Platform = "ios" | "android" | "macos" | "windows" | "tv";

interface AppConfig {
  id: string;
  name: string;
  jsonFormat?: boolean;
  storeLabel: string;
  downloadUrl: string;
  qrHint: string;
  steps: string[];
}

const APPS: Record<Platform, AppConfig[]> = {
  ios: [
    {
      id: "happ-ios",
      name: "Happ",
      jsonFormat: true,
      storeLabel: "App Store",
      downloadUrl: "https://apps.apple.com/ru/app/happ-proxy-utility-plus/id6746188973",
      qrHint: "Откройте Happ → «+» → «Сканировать QR-код» → наведите камеру на код",
      steps: [
        "Откройте приложение Happ на iPhone или iPad",
        "Нажмите «+» в нижней панели",
        "Выберите «Сканировать QR-код» или «Из буфера обмена»",
        "Конфигурация импортируется автоматически",
        "Нажмите кнопку подключения и разрешите системное подключение при запросе",
      ],
    },
  ],
  android: [
    {
      id: "happ-android",
      name: "Happ",
      jsonFormat: true,
      storeLabel: "Google Play",
      downloadUrl: "https://play.google.com/store/apps/details?id=com.happproxy",
      qrHint: "Откройте Happ → «+» → «Сканировать QR-код» → наведите камеру на код",
      steps: [
        "Откройте приложение Happ на Android",
        "Нажмите «+» в нижней панели",
        "Выберите «Сканировать QR-код» или «Из буфера обмена»",
        "Конфигурация импортируется автоматически",
        "Нажмите кнопку подключения и разрешите системное подключение при запросе",
      ],
    },
    {
      id: "v2raytun-android",
      name: "V2RayTun",
      storeLabel: "Google Play",
      downloadUrl: "https://play.google.com/store/apps/details?id=com.v2raytun.android",
      qrHint: "Откройте V2RayTun → «+» → «Сканировать QR» → наведите камеру на код",
      steps: [
        "Откройте приложение V2RayTun на Android",
        "Нажмите «+» в верхней панели",
        "Выберите «Сканировать QR-код» или «Импорт из буфера обмена»",
        "Сервер добавится автоматически",
        "Выберите сервер и нажмите кнопку подключения",
      ],
    },
  ],
  macos: [
    {
      id: "happ-macos",
      name: "Happ",
      jsonFormat: true,
      storeLabel: "App Store",
      downloadUrl: "https://apps.apple.com/ru/app/happ-proxy-utility-plus/id6746188973",
      qrHint: "Откройте Happ → «+» → «Сканировать QR-код с экрана» → выделите код мышкой",
      steps: [
        "Откройте Happ на Mac",
        "Нажмите «+» → «Сканировать QR-код с экрана» или «Добавить подписку»",
        "Конфигурация импортируется автоматически",
        "Нажмите подключиться, введите пароль Mac при запросе",
      ],
    },
  ],
  windows: [
    {
      id: "happ-windows",
      name: "Happ",
      jsonFormat: true,
      storeLabel: "Скачать с сайта",
      downloadUrl: "https://www.happ.su/main",
      qrHint: "Откройте Happ → «+» → «Сканировать QR с экрана» → выделите код мышкой",
      steps: [
        "Откройте Happ на компьютере",
        "Нажмите «+» → «Добавить подписку» или «Сканировать QR-код с экрана»",
        "Конфигурация импортируется автоматически",
        "Нажмите подключиться, разрешите доступ в брандмауэре при запросе",
      ],
    },
  ],
  tv: [
    {
      id: "v2raytun-tv",
      name: "V2RayTun",
      storeLabel: "Google Play на TV",
      downloadUrl: "https://play.google.com/store/apps/details?id=com.v2raytun.android",
      qrHint: "Откройте V2RayTun на TV → «+» → «Сканировать QR» → покажите код камере телефона",
      steps: [
        "Откройте V2RayTun на Android TV",
        "Нажмите «+» → «Сканировать QR-код»",
        "Покажите QR-код с этой страницы перед камерой TV (или телефоном)",
        "Сервер добавится автоматически",
        "Выберите сервер и нажмите подключиться пультом",
      ],
    },
  ],
};

const PLATFORMS: { id: Platform; name: string; detail: string; icon: IconName }[] = [
  { id: "ios",     name: "iPhone / iPad", detail: "iOS 16+",    icon: "iphone" },
  { id: "android", name: "Android",       detail: "10+",        icon: "android" },
  { id: "macos",   name: "macOS",         detail: "M1 / Intel", icon: "macos" },
  { id: "windows", name: "Windows",       detail: "10 / 11",    icon: "windows" },
  { id: "tv",      name: "Android TV",    detail: "Google TV",  icon: "tv" },
];

const DEVICE_WORD = plural(DEVICE_LIMIT, ["устройстве", "устройствах", "устройствах"]);

function prefersStill(): boolean {
  return (
    document.documentElement.hasAttribute("data-static") ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function AddDeviceView() {
  const [platform, setPlatform] = useState<Platform>("ios");
  const [appIndex, setAppIndex] = useState(0);

  const [vpnKey, setVpnKey] = useState<string | null>(null);
  const [keyLoaded, setKeyLoaded] = useState(false);
  const [bk, setBk] = useState<SubscriptionData["bypassKey"] | null>(null);
  const [owed, setOwed] = useState(0);
  const [copied, setCopied] = useState<0 | 1 | 2>(0);
  const [showQR, setShowQR] = useState<0 | 1 | 2>(0);
  const stepsRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);

  const fetchKey = useCallback(async () => {
    try {
      const res = await fetch("/api/user/subscription");
      const r = await res.json();
      if (r.success && r.data.vpnKey) setVpnKey(r.data.vpnKey);
      if (r.success) {
        setBk(r.data.bypassKey ?? null);
        setOwed(r.data.bypassOwedBytes ?? 0);
      }
    } catch { /* silent */ }
    finally { setKeyLoaded(true); }
  }, []);
  const { live, status: liveStatus } = useBypassLive(keyLoaded && !!(bk?.known || bk?.maybe || owed > 0));

  useEffect(() => { fetchKey(); }, [fetchKey]);
  useEffect(() => { firstRender.current = false; }, []);

  const selectedApps = APPS[platform];
  const currentApp = selectedApps[appIndex] ?? selectedApps[0];

  const forApp = useCallback(
    (raw: string | null) => (raw ? (currentApp?.jsonFormat ? withJsonFormat(raw) : raw) : null),
    [currentApp]
  );

  const handleSelectPlatform = (p: Platform) => {
    setPlatform(p);
    setAppIndex(0);
    setShowQR(0);
    setCopied(0);
    if (firstRender.current) return;
    setTimeout(() => {
      stepsRef.current?.scrollIntoView({ behavior: prefersStill() ? "auto" : "smooth", block: "start" });
    }, 20);
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

  const keyUrl = forApp(vpnKey);
  const key2Url = forApp(live?.subscriptionUrl ?? bk?.subscriptionUrl ?? null);
  const owedNow = live ? live.owedBytes : owed;

  const keyActions = (n: 1 | 2, url: string | null, what: string) => (
    <>
      <div className="vad-actions">
        <button
          type="button"
          onClick={() => handleCopy(n, url)}
          disabled={!url}
          className={`v-btn v-btn-sm ${n === 1 ? "v-btn-primary" : "v-btn-outline"}`}
        >
          <Icon name={copied === n ? "check" : "copy"} size={16} />
          {copied === n ? "Скопировано" : "Скопировать ссылку"}
          <span className="v-sr"> — {what}</span>
        </button>
        <button
          type="button"
          onClick={() => setShowQR((v) => (v === n ? 0 : n))}
          disabled={!url}
          aria-pressed={showQR === n}
          className="v-btn v-btn-sm v-btn-outline"
        >
          <Icon name="qr" size={16} />
          {showQR === n ? "Скрыть QR-код" : "Показать QR-код"}
          <span className="v-sr"> — {what}</span>
        </button>
      </div>
      {showQR === n && url && (
        <figure className="vad-qr">
          <QRCodeSVG value={url} size={192} bgColor="#ffffff" fgColor="#0B0B0F" level="M" />
          <figcaption>{currentApp.qrHint}</figcaption>
        </figure>
      )}
    </>
  );

  return (
    <VShell work account="member">
      <section className="v-section vad-top" aria-labelledby="vad-title">
        <div className="v-wrap v-narrow">
          <Link href="/dashboard" className="vad-back">
            <Icon name="arrow-right" size={16} /> В кабинет
          </Link>
          <h1 id="vad-title" className="v-h2">Новое <span className="v-accent">устройство</span></h1>
          <p className="v-lead" style={{ marginInline: 0 }}>
            Выберите устройство — покажем, что нажать. Одна подписка работает на {DEVICE_LIMIT} {DEVICE_WORD}.
          </p>

          {/* ── Плитки устройств ─────────────────────────────────── */}
          <div className="vad-grid" role="group" aria-label="Устройство">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="vad-tile"
                aria-pressed={platform === p.id}
                onClick={() => handleSelectPlatform(p.id)}
              >
                <Icon name={p.icon} size={26} className="vad-tile-icon" />
                <span>
                  <span className="vad-tile-name" style={{ display: "block" }}>{p.name}</span>
                  <span className="vad-tile-detail">{p.detail}</span>
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
                <p>Бесплатное приложение для {PLATFORMS.find((p) => p.id === platform)!.name}.</p>
                {selectedApps.length > 1 && (
                  <div className="v-seg vad-apps" role="tablist" aria-label="Приложение">
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
                  {/^скачать/i.test(currentApp.storeLabel) ? currentApp.storeLabel : `Открыть ${currentApp.storeLabel}`}
                  <span className="v-sr"> (откроется в новой вкладке)</span>
                </a>
              </li>

              <li className="v-step">
                <div className="v-step-head">
                  <span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span>
                  <h3>Добавьте подписку</h3>
                </div>

                <p className="vad-kicker">{MAIN_KEY.member.title}</p>
                <p style={{ margin: "0 0 4px", color: "var(--v-ink-3)", fontSize: 15 }}>{MAIN_KEY.member.text}</p>
                {keyUrl ? (
                  <div className="vad-key">{keyUrl}</div>
                ) : (
                  <div className="vad-key" aria-busy="true">{keyLoaded ? "Ключ не найден — проверьте подписку в кабинете." : "Секунду, загружаем ключ…"}</div>
                )}
                {keyActions(1, keyUrl, MAIN_KEY.member.title)}

                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--v-line)" }}>
                  <p className="vad-kicker">{BYPASS_KEY.member.title}</p>
                  <p style={{ margin: "0 0 4px", color: "var(--v-ink-3)", fontSize: 15 }}>{BYPASS_KEY.member.text}</p>
                  {(!keyLoaded || liveStatus === "loading") && !key2Url ? (
                    <div className="vad-key" aria-busy="true">Секунду, проверяем ключ…</div>
                  ) : key2Url ? (
                    <>
                      {live?.state === "ok" && !live.unlimited && (
                        <p className="vad-left">
                          Осталось <b>{formatBytes(live.remainingBytes ?? 0)}</b> из {formatBytes(live.limitBytes ?? 0)}
                        </p>
                      )}
                      <div className="vad-key">{key2Url}</div>
                      {keyActions(2, key2Url, BYPASS_KEY.member.title)}
                      <div className="vad-actions">
                        <Link href={BUY_TRAFFIC_HREF} className="v-btn v-btn-sm v-btn-outline">Докупить гигабайты</Link>
                      </div>
                    </>
                  ) : owedNow > 0 ? (
                    <p style={{ color: "var(--v-ink-3)", fontSize: 15 }}>
                      Гигабайты оплачены и зачисляются — ключ появится здесь через пару минут.
                    </p>
                  ) : (
                    <>
                      <p style={{ color: "var(--v-ink-3)", fontSize: 15, marginBottom: 14 }}>
                        Ключа «Обход» пока нет. Купите пакет трафика — ключ появится сразу после оплаты.
                      </p>
                      <Link href={BUY_TRAFFIC_HREF} className="v-btn v-btn-primary v-btn-block">Получить ключ «Обход»</Link>
                    </>
                  )}
                </div>
                <p className="v-sr" role="status" aria-live="polite">
                  {copied ? `Ссылка скопирована: ${copied === 1 ? MAIN_KEY.member.title : BYPASS_KEY.member.title}` : ""}
                </p>
              </li>

              <li className="v-step">
                <div className="v-step-head">
                  <span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span>
                  <h3>Подключитесь</h3>
                </div>
                <p>Нажмите кнопку подключения в {currentApp.name}. Выберите страну из списка — дальше всё работает само.</p>
                <p className="vad-switch">{SWITCH_HINT.member}</p>

                <details className="vad-manual">
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

                <Link href="/dashboard" className="v-btn v-btn-primary v-btn-block" style={{ marginTop: 20 }}>
                  <Icon name="check" size={18} /> Готово — в кабинет
                </Link>
              </li>
            </ol>
          </div>
        </div>
      </section>
    </VShell>
  );
}
