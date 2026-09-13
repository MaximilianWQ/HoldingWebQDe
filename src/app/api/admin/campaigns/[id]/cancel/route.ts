import { NextRequest } from "next/server";
import { controlCampaign } from "../control";

/**
 * POST /api/admin/campaigns/{id}/cancel — остановить навсегда. Неотправленные
 * письма не уйдут; уже сделанные начисления остаются (журнал не откатывается).
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return controlCampaign("cancel", params);
}
