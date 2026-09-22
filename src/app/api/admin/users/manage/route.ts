import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { getUserById, createNotificationForUser, createAuditLog } from "@/lib/store";
import { verifyAdmin } from "../../middleware";
import { rotatePanelSubscription, syncUserToPanel } from "@/lib/subscription-sync";
import { applySubscriptionEvent, withTransaction } from "@/lib/subscription-ledger";
import { adminGrant, adminSetPlan } from "@/lib/admin-actions";
import { adminGrantBypass } from "@/lib/bypass-grants";
import { unlinkTelegramAccount, type UnlinkKeep } from "@/lib/telegram-link";

const PLAN_NAME: Record<string, string> = { trial: "Пробный", basic: "Basic", plus: "Plus" };

function formatDuration(key: string): string {
  const map: Record<string, string> = {
    "30m": "30 минут",
    "1h": "1 час",
    "12h": "12 часов",
    "24h": "24 часа",
    "3d": "3 дня",
    "7d": "7 дней",
    "14d": "14 дней",
    "30d": "30 дней",
    "60d": "60 дней",
    "180d": "180 дней",
    "365d": "365 дней",
  };
  return map[key] || key;
}

/**
 * POST /api/admin/users/manage — { action, userId, … }
 *   grant-subscription  { plan: basic|plus, duration: preset | days: 1–400 }
 *   set-plan            { plan: trial|basic|plus } — plan change without extension
 *   revoke-subscription
 *   regen-key
 *   send-notification   { title, message }
 *   grant-traffic       { gb: 0.1–5000, requestId } — bypass GB, idempotent per requestId
 *   unlink-telegram     { keep: "site" | "bot" } — отвязка Telegram
 */
