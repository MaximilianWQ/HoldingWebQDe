"use client";

import { useState, useEffect, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import NotificationsModal from "@/components/NotificationsModal";
import WelcomeToast from "@/components/WelcomeToast";
import PasskeyPrompt from "@/components/PasskeyPrompt";
import IosInstallSheet from "@/components/IosInstallSheet";
import { TRIAL_DAYS, TELEGRAM_BONUS_DAYS } from "@/lib/brand-facts";
import { DEVICE_LIMIT } from "@/lib/plans";
import { plural } from "@/lib/locations";
import type { SubscriptionData } from "@/types";
import CabinetKey from "./CabinetKey";
import CabinetFriends from "./CabinetFriends";
import CabinetNetwork from "./CabinetNetwork";
import CabinetSettings from "./CabinetSettings";
import Corner from "@/components/atlas/Corner";
import OrbGL from "@/components/atlas/OrbGL";
import "@/app/work-atlas.css";

/**
 * Кабинет на корпусе «Атлас-издание» (владелец, 11.09.2026: «дашборд —
 * полностью редизайн, блоки делаем, кнопки слегка закруглённые»).
 *
 * Рабочий экран: белые панели на сером поле, крупным — то, ради чего
 * пришли. Порядок по важности для телефона: подписка → баланс → ключ →
 * быстрые переходы → друзья → сеть → Telegram → уведомления и вход.
 *
 * Логика прежнего кабинета перенесена без изменений: загрузка подписки
 * (без сессии — на вход), проверка подписки, выход с подтверждением,
 * привязка и отвязка Telegram, уведомления, приглашения, push, passkey.
 *
 * «Первые шаги» — только на пробном периоде: полоса шагов и пункты из
 * общего слоя мастеров (.ak-stepper, .ak-perks), что и на входе. Шаги
 * считаются по уже пришедшим полям: Telegram — telegramLinked, друг —
 * referrals > 0. Подключено ли устройство, API не сообщает — этот шаг
 * всегда открыт и ведёт на /devices.
 *
 * Движение — src/app/work-atlas.css, раздел «Движение»: панели поднимаются
 * при первом входе в кадр (MotionController ставит data-seen на
 * [data-sheet]), у каждой свой холостой слой, на паузе вне кадра.
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

const at = (i: number) => ({ "--i": i }) as CSSProperties;

/** Привязка Telegram с сайта: одноразовая ссылка на бота (15 минут). */
type TgLinkState =
  | { state: "idle" }
  | { state: "busy" }
  | { state: "ready"; url: string | null; startParam: string; mobile: boolean }
  | { state: "error"; error: string };

/* Разделы кабинета: пилюли на доске (планшет, десктоп) и вкладки внизу
   (телефон) — один список, одна подсветка. */
const SECTIONS: { id: string; label: string; icon: IconName }[] = [
  { id: "ak-sub", label: "Подписка", icon: "clock" },
  { id: "ak-key", label: "Ключи", icon: "qr" },
  { id: "referral-section", label: "Друзья", icon: "users" },
  { id: "ak-set", label: "Настройки", icon: "bell" },
];
const SECTION_IDS = SECTIONS.map((s) => s.id);

export default function DashboardView() {
  const router = useRouter();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedRef, setCopiedRef] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [unlinkStep, setUnlinkStep] = useState(0);
  const [unlinking, setUnlinking] = useState(false);
  const [tgLink, setTgLink] = useState<TgLinkState>({ state: "idle" });
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [resyncing, setResyncing] = useState(false);
  const [resyncStatus, setResyncStatus] = useState<null | { kind: "ok" | "error"; text: string }>(null);
  // Раздел в кадре — подсвечивает пилюлю сверху и вкладку снизу.
  const [active, setActive] = useState("ak-sub");

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

  // Диалог выхода закрывается по Esc, пока выход не начался.
  useEffect(() => {
    if (!showLogoutConfirm) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !loggingOut && setShowLogoutConfirm(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showLogoutConfirm, loggingOut]);

  // Какой раздел пересекает середину окна — тот и активен.
  useEffect(() => {
    if (!data) return;
    const els = SECTION_IDS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [data]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2500);
  };

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
    // Вкладку открываем сразу, в обработчике нажатия, — иначе браузер
    // сочтёт её всплывающим окном и заблокирует.
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
        setData((prev) => (prev ? { ...prev, telegramLinked: false, telegramLinkToken: result.data.telegramLinkToken } : prev));
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

  if (loading || !data) {
    return (
      <main id="main" className="a-main ak" aria-busy="true">
        <div className="a-field">
          <p className="b-sr" aria-live="polite">Загружаем кабинет…</p>
          <div className="ak-grid" aria-hidden>
            {["ak-sub", "ak-bal", "ak-key", "ak-quick"].map((c) => (
              <div key={c} className={`ak-skel ${c}`} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  const plan = data.subscriptionPlan || "trial";
  const isTrial = plan === "trial";
  const isExpired = data.isExpired;
  const isExpiring = !isExpired && data.daysLeft < 3;
  const tone = isExpired ? "off" : isExpiring ? "warn" : undefined;
  const statusLabel = isExpired ? "Не активна" : isExpiring ? "Скоро закончится" : isTrial ? "Пробный период" : "Активна";
  const planLabel = isExpired
    ? "Подписка"
    : isTrial
      ? `Пробный · ${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`
      : plan === "plus"
        ? "Тариф Plus"
        : plan === "basic"
          ? "Тариф Basic"
          : "Подписка";

  const end = new Date(data.subscriptionEnd);
  const endDate = end.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  const endTime = end.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  // Тридцать клеток — месяц. Больше месяца — полная полоса.
  const filled = isExpired ? 0 : Math.min(30, Math.max(1, data.daysLeft));
  const unreadLabel = unreadCount > 9 ? "9+" : String(unreadCount);
  // Ключи: основной — пока подписка активна; «Обход» живёт отдельно
  // (гигабайты без срока), поэтому раздел остаётся и после окончания
  // подписки, если ключ 2 есть или ждёт зачисления.
  const hasSecondKey = !!(data.bypassKey?.known || data.bypassKey?.maybe || (data.bypassOwedBytes ?? 0) > 0);
  const showKeys = !isExpired || hasSecondKey;
  const sections = showKeys ? SECTIONS : SECTIONS.filter((s) => s.id !== "ak-key");

  // Первые шаги — только на пробном: платный уже прошёл этот путь, а те
  // же кнопки у него есть в панелях Telegram и «Друзья».
  const showFirst = isTrial && !isExpired;
  const tgBonus = `${TELEGRAM_BONUS_DAYS} ${plural(TELEGRAM_BONUS_DAYS, ["день", "дня", "дней"])}`;
  const firstSteps: { id: string; short: string; title: string; text: string; icon: IconName; done: boolean; act: (primary: boolean) => React.ReactNode }[] = [
    {
      id: "device",
      short: "Устройство",
      title: "Подключите устройство",
      text: `Телефон, компьютер или телевизор — до ${DEVICE_LIMIT} на одной подписке.`,
      icon: "devices",
      done: false,
      act: (primary) => (
        <Link href="/devices" className={`a-btn ${primary ? "a-btn-primary" : "ak-btn-soft"}`}>
          Подключить
          <Icon name="arrow-right" size={16} />
        </Link>
      ),
    },
    {
      id: "tg",
      short: "Telegram",
      title: data.telegramLinked ? "Telegram привязан" : "Привяжите Telegram",
      text: data.telegramLinked ? "Подписка синхронизирована с ботом." : `+${tgBonus} к подписке за привязку бота.`,
      icon: "send",
      done: data.telegramLinked,
      act: (primary) =>
        data.telegramLinked ? (
          <span className="ak-status"><i />Готово</span>
        ) : (
          <button
            type="button"
            onClick={startTelegramLink}
            disabled={tgLink.state === "busy"}
            className={`a-btn ${primary ? "a-btn-primary" : "ak-btn-soft"}`}
          >
            {tgLink.state === "busy" ? "Готовим ссылку…" : "Привязать"}
            <span className="b-sr"> Telegram (откроется бот)</span>
          </button>
        ),
    },
    {
      id: "friend",
      short: "Друг",
      title: "Пригласите друга",
      text:
        data.referrals > 0
          ? `Приглашено: ${data.referrals}. Кешбэк ${data.cashbackPercent}% с их оплат.`
          : `Кешбэк ${data.cashbackPercent}% с каждой оплаты друга.`,
      icon: "users",
      done: data.referrals > 0,
      act: (primary) => (
        <a href="#referral-section" className={`a-btn ${primary ? "a-btn-primary" : "ak-btn-soft"}`}>
          {data.referrals > 0 ? "К приглашениям" : "Пригласить"}
        </a>
      ),
    },
  ];
  const firstNow = firstSteps.findIndex((s) => !s.done);
  const firstDone = firstSteps.filter((s) => s.done).length;

  return (
    <>
      <main id="main" className="a-main ak">
        <div className="a-field">
          {/* ── Верх: кто вы и действия кабинета ───────────────────── */}
          <section className="ak-top" data-sheet="20" style={at(0)} aria-label="Аккаунт">
            <div>
              <p className="ak-kicker a-wide">{data.email}</p>
              <h1 className="ak-h1">Кабинет</h1>
            </div>
            <div className="ak-tools">
              {data.isAdmin && (
                <Link href="/admin" className="a-btn ak-btn-soft" aria-label="Админ-панель">
                  <Icon name="shield" size={16} />
                  <span className="ak-lbl">Админ-панель</span>
                </Link>
              )}
              <button
                type="button"
                className="ak-icon"
                onClick={() => setShowNotifications((v) => !v)}
                aria-label={unreadCount > 0 ? `Уведомления: ${unreadLabel} новых` : "Уведомления"}
              >
                <Icon name="bell" size={18} />
                {unreadCount > 0 && <span className="ak-badge" aria-hidden>{unreadLabel}</span>}
              </button>
              <button type="button" className="a-btn ak-btn-soft" onClick={() => setShowLogoutConfirm(true)} aria-label="Выйти">
                <Icon name="logout" size={16} />
                <span className="ak-lbl">Выйти</span>
              </button>
            </div>
          </section>

          {/* Доска: все панели в одной раме (референс владельца). */}
          <div className="ak-board">
          <nav className="ak-bar" aria-label="Разделы кабинета">
            <span className="ak-avatar" aria-hidden>{data.email.trim().charAt(0) || "A"}</span>
            <div className="ak-pills">
              {sections.map((s) => (
                <a key={s.id} className="ak-pill" href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined}>
                  {s.label}
                </a>
              ))}
            </div>
            <span className="ak-bar-plan">{planLabel}</span>
          </nav>
          <div className="ak-grid" data-nokey={showKeys ? undefined : ""}>
            {/* ── 1 · Подписка ─────────────────────────────────────── */}
            <section id="ak-sub" className="ak-card ak-sub ak-dark ak-has-orb" data-sheet="20" style={at(1)} aria-labelledby="ak-sub-h">
              <Corner href="/pricing" label="Тарифы и цены" />
              {/* Ядро: работает — active, пробный или скоро кончится — idle, истекла — off. */}
              <OrbGL className="ak-orb" theme="dark" state={isExpired ? "off" : isTrial || isExpiring ? "idle" : "active"} />
              <div className="ak-card-head">
                <h2 id="ak-sub-h" className="ak-eyebrow">
                  Подписка{planLabel !== "Подписка" && <> · <span className="ak-plan">{planLabel}</span></>}
                </h2>
                <span className="ak-status" data-tone={tone}><i />{statusLabel}</span>
              </div>

              {isExpired ? (
                <>
                  <p className="ak-value">Подписка не активна</p>
                  <p className="ak-fine">Доступ закрыт с {endDate}. Продлите — и всё снова заработает.</p>
                </>
              ) : (
                <>
                  <p className="ak-value">
                    <span className="a-num">{humanRemaining(data.daysLeft, data.hoursLeft)}</span>
                    <small>осталось</small>
                  </p>
                  <div className="ak-days" data-tone={tone} aria-hidden>
                    {Array.from({ length: 30 }, (_, k) => (
                      <span
                        key={k}
                        className="ak-day"
                        style={{ "--k": k } as CSSProperties}
                        data-on={k < filled ? "" : undefined}
                        data-last={k === filled - 1 ? "" : undefined}
                      />
                    ))}
                  </div>
                  <p className="ak-days-cap">
                    <span>сегодня</span>
                    <span className="a-num">до {endDate}, {endTime}</span>
                  </p>
                </>
              )}

              <div className="ak-actions">
                {isExpired ? (
                  <button type="button" onClick={() => router.push("/subscribe")} className="a-btn a-btn-primary">
                    Купить подписку
                    <Icon name="arrow-right" size={16} />
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => router.push("/devices")} className="a-btn a-btn-primary">
                      <Icon name="bolt" size={16} />
                      Подключить устройство
                    </button>
                    <button type="button" onClick={() => router.push("/subscribe")} className="a-btn ak-btn-soft">
                      Продлить
                    </button>
                  </>
                )}
              </div>
            </section>

            {/* ── 2 · Баланс и проверка ────────────────────────────── */}
            <section className="ak-card ak-bal" data-sheet="20" style={at(2)} aria-labelledby="ak-bal-h">
              <Corner href="https://t.me/atlas_suppbot" label="Пополнить баланс в Telegram-боте" external />
              <div className="ak-card-head">
                <h2 id="ak-bal-h" className="ak-eyebrow">Баланс</h2>
              </div>
              <p className="ak-value ak-value-live">
                <span className="a-num">
                  {data.balance.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <small>₽</small>
              </p>
              <p className="ak-fine">Пополнение — через Telegram-бот.</p>

              <div className="ak-row">
                <div className="ak-row-copy">
                  <p className="ak-row-title">Проверить подписку</p>
                  <p className="ak-row-text" aria-live="polite">
                    {resyncStatus ? resyncStatus.text : "Подхватит зависшие оплаты и обновит ключ."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleForceResync}
                  disabled={resyncing}
                  className="a-btn ak-btn-soft"
                  data-state={resyncStatus?.kind}
                >
                  {resyncing ? (
                    "Проверяем…"
                  ) : resyncStatus?.kind === "ok" ? (
                    <>
                      <Icon name="check" size={16} />
                      Готово
                    </>
                  ) : resyncStatus?.kind === "error" ? (
                    "Повторить"
                  ) : (
                    <>
                      <Icon name="refresh" size={16} />
                      Обновить
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* ── Первые шаги (пробный период) ─────────────────────── */}
            {showFirst && (
              <section id="ak-first" className="ak-card ak-first" data-sheet="20" style={at(3)} aria-labelledby="ak-first-h">
                <Corner href="/add-device" label="Подключить устройство по шагам" />
                <div className="ak-card-head">
                  <h2 id="ak-first-h" className="ak-eyebrow">
                    Первые шаги · <span className="a-num ak-kicker-step">Сделано {firstDone} из {firstSteps.length}</span>
                  </h2>
                </div>
                <p className="ak-text ak-first-lead">Три шага, чтобы пробный период работал на полную.</p>
                {/* Полоса — обзор для глаза; тот же путь с действиями —
                    пунктами ниже, поэтому чтецу экрана полоса не нужна. */}
                <ol className="ak-stepper" aria-hidden>
                  {firstSteps.map((s, n) => {
                    const state = s.done ? "done" : n === firstNow ? "now" : "next";
                    return (
                      <li key={s.id}>
                        <span className="ak-step" data-state={state}>
                          <span className="ak-step-n">{s.done ? <Icon name="check" size={14} /> : n + 1}</span>
                          <span className="ak-step-label">{s.short}</span>
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <ul className="ak-perks">
                  {firstSteps.map((s, n) => {
                    const state = s.done ? "done" : n === firstNow ? "now" : undefined;
                    return (
                      <li key={s.id} className="ak-perk" data-state={state} style={{ "--k": n } as CSSProperties}>
                        <span className="ak-perk-ico" style={{ "--k": n } as CSSProperties}>
                          <Icon name={s.done ? "check" : s.icon} size={20} />
                        </span>
                        <span className="ak-perk-copy">
                          <b className="ak-perk-title">
                            {s.title}
                            {s.done && <span className="b-sr"> — готово</span>}
                          </b>
                          <span className="ak-perk-text">{s.text}</span>
                        </span>
                        <span className="ak-perk-act">{s.act(state === "now")}</span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* ── 3 · Ключи: основной VPN и «Обход» ─────────────────── */}
            {showKeys && <CabinetKey data={data} i={3} />}

            {/* ── 4 · Быстрые переходы ─────────────────────────────── */}
            <section className="ak-card ak-quick" data-sheet="20" style={at(4)} aria-labelledby="ak-q-h">
              <div className="ak-card-head">
                <h2 id="ak-q-h" className="ak-eyebrow">Быстро</h2>
              </div>
              <ul className="ak-links">
                <li>
                  <Link href="/devices" className="ak-link">
                    <span className="ak-link-ico" style={{ "--k": 0 } as CSSProperties}><Icon name="devices" size={16} /></span>
                    <span className="ak-link-label">Устройства и инструкции</span>
                    <Icon name="arrow-right" size={16} className="ak-link-arrow" />
                  </Link>
                </li>
                <li>
                  <button type="button" className="ak-link" onClick={() => setShowNotifications(true)}>
                    <span className="ak-link-ico" style={{ "--k": 1 } as CSSProperties}>
                      <Icon name="bell" size={16} />
                      {unreadCount > 0 && <span className="ak-badge" aria-hidden>{unreadLabel}</span>}
                    </span>
                    <span className="ak-link-label">
                      Уведомления{unreadCount > 0 ? <span className="b-sr">: {unreadLabel} новых</span> : null}
                    </span>
                    <Icon name="arrow-right" size={16} className="ak-link-arrow" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className="ak-link"
                    onClick={() => document.getElementById("referral-section")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    <span className="ak-link-ico" style={{ "--k": 2 } as CSSProperties}><Icon name="users" size={16} /></span>
                    <span className="ak-link-label">Кешбэк {data.cashbackPercent}% за друзей</span>
                    <Icon name="arrow-right" size={16} className="ak-link-arrow" />
                  </button>
                </li>
                <li>
                  <Link href="/support" className="ak-link">
                    <span className="ak-link-ico" style={{ "--k": 3 } as CSSProperties}><Icon name="chat" size={16} /></span>
                    <span className="ak-link-label">Поддержка</span>
                    <Icon name="arrow-right" size={16} className="ak-link-arrow" />
                  </Link>
                </li>
              </ul>
            </section>

            {/* ── 5 · Друзья ───────────────────────────────────────── */}
            <CabinetFriends
              referralCode={data.referralCode}
              cashbackPercent={data.cashbackPercent}
              loyaltyTier={data.loyaltyTier}
              referrals={data.referrals}
              paidReferrals={data.paidReferrals}
              copiedRef={copiedRef}
              onCopy={copyToClipboard}
              i={5}
            />

            {/* ── 6 · Сеть ─────────────────────────────────────────── */}
            <CabinetNetwork i={6} />

            {/* ── 7 · Telegram ─────────────────────────────────────── */}
            <section className="ak-card ak-tg" data-sheet="20" style={at(7)} aria-labelledby="ak-tg-h">
              <Corner href="https://t.me/atlas_suppbot" label="Открыть Telegram-бот" external />
              <div className="ak-card-head">
                <h2 id="ak-tg-h" className="ak-eyebrow">Telegram</h2>
                {data.telegramLinked && <span className="ak-status"><i />Бот подключён</span>}
              </div>
              <div className="ak-tg-row">
                <span className="ak-tg-ico"><Icon name="send" size={20} /></span>
                <div>
                  <p className="ak-h3">Atlas Secure Bot</p>
                  <p className="ak-text">
                    {data.telegramLinked
                      ? "Одна подписка и один ключ — в боте и на сайте."
                      : `Одна подписка на бот и сайт. +${tgBonus} за привязку.`}
                  </p>
                </div>
              </div>
              <div className="ak-actions">
                {!data.telegramLinked ? (
                  <button type="button" onClick={startTelegramLink} disabled={tgLink.state === "busy"} className="a-btn a-btn-primary">
                    <Icon name="send" size={16} />
                    {tgLink.state === "busy" ? "Готовим ссылку…" : tgLink.state === "ready" ? "Новая ссылка" : "Привязать Telegram"}
                  </button>
                ) : unlinkStep === 0 ? (
                  <button type="button" onClick={() => setUnlinkStep(1)} className="a-btn ak-btn-soft">
                    Отвязать
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={() => setUnlinkStep(0)} className="a-btn ak-btn-soft">
                      Отмена
                    </button>
                    <button type="button" onClick={handleUnlinkTelegram} disabled={unlinking} className="a-btn ak-btn-danger">
                      {unlinking ? "Отвязываем…" : "Да, отвязать"}
                    </button>
                  </>
                )}
              </div>
              {data.telegramLinked && unlinkStep === 1 && (
                <p className="ak-fine">Подписка и ключ останутся в этом кабинете. Бонус за повторную привязку не начисляется.</p>
              )}

              {!data.telegramLinked && tgLink.state === "ready" && (
                tgLink.url ? (
                  tgLink.mobile ? (
                    <p className="ak-fine" role="status">
                      Если Telegram не открылся — <a href={tgLink.url}>откройте бота по ссылке</a>. Ссылка одноразовая, действует 15 минут.
                    </p>
                  ) : (
                    <div role="status" style={{ marginTop: "1rem" }}>
                      <div className="ak-qr">
                        <QRCodeSVG value={tgLink.url} size={200} level="M" marginSize={2} />
                      </div>
                      <p className="ak-fine">
                        Бот открылся в новой вкладке. Можно и с телефона — наведите камеру на QR-код или{" "}
                        <a href={tgLink.url} target="_blank" rel="noopener noreferrer">откройте ссылку</a>. Ссылка одноразовая, действует 15 минут.
                      </p>
                    </div>
                  )
                ) : (
                  <div className="ak-fallback" role="status">
                    <p className="ak-fine" style={{ margin: 0 }}>Ссылка на бота не настроена. Откройте бота Atlas Secure и отправьте ему команду:</p>
                    <code>/start {tgLink.startParam}</code>
                  </div>
                )
              )}
              {tgLink.state === "error" && <p className="ak-err" role="alert">{tgLink.error}</p>}
            </section>

            {/* ── 8 · Уведомления и вход ───────────────────────────── */}
            <CabinetSettings i={8} />
          </div>
          </div>
        </div>

        {/* Телефон: разделы — вкладками у большого пальца. */}
        <nav className="ak-tabbar" aria-label="Разделы кабинета, быстрый переход">
          {sections.map((s) => (
            <a key={s.id} className="ak-tab" href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined}>
              <Icon name={s.icon} size={18} />
              {s.label}
            </a>
          ))}
        </nav>

        {showLogoutConfirm && (
          <div className="ak-dialog" role="dialog" aria-modal="true" aria-labelledby="ak-out-h">
            <div className="ak-dialog-veil" onClick={() => !loggingOut && setShowLogoutConfirm(false)} />
            <div className="ak-dialog-card">
              <h2 id="ak-out-h" className="ak-h3">Выйти из аккаунта?</h2>
              <p className="ak-text">Чтобы войти снова, понадобится код из письма.</p>
              <div className="ak-actions">
                <button type="button" autoFocus onClick={() => setShowLogoutConfirm(false)} disabled={loggingOut} className="a-btn ak-btn-soft">
                  Остаться
                </button>
                <button type="button" onClick={handleLogout} disabled={loggingOut} className="a-btn ak-btn-danger">
                  {loggingOut ? "Выходим…" : "Выйти"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Нижние карточки — через общую очередь (одна за раз). Баннер
          привязки Telegram из кабинета убран: ту же кнопку несёт
          панель «Telegram», а баннер вставал поверх панели действий. */}
      {/* Остаток пробного — только на пробном: раньше тост говорил
          «тестовый ключ» и платным, и «осталось 0 ч» — истёкшим. */}
      {isTrial && !isExpired && (
        <WelcomeToast telegramLinkToken={data.telegramLinkToken} subscriptionEnd={data.subscriptionEnd} />
      )}
      <PasskeyPrompt />
      {/* iPhone/iPad в Safari: через 2,5 с — «Atlas на экран „Домой“»,
          ведёт на /install-ios. Встаёт в общую очередь нижних карточек. */}
      <IosInstallSheet />
      <NotificationsModal open={showNotifications} onClose={() => setShowNotifications(false)} onUnreadCountChange={setUnreadCount} />
    </>
  );
}
