import { NextRequest } from "next/server";
import {
  dailyLimit,
  startCampaign,
  GRANT_MAX_DAYS,
  GRANT_MAX_GB,
  GRANT_PLANS,
  LIST_MAX,
  type Audience,
  type CampaignInput,
  type GrantPlan,
} from "@/lib/campaigns";
import { kickCampaigns } from "@/lib/campaigns-pg";
import { USER_FILTERS, USER_FILTER_ALIASES, type UserFilter } from "@/lib/admin-users";
import { PLAN_TITLES } from "@/lib/campaign-email";
import { createAuditLog } from "@/lib/store";
import { errorText, fail, ok, readJson, repo, requireAdmin, viewOf } from "../../campaigns/shared";

/**
 * POST /api/admin/users/bulk-grant — массовая выдача подписки из раздела
 * «Пользователи».
 *
 * Тело: {
 *   selection: { type: 'ids', ids: string[] } | { type: 'filter', filter, q },
 *   plan: 'trial' | 'basic' | 'plus', days: number, trafficGb?: number
 * }
 *
 * ПОЧЕМУ ЧЕРЕЗ РАССЫЛКУ, А НЕ ЦИКЛОМ ПО adminGrant. Массовая выдача —
 * это ровно то, что уже умеет движок кампаний: он фиксирует список
 * получателей в момент запуска, начисляет идемпотентно
 * (`campaign:<id>:user:<userId>` — повтор не удвоит дни), сам
 * докладывает ГБ при недоступной панели, шлёт письма пачками по 100 и
 * держится суточной квоты Resend. Цикл в обработчике всего этого не
 * умеет и на пятистах людях упёрся бы в таймаут запроса.
 *
 * Письмо — утверждённый владельцем макет подарка (`template: 'gift'`),
 * тот же, что уходит при выдаче одному человеку из карточки. Тема и
 * тело кампании нужны только для уведомления в кабинете и для списка
 * рассылок: сам текст письма собирается из срока и языка получателя.
 */
export async function POST(request: NextRequest) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;

  const body = await readJson(request);
  if (!body) return fail(400, "Пустой запрос");

  const g = parseGrant(body);
  if (!g.ok) return fail(400, g.error);

  const sel = parseSelection(body.selection);
  if (!sel.ok) return fail(400, sel.error);

  const label = grantLabel(g.days, g.plan, g.trafficGb);
  const input: CampaignInput = {
    kind: "service",
    // И письмо, и строка в кабинете: аккаунты бота писем не получают,
    // и без уведомления они узнали бы о подарке только случайно.
    channel: "both",
    template: "gift",
    subject: `Подарок: ${label}`,
    bodyMd: notificationBody(g.days, g.plan, g.trafficGb),
    audience: sel.audience,
    grant: { plan: g.plan, days: g.days, trafficGb: g.trafficGb },
  };

  try {
    const draft = await repo.create(input, a.admin.email);
    const r = await startCampaign(repo, draft.id, dailyLimit());
    if (!r.ok) {
      // Черновик без получателей висел бы в списке рассылок мусором.
      await repo.transition(draft.id, ["draft"], "cancelled", { lastError: r.error });
      return fail(r.status, r.error);
    }
    const { campaign, preview } = r.data;
    await createAuditLog(
      "admin.bulk_grant",
      `${label} · получателей ${preview.grant?.recipients ?? 0}, писем ${preview.toEmail}, в кабинет ${preview.toNotify} · ${describe(sel.audience)} (${campaign.id})`,
      a.admin.userId,
      a.admin.email ?? undefined
    );
    kickCampaigns();
    return ok(await viewOf(campaign));
  } catch (err) {
    console.error("[ADMIN/USERS] bulk-grant:", errorText(err));
    return fail(500, "Не удалось запустить массовую выдачу");
  }
}

// ─── Разбор запроса ──────────────────────────────────────────────

type Fail = { ok: false; error: string };

