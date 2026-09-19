import { pool } from "./db";
import { APPLICATION_RETENTION_MONTHS } from "./careers";

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
  auditLogs: number;
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

export async function runRetentionPass(): Promise<RetentionReport> {
  const applications = await purge(
    "отклики на вакансии",
    `DELETE FROM job_applications WHERE created_at < NOW() - INTERVAL '${APPLICATION_RETENTION_MONTHS} months'`
  );
  const auditLogs = await purge(
    "журнал администратора",
    `DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '${AUDIT_RETENTION_MONTHS} months'`
  );
  return { applications, auditLogs };
}
