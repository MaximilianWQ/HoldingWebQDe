"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { DEVICE_LIMIT, PERIOD_LABEL, type Period } from "@/lib/plans";
import { useAdminConfirm, useAdminToast, Spin } from "./AdminConfirm";
import {
  ACTION_LABELS,
  ACTOR_LABELS,
  LEDGER_LABELS,
  LINK_KEPT_LABELS,
  PAYMENT_STATUS,
  PLAN_LABELS,
  SYNC_ONE,
  ago,
  deleteJson,
  formatDate,
  formatDateTime,
  formatShort,
  getJson,
  leftWords,
  money,
  num,
  planTone,
  postJson,
  type AuditLogItem,
  type UserHistory,
  type UserInfo,
} from "./admin-shared";

/**
 * Карточка пользователя. Всё, ради чего админ её открывает:
 *
 *   подписка          сколько осталось (тёмная плита)
 *   выдать            пресет или «свой срок, дней» (1–400) — manage
 *                     grant-subscription { duration | days }
 *   сменить тариф     без продления — manage set-plan { plan }
 *   устройства        HWID из панели — GET …/devices; «Отвязать» одно
 *                     и «Отвязать все» — DELETE …/devices { hwid | all }
 *   IP-адреса         POST …/ips → jobId, затем GET …/ips?jobId= раз в 1,5 с
 *   ссылка и панель   состояние синхронизации, новая ссылка, ресинк
 *   история           оплаты и события подписки — GET …/history
 *   журнал            действия по пользователю — GET /api/admin/logs?userId=
 *   сообщение         send-notification
 *   забрать           revoke-subscription
 *
 * Необратимое спрашивает подтверждение; итог — тостом.
 */

const DURATIONS = [
  { key: "1h", label: "1 ч", min: 60 },
  { key: "24h", label: "24 ч", min: 1440 },
  { key: "3d", label: "3 дн", min: 4320 },
  { key: "7d", label: "7 дн", min: 10080 },
  { key: "14d", label: "14 дн", min: 20160 },
  { key: "30d", label: "30 дн", min: 43200 },
  { key: "60d", label: "60 дн", min: 86400 },
  { key: "180d", label: "180 дн", min: 259200 },
  { key: "365d", label: "365 дн", min: 525600 },
];
const MAX_DAYS = 400;

const SYNC_ACTION: Record<string, string> = {
  created: "Создан в панели",
  patched: "Панель обновлена",
  adopted: "Привязан к записи панели",
  disabled: "Отключён в панели",
  enabled: "Включён в панели",
  skip: "Без изменений",
  noop: "Без изменений",
  failed: "Ошибка",
};

const PLAN_OPTIONS = [
  { key: "trial", label: "Пробный" },
  { key: "basic", label: "Basic" },
  { key: "plus", label: "Plus" },
] as const;

interface HwidDevice {
  hwid: string;
  platform: string | null;
  osVersion: string | null;
  deviceModel: string | null;
  userAgent: string | null;
  requestIp: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
interface DevicesData {
  panelUserId: number | null;
  total: number;
  devices: HwidDevice[];
  limit?: number | null;
  siteLimit?: number;
  removed?: "one" | "all";
}
interface IpJob {
  isCompleted: boolean;
  isFailed: boolean;
  progress: unknown;
  result: { nodes: Array<{ nodeUuid: string; nodeName: string; countryCode: string | null; ips: Array<{ ip: string; lastSeen: string | null }> }> } | null;
}
interface ResyncResult {
  after: { publicId: string | null; remnawaveUserUuid: string | null; subscriptionUrl: string | null; panelSyncState?: string | null; panelSyncError?: string | null };
  sync: { action: string; ok: boolean; reason?: string; panelError?: string; panelUsername?: string | null };
  probes: Array<{ path: string; status: number | null; ok: boolean; body: unknown; error?: string }>;
}

function platformIcon(d: HwidDevice): IconName {
  const s = `${d.platform || ""} ${d.deviceModel || ""} ${d.userAgent || ""}`.toLowerCase();
  if (/iphone|ipad|ios/.test(s)) return "iphone";
  if (/android ?tv|tizen|webos|tvos|apple ?tv/.test(s)) return "tv";
  if (/android/.test(s)) return "android";
  if (/mac|darwin/.test(s)) return "macos";
  if (/windows|win32|win64/.test(s)) return "windows";
  return "devices";
}
const deviceName = (d: HwidDevice) => d.deviceModel || d.platform || "Устройство";
const periodLabel = (p: number) => PERIOD_LABEL[p as Period]?.short ?? `${p} мес`;

/* ─── Лента истории: оплаты и события подписки в одном ряду ────────── */

interface TimelineItem {
  key: string;
  at: string;
  type: "pay" | "event";
  title: string;
  tag?: { label: string; tone?: "warn" | "off" | "mute" | "ink" };
  amount?: string;
  lines: string[];
}

function buildTimeline(h: UserHistory): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const p of h.payments) {
    const st = PAYMENT_STATUS[p.status] || { label: p.status, tone: "mute" as const };
    const lines: string[] = [];
    if (p.appliedAt) lines.push(`зачислено ${formatShort(p.appliedAt)}`);
    if (p.refundedAt) lines.push(`возврат ${formatShort(p.refundedAt)}`);
    if (!p.paidAt && p.status !== "confirmed") lines.push(`создан ${formatShort(p.createdAt)}`);
    if (p.transactionId) lines.push(`касса ${p.transactionId.slice(0, 13)}${p.transactionId.length > 13 ? "…" : ""}`);
    items.push({
      key: `p-${p.id}`,
      at: p.paidAt || p.createdAt,
      type: "pay",
      title: `Оплата ${PLAN_LABELS[p.plan] || p.plan} · ${periodLabel(p.period)}`,
      tag: st,
      amount: p.currency === "RUB" ? money(p.amount) : `${num(p.amount)} ${p.currency}`,
      lines,
    });
  }
  for (const e of h.events) {
    const lines: string[] = [];
    if (e.kind === "admin_set_plan" && e.meta && typeof e.meta.from === "string" && typeof e.meta.to === "string") {
      lines.push(`${PLAN_LABELS[e.meta.from] || e.meta.from} → ${PLAN_LABELS[e.meta.to] || e.meta.to}, срок не менялся`);
    } else {
      if (e.oldEnd && e.newEnd && e.oldEnd !== e.newEnd) lines.push(`${formatDate(e.oldEnd)} → ${formatDate(e.newEnd)}`);
      else if (e.newEnd) lines.push(`до ${formatDate(e.newEnd)}`);
      if (e.plan && e.kind !== "refund") lines.push(PLAN_LABELS[e.plan] || e.plan);
    }
    if (e.actor) lines.push(ACTOR_LABELS[e.actor] || e.actor);
    const neg = e.kind === "admin_revoke" || e.kind === "refund" || e.kind === "bot_overwrite";
    items.push({
      key: `e-${e.id}`,
      at: e.createdAt,
      type: "event",
      title: LEDGER_LABELS[e.kind] || e.kind,
      tag: e.days ? { label: `${e.days > 0 ? "+" : "−"}${num(Math.abs(e.days))} дн`, tone: e.days < 0 || neg ? "off" : undefined } : neg ? { label: "срок", tone: "off" } : undefined,
      lines,
    });
  }
  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

