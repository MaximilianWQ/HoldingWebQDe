import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { verifyBotApiKey, unauthorizedResponse } from "../auth";

/**
 * GET /api/bot/linked — сверка списков связанных, а не пересказ чисел.
 *
 * ЗАЧЕМ. У бота свой список связанных, у нас свой; разойтись они могут
 * молча. Сверяли это так: один назвал своё число, второй своё, а
 * человек между ними переносил цифру руками. Это не сверка: число
 * говорит ТОЛЬКО ЧТО расхождение есть, но не КТО потерялся, а перенос
 * руками добавляет к двум источникам правды третий — память человека.
 *
 * Поэтому отдаётся СПИСОК Telegram ID, а не счётчик: бот вычитает
 * множества и сразу видит, кого именно у него нет.
 *
 * ЧТО ОТДАЁМ. Telegram ID, срок и тариф — и ничего больше. Почты,
 * ключей, платежей здесь нет: для сверки связок они не нужны, а лишнее
 * поле в ответе живёт дольше, чем причина, по которой его добавили.
 *
 * ДОСТУП — тот же ключ бота, что и у остальных `/api/bot/*`. Эти люди
 * и так его собственные: каждого он может запросить поимённо через
 * `/api/bot/status`, здесь он получает их одним запросом.
 *
 * ЧИТАЮЩИЙ МАРШРУТ: выключателем синхронизации (`sync-guard`) не
 * закрывается — сверять состояние надо в том числе тогда, когда
 * синхронизация приостановлена.
 */

/** Потолок ответа: больше — это уже выгрузка, а не сверка. */
const MAX_IDS = 5000;

export async function GET(request: NextRequest) {
  if (!verifyBotApiKey(request)) return unauthorizedResponse();

  try {
    const activeOnly = request.nextUrl.searchParams.get("all") !== "1";
    const r = await pool.query<{ telegram_id: string; subscription_end: Date; subscription_plan: string | null }>(
      `SELECT telegram_id, subscription_end, subscription_plan
         FROM users
        WHERE telegram_id IS NOT NULL
          AND ($1::bool IS NOT TRUE OR subscription_end > NOW())
        ORDER BY subscription_end DESC
        LIMIT $2`,
      [activeOnly, MAX_IDS + 1]
    );
    const rows = r.rows.slice(0, MAX_IDS);

    return NextResponse.json({
      success: true,
      data: {
        // Признак тот же, по которому мы находим человека в связке:
        // непустой telegram_id. Флаг `telegram_linked` намеренно не
        // используется — он ставится и снимается отдельно, а бот
        // считает своих именно по идентификатору.
        activeOnly,
        count: rows.length,
        truncated: r.rows.length > MAX_IDS,
        users: rows.map((x) => ({
          telegramId: String(x.telegram_id),
          subscriptionEnd: new Date(x.subscription_end).toISOString(),
          plan: x.subscription_plan || "trial",
        })),
      },
    });
  } catch (err) {
    console.error("[BOT] linked list error:", err);
    return NextResponse.json({ success: false, error: "Internal error" }, { status: 500 });
  }
}