export async function POST(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }

  try {
    const { action, userId, plan, duration, days, title, message, gb, requestId, keep: rawKeep } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: "userId обязателен" }, { status: 400 });
    }
    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ success: false, error: "Пользователь не найден" }, { status: 404 });
    }

    if (action === "grant-subscription") {
      const g = await adminGrant(userId, { plan, duration, days });
      if (!g.ok) return NextResponse.json({ success: false, error: g.error }, { status: g.status });

      const sync = await syncUserToPanel(userId);
      if (!sync.ok) console.warn(`[ADMIN-GRANT] ${user.email}: panel sync deferred — ${sync.reason} ${sync.panelError ?? ""}`);

      const planLabel = PLAN_NAME[g.plan] ?? g.plan;
      const human = days ? g.label : formatDuration(g.label);
      await createNotificationForUser(userId, "Подписка активирована", `Вам выдана подписка ${planLabel} на ${human}. Приятного пользования!`);
      await createAuditLog("admin.grant", `${planLabel} на ${human}`, userId, user.email);

      return NextResponse.json({
        success: true,
        data: { newEnd: g.newEnd, plan: g.plan, panelSynced: sync.ok, panelError: sync.ok ? undefined : sync.panelError },
      });
    }

    if (action === "grant-traffic") {
      // «Начислить ГБ» обхода: запись в журнал bypass_grants (id admin:<requestId>
      // — повтор того же нажатия не начисляет второй раз) и прибавка в панели.
      const admin = auth.userId ? await getUserById(auth.userId) : null;
      const r = await adminGrantBypass(userId, { gb, requestId }, admin?.email ?? null);
      if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
      return NextResponse.json({
        success: true,
        data: {
          duplicate: r.duplicate,
          grantId: r.grantId,
          bytes: r.bytes,
          panelApplied: r.apply.ok,
          created: r.apply.created,
          panelUserId: r.apply.panelUserId,
          panelError: r.apply.ok ? undefined : r.apply.error,
        },
      });
    }

    if (action === "set-plan") {
      const r = await adminSetPlan(userId, plan);
      if (!r.ok) return NextResponse.json({ success: false, error: r.error }, { status: r.status });
      if (!r.changed) {
        return NextResponse.json({ success: true, data: { plan: r.plan, changed: false, subscriptionEnd: r.subscriptionEnd, panelSynced: true } });
      }
      const sync = await syncUserToPanel(userId);
      if (!sync.ok) console.warn(`[ADMIN-SET-PLAN] ${user.email}: panel sync deferred — ${sync.reason} ${sync.panelError ?? ""}`);
      await createAuditLog("admin.set_plan", `${PLAN_NAME[user.subscriptionPlan] ?? user.subscriptionPlan} → ${PLAN_NAME[r.plan] ?? r.plan}`, userId, user.email);
      await createNotificationForUser(userId, "Тариф изменён", `Ваш тариф теперь ${PLAN_NAME[r.plan] ?? r.plan}. Срок подписки не изменился.`);
      return NextResponse.json({
        success: true,
        data: { plan: r.plan, changed: true, subscriptionEnd: r.subscriptionEnd, panelSynced: sync.ok, panelError: sync.ok ? undefined : sync.panelError },
      });
    }

    if (action === "revoke-subscription") {
      // Local end = now through the ledger; the sync then DISABLES the
      // panel user (its expireAt is still in the future). No grace period.
      await withTransaction((c) =>
        applySubscriptionEvent(c, { userId, kind: "admin_revoke", sourceId: uuidv4(), setEnd: new Date(), plan: "trial", actor: "admin" })
      );
      const sync = await syncUserToPanel(userId);
      if (!sync.ok) console.warn(`[ADMIN-REVOKE] ${user.email}: panel disable deferred — ${sync.reason} ${sync.panelError ?? ""}`);
      await createNotificationForUser(userId, "Подписка деактивирована", "Ваша подписка была деактивирована администратором. Ключ удалён.");
      await createAuditLog("admin.revoke", `Подписка отозвана (panel: ${sync.action})`, userId, user.email);
      return NextResponse.json({ success: true, data: { panelAction: sync.action, panelSynced: sync.ok, panelError: sync.ok ? undefined : sync.panelError } });
    }

    if (action === "regen-key") {
      // New subscription link in the panel: old URL and old keys stop working.
      const r = await rotatePanelSubscription(userId);
      if (!r.ok) {
        return NextResponse.json({ success: false, error: `Не удалось обновить ключ: ${r.error}` }, { status: 502 });
      }
      await createAuditLog("admin.regen", "Ссылка подписки перевыпущена администратором", userId, user.email);
      return NextResponse.json({ success: true, data: { vpnKey: r.subscriptionUrl, subscriptionUrl: r.subscriptionUrl } });
    }

    /**
     * Отвязка Telegram — ТОЛЬКО ОТСЮДА (владелец, 22.09.2026).
     *
     * Из кабинета отвязка убрана, `/api/user/telegram-unlink` закрыт:
     * при ней гигабайты, купленные на сайте, оставались в ботовской
     * сущности и для человека пропадали, а починка упирается в
     * развилку, где платны оба пути (`docs/bot/TZ_BYPASS_MERGE.md`).
     *
     * Здесь она оставлена намеренно: админ видит и карточку человека, и
     * обе сущности, и может разобраться с гигабайтами руками. Пока
     * развилку не решили, это единственный безопасный путь.
     */
    if (action === "unlink-telegram") {
      if (rawKeep !== "site" && rawKeep !== "bot") {
        return NextResponse.json({ success: false, error: "Укажите, где остаётся подписка: site или bot" }, { status: 400 });
      }
      if (!user.telegramId && !user.telegramLinked) {
        return NextResponse.json({ success: false, error: "Telegram не привязан" }, { status: 400 });
      }
      const keep: UnlinkKeep = rawKeep;
      const r = await unlinkTelegramAccount(userId, "site", keep);
      if (!r.ok) {
        return NextResponse.json({ success: false, error: r.error }, { status: r.status === 503 ? 503 : 400 });
      }
      await createAuditLog(
        "admin.telegram_unlink",
        `TG:${r.previousTelegramId ?? "—"} отвязан администратором; подписка остаётся: ${keep === "bot" ? "у бота" : "на сайте"}. ` +
          "ГИГАБАЙТЫ ОБХОДА НЕ ПЕРЕНЕСЕНЫ — проверить вручную (TZ_BYPASS_MERGE)",
        userId,
        user.email
      );
      return NextResponse.json({ success: true, data: { unlinked: true, keep: r.keep } });
    }

    if (action === "send-notification") {
      if (!title?.trim() || !message?.trim()) {
        return NextResponse.json({ success: false, error: "Укажите заголовок и сообщение" }, { status: 400 });
      }
      await createNotificationForUser(userId, title.trim(), message.trim());
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Неизвестное действие" }, { status: 400 });
  } catch (err) {
    console.error("[ADMIN] Manage user error:", err);
    return NextResponse.json({ success: false, error: "Внутренняя ошибка" }, { status: 500 });
  }
}
