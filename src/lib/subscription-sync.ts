/**
 * Atlas Secure → Remnawave 3.4.3 synchronisation.
 *
 * Source of truth: users.subscription_end + users.subscription_plan
 * (changed only through the ledger, src/lib/subscription-ledger.ts).
 * This module makes the panel match, and nothing else:
 *
 *   live   (end > now)  → absolute PATCH {id, expireAt: end, status: ACTIVE, tag}
 *                         or create the panel user if it does not exist.
 *   expired (end ≤ now) → push NOTHING; the panel flips the user to
 *                         EXPIRED by itself within ~30 s. Only if the
 *                         panel still has the user ACTIVE with a future
 *                         expireAt (early revoke by admin/bot) do we
 *                         send status: DISABLED.
 *
 * Never: `now + 24h` grace pushes, wiping the stored link on anything
 * but a positive 404 (A025/A063), creating a panel user from a request
 * handler, or touching panel users that are not ours.
 *
 * Failures are recorded on the users row (panel_sync_state = 'error',
 * attempts, next retry with backoff) and retried by the sync worker.
 */

import { pool } from "./db";
import { withUserSyncLock } from "./locks";
import { applySubscriptionEvent, withTransaction } from "./subscription-ledger";
import { applyLinkPanelOps, describeLinkOpsError, linkOpsOwed } from "./link-panel";
import {
  buildCreateUserBody,
  createUser,
  describeRwError,
  getUserById,
  getUserByUsername,
  hasPerPlanSquads,
  isBypassEntity,
  isOurPanelUser,
  isSiteUsername,
  isUserGone,
  PanelUser,
  RwError,
  SITE_TAGS,
  squadsForPlan,
  tagForPlan,
  updateUser,
  UpdateUserBody,
} from "./remnawave";

export type SyncAction = "created" | "adopted" | "patched" | "disabled" | "noop" | "busy" | "failed";

export interface SyncResult {
  ok: boolean;
  action: SyncAction;
  reason?: string;
  panelError?: string;
  publicId: string | null;
  panelUserId: number | null;
  /** Legacy name kept for admin UI: the panel id as text. */
  uuid: string | null;
  subscriptionUrl: string | null;
  expireAt: string | null;
  panelUsername?: string | null;
}

interface SyncUserRow {
  id: string;
  email: string;
  public_id: string | null;
  panel_id: string | null;
  panel_username: string | null;
  panel_user_id: string | number | null;
  remnawave_user_uuid: string | null;
  subscription_end: Date;
  subscription_plan: string | null;
  subscription_url: string | null;
  panel_sync_attempts: number | null;
  telegram_id?: string | null;
  /** Panel expireAt as last seen/pushed by us — tells "changed elsewhere" from "we changed it". */
  panel_expire_at?: Date | string | null;
  bypass_panel_user_id?: string | number | null;
  link_panel_state?: string | null;
  link_disable_ids?: Array<string | number> | null;
}

/** Less than this left → treat as expired (the panel rejects past expireAt). */
export const MIN_REMAINING_MS = 60_000;
/** Allowed difference between local end and panel expireAt before we re-PATCH. */
const EXPIRE_EQUAL_TOLERANCE_MS = 1_000;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 60 * 60 * 1000;

