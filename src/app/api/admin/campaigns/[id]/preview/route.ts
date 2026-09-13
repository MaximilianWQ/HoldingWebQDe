import { NextRequest } from "next/server";
import { dailyLimit, parseCampaignInput, previewCampaign } from "@/lib/campaigns";
import { errorText, fail, ok, repo, requireAdmin } from "../../shared";

/** POST /api/admin/campaigns/{id}/preview — предпросмотр сохранённой рассылки (как /preview). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  try {
    const { id } = await params;
    const c = await repo.get(id);
    if (!c) return fail(404, "Рассылка не найдена");
    const p = parseCampaignInput(c);
    if (!p.ok) return fail(400, p.error);
    return ok(await previewCampaign(repo, p.input, { limit: dailyLimit(), excludeId: id }));
  } catch (err) {
    console.error("[ADMIN/CAMPAIGNS] preview:", errorText(err));
    return fail(500, "Не удалось посчитать аудиторию");
  }
}
