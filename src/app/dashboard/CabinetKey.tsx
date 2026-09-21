"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { TELEGRAM_BONUS_DAYS, TRIAL_DAYS } from "@/lib/brand-facts";
import { DEVICE_LIMIT } from "@/lib/plans";
import { BUY_TRAFFIC_HREF, bypassKey, mainKey, switchHint } from "@/lib/key-names";
import { formatBytes, useBypassLive, withJsonFormat } from "@/lib/use-bypass";
import { APPS, detectPlatform, pick, type AppId, type ClientApp, type Platform } from "@/lib/apps";
import type { Dict } from "@/i18n";
import { fill } from "@/lib/text/fill";
import { count, pluralize } from "@/lib/text/plural";
import { localeHref, type Locale } from "@/lib/locale";
import type { SubscriptionData } from "@/types";

/**
 * Кабинет · «Главная» (владелец, 17.09.2026: «перенеси UX/UI из
 * прежнего сайта, особенно в дашборд»). Доска `.v-bento`: тёмная плита
 * подписки с кольцом прогресса, живая плитка «Сеть сейчас», плитки
 * быстрых действий (2×2 на телефоне), «Первые шаги» на пробном периоде
 * и два ключа подключения с выбором приложения Happ/Incy.
 *
 * Приложение для ключей — общий выбор на оба ключа (человек подключает
 * оба через один клиент): платформа определяется один раз по
 * navigator.userAgent (src/lib/apps.ts, detectPlatform), по умолчанию
 * Happ. Для Happ ссылка подписки идёт в формате json (withJsonFormat) —
 * как на /devices и /add-device.
 *
 * Вся логика ключей — как раньше: буфер обмена с запасным вариантом,
 * QR, остаток обхода после первой отрисовки (useBypassLive).
 *
 * Подписи приходят пропсом `t` от серверной обёртки: экран клиентский,
 * и импортируй он словарь сам — в браузер уехали бы оба языка. Формы
 * слов после числа («день/дня/дней», "day/days") берутся из `units` и
 * выбираются `pluralize()` — у английского форм две, у русского три.
 */

type T = Dict["cabinet"]["key"];
type U = Dict["units"];

function humanRemaining(days: number, hours: number, locale: Locale, t: T, u: U): string {
  if (days <= 0) return hours > 0 ? count(locale, hours, u.hour) : t.lessHour;
  const years = Math.floor(days / 365);
  if (years >= 1) {
    const months = Math.floor((days - years * 365) / 30);
    const y = count(locale, years, u.year);
    return months ? `${y} ${count(locale, months, u.month)}` : y;
  }
  const months = Math.floor(days / 30);
  if (months >= 1) {
    const rest = days - months * 30;
    const m = count(locale, months, u.month);
    return rest ? `${m} ${count(locale, rest, u.day)}` : m;
  }
  return count(locale, days, u.day);
}

/** Компактная пара «число + единица» в кольцо (365 дней в кружке не влезли бы). */
function ringParts(days: number, hours: number, locale: Locale, t: T, u: U): { n: string; unit: string } {
  if (days <= 0) return hours > 0 ? { n: String(hours), unit: pluralize(locale, hours, u.hour) } : { n: "<1", unit: t.ringLtHour };
  const years = Math.floor(days / 365);
  if (years >= 1) return { n: String(years), unit: pluralize(locale, years, u.year) };
  const months = Math.floor(days / 30);
  if (months >= 1) return { n: String(months), unit: pluralize(locale, months, u.month) };
  return { n: String(days), unit: pluralize(locale, days, u.day) };
}

function hostOf(url: string, fallback: string): string {
  try {
    return new URL(url).host;
  } catch {
    return fallback;
  }
}

/** Переключатель Happ / Incy — общий на оба ключа. */
function AppSwitcher({ apps, appId, onChange, label }: { apps: ClientApp[]; appId: AppId; onChange: (id: AppId) => void; label: string }) {
  if (apps.length < 2) return null;
  return (
    <div className="v-seg vc-app-seg" role="tablist" aria-label={label}>
      {apps.map((a) => (
        <button key={a.id} type="button" role="tab" aria-selected={appId === a.id} onClick={() => onChange(a.id)}>
          {a.name}
        </button>
      ))}
    </div>
  );
}

