import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "../../middleware";
import { pool } from "@/lib/db";

/**
 * Резюме одного отклика: `GET /api/admin/careers/file?id=`.
 *
 * Отдельно от списка, потому что список тянется при каждом открытии
 * раздела, а файл нужен по одному и по запросу.
 *
 * Файл отдаётся ТОЛЬКО как вложение (`Content-Disposition:
 * attachment`) и с `Content-Type: application/octet-stream`, каким бы
 * ни был исходный тип. Причина: содержимое загрузил посторонний
 * человек, и браузер администратора не должен открывать его как
 * страницу — присланный «резюме.html» иначе выполнился бы на нашем
 * домене вместе с сессией админа.
 *
 * Имя файла уходит в `filename*` по RFC 5987: в резюме бывает
 * кириллица, а в голом `filename=` она превращается в мусор.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "Нужен id отклика" }, { status: 400 });
  }
  try {
    const r = await pool.query(
      `SELECT resume_name, resume_data FROM job_applications WHERE id = $1 LIMIT 1`,
      [id]
    );
    const row = r.rows[0];
    if (!row) {
      return NextResponse.json({ success: false, error: "Отклик не найден" }, { status: 404 });
    }
    const data: Buffer = row.resume_data;
    const name: string = row.resume_name || "resume";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.length),
        "Content-Disposition": `attachment; filename="resume"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[ADMIN/CAREERS] file error:", err);
    return NextResponse.json({ success: false, error: "Не удалось выдать файл" }, { status: 500 });
  }
}
