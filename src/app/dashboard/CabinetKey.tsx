"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import Icon from "@/components/pixel/Icon";
import Corner from "@/components/atlas/Corner";
import { BUY_TRAFFIC_HREF, BYPASS_KEY, MAIN_KEY, SWITCH_HINT } from "@/lib/key-names";
import { formatBytes, useBypassLive } from "@/lib/use-bypass";
import type { SubscriptionData } from "@/types";

/**
 * Кабинет · два ключа подключения (владелец, 13.09.2026):
 *   Ключ 1 · Основной VPN — подписка, безлимитный трафик;
 *   Ключ 2 · Обход        — отдельный ключ с гигабайтами пакета
 *                           (остаток, шкала, «Докупить»).
 *
 * У каждого — открыть в приложении, скопировать, QR, ручное копирование,
 * если буфер обмена недоступен (логика прежнего блока ключа).
 * Ссылка на экран целиком не выводится — только адрес сервиса.
 *
 * Ключ 2 грузится ПОСЛЕ первой отрисовки (GET /api/user/bypass): до ответа
 * — скелет в строке остатка; не ответили за ~2,5 с — ссылка из БД, без
 * чисел. Рабочий экран: без анимаций входа, только отклик на нажатие.
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

/** Действия с одной ссылкой: открыть, скопировать, QR. */
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
      <div className="ak-key-strip">
        <span>{hostOf(url)}/…</span>
        <span className="ak-key-dots" aria-hidden>
          {[0, 1, 2, 3, 4].map((k) => (
            <i key={k} style={{ "--k": k } as CSSProperties} />
          ))}
        </span>
      </div>
      <div className="ak-reveal" data-open={showQr ? "" : undefined}>
        <div>
          <div className="ak-qr">
            <QRCodeSVG value={url} size={200} level="M" marginSize={2} />
          </div>
          <p className="ak-fine">Наведите камеру телефона, на котором стоит Happ.</p>
        </div>
      </div>
      {fallback && (
        <div className="ak-fallback">
          <p className="ak-fine" style={{ margin: 0 }}>Скопируйте вручную:</p>
          <code>{url}</code>
        </div>
      )}
      <div className="ak-actions ak-kactions">
        <button type="button" onClick={() => (window.location.href = happDeepLink(url, happCryptoLink ?? null))} className={`a-btn ${primary ? "a-btn-primary" : "ak-btn-soft"}`}>
          <Icon name="bolt" size={16} />
          Открыть в приложении<span className="b-sr"> — {what}</span>
        </button>
        <button type="button" onClick={copy} className="a-btn ak-btn-soft" data-state={copied ? "ok" : undefined}>
          <Icon name={copied ? "check" : "copy"} size={16} />
          {copied ? "Скопировано" : "Скопировать"}
          <span className="b-sr"> — {what}</span>
        </button>
        <button type="button" onClick={() => setShowQr((v) => !v)} className="a-btn ak-btn-soft" aria-expanded={showQr}>
          <Icon name="qr" size={16} />
          {showQr ? "Скрыть QR" : "QR-код"}
          <span className="b-sr"> — {what}</span>
        </button>
      </div>
      <p className="b-sr" role="status" aria-live="polite">{copied ? `Ссылка скопирована: ${what}` : ""}</p>
    </>
  );
}

function KeyBlock({ n, title, text, status, children }: { n: 1 | 2; title: string; text: string; status?: ReactNode; children: ReactNode }) {
  return (
    <div className="ak-kblock" data-k={n} role="group" aria-labelledby={`ak-k${n}-t`}>
      <div className="ak-kblock-head">
        <span className="ak-kno" aria-hidden>{n}</span>
        <h3 id={`ak-k${n}-t`} className="ak-ktitle">{title}</h3>
        {status}
      </div>
      <p className="ak-text">{text}</p>
      {children}
    </div>
  );
}

