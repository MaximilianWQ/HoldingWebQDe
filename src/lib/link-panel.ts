/**
 * Panel writes owed after a Telegram link or unlink.
 *
 * The link itself is a DB transaction (src/lib/telegram-link.ts); the
 * panel side is recorded on the users row (link_panel_state,
 * link_disable_ids) and carried out here, from syncUserToPanel — so a
 * panel outage never loses it: the row stays pending and the sync
 * worker retries with backoff.
 *
 *   pending         → on the kept entity: email (verified addresses
 *                     only), telegramId, description markers
 *                     `atlas-site:<user id>` and `atlas-email-verified:<ts>`
 *                     (appended, the bot's text is kept); then every id
 *                     in link_disable_ids → status DISABLED (term untouched).
 *   unlink_pending  → on the kept entity: telegramId null and marker
 *                     `atlas-unlinked:<ts>`; the key stays with the account.
 *
 * Never touched here: username, hwidDeviceLimit, externalSquadUuid,
 * squads, traffic, expireAt — and never a bypass entity.
 */

import { pool } from "./db";
import {
  describeRwError,
  getUserById as rwGetUserById,
  hasMarker,
  isBypassEntity,
  isUserGone,
  PANEL_MARKERS,
  PanelMarker,
  PanelUser,
  panelSafeEmail,
  RwError,
  updateUser,
  UpdateUserBody,
  withMarkers,
} from "./remnawave";

export interface LinkOpsRow {
  id: string;
  email: string;
  telegram_id: string | null;
  link_panel_state: string | null;
  link_disable_ids: Array<string | number> | null;
  bypass_panel_user_id: string | number | null;
}

export type LinkOpsResult = { ok: true; panel: PanelUser | null } | { ok: false; error: RwError | string };

const PLACEHOLDER_EMAIL_RE = /^telegram_\d+@tg\./i;

export function linkOpsOwed(row: { link_panel_state?: string | null }): boolean {
  return row.link_panel_state === "pending" || row.link_panel_state === "unlink_pending";
}

async function disableLoser(row: LinkOpsRow, id: number, keptId: number | null): Promise<RwError | string | null> {
  if (id === keptId) return null;
  if (row.bypass_panel_user_id != null && Number(row.bypass_panel_user_id) === id) return null;
  // Another local account may have adopted it since (e.g. relinked): not ours to switch off.
  const owner = await pool.query("SELECT id FROM users WHERE id <> $2 AND (panel_user_id = $1 OR bypass_panel_user_id = $1 OR remnawave_user_uuid = $3) LIMIT 1", [
    id,
    row.id,
    String(id),
  ]);
  if (owner.rows.length > 0) {
    console.warn(`[LINK-OPS ${row.id.slice(0, 8)}] panel user ${id} now belongs to another account — not disabled`);
    return null;
  }
  const cur = await rwGetUserById(id);
  if (!cur.ok) return isUserGone(cur) ? null : cur;
  if (isBypassEntity(cur.data) || cur.data.status === "DISABLED") return null;
  const r = await updateUser({ id, status: "DISABLED" });
  if (!r.ok) return r;
  // Ответ 200 не значит, что поле применилось: панель умеет молча
  // игнорировать поля PATCH (опыт 22.09.2026, `docs/bot/
  // TZ_BYPASS_MERGE.md` §11а.1). Не погашенный проигравший ключ — это
  // ДВА живых ключа у одного человека, то самое «один человек, один
  // ключ», ради которого вся связка и затеяна.
  //
  // Проверяем ПЕРЕЧИТЫВАНИЕМ, а не телом ответа: опыт доказал поведение
  // одного поля, и переносить его на все — та самая ошибка, против
  // которой написано правило 5.
  const back = await rwGetUserById(id);
  if (!back.ok) return isUserGone(back) ? null : back;
  if (back.data.status !== "DISABLED") {
    console.error(`[LINK-OPS ${row.id.slice(0, 8)}] panel kept ${id} in ${back.data.status} — NOT disabled`);
    return {
      ok: false,
      kind: "conflict",
      status: 409,
      errorCode: "PANEL_IGNORED_DISABLE",
      message: `panel kept ${id} in ${back.data.status}`,
      method: "PATCH",
      path: "/api/users",
    } as RwError;
  }
  console.log(`[LINK-OPS ${row.id.slice(0, 8)}] panel user ${id} (${cur.data.username}) DISABLED — one key per person`);
  return null;
}

export async function applyLinkPanelOps(row: LinkOpsRow, panel: PanelUser | null): Promise<LinkOpsResult> {
  const state = row.link_panel_state;
  if (!linkOpsOwed(row)) return { ok: true, panel };
  const nowIso = new Date().toISOString();
  let kept = panel;

  if (kept && isBypassEntity(kept)) return { ok: false, error: `panel user ${kept.id} is a bypass entity — refusing to treat it as the key` };

  if (kept && state === "pending") {
    const email = PLACEHOLDER_EMAIL_RE.test(row.email) ? null : panelSafeEmail(row.email);
    const set: Partial<Record<PanelMarker, string | null>> = { [PANEL_MARKERS.site]: row.id, [PANEL_MARKERS.unlinked]: null };
    if (email && !hasMarker(kept.description, PANEL_MARKERS.emailVerified)) set[PANEL_MARKERS.emailVerified] = nowIso;
    const description = withMarkers(kept.description, set);
    const tg = row.telegram_id && /^\d{1,20}$/.test(row.telegram_id) ? Number(row.telegram_id) : null;
    const patch: UpdateUserBody = { id: kept.id };
    if (description !== (kept.description ?? "")) patch.description = description;
    if (email && (kept.email || "").toLowerCase() !== email) patch.email = email;
    if (tg !== null && kept.telegramId !== tg) patch.telegramId = tg;
    if (Object.keys(patch).length > 1) {
      const r = await updateUser(patch);
      if (!r.ok) return { ok: false, error: r };
      kept = r.data;
    }
  }
  if (kept && state === "unlink_pending") {
    const description = withMarkers(kept.description, { [PANEL_MARKERS.unlinked]: nowIso });
    const patch: UpdateUserBody = { id: kept.id, description };
    if (kept.telegramId !== null) patch.telegramId = null;
    const r = await updateUser(patch);
    if (!r.ok) return { ok: false, error: r };
    kept = r.data;
  }

  for (const raw of row.link_disable_ids ?? []) {
    const id = Number(raw);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    const err = await disableLoser(row, id, kept?.id ?? null);
    if (err) return { ok: false, error: typeof err === "string" ? err : err };
  }

  await pool.query("UPDATE users SET link_panel_state = 'ok', link_disable_ids = NULL WHERE id = $1 AND link_panel_state = $2", [row.id, state]);
  return { ok: true, panel: kept };
}

export function describeLinkOpsError(e: RwError | string): string {
  return typeof e === "string" ? e : describeRwError(e);
}
