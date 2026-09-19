import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "../../middleware";
import { auditPanelSync, AuditReport, diffUser, emptyByProblem, fetchPanelSnapshot } from "@/lib/panel-audit";
import { syncUserToPanel } from "@/lib/subscription-sync";
import { pool } from "@/lib/db";

/**
 * POST /api/admin/remnawave/audit
 *
 * Body: { apply?: boolean, chunk?: number, offset?: number }
 *
 * Dry run: per-user diff local ↔ panel. apply=true: run syncUserToPanel
 * for broken users in chunks (create / absolute PATCH / DISABLE on early
 * revoke) and re-audit each fixed user.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAdmin();
    if (!auth.authorized) {
      return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const apply = body?.apply === true;
    const chunk = Number.isFinite(body?.chunk) && body.chunk > 0 && body.chunk <= 100 ? body.chunk : 25;
    const offset = Number.isFinite(body?.offset) && body.offset >= 0 ? body.offset : 0;

    const report: AuditReport = await auditPanelSync();
    if (!apply) {
      return NextResponse.json({ success: true, data: { ...report, hasMore: false } });
    }

    let fixed = 0;
    let fixFailed = 0;
    let brokenSeen = 0;
    let brokenProcessedInChunk = 0;
    for (const row of report.rows) {
      if (row.problems.length === 0) continue;
      const localIndex = brokenSeen;
      brokenSeen += 1;
      if (localIndex < offset) continue;
      if (brokenProcessedInChunk >= chunk) continue;
      brokenProcessedInChunk += 1;

      const syncResult = await syncUserToPanel(row.userId);
      if (!syncResult.ok) {
        row.fixApplied = false;
        row.fixError = `sync action=${syncResult.action} reason=${syncResult.reason ?? "unknown"}${syncResult.panelError ? ` panelError="${syncResult.panelError}"` : ""}`;
        fixFailed += 1;
        continue;
      }

      try {
        const fresh = await pool.query<{ subscription_end: Date; subscription_plan: string | null; panel_user_id: string | null }>(
          "SELECT subscription_end, subscription_plan, panel_user_id::text AS panel_user_id FROM users WHERE id = $1",
          [row.userId]
        );
        const nowRow = fresh.rows[0];
        if (nowRow) {
          const snap = await fetchPanelSnapshot(nowRow.panel_user_id);
          const diff = diffUser(nowRow, snap.user, snap.error);
          row.fixSummary = `after: action=${syncResult.action} expireAt=${diff.panelExpireAt ?? "—"} status=${diff.panelStatus ?? "—"} tag=${diff.panelTag ?? "—"} problems=${diff.problems.length ? diff.problems.join(",") : "none"}`;
          row.problems = diff.problems;
          row.panelUuid = nowRow.panel_user_id;
          row.panelExpireAt = diff.panelExpireAt;
          row.panelTag = diff.panelTag;
          row.panelStatus = diff.panelStatus;
          row.panelSubscriptionUrl = diff.panelSubscriptionUrl;
        }
      } catch (reErr) {
        row.fixSummary = "after: re-audit failed (см. server-side лог)";
        console.warn(`[AUDIT] re-audit threw for ${row.email}:`, reErr instanceof Error ? reErr.message : String(reErr));
      }
      row.fixApplied = true;
      fixed += 1;
    }

    const byProblem = emptyByProblem();
    let ok = 0;
    let broken = 0;
    for (const r of report.rows) {
      for (const p of r.problems) byProblem[p] += 1;
      if (r.problems.length === 0) ok += 1;
      else broken += 1;
    }

    return NextResponse.json({
      success: true,
      data: {
        scanned: report.scanned,
        ok,
        broken,
        fixed,
        fixFailed,
        byProblem,
        rows: report.rows,
        hasMore: brokenSeen > offset + brokenProcessedInChunk,
        nextOffset: offset + brokenProcessedInChunk,
      },
    });
  } catch (err) {
    // Текст исключения наружу не отдаём даже администратору: в
    // сообщении драйвера базы или панели бывают имена таблиц, части
    // запросов и адреса внутренних служб. Разбор — по журналу, там
    // ошибка целиком (аудит безопасности 19.09.2026).
    console.error("[ADMIN/AUDIT] top-level error:", err);
    return NextResponse.json(
      { success: false, error: "Внутренняя ошибка. См. server-side лог." },
      { status: 500 }
    );
  }
}
