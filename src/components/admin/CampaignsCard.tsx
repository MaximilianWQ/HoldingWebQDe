"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Icon from "@/components/pixel/Icon";
import { useAdminConfirm, useAdminToast, Spin } from "@/app/admin/AdminConfirm";
import { formatShort, getJson, num, postJson, type NotificationItem, type UserFilter, type UsersPage } from "@/app/admin/admin-shared";
import { BlockError, Tile } from "./Viz";
import "@/app/admin/admin-campaigns.css";

/**
 * «Рассылки и начисления» — письма через Resend и уведомления в кабинете,
 * всем или по выбору, с подарком (дни подписки и/или ГБ обхода).
 *
 * Мастер: Кому → Что → Подарок → Проверка (цифры аудитории, письмо как
 * его увидит первый получатель, тест себе, запуск с подтверждением:
 * сколько писем, кому что начислится, сколько займёт при суточном
 * лимите). Ниже — список рассылок с прогрессом, пауза / продолжение /
 * отмена, и уведомления «всем» старого образца (удаление).
 *
 * API — /api/admin/campaigns/** (src/lib/campaigns.ts).
 */

type Kind = "service" | "marketing";
type Channel = "email" | "site" | "both";
type Plan = "trial" | "basic" | "plus";
type Status = "draft" | "queued" | "sending" | "paused" | "done" | "cancelled";

interface Counts {
  total: number;
  queued: number;
  sent: number;
  failed: number;
  skipped_optout: number;
  skipped_no_consent: number;
  skipped_invalid: number;
  skipped_placeholder: number;
  granted: number;
  grant_pending: number;
  notified: number;
}
interface Estimate {
  emails: number;
  soon: number;
  later: number;
  days: number;
  text: string;
}
interface GrantSpec {
  plan: Plan | null;
  days: number | null;
  trafficGb: number | null;
}
type AudienceV = { type: "filter"; filter: UserFilter; q: string | null } | { type: "list"; entries: string[] };
interface CampaignV {
  id: string;
  kind: Kind;
  channel: Channel;
  subject: string;
  bodyMd: string;
  audience: AudienceV;
  grant: GrantSpec | null;
  grantLabel: string | null;
  status: Status;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  lastError: string | null;
  counts: Counts;
  estimate: Estimate | null;
}
interface LimitInfo {
  daily: number;
  sentLast24h: number;
  available: number;
  queued: number;
}
interface Preview {
  audience: {
    total: number;
    byStatus: { queued: number; skipped_optout: number; skipped_no_consent: number; skipped_invalid: number; skipped_placeholder: number };
    optedOut: number;
    notFound: string[];
    sample: string[];
  };
  toEmail: number;
  toNotify: number;
  grant: { plan: Plan | null; days: number | null; trafficGb: number | null; recipients: number; totalGb: number; label: string } | null;
  email: { subject: string; html: string; text: string } | null;
  notification: { title: string; message: string } | null;
  estimate: Estimate;
  limit: { daily: number; sentLast24h: number };
}
interface Failure {
  email: string;
  status: string;
  error: string | null;
  attempts: number;
}

const FILTERS: Array<{ key: UserFilter; label: string }> = [
  { key: "all", label: "Все, кто когда-либо регистрировался" },
  { key: "active", label: "С активной подпиской" },
  { key: "paid", label: "Платные" },
  { key: "trial", label: "На пробном" },
  { key: "expiring", label: "Истекают за 3 дня" },
  { key: "expired", label: "Подписка истекла" },
  { key: "no_link", label: "Без ссылки" },
  { key: "shared_ip", label: "Общий IP" },
  { key: "sync_error", label: "Ошибка синхронизации" },
];
const KIND: Record<Kind, string> = { service: "Служебная", marketing: "Рекламная" };
const CHANNEL: Record<Channel, string> = { email: "Письмо", site: "В кабинет", both: "Письмо и кабинет" };
const PLAN: Record<Plan, string> = { trial: "Пробный", basic: "Basic", plus: "Plus" };
const STATUS: Record<Status, { label: string; tone?: "ink" | "off" | "warn" | "mute" }> = {
  draft: { label: "Черновик", tone: "mute" },
  queued: { label: "В очереди", tone: "warn" },
  sending: { label: "Идёт" },
  paused: { label: "Пауза", tone: "warn" },
  done: { label: "Готово", tone: "ink" },
  cancelled: { label: "Отменена", tone: "off" },
};
const PH = ["email", "days_left", "plan", "dashboard_url"] as const;
const STEPS = ["Кому", "Что", "Подарок", "Проверка"] as const;