export default function CabinetKey({ data, i }: { data: SubscriptionData; i: number }) {
  const bk = data.bypassKey;
  const owed = data.bypassOwedBytes ?? 0;
  const { live, status } = useBypassLive(!!(bk?.known || bk?.maybe || owed > 0));
  const style = { "--i": i } as CSSProperties;
  const main = MAIN_KEY.member;
  const second = BYPASS_KEY.member;

  // ── Ключ 1 ─────────────────────────────────────────────────────────
  const url1 = data.isExpired ? null : data.subscriptionUrl ?? null;
  const key1 = (
    <KeyBlock
      n={1}
      title={main.title.replace("Ключ 1 · ", "")}
      text={main.text}
      status={
        data.isExpired ? (
          <span className="ak-status" data-tone="off"><i />Не активен</span>
        ) : url1 ? (
          <span className="ak-status"><i />Готов</span>
        ) : (
          <span className="ak-status" data-tone="warn"><i />Готовится</span>
        )
      }
    >
      {url1 ? (
        <KeyActions url={url1} happCryptoLink={data.happCryptoLink} primary what={main.title} />
      ) : data.isExpired ? (
        <div className="ak-actions ak-kactions">
          <Link href="/subscribe" className="a-btn a-btn-primary">Продлить подписку</Link>
        </div>
      ) : (
        <p className="ak-fine">Ключ почти готов — обновите страницу через несколько секунд.</p>
      )}
    </KeyBlock>
  );

  // ── Ключ 2 ─────────────────────────────────────────────────────────
  const url2 = live?.subscriptionUrl ?? bk?.subscriptionUrl ?? null;
  const has2 = !!url2 || !!bk?.known || live?.state === "ok";
  const owedNow = live ? live.owedBytes : owed;
  const exhausted = live?.state === "ok" && !live.unlimited && (live.remainingBytes ?? 0) <= 0;
  const p = live?.state === "ok" && live.limitBytes ? Math.min(1, (live.usedBytes ?? 0) / live.limitBytes) : 0;

  let status2: ReactNode = null;
  if (status === "loading") status2 = <span className="ak-status" data-tone="warn"><i />Проверяем</span>;
  else if (owedNow > 0) status2 = <span className="ak-status" data-tone="warn"><i />Зачисляем</span>;
  else if (exhausted) status2 = <span className="ak-status" data-tone="off"><i />Гигабайты закончились</span>;
  else if (has2) status2 = <span className="ak-status"><i />Готов</span>;

  const numbers =
    status === "loading" ? (
      <div className="ak-kskel" aria-hidden />
    ) : live?.state === "ok" ? (
      live.unlimited ? (
        <p className="ak-kgb"><span className="a-num">Без лимита</span></p>
      ) : (
        <>
          <p className="ak-kgb">
            <span className="a-num">{formatBytes(live.remainingBytes ?? 0)}</span>
            <small>осталось</small>
          </p>
          <div className="ak-meter" data-tone={exhausted || p > 0.9 ? "warn" : undefined} aria-hidden>
            <i style={{ "--p": 1 - p } as CSSProperties} />
          </div>
          <p className="ak-meter-cap a-num">
            <span>использовано {formatBytes(live.usedBytes ?? 0)}</span>
            <span>из {formatBytes(live.limitBytes ?? 0)}</span>
          </p>
        </>
      )
    ) : has2 ? (
      <p className="ak-fine">Остаток сейчас не уточнить — ключ работает, цифры появятся позже.</p>
    ) : null;

  const key2 = (
    <KeyBlock n={2} title={second.name} text={second.text} status={status2}>
      {numbers}
      {owedNow > 0 && (
        <p className="ak-fine" role="status">
          Оплаченные {formatBytes(owedNow)} зачисляются — обычно это пара минут.
        </p>
      )}
      {url2 ? (
        <>
          <KeyActions url={url2} primary={false} what={BYPASS_KEY.member.title} />
          <div className="ak-kmore">
            <Link href={BUY_TRAFFIC_HREF} className="a-btn a-btn-primary">
              Докупить гигабайты
              <Icon name="arrow-right" size={16} />
            </Link>
          </div>
        </>
      ) : status === "loading" ? null : (
        <>
          <p className="ak-fine">
            {owedNow > 0
              ? "Ключ появится здесь, как только гигабайты будут зачислены."
              : "Пока ключа нет. Купите пакет трафика — ключ появится сразу после оплаты. Пакеты складываются, срока у них нет."}
          </p>
          {owedNow === 0 && (
            <div className="ak-actions ak-kactions">
              <Link href={BUY_TRAFFIC_HREF} className="a-btn a-btn-primary">
                Купить пакет трафика
                <Icon name="arrow-right" size={16} />
              </Link>
            </div>
          )}
        </>
      )}
    </KeyBlock>
  );

  return (
    <section id="ak-key" className="ak-card ak-key ak-keys" data-sheet="20" style={style} aria-labelledby="ak-key-h">
      <Corner href="/devices" label="Инструкции по подключению" />
      <div className="ak-card-head">
        <h2 id="ak-key-h" className="ak-eyebrow">Ключи подключения</h2>
      </div>
      <p className="ak-text ak-keys-lead">Добавьте оба ключа в приложение. {SWITCH_HINT.member}</p>
      <div className="ak-kpair">
        {key1}
        {key2}
      </div>
      <p className="ak-apps">
        Нет приложения?
        <a href="https://apps.apple.com/app/happ-proxy-utility/id6504287215" target="_blank" rel="noopener noreferrer">App Store</a>
        <a href="https://play.google.com/store/apps/details?id=com.happproxy" target="_blank" rel="noopener noreferrer">Google Play</a>
      </p>
    </section>
  );
}
