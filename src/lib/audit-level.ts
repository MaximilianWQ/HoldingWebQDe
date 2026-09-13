/**
 * Severity of an admin-journal (audit_logs) entry, derived from its
 * action name. Stored in audit_logs.level for filtering (?level=).
 */

export type AuditLevel = "info" | "warn" | "error";
export const AUDIT_LEVELS: AuditLevel[] = ["info", "warn", "error"];

/** Actions an operator should notice even though nothing failed. */
export const WARN_ACTIONS = [
  "admin.revoke",
  "admin.regen",
  "admin.device_delete",
  "admin.devices_delete_all",
  "admin.set_plan",
  "payment.refunded",
  "payment.canceled",
  "telegram.unlink",
  "bot_sync.disabled",
  "sync.overwrite",
  "system.ghost_date_repair",
  "admin.campaign_pause",
  "admin.campaign_cancel",
];

const ERROR_RE = /fail|error/i;

export function auditLevelFor(action: string): AuditLevel {
  if (ERROR_RE.test(action)) return "error";
  if (WARN_ACTIONS.includes(action)) return "warn";
  return "info";
}

export function isAuditLevel(v: unknown): v is AuditLevel {
  return typeof v === "string" && (AUDIT_LEVELS as string[]).includes(v);
}
