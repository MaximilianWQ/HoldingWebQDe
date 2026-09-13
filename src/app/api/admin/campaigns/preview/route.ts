import { NextRequest } from "next/server";
import { dailyLimit, parseCampaignInput, previewCampaign } from "@/lib/campaigns";
import { errorText, fail, ok, readJson, repo, requireAdmin } from "../shared";

/**
 * POST /api/admin/campaigns/preview — предпросмотр несохранённого
 * черновика (то же тело, что у создания): сколько получателей, сколько
 * пропустим и почему, первые 20 адресов, письмо и уведомление как их
 * увидит первый получатель, итог начисления, оценка времени.
 */
export async function POST(request: NextRequest) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  const body = await readJson(request);
  const p = parseCampaignInput(body);
  if (!p.ok) return fail(400, p.error);
  try {
    return ok(await previewCampaign(repo, p.input, { limit: dailyLimit(), excludeId: typeof body?.id === "string" ? body.id : null }));
  } catch (err) {
    console.error("[ADMIN/CAMPAIGNS] preview:", errorText(err));
    return fail(500, "Не удалось посчитать аудиторию");
  }
}