interface Draft {
  id: string | null;
  kind: Kind;
  channel: Channel;
  subject: string;
  bodyMd: string;
  audType: "filter" | "list";
  filter: UserFilter;
  q: string;
  listText: string;
  grantOn: boolean;
  days: string;
  plan: Plan;
  gb: string;
}

const EMPTY: Draft = { id: null, kind: "service", channel: "email", subject: "", bodyMd: "", audType: "filter", filter: "all", q: "", listText: "", grantOn: false, days: "", plan: "basic", gb: "" };

function toBody(d: Draft, loose = false) {
  return {
    id: d.id ?? undefined,
    kind: d.kind,
    channel: d.channel,
    subject: d.subject.trim() || (loose ? "Предпросмотр" : ""),
    bodyMd: d.bodyMd.trim() || (loose ? "Текст" : ""),
    audience: d.audType === "filter" ? { type: "filter", filter: d.filter, q: d.q.trim() || null } : { type: "list", text: d.listText },
    grant: d.grantOn ? { plan: d.days ? d.plan : null, days: d.days ? Number(d.days) : null, trafficGb: d.gb ? Number(d.gb) : null } : null,
  };
}

function fromView(c: CampaignV): Draft {
  return {
    id: c.id,
    kind: c.kind,
    channel: c.channel,
    subject: c.subject,
    bodyMd: c.bodyMd,
    audType: c.audience.type,
    filter: c.audience.type === "filter" ? c.audience.filter : "all",
    q: c.audience.type === "filter" ? c.audience.q ?? "" : "",
    listText: c.audience.type === "list" ? c.audience.entries.join("\n") : "",
    grantOn: !!c.grant,
    days: c.grant?.days ? String(c.grant.days) : "",
    plan: c.grant?.plan ?? "basic",
    gb: c.grant?.trafficGb ? String(c.grant.trafficGb) : "",
  };
}

/** Текст подтверждения запуска: всё, что произойдёт, цифрами. */
function confirmText(pv: Preview, kind: Kind): string {
  const b = pv.audience.byStatus;
  const lines = [`Получателей: ${num(pv.audience.total)}`];
  if (pv.email) lines.push(`Писем: ${num(pv.toEmail)} — ${KIND[kind].toLowerCase()} рассылка`);
  const noMail: string[] = [];
  if (pv.email && b.skipped_placeholder) noMail.push(`аккаунты бота без почты — ${num(b.skipped_placeholder)}`);
  if (pv.email && b.skipped_invalid) noMail.push(`неверный адрес — ${num(b.skipped_invalid)}`);
  if (noMail.length) lines.push(`Без письма: ${noMail.join(", ")}`);
  if (kind === "marketing" && (b.skipped_no_consent || b.skipped_optout)) {
    lines.push(`Пропустим: нет согласия — ${num(b.skipped_no_consent)}, отписались — ${num(b.skipped_optout)}`);
  }
  if (pv.toNotify) lines.push(`Уведомлений в кабинете: ${num(pv.toNotify)}`);
  if (pv.grant) {
    const parts: string[] = [];
    if (pv.grant.days && pv.grant.plan) parts.push(`${PLAN[pv.grant.plan]} +${pv.grant.days} дн.`);
    if (pv.grant.trafficGb) parts.push(`+${num(pv.grant.trafficGb)} ГБ обхода (всего ${num(pv.grant.totalGb)} ГБ)`);
    lines.push(`Подарок каждому из ${num(pv.grant.recipients)}: ${parts.join(", ")}`);
  }
  if (pv.email) lines.push(`Время: ${pv.estimate.text}`);
  if (pv.grant) lines.push("Начисления пройдут сразу всем; отменить их потом нельзя.");
  return lines.join("\n");
}