function KeyActions({ url, app, primary, what, locale, t }: { url: string; app: ClientApp; primary: boolean; what: string; locale: Locale; t: T }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const appUrl = app.jsonFormat ? withJsonFormat(url) : url;
  const openHref = app.openUrl ? app.openUrl(appUrl) : null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFallback(true);
    }
  };
  return (
    <>
      <div className="vc-strip">
        <span>{hostOf(appUrl, t.subLink)}/…</span>
        <span className="vc-strip-dots" aria-hidden>
          {[0, 1, 2, 3, 4].map((k) => <i key={k} />)}
        </span>
      </div>
      {showQr && (
        <div className="vc-qr">
          <QRCodeSVG value={appUrl} size={188} level="M" marginSize={2} />
          <p className="v-small" style={{ margin: 0 }}>{fill(t.qrHint, { app: app.name })}</p>
        </div>
      )}
      {fallback && (
        <div className="vc-fine">
          {t.copyManual} <code>{appUrl}</code>
        </div>
      )}
      <div className="vc-actions">
        {openHref && (
          <a href={openHref} className={`v-btn v-btn-sm ${primary ? "v-btn-primary" : "v-btn-soft"}`}>
            <Icon name="bolt" size={16} />
            {fill(t.openIn, { app: app.name })}<span className="v-sr"> — {what}</span>
          </a>
        )}
        <button type="button" onClick={copy} className="v-btn v-btn-soft v-btn-sm">
          <Icon name={copied ? "check" : "copy"} size={16} />
          {copied ? t.copied : t.copy}
          <span className="v-sr"> — {what}</span>
        </button>
        <button type="button" onClick={() => setShowQr((v) => !v)} className="v-btn v-btn-soft v-btn-sm" aria-expanded={showQr}>
          <Icon name="qr" size={16} />
          {showQr ? t.hideQr : t.qr}
          <span className="v-sr"> — {what}</span>
        </button>
      </div>
      {app.links.length > 0 && (
        <div className="vc-app-links">
          {app.links.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={`vc-app-link ${l.secondary ? "vc-app-link-sec" : ""}`}>
              <Icon name="download" size={14} />
              {pick(l.label, locale)}
            </a>
          ))}
        </div>
      )}
      <p className="v-sr" role="status" aria-live="polite">{copied ? fill(t.copiedLive, { what }) : ""}</p>
    </>
  );
}

function KeyRow({
  icon,
  iconTone,
  title,
  badges,
  open,
  onToggle,
  more,
  children,
}: {
  icon: IconName;
  iconTone?: "red" | "green" | "blue";
  title: string;
  badges: ReactNode;
  open: boolean;
  onToggle: () => void;
  more: string;
  children: ReactNode;
}) {
  return (
    <>
      <div className="v-row" data-open={open ? "true" : undefined}>
        <span className={`v-row-icon ${iconTone ? `v-row-icon-${iconTone}` : ""}`} aria-hidden>
          <Icon name={icon} size={22} />
        </span>
        <span className="v-row-main">
          <b>{title}</b>
          <span className="v-badges">{badges}</span>
        </span>
        <span className="v-row-side">
          <button type="button" className="v-btn v-btn-soft v-btn-sm" onClick={onToggle} aria-expanded={open}>
            {more}
            <Icon name="chevron-down" size={14} style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 200ms var(--v-ease)" }} />
          </button>
        </span>
      </div>
      {open && <div className="v-card v-card-pad v-card-field vc-detail">{children}</div>}
    </>
  );
}

