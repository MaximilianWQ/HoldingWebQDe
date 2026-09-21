"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { BUY_TRAFFIC_HREF, bypassKey, mainKey, switchHint } from "@/lib/key-names";
import { formatBytes, useBypassLive, withJsonFormat } from "@/lib/use-bypass";
import type { SubscriptionData } from "@/types";
import { APPS, PLATFORMS, detectPlatform, pick, type Platform } from "@/lib/apps";
import type { Dict } from "@/i18n";
import { fill } from "@/i18n";
import { localeHref, type Locale } from "@/lib/locale";
import "./add-device-vps.css";

/**
 * /add-device — корпус Atlas Secure VPS, тот же язык, что /devices:
 * плитки устройств и пунктирные шаги в одной непрерывной ленте, без
 * отдельных экранов мастера. Экран только для вошедших — слова «VPN»
 * и «Обход» уместны (MAIN_KEY.member / BYPASS_KEY.member).
 *
 * Приложения, платформы и все ссылки — единственный источник
 * `src/lib/apps.ts` (17.09.2026), как на /devices: карточки Happ/Incy/
 * V2RayTun, установка — первая ссылка кнопкой + остальные пилюлями,
 * «Добавьте подписку» — открытие через `app.openUrl`, «Подключитесь» —
 * пронумерованные `app.steps`.
 *
 * Логика перенесена без изменений: platform → app (если их несколько)
 * → ключ 1 «Основной VPN» + ключ 2 «Обход» с остатком гигабайт, QR,
 * копирование с запасным путём через textarea, ручные шаги, «Готово» —
 * в кабинет. Запрос один: /api/user/subscription, ошибка — молча;
 * остаток ключа 2 — /api/user/bypass после первой отрисовки.
 *
 * Что убрано (декоративное/повтор, не логика):
 *   · подсказка платформы по userAgent — теперь есть предвыбор по
 *     userAgent (как на /devices), гость по-прежнему может переключить
 *     платформу сам;
 *   · отдельная всегда открытая QR-плитка — QR теперь за кнопкой
 *     «Показать QR-код» у каждого ключа, как на /devices (тот же
 *     код, без второй копии на странице).
 */

const PLATFORM_ICON: Record<Platform, IconName> = {
  ios: "iphone",
  android: "android",
  macos: "macos",
  windows: "windows",
  tv: "tv",
};

/**
 * Подпись кнопки магазина. «Скачать для Windows» / «Download for
 * Windows» — уже глагол, к остальным нужен свой: «Открыть App Store».
 * Проверка по обоим языкам: список ссылок один, а подписи разные.
 */
function storeAction(label: string, open: string): string {
  return /^(скачать|download)/i.test(label) ? label : fill(open, { store: label });
}

/** Значок магазина перед подписью — Apple/Google, для установщиков — стрелка загрузки. */
function StoreGlyph({ label }: { label: string }) {
  if (/app store/i.test(label)) {
    return (
      <svg width="16" height="18" viewBox="0 0 28 34" fill="currentColor" aria-hidden focusable="false">
        <path d="M23.3 18.1c0-4.3 3.5-6.4 3.7-6.5-2-2.9-5.2-3.4-6.3-3.4-2.7-.3-5.2 1.6-6.6 1.6-1.4 0-3.5-1.5-5.7-1.5-2.9 0-5.6 1.7-7.1 4.4-3 5.3-.8 13.1 2.2 17.4 1.4 2.1 3.1 4.4 5.4 4.3 2.2-.1 3-1.4 5.6-1.4s3.4 1.4 5.7 1.4c2.4 0 3.9-2.1 5.3-4.2 1.7-2.4 2.4-4.8 2.4-4.9-.1 0-4.6-1.8-4.6-7.2zM19 5.4c1.2-1.4 2-3.4 1.8-5.4-1.7.1-3.8 1.2-5 2.6-1.1 1.3-2.1 3.3-1.8 5.3 1.9.1 3.8-1 5-2.5z" />
      </svg>
    );
  }
  if (/google play/i.test(label)) {
    return (
      <svg width="16" height="18" viewBox="0 0 30 32" aria-hidden focusable="false">
        <path d="M1.2 1.1 16.8 16 1.2 30.9c-.5-.3-.8-.9-.8-1.6V2.7c0-.7.3-1.3.8-1.6z" fill="#00D7FE" />
        <path d="M21.9 11.1 16.8 16 1.2 1.1c.3-.2.8-.3 1.2-.2.3 0 .5.1.8.3z" fill="#00F076" />
        <path d="M21.9 20.9 3.2 31.3c-.3.2-.6.3-.8.3-.4 0-.8-.1-1.2-.3L16.8 16z" fill="#FF3A44" />
        <path d="m28.2 14.4-6.3-3.3-5.1 4.9 5.1 4.9 6.3-3.3c1.3-.7 1.3-2.5 0-3.2z" fill="#FFD400" />
      </svg>
    );
  }
  return <Icon name="download" size={16} />;
}

