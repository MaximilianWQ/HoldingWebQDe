import { NextRequest } from "next/server";
import { parseCampaignInput } from "@/lib/campaigns";
import { errorText, fail, ok, readJson, repo, requireAdmin, viewOf } from "../shared";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET   /api/admin/campaigns/{id} — рассылка, прогресс, оценка времени и
 *       до 30 получателей с ошибкой ({ ...вид, failures }).
 * PATCH /api/admin/campaigns/{id} — правка черновика (тело как у создания);
 *       запущенную править нельзя (409).
 */
export async function GET(_request: NextRequest, { params }: Ctx) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  try {
    const { id } = await params;
    const c = await repo.get(id);
    if (!c) return fail(404, "Рассылка не найдена");
    const [view, failures] = await Promise.all([viewOf(c), repo.failures(id, 30)]);
    return ok({ ...view, failures });
  } catch (err) {
    console.error("[ADMIN/CAMPAIGNS] get:", errorText(err));
    return fail(500, "Не удалось загрузить рассылку");
  }
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  const p = parseCampaignInput(await readJson(request));
  if (!p.ok) return fail(400, p.error);
  try {
    const { id } = await params;
    const c = await repo.updateDraft(id, p.input);
    if (!c) return fail(409, "Изменить можно только черновик");
    return ok(await viewOf(c));
  } catch (err) {
    console.error("[ADMIN/CAMPAIGNS] update:", errorText(err));
    return fail(500, "Не удалось сохранить черновик");
  }
}
