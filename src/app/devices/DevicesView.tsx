"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { BUY_TRAFFIC_HREF, bypassKey, mainKey, switchHint, type KeyAudience } from "@/lib/key-names";
import { formatBytes, useBypassLive, withJsonFormat } from "@/lib/use-bypass";
import { TRAFFIC_TRIAL_MB } from "@/lib/traffic-packs";
import type { SubscriptionData } from "@/types";
import { APPS, PLATFORMS, detectPlatform, pick, type Platform } from "@/lib/apps";
import type { Dict } from "@/i18n";
import { fill } from "@/lib/text/fill";
import { localeHref, type Locale } from "@/lib/locale";
import "./devices-vps.css";

/**
 * /devices — корпус Atlas Secure VPS (образец IMG_1767/1768: заголовок
 * с синим словом, короткий лид, плитки устройств, пунктирные шаги
 * `.v-steps`).
 *
 * Приложения, платформы и все ссылки — единственный источник
 * `src/lib/apps.ts` (17.09.2026): Happ/Incy/V2RayTun выбираются
 * карточками-переключателями, установка — первая ссылка крупной
 * кнопкой + остальные пилюлями, «Добавьте подписку» — открытие через
 * `app.openUrl`, «Подключитесь» — пронумерованные `app.steps`.
 *
 * Экран клиентский (выбор платформы, копирование ключа, QR), поэтому
 * текст приходит пропсом `t` от серверной обёртки: импортируй он
 * словарь сам — в браузер уехали бы оба языка.
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

export default function DevicesView({
  hasSession,
  locale,
  t,
}: {
  hasSession: boolean;
  locale: Locale;
  t: Dict["devices"];
}) {
  const to = (href: string) => localeHref(href, locale);
  const [platform, setPlatform] = useState<Platform>("ios");
  const [appIndex, setAppIndex] = useState(0);

  // Предвыбор платформы: ?platform= (старые ссылки бота, писем,
  // закладок) → иначе по userAgent → иначе iOS по умолчанию.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("platform");
    if (q && PLATFORMS.some((p) => p.id === q)) {
      setPlatform(q as Platform);
      return;
    }
    const detected = detectPlatform(navigator.userAgent);
    if (detected) setPlatform(detected);
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
  const main = mainKey(aud, locale);
  const bypass = bypassKey(aud, locale);

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

  const handleOpenInApp = (key: string | null) => {
    if (!key || !currentApp?.openUrl) return;
    window.location.href = currentApp.openUrl(key);
  };

  const keyUrl = forApp(vpnKey);
  const key2Url = forApp(live?.subscriptionUrl ?? bk?.subscriptionUrl ?? null);
  const owedNow = live ? live.owedBytes : owed;

  /** Кнопки одного ключа: открыть в приложении, скопировать, QR. */
  const keyActions = (n: 1 | 2, url: string | null, what: string) => (
    <>
      <div className="vd-actions">
        {currentApp.openUrl && (
          <button
            type="button"
            onClick={() => handleOpenInApp(url)}
            disabled={!url}
            className={`v-btn v-btn-sm ${n === 1 ? "v-btn-primary" : "v-btn-outline"}`}
          >
            {fill(t.openIn, { app: currentApp.name })}<span className="v-sr"> — {what}</span>
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
              {t.copied}
            </>
          ) : (
            t.copy
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
          {showQR === n ? t.hideQr : t.showQr}
          <span className="v-sr"> — {what}</span>
        </button>
      </div>
      {showQR === n && url && (
        <figure className="vd-qr">
          <QRCodeSVG value={url} size={176} bgColor="#ffffff" fgColor="#0B0B0F" level="M" />
          <figcaption>{t.qrCaption}</figcaption>
        </figure>
      )}
    </>
  );

  return (
    <>
      <section className="v-section v-center" aria-labelledby="vd-title">
        <div className="v-wrap v-narrow">
          <h1 id="vd-title" className="v-h2">
            {t.title} <span className="v-accent">{t.titleAccent}</span>
          </h1>
          <p className="v-lead">{t.lead}</p>

          {/* ── Плитки устройств ─────────────────────────────────── */}
          <div className="vd-grid v-stagger" role="group" aria-label={t.deviceGroup}>
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="vd-tile v-lift"
                aria-pressed={platform === p.id}
                onClick={() => handleSelectPlatform(p.id)}
              >
                <Icon name={PLATFORM_ICON[p.id]} size={26} className="vd-tile-icon" />
                <span className="vd-tile-copy">
                  <span className="vd-tile-name">{p.name}</span>
                  <span className="vd-tile-detail">{p.detail}</span>
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
                  <h3>{t.step1}</h3>
                </div>
                <p>{pick(currentApp.note, locale)}</p>

                {selectedApps.length > 1 && (
                  <div className="vd-apps-grid" role="group" aria-label={t.appGroup}>
                    {selectedApps.map((a, i) => (
                      <button
                        key={a.id}
                        type="button"
                        className="vd-app-card v-lift"
                        aria-pressed={i === appIndex}
                        onClick={() => handleSelectApp(i)}
                      >
                        {i === 0 && (
                          <span className="v-badge v-badge-blue vd-app-badge">{t.recommended}</span>
                        )}
                        <span className="vd-app-name">{a.name}</span>
                        <span className="vd-app-note">{pick(a.note, locale)}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="vd-install">
                  <a
                    href={currentApp.links[0].href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="v-btn v-btn-outline v-btn-block"
                  >
                    <StoreGlyph label={pick(currentApp.links[0].label, locale)} />
                    {storeAction(pick(currentApp.links[0].label, locale), t.openStore)}
                    <span className="v-sr">{t.newTab}</span>
                  </a>
                  {currentApp.links.length > 1 && (
                    <div className="vd-install-more">
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
                  <h3>{t.step2}</h3>
                </div>

                {signedIn === false ? (
                  <div className="vd-guest">
                    <p>{t.guestKey}</p>
                    <Link href={to("/auth")} className="v-btn v-btn-primary v-btn-block">{t.guestCta}</Link>
                  </div>
                ) : (
                  <>
                    <p className="vd-kicker">{main.title}</p>
                    <p style={{ margin: "0 0 4px", color: "var(--v-ink-3)", fontSize: 15 }}>{main.text}</p>
                    {keyUrl ? (
                      <div className="vd-key">{keyUrl}</div>
                    ) : (
                      <div className="vd-key" aria-busy="true">{t.loadingKey}</div>
                    )}
                    {keyActions(1, keyUrl, main.title)}

                    {/* Ключ 2 · Обход — только вошедшему: пробные мегабайты или купленный пакет. */}
                    {aud === "member" && (
                      <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--v-line)" }}>
                        <p className="vd-kicker">{bypass.title}</p>
                        <p style={{ margin: "0 0 4px", color: "var(--v-ink-3)", fontSize: 15 }}>{bypass.text}</p>
                        {liveStatus === "loading" && !key2Url ? (
                          <div className="vd-key" aria-busy="true">{t.checkingKey}</div>
                        ) : key2Url ? (
                          <>
                            {live?.state === "ok" && !live.unlimited && (
                              <p className="vd-left">
                                {t.left} <b>{formatBytes(live.remainingBytes ?? 0)}</b> {t.leftOf} {formatBytes(live.limitBytes ?? 0)}
                              </p>
                            )}
                            <div className="vd-key">{key2Url}</div>
                            {keyActions(2, key2Url, bypass.title)}
                            <div className="vd-actions">
                              <Link href={to(BUY_TRAFFIC_HREF)} className="v-btn v-btn-sm v-btn-outline">{t.buyGb}</Link>
                            </div>
                          </>
                        ) : owedNow > 0 ? (
                          <p style={{ color: "var(--v-ink-3)", fontSize: 15 }}>
                            {t.gbPending}
                          </p>
                        ) : (
                          <div className="vd-guest">
                            <p>{t.noBypass}</p>
                            <Link href={to(BUY_TRAFFIC_HREF)} className="v-btn v-btn-primary v-btn-block">{t.getBypass}</Link>
                          </div>
                        )}
                      </div>
                    )}

                    {aud === "guest" && signedIn === true && (
                      <p style={{ marginTop: 14, color: "var(--v-ink-3)", fontSize: 15 }}>
                        {fill(t.boostedSoon, { mb: TRAFFIC_TRIAL_MB })}{" "}
                        <Link href={to("/pricing#traffic")} className="v-link">{t.trafficPacks}</Link>
                      </p>
                    )}
                  </>
                )}
                <p className="v-sr" role="status" aria-live="polite">
                  {copied ? fill(t.copiedLive, { what: copied === 1 ? main.title : bypass.title }) : ""}
                </p>
              </li>

              <li className="v-step">
                <div className="v-step-head">
                  <span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span>
                  <h3>{t.step3}</h3>
                </div>
                <ol className="vd-connect">
                  {pick(currentApp.steps, locale).map((s, i) => (
                    <li key={i}>
                      <span className="vd-connect-num" aria-hidden>{i + 1}</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
                {aud === "member" && <p className="vd-switch">{switchHint(aud, locale)}</p>}

                {/* Живая инструкция по шагам — только для Happ (/install-happ). */}
                {currentApp.id === "happ" && (
                  <Link href={to("/install-happ")} className="v-link vd-walkthrough">
                    {t.walkthrough}
                  </Link>
                )}

                <Link href={to("/support")} className="v-btn v-btn-primary v-btn-block" style={{ marginTop: 20 }}>
                  <Icon name="chat" size={20} /> {t.support}
                </Link>
              </li>
            </ol>
          </div>

          <p className="v-small vd-note">
            {t.notFoundBefore}{" "}
            <Link href={to("/contact")} className="v-link" style={{ display: "inline-flex", alignItems: "center", minHeight: 44 }}>{t.notFoundLink}</Link>{" "}
            {t.notFoundAfter}
          </p>
        </div>
      </section>
    </>
  );
}
