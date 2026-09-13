"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Icon from "@/components/pixel/Icon";
import { useAdminConfirm, useAdminToast, Spin } from "@/app/admin/AdminConfirm";
import { formatDate, getJson, num, postJson, type NotificationItem } from "@/app/admin/admin-shared";
import PanelSyncCard from "./PanelSyncCard";
import CampaignsCard from "./CampaignsCard";
import JournalCard from "./JournalCard";
import { Tile } from "./Viz";

/**
 * «Сервис» — редкие операции, компактно. Сверка с панелью, оплаты
 * YooKassa, рубильник бота, предпросмотр дат за 400 дней, диагностика
 * одного адреса в панели, рассылки и начисления (CampaignsCard — письма
 * через Resend, уведомления в кабинете, массовый подарок) и журнал.
 *
 * Убрано: массовая миграция, sync-all, полный сброс панели, чистка
 * дублей (маршрутов больше нет), кнопка «Применить» у дат за 400 дней
 * (API отвечает 409 — даты правятся вручную в карточке), read-only
 * verify (повторял «Проверить»).
 */

interface Props {
  notifications: NotificationItem[];
  notifError: string | null;
  onReload: () => void;
  onOpenUser: (id: string) => void;
  reloadKey: number;
}

export default function ServiceSection({ notifications, notifError, onReload, onOpenUser, reloadKey }: Props) {
  return (
    <div className="adm-grid adm-service">
      <PanelSyncCard i={1} onOpenUser={onOpenUser} />
      <PaymentsCard i={2} />
      <BotSyncCard i={3} />
      <GhostCard i={4} onOpenUser={onOpenUser} />
      <DiagnoseCard i={5} />
      <CampaignsCard i={6} notifications={notifications} notifError={notifError} onNotificationsChanged={onReload} />
      <JournalCard i={7} reloadKey={reloadKey} onOpenUser={onOpenUser} />
    </div>
  );
}

/* ─── Оплаты YooKassa ────────────────────────────────────────────── */

interface PayReport {
  scanned: number;
  applied: number;
  canceled: number;
  still_pending: number;
  failed: number;
  details: Array<{ payment_id: string; user_id: string; outcome: string }>;
}

