import webpush from "web-push";
import { pool } from "./db";
import { v4 as uuidv4 } from "uuid";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL = process.env.VAPID_EMAIL || "mailto:admin@atlassecure.uk";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/** Save a push subscription for a user */
export async function savePushSubscription(userId: string, sub: PushSubscriptionData): Promise<void> {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, keys_p256dh, keys_auth)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = $2, keys_p256dh = $4, keys_auth = $5`,
    [id, userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
  );
}

/** Remove a push subscription */
export async function removePushSubscription(endpoint: string): Promise<void> {
  await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
}

/** Send push notification to a specific user */
export async function sendPushToUser(userId: string, title: string, body: string, url?: string): Promise<number> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return 0;

  const result = await pool.query(
    "SELECT endpoint, keys_p256dh, keys_auth FROM push_subscriptions WHERE user_id = $1",
    [userId]
  );

  let sent = 0;
  for (const row of result.rows) {
    try {
      await webpush.sendNotification(
        {
          endpoint: row.endpoint,
          keys: { p256dh: row.keys_p256dh, auth: row.keys_auth },
        },
        JSON.stringify({ title, body, url: url || "/dashboard" })
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      // 410 Gone or 404 — subscription expired, remove it
      if (statusCode === 410 || statusCode === 404) {
        await removePushSubscription(row.endpoint);
      }
      console.error(`[PUSH] Failed to send to ${row.endpoint.slice(0, 40)}:`, statusCode);
    }
  }

  return sent;
}

/** Send push notification to all users */
export async function sendPushToAll(title: string, body: string, url?: string): Promise<number> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return 0;

  const result = await pool.query("SELECT DISTINCT user_id FROM push_subscriptions");
  let total = 0;
  for (const row of result.rows) {
    total += await sendPushToUser(row.user_id, title, body, url);
  }
  return total;
}

/**
 * Push администратору — и только ему.
 *
 * Владелец, 19.09.2026: «сделай push-уведомления в мини-приложении
 * iOS админу для админ-панели, только админу». Отсюда и устройство:
 * адресат ищется по `ADMIN_EMAIL`, то есть по тому же признаку, по
 * которому `verifyAdmin` пускает в админку. Списка «кому ещё слать»
 * нет намеренно — второй такой список разошёлся бы с первым.
 *
 * Молчит, а не падает: не настроены ключи VAPID, не задан
 * `ADMIN_EMAIL`, админ не подписывался — просто ноль отправок. Push —
 * удобство поверх письма и записи в базе, и ронять из-за него форму,
 * которую заполнил человек, нельзя.
 *
 * На iPhone подписка возможна только в установленном на экран
 * «Домой» приложении — это ограничение Safari, а не наше. Кнопка
 * подписки живёт в самой админке и там же об этом говорит.
 */
export async function sendPushToAdmin(title: string, body: string, url?: string): Promise<number> {
  const adminEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  if (!adminEmail) return 0;
  const r = await pool.query("SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1", [adminEmail]);
  const adminId = r.rows[0]?.id;
  if (!adminId) return 0;
  return sendPushToUser(adminId, title, body, url || "/admin");
}
