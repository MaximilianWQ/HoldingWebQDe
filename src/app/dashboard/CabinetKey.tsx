"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { TELEGRAM_BONUS_DAYS, TRIAL_DAYS } from "@/lib/brand-facts";
import { DEVICE_LIMIT } from "@/lib/plans";
import { plural } from "@/lib/locations";
import { BUY_TRAFFIC_HREF, BYPASS_KEY, MAIN_KEY, SWITCH_HINT } from "@/lib/key-names";
import { formatBytes, useBypassLive, withJsonFormat } from "@/lib/use-bypass";
import { APPS, detectPlatform, type AppId, type ClientApp, type Platform } from "@/lib/apps";
import type { SubscriptionData } from "@/types";
import CabinetNetwork from "./CabinetNetwork";

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
 */

function humanRemaining(days: number, hours: number): string {
  if (days <= 0) return hours > 0 ? `${hours} ${plural(hours, ["час", "часа", "часов"])}` : "меньше часа";
  const years = Math.floor(days / 365);
  if (years >= 1) {
    const months = Math.floor((days - years * 365) / 30);
    const y = `${years} ${plural(years, ["год", "года", "лет"])}`;
    return months ? `${y} ${months} ${plural(months, ["месяц", "месяца", "месяцев"])}` : y;
  }
  const months = Math.floor(days / 30);
  if (months >= 1) {
    const rest = days - months * 30;
    const m = `${months} ${plural(months, ["месяц", "месяца", "месяцев"])}`;
    return rest ? `${m} ${rest} ${plural(rest, ["день", "дня", "дней"])}` : m;
  }
  return `${days} ${plural(days, ["день", "дня", "дней"])}`;
}

/** Компактная пара «число + единица» в кольцо (365 дней в кружке не влезли бы). */
function ringParts(days: number, hours: number): { n: string; unit: string } {
  if (days <= 0) return hours > 0 ? { n: String(hours), unit: plural(hours, ["час", "часа", "часов"]) } : { n: "<1", unit: "часа" };
  const years = Math.floor(days / 365);
  if (years >= 1) return { n: String(years), unit: plural(years, ["год", "года", "лет"]) };
  const months = Math.floor(days / 30);
  if (months >= 1) return { n: String(months), unit: plural(months, ["месяц", "месяца", "месяцев"]) };
  return { n: String(days), unit: plural(days, ["день", "дня", "дней"]) };
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "ссылка подписки";
  }
}

/** Переключатель Happ / Incy — общий на оба ключа. */
function AppSwitcher({ apps, appId, onChange }: { apps: ClientApp[]; appId: AppId; onChange: (id: AppId) => void }) {
  if (apps.length < 2) return null;
  return (
    <div className="v-seg vc-app-seg" role="tablist" aria-label="Приложение для подключения">
      {apps.map((a) => (
        <button key={a.id} type="button" role="tab" aria-selected={appId === a.id} onClick={() => onChange(a.id)}>
          {a.name}
        </button>
      ))}
    </div>
  );
}

