import { cancelCampaign, pauseCampaign, resumeCampaign } from "@/lib/campaigns";
import { kickCampaigns } from "@/lib/campaigns-pg";
import { createAuditLog } from "@/lib/store";
import { errorText, fail, ok, repo, requireAdmin, viewOf } from "../shared";

const ACTIONS = {
  pause: { run: pauseCampaign, audit: "admin.campaign_pause", word: "на паузе" },
  resume: { run: resumeCampaign, audit: "admin.campaign_resume", word: "продолжена" },
  cancel: { run: cancelCampaign, audit: "admin.campaign_cancel", word: "отменена" },
} as const;

/** Пауза / продолжение / отмена: условный переход статуса (гонка с воркером безопасна). */
export async function controlCampaign(action: keyof typeof ACTIONS, params: Promise<{ id: string }>) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  try {
    const { id } = await params;
    const spec = ACTIONS[action];
    const r = await spec.run(repo, id);
    if (!r.ok) return fail(r.status, r.error);
    await createAuditLog(spec.audit, `«${r.data.subject.slice(0, 80)}» ${spec.word} (${id})`, a.admin.userId, a.admin.email ?? undefined);
    if (action === "resume") kickCampaigns();
    return ok(await viewOf(r.data));
  } catch (err) {
    console.error(`[ADMIN/CAMPAIGNS] ${action}:`, errorText(err));
    return fail(500, "Не удалось изменить рассылку");
  }
}
