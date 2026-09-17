"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { TELEGRAM_BONUS_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/locations";
import { BUY_TRAFFIC_HREF, BYPASS_KEY, MAIN_KEY, SWITCH_HINT } from "@/lib/key-names";
import { formatBytes, useBypassLive } from "@/lib/use-bypass";
import type { SubscriptionData } from "@/types";

/**
 * Кабинет · «Мои подписки» (образец IMG_1771): заголовок, строка на
 * каждый ключ («Подробнее» раскрывает панель ниже — открыть в
 * приложении, скопировать, QR, докупить ГБ), затем «Продлить» и
 * «Подключить устройство». На пробном периоде — компактная полоса
 * «Первые шаги» сверху (устройство → Telegram → друг).
 *
 * Вся логика ключей — один в один из прежнего блока: happ-ссылка,
 * буфер обмена с запасным вариантом, QR, остаток обхода после первой
 * отрисовки (useBypassLive).
 */

function happDeepLink(subscriptionUrl: string, happCryptoLink: string | null): string {
  if (happCryptoLink && happCryptoLink.startsWith("happ://")) return happCryptoLink;
  return `happ://add/${btoa(subscriptionUrl)}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "ссылка подписки";
  }
}

function KeyActions({ url, happCryptoLink, primary, what }: { url: string; happCryptoLink?: string | null; primary: boolean; what: string }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFallback(true);
    }
  };
  return (
    <>
      <div className="vc-strip">
        <span>{hostOf(url)}/…</span>
        <span className="vc-strip-dots" aria-hidden>
          {[0, 1, 2, 3, 4].map((k) => <i key={k} />)}
        </span>
      </div>
      {showQr && (
        <div className="vc-qr">
          <QRCodeSVG value={url} size={188} level="M" marginSize={2} />
          <p className="v-small" style={{ margin: 0 }}>Наведите камеру телефона, на котором стоит Happ.</p>
        </div>
      )}
      {fallback && (
        <div className="vc-fine">
          Скопируйте вручную: <code>{url}</code>
        </div>
      )}
      <div className="vc-actions">
        <button type="button" onClick={() => (window.location.href = happDeepLink(url, happCryptoLink ?? null))} className={`v-btn v-btn-sm ${primary ? "v-btn-primary" : "v-btn-soft"}`}>
          <Icon name="bolt" size={16} />
          Открыть в приложении<span className="v-sr"> — {what}</span>
        </button>
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
}: {
  data: SubscriptionData;
  resyncing: boolean;
  resyncStatus: null | { kind: "ok" | "error"; text: string };
  onResync: () => void;
}) {
  const bk = data.bypassKey;
  const owed = data.bypassOwedBytes ?? 0;
  const { live, status } = useBypassLive(!!(bk?.known || bk?.maybe || owed > 0));
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const main = MAIN_KEY.member;
  const second = BYPASS_KEY.member;
  const plan = data.subscriptionPlan || "trial";

  const end = new Date(data.subscriptionEnd);
  const endShort = end.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });

  // ── Ключ 1 ────────────────────────────────────────────────────
  const url1 = data.isExpired ? null : data.subscriptionUrl ?? null;
  const planBadge = data.isExpired
    ? "Подписка"
    : plan === "trial"
      ? "Пробный"
      : plan === "plus"
        ? "Plus"
        : plan === "basic"
          ? "Basic"
          : "Подписка";
  const key1Badges = (
    <>
      <span className="v-badge v-badge-blue">{planBadge}</span>
      {data.isExpired ? <span className="v-badge v-badge-red">Истекла</span> : <span className="v-badge">до {endShort}</span>}
    </>
  );
  const key1Body = url1 ? (
    <>
      <p className="v-text" style={{ margin: "0 0 4px" }}>{main.text}</p>
      <KeyActions url={url1} happCryptoLink={data.happCryptoLink} primary what={main.title} />
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
          <KeyActions url={url2} primary={false} what={second.title} />
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
  const showFirst = plan === "trial" && !data.isExpired;
  const tgBonus = `${TELEGRAM_BONUS_DAYS} ${plural(TELEGRAM_BONUS_DAYS, ["день", "дня", "дней"])}`;
  const steps = [
    { id: "device", done: false },
    { id: "tg", done: data.telegramLinked },
    { id: "friend", done: data.referrals > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const nowIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="vc-panel" aria-labelledby="vc-sub-h">
      <div className="vc-panel-head">
        <h2 id="vc-sub-h" className="vc-cab-title">
          <Icon name="bag" size={26} />
          Мои подписки
        </h2>
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
      {resyncStatus && <p className="vc-fine" role="status" style={{ marginTop: -10, marginBottom: 16 }}>{resyncStatus.text}</p>}

      {showFirst && (
        <div className="vc-first">
          <p className="vc-first-text">
            Первые шаги · сделано {doneCount} из {steps.length}
            <span className="v-sr">
              {" "}— устройство, Telegram (+{tgBonus}) в разделе «Профиль», приглашение друга. Кнопка «Подключить устройство» — ниже.
            </span>
          </p>
          <ol className="vc-first-list" aria-hidden>
            {steps.map((s, i) => (
              <li key={s.id} data-state={s.done ? "done" : i === nowIdx ? "now" : undefined}>
                {s.done ? <Icon name="check" size={14} /> : i + 1}
              </li>
            ))}
          </ol>
        </div>
      )}

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

      <div className="v-actions" style={{ marginTop: 24 }}>
        <Link href="/devices" className="v-btn v-btn-primary">
          <Icon name="devices" size={16} />
          Подключить устройство
        </Link>
        <Link href="/subscribe" className="v-btn v-btn-soft">Продлить</Link>
      </div>
    </div>
  );
}
