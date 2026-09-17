import { NextRequest, NextResponse } from "next/server";
import { getUserByTelegramId, createAuditLog, getUnsyncedCashback, claimCashbackForBot, peekCashbackForBot, ackCashbackForBot } from "@/lib/store";
import { verifyBotApiKey, unauthorizedResponse } from "../auth";
import { botSyncDisabledResponse } from "../sync-guard";

/**
 * POST /api/bot/sync-balance
 *
 * Syncs balance from bot to site.
 * Bot is the authoritative source for balance.
 *
 * Flow:
 * 1. Bot sends its current balance
 * 2. Site checks for unsynced cashback (credited on site, not yet in bot)
 * 3. correctBalance = botBalance + unsyncedCashbackTotal
 * 4. Site updates local balance to correctBalance
 * 5. Marks cashback transactions as synced
 * 6. Returns pendingCashback for bot to incorporate
 *
 * Body: {
 *   telegramId: string,
 *   balance: number,  // kopecks — bot's current balance
 * }
 *
 * Response includes pendingCashback array — bot MUST add these
 * to its own balance and call sync-balance again with the updated total.
 */
export async function POST(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();
  const disabled = await botSyncDisabledResponse();
  if (disabled) return disabled;

  try {
    const body = await request.json();
    const { telegramId, balance } = body;

    // Фаза 2 двухфазного обмена: бот подтверждает зачисленные записи.
    // { telegramId, ack: ["tx-id", …] } — баланс не нужен.
    if (telegramId && Array.isArray(body.ack)) {
      const ids = body.ack.filter((x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 64).slice(0, 500);
      const u = await getUserByTelegramId(String(telegramId));
      if (!u) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
      const acked = await ackCashbackForBot(u.id, ids);
      return NextResponse.json({ success: true, data: { userId: u.id, acked, ackedCount: acked.length } });
    }

    if (!telegramId || typeof balance !== "number") {
      return NextResponse.json(
        { success: false, error: "telegramId and balance (kopecks) required" },
        { status: 400 }
      );
    }

    const user = await getUserByTelegramId(String(telegramId));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const botBalance = Math.max(0, Math.round(balance));

    // Забрать неотданный кешбэк и выставить баланс — атомарно: одну запись
    // кешбэка получает ровно один вызов, даже если бот повторил запрос
    // (claimCashbackForBot в store.ts).
    const oldBalance = user.balance;
    // twoPhase: true — записи не помечаются отданными до ack (рекомендуемый
    // режим, ТЗ для бота v2). Без флага — прежний контракт: записи забираются
    // сразу, атомарно (ровно один вызов получает каждую).
    const twoPhase = body.twoPhase === true;
    const { claimed: unsyncedTx, balance: correctBalance } = twoPhase
      ? await peekCashbackForBot(user.id, botBalance).then((r) => ({ claimed: r.pending, balance: r.balance }))
      : await claimCashbackForBot(user.id, botBalance);
    const unsyncedTotal = unsyncedTx.reduce((sum, tx) => sum + tx.amount, 0);

    if (unsyncedTx.length > 0) {
      await createAuditLog(
        "sync.balance",
        `Bot→Site: bot=${botBalance}, unsynced_cashback=${unsyncedTotal}, result=${correctBalance} (${unsyncedTx.length} tx synced)`,
        user.id,
        user.email
      );
      console.log(`[SYNC] Balance for ${user.email}: bot=${botBalance} + cashback=${unsyncedTotal} = ${correctBalance} (${unsyncedTx.length} tx)`);
    } else if (oldBalance !== correctBalance) {
      await createAuditLog(
        "sync.balance",
        `Bot→Site: balance ${oldBalance}→${correctBalance}`,
        user.id,
        user.email
      );
      console.log(`[SYNC] Balance for ${user.email}: ${oldBalance}→${correctBalance}`);
    }

    // Build pending cashback response for bot
    const pendingCashback = unsyncedTx.map((tx) => ({
      id: tx.id,
      amount: tx.amount,
      amountRubles: tx.amount / 100,
      description: tx.description,
      relatedUserId: tx.relatedUserId,
      createdAt: tx.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        balance: correctBalance,
        balanceRubles: correctBalance / 100,
        previousBalance: oldBalance,
        pendingCashback,
        pendingCashbackTotal: unsyncedTotal,
        pendingCashbackTotalRubles: unsyncedTotal / 100,
        twoPhase,
      },
    });
  } catch (err) {
    console.error("[SYNC] Balance error:", err);
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/bot/sync-balance?telegram_id=XXX
 *
 * Returns current site balance + any pending unsynced cashback.
 */
export async function GET(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();

  try {
    const telegramId = request.nextUrl.searchParams.get("telegram_id")
      || request.nextUrl.searchParams.get("telegramId");

    if (!telegramId) {
      return NextResponse.json(
        { success: false, error: "telegram_id required" },
        { status: 400 }
      );
    }

    const user = await getUserByTelegramId(telegramId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    const unsyncedTx = await getUnsyncedCashback(user.id);
    const unsyncedTotal = unsyncedTx.reduce((sum, tx) => sum + tx.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        balance: user.balance,
        balanceRubles: user.balance / 100,
        pendingCashbackCount: unsyncedTx.length,
        pendingCashbackTotal: unsyncedTotal,
        pendingCashbackTotalRubles: unsyncedTotal / 100,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal error" },
      { status: 500 }
    );
  }
}
