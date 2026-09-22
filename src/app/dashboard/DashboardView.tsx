"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import type { Dict } from "@/i18n";
import { fill } from "@/lib/text/fill";
import { count } from "@/lib/text/plural";
import { rich } from "@/lib/text/rich";
import { localeHref, type Locale } from "@/lib/locale";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import NotificationsModal from "@/components/NotificationsModal";
import WelcomeToast from "@/components/WelcomeToast";
import PasskeyPrompt from "@/components/PasskeyPrompt";
import IosInstallSheet from "@/components/IosInstallSheet";
import PlanCards from "@/components/vps/PlanCards";
import TrafficCards from "@/components/vps/TrafficCards";
import type { SubscriptionData } from "@/types";
import CabinetKey from "./CabinetKey";
import CabinetPayments from "./CabinetPayments";
import CabinetFriends from "./CabinetFriends";
import CabinetSettings from "./CabinetSettings";
import "./cabinet-vps.css";
import { formatBytes, useBypassLive } from "@/lib/use-bypass";

/**
 * Кабинет на корпусе Atlas Secure VPS (владелец, 17.09.2026: «очень
 * простой, очень приятный сайт стилистики Apple»). Образец —
 * IMG_1762/1763/1771: профиль сверху, сегмент из иконок переключает
 * разделы («Мои подписки», «История платежей», «Купить», «Профиль»),
 * «Выйти» под сегментом.
 *
 * Логика — без изменений: загрузка подписки (без сессии — на вход),
 * проверка подписки (force-resync), выход с подтверждением, привязка
 * и отвязка Telegram, уведомления, push, passkey, новости.
 *
 * Активная вкладка — в query (?tab=), поэтому «назад» браузера работает;
 * useSearchParams требует Suspense — оборачивает компонент по умолчанию.
 */

type TabId = "subs" | "payments" | "buy" | "profile";
type T = Dict["cabinet"];

/** Подписи разделов — из словаря по тому же ключу (`t.tabs.subs`). */
const TABS: { id: TabId; icon: IconName }[] = [
  { id: "subs", icon: "bag" },
  { id: "payments", icon: "receipt" },
  { id: "buy", icon: "grid" },
  { id: "profile", icon: "user" },
];

/** Локаль для Intl: русская страница считает «14 сент.», английская «14 Sep». */
const intlLocale = (l: Locale) => (l === "ru" ? "ru-RU" : "en-GB");

type TgLinkState =
  | { state: "idle" }
  | { state: "busy" }
  | { state: "ready"; url: string | null; startParam: string; mobile: boolean }
  | { state: "error"; error: string };

function LoadingSkeleton({ loading }: { loading: string }) {
  return (
    <div className="v-wrap vc-page" aria-busy="true">
      <p className="v-sr" aria-live="polite">{loading}</p>
      <div className="vc-loading" aria-hidden>
        <div className="vc-skel" style={{ height: 96 }} />
        <div className="vc-skel" style={{ height: 64 }} />
        <div className="vc-skel" style={{ height: 140 }} />
        <div className="vc-skel" style={{ height: 140 }} />
      </div>
    </div>
  );
}

/**
 * Подписи — пропсом, а не импортом словаря (21.09.2026). Экран
 * клиентский: импортируй он словарь, в браузер уехали бы оба языка
 * целиком. `cards` и `units` нужны каруселям тарифов во вкладке
 * «Купить», `t` — самому кабинету.
 */
interface Cards {
  locale: Locale;
  cards: Dict["cards"];
  units: Dict["units"];
  t: T;
}

