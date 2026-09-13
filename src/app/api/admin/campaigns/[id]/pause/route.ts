import { NextRequest } from "next/server";
import { controlCampaign } from "../control";

/** POST /api/admin/campaigns/{id}/pause — очередь → пауза (текущая пачка дойдёт, следующая не начнётся). */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return controlCampaign("pause", params);
}
