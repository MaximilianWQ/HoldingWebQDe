import { NextRequest } from "next/server";
import { parseCampaignInput } from "@/lib/campaigns";
import { handleTestSend } from "./handle";
import { fail, readJson, requireAdmin } from "../shared";

/**
 * POST /api/admin/campaigns/test — тестовое письмо по несохранённому
 * черновику: { ...черновик, to? } (пусто — на ADMIN_EMAIL). Кампания не
 * создаётся, в очередь и суточный счётчик рассылок письмо не попадает.
 * Не чаще 10 писем в час.
 */
export async function POST(request: NextRequest) {
  const a = await requireAdmin();
  if (!a.ok) return a.res;
  const body = await readJson(request);
  const p = parseCampaignInput(body);
  if (!p.ok) return fail(400, p.error);
  return handleTestSend(a.admin, p.input, body?.to);
}