export default function CampaignsCard({
  i = 0,
  notifications,
  notifError,
  onNotificationsChanged,
}: {
  i?: number;
  notifications: NotificationItem[];
  notifError: string | null;
  onNotificationsChanged: () => void;
}) {
  const [list, setList] = useState<CampaignV[] | null>(null);
  const [limit, setLimit] = useState<LimitInfo | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [wizKey, setWizKey] = useState(0);

  const load = useCallback(async () => {
    const r = await getJson<{ campaigns: CampaignV[]; limit: LimitInfo }>("/api/admin/campaigns");
    if (r.ok) {
      setList(r.data.campaigns);
      setLimit(r.data.limit);
      setErr(null);
    } else setErr(r.error);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const live = !!list?.some((c) => c.status === "queued" || c.status === "sending");
  useEffect(() => {
    if (!live) return;
    const t = window.setInterval(load, 8000);
    return () => window.clearInterval(t);
  }, [live, load]);

  const openWizard = (d: Draft) => {
    setDraft(d);
    setWizKey((k) => k + 1);
  };

  return (
    <section className="ak-card adm-s-cmp adm-still" data-sheet="24" style={{ "--i": i } as CSSProperties} aria-labelledby="adm-cmp-h">
      <div className="ak-card-head">
        <h2 id="adm-cmp-h" className="ak-eyebrow">Рассылки и начисления</h2>
        {limit && (
          <span className="ak-status" data-tone={limit.available === 0 ? "warn" : undefined}>
            <i />
            Писем за 24 ч: {num(limit.sentLast24h)} из {num(limit.daily)}
          </span>
        )}
      </div>
      <p className="ak-text adm-lead">
        Письма и уведомления в кабинете — всем или по выбору, с подарком днями подписки и гигабайтами обхода. Начисления проходят сразу, письма —
        не больше {num(limit?.daily ?? 80)} за сутки.
      </p>

      {draft ? (
        <Wizard key={wizKey} initial={draft} onClose={() => setDraft(null)} onDone={() => { setDraft(null); load(); }} />
      ) : (
        <div className="adm-sub-actions">
          <button type="button" className="a-btn a-btn-primary" onClick={() => openWizard(EMPTY)}>
            <Icon name="send" size={16} />
            Новая рассылка
          </button>
        </div>
      )}

      <h3 className="adm-cmp-h">Рассылки{list ? ` · ${list.length}` : ""}</h3>
      {err && <BlockError title="Список рассылок не загрузился" text={err} />}
      {!list && !err && <p className="ak-fine">Загружаем…</p>}
      {list && list.length === 0 && <p className="ak-fine">Рассылок ещё не было.</p>}
      {list && list.length > 0 && (
        <ul className="adm-cmp-list">
          {list.map((c) => (
            <CampaignRow key={c.id} c={c} onChanged={load} onOpenDraft={() => openWizard(fromView(c))} />
          ))}
        </ul>
      )}

      <SentNotifications notifications={notifications} error={notifError} onChanged={onNotificationsChanged} />
    </section>
  );
}

/* ─── Мастер ─────────────────────────────────────────────────────── */

function Wizard({ initial, onClose, onDone }: { initial: Draft; onClose: () => void; onDone: () => void }) {
  const confirm = useAdminConfirm();
  const toast = useAdminToast();
  const [d, setD] = useState<Draft>(initial);
  const [step, setStep] = useState(0);
  const [counts, setCounts] = useState<Record<UserFilter, number> | null>(null);
  const [pv, setPv] = useState<Preview | null>(null);
  const [pvErr, setPvErr] = useState<string | null>(null);
  const [pvBusy, setPvBusy] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "start" | "test">(null);
  const [testTo, setTestTo] = useState("");
  const [stepErr, setStepErr] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const seq = useRef(0);
  const set = (patch: Partial<Draft>) => setD((x) => ({ ...x, ...patch }));

  useEffect(() => {
    getJson<UsersPage>("/api/admin/users?limit=1").then((r) => {
      if (r.ok) setCounts(r.data.counts);
    });
  }, []);

  // Цифры аудитории на первом шаге и полный предпросмотр на последнем.
  useEffect(() => {
    if (step !== 0 && step !== 3) return;
    const my = ++seq.current;
    const t = window.setTimeout(async () => {
      setPvBusy(true);
      const body = step === 0 ? { ...toBody(d, true), grant: null } : toBody(d);
      const r = await postJson<Preview>("/api/admin/campaigns/preview", body);
      if (my !== seq.current) return;
      setPvBusy(false);
      if (r.ok) {
        setPv(r.data);
        setPvErr(null);
      } else {
        setPv(null);
        setPvErr(r.error);
      }
    }, step === 0 ? 400 : 0);
    return () => window.clearTimeout(t);
  }, [d, step]);

  const insert = (token: string) => {
    const el = bodyRef.current;
    const at = el ? el.selectionStart : d.bodyMd.length;
    const end = el ? el.selectionEnd : at;
    const next = d.bodyMd.slice(0, at) + token + d.bodyMd.slice(end);
    set({ bodyMd: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + token.length, at + token.length);
    });
  };

  const next = () => {
    setStepErr(null);
    if (step === 0 && d.audType === "list" && !d.listText.trim()) return setStepErr("Вставьте адреса или ID — по одному в строке");
    if (step === 1) {
      if (!d.subject.trim()) return setStepErr(d.channel === "site" ? "Укажите заголовок уведомления" : "Укажите тему письма");
      if (!d.bodyMd.trim()) return setStepErr("Напишите текст");
    }
    if (step === 2 && d.grantOn) {
      if (!d.days && !d.gb) return setStepErr("Укажите дни подписки, гигабайты или выключите подарок");
      if (d.kind === "marketing") return setStepErr("Подарок — только в служебной рассылке: переключите тип на шаге «Что»");
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const save = async (): Promise<string | null> => {
    const body = toBody(d);
    const r = d.id
      ? await getJson<CampaignV>(`/api/admin/campaigns/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await postJson<CampaignV>("/api/admin/campaigns", body);
    if (!r.ok) {
      toast(`Не сохранили: ${r.error}`, "off");
      return null;
    }
    set({ id: r.data.id });
    return r.data.id;
  };

  const saveDraft = async () => {
    setBusy("save");
    const id = await save();
    setBusy(null);
    if (id) {
      toast("Черновик сохранён");
      onDone();
    }
  };

  const launch = async () => {
    if (!pv) return;
    const ok = await confirm({ title: "Запустить рассылку?", text: confirmText(pv, d.kind), confirmLabel: "Запустить", tone: pv.grant ? "danger" : "primary" });
    if (!ok) return;
    setBusy("start");
    const id = await save();
    if (!id) {
      setBusy(null);
      return;
    }
    const r = await postJson<CampaignV>(`/api/admin/campaigns/${id}/start`);
    setBusy(null);
    if (!r.ok) {
      toast(`Не запустили: ${r.error}`, "off");
      return;
    }
    toast("Рассылка запущена");
    onDone();
  };

  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("test");
    const r = await postJson<{ to: string }>("/api/admin/campaigns/test", { ...toBody(d), to: testTo.trim() || undefined });
    setBusy(null);
    if (r.ok) toast(`Тест ушёл на ${r.data.to}`);
    else toast(`Тест не ушёл: ${r.error}`, "off");
  };

  const b = pv?.audience.byStatus;

  return (
    <div className="adm-cmp-wiz">
      <ol className="ak-stepper" aria-label="Шаги рассылки">
        {STEPS.map((s, k) => (
          <li key={s}>
            {k < step ? (
              <button type="button" className="ak-step" data-state="done" onClick={() => setStep(k)}>
                <span className="ak-step-n">
                  <Icon name="check" size={14} />
                </span>
                <span className="ak-step-label">{s}</span>
              </button>
            ) : (
              <span className="ak-step" data-state={k === step ? "now" : "next"} aria-current={k === step ? "step" : undefined}>
                <span className="ak-step-n">{k + 1}</span>
                <span className="ak-step-label">{s}</span>
              </span>
            )}
          </li>
        ))}
      </ol>

      <div className="adm-cmp-pane" key={step}>
        {step === 0 && (
          <>
            <div className="adm-cmp-group">
              <p className="adm-f-label">Как выбрать получателей</p>
              <div className="adm-seg" role="group" aria-label="Как выбрать получателей">
                <button type="button" className="adm-seg-btn" aria-pressed={d.audType === "filter"} onClick={() => set({ audType: "filter" })}>
                  По фильтру
                </button>
                <button type="button" className="adm-seg-btn" aria-pressed={d.audType === "list"} onClick={() => set({ audType: "list" })}>
                  Списком
                </button>
              </div>
            </div>
            {d.audType === "filter" ? (
              <>
                <div className="adm-chips" role="group" aria-label="Фильтр получателей">
                  {FILTERS.map((f) => (
                    <button key={f.key} type="button" className="adm-chip" aria-pressed={d.filter === f.key} onClick={() => set({ filter: f.key })}>
                      {f.label}
                      {counts && <span className="adm-chip-n a-num">{num(counts[f.key])}</span>}
                    </button>
                  ))}
                </div>
                <label className="adm-f">
                  <span className="adm-f-label">Уточнить поиском — необязательно</span>
                  <input className="adm-input" value={d.q} onChange={(e) => set({ q: e.target.value })} placeholder="Почта, ST-номер или IP" maxLength={200} spellCheck={false} />
                </label>
              </>
            ) : (
              <label className="adm-f">
                <span className="adm-f-label">Адреса, ID или ST-номера — по одному в строке</span>
                <textarea className="adm-input adm-area" rows={6} value={d.listText} onChange={(e) => set({ listText: e.target.value })} spellCheck={false} />
              </label>
            )}
            <p className="adm-cmp-aud" aria-live="polite">
              {pvBusy && !pv ? (
                <>
                  <Spin /> Считаем…
                </>
              ) : pv ? (
                <>
                  Совпало <b className="a-num">{num(pv.audience.total)}</b>
                  {pv.audience.byStatus.skipped_placeholder > 0 && ` · из них ${num(pv.audience.byStatus.skipped_placeholder)} — аккаунты бота без почты`}
                  {pv.audience.notFound.length > 0 && ` · нет на сайте: ${num(pv.audience.notFound.length)}`}
                </>
              ) : (
                pvErr
              )}
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <div className="adm-cmp-group">
              <p className="adm-f-label">Тип</p>
              <div className="adm-seg" role="group" aria-label="Тип рассылки">
                {(["service", "marketing"] as const).map((k) => (
                  <button key={k} type="button" className="adm-seg-btn" aria-pressed={d.kind === k} onClick={() => set({ kind: k })}>
                    {KIND[k]}
                  </button>
                ))}
              </div>
              <p className="adm-cmp-hint">
                {d.kind === "service"
                  ? "Начисления, изменения условий, важное о сервисе. Уходит всем, включая отписавшихся."
                  : "Новости и предложения. Уйдёт только тем, кто согласился получать рассылку и не отписался."}
              </p>
            </div>
            <div className="adm-cmp-group">
              <p className="adm-f-label">Куда</p>
              <div className="adm-seg" role="group" aria-label="Канал">
                {(["email", "site", "both"] as const).map((k) => (
                  <button key={k} type="button" className="adm-seg-btn" aria-pressed={d.channel === k} onClick={() => set({ channel: k })}>
                    {CHANNEL[k]}
                  </button>
                ))}
              </div>
            </div>
            <label className="adm-f">
              <span className="adm-f-label">{d.channel === "site" ? "Заголовок уведомления" : "Тема письма"}</span>
              <input className="adm-input" value={d.subject} onChange={(e) => set({ subject: e.target.value })} maxLength={150} required />
            </label>
            <div className="adm-f">
              <label className="adm-f-label" htmlFor="adm-cmp-body">
                Текст
              </label>
              <div className="adm-cmp-ph" role="group" aria-label="Вставить подстановку">
                {PH.map((p) => (
                  <button key={p} type="button" className="adm-chip" onClick={() => insert(`{{${p}}}`)}>
                    {`{{${p}}}`}
                  </button>
                ))}
              </div>
              <textarea id="adm-cmp-body" ref={bodyRef} className="adm-input adm-area adm-cmp-area" rows={10} value={d.bodyMd} onChange={(e) => set({ bodyMd: e.target.value })} />
              <p className="adm-cmp-hint">
                **жирный**, [текст ссылки](https://…), список — строки с «- ». HTML не работает — покажется текстом. {"{{days_left}}"} — дней подписки после подарка,{" "}
                {"{{plan}}"} — тариф, {"{{dashboard_url}}"} — ссылка в кабинет.
              </p>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <button
              type="button"
              role="switch"
              aria-checked={d.grantOn}
              className="adm-toggle"
              onClick={() => set(d.grantOn ? { grantOn: false } : { grantOn: true, kind: "service" })}
            >
              <span className="adm-toggle-copy">
                <span className="ak-h3">Начислить подарок</span>
                <span className="adm-toggle-state">{d.grantOn ? "Каждому получателю" : "Без начисления"}</span>
              </span>
              <span className="ak-switch" aria-hidden />
            </button>
            {d.grantOn && (
              <div className="adm-cmp-grant">
                <div className="adm-cmp-grant-row">
                  <label className="adm-f">
                    <span className="adm-f-label">Дни подписки, 1–400</span>
                    <input className="adm-input" type="number" inputMode="numeric" min={1} max={400} value={d.days} onChange={(e) => set({ days: e.target.value })} />
                  </label>
                  <label className="adm-f">
                    <span className="adm-f-label">Гигабайты обхода, 1–5000</span>
                    <input className="adm-input" type="number" inputMode="numeric" min={1} max={5000} value={d.gb} onChange={(e) => set({ gb: e.target.value })} />
                  </label>
                </div>
                <div className="adm-seg adm-seg-plan" role="group" aria-label="Тариф для дней">
                  {(["trial", "basic", "plus"] as const).map((p) => (
                    <button key={p} type="button" className="adm-seg-btn" aria-pressed={d.plan === p} disabled={!d.days} onClick={() => set({ plan: p })}>
                      {PLAN[p]}
                    </button>
                  ))}
                </div>
                <p className="adm-note">
                  Письмо о подарке — сервисное: только факт начисления и как им пользоваться. С призывом купить — рекламное (уйдёт только согласившимся).
                </p>
                <p className="adm-cmp-hint">
                  Подарок не понижает тариф: у кого сейчас действует Plus, при подарке Basic останется Plus, прибавятся дни. Истёкшим дни считаются с момента
                  начисления. Начисления проходят сразу всем получателям, письма — по суточному лимиту.
                </p>
              </div>
            )}
          </>
        )}

        {step === 3 && (
          <>
            {pvBusy && !pv && (
              <p className="adm-cmp-aud">
                <Spin /> Собираем предпросмотр…
              </p>
            )}
            {pvErr && <p className="ak-err" role="alert">{pvErr}</p>}
            {pv && b && (
              <>
                <ul className="adm-tiles adm-tiles-sm">
                  <Tile label="Получателей" value={num(pv.audience.total)} />
                  {pv.email && <Tile label="Писем уйдёт" value={num(pv.toEmail)} tone="ok" />}
                  {pv.toNotify > 0 && <Tile label="В кабинет" value={num(pv.toNotify)} />}
                  {pv.email && b.skipped_placeholder > 0 && <Tile label="Без письма: бот без почты" value={num(b.skipped_placeholder)} tone="mute" />}
                  {pv.email && b.skipped_invalid > 0 && <Tile label="Неверный адрес" value={num(b.skipped_invalid)} tone="warn" />}
                  {d.kind === "marketing" && <Tile label="Нет согласия" value={num(b.skipped_no_consent)} tone="mute" />}
                  {d.kind === "marketing" ? (
                    <Tile label="Отписались" value={num(b.skipped_optout)} tone="mute" />
                  ) : (
                    pv.audience.optedOut > 0 && <Tile label="Отписались — получат: служебное" value={num(pv.audience.optedOut)} tone="mute" />
                  )}
                  {pv.audience.notFound.length > 0 && <Tile label="Нет на сайте" value={num(pv.audience.notFound.length)} tone="warn" />}
                </ul>
                {pv.grant && (
                  <p className="adm-note">
                    Подарок каждому: {pv.grant.label} · получателей {num(pv.grant.recipients)}
                    {pv.grant.totalGb > 0 && ` · всего ${num(pv.grant.totalGb)} ГБ`}
                  </p>
                )}
                {pv.email && (
                  <>
                    <p className="ak-text">{pv.estimate.text}</p>
                    <p className="ak-fine">
                      Лимит — {num(pv.limit.daily)} писем за 24 часа, уже отправлено {num(pv.limit.sentLast24h)}.
                    </p>
                  </>
                )}
                {pv.audience.sample.length > 0 && (
                  <details className="adm-details">
                    <summary>Первые адреса ({pv.audience.sample.length})</summary>
                    <ul className="adm-cmp-sample">
                      {pv.audience.sample.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {pv.audience.notFound.length > 0 && (
                  <details className="adm-details">
                    <summary>Нет на сайте ({pv.audience.notFound.length})</summary>
                    <ul className="adm-cmp-sample">
                      {pv.audience.notFound.slice(0, 50).map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </details>
                )}
                {pv.email && (
                  <div className="adm-cmp-block">
                    <p className="adm-f-label">Письмо первому получателю</p>
                    <p className="adm-cmp-subj">{pv.email.subject}</p>
                    <iframe className="adm-cmp-frame" title="Предпросмотр письма" sandbox="" srcDoc={pv.email.html} />
                    <details className="adm-details">
                      <summary>Текстовая часть</summary>
                      <pre className="adm-log-pre adm-cmp-text">{pv.email.text}</pre>
                    </details>
                    <form className="adm-find adm-cmp-test" onSubmit={sendTest}>
                      <label className="adm-search">
                        <span className="b-sr">Адрес для тестового письма</span>
                        <input type="email" className="adm-input" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Тест — на ADMIN_EMAIL или сюда" autoComplete="off" spellCheck={false} />
                      </label>
                      <button type="submit" className="a-btn ak-btn-soft" disabled={busy !== null}>
                        {busy === "test" ? <><Spin />Отправляем…</> : <><Icon name="send" size={16} />Отправить тест</>}
                      </button>
                    </form>
                  </div>
                )}
                {pv.notification && (
                  <div className="adm-cmp-block">
                    <p className="adm-f-label">Уведомление в кабинете{pv.email ? " (аккаунтам без почты)" : ""}</p>
                    <p className="adm-cmp-subj">{pv.notification.title}</p>
                    <p className="ak-text adm-pre adm-break">{pv.notification.message}</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {stepErr && <p className="ak-err" role="alert">{stepErr}</p>}
      <div className="adm-sub-actions adm-cmp-nav">
        {step > 0 && (
          <button type="button" className="a-btn ak-btn-soft" onClick={() => { setStepErr(null); setStep(step - 1); }}>
            Назад
          </button>
        )}
        {step < 3 ? (
          <button type="button" className="a-btn a-btn-primary" onClick={next}>
            Далее
          </button>
        ) : (
          <>
            <button type="button" className="a-btn a-btn-primary" onClick={launch} disabled={busy !== null || !pv}>
              {busy === "start" ? <><Spin />Запускаем…</> : <><Icon name="send" size={16} />Запустить…</>}
            </button>
            <button type="button" className="a-btn ak-btn-soft" onClick={saveDraft} disabled={busy !== null}>
              {busy === "save" ? <><Spin />Сохраняем…</> : "Сохранить черновик"}
            </button>
          </>
        )}
        <button type="button" className="a-btn ak-btn-soft" onClick={onClose}>
          Закрыть
        </button>
      </div>
    </div>
  );
}

/* ─── Одна рассылка в списке ─────────────────────────────────────── */

function CampaignRow({ c, onChanged, onOpenDraft }: { c: CampaignV; onChanged: () => void; onOpenDraft: () => void }) {
  const confirm = useAdminConfirm();
  const toast = useAdminToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [fails, setFails] = useState<Failure[] | null>(null);
  const k = c.counts;

  const act = async (action: "start" | "pause" | "resume" | "cancel") => {
    if (action === "cancel") {
      const ok = await confirm({
        title: "Отменить рассылку?",
        text: `Неотправленные письма «${c.subject}» не уйдут. Уже сделанные начисления останутся.`,
        confirmLabel: "Отменить рассылку",
      });
      if (!ok) return;
    }
    if (action === "start") {
      setBusy("start");
      const p = await postJson<Preview>(`/api/admin/campaigns/${c.id}/preview`);
      setBusy(null);
      if (!p.ok) {
        toast(`Не посчитали: ${p.error}`, "off");
        return;
      }
      const ok = await confirm({ title: "Запустить рассылку?", text: confirmText(p.data, c.kind), confirmLabel: "Запустить", tone: p.data.grant ? "danger" : "primary" });
      if (!ok) return;
    }
    setBusy(action);
    const r = await postJson(`/api/admin/campaigns/${c.id}/${action}`);
    setBusy(null);
    if (!r.ok) {
      toast(r.error, "off");
      return;
    }
    toast({ start: "Рассылка запущена", pause: "Рассылка на паузе", resume: "Рассылка продолжена", cancel: "Рассылка отменена" }[action], action === "cancel" || action === "pause" ? "warn" : "ok");
    onChanged();
  };

  const loadFails = async () => {
    const r = await getJson<{ failures: Failure[] }>(`/api/admin/campaigns/${c.id}`);
    setFails(r.ok ? r.data.failures : []);
  };

  const pendingSkipped = Math.max(0, k.grant_pending - k.queued);
  const done = Math.max(0, k.total - k.queued - pendingSkipped);
  const p = k.total > 0 ? done / k.total : 0;
  const skipped = k.skipped_optout + k.skipped_no_consent + k.skipped_invalid + k.skipped_placeholder;
  const nums: string[] = [];
  if (c.channel !== "site") nums.push(`писем ${num(k.sent)} из ${num(k.sent + k.queued + k.failed)}`);
  if (c.channel !== "email" || k.notified > 0) nums.push(`в кабинет ${num(k.notified)}`);
  if (k.queued > 0) nums.push(`в очереди ${num(k.queued)}`);
  if (k.failed > 0) nums.push(`ошибки ${num(k.failed)}`);
  if (skipped > 0) nums.push(`без письма ${num(skipped)}`);
  if (c.grant) nums.push(`начислено ${num(k.granted)}${k.grant_pending > 0 ? `, ждут ${num(k.grant_pending)}` : ""}`);

  return (
    <li className="adm-cmp-row">
      <div className="adm-cmp-top">
        <p className="adm-cmp-title">{c.subject}</p>
        <span className="adm-tag" data-tone={STATUS[c.status].tone}>
          {STATUS[c.status].label}
        </span>
      </div>
      <p className="adm-cmp-meta">
        {KIND[c.kind]} · {CHANNEL[c.channel]} · <span className="a-num">{formatShort(c.startedAt ?? c.createdAt)}</span>
        {c.grantLabel && ` · подарок: ${c.grantLabel}`}
      </p>
      {k.total > 0 && (
        <span className="adm-meter" role="progressbar" aria-label="Прогресс рассылки" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} style={{ "--p": p } as CSSProperties}>
          <i />
        </span>
      )}
      {k.total > 0 && <p className="adm-cmp-nums a-num">{nums.join(" · ")}</p>}
      {c.estimate && c.status !== "done" && c.status !== "cancelled" && <p className="ak-fine">{c.estimate.text}</p>}
      {c.lastError && c.status !== "done" && (
        <p className="adm-note adm-break" data-tone="warn">
          {c.lastError}
        </p>
      )}
      {c.status !== "done" && c.status !== "cancelled" && (
        <div className="adm-sub-actions">
          {c.status === "draft" && (
            <>
              <button type="button" className="a-btn ak-btn-soft" onClick={onOpenDraft}>
                Открыть
              </button>
              <button type="button" className="a-btn a-btn-primary" onClick={() => act("start")} disabled={busy !== null}>
                {busy === "start" ? <><Spin />Считаем…</> : "Запустить…"}
              </button>
            </>
          )}
          {(c.status === "queued" || c.status === "sending") && (
            <button type="button" className="a-btn ak-btn-soft" onClick={() => act("pause")} disabled={busy !== null}>
              {busy === "pause" ? <><Spin />Ставим паузу…</> : <><Icon name="clock" size={16} />Пауза</>}
            </button>
          )}
          {c.status === "paused" && (
            <button type="button" className="a-btn a-btn-primary" onClick={() => act("resume")} disabled={busy !== null}>
              {busy === "resume" ? <><Spin />Продолжаем…</> : <><Icon name="refresh" size={16} />Продолжить</>}
            </button>
          )}
          <button type="button" className="a-btn ak-btn-soft" onClick={() => act("cancel")} disabled={busy !== null}>
            {busy === "cancel" ? <><Spin />Отменяем…</> : c.status === "draft" ? "Удалить" : "Отменить"}
          </button>
        </div>
      )}
      {(k.failed > 0 || k.grant_pending > 0 || !!c.lastError) && (
        <details
          className="adm-details"
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open && !fails) loadFails();
          }}
        >
          <summary>Ошибки и ожидание{k.failed > 0 ? ` (${num(k.failed)})` : ""}</summary>
          {!fails ? (
            <p className="ak-fine">Загружаем…</p>
          ) : fails.length === 0 ? (
            <p className="ak-fine">Подробностей нет.</p>
          ) : (
            <ul className="adm-cmp-fails">
              {fails.map((f) => (
                <li key={`${f.email}-${f.status}`}>
                  <b>{f.email}</b> · {f.status === "failed" ? "ошибка" : "ждёт"} · попыток {f.attempts}
                  {f.error ? ` — ${f.error}` : ""}
                </li>
              ))}
            </ul>
          )}
        </details>
      )}
    </li>
  );
}

/* ─── Уведомления «всем» старого образца (удаление) ─────────────── */

function SentNotifications({ notifications, error, onChanged }: { notifications: NotificationItem[]; error: string | null; onChanged: () => void }) {
  const confirm = useAdminConfirm();
  const toast = useAdminToast();
  const [deleting, setDeleting] = useState<string | null>(null);

  const remove = async (n: NotificationItem) => {
    const ok = await confirm({ title: "Удалить уведомление?", text: `«${n.title}» пропадёт у получателей. Вернуть его будет нельзя.`, confirmLabel: "Удалить" });
    if (!ok) return;
    setDeleting(n.id);
    const r = await getJson(`/api/admin/notifications?id=${encodeURIComponent(n.id)}`, { method: "DELETE" });
    setDeleting(null);
    if (!r.ok) {
      toast(`Не удалили: ${r.error}`, "off");
      return;
    }
    toast("Уведомление удалено");
    onChanged();
  };

  if (error) return <BlockError title="Уведомления не загрузились" text={error} />;
  if (notifications.length === 0) return null;
  return (
    <details className="adm-details">
      <summary>Уведомления в кабинете без рассылки ({notifications.length})</summary>
      <ul className="adm-sent-list">
        {notifications.map((n) => (
          <li key={n.id} className="adm-sent-row">
            <div className="adm-sent-copy">
              <p className="adm-sent-title">{n.title}</p>
              <p className="adm-sent-text">{n.message}</p>
              <p className="adm-sent-meta">
                <span className="a-num">{formatShort(n.createdAt)}</span>
                <span className="adm-tag" data-tone={n.target === "all" ? "ink" : "mute"}>
                  {n.target === "all" ? "Все" : "Один пользователь"}
                </span>
              </p>
            </div>
            <button type="button" onClick={() => remove(n)} disabled={deleting === n.id} className="ak-icon adm-del" aria-label={`Удалить уведомление «${n.title}»`}>
              {deleting === n.id ? <Spin /> : <Icon name="close" size={16} />}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
