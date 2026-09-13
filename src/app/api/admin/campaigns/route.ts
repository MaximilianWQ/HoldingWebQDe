import { NextRequest } from "next/server";
import { parseCampaignInput } from "@/lib/campaigns";
import { fail, limitInfo, ok, readJson, repo, requireAdmin, viewOf, errorText } from "./shared";

/**
 * GET  /api/admin/campaigns — последние 50 рассылок с прогрессом и
 *      суточной квотой писем: { campaigns, limit: { daily, sentLast24h, available, queued } }.
 * POST /api/admin/campaigns — черновик { kind, channel, subject, bodyMd,
 *      audience: { type: 'filter', filter, q } | { type: 'list', entries | text },
 *      grant?: { plan?, days?, trafficGb? } } → вид кампании.
 */
export async function GET() {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  try {
    const list = await repo.list(50);
    const campaigns = await Promise.all(list.map((c) => viewOf(c)));
    return ok({ campaigns, limit: await limitInfo() });
  } catch (err) {
    console.error("[ADMIN/CAMPAIGNS] list:", errorText(err));
    return fail(500, "Не удалось загрузить рассылки");
  }
}

export async function POST(request: NextRequest) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  const body = await readJson(request);
  const p = parseCampaignInput(body);
  if (!p.ok) return fail(400, p.error);
  try {
    const c = await repo.create(p.input, a.admin.email);
    return ok(await viewOf(c));
  } catch (err) {
    console.error("[ADMIN/CAMPAIGNS] create:", errorText(err));
    return fail(500, "Не удалось сохранить черновик");
  }
}