function DashboardViewInner({ cards, locale, units, t }: Cards) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // Остаток обхода для плашки профиля. Панель спрашивается после
  // отрисовки: экран не ждёт её, как и весь остальной кабинет.
  const bypass = useBypassLive(true);
  const [tgLink, setTgLink] = useState<TgLinkState>({ state: "idle" });
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [resyncing, setResyncing] = useState(false);
  const [resyncStatus, setResyncStatus] = useState<null | { kind: "ok" | "error"; text: string }>(null);

  const activeParam = searchParams.get("tab");
  const active: TabId = TABS.some((t) => t.id === activeParam) ? (activeParam as TabId) : "subs";
  const kindParam = searchParams.get("kind") === "traffic" ? "traffic" : "plan";
  // extra — доп. параметры запроса (например ?tab=buy&kind=traffic для
  // «Купить ГБ» с плитки быстрых действий).
  const setActive = useCallback(
    (id: TabId, extra?: Record<string, string>) => {
      const qs = new URLSearchParams();
      if (id !== "subs") qs.set("tab", id);
      if (extra) for (const [k, v] of Object.entries(extra)) qs.set(k, v);
      const s = qs.toString();
      router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/user/subscription");
      const result = await res.json();
      if (result.success) setData(result.data);
      else router.push("/auth");
    } catch {
      router.push("/auth");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  useEffect(() => {
    if (!showLogoutConfirm) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !loggingOut && setShowLogoutConfirm(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showLogoutConfirm, loggingOut]);

  // Пока ссылка на бота открыта — раз в 5 с проверяем, не привязал ли
  // человек Telegram (15 минут, столько живёт ссылка).
  const waitingLink = tgLink.state === "ready" && !data?.telegramLinked;
  useEffect(() => {
    if (!waitingLink) return;
    const until = Date.now() + 15 * 60_000;
    const t = setInterval(async () => {
      if (Date.now() > until) return clearInterval(t);
      try {
        const res = await fetch("/api/user/subscription");
        const j = await res.json();
        if (j.success && j.data.telegramLinked) {
          setData(j.data);
          setTgLink({ state: "idle" });
        }
      } catch {
        // сеть мигнула — следующая проверка через 5 с
      }
    }, 5000);
    return () => clearInterval(t);
  }, [waitingLink]);

  const startTelegramLink = async () => {
    if (tgLink.state === "busy") return;
    const mobile = window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const win = mobile ? null : window.open("", "_blank");
    if (win) win.opener = null;
    setTgLink({ state: "busy" });
    try {
      const res = await fetch("/api/user/telegram-link", { method: "POST" });
      const j = await res.json();
      if (!j.success) {
        win?.close();
        if (res.status === 409) await fetchSubscription();
        setTgLink({ state: "error", error: j.error || t.tgLinkFail });
        return;
      }
      const { url, startParam } = j.data as { url: string | null; startParam: string };
      if (url && mobile) window.location.href = url;
      else if (url && win) win.location.href = url;
      else win?.close();
      setTgLink({ state: "ready", url, startParam, mobile });
    } catch {
      win?.close();
      setTgLink({ state: "error", error: t.netFail });
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/auth");
  };

  const handleForceResync = async () => {
    if (resyncing) return;
    setResyncing(true);
    setResyncStatus(null);
    try {
      const res = await fetch("/api/user/force-resync", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        const applied = json.data.paymentsApplied || 0;
        let text: string;
        if (applied > 0) {
          text = applied === 1 ? t.resyncOne : fill(t.resyncMany, { n: applied });
        } else if (json.data.changed) {
          text = t.resyncChanged;
        } else if (["patched", "created", "adopted"].includes(json.data.panelAction)) {
          text = t.resyncPanel;
        } else {
          text = t.resyncOk;
        }
        setResyncStatus({ kind: "ok", text });
        await fetchSubscription();
      } else {
        setResyncStatus({ kind: "error", text: json.error || t.resyncFail });
      }
    } catch {
      setResyncStatus({ kind: "error", text: t.resyncNet });
    } finally {
      setResyncing(false);
      setTimeout(() => setResyncStatus(null), 7000);
    }
  };

  if (loading || !data) return <LoadingSkeleton loading={t.loading} />;

  // Показываем почту целиком: это и есть логин, и человек сверяет,
  // в тот ли аккаунт вошёл. Обрезанный префикс («ivan») этого не даёт.
  const name = data.email;
  const initial = (data.email.trim().charAt(0) || "A").toUpperCase();
  const endShort = new Date(data.subscriptionEnd).toLocaleDateString(intlLocale(locale), { day: "numeric", month: "short" });
  /**
   * Остаток обхода в плашке. Панель спрашиваем после отрисовки, и пока
   * ответа нет — строки просто нет: пустое место лучше, чем прочерк,
   * который человек примет за «ничего не осталось».
   */
  const bypassLabel = bypass.live
    ? bypass.live.unlimited
      ? t.noLimit
      : bypass.live.remainingBytes != null
        ? formatBytes(bypass.live.remainingBytes)
        : null
    : null;
  const unreadLabel = unreadCount > 9 ? "9+" : String(unreadCount);
  const tgError = tgLink.state === "error" ? tgLink.error : null;

  return (
    <>
      <div className="v-wrap vc-page">
        {/* ── Профиль ──────────────────────────────────────────────── */}
        <div className="vc-profile-row">
          <div className="vc-profile-id">
            <span className="v-avatar" aria-hidden>{initial}</span>
            <div className="vc-profile-text">
              <div className="vc-name-row">
                <h1 className="vc-name" title={data.email}>{name}</h1>
                {data.telegramLinked ? (
                  <span className="vc-chip vc-chip-on">
                    <Icon name="send" size={14} />
                    {t.tgLinked}
                  </span>
                ) : (
                  <button type="button" className="vc-chip" onClick={startTelegramLink} disabled={tgLink.state === "busy"}>
                    <Icon name="send" size={14} />
                    {tgLink.state === "busy" ? t.tgOpening : t.tgLink}
                  </button>
                )}
              </div>
              {/* Вместо баланса — то, за чем человек сюда и заходит
                  (владелец, 20.09.2026: «баланс тут не нужен»): до
                  какого числа работает подписка и сколько осталось
                  трафика обхода. Баланс живёт в боте и на сайте его
                  всё равно не потратить. */}
              <span className="vc-facts">
                <span className="vc-fact">
                  <i>{t.factSub}</i>
                  <b>{data.isExpired ? t.subEnded : fill(t.subUntil, { date: endShort })}</b>
                </span>
                {bypassLabel && (
                  <span className="vc-fact">
                    <i>{t.factBypass}</i>
                    <b>{bypassLabel}</b>
                  </span>
                )}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="v-btn v-btn-soft v-btn-sm vc-bell"
            onClick={() => setShowNotifications(true)}
            aria-label={unreadCount > 0 ? fill(t.bellNew, { n: unreadLabel }) : t.bell}
          >
            <Icon name="bell" size={16} />
            {/* Счётчик — маленький кружок в углу кнопки. Прежняя плашка
                `v-badge` высотой 30px не помещалась в кнопку 44px и
                разъезжала её (владелец, 20.09.2026). */}
            {unreadCount > 0 && <span className="vc-bell-n" aria-hidden>{unreadLabel}</span>}
          </button>
        </div>

        {tgError && (
          <p className="v-error" role="alert" style={{ marginBottom: 16 }}>{tgError}</p>
        )}

        {/* ── Сегмент разделов ─────────────────────────────────────── */}
        <div className="v-seg v-seg-lg vc-tabs" role="tablist" aria-label={t.tabsLabel}>
          {TABS.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} onClick={() => setActive(tab.id)}>
              <Icon name={tab.icon} size={20} />
              <span className="vc-tab-label">{t.tabs[tab.id]}</span>
            </button>
          ))}
        </div>

        {/* ── Содержимое активной вкладки (key — переигрывает появление) */}
        <div key={active} className="v-fade-in">
          {active === "subs" && (
            <CabinetKey
              locale={locale}
              units={units}
              t={t.key}
              data={data}
              resyncing={resyncing}
              resyncStatus={resyncStatus}
              onResync={handleForceResync}
              onBuyTraffic={() => setActive("buy", { kind: "traffic" })}
              onGoProfile={() => setActive("profile")}
            />
          )}

          {active === "payments" && <CabinetPayments locale={locale} t={t.payments} />}

          {active === "buy" && <BuyPanel data={data} initialKind={kindParam} cards={cards} locale={locale} units={units} t={t} />}

          {active === "profile" && (
            <ProfilePanel
              locale={locale}
              t={t.profile}
              tFriends={t.friends}
              tSettings={t.settings}
              data={data}
              tgLink={tgLink}
              onStartTelegramLink={startTelegramLink}
              isAdmin={!!data.isAdmin}
              onOpenNotifications={() => setShowNotifications(true)}
              unreadCount={unreadCount}
              onLogout={() => setShowLogoutConfirm(true)}
            />
          )}
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="vc-dialog" role="dialog" aria-modal="true" aria-labelledby="vc-out-h">
          <div className="vc-dialog-veil" onClick={() => !loggingOut && setShowLogoutConfirm(false)} />
          <div className="vc-dialog-card">
            <h2 id="vc-out-h" className="v-h3">{t.outTitle}</h2>
            <p className="v-text">{t.outText}</p>
            <div className="v-actions">
              <button type="button" autoFocus onClick={() => setShowLogoutConfirm(false)} disabled={loggingOut} className="v-btn v-btn-soft">
                {t.outStay}
              </button>
              <button type="button" onClick={handleLogout} disabled={loggingOut} className="v-btn vc-btn-danger">
                {loggingOut ? t.outBusy : t.outGo}
              </button>
            </div>
          </div>
        </div>
      )}

      {(data.subscriptionPlan || "trial") === "trial" && !data.isExpired && (
        <WelcomeToast subscriptionEnd={data.subscriptionEnd} />
      )}
      <PasskeyPrompt />
      <IosInstallSheet />
      <NotificationsModal open={showNotifications} onClose={() => setShowNotifications(false)} onUnreadCountChange={setUnreadCount} />
    </>
  );
}

