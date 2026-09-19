"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import Link from "next/link";
import Icon, { type IconName } from "@/components/pixel/Icon";
import HealthSection, { overallTone } from "@/components/admin/HealthSection";
import BusinessSection from "@/components/admin/BusinessSection";
import UsersSection from "@/components/admin/UsersSection";
import ServiceSection from "@/components/admin/ServiceSection";
import InboxSection from "@/components/admin/InboxSection";
import { Dot } from "@/components/admin/Viz";
import { AdminConfirmProvider, AdminConfirmOutlet, Spin } from "./AdminConfirm";
import {
  formatClock,
  getJson,
  isErr,
  num,
  type NotificationItem,
  type Overview,
  type Probe,
  type Tone,
  type UsersPage,
  type UsersStats,
} from "./admin-shared";
import "@/app/work-atlas.css";
import "./admin-atlas.css";

/**
 * Админ-панель на корпусе «Атлас» — рабочий экран в языке кабинета:
 * доска, белые панели на сером поле, одна тёмная плита на раздел,
 * пилюли разделов сверху, на телефоне — вкладки внизу.
 *
 *   Состояние     — панель, ноды, база, очередь, синхронизатор, бот
 *   Бизнес        — выручка, ряды по дням, тарифы, воронка, аудитория
 *   Пользователи  — поиск и фильтры на сервере, карточка: выдать / сменить
 *                   тариф / забрать, устройства, IP, история, журнал
 *   Сервис        — сверки, оплаты, бот, диагностика, рассылка, журнал
 *
 * Загрузка: сводка (кэш сервера 30 с; «Обновить» — ?fresh=1), счётчик
 * пользователей (?limit=1 — заодно проверка прав), уведомления. Список
 * пользователей, журнал и ряды по дням грузят свои разделы сами;
 * reloadKey после действия заставляет их перечитать данные.
 *
 * Права проверяют API (verifyAdmin → 403): первый ответ 403 — экран
 * «Нет доступа», интерфейс админки чужому не показывается.
 */

type Tab = "health" | "business" | "users" | "inbox" | "service";
const TABS: { key: Tab; label: string; short: string; icon: IconName }[] = [
  { key: "health", label: "Состояние", short: "Состояние", icon: "shield" },
  { key: "business", label: "Бизнес", short: "Бизнес", icon: "bolt" },
  { key: "users", label: "Пользователи", short: "Клиенты", icon: "users" },
  // «Обращения» — всё, что люди прислали формами сайта (19.09.2026).
  { key: "inbox", label: "Обращения", short: "Обращения", icon: "chat" },
  { key: "service", label: "Сервис", short: "Сервис", icon: "refresh" },
];
const isTab = (v: string): v is Tab => TABS.some((t) => t.key === v);

const INTERVAL = 60_000;
const HISTORY = 30;
const STATE_SHORT: Record<Tone, string> = { ok: "Всё работает", warn: "Есть предупреждения", off: "Есть сбой", idle: "Проверяем" };

export default function AdminView() {
  return (
    <AdminConfirmProvider>
      <AdminScreen />
    </AdminConfirmProvider>
  );
}