function prefersStill(): boolean {
  return (
    document.documentElement.hasAttribute("data-static") ||
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// ─── Main Component ─────────────────────────────────────────

export default function AddDeviceView({
  locale,
  t,
  td,
  lead,
}: {
  locale: Locale;
  t: Dict["addDevice"];
  /** Общие с /devices подписи: шаги, кнопки ключа, QR. */
  td: Dict["devices"];
  /** Лид со вставленным числом устройств — считает серверная обёртка. */
  lead: string;
}) {
  const to = (href: string) => localeHref(href, locale);
  const main = mainKey("member", locale);
  const bypass = bypassKey("member", locale);
  const [platform, setPlatform] = useState<Platform>("ios");
  const [appIndex, setAppIndex] = useState(0);

  // Предвыбор платформы по userAgent — гость может переключить сам.
  useEffect(() => {
    const detected = detectPlatform(navigator.userAgent);
    if (detected) setPlatform(detected);
  }, []);

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

  const handleOpenInApp = (key: string | null) => {
    if (!key || !currentApp?.openUrl) return;
    window.location.href = currentApp.openUrl(key);
  };

  const keyUrl = forApp(vpnKey);
  const key2Url = forApp(live?.subscriptionUrl ?? bk?.subscriptionUrl ?? null);
  const owedNow = live ? live.owedBytes : owed;

  const keyActions = (n: 1 | 2, url: string | null, what: string) => (
    <>
      <div className="vad-actions">
        {currentApp.openUrl && (
          <button
            type="button"
            onClick={() => handleOpenInApp(url)}
            disabled={!url}
            className={`v-btn v-btn-sm ${n === 1 ? "v-btn-primary" : "v-btn-outline"}`}
          >
            {fill(td.openIn, { app: currentApp.name })}<span className="v-sr"> — {what}</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => handleCopy(n, url)}
          disabled={!url}
          className="v-btn v-btn-sm v-btn-outline"
        >
          <Icon name={copied === n ? "check" : "copy"} size={16} />
          {copied === n ? td.copied : td.copy}
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
          {showQR === n ? td.hideQr : td.showQr}
          <span className="v-sr"> — {what}</span>
        </button>
      </div>
      {showQR === n && url && (
        <figure className="vad-qr">
          <QRCodeSVG value={url} size={192} bgColor="#ffffff" fgColor="#0B0B0F" level="M" />
          <figcaption>{td.qrCaption}</figcaption>
        </figure>
      )}
    </>
  );

  return (
    <>
      <section className="v-section vad-top" aria-labelledby="vad-title">
        <div className="v-wrap v-narrow">
          <Link href={to("/dashboard")} className="vad-back">
            <Icon name="arrow-right" size={16} /> {t.back}
          </Link>
          <h1 id="vad-title" className="v-h2">{t.title} <span className="v-accent">{t.titleAccent}</span></h1>
          <p className="v-lead" style={{ marginInline: 0 }}>{lead}</p>

          {/* ── Плитки устройств ─────────────────────────────────── */}
          <div className="vad-grid v-stagger" role="group" aria-label={td.deviceGroup}>
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="vad-tile v-lift"
                aria-pressed={platform === p.id}
                onClick={() => handleSelectPlatform(p.id)}
              >
                <Icon name={PLATFORM_ICON[p.id]} size={26} className="vad-tile-icon" />
                <span>
                  <span className="vad-tile-name" style={{ display: "block" }}>{p.name}</span>
                  <span className="vad-tile-detail">{p.detail}</span>
                </span>
              </button>
            ))}
          </div>

          {/* ── Шаги для выбранной платформы ─────────────────────── */}
          <div ref={stepsRef} style={{ scrollMarginTop: "var(--v-head-h)" }}>
            <ol className="v-steps v-fade-in" key={`${platform}:${currentApp?.id}`}>
              <li className="v-step">
                <div className="v-step-head">
                  <span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span>
                  <h3>{td.step1}</h3>
                </div>
                <p>{pick(currentApp.note, locale)}</p>

                {selectedApps.length > 1 && (
                  <div className="vad-apps-grid" role="group" aria-label={td.appGroup}>
                    {selectedApps.map((a, i) => (
                      <button
                        key={a.id}
                        type="button"
                        className="vad-app-card v-lift"
                        aria-pressed={i === appIndex}
                        onClick={() => handleSelectApp(i)}
                      >
                        {i === 0 && (
                          <span className="v-badge v-badge-blue vad-app-badge">{td.recommended}</span>
                        )}
                        <span className="vad-app-name">{a.name}</span>
                        <span className="vad-app-note">{pick(a.note, locale)}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="vad-install">
                  <a
                    href={currentApp.links[0].href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="v-btn v-btn-outline v-btn-block"
                  >
                    <StoreGlyph label={pick(currentApp.links[0].label, locale)} />
                    {storeAction(pick(currentApp.links[0].label, locale), td.openStore)}
                    <span className="v-sr">{td.newTab}</span>
                  </a>
                  {currentApp.links.length > 1 && (
                    <div className="vad-install-more">
                      {currentApp.links.slice(1).map((l) => (
                        <a
                          key={l.href}
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="v-btn v-btn-outline v-btn-sm"
                        >
                          <StoreGlyph label={pick(l.label, locale)} />
                          {pick(l.label, locale)}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </li>

              <li className="v-step">
                <div className="v-step-head">
                  <span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span>
                  <h3>{td.step2}</h3>
                </div>

                <p className="vad-kicker">{main.title}</p>
                <p style={{ margin: "0 0 4px", color: "var(--v-ink-3)", fontSize: 15 }}>{main.text}</p>
                {keyUrl ? (
                  <div className="vad-key">{keyUrl}</div>
                ) : (
                  <div className="vad-key" aria-busy="true">{keyLoaded ? t.keyNotFound : td.loadingKey}</div>
                )}
                {keyActions(1, keyUrl, main.title)}

                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--v-line)" }}>
                  <p className="vad-kicker">{bypass.title}</p>
                  <p style={{ margin: "0 0 4px", color: "var(--v-ink-3)", fontSize: 15 }}>{bypass.text}</p>
                  {(!keyLoaded || liveStatus === "loading") && !key2Url ? (
                    <div className="vad-key" aria-busy="true">{td.checkingKey}</div>
                  ) : key2Url ? (
                    <>
                      {live?.state === "ok" && !live.unlimited && (
                        <p className="vad-left">
                          {td.left} <b>{formatBytes(live.remainingBytes ?? 0)}</b> {td.leftOf} {formatBytes(live.limitBytes ?? 0)}
                        </p>
                      )}
                      <div className="vad-key">{key2Url}</div>
                      {keyActions(2, key2Url, bypass.title)}
                      <div className="vad-actions">
                        <Link href={to(BUY_TRAFFIC_HREF)} className="v-btn v-btn-sm v-btn-outline">{td.buyGb}</Link>
                      </div>
                    </>
                  ) : owedNow > 0 ? (
                    <p style={{ color: "var(--v-ink-3)", fontSize: 15 }}>
                      {td.gbPending}
                    </p>
                  ) : (
                    <>
                      <p style={{ color: "var(--v-ink-3)", fontSize: 15, marginBottom: 14 }}>
                        {td.noBypass}
                      </p>
                      <Link href={to(BUY_TRAFFIC_HREF)} className="v-btn v-btn-primary v-btn-block">{td.getBypass}</Link>
                    </>
                  )}
                </div>
                <p className="v-sr" role="status" aria-live="polite">
                  {copied ? fill(td.copiedLive, { what: copied === 1 ? main.title : bypass.title }) : ""}
                </p>
              </li>

              <li className="v-step">
                <div className="v-step-head">
                  <span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span>
                  <h3>{td.step3}</h3>
                </div>
                <ol className="vad-connect">
                  {pick(currentApp.steps, locale).map((s, i) => (
                    <li key={i}>
                      <span className="vad-connect-num" aria-hidden>{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
                <p className="vad-switch">{switchHint("member", locale)}</p>

                <Link href={to("/dashboard")} className="v-btn v-btn-primary v-btn-block" style={{ marginTop: 20 }}>
                  <Icon name="check" size={18} /> {t.done}
                </Link>
              </li>
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