/** «Купить»: вкладки «Подписка» / «Трафик» над готовыми каруселями. */
function BuyPanel({ data, initialKind, cards, locale, units, t }: { data: SubscriptionData; initialKind: "plan" | "traffic" } & Cards) {
  const [kind, setKind] = useState<"plan" | "traffic">(initialKind);
  const plan = data.subscriptionPlan || "trial";
  const end = new Date(data.subscriptionEnd).toLocaleDateString(intlLocale(locale), { day: "numeric", month: "long" });
  const offer = data.isExpired
    ? t.buy.expired
    : plan === "trial"
      ? fill(t.buy.trial, { days: count(locale, data.daysLeft, units.day) })
      : fill(t.buy.plan, { plan: plan === "plus" ? "Plus" : "Basic", date: end });
  return (
    <div className="vc-panel" aria-labelledby="vc-buy-h">
      <h2 id="vc-buy-h" className="vc-cab-title">
        <Icon name="grid" size={26} />
        {t.buy.title}
      </h2>
      <p className="vc-lead">{offer}</p>
      <div className="v-tabs-line vc-buy-tabs" role="tablist" aria-label={t.buy.tabsLabel}>
        <button type="button" role="tab" aria-selected={kind === "plan"} onClick={() => setKind("plan")}>{t.buy.tabPlan}</button>
        <button type="button" role="tab" aria-selected={kind === "traffic"} onClick={() => setKind("traffic")}>{t.buy.tabTraffic}</button>
      </div>
      <div key={kind} className="v-fade-in" style={{ marginTop: 24 }}>
        {kind === "plan" ? (
          <PlanCards locale={locale} t={cards} units={units} href={(plan, period) => `/subscribe?plan=${plan}&period=${period}`} />
        ) : (
          <TrafficCards locale={locale} t={cards} />
        )}
      </div>
    </div>
  );
}