function AdminScreen() {
  const [tab, setTab] = useState<Tab>("health");
  const [denied, setDenied] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const [ov, setOv] = useState<Overview | null>(null);
  const [ovError, setOvError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [history, setHistory] = useState<Probe[]>([]);
  const [auto, setAuto] = useState(true);
  const lastOv = useRef(0);

  const [stats, setStats] = useState<UsersStats | null>(null);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [notifError, setNotifError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ health: null, business: null, users: null, inbox: null, service: null });

  /* ── Загрузка ─────────────────────────────────────────────────── */
  const loadOverview = useCallback(async (fresh = false) => {
    lastOv.current = Date.now();
    const r = await getJson<Overview>(`/api/admin/overview${fresh ? "?fresh=1" : ""}`);
    if (r.ok) {
      setOv(r.data);
      setOvError(null);
      setReady(true);
      // Замеры вкладки — запасной спарклайн, пока сервер не накопил healthHistory.
      if (!r.data.cached) {
        const p = r.data.panel;
        const d = r.data.db;
        setHistory((h) => [
          ...h.slice(-(HISTORY - 1)),
          { t: Date.now(), panel: !isErr(p) && p.reachable ? p.latencyMs : null, db: !isErr(d) ? d.latencyMs : null },
        ]);
      }
    } else if (r.status === 403 || r.status === 401) {
      setDenied(r.error || "Доступ запрещён");
    } else {
      setOvError(r.error);
      setReady(true);
    }
  }, []);

  const loadMeta = useCallback(async () => {
    const r = await getJson<UsersPage>("/api/admin/users?limit=1");
    if (r.ok) {
      setStats(r.data.stats);
      setReady(true);
    } else if (r.status === 403 || r.status === 401) {
      setDenied(r.error || "Доступ запрещён");
    } else setReady(true);
  }, []);

  const loadNotifs = useCallback(async () => {
    const r = await getJson<NotificationItem[]>("/api/admin/notifications");
    if (r.ok) {
      setNotifs(r.data);
      setNotifError(null);
    } else if (r.status !== 403) setNotifError(r.error);
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    setReloadKey((k) => k + 1);
    await Promise.all([loadOverview(true), loadMeta(), loadNotifs()]);
    setRefreshing(false);
  }, [loadOverview, loadMeta, loadNotifs]);

  const refreshOverview = useCallback(async () => {
    setRefreshing(true);
    await loadOverview(true);
    setRefreshing(false);
  }, [loadOverview]);

  // После действия в карточке — свежий список, журнал, ряды и сводка.
  const onChanged = useCallback(() => {
    setReloadKey((k) => k + 1);
    loadOverview(true);
  }, [loadOverview]);

  useEffect(() => {
    const h = window.location.hash.replace("#", "");
    if (isTab(h)) setTab(h);
    try {
      if (localStorage.getItem("adm-auto") === "0") setAuto(false);
    } catch {
      /* хранилище недоступно — по умолчанию включено */
    }
    // Первая загрузка без ?fresh: кэш сервера — это нормально.
    Promise.all([loadOverview(false), loadMeta(), loadNotifs()]);
    const onHash = () => {
      const t = window.location.hash.replace("#", "");
      if (isTab(t)) setTab(t);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [loadOverview, loadMeta, loadNotifs]);

  // Автообновление: раз в минуту (кэш сервера 30 с — свежие данные),
  // на паузе в фоне; при возврате во вкладку — сразу, если устарели.
  useEffect(() => {
    if (!auto || denied) return;
    const tick = () => {
      if (document.hidden) return;
      if (Date.now() - lastOv.current >= INTERVAL - 500) loadOverview(false);
    };
    const t = window.setInterval(tick, 5000);
    const onVis = () => !document.hidden && tick();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [auto, denied, loadOverview]);

  const setAutoSaved = (v: boolean) => {
    setAuto(v);
    try {
      localStorage.setItem("adm-auto", v ? "1" : "0");
    } catch {
      /* не критично */
    }
  };

  /* ── Разделы ──────────────────────────────────────────────────── */
  const toBoard = () => {
    const board = boardRef.current;
    if (!board) return;
    const head = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--a-head-h")) || 64;
    const top = board.getBoundingClientRect().top + window.scrollY - head - 12;
    if (window.scrollY > top) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    }
  };

  const selectTab = (t: Tab, scroll = false) => {
    setTab(t);
    try {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${t}`);
    } catch {
      /* адрес не обязателен */
    }
    if (scroll) toBoard();
  };

  const openUser = (id: string) => {
    setSelectedId(id);
    selectTab("users", true);
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const n = TABS.length;
    const next = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : (idx + (e.key === "ArrowRight" ? 1 : -1) + n) % n;
    selectTab(TABS[next].key);
    tabRefs.current[TABS[next].key]?.focus();
  };

  /* ── Экраны ───────────────────────────────────────────────────── */
  if (denied) {
    return (
      <main id="main" className="a-main ak adm">
        <div className="a-field">
          <section className="ak-card adm-denied" data-sheet="24" style={{ "--i": 0 } as CSSProperties} aria-labelledby="adm-denied-h">
            <div className="ak-card-head">
              <p className="ak-eyebrow">Админ-панель</p>
              <span className="ak-status" data-tone="off"><i />Нет доступа</span>
            </div>
            <span className="adm-denied-ico" aria-hidden><Icon name="lock" size={24} /></span>
            <h1 id="adm-denied-h" className="ak-h1 adm-denied-h">{denied}</h1>
            <p className="ak-text">Эта страница доступна только администратору.</p>
            <div className="ak-actions">
              <Link href="/dashboard" className="a-btn a-btn-primary">
                В кабинет
                <Icon name="arrow-right" size={16} />
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (!ready) {
    return (
      <main id="main" className="a-main ak adm" aria-busy="true">
        <div className="a-field">
          <p className="b-sr" aria-live="polite">Загружаем админ-панель…</p>
          <div className="adm-skels" aria-hidden>
            <div className="ak-skel adm-skel-top" />
            <div className="ak-skel" />
            <div className="ak-skel" />
          </div>
        </div>
      </main>
    );
  }

  const tone: Tone = ov ? overallTone(ov) : ovError ? "off" : "idle";
  const dataAt = ov ? ov.cachedAt || ov.generatedAt : null;

  return (
    <main id="main" className="a-main ak adm">
      <div className="a-field">
        {/* ── Верх ─────────────────────────────────────────────────── */}
        <section className="ak-top" data-sheet="24" style={{ "--i": 0 } as CSSProperties} aria-label="Админ-панель">
          <div>
            <p className="ak-kicker a-wide">Atlas Secure · управление</p>
            <h1 className="ak-h1">Админ-панель</h1>
          </div>
          <div className="ak-tools">
            <p className="adm-top-state" aria-live="polite">
              <Dot tone={tone} />
              <span className="adm-top-copy">
                {STATE_SHORT[tone]}
                {dataAt && <span className="adm-top-time a-num"> · данные на {formatClock(dataAt)}</span>}
              </span>
            </p>
            <button type="button" className="a-btn ak-btn-soft" onClick={refreshAll} disabled={refreshing} aria-label={refreshing ? "Обновляем данные" : "Обновить всё"}>
              {refreshing ? <Spin /> : <Icon name="refresh" size={16} />}
              <span className="ak-lbl">{refreshing ? "Обновляем…" : "Обновить"}</span>
            </button>
          </div>
        </section>

        <div className="ak-board" ref={boardRef}>
          <nav className="ak-bar" aria-label="Разделы админки">
            <span className="ak-avatar" aria-hidden><Icon name="shield" size={18} /></span>
            <div className="ak-pills" role="tablist" aria-label="Разделы админки">
              {TABS.map((t, idx) => (
                <button
                  key={t.key}
                  ref={(el) => {
                    tabRefs.current[t.key] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`adm-tab-${t.key}`}
                  aria-selected={tab === t.key}
                  aria-controls={`adm-panel-${t.key}`}
                  tabIndex={tab === t.key ? 0 : -1}
                  className="ak-pill adm-pill"
                  onClick={() => selectTab(t.key)}
                  onKeyDown={(e) => onTabKey(e, idx)}
                >
                  {t.key === "health" && <Dot tone={tone} />}
                  {t.label}
                  {t.key === "users" && stats && stats.total > 0 && <span className="adm-pill-n a-num">{num(stats.total)}</span>}
                </button>
              ))}
            </div>
            <span className="ak-bar-plan adm-bar-state">
              <Dot tone={tone} />
              {STATE_SHORT[tone]}
            </span>
          </nav>

          <div id={`adm-panel-${tab}`} role="tabpanel" aria-labelledby={`adm-tab-${tab}`} className="adm-panel" key={tab}>
            {tab === "health" && (
              <HealthSection
                ov={ov}
                ovError={ovError ? (ov ? `Последнее обновление не прошло: ${ovError}` : ovError) : null}
                history={history}
                auto={auto}
                onAuto={setAutoSaved}
                refreshing={refreshing}
                onRefresh={refreshOverview}
                intervalMs={INTERVAL}
                onOpenUser={openUser}
              />
            )}
            {tab === "business" && <BusinessSection ov={ov} ovError={ovError} reloadKey={reloadKey} />}
            {tab === "users" && (
              <UsersSection selectedId={selectedId} onSelect={setSelectedId} reloadKey={reloadKey} onChanged={onChanged} onMeta={setStats} />
            )}
            {tab === "inbox" && <InboxSection reloadKey={reloadKey} />}
            {tab === "service" && (
              <ServiceSection notifications={notifs} notifError={notifError} onReload={loadNotifs} onOpenUser={openUser} reloadKey={reloadKey} />
            )}
          </div>
        </div>
      </div>

      <AdminConfirmOutlet />

      {/* Телефон: пилюли разделов скрыты (work-atlas.css), разделы — внизу. */}
      <nav className="ak-tabbar adm-tabbar" aria-label="Разделы админки">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className="ak-tab adm-tab"
            aria-current={tab === t.key ? "true" : undefined}
            aria-label={t.key === "users" && stats ? `${t.label}: ${stats.total}` : t.label}
            onClick={() => selectTab(t.key, true)}
          >
            <span className="adm-tab-ico">
              <Icon name={t.icon} size={18} />
              {t.key === "health" && tone !== "ok" && tone !== "idle" && <i className="adm-tab-flag" data-tone={tone} aria-hidden />}
            </span>
            <span className="adm-tab-lbl">{t.short}</span>
          </button>
        ))}
      </nav>
    </main>
  );
}
