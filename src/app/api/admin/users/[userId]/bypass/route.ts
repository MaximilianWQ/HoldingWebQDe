import { NextRequest, NextResponse } from "next/server";
import { getUserById } from "@/lib/store";
import { findBotBypass, toBypassSnapshot } from "@/lib/bypass";
import { getOwedBypassBytes, listBypassGrants, listBypassOps } from "@/lib/bypass-grants";
import { describeRwError, getUserById as rwGetUserById } from "@/lib/remnawave";
import { verifyAdmin } from "../../../middleware";

/**
 * GET /api/admin/users/{userId}/bypass — the person's bypass («Обход»):
 *   entity   fresh panel read (limit, used, remaining, status, username) or null
 *   grants   bypass_grants (trial / packs / admin), newest first
 *   ops      bypass_traffic_ops of the entity and of the grants
 *   owedBytes  granted but not yet in the panel
 * Read-only: nothing is written or remembered here.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }
  try {
    const { userId } = await params;
    const user = await getUserById(userId);
    if (!user) return NextResponse.json({ success: false, error: "Пользователь не найден" }, { status: 404 });

    let entity = null;
    let panelError: string | null = null;
    if (user.bypassPanelUserId) {
      const r = await rwGetUserById(user.bypassPanelUserId);
      if (r.ok) entity = { ...toBypassSnapshot(r.data), trafficLimitStrategy: r.data.trafficLimitStrategy, hwidDeviceLimit: r.data.hwidDeviceLimit, expireAt: r.data.expireAt, tag: r.data.tag };
      else panelError = describeRwError(r);
    } else if (user.telegramId && /^\d+$/.test(user.telegramId)) {
      const f = await findBotBypass(user.telegramId);
      if (f.ok && f.user) entity = { ...toBypassSnapshot(f.user), trafficLimitStrategy: f.user.trafficLimitStrategy, hwidDeviceLimit: f.user.hwidDeviceLimit, expireAt: f.user.expireAt, tag: f.user.tag };
      else if (!f.ok) panelError = describeRwError(f.error);
    }

    const [grants, owedBytes] = await Promise.all([listBypassGrants(userId), getOwedBypassBytes(userId)]);
    const ops = await listBypassOps(entity?.panelUserId ?? user.bypassPanelUserId, grants.map((g) => g.id));

    return NextResponse.json({
      success: true,
      data: {
        panelUserId: entity?.panelUserId ?? user.bypassPanelUserId,
        origin: user.bypassOrigin === "site" ? "site" : user.bypassPanelUserId || entity ? "bot" : null,
        entity,
        panelError,
        grants,
        ops,
        owedBytes,
      },
    });
  } catch (err) {
    console.error("[ADMIN/BYPASS] error:", err);
    return NextResponse.json({ success: false, error: "Не удалось загрузить обход" }, { status: 500 });
  }
}
