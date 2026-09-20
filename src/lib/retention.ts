import { pool } from "./db";
import { APPLICATION_RETENTION_MONTHS } from "./careers";
import { expirePendingPayments } from "./store";
import { deleteExpiredSessions } from "./session-store";
import { deleteOldTelegramNonces } from "./telegram-login";

/**
 * Уборщик по срокам хранения.
 *
 * ПОЧЕМУ ПОЯВИЛСЯ. Политика конфиденциальности называет сроки
 * («журнал событий — не дольше 12 месяцев», «резюме — не дольше 6
 * месяцев»), а в коде их никто не соблюдал: записи не удалялись
 * никогда. Названный и не соблюдаемый срок хуже, чем неназванный, —
 * это уже не обещание, а неправда в документе, который мы сами
 * опубликовали.
 *
 * ПОЧЕМУ УДАЛЯЕТ, А НЕ ПОМЕЧАЕТ. Срок хранения — это про то, что
 * данных больше нет. Флаг «удалено» рядом с сохранённым файлом резюме
 * ничего не меняет ни для человека, ни для проверяющего.
 *
 * Проход идёт раз в сутки под замком CRON_CLEANUP: инстансов на
 * Railway может быть несколько, и два одновременных удаления не нужны.
 * Каждая таблица чистится отдельно — падение одной не мешает другой.
 */
export interface RetentionReport {
  applications: number;
  /** Заявки на пропуск в офис. */
  passRequests: number;
  auditLogs: number;
  /** Зависшие неоплаченные платежи, помеченные просроченными. */
  expiredPayments: number;
  /** Мёртвые сессии и ключи входа через Telegram. */
  deletedSessions: number;
  deletedNonces: number;
}

/** Журнал действий администратора. Срок назван в Политике, п. 3.2. */
const AUDIT_RETENTION_MONTHS = 12;

async function purge(label: string, sql: string): Promise<number> {
  try {
    const r = await pool.query(sql);
    const n = r.rowCount ?? 0;
    if (n > 0) console.log(`[RETENTION] ${label}: удалено ${n}`);
    return n;
  } catch (err) {
    console.error(`[RETENTION] ${label} error:`, err instanceof Error ? err.message : err);
    return 0;
  }
}

/**
 * Уборка, которая раньше висела на внешнем cron (20.09.2026).
 *
 * `/api/cron/cleanup-expired` правильно отказывается работать без
 * `CRON_SECRET`, а секрет не задан — значит уборка не делалась вовсе:
 * зависшие платежи оставались «в ожидании», мёртвые сессии и ключи
 * входа копились. Подписки от этого не страдали (панель истекает сама,
 * сверку крутит воркер), но мусор рос.
 *
 * Переносим внутрь: уборщик уже ходит раз в сутки под замком, а внешний
 * вызов — это секрет, который можно потерять, и ещё одна движущаяся
 * часть. Маршрут остаётся для ручного запуска, но больше ни от чего не
 * зависит.
 *
 * Прохода синхронизации здесь нет намеренно: его и так делает воркер
 * каждую минуту.
 */
async function count(label: string, fn: () => Promise<number>): Promise<number> {
  try {
    const n = await fn();
    if (n > 0) console.log(`[RETENTION] ${label}: ${n}`);
    return n;
  } catch (err) {
    console.error(`[RETENTION] ${label} error:`, err instanceof Error ? err.message : err);
    return 0;
  }
}

export async function runRetentionPass(): Promise<RetentionReport> {
  const applications = await purge(
    "отклики на вакансии",
    `DELETE FROM job_applications WHERE created_at < NOW() - INTERVAL '${APPLICATION_RETENTION_MONTHS} months'`
  );
  const auditLogs = await purge(
    "журнал администратора",
    `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '${AUDIT_RETENTION_MONTHS} months'`
  );
  // Заявки на пропуск — тот же срок, что у откликов; обещан в п. 3.7 Политики.
  const passRequests = await purge(
    "заявки на пропуск",
    `DELETE FROM office_pass_requests WHERE created_at < NOW() - INTERVAL '${APPLICATION_RETENTION_MONTHS} months'`
  );
  const expiredPayments = await count("зависшие платежи", expirePendingPayments);
  const deletedSessions = await count("мёртвые сессии", deleteExpiredSessions);
  const deletedNonces = await count("ключи входа через Telegram", deleteOldTelegramNonces);
  return { applications, passRequests, auditLogs, expiredPayments, deletedSessions, deletedNonces };
}
