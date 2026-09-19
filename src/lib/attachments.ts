import { v4 as uuidv4 } from "uuid";
import { pool } from "./db";

/**
 * Вложения форм сайта — одно место на все формы (владелец, 19.09.2026:
 * «любой файл, любую фотографию, которую прикрепляют пользователи, мы
 * должны просматривать»).
 *
 * ПОЧЕМУ ОТДЕЛЬНАЯ ТАБЛИЦА. Резюме на вакансию сначала лежало прямо в
 * `job_applications`. Как только файл понадобился второй форме, стало
 * видно устройство ошибки: у каждой следующей формы появлялась бы своя
 * колонка `BYTEA`, а админке пришлось бы знать про каждую. Здесь
 * `source` + `entity_id` указывают на запись любой формы, и админка
 * читает вложения одним запросом.
 *
 * ПОЧЕМУ В БАЗЕ, А НЕ НА ДИСКЕ. Файловая система Railway живёт до
 * следующей выкладки. Объектного хранилища у проекта нет, заводить
 * его ради нескольких резюме в месяц — лишняя зависимость и лишний
 * секрет. Размер ограничен на входе каждой формой.
 *
 * ЧТО ЗДЕСЬ НЕ ДЕЛАЕТСЯ: файл не открывается и не разбирается. Всё,
 * что мы о нём утверждаем, — имя, размер и тип, заявленный браузером.
 * Поэтому наружу он и отдаётся по правилам из `isViewableImage`.
 */
export type AttachmentSource = "career" | "contact";

export interface AttachmentInput {
  source: AttachmentSource;
  entityId: string;
  filename: string;
  mime: string;
  data: Buffer;
}

export interface AttachmentMeta {
  id: string;
  filename: string;
  mime: string;
  size: number;
  /** Можно ли показать картинкой прямо в админке. */
  image: boolean;
}

/**
 * Типы, которые админке разрешено показывать прямо на странице.
 *
 * Только растр и только точным совпадением типа. SVG в списке нет
 * намеренно: это документ со скриптами внутри, и показанный на нашем
 * домене он выполнился бы с сессией администратора. Всё остальное
 * отдаётся файлом на скачивание.
 */
const VIEWABLE_IMAGES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function isViewableImage(mime: string): boolean {
  return VIEWABLE_IMAGES.has(mime.toLowerCase().trim());
}

export async function saveAttachment(input: AttachmentInput): Promise<string> {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO form_attachments (id, source, entity_id, filename, mime, size, data)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, input.source, input.entityId, input.filename, input.mime, input.data.length, input.data]
  );
  return id;
}

/** Метаданные вложений сразу для списка записей — без содержимого файлов. */
export async function attachmentsFor(
  source: AttachmentSource,
  entityIds: string[]
): Promise<Map<string, AttachmentMeta[]>> {
  const map = new Map<string, AttachmentMeta[]>();
  if (entityIds.length === 0) return map;
  const r = await pool.query(
    `SELECT id, entity_id, filename, mime, size
       FROM form_attachments
      WHERE source = $1 AND entity_id = ANY($2::text[])
      ORDER BY created_at ASC`,
    [source, entityIds]
  );
  for (const row of r.rows) {
    const list = map.get(row.entity_id) ?? [];
    list.push({
      id: row.id,
      filename: row.filename,
      mime: row.mime,
      size: row.size,
      image: isViewableImage(row.mime),
    });
    map.set(row.entity_id, list);
  }
  return map;
}

export interface AttachmentFile {
  filename: string;
  mime: string;
  data: Buffer;
}

export async function attachmentFile(id: string): Promise<AttachmentFile | null> {
  const r = await pool.query(
    `SELECT filename, mime, data FROM form_attachments WHERE id = $1 LIMIT 1`,
    [id]
  );
  const row = r.rows[0];
  if (!row) return null;
  return { filename: row.filename, mime: row.mime, data: row.data };
}