function PaymentsCard({ i }: { i: number }) {
  const toast = useAdminToast();
  const [busy, setBusy] = useState(false);
  const [rep, setRep] = useState<PayReport | null>(null);
  const run = async () => {
    setBusy(true);
    const r = await postJson<PayReport>("/api/admin/payments/reconcile-pending");
    setBusy(false);
    if (!r.ok) {
      toast(`Опрос YooKassa не прошёл: ${r.error}`, "off");
      return;
    }
    setRep(r.data);
    toast(r.data.applied > 0 ? `Подтянуто оплат: ${r.data.applied}` : "Новых оплат нет", r.data.failed ? "warn" : "ok");
  };
  return (
    <section className="ak-card adm-s-pay" data-sheet="24" style={{ "--i": i } as CSSProperties} aria-labelledby="adm-pay-h">
      <div className="ak-card-head">
        <h2 id="adm-pay-h" className="ak-eyebrow">Оплаты YooKassa</h2>
      </div>
      <p className="ak-text adm-lead">Опрашивает кассу по платежам за 7 дней, которые у нас ещё «в ожидании». Прошла оплата без уведомления — подписка выдастся сейчас. Повторять безопасно.</p>
      <div className="adm-sub-actions">
        <button type="button" onClick={run} disabled={busy} className="a-btn ak-btn-soft">
          {busy ? <><Spin />Опрашиваем…</> : <><Icon name="check" size={16} />Подтянуть оплаты</>}
        </button>
      </div>
      {rep && (
        <div className="adm-report">
          <ul className="adm-tiles adm-tiles-sm">
            <Tile label="Опрошено" value={num(rep.scanned)} />
            <Tile label="Выдано" value={num(rep.applied)} tone="ok" />
            <Tile label="Ждут" value={num(rep.still_pending)} />
            <Tile label="Отменены" value={num(rep.canceled)} tone="mute" />
            <Tile label="Ошибки" value={num(rep.failed)} tone={rep.failed > 0 ? "off" : undefined} />
          </ul>
          {rep.details.length > 0 && (
            <details className="adm-details">
              <summary>Подробно ({rep.details.length})</summary>
              <ul className="adm-issues">
                {rep.details.map((d) => (
                  <li key={d.payment_id} className="adm-result-row">
                    <span className="a-num">{d.payment_id.slice(0, 8)}…</span>
                    <span className="adm-muted adm-break">{d.outcome}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}

/* ─── Рубильник бота ─────────────────────────────────────────────── */

function BotSyncCard({ i }: { i: number }) {
  const confirm = useAdminConfirm();
  const toast = useAdminToast();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    getJson<{ enabled: boolean }>("/api/admin/bot-sync").then((r) => {
      if (!alive) return;
      if (r.ok) setEnabled(r.data.enabled);
      else setErr(r.error);
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async () => {
    if (enabled === null) return;
    const next = !enabled;
    const ok = await confirm(
      next
        ? { title: "Включить синхронизацию с ботом?", text: "Бот снова сможет создавать, продлевать и привязывать подписки.", confirmLabel: "Включить", tone: "primary" }
        : { title: "Выключить синхронизацию с ботом?", text: "Бот не сможет создавать, продлевать и привязывать подписки, пока вы не включите её обратно. Чтение продолжит работать.", confirmLabel: "Выключить" },
    );
    if (!ok) return;
    setBusy(true);
    const r = await postJson<{ enabled: boolean }>("/api/admin/bot-sync", { enabled: next });
    setBusy(false);
    if (!r.ok) {
      toast(r.error, "off");
      return;
    }
    setEnabled(r.data.enabled);
    toast(r.data.enabled ? "Синхронизация с ботом включена" : "Синхронизация с ботом выключена", r.data.enabled ? "ok" : "warn");
  };

  return (
    <section className="ak-card adm-s-bot" data-sheet="24" style={{ "--i": i } as CSSProperties} aria-labelledby="adm-bot-h">
      <div className="ak-card-head">
        <h2 id="adm-bot-h" className="ak-eyebrow">Синхронизация с ботом</h2>
        {enabled !== null && (
          <span className="ak-status" data-tone={enabled ? undefined : "off"}>
            <i />
            {enabled ? "Включена" : "Выключена"}
          </span>
        )}
      </div>
      <button type="button" role="switch" aria-checked={enabled === true} aria-describedby="adm-bot-t" onClick={toggle} disabled={busy || enabled === null} className="adm-toggle">
        <span className="adm-toggle-copy">
          <span className="ak-h3">Бот может менять подписки</span>
          <span className="adm-toggle-state" aria-live="polite">
            {busy ? <><Spin />Применяем…</> : enabled === null ? (err ? "Состояние не загрузилось" : "Загружаем…") : enabled ? "Сейчас включено" : "Сейчас выключено"}
          </span>
        </span>
        <span className="ak-switch" aria-hidden />
      </button>
      <p id="adm-bot-t" className="ak-fine">Выключайте, если бот портит даты: сайт перестанет принимать от него изменения. Рубильник общий.</p>
      {err && <p className="ak-err">{err}</p>}
    </section>
  );
}

/* ─── Даты дальше 400 дней: только предпросмотр ──────────────────── */

interface GhostUser {
  userId: string;
  email: string;
  publicId: string | null;
  oldSubscriptionEnd: string;
  newSubscriptionEnd: string;
  action: "expired_no_payment" | "expired_payment_too_old" | "corrected_from_payment";
  confirmedPayments: number;
  latestPaidAt: string | null;
  latestPlan: string | null;
  latestPeriodMonths: number | null;
}
interface GhostReport {
  scanned: number;
  expired_no_payment: number;
  expired_payment_too_old: number;
  corrected_from_payment: number;
  users: GhostUser[];
}
const GHOST_LABEL: Record<GhostUser["action"], string> = {
  expired_no_payment: "не платил",
  expired_payment_too_old: "платил давно",
  corrected_from_payment: "есть оплата",
};

function GhostCard({ i, onOpenUser }: { i: number; onOpenUser: (id: string) => void }) {
  const toast = useAdminToast();
  const [busy, setBusy] = useState(false);
  const [rep, setRep] = useState<GhostReport | null>(null);
  const run = async () => {
    setBusy(true);
    const r = await postJson<GhostReport>("/api/admin/users/cleanup-ghost-dates", { dryRun: true });
    setBusy(false);
    if (!r.ok) {
      toast(`Не посчитали: ${r.error}`, "off");
      return;
    }
    setRep(r.data);
  };
  return (
    <section className="ak-card adm-s-ghost" data-sheet="24" style={{ "--i": i } as CSSProperties} aria-labelledby="adm-ghost-h">
      <div className="ak-card-head">
        <h2 id="adm-ghost-h" className="ak-eyebrow">Сроки дальше 400 дней</h2>
        {rep && <span className="ak-status" data-tone={rep.scanned > 0 ? "warn" : undefined}><i />{rep.scanned > 0 ? `Найдено ${rep.scanned}` : "Нет"}</span>}
      </div>
      <p className="ak-text adm-lead">Показывает подписки со сроком дальше 400 дней и что говорят оплаты. Только просмотр: исправляйте в карточке пользователя — «Забрать» и «Выдать».</p>
      <div className="adm-sub-actions">
        <button type="button" onClick={run} disabled={busy} className="a-btn ak-btn-soft">
          {busy ? <><Spin />Считаем…</> : <><Icon name="clock" size={16} />Найти</>}
        </button>
      </div>
      {rep && rep.scanned > 0 && (
        <div className="adm-report">
          <ul className="adm-tiles adm-tiles-sm">
            <Tile label="Есть оплата" value={num(rep.corrected_from_payment)} />
            <Tile label="Платили давно" value={num(rep.expired_payment_too_old)} tone={rep.expired_payment_too_old > 0 ? "warn" : undefined} />
            <Tile label="Не платили" value={num(rep.expired_no_payment)} tone={rep.expired_no_payment > 0 ? "off" : undefined} />
          </ul>
          <details className="adm-details">
            <summary>Список ({rep.users.length})</summary>
            <ul className="adm-issues">
              {rep.users.map((u) => (
                <li key={u.userId}>
                  <button type="button" className="adm-issue-btn" onClick={() => onOpenUser(u.userId)}>
                    <span className="adm-result-row">
                      <span className="adm-issue-mail">{u.email}</span>
                      <span className="adm-tag" data-tone={u.action === "expired_no_payment" ? "off" : u.action === "expired_payment_too_old" ? "warn" : undefined}>{GHOST_LABEL[u.action]}</span>
                    </span>
                    <span className="adm-result-line a-num">
                      сейчас до {formatDate(u.oldSubscriptionEnd)} · по оплатам до {formatDate(u.newSubscriptionEnd)}
                      {u.confirmedPayments > 0 && ` · оплат ${u.confirmedPayments}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </section>
  );
}

/* ─── Диагностика одного адреса ──────────────────────────────────── */

interface DiagReport {
  apiUrl: string;
  tokenSet: boolean;
  mainSquads?: string[];
  localUser: { email: string; public_id: string | null; panel_user_id: string | null; panel_sync_state: string | null; panel_sync_error: string | null } | null;
  probes: Array<{ path: string; status: number | null; body: unknown; error?: string }>;
}

function DiagnoseCard({ i }: { i: number }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [rep, setRep] = useState<DiagReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setRep(null);
    const q = email.trim();
    const r = await getJson<DiagReport>(`/api/admin/remnawave/diagnose${q ? `?email=${encodeURIComponent(q)}` : ""}`);
    setBusy(false);
    if (r.ok) setRep(r.data);
    else setErr(r.error);
  };
  return (
    <section className="ak-card adm-s-diag adm-still" data-sheet="24" style={{ "--i": i } as CSSProperties} aria-labelledby="adm-diag-h">
      <div className="ak-card-head">
        <h2 id="adm-diag-h" className="ak-eyebrow">Что панель знает об адресе</h2>
      </div>
      <form onSubmit={run} className="adm-find adm-diag-form">
        <label className="adm-search">
          <span className="b-sr">Email пользователя</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (пусто — проверить связь)" className="adm-input" autoComplete="off" spellCheck={false} />
        </label>
        <button type="submit" disabled={busy} className="a-btn ak-btn-soft">
          {busy ? <><Spin />Спрашиваем…</> : <><Icon name="shield" size={16} />Спросить</>}
        </button>
      </form>
      {err && <p className="ak-err">{err}</p>}
      {rep && (
        <div className="adm-report">
          <dl className="adm-dl">
            <div><dt>Адрес API</dt><dd className="adm-break">{rep.apiUrl}</dd></div>
            <div><dt>Токен</dt><dd data-tone={rep.tokenSet ? undefined : "off"}>{rep.tokenSet ? "задан" : "не задан"}</dd></div>
            {rep.localUser && (
              <>
                <div><dt>На сайте</dt><dd className="a-num">{rep.localUser.public_id || "—"} · панель {rep.localUser.panel_user_id || "—"}</dd></div>
                <div><dt>Очередь</dt><dd data-tone={rep.localUser.panel_sync_state === "error" ? "off" : undefined}>{rep.localUser.panel_sync_state || "—"}</dd></div>
              </>
            )}
          </dl>
          {rep.localUser?.panel_sync_error && <p className="adm-note adm-break" data-tone="off">{rep.localUser.panel_sync_error}</p>}
          {email.trim() && !rep.localUser && <p className="adm-note" data-tone="warn">На сайте такого адреса нет.</p>}
          <ul className="adm-probes">
            {rep.probes.map((p, k) => (
              <li key={`${p.path}-${k}`}>
                <div className="adm-result-row">
                  <span className="adm-break">{p.path}</span>
                  <span className="adm-tag a-num" data-tone={p.status && p.status < 300 ? undefined : "off"}>{p.status ?? "—"}</span>
                </div>
                <details className="adm-details adm-details-sm">
                  <summary>{p.error ? p.error.slice(0, 80) : "Ответ"}</summary>
                  <pre className="adm-log-pre adm-pre-sm">{typeof p.body === "string" ? p.body.slice(0, 1500) : JSON.stringify(p.body, null, 2).slice(0, 1500)}</pre>
                </details>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
