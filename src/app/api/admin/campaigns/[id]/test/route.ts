import { NextRequest } from "next/server";
import { parseCampaignInput } from "@/lib/campaigns";
import { handleTestSend } from "../../test/handle";
import { errorText, fail, readJson, repo, requireAdmin } from "../../shared";

/** POST /api/admin/campaigns/{id}/test — { to? } тест сохранённой рассылки (как /test). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  try {
    const { id } = await params;
    const c = await repo.get(id);
    if (!c) return fail(404, "Рассылка не найдена");
    const p = parseCampaignInput(c);
    if (!p.ok) return fail(400, p.error);
    const body = await readJson(request);
    return handleTestSend(a.admin, p.input, body?.to);
  } catch (err) {
    console.error("[ADMIN/CAMPAIGNS] test:", errorText(err));
    return fail(500, "Не удалось отправить тест");
  }
}