/** «Профиль»: настройки, Telegram, друзья, уведомления, сеть — по одной карточке. */
function ProfilePanel({
  locale,
  t,
  tFriends,
  tSettings,
  data,
  tgLink,
  onStartTelegramLink,
  isAdmin,
  onOpenNotifications,
  unreadCount,
  onLogout,
}: {
  locale: Locale;
  t: T["profile"];
  tFriends: T["friends"];
  tSettings: T["settings"];
  data: SubscriptionData;
  tgLink: TgLinkState;
  onStartTelegramLink: () => void;
  isAdmin: boolean;
  onOpenNotifications: () => void;
  unreadCount: number;
  onLogout: () => void;
}) {
  const unreadLabel = unreadCount > 9 ? "9+" : String(unreadCount);
  return (
    <div className="vc-panel" aria-labelledby="vc-pr-h">
      <h2 id="vc-pr-h" className="vc-cab-title">
        <Icon name="user" size={26} />
        {t.title}
      </h2>

      <div className="v-card v-card-pad v-lift" style={{ marginBottom: 16 }} aria-labelledby="vc-tg-h">
        <div className="vc-kblock-head">
          <h3 id="vc-tg-h">Telegram</h3>
          {data.telegramLinked && <span className="v-badge v-badge-green">{t.tgBadge}</span>}
        </div>
        <p className="v-text">
          {data.telegramLinked ? t.tgTextOn : t.tgTextOff}
        </p>
        <div className="vc-actions">
          {!data.telegramLinked ? (
            <button type="button" onClick={onStartTelegramLink} disabled={tgLink.state === "busy"} className="v-btn v-btn-primary v-btn-sm">
              <Icon name="send" size={16} />
              {tgLink.state === "busy" ? t.tgPreparing : tgLink.state === "ready" ? t.tgNewLink : t.tgLink}
            </button>
          ) : null}
        </div>
        {/* ОТВЯЗКИ В КАБИНЕТЕ БОЛЬШЕ НЕТ (владелец, 22.09.2026).
            Здесь стояла кнопка и выбор стороны — «оставить на сайте» или
            «оставить в боте».

            Причина не в кнопке, а в том, что за ней. Разбор жалобы
            (`docs/bot/TZ_BYPASS_MERGE.md`) показал: при отвязке
            гигабайты, купленные на сайте, оставались в ботовской
            сущности и для человека пропадали. Починка упирается в
            развилку, где оба пути платные: перенести байты — у человека
            меняется ключ обхода и приложение надо настраивать заново;
            передать сущность — бот навсегда теряет её из виду, потому
            что ищет по имени.

            Решение владельца: пока развилка не решена, отвязку людям не
            показывать. Сама логика цела и доступна админке — там
            человек в контуре и видит последствия. Связку доводим
            отдельно: она работает и складывает верно. */}
        {!data.telegramLinked && tgLink.state === "ready" && (
          tgLink.url ? (
            tgLink.mobile ? (
              <p className="vc-fine" role="status">{rich(fill(t.tgFineMobile, { url: tgLink.url }), locale)}</p>
            ) : (
              <div role="status">
                <div className="vc-qr">
                  <QRCodeSVG value={tgLink.url} size={188} level="M" marginSize={2} />
                </div>
                <p className="vc-fine">{rich(fill(t.tgFineQr, { url: tgLink.url }), locale)}</p>
              </div>
            )
          ) : (
            <div className="vc-fine">
              {t.tgNoBot} <code>/start {tgLink.startParam}</code>
            </div>
          )
        )}
      </div>

      <div className="v-card v-card-pad v-lift" style={{ marginBottom: 16 }} id="vc-friends-card">
        <CabinetFriends
          locale={locale}
          t={tFriends}
          referralCode={data.referralCode}
          cashbackPercent={data.cashbackPercent}
          referrals={data.referrals}
          paidReferrals={data.paidReferrals}
        />
      </div>

      <div className="v-card v-card-pad v-lift" style={{ marginBottom: 16 }}>
        <CabinetSettings locale={locale} t={tSettings} />
      </div>

      <div className="v-card v-card-pad v-lift">
        <div className="v-rows">
          <button type="button" className="v-row vc-row-btn" onClick={onOpenNotifications}>
            <span className="v-row-icon" aria-hidden><Icon name="bell" size={20} /></span>
            <span className="v-row-main">
              <b>{t.notifTitle}</b>
              <span className="v-small">{unreadCount > 0 ? fill(t.notifNew, { n: unreadLabel }) : t.notifNone}</span>
            </span>
            <span className="v-row-side"><Icon name="chevron-right" size={16} /></span>
          </button>
          {isAdmin && (
            <Link href={localeHref("/admin", locale)} className="v-row">
              <span className="v-row-icon" aria-hidden><Icon name="shield" size={20} /></span>
              <span className="v-row-main"><b>{t.admin}</b></span>
              <span className="v-row-side"><Icon name="chevron-right" size={16} /></span>
            </Link>
          )}
          {/* Выход — здесь, а не над разделами: самое необратимое
              действие не должно быть самой заметной кнопкой экрана. */}
          <button type="button" className="v-row vc-row-btn vc-row-out" onClick={onLogout}>
            <span className="v-row-icon" aria-hidden><Icon name="logout" size={20} /></span>
            <span className="v-row-main">
              <b>{t.logout}</b>
              <span className="v-small">{t.logoutNote}</span>
            </span>
            <span className="v-row-side"><Icon name="chevron-right" size={16} /></span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardView(copy: Cards) {
  return (
    <Suspense fallback={<LoadingSkeleton loading={copy.t.loading} />}>
      <DashboardViewInner {...copy} />
    </Suspense>
  );
}
