/**
 * Admin actions that change a user: grant (by preset or by days), plan
 * change without extension, HWID device removal. Route handlers stay
 * thin; validation and side effects live here so they are testable.
 */

import { v4 as uuidv4 } from "uuid";
import { applySubscriptionEvent, DAY, withTransaction } from "./subscription-ledger";
import { createAuditLog, getUserById } from "./store";
import { sendGiftGrantedEmail } from "./email";
import { DEVICE_LIMIT } from "./plans";
import { COUNTRY_COUNT } from "./locations";
import { isLocale } from "./locale";
import { deleteAllHwidDevices, deleteHwidDevice, describeRwError, HwidDevice, PANEL_ERROR } from "./remnawave";

type Fail = { ok: false; status: number; error: string };

// ─── Grant ──────────────────────────────────────────────────────

/** Preset durations in minutes (the admin card's buttons). */
export const GRANT_DURATIONS: Record<string, number> = {
  "30m": 30,
  "1h": 60,
  "12h": 720,
  "24h": 1440,
  "3d": 4320,
  "7d": 10080,
  "14d": 20160,
  "30d": 43200,
  "60d": 86400,
  "180d": 259200,
  "365d": 525600,
};

export const GRANT_MAX_DAYS = 400;
export const GRANT_PLANS = ["basic", "plus"] as const;
export const SETTABLE_PLANS = ["trial", "basic", "plus"] as const;

export interface GrantInput {
  plan?: unknown;
  duration?: unknown;
  days?: unknown;
}

/** Pure validation: returns the extension in minutes and a label, or an error. */
export function parseGrant(input: GrantInput): { ok: true; plan: string; minutes: number; label: string } | Fail {
  if (typeof input.plan !== "string" || !(GRANT_PLANS as readonly string[]).includes(input.plan)) {
    return { ok: false, status: 400, error: "Неверный тариф" };
  }
  if (input.days !== undefined && input.days !== null && input.days !== "") {
    const days = Number(input.days);
    if (!Number.isInteger(days) || days < 1 || days > GRANT_MAX_DAYS) {
      return { ok: false, status: 400, error: `Срок в днях — целое число от 1 до ${GRANT_MAX_DAYS}` };
    }
    return { ok: true, plan: input.plan, minutes: days * 24 * 60, label: `${days} дн.` };
  }
  if (typeof input.duration !== "string" || !GRANT_DURATIONS[input.duration]) {
    return { ok: false, status: 400, error: "Укажите срок: пресет или число дней" };
  }
  return { ok: true, plan: input.plan, minutes: GRANT_DURATIONS[input.duration], label: input.duration };
}

export async function adminGrant(userId: string, input: GrantInput): Promise<{ ok: true; newEnd: string; plan: string; label: string } | Fail> {
  const g = parseGrant(input);
  if (!g.ok) return g;
  const led = await withTransaction((c) =>
    applySubscriptionEvent(c, {
      userId,
      kind: "admin_grant",
      sourceId: uuidv4(),
      extendMs: g.minutes * 60 * 1000,
      plan: g.plan,
      actor: "admin",
      meta: { label: g.label, minutes: g.minutes },
    })
  );

  // Письмо о подарке (владелец, 21.09.2026). Отправка НЕ в транзакции и
  // НЕ блокирует ответ: выдача уже записана в журнал, и если почта
  // недоступна, откатывать подписку из-за письма нельзя. Сбой уходит в
  // журнал сервера — администратор видит результат выдачи сразу.
  void sendGrantEmail(userId, g.minutes).catch((err) =>
    console.warn("[ADMIN] gift email failed:", err instanceof Error ? err.message : err)
  );

  return { ok: true, newEnd: led.newEnd.toISOString(), plan: g.plan, label: g.label };
}