function log(level: "info" | "warn" | "error", userId: string, msg: string, extra?: Record<string, unknown>) {
  const line = `[SYNC ${userId.slice(0, 8)}] ${msg}${extra ? ` ${JSON.stringify(extra)}` : ""}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

function parseId(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  if (!/^\d{1,15}$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Backoff for the n-th consecutive failure (1-based). Exported for tests. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

async function loadRow(userId: string): Promise<SyncUserRow | null> {
  const r = await pool.query<SyncUserRow>(
    `SELECT id, email, public_id, panel_id, panel_username, panel_user_id, remnawave_user_uuid,
            subscription_end, subscription_plan, subscription_url, panel_sync_attempts,
            telegram_id, panel_expire_at, bypass_panel_user_id, link_panel_state, link_disable_ids
     FROM users WHERE id = $1`,
    [userId]
  );
  return r.rows[0] ?? null;
}

async function ensurePublicId(userId: string): Promise<string | null> {
  const r = await pool.query<{ public_id: string }>(
    `UPDATE users SET public_id = 'ST' || LPAD(NEXTVAL('user_public_id_seq')::text, 8, '0')
     WHERE id = $1 AND public_id IS NULL
     RETURNING public_id`,
    [userId]
  );
  if (r.rows.length > 0) return r.rows[0].public_id;
  const again = await pool.query<{ public_id: string | null }>("SELECT public_id FROM users WHERE id = $1", [userId]);
  return again.rows[0]?.public_id ?? null;
}

async function clearPanelLink(userId: string, why: string): Promise<void> {
  await pool.query(
    `UPDATE users SET
       panel_user_id = NULL, remnawave_user_uuid = NULL, remnawave_short_uuid = NULL,
       subscription_url = NULL, happ_crypto_link = NULL, crypto_link_updated_at = NULL,
       panel_status = NULL, panel_expire_at = NULL
     WHERE id = $1`,
    [userId]
  );
  log("warn", userId, `panel link cleared: ${why}`);
}

/**
 * Store the panel snapshot. The state becomes 'ok' only if the local
 * subscription did not change while we were talking to the panel —
 * otherwise it stays 'pending' and the worker runs again.
 */
async function persistPanelUser(row: SyncUserRow, panel: PanelUser | null): Promise<void> {
  if (panel) {
    await pool.query(
      `UPDATE users SET
         panel_user_id = $2,
         remnawave_user_uuid = $3,
         remnawave_short_uuid = $4,
         subscription_url = $5,
         happ_crypto_link = NULL,
         crypto_link_updated_at = NULL,
         panel_username = $6,
         panel_status = $7,
         panel_expire_at = $8,
         panel_sync_state = CASE WHEN subscription_end = $9 AND subscription_plan IS NOT DISTINCT FROM $10 THEN 'ok' ELSE 'pending' END,
         panel_sync_attempts = 0,
         panel_sync_error = NULL,
         panel_next_sync_at = NULL,
         panel_synced_at = NOW()
       WHERE id = $1`,
      [
        row.id,
        panel.id,
        String(panel.id),
        panel.shortUuid || null,
        panel.subscriptionUrl || null,
        panel.username,
        panel.status || null,
        panel.expireAt ? new Date(panel.expireAt) : null,
        row.subscription_end,
        row.subscription_plan,
      ]
    );
  } else {
    await pool.query(
      `UPDATE users SET
         panel_sync_state = CASE WHEN subscription_end = $2 AND subscription_plan IS NOT DISTINCT FROM $3 THEN 'ok' ELSE 'pending' END,
         panel_sync_attempts = 0,
         panel_sync_error = NULL,
         panel_next_sync_at = NULL,
         panel_synced_at = NOW()
       WHERE id = $1`,
      [row.id, row.subscription_end, row.subscription_plan]
    );
  }
}

async function markFailed(row: SyncUserRow, publicId: string | null, reason: string, err?: RwError | string): Promise<SyncResult> {
  const attempts = (row.panel_sync_attempts ?? 0) + 1;
  const message = typeof err === "string" ? err : err ? describeRwError(err) : reason;
  const next = new Date(Date.now() + backoffMs(attempts));
  try {
    await pool.query(
      `UPDATE users SET panel_sync_state = 'error', panel_sync_attempts = $2, panel_sync_error = $3, panel_next_sync_at = $4
       WHERE id = $1`,
      [row.id, attempts, `${reason}: ${message}`.slice(0, 500), next]
    );
  } catch (dbErr) {
    log("error", row.id, "could not record sync failure", { error: dbErr instanceof Error ? dbErr.message : String(dbErr) });
  }
  log("error", row.id, `sync failed (${reason})`, { attempts, nextRetry: next.toISOString(), panelError: message });
  return {
    ok: false,
    action: "failed",
    reason,
    panelError: message,
    publicId,
    panelUserId: parseId(row.panel_user_id),
    uuid: row.remnawave_user_uuid,
    subscriptionUrl: row.subscription_url,
    expireAt: null,
  };
}

function okResult(action: SyncAction, publicId: string, panel: PanelUser | null): SyncResult {
  return {
    ok: true,
    action,
    publicId,
    panelUserId: panel?.id ?? null,
    uuid: panel ? String(panel.id) : null,
    subscriptionUrl: panel?.subscriptionUrl || null,
    expireAt: panel?.expireAt || null,
    panelUsername: panel?.username ?? null,
  };
}

type Discovery = { kind: "found"; user: PanelUser } | { kind: "none" } | { kind: "error"; error: RwError };

/**
 * Find an existing panel user for a local user that has no (valid)
 * stored panel id. Candidates, in order: our ST public id, the cached
 * panel username, the legacy hex panel_id. A candidate is adopted only
 * if it is provably ours.
 */
async function discover(row: SyncUserRow, publicId: string): Promise<Discovery> {
  const candidates = Array.from(new Set([publicId, row.panel_username, row.panel_id].filter((c): c is string => !!c)));
  for (const username of candidates) {
    const r = await getUserByUsername(username);
    if (r.ok) {
      const u = r.data;
      if (isBypassEntity(u) || (row.bypass_panel_user_id != null && u.id === Number(row.bypass_panel_user_id))) continue;
      const provablyOurs =
        isOurPanelUser(u) ||
        (u.description ?? "").includes(row.id) ||
        (u.email ?? "").toLowerCase() === row.email.toLowerCase();
      if (!provablyOurs) {
        log("warn", row.id, `panel user "${username}" exists but is not provably ours — not adopting`);
        continue;
      }
      return { kind: "found", user: u };
    }
    if (r.kind === "not_found" || r.kind === "validation") continue;
    return { kind: "error", error: r };
  }
  return { kind: "none" };
}

async function ownedByAnotherLocalUser(panelId: number, userId: string): Promise<string | null> {
  const r = await pool.query<{ email: string }>(
    "SELECT email FROM users WHERE (panel_user_id = $1 OR remnawave_user_uuid = $2) AND id <> $3 LIMIT 1",
    [panelId, String(panelId), userId]
  );
  return r.rows[0]?.email ?? null;
}

/**
 * A shared key: the account is linked to Telegram, or its panel user is
 * not one of our `ST…` users (the bot's premium entity kept by a link).
 */
function isLinkedRow(row: SyncUserRow, panel: PanelUser): boolean {
  return !!row.telegram_id || !isSiteUsername(panel.username);
}

/**
 * Rule "общий ключ не укорачивать" (13.09.2026). For a shared key the
 * panel may have been extended by someone else (the bot, before it
 * switched to /api/bot/extend). If the panel term is LATER than ours
 * AND differs from what we last saw there (panel_expire_at), the term
 * is pulled into our DB (ledger `panel_pull`, idempotent per panel
 * value) instead of being overwritten. If the panel still shows what
 * we last saw, the local change is deliberate (admin revoke, refund,
 * bot overwrite) and is pushed as before.
 */
async function pullLaterPanelTerm(row: SyncUserRow, panel: PanelUser, endMs: number): Promise<SyncUserRow | null> {
  const now = Date.now();
  const panelMs = Date.parse(panel.expireAt);
  const panelLive = (panel.status === "ACTIVE" || panel.status === "LIMITED") && Number.isFinite(panelMs) && panelMs - now > MIN_REMAINING_MS;
  if (!panelLive || panelMs <= endMs + EXPIRE_EQUAL_TOLERANCE_MS) return null;
  const snapMs = row.panel_expire_at ? new Date(row.panel_expire_at).getTime() : null;
  if (snapMs !== null && Number.isFinite(snapMs) && Math.abs(snapMs - panelMs) <= EXPIRE_EQUAL_TOLERANCE_MS) return null;
  const iso = new Date(panelMs).toISOString();
  const led = await withTransaction((c) =>
    applySubscriptionEvent(c, {
      userId: row.id,
      kind: "panel_pull",
      sourceId: `pull:${panel.id}:${iso}`,
      setEnd: new Date(panelMs),
      actor: "sync",
      meta: { panelUserId: panel.id, panelUsername: panel.username, localEnd: new Date(endMs).toISOString(), lastSeenPanelEnd: snapMs ? new Date(snapMs).toISOString() : null },
    })
  );
  log("info", row.id, `shared key ${panel.id}: panel term ${iso} is later than ours — pulled${led.applied ? "" : " (already recorded)"}, not shortened`);
  return loadRow(row.id);
}

async function doSync(userId: string): Promise<SyncResult> {
  let row = await loadRow(userId);
  if (!row) {
    return { ok: false, action: "failed", reason: "user_not_found", publicId: null, panelUserId: null, uuid: null, subscriptionUrl: null, expireAt: null };
  }
  const publicId = row.public_id ?? (await ensurePublicId(userId));
  if (!publicId) return markFailed(row, null, "no_public_id");

  const now = Date.now();
  let endMs = new Date(row.subscription_end).getTime();
  let live = endMs - now > MIN_REMAINING_MS;
  let plan = row.subscription_plan || "trial";
  let tag = tagForPlan(plan) ?? SITE_TAGS.trial;

  // ─── 1. Locate the panel user ───
  let panel: PanelUser | null = null;
  let adopted = false;
  const storedId = parseId(row.panel_user_id) ?? parseId(row.remnawave_user_uuid);
  if (storedId !== null) {
    const r = await getUserById(storedId);
    if (r.ok) panel = r.data;
    else if (isUserGone(r)) await clearPanelLink(userId, `panel says ${r.errorCode} for id ${storedId}`);
    else return markFailed(row, publicId, "panel_error", r);
  }
  if (!panel) {
    const d = await discover(row, publicId);
    if (d.kind === "error") return markFailed(row, publicId, "panel_error", d.error);
    if (d.kind === "found") {
      const owner = await ownedByAnotherLocalUser(d.user.id, userId);
      if (owner) return markFailed(row, publicId, "persist_conflict", `panel user ${d.user.id} is linked to ${owner}`);
      panel = d.user;
      adopted = true;
      log("info", userId, `adopted panel user ${d.user.id} (${d.user.username})`);
    }
  }

  // A bypass entity is never the key: the premium ledger must not touch it.
  if (panel && (isBypassEntity(panel) || (row.bypass_panel_user_id != null && panel.id === Number(row.bypass_panel_user_id)))) {
    return markFailed(row, publicId, "bypass_as_premium", `panel user ${panel.id} (${panel.username}) is a bypass entity — not synced as the key`);
  }

  // ─── 1b. Panel writes owed by a Telegram link/unlink (link-panel.ts) ───
  if (linkOpsOwed(row)) {
    const ops = await applyLinkPanelOps(
      { id: row.id, email: row.email, telegram_id: row.telegram_id ?? null, link_panel_state: row.link_panel_state ?? null, link_disable_ids: row.link_disable_ids ?? null, bypass_panel_user_id: row.bypass_panel_user_id ?? null },
      panel
    );
    if (!ops.ok) return markFailed(row, publicId, "link_ops_failed", describeLinkOpsError(ops.error));
    panel = ops.panel;
  }

  // ─── 1c. Shared key: pull a later panel term, never shorten it ───
  if (panel && isLinkedRow(row, panel)) {
    const pulled = await pullLaterPanelTerm(row, panel, endMs);
    if (pulled) {
      row = pulled;
      endMs = new Date(row.subscription_end).getTime();
      live = endMs - now > MIN_REMAINING_MS;
      plan = row.subscription_plan || "trial";
      tag = tagForPlan(plan) ?? SITE_TAGS.trial;
    }
  }

  // ─── 2. Expired locally: push nothing, except an early revoke ───
  if (!live) {
    if (!panel) {
      await persistPanelUser(row, null);
      return okResult("noop", publicId, null);
    }
    const panelExpMs = Date.parse(panel.expireAt);
    const panelStillActive = (panel.status === "ACTIVE" || panel.status === "LIMITED") && Number.isFinite(panelExpMs) && panelExpMs > now;
    if (panelStillActive) {
      const r = await updateUser({ id: panel.id, status: "DISABLED" });
      if (!r.ok) return markFailed(row, publicId, "disable_failed", r);
      await persistPanelUser(row, r.data);
      log("info", userId, `early revoke → panel user ${panel.id} DISABLED`);
      return okResult("disabled", publicId, r.data);
    }
    await persistPanelUser(row, panel);
    return okResult(adopted ? "adopted" : "noop", publicId, panel);
  }

  // ─── 3. Live: create if missing ───
  const expireAtIso = new Date(endMs).toISOString();
  if (!panel) {
    const body = buildCreateUserBody({
      publicId,
      email: row.email,
      userId,
      expireAt: new Date(endMs),
      plan,
      squadUuids: squadsForPlan(plan),
    });
    const r = await createUser(body);
    if (r.ok) {
      await persistPanelUser(row, r.data);
      log("info", userId, `created panel user ${r.data.id} (${r.data.username})`);
      return okResult("created", publicId, r.data);
    }
    if (r.kind !== "conflict") return markFailed(row, publicId, "create_failed", r);
    // A019: the username exists — a previous create whose answer we lost. Adopt it.
    const again = await getUserByUsername(publicId);
    if (!again.ok) return markFailed(row, publicId, "create_conflict_lookup_failed", again);
    if (!isOurPanelUser(again.data)) return markFailed(row, publicId, "create_conflict_not_ours", `username ${publicId} is taken by a non-site panel user`);
    const owner = await ownedByAnotherLocalUser(again.data.id, userId);
    if (owner) return markFailed(row, publicId, "persist_conflict", `panel user ${again.data.id} is linked to ${owner}`);
    panel = again.data;
    adopted = true;
  }

  // ─── 4. Live: absolute PATCH when anything differs ───
  const squads = squadsForPlan(plan);
  // Squads of a panel user the BOT created (kept by a link) are the bot's
  // (main squad + its externalSquadUuid): never moved. The SITE_* tag is
  // written — the bot does not use tags, and it marks the key as ours.
  const perPlan = hasPerPlanSquads() && isSiteUsername(panel.username);
  const panelSquads = panel.activeInternalSquads.map((s) => s.uuid).sort().join(",");
  const needsPatch =
    panel.status !== "ACTIVE" ||
    Math.abs(Date.parse(panel.expireAt) - endMs) > EXPIRE_EQUAL_TOLERANCE_MS ||
    panel.tag !== tag ||
    (perPlan && panelSquads !== [...squads].sort().join(","));
  if (!needsPatch) {
    await persistPanelUser(row, panel);
    return okResult(adopted ? "adopted" : "noop", publicId, panel);
  }
  const patch: UpdateUserBody = { id: panel.id, expireAt: expireAtIso, status: "ACTIVE", tag };
  if (perPlan) patch.activeInternalSquads = squads;
  const r = await updateUser(patch);
  if (!r.ok) return markFailed(row, publicId, "patch_failed", r);
  await persistPanelUser(row, r.data);
  return okResult(adopted ? "adopted" : "patched", publicId, r.data);
}

/**
 * The one function that makes the panel match the local subscription.
 * Idempotent; safe to call from anywhere. Returns action "busy" when a
 * sync for this user is already running (the state stays pending and
 * the worker retries).
 */
export async function syncUserToPanel(userId: string): Promise<SyncResult> {
  try {
    const locked = await withUserSyncLock(userId, () => doSync(userId));
    if (!locked.acquired) {
      return { ok: false, action: "busy", reason: "sync_in_progress", publicId: null, panelUserId: null, uuid: null, subscriptionUrl: null, expireAt: null };
    }
    return locked.result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("error", userId, "sync threw", { error: message });
    return { ok: false, action: "failed", reason: "exception", panelError: message, publicId: null, panelUserId: null, uuid: null, subscriptionUrl: null, expireAt: null };
  }
}

/** Fire-and-forget sync after a committed change; failures are already recorded for the worker. */
export function requestPanelSync(userId: string, context: string): void {
  syncUserToPanel(userId)
    .then((r) => {
      if (!r.ok && r.action !== "busy") console.warn(`[SYNC] ${context}: ${userId.slice(0, 8)} → ${r.reason} ${r.panelError ?? ""}`);
    })
    .catch((err) => console.error(`[SYNC] ${context}: unexpected`, err));
}

/**
 * Rotate the user's subscription link in the panel (POST
 * /actions/revoke without revokeOnlyPasswords → new shortUuid, new
 * URL, old URL and old keys stop working). Used by the admin
 * "обновить ключ" action.
 */
export async function rotatePanelSubscription(userId: string): Promise<{ ok: true; subscriptionUrl: string } | { ok: false; error: string }> {
  const row = await loadRow(userId);
  if (!row) return { ok: false, error: "user_not_found" };
  const id = parseId(row.panel_user_id) ?? parseId(row.remnawave_user_uuid);
  if (id === null) return { ok: false, error: "no_panel_user" };
  const { revokeUserSubscription } = await import("./remnawave");
  const r = await revokeUserSubscription(id);
  if (!r.ok) return { ok: false, error: describeRwError(r) };
  await persistPanelUser(row, r.data);
  log("info", userId, `subscription link rotated for panel user ${id}`);
  return { ok: true, subscriptionUrl: r.data.subscriptionUrl };
}

// Backwards-compatible names used across the codebase.
export const syncSubscriptionToPanel = syncUserToPanel;
export const syncUserToRemnawave = syncUserToPanel;
