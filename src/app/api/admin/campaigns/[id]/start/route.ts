import { NextRequest } from "next/server";
import { dailyLimit, startCampaign } from "@/lib/campaigns";
import { kickCampaigns } from "@/lib/campaigns-pg";
import { createAuditLog } from "@/lib/store";
import { errorText, fail, ok, repo, requireAdmin, viewOf } from "../../shared";

/**
 * POST /api/admin/campaigns/{id}/start — черновик → очередь. Получатели
 * фиксируются в этот момент (кто зарегистрируется позже, в рассылку не
 * попадёт). Начисления идут сразу, письма — под суточным лимитом.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  try {
    const { id } = await params;
    const r = await startCampaign(repo, id, dailyLimit());
    if (!r.ok) return fail(r.status, r.error);
    const { campaign, preview } = r.data;
    const grant = preview.grant ? ` · начисление ${preview.grant.label} × ${preview.grant.recipients}` : "";
    await createAuditLog(
      "admin.campaign_start",
      `«${campaign.subject.slice(0, 80)}» · ${campaign.kind === "service" ? "служебная" : "рекламная"} · писем ${preview.toEmail}, в кабинет ${preview.toNotify}${grant} (${campaign.id})`,
      a.admin.userId,
      a.admin.email ?? undefined
    );
    kickCampaigns();
    return ok(await viewOf(campaign));
  } catch (err) {
    console.error("[ADMIN/CAMPAIGNS] start:", errorText(err));
    return fail(500, "Не удалось запустить рассылку");
  }
}
