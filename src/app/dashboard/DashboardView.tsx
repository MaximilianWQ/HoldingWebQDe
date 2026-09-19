"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
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
const TABS: { id: TabId; label: string; icon: IconName }[] = [
  { id: "subs", label: "Главная", icon: "bag" },
  { id: "payments", label: "Платежи", icon: "receipt" },
  { id: "buy", label: "Купить", icon: "grid" },
  { id: "profile", label: "Профиль", icon: "user" },
];

type TgLinkState =
  | { state: "idle" }
  | { state: "busy" }
  | { state: "ready"; url: string | null; startParam: string; mobile: boolean }
  | { state: "error"; error: string };

function LoadingSkeleton() {
  return (
    <div className="v-wrap vc-page" aria-busy="true">
      <p className="v-sr" aria-live="polite">Загружаем кабинет…</p>
      <div className="vc-loading" aria-hidden>
        <div className="vc-skel" style={{ height: 96 }} />
        <div className="vc-skel" style={{ height: 64 }} />
        <div className="vc-skel" style={{ height: 140 }} />
        <div className="vc-skel" style={{ height: 140 }} />
      </div>
    </div>
  );
}

function DashboardViewInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unlinkStep, setUnlinkStep] = useState(0);
  const [unlinking, setUnlinking] = useState(false);
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
        setTgLink({ state: "error", error: j.error || "Не удалось получить ссылку. Попробуйте ещё раз." });
        return;
      }
      const { url, startParam } = j.data as { url: string | null; startParam: string };
      if (url && mobile) window.location.href = url;
      else if (url && win) win.location.href = url;
      else win?.close();
      setTgLink({ state: "ready", url, startParam, mobile });
    } catch {
      win?.close();
      setTgLink({ state: "error", error: "Нет связи с сервером. Попробуйте ещё раз." });
    }
  };

  const handleUnlinkTelegram = async () => {
    setUnlinking(true);
    try {
      const res = await fetch("/api/user/telegram-unlink", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        setData((prev) => (prev ? { ...prev, telegramLinked: false } : prev));
        setUnlinkStep(0);
      }
    } catch {
      // как раньше: молча
    } finally {
      setUnlinking(false);
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
          text = applied === 1 ? "Оплата подхвачена — подписка активирована." : `Подхвачено оплат: ${applied}. Подписка активирована.`;
        } else if (json.data.changed) {
          text = "Подписка обновлена — данные пересчитаны по последней оплате.";
        } else if (["patched", "created", "adopted"].includes(json.data.panelAction)) {
          text = "Проверка завершена — данные и панель актуальны.";
        } else {
          text = "Проверка завершена — данные актуальны.";
        }
        setResyncStatus({ kind: "ok", text });
        await fetchSubscription();
      } else {
        setResyncStatus({ kind: "error", text: json.error || "Не удалось обновить." });
      }
    } catch {
      setResyncStatus({ kind: "error", text: "Ошибка сети." });
    } finally {
      setResyncing(false);
      setTimeout(() => setResyncStatus(null), 7000);
    }
  };

  if (loading || !data) return <LoadingSkeleton />;

  // Показываем почту целиком: это и есть логин, и человек сверяет,
  // в тот ли аккаунт вошёл. Обрезанный префикс («ivan») этого не даёт.
  const name = data.email;
  const initial = (data.email.trim().charAt(0) || "A").toUpperCase();
  const balanceStr = data.balance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
                    Telegram привязан
                  </span>
                ) : (
                  <button type="button" className="vc-chip" onClick={startTelegramLink} disabled={tgLink.state === "busy"}>
                    <Icon name="send" size={14} />
                    {tgLink.state === "busy" ? "Готовим ссылку…" : "Привязать Telegram · тест"}
                  </button>
                )}
              </div>
              <span className="v-balance vc-balance">
                Баланс: <b>{balanceStr} ₽</b>
              </span>
            </div>
          </div>
          <button
            type="button"
            className="v-btn v-btn-soft v-btn-sm"
            onClick={() => setShowNotifications(true)}
            aria-label={unreadCount > 0 ? `Уведомления: ${unreadLabel} новых` : "Уведомления"}
          >
            <Icon name="bell" size={16} />
            {unreadCount > 0 && <span className="v-badge v-badge-red">{unreadLabel}</span>}
          </button>
        </div>

        {tgError && (
          <p className="v-error" role="alert" style={{ marginBottom: 16 }}>{tgError}</p>
        )}

        {/* ── Сегмент разделов ─────────────────────────────────────── */}
        <div className="v-seg v-seg-lg vc-tabs" role="tablist" aria-label="Разделы кабинета">
          {TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={active === t.id} onClick={() => setActive(t.id)}>
              <Icon name={t.icon} size={20} />
              <span className="vc-tab-label">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Содержимое активной вкладки (key — переигрывает появление) */}
        <div key={active} className="v-fade-in">
          {active === "subs" && (
            <CabinetKey
              data={data}
              resyncing={resyncing}
              resyncStatus={resyncStatus}
              onResync={handleForceResync}
              onBuyTraffic={() => setActive("buy", { kind: "traffic" })}
              onGoProfile={() => setActive("profile")}
            />
          )}

          {active === "payments" && <CabinetPayments />}

          {active === "buy" && <BuyPanel data={data} initialKind={kindParam} />}

          {active === "profile" && (
            <ProfilePanel
              data={data}
              tgLink={tgLink}
              unlinkStep={unlinkStep}
              unlinking={unlinking}
              onStartTelegramLink={startTelegramLink}
              onUnlinkStepChange={setUnlinkStep}
              onUnlinkTelegram={handleUnlinkTelegram}
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
            <h2 id="vc-out-h" className="v-h3">Выйти из аккаунта?</h2>
            <p className="v-text">Чтобы войти снова, понадобится код из письма.</p>
            <div className="v-actions">
              <button type="button" autoFocus onClick={() => setShowLogoutConfirm(false)} disabled={loggingOut} className="v-btn v-btn-soft">
                Остаться
              </button>
              <button type="button" onClick={handleLogout} disabled={loggingOut} className="v-btn vc-btn-danger">
                {loggingOut ? "Выходим…" : "Выйти"}
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
function BuyPanel({ data, initialKind }: { data: SubscriptionData; initialKind: "plan" | "traffic" }) {
  const [kind, setKind] = useState<"plan" | "traffic">(initialKind);
  const plan = data.subscriptionPlan || "trial";
  const end = new Date(data.subscriptionEnd).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  const offer = data.isExpired
    ? "Подписка не активна — выберите тариф, чтобы включить доступ снова."
    : plan === "trial"
      ? `Сейчас пробный период, осталось ${data.daysLeft} дн. — оформите тариф, чтобы не потерять доступ.`
      : `Сейчас тариф ${plan === "plus" ? "Plus" : "Basic"}, действует до ${end} — продлите или смените тариф.`;
  return (
    <div className="vc-panel" aria-labelledby="vc-buy-h">
      <h2 id="vc-buy-h" className="vc-cab-title">
        <Icon name="grid" size={26} />
        Купить
      </h2>
      <p className="vc-lead">{offer}</p>
      <div className="v-tabs-line vc-buy-tabs" role="tablist" aria-label="Что купить">
        <button type="button" role="tab" aria-selected={kind === "plan"} onClick={() => setKind("plan")}>Подписка</button>
        <button type="button" role="tab" aria-selected={kind === "traffic"} onClick={() => setKind("traffic")}>Трафик</button>
      </div>
      <div key={kind} className="v-fade-in" style={{ marginTop: 24 }}>
        {kind === "plan" ? (
          <PlanCards href={(plan, period) => `/subscribe?plan=${plan}&period=${period}`} />
        ) : (
          <TrafficCards />
        )}
      </div>
    </div>
  );
}

/** «Профиль»: настройки, Telegram, друзья, уведомления, сеть — по одной карточке. */
function ProfilePanel({
  data,
  tgLink,
  unlinkStep,
  unlinking,
  onStartTelegramLink,
  onUnlinkStepChange,
  onUnlinkTelegram,
  isAdmin,
  onOpenNotifications,
  unreadCount,
  onLogout,
}: {
  data: SubscriptionData;
  tgLink: TgLinkState;
  unlinkStep: number;
  unlinking: boolean;
  onStartTelegramLink: () => void;
  onUnlinkStepChange: (n: number) => void;
  onUnlinkTelegram: () => void;
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
        Профиль
      </h2>

      <div className="v-card v-card-pad v-lift" style={{ marginBottom: 16 }} aria-labelledby="vc-tg-h">
        <div className="vc-kblock-head">
          <h3 id="vc-tg-h">Telegram</h3>
          {data.telegramLinked && <span className="v-badge v-badge-green">Привязан</span>}
        </div>
        <p className="v-text">
          {data.telegramLinked ? "Одна подписка и один ключ — в боте и на сайте." : "Одна подписка на бот и сайт. Тестовый режим."}
        </p>
        <div className="vc-actions">
          {!data.telegramLinked ? (
            <button type="button" onClick={onStartTelegramLink} disabled={tgLink.state === "busy"} className="v-btn v-btn-primary v-btn-sm">
              <Icon name="send" size={16} />
              {tgLink.state === "busy" ? "Готовим ссылку…" : tgLink.state === "ready" ? "Новая ссылка" : "Привязать Telegram"}
            </button>
          ) : unlinkStep === 0 ? (
            <button type="button" onClick={() => onUnlinkStepChange(1)} className="v-btn v-btn-soft v-btn-sm">Отвязать</button>
          ) : (
            <>
              <button type="button" onClick={() => onUnlinkStepChange(0)} className="v-btn v-btn-soft v-btn-sm">Отмена</button>
              <button type="button" onClick={onUnlinkTelegram} disabled={unlinking} className="v-btn vc-btn-danger v-btn-sm">
                {unlinking ? "Отвязываем…" : "Да, отвязать"}
              </button>
            </>
          )}
        </div>
        {data.telegramLinked && unlinkStep === 1 && (
          <p className="vc-fine">Подписка и ключ останутся в этом кабинете. Бонус за повторную привязку не начисляется.</p>
        )}
        {!data.telegramLinked && tgLink.state === "ready" && (
          tgLink.url ? (
            tgLink.mobile ? (
              <p className="vc-fine" role="status">
                Если Telegram не открылся — <a href={tgLink.url}>откройте бота по ссылке</a>. Ссылка одноразовая, действует 15 минут.
              </p>
            ) : (
              <div role="status">
                <div className="vc-qr">
                  <QRCodeSVG value={tgLink.url} size={188} level="M" marginSize={2} />
                </div>
                <p className="vc-fine">
                  Бот открылся в новой вкладке. Можно и с телефона — наведите камеру на QR-код или{" "}
                  <a href={tgLink.url} target="_blank" rel="noopener noreferrer">откройте ссылку</a>. Ссылка одноразовая, действует 15 минут.
                </p>
              </div>
            )
          ) : (
            <div className="vc-fine">
              Ссылка на бота не настроена. Откройте бота Atlas Secure и отправьте ему команду: <code>/start {tgLink.startParam}</code>
            </div>
          )
        )}
      </div>

      <div className="v-card v-card-pad v-lift" style={{ marginBottom: 16 }} id="vc-friends-card">
        <CabinetFriends
          referralCode={data.referralCode}
          cashbackPercent={data.cashbackPercent}
          loyaltyTier={data.loyaltyTier}
          referrals={data.referrals}
          paidReferrals={data.paidReferrals}
        />
      </div>

      <div className="v-card v-card-pad v-lift" style={{ marginBottom: 16 }}>
        <CabinetSettings />
      </div>

      <div className="v-card v-card-pad v-lift">
        <div className="v-rows">
          <button type="button" className="v-row vc-row-btn" onClick={onOpenNotifications}>
            <span className="v-row-icon" aria-hidden><Icon name="bell" size={20} /></span>
            <span className="v-row-main">
              <b>Уведомления</b>
              <span className="v-small">{unreadCount > 0 ? `Новых: ${unreadLabel}` : "Новых нет"}</span>
            </span>
            <span className="v-row-side"><Icon name="chevron-right" size={16} /></span>
          </button>
          {isAdmin && (
            <Link href="/admin" className="v-row">
              <span className="v-row-icon" aria-hidden><Icon name="shield" size={20} /></span>
              <span className="v-row-main"><b>Админ-панель</b></span>
              <span className="v-row-side"><Icon name="chevron-right" size={16} /></span>
            </Link>
          )}
          {/* Выход — здесь, а не над разделами: самое необратимое
              действие не должно быть самой заметной кнопкой экрана. */}
          <button type="button" className="v-row vc-row-btn vc-row-out" onClick={onLogout}>
            <span className="v-row-icon" aria-hidden><Icon name="logout" size={20} /></span>
            <span className="v-row-main">
              <b>Выйти из аккаунта</b>
              <span className="v-small">Понадобится код из письма, чтобы войти снова</span>
            </span>
            <span className="v-row-side"><Icon name="chevron-right" size={16} /></span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardView() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <DashboardViewInner />
    </Suspense>
  );
}