function parseGrant(b: Record<string, unknown>): { ok: true; plan: GrantPlan; days: number; trafficGb: number | null } | Fail {
  if (typeof b.plan !== "string" || !(GRANT_PLANS as readonly string[]).includes(b.plan)) {
    return { ok: false, error: "Тариф подарка: Пробный, Basic или Plus" };
  }
  const days = Number(b.days);
  if (!Number.isInteger(days) || days < 1 || days > GRANT_MAX_DAYS) {
    return { ok: false, error: `Дни — целое число от 1 до ${GRANT_MAX_DAYS}` };
  }
  let trafficGb: number | null = null;
  if (b.trafficGb !== undefined && b.trafficGb !== null && b.trafficGb !== "") {
    const gb = Number(b.trafficGb);
    if (!Number.isInteger(gb) || gb < 1 || gb > GRANT_MAX_GB) {
      return { ok: false, error: `Трафик — целое число гигабайт от 1 до ${GRANT_MAX_GB.toLocaleString("ru-RU")}` };
    }
    trafficGb = gb;
  }
  return { ok: true, plan: b.plan as GrantPlan, days, trafficGb };
}

function parseSelection(raw: unknown): { ok: true; audience: Audience } | Fail {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Не выбраны получатели" };
  const s = raw as Record<string, unknown>;

  if (s.type === "ids") {
    const ids = Array.isArray(s.ids) ? s.ids.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
    const uniq = [...new Set(ids.map((v) => v.trim()))];
    if (uniq.length === 0) return { ok: false, error: "Не выбран ни один пользователь" };
    if (uniq.length > LIST_MAX) return { ok: false, error: `За раз — не больше ${LIST_MAX.toLocaleString("ru-RU")} человек` };
    return { ok: true, audience: { type: "list", entries: uniq } };
  }

  if (s.type === "filter") {
    const raw = typeof s.filter === "string" && s.filter.trim() !== "" ? s.filter.trim() : "all";
    const filter = USER_FILTER_ALIASES[raw] ?? raw;
    if (!(USER_FILTERS as readonly string[]).includes(filter)) return { ok: false, error: `Неизвестный фильтр «${raw}»` };
    const q = typeof s.q === "string" && s.q.trim() !== "" ? s.q.trim() : null;
    return { ok: true, audience: { type: "filter", filter: filter as UserFilter, q } };
  }

  return { ok: false, error: "Получатели: выбранные или по фильтру" };
}

// ─── Подписи ─────────────────────────────────────────────────────

const FILTER_TITLES: Record<UserFilter, string> = {
  all: "все",
  active: "с действующей подпиской",
  paid: "платившие",
  trial: "на пробном",
  expiring: "истекают на днях",
  expired: "без подписки",
  shared_ip: "общий IP",
  no_link: "без ключа",
  sync_error: "ошибка синхронизации",
};

function grantLabel(days: number, plan: GrantPlan, trafficGb: number | null): string {
  const d = `${days} дн. ${PLAN_TITLES[plan] ?? plan}`;
  return trafficGb ? `${d} + ${trafficGb} ГБ обхода` : d;
}

function describe(a: Audience): string {
  return a.type === "list" ? `выбранные (${a.entries.length})` : `фильтр «${FILTER_TITLES[a.filter]}»${a.q ? ` · поиск «${a.q}»` : ""}`;
}

/**
 * Текст строки в кабинете. В письмо он не попадает — у подарка свой
 * макет, — поэтому здесь коротко и без повторов того, что письмо уже
 * говорит крупно.
 */
function notificationBody(days: number, plan: GrantPlan, trafficGb: number | null): string {
  const lines = [`Мы продлили вашу подписку на ${days} дн. (${PLAN_TITLES[plan] ?? plan}).`];
  if (trafficGb) lines.push(`Плюс ${trafficGb} ГБ на ключ обхода.`);
  lines.push("Ключ уже готов — откройте кабинет и вставьте его в приложение.");
  return lines.join("\n\n");
}
