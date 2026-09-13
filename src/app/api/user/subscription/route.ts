import { NextRequest, NextResponse } from "next/server";
import { getLoyaltyInfo } from "@/lib/store";
import { pool } from "@/lib/db";
import { clearSessionCookie, getSessionUser, refreshSessionCookie, SESSION_COOKIE } from "@/lib/session";
import { isAdminEmail } from "@/app/api/admin/middleware";
import { getOwedBypassBytes } from "@/lib/bypass-grants";

/**
 * The user's subscription for the dashboard — READ-ONLY.
 *
 * Returns the DB state plus the cached panel link and the panel sync
 * state. It never calls the panel, never creates a panel user and never
 * wipes a stored link (that used to happen on any panel hiccup and
 * produced duplicate panel users with new URLs). Creation and repair
 * are the sync worker's job; the most this handler does is flag a live
 * subscription without a link as pending for the worker.
 *
 * The dashboard loads this on every visit, so it is also where the
 * sliding session cookie is re-issued.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getSessionUser(request);
    if (!auth) {
      const response = NextResponse.json({ success: false, error: "Не авторизован" }, { status: 401 });
      // A dead cookie (revoked, expired, or an old raw-id cookie) is dropped.
      if (request.cookies.get(SESSION_COOKIE)) clearSessionCookie(response);
      return response;
    }
    const user = auth.user;

    const now = new Date();
    const end = new Date(user.subscriptionEnd);
    const msLeft = Math.max(0, end.getTime() - now.getTime());
    const totalMinutes = Math.floor(msLeft / (1000 * 60));
    const totalHours = Math.floor(totalMinutes / 60);
    const daysLeft = Math.floor(totalHours / 24);
    const hoursLeft = totalHours % 24;
    const minutesLeft = totalMinutes % 60;
    const isExpired = msLeft === 0;

    let panelSyncState = user.panelSyncState;
    if (!isExpired && !user.subscriptionUrl && panelSyncState === "ok") {
      // Live but no link and nothing queued — queue it (DB only, no panel call).
      await pool
        .query(
          "UPDATE users SET panel_sync_state = 'pending', panel_next_sync_at = NOW() WHERE id = $1 AND panel_sync_state = 'ok'",
          [user.id]
        )
        .catch((err) => console.error("[USER/SUBSCRIPTION] could not queue sync:", err));
      panelSyncState = "pending";
    }

    const subscriptionUrl = isExpired ? null : user.subscriptionUrl || null;
    const provisioningError =
      !isExpired && !user.subscriptionUrl ? (panelSyncState === "error" ? "panel_sync_error" : "panel_sync_pending") : null;

    // Key 2 (обход) — from the DB only: this handler never waits for the
    // panel (owner, 13.09.2026: the cabinet must not be slow). The live
    // remaining GB come from GET /api/user/bypass after the first render.
    // Paid / granted but not yet in the panel — the cabinet says «зачисляем».
    const bypassOwedBytes = await getOwedBypassBytes(user.id).catch(() => 0);

    const response = NextResponse.json({
      success: true,
      data: {
        email: user.email,
        daysLeft,
        hoursLeft,
        minutesLeft,
        isExpired,
        subscriptionEnd: user.subscriptionEnd,
        // `vpnKey` is the legacy name of the same panel link (Xray keys are gone).
        vpnKey: subscriptionUrl,
        xrayUuid: null,
        subToken: null,
        telegramLinked: user.telegramLinked,
        telegramLinkToken: user.telegramLinkToken,
        referralCode: user.referralCode,
        subscriptionPlan: isExpired ? "expired" : (user.subscriptionPlan || "trial"),
        referrals: user.referrals,
        paidReferrals: user.paidReferrals,
        balance: user.balance / 100,
        cashbackPercent: getLoyaltyInfo(user.paidReferrals).percent,
        loyaltyTier: getLoyaltyInfo(user.paidReferrals).tier,
        isAdmin: isAdminEmail(user.email),
        subscriptionUrl,
        // The panel (3.x) has no crypto-link endpoint; the dashboard falls back to happ://add/.
        happCryptoLink: null,
        panelId: user.panelId,
        trialUsedAt: user.trialUsedAt,
        provisioningError,
        panelSyncState,
        linkKept: user.linkKept,
        // DB snapshot of key 2: whether the entity is known and its cached
        // link. `maybe` — a linked account whose bot bypass is not known yet
        // (GET /api/user/bypass looks it up).
        bypassKey: {
          known: !!user.bypassPanelUserId,
          maybe: !user.bypassPanelUserId && !!user.telegramId,
          subscriptionUrl: user.bypassPanelUserId ? user.bypassSubscriptionUrl : null,
          origin: user.bypassPanelUserId ? (user.bypassOrigin === "site" ? "site" : "bot") : null,
        },
        bypassOwedBytes,
      },
    });
    refreshSessionCookie(response, auth);
    return response;
  } catch (err) {
    console.error("[USER/SUBSCRIPTION] error:", err);
    return NextResponse.json(
      { success: false, error: "Временная ошибка, попробуйте обновить страницу" },
      { status: 500 }
    );
  }
}