export default function CabinetKey({
  data,
  resyncing,
  resyncStatus,
  onResync,
  onBuyTraffic,
  onGoProfile,
  locale,
  units,
  t,
}: {
  data: SubscriptionData;
  /** Язык страницы: подписи магазинов в apps.ts лежат на обоих. */
  locale: Locale;
  /** Формы слов после числа — для кольца срока и плитки приглашений. */
  units: Dict["units"];
  t: T;
  resyncing: boolean;
  resyncStatus: null | { kind: "ok" | "error"; text: string };
  onResync: () => void;
  onBuyTraffic: () => void;
  onGoProfile: () => void;
}) {
  const bk = data.bypassKey;
  const owed = data.bypassOwedBytes ?? 0;
  const { live, status } = useBypassLive(!!(bk?.known || bk?.maybe || owed > 0));
  // Ключ 1 раскрыт сразу: это то, ради чего человек открывает кабинет,
  // и прятать его за «Подробнее» — лишний клик на главном пути.
  const [open1, setOpen1] = useState(true);
  const [open2, setOpen2] = useState(false);
  const to = (href: string) => localeHref(href, locale);
  const intl = locale === "ru" ? "ru-RU" : "en-GB";
  const main = mainKey("member", locale);
  const second = bypassKey("member", locale);
  const plan = data.subscriptionPlan || "trial";
  const isTrial = plan === "trial";

  // Приложение для подключения — общий выбор на оба ключа, платформа
  // определяется один раз по userAgent, по умолчанию Happ.
  const [platform] = useState<Platform>(() => (typeof navigator !== "undefined" ? detectPlatform(navigator.userAgent) : null) ?? "ios");
  const apps = APPS[platform].filter((a) => a.id === "happ" || a.id === "incy");
  const [appId, setAppId] = useState<AppId>("happ");
  const app = apps.find((a) => a.id === appId) ?? apps[0];

  const end = new Date(data.subscriptionEnd);
  const endShort = end.toLocaleDateString(intl, { day: "2-digit", month: "2-digit" });
  const endLong = end.toLocaleDateString(intl, { day: "numeric", month: "long" });

  // Кольцо прогресса: доля оставшегося от периода (пробный — от
  // TRIAL_DAYS, иначе — от 30 дней).
  const totalDays = isTrial ? TRIAL_DAYS : 30;
  const ringP = data.isExpired ? 0 : Math.max(0, Math.min(1, (data.daysLeft + data.hoursLeft / 24) / totalDays));
  const planLabel = data.isExpired
    ? t.planSub
    : isTrial
      ? t.planTrial
      : plan === "plus" || plan === "basic"
        ? fill(t.planNamed, { plan: plan === "plus" ? "Plus" : "Basic" })
        : t.planSub;

  // ── Ключ 1 ────────────────────────────────────────────────────
  const url1 = data.isExpired ? null : data.subscriptionUrl ?? null;
  const planBadge = data.isExpired ? t.badgeSub : isTrial ? t.badgeTrial : plan === "plus" ? "Plus" : plan === "basic" ? "Basic" : t.badgeSub;
  const key1Badges = (
    <>
      <span className="v-badge v-badge-blue">{planBadge}</span>
      {data.isExpired ? (
        <span className="v-badge v-badge-red">{t.expired}</span>
      ) : (
        <span className="v-badge">{fill(t.until, { date: endShort })}</span>
      )}
    </>
  );
  const key1Body = url1 ? (
    <>
      <p className="v-text" style={{ margin: "0 0 4px" }}>{main.text}</p>
      <AppSwitcher apps={apps} appId={appId} onChange={setAppId} label={t.appLabel} />
      <KeyActions locale={locale} t={t} url={url1} app={app} primary what={main.title} />
    </>
  ) : data.isExpired ? (
    <>
      <p className="v-text">{fill(t.expiredFrom, { date: endShort })}</p>
      <div className="vc-actions">
        <Link href={to("/subscribe")} className="v-btn v-btn-primary v-btn-sm">{t.renewSub}</Link>
      </div>
    </>
  ) : (
    <p className="v-text">{t.keySoon}</p>
  );

  // ── Ключ 2 ────────────────────────────────────────────────────
  const url2 = live?.subscriptionUrl ?? bk?.subscriptionUrl ?? null;
  const has2 = !!url2 || !!bk?.known || live?.state === "ok";
  const owedNow = live ? live.owedBytes : owed;
  const exhausted = live?.state === "ok" && !live.unlimited && (live.remainingBytes ?? 0) <= 0;
  const p = live?.state === "ok" && live.limitBytes ? Math.min(1, (live.usedBytes ?? 0) / live.limitBytes) : 0;

  const key2Badge =
    status === "loading" ? (
      <span className="v-badge v-badge-amber">{t.checking}</span>
    ) : owedNow > 0 ? (
      <span className="v-badge v-badge-amber">{t.crediting}</span>
    ) : exhausted ? (
      <span className="v-badge v-badge-red">{t.noPack}</span>
    ) : live?.state === "ok" && live.unlimited ? (
      <span className="v-badge v-badge-green">{t.unlimited}</span>
    ) : live?.state === "ok" ? (
      <span className="v-badge v-badge-green">{fill(t.leftX, { size: formatBytes(live.remainingBytes ?? 0) })}</span>
    ) : has2 ? (
      <span className="v-badge">{t.ready}</span>
    ) : (
      <span className="v-badge">{t.noPack}</span>
    );

  const key2Body = (
    <>
      <p className="v-text" style={{ margin: "0 0 4px" }}>{second.text}</p>
      {status === "loading" ? (
        <div className="vc-skel" aria-hidden />
      ) : live?.state === "ok" && !live.unlimited ? (
        <>
          <div className="vc-meter" data-tone={exhausted || p > 0.9 ? "warn" : undefined} aria-hidden>
            <i style={{ "--p": 1 - p } as CSSProperties} />
          </div>
          <p className="vc-meter-cap">
            <span>{fill(t.used, { size: formatBytes(live.usedBytes ?? 0) })}</span>
            <span>{fill(t.outOf, { size: formatBytes(live.limitBytes ?? 0) })}</span>
          </p>
        </>
      ) : null}
      {owedNow > 0 && <p className="vc-fine">{fill(t.creditingNote, { size: formatBytes(owedNow) })}</p>}
      {url2 ? (
        <>
          <AppSwitcher apps={apps} appId={appId} onChange={setAppId} label={t.appLabel} />
          <KeyActions locale={locale} t={t} url={url2} app={app} primary={false} what={second.title} />
          <div className="vc-actions">
            <Link href={to(BUY_TRAFFIC_HREF)} className="v-btn v-btn-primary v-btn-sm">
              {t.buyMoreGb}
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </>
      ) : status === "loading" ? null : (
        <>
          <p className="vc-fine">
            {owedNow > 0 ? t.keyAfterCredit : t.noKeyYet}
          </p>
          {owedNow === 0 && (
            <div className="vc-actions">
              <Link href={to(BUY_TRAFFIC_HREF)} className="v-btn v-btn-primary v-btn-sm">
                {t.buyPack}
                <Icon name="arrow-right" size={16} />
              </Link>
            </div>
          )}
        </>
      )}
    </>
  );

  // ── Первые шаги (пробный) ───────────────────────────────────────
  const showFirst = isTrial && !data.isExpired;
  const tgBonus = count(locale, TELEGRAM_BONUS_DAYS, units.day);
  const steps: { id: string; short: string; title: string; text: string; done: boolean; act: ReactNode }[] = [
    {
      id: "device",
      short: t.stepDeviceShort,
      title: t.stepDeviceTitle,
      text: fill(t.stepDeviceText, { devices: count(locale, DEVICE_LIMIT, units.device) }),
      done: false,
      act: (
        <Link href={to("/add-device")} className="v-btn v-btn-sm v-btn-primary">
          {t.stepDeviceAct}
          <Icon name="arrow-right" size={14} />
        </Link>
      ),
    },
    {
      id: "tg",
      short: t.stepTgShort,
      title: t.stepTgTitle,
      text: fill(t.stepTgText, { days: tgBonus }),
      done: data.telegramLinked,
      act: (
        <button type="button" onClick={onGoProfile} className="v-btn v-btn-sm v-btn-primary">
          {t.stepTgAct}
        </button>
      ),
    },
    {
      id: "friend",
      short: t.stepFriendShort,
      title: t.stepFriendTitle,
      text: fill(t.stepFriendText, { percent: data.cashbackPercent }),
      done: data.referrals > 0,
      act: (
        <button type="button" onClick={onGoProfile} className="v-btn v-btn-sm v-btn-primary">
          {t.stepFriendAct}
        </button>
      ),
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nowIdx = steps.findIndex((s) => !s.done);
  const nowStep = nowIdx >= 0 ? steps[nowIdx] : null;
  const fillPct = (doneCount / (steps.length - 1)) * 100;

  return (
    <div className="vc-home">
      <div className="v-bento vc-bento">
        {/* ── Подписка ──────────────────────────────────────────── */}
        <div className="v-tile v-tile-dark v-span-4 v-lift vc-sub-tile" aria-labelledby="vc-sub-h">
          <div className="vc-sub-head">
            <h3 id="vc-sub-h">{planLabel}</h3>
            <span className={`v-badge ${data.isExpired ? "v-badge-red" : isTrial ? "v-badge-amber" : "v-badge-green"}`}>
              {data.isExpired ? t.expired : isTrial ? t.badgeTrial : t.active}
            </span>
            {/* Сверка с панелью — рядом со сроком, который она и
                уточняет, а не отдельной строкой над доской. */}
            <button
              type="button"
              className="vc-sub-sync"
              onClick={onResync}
              disabled={resyncing}
              title={t.checkTerm}
            >
              <Icon name={resyncStatus?.kind === "ok" ? "check" : "refresh"} size={16} />
              <span className="v-sr">{t.checkTerm}</span>
            </button>
          </div>
          <p className="vc-sub-sync-note" role="status">{resyncing ? t.checkingNow : resyncStatus?.text ?? ""}</p>

          {data.isExpired ? (
            <p className="vc-sub-big">{t.subInactive}</p>
          ) : (
            <div className="vc-sub-body">
              <div className="v-ring vc-sub-ring" style={{ "--p": ringP } as CSSProperties}>
                <svg viewBox="0 0 100 100">
                  <circle className="v-ring-track" r="45" cx="50" cy="50" pathLength="100" />
                  <circle className="v-ring-bar" r="45" cx="50" cy="50" pathLength="100" />
                </svg>
                <span className="v-ring-center">
                  <b>{ringParts(data.daysLeft, data.hoursLeft, locale, t, units).n}</b>
                  <span>{ringParts(data.daysLeft, data.hoursLeft, locale, t, units).unit}</span>
                </span>
              </div>
              <div className="vc-sub-info">
                <p className="vc-sub-big">{humanRemaining(data.daysLeft, data.hoursLeft, locale, t, units)}</p>
                <p className="vc-sub-info-cap">{t.left}</p>
              </div>
            </div>
          )}
          <p className="vc-sub-end">
            {data.isExpired ? fill(t.closedFrom, { date: endLong }) : fill(t.untilLong, { date: endLong })}
          </p>

          <div className="v-actions vc-sub-actions">
            {data.isExpired ? (
              <Link href={to("/subscribe")} className="v-btn v-btn-white">
                {t.buySub}
                <Icon name="arrow-right" size={16} />
              </Link>
            ) : (
              <>
                <Link href={to("/subscribe")} className="v-btn v-btn-white">{t.renew}</Link>
                <Link href={to("/add-device")} className="v-btn v-btn-outline vc-btn-on-dark">{t.addDevice}</Link>
              </>
            )}
          </div>
        </div>

        {/* ── Баланс и кешбэк ──────────────────────────────────────
            Здесь стояла плитка «Сеть сейчас» с числом подключённых.
            Число считала детерминированная функция времени, то есть
            это был не замер, а нарисованная кривая — показывать её
            оплатившему человеку как факт нельзя (CLAUDE.md: числа
            подтверждаются кодом). На её месте то, что действительно
            есть в ответе API и действительно про него. */}
        <section className="v-tile v-span-2 v-lift vc-money-tile" aria-labelledby="vc-money-h">
          <span className="v-tile-icon" aria-hidden><Icon name="coins" size={22} /></span>
          <h3 id="vc-money-h">{t.balance}</h3>
          <p className="vc-money-num">{data.balance.toLocaleString(intl, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</p>
          <p className="vc-money-cap">{t.balanceCap}</p>
          <dl className="vc-money-rows">
            <div>
              <dt>{t.cashback}</dt>
              <dd>{fill(t.cashbackVal, { percent: data.cashbackPercent })}</dd>
            </div>
            <div>
              <dt>{t.invited}</dt>
              <dd>
                {count(locale, data.referrals, units.person)}
                {data.paidReferrals > 0 ? fill(t.invitedPaid, { n: data.paidReferrals }) : ""}
              </dd>
            </div>
          </dl>
          <button type="button" className="v-btn v-btn-soft v-btn-sm vc-money-btn" onClick={onGoProfile}>
            {t.invite}
            <Icon name="arrow-right" size={16} />
          </button>
        </section>

        {/* ── Быстрые действия ─────────────────────────────────── */}
        <div className="vc-quick v-span-6">
          <Link href={to("/add-device")} className="vc-qtile v-lift v-press">
            <span className="v-tile-icon"><Icon name="devices" size={22} /></span>
            <span>{t.quickDevice}</span>
          </Link>
          <button type="button" className="vc-qtile v-lift v-press" onClick={onBuyTraffic}>
            <span className="v-tile-icon"><Icon name="coins" size={22} /></span>
            <span>{t.quickGb}</span>
          </button>
          <button type="button" className="vc-qtile v-lift v-press" onClick={onGoProfile}>
            <span className="v-tile-icon"><Icon name="users" size={22} /></span>
            <span>{t.quickFriend}</span>
          </button>
          <Link href={to("/support")} className="vc-qtile v-lift v-press">
            <span className="v-tile-icon"><Icon name="chat" size={22} /></span>
            <span>{t.quickSupport}</span>
          </Link>
        </div>

        {/* ── Первые шаги (пробный) ────────────────────────────── */}
        {showFirst && (
          <div className="vc-first v-span-6 v-lift" aria-labelledby="vc-first-h">
            <div className="vc-first-head">
              <h3 id="vc-first-h">{t.firstTitle}</h3>
              <span className="v-badge v-badge-blue">{doneCount}/{steps.length}</span>
            </div>
            <p className="v-sr" aria-live="polite">{fill(t.firstLive, { done: doneCount, total: steps.length })}</p>
            <div className="vc-stepper" aria-hidden>
              <span className="vc-stepper-fill" style={{ width: `${fillPct}%` }} />
              {steps.map((s, i) => (
                <div key={s.id} className="vc-stepper-item" data-state={s.done ? "done" : i === nowIdx ? "now" : undefined}>
                  <span className="vc-step-dot">{s.done ? <Icon name="check" size={14} /> : i + 1}</span>
                  <span className="vc-step-label">{s.short}</span>
                </div>
              ))}
            </div>
            {nowStep ? (
              <div className="vc-first-cta">
                <p>
                  <b>{nowStep.title}</b>
                  <span className="vc-first-cta-text"> — {nowStep.text}</span>
                </p>
                {nowStep.act}
              </div>
            ) : (
              <p className="vc-first-done">
                <Icon name="check" size={16} />
                {t.firstDone}
              </p>
            )}
          </div>
        )}

        {/* ── Ключи подключения ────────────────────────────────── */}
        <div className="vc-keys v-span-6">
          <h2 className="vc-cab-title vc-keys-title">
            <Icon name="key" size={24} />
            {t.keysTitle}
          </h2>
          <div className="v-rows">
            <KeyRow
              icon="key"
              iconTone={data.isExpired ? "red" : "blue"}
              title={main.title}
              badges={key1Badges}
              open={open1}
              onToggle={() => setOpen1((v) => !v)}
              more={t.more}
            >
              {key1Body}
            </KeyRow>

            <KeyRow icon="key" title={second.title} badges={key2Badge} open={open2} onToggle={() => setOpen2((v) => !v)} more={t.more}>
              {key2Body}
            </KeyRow>
          </div>
          <p className="vc-fine">{switchHint("member", locale)}</p>
        </div>
      </div>
    </div>
  );
}