/**
 * Письмо о выданной подписке. Вынесено отдельно, потому что у выдачи и
 * у письма разные требования: выдача обязана быть атомарной, письмо —
 * не обязано уйти вовсе.
 *
 * Аккаунты бота (`telegram_<id>@tg.…`) письма не получают: адрес у них
 * служебный и почтового ящика за ним нет. Им приходит уведомление в
 * самом боте — тем же путём, что и всё остальное.
 */
async function sendGrantEmail(userId: string, minutes: number): Promise<void> {
  const user = await getUserById(userId);
  if (!user) return;
  if (/@tg\./i.test(user.email)) return;

  const baseUrl = (process.env.SITE_BASE_URL || "https://qodev.dev").replace(/\/+$/, "");
  await sendGiftGrantedEmail({
    email: user.email,
    minutes,
    until: new Date(user.subscriptionEnd),
    dashboardUrl: `${baseUrl}/dashboard`,
    // Язык тот, на котором человек зарегистрировался. NULL у всех, кто
    // завёлся до английской версии, — для них русский.
    locale: isLocale(user.locale) ? user.locale : "ru",
    devices: DEVICE_LIMIT,
    countries: COUNTRY_COUNT,
  });
}

// ─── Plan change without extension ──────────────────────────────

export async function adminSetPlan(
  userId: string,
  plan: unknown
): Promise<{ ok: true; changed: boolean; plan: string; subscriptionEnd: string } | Fail> {
  if (typeof plan !== "string" || !(SETTABLE_PLANS as readonly string[]).includes(plan)) {
    return { ok: false, status: 400, error: "Тариф: trial, basic или plus" };
  }
  const user = await getUserById(userId);
  if (!user) return { ok: false, status: 404, error: "Пользователь не найден" };
  if (user.subscriptionPlan === plan) {
    return { ok: true, changed: false, plan, subscriptionEnd: user.subscriptionEnd };
  }
  const led = await withTransaction((c) =>
    applySubscriptionEvent(c, {
      userId,
      kind: "admin_set_plan",
      sourceId: uuidv4(),
      plan,
      actor: "admin",
      meta: { from: user.subscriptionPlan, to: plan },
    })
  );
  return { ok: true, changed: true, plan, subscriptionEnd: led.newEnd.toISOString() };
}

// ─── HWID devices ───────────────────────────────────────────────

export type DeviceTarget = { hwid: string } | { all: true };

export function parseDeviceTarget(body: unknown): DeviceTarget | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (b.all === true) return { all: true };
  if (typeof b.hwid === "string" && b.hwid.trim().length > 0 && b.hwid.length <= 200) return { hwid: b.hwid.trim() };
  return null;
}

export async function removeUserDevices(
  userId: string,
  target: DeviceTarget
): Promise<{ ok: true; data: { panelUserId: number; total: number; devices: HwidDevice[]; removed: "one" | "all" } } | Fail> {
  const user = await getUserById(userId);
  if (!user) return { ok: false, status: 404, error: "Пользователь не найден" };
  if (!user.panelUserId) return { ok: false, status: 409, error: "У пользователя нет записи в панели" };

  const r = "all" in target ? await deleteAllHwidDevices(user.panelUserId) : await deleteHwidDevice(user.panelUserId, target.hwid);
  if (!r.ok) {
    if (r.errorCode === PANEL_ERROR.HWID_DEVICE_NOT_FOUND) return { ok: false, status: 404, error: "Устройство не найдено" };
    return { ok: false, status: 502, error: `Панель не ответила: ${describeRwError(r)}` };
  }

  await createAuditLog(
    "all" in target ? "admin.devices_delete_all" : "admin.device_delete",
    "all" in target ? "Удалены все устройства" : `Удалено устройство ${target.hwid}`,
    user.id,
    user.email
  );
  return { ok: true, data: { panelUserId: user.panelUserId, total: r.data.total, devices: r.data.devices, removed: "all" in target ? "all" : "one" } };
}

export const DAY_MS = DAY;