interface Props {
  user: UserInfo;
  onClose: () => void;
  onChanged: () => void;
}

export default function AdminUserDetail({ user, onClose, onChanged }: Props) {
  const confirm = useAdminConfirm();
  const toast = useAdminToast();
  const [busy, setBusy] = useState<null | "grant" | "plan" | "revoke" | "regen" | "resync" | "notify">(null);
  const [grantPlan, setGrantPlan] = useState<"basic" | "plus">(user.subscriptionPlan === "plus" ? "plus" : "basic");
  const [grantDur, setGrantDur] = useState("30d");
  const [customDays, setCustomDays] = useState("");
  const [newPlan, setNewPlan] = useState<"trial" | "basic" | "plus">(
    user.subscriptionPlan === "plus" || user.subscriptionPlan === "basic" ? (user.subscriptionPlan as "basic" | "plus") : "trial",
  );
  const [err, setErr] = useState<string | null>(null);
  const [resync, setResync] = useState<ResyncResult | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [nTitle, setNTitle] = useState("");
  const [nText, setNText] = useState("");

  // Часы карточки: «осталось» обновляется раз в 30 с.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  /* ── Устройства ─────────────────────────────────────────────── */
  const [dev, setDev] = useState<DevicesData | null>(null);
  const [devErr, setDevErr] = useState<string | null>(null);
  const [devLoading, setDevLoading] = useState(false);
  const [devBusy, setDevBusy] = useState<string | null>(null);
  const loadDevices = useCallback(async () => {
    setDevLoading(true);
    setDevErr(null);
    const r = await getJson<DevicesData>(`/api/admin/users/${user.id}/devices`);
    if (r.ok) setDev(r.data);
    else setDevErr(r.error);
    setDevLoading(false);
  }, [user.id]);
  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const unlink = async (d: HwidDevice | "all") => {
    const all = d === "all";
    const ok = await confirm(
      all
        ? {
            title: `Отвязать все устройства (${dev?.total ?? 0})?`,
            text: `${user.email}\n\nМеста в лимите освободятся. Устройства подключатся снова при следующем входе, если лимит позволит.`,
            confirmLabel: "Отвязать все",
          }
        : {
            title: `Отвязать «${deviceName(d)}»?`,
            text: `${user.email}\n\nМесто в лимите освободится. Устройство подключится снова при следующем входе, если лимит позволит.`,
            confirmLabel: "Отвязать",
          },
    );
    if (!ok) return;
    setDevBusy(all ? "all" : d.hwid);
    const r = await deleteJson<DevicesData>(`/api/admin/users/${user.id}/devices`, all ? { all: true } : { hwid: d.hwid });
    setDevBusy(null);
    if (!r.ok) {
      toast(r.error, "off");
      if (r.status === 404) loadDevices();
      return;
    }
    setDev((prev) => ({ ...r.data, limit: prev?.limit, siteLimit: prev?.siteLimit }));
    toast(r.data.removed === "all" ? "Все устройства отвязаны" : `«${all ? "" : deviceName(d)}» отвязано`);
    loadLogs();
  };

  /* ── История и журнал ───────────────────────────────────────── */
  const [hist, setHist] = useState<UserHistory | null>(null);
  const [histErr, setHistErr] = useState<string | null>(null);
  const [histFilter, setHistFilter] = useState<"all" | "pay" | "event">("all");
  const [histAll, setHistAll] = useState(false);
  const loadHistory = useCallback(async () => {
    const r = await getJson<UserHistory>(`/api/admin/users/${user.id}/history`);
    if (r.ok) {
      setHist(r.data);
      setHistErr(null);
    } else setHistErr(r.error);
  }, [user.id]);

  const [logs, setLogs] = useState<AuditLogItem[] | null>(null);
  const [logsErr, setLogsErr] = useState<string | null>(null);
  const loadLogs = useCallback(async () => {
    const r = await getJson<AuditLogItem[]>(`/api/admin/logs?userId=${encodeURIComponent(user.id)}&limit=30`);
    if (r.ok) {
      setLogs(r.data);
      setLogsErr(null);
    } else setLogsErr(r.error);
  }, [user.id]);

  useEffect(() => {
    loadHistory();
    loadLogs();
  }, [loadHistory, loadLogs]);

  const timeline = useMemo(() => (hist ? buildTimeline(hist) : []), [hist]);
  const shown = timeline.filter((x) => histFilter === "all" || x.type === histFilter);
  const paid = hist ? hist.payments.filter((p) => p.status === "confirmed" || p.status === "refunded") : [];
  const paidSum = paid.reduce((s, p) => s + p.amount, 0);
  const refunded = hist ? hist.payments.filter((p) => p.refundedAt) : [];
  const refundedSum = refunded.reduce((s, p) => s + p.amount, 0);

  /* ── IP-адреса: задача панели ───────────────────────────────── */
  const [ip, setIp] = useState<{ state: "idle" | "run" | "done" | "fail"; job?: IpJob; error?: string }>({ state: "idle" });
  const ipRun = useRef(0);
  useEffect(() => () => void (ipRun.current += 1), []);
  const checkIps = async () => {
    const run = ++ipRun.current;
    setIp({ state: "run" });
    const start = await postJson<{ jobId: string }>(`/api/admin/users/${user.id}/ips`);
    if (run !== ipRun.current) return;
    if (!start.ok) {
      setIp({ state: "fail", error: start.error });
      return;
    }
    for (let k = 1; k <= 40; k++) {
      await new Promise((ok) => setTimeout(ok, 1500));
      if (run !== ipRun.current) return;
      const r = await getJson<IpJob>(`/api/admin/users/${user.id}/ips?jobId=${encodeURIComponent(start.data.jobId)}`);
      if (run !== ipRun.current) return;
      if (!r.ok) {
        setIp({ state: "fail", error: r.error });
        return;
      }
      if (r.data.isFailed) {
        setIp({ state: "fail", error: "Панель не смогла собрать адреса" });
        return;
      }
      if (r.data.isCompleted) {
        setIp({ state: "done", job: r.data });
        return;
      }
    }
    setIp({ state: "fail", error: "Панель считает слишком долго — повторите через минуту" });
  };

  /* ── Действия ───────────────────────────────────────────────── */
  const manage = (body: Record<string, unknown>) => postJson<Record<string, unknown>>("/api/admin/users/manage", { userId: user.id, ...body });
  const afterAction = () => {
    onChanged();
    loadHistory();
    loadLogs();
  };

  const daysNum = customDays.trim() === "" ? null : Number(customDays);
  const daysValid = daysNum !== null && Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= MAX_DAYS;
  const daysBad = customDays.trim() !== "" && !daysValid;
  const preset = DURATIONS.find((x) => x.key === grantDur)!;
  const grantMin = daysValid ? daysNum! * 1440 : preset.min;
  const grantLabel = daysValid ? `${daysNum} дн` : preset.label;
  const endMs = new Date(user.subscriptionEnd).getTime();

  const grant = async () => {
    if (daysBad) return;
    const base = Math.max(Date.now(), endMs);
    const planName = grantPlan === "plus" ? "Plus" : "Basic";
    const ok = await confirm({
      title: `Выдать ${planName} на ${grantLabel}?`,
      text: `${user.email}\n\nПодписка продлится до ${formatDateTime(base + grantMin * 60000)} (МСК). Пользователь получит уведомление.`,
      confirmLabel: "Выдать",
      tone: "primary",
    });
    if (!ok) return;
    setBusy("grant");
    setErr(null);
    const r = await manage(daysValid ? { action: "grant-subscription", plan: grantPlan, days: daysNum } : { action: "grant-subscription", plan: grantPlan, duration: grantDur });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error);
      toast(`Не выдали: ${r.error}`, "off");
      return;
    }
    const until = typeof r.data?.newEnd === "string" ? ` — до ${formatDateTime(r.data.newEnd)}` : "";
    if (r.data?.panelSynced === false) toast(`${planName} выдан${until}, но панель не обновилась — повторим автоматически. ${r.data.panelError ?? ""}`, "warn");
    else toast(`${planName} на ${grantLabel} выдан${until}`);
    setCustomDays("");
    afterAction();
  };

  const setPlan = async () => {
    const name = PLAN_OPTIONS.find((p) => p.key === newPlan)!.label;
    const ok = await confirm({
      title: `Сменить тариф на ${name}?`,
      text: `${user.email}\n\nСрок не изменится: ${user.isActive ? `до ${formatDateTime(user.subscriptionEnd)} (МСК)` : "подписка уже истекла"}. Пользователь получит уведомление.`,
      confirmLabel: `Сменить на ${name}`,
      tone: "primary",
    });
    if (!ok) return;
    setBusy("plan");
    setErr(null);
    const r = await manage({ action: "set-plan", plan: newPlan });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error);
      toast(`Не сменили: ${r.error}`, "off");
      return;
    }
    if (r.data?.changed === false) toast(`Тариф уже ${name}`, "warn");
    else if (r.data?.panelSynced === false) toast(`Тариф ${name}, но панель не обновилась — повторим автоматически. ${r.data.panelError ?? ""}`, "warn");
    else toast(`Тариф сменён на ${name}, срок прежний`);
    afterAction();
  };

  const revoke = async () => {
    const ok = await confirm({
      title: "Забрать подписку?",
      text: `${user.email}\n\nПодписка закончится сейчас, доступ в панели отключится. Пользователь получит уведомление. Вернуть — только новой выдачей.`,
      confirmLabel: "Забрать подписку",
    });
    if (!ok) return;
    setBusy("revoke");
    setErr(null);
    const r = await manage({ action: "revoke-subscription" });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error);
      toast(`Не забрали: ${r.error}`, "off");
      return;
    }
    if (r.data?.panelSynced === false) toast(`Подписка закончена, но панель не отключила доступ — повторим автоматически. ${r.data.panelError ?? ""}`, "warn");
    else toast("Подписка забрана, доступ отключён");
    afterAction();
  };

  const regen = async () => {
    const ok = await confirm({
      title: "Выпустить новую ссылку?",
      text: "Старая ссылка подписки и ключи перестанут работать — пользователю придётся заново подключить устройства.",
      confirmLabel: "Выпустить",
    });
    if (!ok) return;
    setBusy("regen");
    setErr(null);
    const r = await manage({ action: "regen-key" });
    setBusy(null);
    if (!r.ok) {
      setErr(r.error);
      toast(r.error, "off");
      return;
    }
    toast("Новая ссылка выпущена");
    afterAction();
  };

  const runResync = async () => {
    setBusy("resync");
    setErr(null);
    setResync(null);
    const r = await postJson<ResyncResult>(`/api/admin/users/${user.id}/resync`);
    setBusy(null);
    if (!r.ok) {
      setErr(r.error);
      toast(`Синхронизация не прошла: ${r.error}`, "off");
      return;
    }
    setResync(r.data);
    toast(r.data.sync.ok ? `Синхронизировано: ${SYNC_ACTION[r.data.sync.action] || r.data.sync.action}` : "Панель ответила ошибкой — подробности в карточке", r.data.sync.ok ? "ok" : "warn");
    onChanged();
    loadDevices();
  };

  const notify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nTitle.trim() || !nText.trim()) return;
    setBusy("notify");
    const r = await manage({ action: "send-notification", title: nTitle, message: nText });
    setBusy(null);
    if (!r.ok) {
      toast(`Не отправили: ${r.error}`, "off");
      return;
    }
    setNTitle("");
    setNText("");
    toast("Сообщение отправлено");
  };

  const copy = (text: string, what: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  /* ── Вид ────────────────────────────────────────────────────── */
  const planKey = user.isActive ? user.subscriptionPlan : "expired";
  const dLeft = Math.max(0, Math.ceil((endMs - now) / 864e5));
  const filled = user.isActive ? Math.min(30, Math.max(1, dLeft)) : 0;
  const soon = user.isActive && endMs - now < 3 * 864e5;
  const limit = dev?.limit ?? dev?.siteLimit ?? DEVICE_LIMIT;
  const ipNodes = ip.job?.result?.nodes ?? [];
  const uniqIps = new Set(ipNodes.flatMap((n) => n.ips.map((x) => x.ip)));
  const syncState = user.panelSyncState ? SYNC_ONE[user.panelSyncState] || { label: user.panelSyncState } : null;
  const hasPanel = user.panelUserId != null ? user.panelUserId !== null : !!user.remnawaveUserUuid;

  return (
    <section className="ak-card adm-detail adm-still" data-sheet="24" style={{ "--i": 0 } as CSSProperties} aria-labelledby="adm-u-h">
      {/* Шапка */}
      <div className="adm-detail-head">
        <div className="adm-detail-who">
          <p className="ak-eyebrow">Пользователь{user.publicId ? <> · <span className="a-num">{user.publicId}</span></> : null}</p>
          <h2 id="adm-u-h" className="ak-h3 adm-detail-mail">{user.email}</h2>
          <p className="adm-tagrow">
            <span className="adm-tag" data-tone={planTone(planKey)}>{PLAN_LABELS[planKey] || planKey}</span>
            {user.telegramLinked && <span className="adm-tag" data-tone="mute"><Icon name="send" size={12} />Telegram</span>}
            {user.accountsOnIp > 1 && <span className="adm-tag" data-tone={user.accountsOnIp > 2 ? "off" : "warn"}>{user.accountsOnIp} акк. на IP</span>}
            {!user.subscriptionUrl && <span className="adm-tag" data-tone="warn">нет ссылки</span>}
            {user.panelSyncState === "error" && <span className="adm-tag" data-tone="off">ошибка синхронизации</span>}
          </p>
        </div>
        <button type="button" onClick={onClose} className="ak-icon" aria-label="Закрыть карточку пользователя">
          <Icon name="close" size={18} />
        </button>
      </div>

      {user.panelSyncState === "error" && (
        <div className="adm-note adm-block-err adm-break" data-tone="off" role="status">
          <b>Панель не принимает изменения по этому пользователю</b>
          <span>{user.panelSyncError || "Текста ошибки нет."} Попробуйте «Синхронизировать» в блоке «Ссылка и панель».</span>
        </div>
      )}

      {/* Подписка — тёмная плита */}
      <div className="ak-dark adm-u-sub">
        <div className="adm-block-head">
          <h3 className="adm-u-sub-t">Подписка</h3>
          <span className="ak-status" data-tone={!user.isActive ? "off" : soon ? "warn" : undefined}>
            <i />
            {!user.isActive ? "Истекла" : soon ? "Скоро закончится" : "Активна"}
          </span>
        </div>
        <p className="ak-value adm-u-left" aria-live="polite"><span className="a-num">{leftWords(user.subscriptionEnd, now)}</span>{user.isActive && <small>осталось</small>}</p>
        <div className="ak-days" data-tone={soon ? "warn" : undefined} aria-hidden>
          {Array.from({ length: 30 }, (_, k) => (
            <span key={k} className="ak-day" style={{ "--k": k } as CSSProperties} data-on={k < filled ? "" : undefined} data-last={k === filled - 1 ? "" : undefined} />
          ))}
        </div>
        <p className="ak-days-cap a-num">
          <span>{user.isActive ? "до" : "закончилась"} {formatDateTime(user.subscriptionEnd)} МСК</span>
          <span>с {formatDate(user.createdAt)}</span>
        </p>
        <ul className="adm-u-facts">
          <li><span>Последняя оплата</span><b className="a-num">{user.lastPaymentAt ? formatDate(user.lastPaymentAt) : "не было"}</b></li>
          <li><span>Рефералы · оплатили</span><b className="a-num">{user.referrals} · {user.paidReferrals}</b></li>
          <li><span>Устройства</span><b className="a-num">{dev ? `${dev.total} / ${limit}` : "…"}</b></li>
        </ul>
      </div>

      {err && <p className="ak-err adm-break" role="alert">{err}</p>}

      {/* Выдать */}
      <div className="adm-block">
        <div className="adm-block-head">
          <h3 className="adm-block-title"><Icon name="bolt" size={16} />Выдать дни и тариф</h3>
        </div>
        <div className="adm-seg adm-seg-plan" role="group" aria-label="Тариф">
          {(["basic", "plus"] as const).map((p) => (
            <button key={p} type="button" className="adm-seg-btn" aria-pressed={grantPlan === p} onClick={() => setGrantPlan(p)}>
              {p === "plus" ? "Plus" : "Basic"}
            </button>
          ))}
        </div>
        <div className="adm-chips" role="group" aria-label="Срок">
          {DURATIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className="adm-chip"
              aria-pressed={!daysValid && grantDur === o.key}
              onClick={() => {
                setGrantDur(o.key);
                setCustomDays("");
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
        <label className="adm-f adm-days">
          <span className="adm-f-label">Свой срок, дней</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_DAYS}
            step={1}
            placeholder={`1–${MAX_DAYS}`}
            value={customDays}
            onChange={(e) => setCustomDays(e.target.value)}
            className="adm-input"
            aria-invalid={daysBad || undefined}
            aria-describedby="adm-days-hint"
          />
        </label>
        <p id="adm-days-hint" className={daysBad ? "ak-err" : "ak-fine a-num"}>
          {daysBad
            ? `Целое число от 1 до ${MAX_DAYS}.`
            : `Продлится от ${user.isActive ? "текущей даты окончания" : "сегодня"} до ${formatDateTime(Math.max(now, endMs) + grantMin * 60000)}.`}
        </p>
        <div className="adm-sub-actions">
          <button type="button" onClick={grant} disabled={busy !== null || daysBad} className="a-btn a-btn-primary">
            {busy === "grant" ? <><Spin />Выдаём…</> : <>Выдать {grantPlan === "plus" ? "Plus" : "Basic"} на {grantLabel}</>}
          </button>
        </div>
      </div>

      {/* Сменить тариф без продления */}
      <div className="adm-block">
        <div className="adm-block-head">
          <h3 className="adm-block-title"><Icon name="refresh" size={16} />Сменить тариф без продления</h3>
        </div>
        <div className="adm-seg adm-seg-plan" role="group" aria-label="Новый тариф">
          {PLAN_OPTIONS.map((p) => (
            <button key={p.key} type="button" className="adm-seg-btn" aria-pressed={newPlan === p.key} onClick={() => setNewPlan(p.key)}>
              {p.label}
              {user.subscriptionPlan === p.key && <span className="b-sr"> (текущий)</span>}
            </button>
          ))}
        </div>
        <p className="ak-fine">Срок остаётся прежним; меняются тариф в панели и скорость.</p>
        <div className="adm-sub-actions">
          <button type="button" onClick={setPlan} disabled={busy !== null || newPlan === user.subscriptionPlan} className="a-btn ak-btn-soft">
            {busy === "plan" ? <><Spin />Меняем…</> : newPlan === user.subscriptionPlan ? "Это текущий тариф" : <>Сменить на {PLAN_OPTIONS.find((p) => p.key === newPlan)!.label}</>}
          </button>
        </div>
      </div>

      {/* Устройства */}
      <div className="adm-block">
        <div className="adm-block-head">
          <h3 className="adm-block-title"><Icon name="devices" size={16} />Устройства</h3>
          <span className="adm-block-aside">
            {dev && <span className="adm-tag" data-tone={dev.total >= limit ? "warn" : "mute"}><span className="a-num">{dev.total} из {limit}</span></span>}
            <button type="button" className="ak-icon adm-icon-sm" onClick={loadDevices} disabled={devLoading} aria-label="Обновить список устройств">
              {devLoading ? <Spin /> : <Icon name="refresh" size={16} />}
            </button>
          </span>
        </div>
        {devErr ? (
          <p className="adm-note" data-tone="off">{devErr}</p>
        ) : !dev ? (
          <p className="ak-fine">Спрашиваем панель…</p>
        ) : dev.panelUserId === null ? (
          <p className="adm-note" data-tone="warn">У пользователя ещё нет записи в панели — устройств нет.</p>
        ) : dev.devices.length === 0 ? (
          <p className="ak-fine">Ни одного устройства не подключено.</p>
        ) : (
          <>
            <ul className="adm-devs">
              {dev.devices.map((d, k) => (
                <li key={d.hwid} className="adm-dev" style={{ "--k": k } as CSSProperties}>
                  <span className="adm-dev-ico" aria-hidden><Icon name={platformIcon(d)} size={18} /></span>
                  <span className="adm-dev-copy">
                    <b>{deviceName(d)}</b>
                    <span className="a-num">
                      {[d.platform, d.osVersion].filter(Boolean).join(" ") || "платформа неизвестна"}
                      {d.requestIp && <> · {d.requestIp}</>}
                      {" · "}
                      {ago(d.updatedAt || d.createdAt)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="ak-icon adm-dev-x"
                    onClick={() => unlink(d)}
                    disabled={devBusy !== null}
                    aria-label={`Отвязать ${deviceName(d)}`}
                  >
                    {devBusy === d.hwid ? <Spin /> : <Icon name="close" size={16} />}
                  </button>
                </li>
              ))}
            </ul>
            {dev.devices.length > 1 && (
              <div className="adm-sub-actions">
                <button type="button" className="a-btn ak-btn-soft adm-btn-warn" onClick={() => unlink("all")} disabled={devBusy !== null}>
                  {devBusy === "all" ? <><Spin />Отвязываем…</> : <>Отвязать все ({dev.devices.length})</>}
                </button>
              </div>
            )}
          </>
        )}
        <p className="ak-fine">Отвязка освобождает место в лимите; устройство подключится снова при следующем входе, если лимит позволит.</p>
      </div>

      {/* IP-адреса */}
      <div className="adm-block">
        <div className="adm-block-head">
          <h3 className="adm-block-title"><Icon name="globe" size={16} />IP-адреса подключений</h3>
          {ip.state === "done" && <span className="adm-tag" data-tone={uniqIps.size > 5 ? "warn" : undefined}><span className="a-num">{uniqIps.size} IP · {ipNodes.length} нод</span></span>}
        </div>
        {user.registrationIp && (
          <p className="adm-ipline" data-tone={user.accountsOnIp > 2 ? "off" : user.accountsOnIp > 1 ? "warn" : undefined}>
            <span>При регистрации</span>
            <span className="adm-ip a-num">{user.registrationIp}</span>
            <b className="a-num">{user.accountsOnIp} акк.</b>
          </p>
        )}
        {ip.state === "run" && (
          <div className="adm-progress adm-progress-run" role="progressbar" aria-label="Панель собирает адреса" aria-busy="true"><i /></div>
        )}
        {ip.state === "fail" && <p className="adm-note" data-tone="off">{ip.error}</p>}
        {ip.state === "done" &&
          (uniqIps.size === 0 ? (
            <p className="ak-fine">Панель не видит подключений.</p>
          ) : (
            <ul className="adm-ipnodes">
              {ipNodes.filter((n) => n.ips.length > 0).map((n) => (
                <li key={n.nodeUuid}>
                  <p className="adm-result-row">
                    <span>{n.nodeName}{n.countryCode ? ` · ${n.countryCode}` : ""}</span>
                    <span className="a-num adm-muted">{n.ips.length}</span>
                  </p>
                  <ul className="adm-ips">
                    {n.ips.map((x) => (
                      <li key={x.ip}>
                        <span className="adm-ip a-num">{x.ip}</span>
                        <span className="a-num adm-muted">{x.lastSeen ? ago(x.lastSeen) : "—"}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ))}
        {uniqIps.size > 5 && <p className="adm-note" data-tone="warn">Много адресов — возможно, ключом пользуются не только на своих устройствах.</p>}
        <div className="adm-sub-actions">
          <button type="button" onClick={checkIps} disabled={ip.state === "run" || !hasPanel} className="a-btn ak-btn-soft">
            {ip.state === "run" ? <><Spin />Панель считает…</> : <><Icon name="globe" size={16} />{ip.state === "done" ? "Проверить снова" : "Проверить IP"}</>}
          </button>
        </div>
        {!hasPanel && <p className="ak-fine">Нет записи в панели — адреса взять неоткуда.</p>}
      </div>

      {/* Ссылка и панель */}
      <div className="adm-block">
        <div className="adm-block-head">
          <h3 className="adm-block-title"><Icon name="lock" size={16} />Ссылка и панель</h3>
        </div>
        <dl className="adm-dl">
          <div>
            <dt>Синхронизация</dt>
            <dd data-tone={syncState?.tone}>{syncState ? syncState.label : "—"}</dd>
          </div>
          <div>
            <dt>Public ID</dt>
            <dd className="adm-strong a-num">{user.publicId || "—"}</dd>
          </div>
          <div>
            <dt>Имя в панели</dt>
            <dd>
              {user.panelUsername ? (
                <button
                  type="button"
                  className="adm-chipbtn"
                  data-tone={user.panelUsername === user.publicId ? undefined : "warn"}
                  onClick={() => copy(user.panelUsername || "", "name")}
                  aria-label={`Скопировать имя в панели ${user.panelUsername}`}
                >
                  <span className="a-num">{user.panelUsername}</span>
                  <Icon name={copied === "name" ? "check" : "copy"} size={14} />
                </button>
              ) : "—"}
            </dd>
          </div>
          <div>
            <dt>Номер в панели</dt>
            <dd className="adm-break a-num">{user.panelUserId ?? user.remnawaveUserUuid ?? "—"}</dd>
          </div>
          <div>
            <dt>Telegram ID</dt>
            <dd className="adm-break a-num">{user.telegramId || (user.telegramLinked ? "привязан" : "—")}</dd>
          </div>
          {user.linkKept && (
            <div>
              <dt>Связка с ботом</dt>
              <dd>
                {LINK_KEPT_LABELS[user.linkKept] || user.linkKept}
                {user.linkDisabledPanelUserId ? <> · отключён <span className="a-num">{user.linkDisabledPanelUserId}</span></> : null}
              </dd>
            </div>
          )}
          {user.bypassPanelUserId != null && (
            <div>
              <dt>Обход в панели</dt>
              <dd className="a-num">{user.bypassPanelUserId}</dd>
            </div>
          )}
        </dl>
        {user.subscriptionUrl ? (
          <div className="adm-url">
            <div className="adm-url-row">
              <code className="adm-code">{user.subscriptionUrl}</code>
              <button
                type="button"
                onClick={() => copy(user.subscriptionUrl || "", "url")}
                className="ak-icon adm-copy"
                data-state={copied === "url" ? "ok" : undefined}
                aria-label={copied === "url" ? "Ссылка скопирована" : "Скопировать ссылку подписки"}
              >
                <Icon name={copied === "url" ? "check" : "copy"} size={16} />
              </button>
            </div>
            {user.happCryptoLink && (
              <a href={user.happCryptoLink} className="adm-link">
                <Icon name="bolt" size={16} />
                Открыть в Happ
              </a>
            )}
          </div>
        ) : (
          <p className="adm-note" data-tone="warn">Ссылки ещё нет: появится после синхронизации с панелью.</p>
        )}
        <div className="adm-sub-actions">
          <button type="button" onClick={runResync} disabled={busy !== null} className="a-btn ak-btn-soft">
            {busy === "resync" ? <><Spin />Синхронизируем…</> : <><Icon name="refresh" size={16} />Синхронизировать</>}
          </button>
          {user.subscriptionUrl && (
            <button type="button" onClick={regen} disabled={busy !== null} className="a-btn ak-btn-soft">
              {busy === "regen" ? <><Spin />Выпускаем…</> : <><Icon name="share" size={16} />Новая ссылка</>}
            </button>
          )}
        </div>
        {resync && (
          <div className="adm-result">
            <div className="adm-result-row">
              <span>Итог синхронизации</span>
              <span className="adm-tag" data-tone={resync.sync.ok ? undefined : "off"}>{SYNC_ACTION[resync.sync.action] || resync.sync.action}</span>
            </div>
            {resync.sync.reason && <p className="adm-result-line">Причина: {resync.sync.reason}</p>}
            {resync.sync.panelError && <p className="adm-result-line adm-break" data-tone="off">{resync.sync.panelError}</p>}
            {resync.after.panelSyncError && <p className="adm-result-line adm-break" data-tone="off">Очередь: {resync.after.panelSyncError}</p>}
            {resync.sync.panelUsername !== undefined && (
              <p className="adm-result-line">
                Панель видит пользователя как <b data-tone={resync.sync.panelUsername === resync.after.publicId ? undefined : "warn"}>{resync.sync.panelUsername || "—"}</b>
              </p>
            )}
            <details className="adm-details">
              <summary>Ответы панели ({resync.probes.length})</summary>
              <ul className="adm-probes">
                {resync.probes.map((p, k) => (
                  <li key={`${p.path}-${k}`}>
                    <div className="adm-result-row">
                      <span className="adm-break">{p.path}</span>
                      <span className="adm-tag a-num" data-tone={p.ok ? undefined : "off"}>{p.status ?? "—"}</span>
                    </div>
                    <p className="adm-result-line adm-break">
                      {p.error ? p.error : typeof p.body === "string" ? p.body.slice(0, 240) : JSON.stringify(p.body).slice(0, 240)}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </div>

      {/* История: оплаты и события подписки */}
      <div className="adm-block">
        <div className="adm-block-head">
          <h3 className="adm-block-title"><Icon name="clock" size={16} />История</h3>
          {hist && (
            <span className="adm-muted a-num adm-hist-sum">
              оплат {num(paid.length)} на {money(paidSum)}
              {refunded.length > 0 && <> · возвратов {num(refunded.length)} на {money(refundedSum)}</>}
            </span>
          )}
        </div>
        {histErr ? (
          <p className="adm-note" data-tone="off">{histErr}</p>
        ) : !hist ? (
          <p className="ak-fine">Загружаем историю…</p>
        ) : timeline.length === 0 ? (
          <p className="ak-fine">Ни оплат, ни событий подписки пока нет.</p>
        ) : (
          <>
            <div className="adm-seg adm-hist-seg" role="group" aria-label="Что показать">
              {([
                ["all", `Всё · ${timeline.length}`],
                ["pay", `Оплаты · ${hist.payments.length}`],
                ["event", `Срок · ${hist.events.length}`],
              ] as const).map(([k, label]) => (
                <button key={k} type="button" className="adm-seg-btn" aria-pressed={histFilter === k} onClick={() => setHistFilter(k)}>
                  {label}
                </button>
              ))}
            </div>
            <ol className="adm-tl">
              {(histAll ? shown : shown.slice(0, 12)).map((x) => (
                <li key={x.key} className="adm-tl-i" data-type={x.type}>
                  <span className="adm-tl-dot" aria-hidden />
                  <span className="adm-tl-head">
                    <b>{x.title}</b>
                    {x.amount && <span className="adm-tl-amt a-num">{x.amount}</span>}
                  </span>
                  <span className="adm-tl-meta a-num">
                    {formatShort(x.at)}
                    {x.tag && <span className="adm-tag" data-tone={x.tag.tone}>{x.tag.label}</span>}
                  </span>
                  {x.lines.length > 0 && <span className="adm-tl-lines adm-break">{x.lines.join(" · ")}</span>}
                </li>
              ))}
            </ol>
            {shown.length > 12 && (
              <button type="button" className="adm-link" onClick={() => setHistAll((v) => !v)}>
                {histAll ? "Свернуть" : `Показать все (${shown.length})`}
                <Icon name="arrow-right" size={16} />
              </button>
            )}
          </>
        )}
      </div>

      {/* Журнал действий по пользователю */}
      <details className="adm-block adm-fold">
        <summary className="adm-block-title">
          <Icon name="shield" size={16} />
          Журнал действий{logs && <span className="adm-muted a-num"> · {logs.length}</span>}
        </summary>
        {logsErr ? (
          <p className="adm-note" data-tone="off">{logsErr}</p>
        ) : !logs ? (
          <p className="ak-fine">Загружаем…</p>
        ) : logs.length === 0 ? (
          <p className="ak-fine">Записей по пользователю нет.</p>
        ) : (
          <ol className="adm-hist">
            {logs.map((l) => {
              const m = ACTION_LABELS[l.action] || { label: l.action, tone: "mute" as const };
              return (
                <li key={l.id} data-level={l.level}>
                  <span className="adm-tag" data-tone={l.level === "error" ? "off" : m.tone}>{m.label}</span>
                  <span className="adm-hist-d adm-break">{l.details || ""}</span>
                  <span className="adm-hist-t a-num">{formatShort(l.createdAt)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </details>

      {/* Сообщение */}
      <details className="adm-block adm-fold">
        <summary className="adm-block-title"><Icon name="bell" size={16} />Написать пользователю</summary>
        <form onSubmit={notify}>
          <label className="adm-f">
            <span className="adm-f-label">Заголовок</span>
            <input type="text" value={nTitle} onChange={(e) => setNTitle(e.target.value)} className="adm-input" required />
          </label>
          <label className="adm-f">
            <span className="adm-f-label">Сообщение</span>
            <textarea value={nText} onChange={(e) => setNText(e.target.value)} rows={3} className="adm-input adm-area" required />
          </label>
          <div className="adm-sub-actions">
            <button type="submit" disabled={busy !== null} className="a-btn ak-btn-soft">
              {busy === "notify" ? <><Spin />Отправляем…</> : <><Icon name="send" size={16} />Отправить</>}
            </button>
          </div>
        </form>
      </details>

      {/* Забрать */}
      {user.isActive && (
        <div className="adm-block adm-danger">
          <div className="adm-block-head">
            <h3 className="adm-block-title">Забрать подписку</h3>
          </div>
          <p className="ak-fine">Подписка закончится сейчас, доступ в панели отключится. Спросим подтверждение.</p>
          <div className="adm-sub-actions">
            <button type="button" onClick={revoke} disabled={busy !== null} className="a-btn ak-btn-danger">
              {busy === "revoke" ? <><Spin />Забираем…</> : "Забрать подписку"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
