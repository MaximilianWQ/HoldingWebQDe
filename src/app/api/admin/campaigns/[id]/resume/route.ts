import { NextRequest } from "next/server";
import { controlCampaign } from "../control";

/** POST /api/admin/campaigns/{id}/resume — пауза → очередь, с того же места. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return controlCampaign("resume", params);
}