function KeyActions({ url, app, primary, what }: { url: string; app: ClientApp; primary: boolean; what: string }) {
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
        <span>{hostOf(appUrl)}/…</span>
        <span className="vc-strip-dots" aria-hidden>
          {[0, 1, 2, 3, 4].map((k) => <i key={k} />)}
        </span>
      </div>
      {showQr && (
        <div className="vc-qr">
          <QRCodeSVG value={appUrl} size={188} level="M" marginSize={2} />
          <p className="v-small" style={{ margin: 0 }}>Наведите камеру телефона, на котором стоит {app.name}.</p>
        </div>
      )}
      {fallback && (
        <div className="vc-fine">
          Скопируйте вручную: <code>{appUrl}</code>
        </div>
      )}
      <div className="vc-actions">
        {openHref && (
          <a href={openHref} className={`v-btn v-btn-sm ${primary ? "v-btn-primary" : "v-btn-soft"}`}>
            <Icon name="bolt" size={16} />
            Открыть в {app.name}<span className="v-sr"> — {what}</span>
          </a>
        )}
        <button type="button" onClick={copy} className="v-btn v-btn-soft v-btn-sm">
          <Icon name={copied ? "check" : "copy"} size={16} />
          {copied ? "Скопировано" : "Скопировать"}
          <span className="v-sr"> — {what}</span>
        </button>
        <button type="button" onClick={() => setShowQr((v) => !v)} className="v-btn v-btn-soft v-btn-sm" aria-expanded={showQr}>
          <Icon name="qr" size={16} />
          {showQr ? "Скрыть QR" : "QR-код"}
          <span className="v-sr"> — {what}</span>
        </button>
      </div>
      {app.links.length > 0 && (
        <div className="vc-app-links">
          {app.links.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className={`vc-app-link ${l.secondary ? "vc-app-link-sec" : ""}`}>
              <Icon name="download" size={14} />
              {l.label}
            </a>
          ))}
        </div>
      )}
      <p className="v-sr" role="status" aria-live="polite">{copied ? `Ссылка скопирована: ${what}` : ""}</p>
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
  children,
}: {
  icon: IconName;
  iconTone?: "red" | "green" | "blue";
  title: string;
  badges: ReactNode;
  open: boolean;
  onToggle: () => void;
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
            Подробнее
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
}: {
  data: SubscriptionData;
  resyncing: boolean;
  resyncStatus: null | { kind: "ok" | "error"; text: string };
  onResync: () => void;
  onBuyTraffic: () => void;
  onGoProfile: () => void;
}) {
  const bk = data.bypassKey;
  const owed = data.bypassOwedBytes ?? 0;
  const { live, status } = useBypassLive(!!(bk?.known || bk?.maybe || owed > 0));
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const main = MAIN_KEY.member;
  const second = BYPASS_KEY.member;
  const plan = data.subscriptionPlan || "trial";
  const isTrial = plan === "trial";

  // Приложение для подключения — общий выбор на оба ключа, платформа
  // определяется один раз по userAgent, по умолчанию Happ.
  const [platform] = useState<Platform>(() => (typeof navigator !== "undefined" ? detectPlatform(navigator.userAgent) : null) ?? "ios");
  const apps = APPS[platform].filter((a) => a.id === "happ" || a.id === "incy");
  const [appId, setAppId] = useState<AppId>("happ");
  const app = apps.find((a) => a.id === appId) ?? apps[0];

  const end = new Date(data.subscriptionEnd);
  const endShort = end.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
  const endLong = end.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });

  // Кольцо прогресса: доля оставшегося от периода (пробный — от
  // TRIAL_DAYS, иначе — от 30 дней).
  const totalDays = isTrial ? TRIAL_DAYS : 30;
  const ringP = data.isExpired ? 0 : Math.max(0, Math.min(1, (data.daysLeft + data.hoursLeft / 24) / totalDays));
  const planLabel = data.isExpired ? "Подписка" : isTrial ? "Пробный период" : plan === "plus" ? "Тариф Plus" : plan === "basic" ? "Тариф Basic" : "Подписка";

  // ── Ключ 1 ────────────────────────────────────────────────────
  const url1 = data.isExpired ? null : data.subscriptionUrl ?? null;
  const planBadge = data.isExpired ? "Подписка" : isTrial ? "Пробный" : plan === "plus" ? "Plus" : plan === "basic" ? "Basic" : "Подписка";
  const key1Badges = (
    <>
      <span className="v-badge v-badge-blue">{planBadge}</span>
      {data.isExpired ? <span className="v-badge v-badge-red">Истекла</span> : <span className="v-badge">до {endShort}</span>}
    </>
  );
  const key1Body = url1 ? (
    <>
      <p className="v-text" style={{ margin: "0 0 4px" }}>{main.text}</p>
      <AppSwitcher apps={apps} appId={appId} onChange={setAppId} />
      <KeyActions url={url1} app={app} primary what={main.title} />
    </>
  ) : data.isExpired ? (
    <>
      <p className="v-text">Подписка не активна с {endShort}. Продлите — ключ заработает снова.</p>
      <div className="vc-actions">
        <Link href="/subscribe" className="v-btn v-btn-primary v-btn-sm">Продлить подписку</Link>
      </div>
    </>
  ) : (
    <p className="v-text">Ключ почти готов — обновите страницу через несколько секунд.</p>
  );

  // ── Ключ 2 ────────────────────────────────────────────────────
  const url2 = live?.subscriptionUrl ?? bk?.subscriptionUrl ?? null;
  const has2 = !!url2 || !!bk?.known || live?.state === "ok";
  const owedNow = live ? live.owedBytes : owed;
  const exhausted = live?.state === "ok" && !live.unlimited && (live.remainingBytes ?? 0) <= 0;
  const p = live?.state === "ok" && live.limitBytes ? Math.min(1, (live.usedBytes ?? 0) / live.limitBytes) : 0;

  const key2Badge =
    status === "loading" ? (
      <span className="v-badge v-badge-amber">Проверяем</span>
    ) : owedNow > 0 ? (
      <span className="v-badge v-badge-amber">Зачисляем</span>
    ) : exhausted ? (
      <span className="v-badge v-badge-red">Нет пакета</span>
    ) : live?.state === "ok" && live.unlimited ? (
      <span className="v-badge v-badge-green">Без лимита</span>
    ) : live?.state === "ok" ? (
      <span className="v-badge v-badge-green">Осталось {formatBytes(live.remainingBytes ?? 0)}</span>
    ) : has2 ? (
      <span className="v-badge">Готов</span>
    ) : (
      <span className="v-badge">Нет пакета</span>
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
            <span>использовано {formatBytes(live.usedBytes ?? 0)}</span>
            <span>из {formatBytes(live.limitBytes ?? 0)}</span>
          </p>
        </>
      ) : null}
      {owedNow > 0 && <p className="vc-fine">Оплаченные {formatBytes(owedNow)} зачисляются — обычно это пара минут.</p>}
      {url2 ? (
        <>
          <AppSwitcher apps={apps} appId={appId} onChange={setAppId} />
          <KeyActions url={url2} app={app} primary={false} what={second.title} />
          <div className="vc-actions">
            <Link href={BUY_TRAFFIC_HREF} className="v-btn v-btn-primary v-btn-sm">
              Докупить гигабайты
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </>
      ) : status === "loading" ? null : (
        <>
          <p className="vc-fine">
            {owedNow > 0
              ? "Ключ появится здесь, как только гигабайты будут зачислены."
              : "Пока ключа нет. Купите пакет трафика — ключ появится сразу после оплаты. Пакеты складываются, срока у них нет."}
          </p>
          {owedNow === 0 && (
            <div className="vc-actions">
              <Link href={BUY_TRAFFIC_HREF} className="v-btn v-btn-primary v-btn-sm">
                Купить пакет трафика
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
  const tgBonus = `${TELEGRAM_BONUS_DAYS} ${plural(TELEGRAM_BONUS_DAYS, ["день", "дня", "дней"])}`;
  const steps: { id: string; short: string; title: string; text: string; done: boolean; act: ReactNode }[] = [
    {
      id: "device",
      short: "Устройство",
      title: "Подключите устройство",
      text: `Телефон, компьютер или телевизор — до ${DEVICE_LIMIT} на одной подписке.`,
      done: false,
      act: (
        <Link href="/add-device" className="v-btn v-btn-sm v-btn-primary">
          Подключить
          <Icon name="arrow-right" size={14} />
        </Link>
      ),
    },
    {
      id: "tg",
      short: "Telegram",
      title: "Привяжите Telegram",
      text: `+${tgBonus} к подписке за привязку бота.`,
      done: data.telegramLinked,
      act: (
        <button type="button" onClick={onGoProfile} className="v-btn v-btn-sm v-btn-primary">
          Привязать
        </button>
      ),
    },
    {
      id: "friend",
      short: "Друг",
      title: "Пригласите друга",
      text: `Кешбэк ${data.cashbackPercent}% с каждой оплаты друга.`,
      done: data.referrals > 0,
      act: (
        <button type="button" onClick={onGoProfile} className="v-btn v-btn-sm v-btn-primary">
          Пригласить
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
      <div className="vc-home-top">
        <p className="vc-fine" role="status" style={{ margin: 0 }}>{resyncStatus?.text ?? ""}</p>
        <button type="button" className="v-btn v-btn-soft v-btn-sm" onClick={onResync} disabled={resyncing}>
          {resyncing ? (
            "Проверяем…"
          ) : resyncStatus?.kind === "ok" ? (
            <>
              <Icon name="check" size={16} />
              Готово
            </>
          ) : (
            <>
              <Icon name="refresh" size={16} />
              Обновить
            </>
          )}
        </button>
      </div>

      <div className="v-bento vc-bento">
        {/* ── Подписка ──────────────────────────────────────────── */}
        <div className="v-tile v-tile-dark v-span-4 v-lift vc-sub-tile" aria-labelledby="vc-sub-h">
          <div className="vc-sub-head">
            <h3 id="vc-sub-h">{planLabel}</h3>
            <span className={`v-badge ${data.isExpired ? "v-badge-red" : isTrial ? "v-badge-amber" : "v-badge-green"}`}>
              {data.isExpired ? "Истекла" : isTrial ? "Пробный" : "Активна"}
            </span>
          </div>

          {data.isExpired ? (
            <p className="vc-sub-big">Подписка не активна</p>
          ) : (
            <div className="vc-sub-body">
              <div className="v-ring vc-sub-ring" style={{ "--p": ringP } as CSSProperties}>
                <svg viewBox="0 0 100 100">
                  <circle className="v-ring-track" r="45" cx="50" cy="50" pathLength="100" />
                  <circle className="v-ring-bar" r="45" cx="50" cy="50" pathLength="100" />
                </svg>
                <span className="v-ring-center">
                  <b>{ringParts(data.daysLeft, data.hoursLeft).n}</b>
                  <span>{ringParts(data.daysLeft, data.hoursLeft).unit}</span>
                </span>
              </div>
              <div className="vc-sub-info">
                <p className="vc-sub-big">{humanRemaining(data.daysLeft, data.hoursLeft)}</p>
                <p className="vc-sub-info-cap">осталось</p>
              </div>
            </div>
          )}
          <p className="vc-sub-end">{data.isExpired ? `Доступ закрыт с ${endLong}` : `До ${endLong}`}</p>

          <div className="v-actions vc-sub-actions">
            {data.isExpired ? (
              <Link href="/subscribe" className="v-btn v-btn-white">
                Купить подписку
                <Icon name="arrow-right" size={16} />
              </Link>
            ) : (
              <>
                <Link href="/subscribe" className="v-btn v-btn-white">Продлить</Link>
                <Link href="/add-device" className="v-btn v-btn-outline vc-btn-on-dark">Подключить устройство</Link>
              </>
            )}
          </div>
        </div>

        {/* ── Сеть сейчас ───────────────────────────────────────── */}
        <CabinetNetwork />

        {/* ── Быстрые действия ─────────────────────────────────── */}
        <div className="vc-quick v-span-6">
          <Link href="/add-device" className="vc-qtile v-lift v-press">
            <span className="v-tile-icon"><Icon name="devices" size={22} /></span>
            <span>Подключить устройство</span>
          </Link>
          <button type="button" className="vc-qtile v-lift v-press" onClick={onBuyTraffic}>
            <span className="v-tile-icon"><Icon name="coins" size={22} /></span>
            <span>Купить ГБ</span>
          </button>
          <button type="button" className="vc-qtile v-lift v-press" onClick={onGoProfile}>
            <span className="v-tile-icon"><Icon name="users" size={22} /></span>
            <span>Пригласить друга</span>
          </button>
          <Link href="/support" className="vc-qtile v-lift v-press">
            <span className="v-tile-icon"><Icon name="chat" size={22} /></span>
            <span>Поддержка</span>
          </Link>
        </div>

        {/* ── Первые шаги (пробный) ────────────────────────────── */}
        {showFirst && (
          <div className="vc-first v-span-6 v-lift" aria-labelledby="vc-first-h">
            <div className="vc-first-head">
              <h3 id="vc-first-h">Первые шаги</h3>
              <span className="v-badge v-badge-blue">{doneCount}/{steps.length}</span>
            </div>
            <p className="v-sr" aria-live="polite">Первые шаги: сделано {doneCount} из {steps.length}.</p>
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
                Все шаги пройдены — отличное начало!
              </p>
            )}
          </div>
        )}

        {/* ── Ключи подключения ────────────────────────────────── */}
        <div className="vc-keys v-span-6">
          <h2 className="vc-cab-title vc-keys-title">
            <Icon name="key" size={24} />
            Ключи подключения
          </h2>
          <div className="v-rows">
            <KeyRow
              icon="key"
              iconTone={data.isExpired ? "red" : "blue"}
              title={main.title}
              badges={key1Badges}
              open={open1}
              onToggle={() => setOpen1((v) => !v)}
            >
              {key1Body}
            </KeyRow>

            <KeyRow icon="key" title={second.title} badges={key2Badge} open={open2} onToggle={() => setOpen2((v) => !v)}>
              {key2Body}
            </KeyRow>
          </div>
          <p className="vc-fine">{SWITCH_HINT.member}</p>
        </div>
      </div>
    </div>
  );
}
