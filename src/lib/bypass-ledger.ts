/**
 * Bypass traffic ledger — rows of `bypass_grants`, the source of truth
 * for gigabytes the site owes a person («Пакеты трафика», the 500 MB
 * trial, admin grants).
 *
 * This module has no runtime imports on purpose: store.ts (trial at
 * sign-up) and payments.ts (confirmPayment) write grants inside their own
 * transactions; bypass-grants.ts applies them to the panel.
 *
 * One row per source — the id IS the idempotency key:
 *   trial:<userId>        once per account (and the trial itself is once
 *                         per person: trial_blocklist in trial.ts)
 *   payment:<paymentId>   once per payment (claimed in confirmPayment)
 *   admin:<requestId>     once per admin form submit
 */

import type { Queryable } from "./subscription-ledger";

export type GrantKind = "trial" | "payment" | "admin";
export type GrantState = "pending" | "seeding" | "applied" | "skipped" | "conflict";

export const grantId = {
  trial: (userId: string) => `trial:${userId}`,
  payment: (paymentId: string) => `payment:${paymentId}`,
  admin: (requestId: string) => `admin:${requestId}`,
} as const;

export interface GrantInput {
  id: string;
  userId: string;
  kind: GrantKind;
  bytes: number;
  packId?: string | null;
  paymentId?: string | null;
  actor?: string | null;
  note?: string | null;
}

export const INSERT_GRANT_SQL = `INSERT INTO bypass_grants (id, user_id, kind, bytes, pack_id, payment_id, actor, note)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING
     RETURNING id`;

/** Insert a grant inside the caller's transaction. false = it already existed (a repeat). */
export async function insertBypassGrant(c: Queryable, g: GrantInput): Promise<boolean> {
  if (!Number.isSafeInteger(g.bytes) || g.bytes <= 0) throw new Error(`bypass grant ${g.id}: bytes must be a positive integer (${g.bytes})`);
  const r = await c.query(INSERT_GRANT_SQL, [g.id, g.userId, g.kind, g.bytes, g.packId ?? null, g.paymentId ?? null, g.actor ?? null, g.note ?? null]);
  return r.rows.length > 0;
}
