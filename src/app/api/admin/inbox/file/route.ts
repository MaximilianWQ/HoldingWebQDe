import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "../../middleware";
import { attachmentFile, isViewableImage } from "@/lib/attachments";

/**
 * Вложение обращения: `GET /api/admin/inbox/file?id=<id вложения>`.
 * Только для администратора.
 *
 * КАРТИНКА ПОКАЗЫВАЕТСЯ, ОСТАЛЬНОЕ СКАЧИВАЕТСЯ. Владелец просил
 * видеть приложенные фотографии прямо в панели, поэтому растровые
 * изображения (`isViewableImage`) отдаются со своим типом и
 * `Content-Disposition: inline` — их показывает `<img>`.
 *
 * Всё прочее уходит как `application/octet-stream` вложением, каким
 * бы тип ни был заявлен при загрузке. Содержимое прислал посторонний
 * человек: присланный «резюме.html», открытый на нашем домене,
 * выполнился бы с сессией администратора. По той же причине в списке
 * показываемых типов нет SVG — это документ со скриптами внутри.
 *
 * `X-Content-Type-Options: nosniff` обязателен: без него браузер
 * вправе передумать насчёт типа и всё равно прочитать файл как
 * разметку.
 *
 * Имя файла уходит в `filename*` по RFC 5987 — в резюме бывает
 * кириллица, а в голом `filename=` она превращается в мусор.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 403 });
  }
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "Нужен id вложения" }, { status: 400 });
  }
  try {
    const file = await attachmentFile(id);
    if (!file) {
      return NextResponse.json({ success: false, error: "Вложение не найдено" }, { status: 404 });
    }
    const asImage = isViewableImage(file.mime);
    const name = file.filename || "file";
    return new NextResponse(new Uint8Array(file.data), {
      headers: {
        "Content-Type": asImage ? file.mime : "application/octet-stream",
        "Content-Length": String(file.data.length),
        "Content-Disposition":
          `${asImage ? "inline" : "attachment"}; filename="file"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    console.error("[ADMIN/INBOX] file error:", err);
    return NextResponse.json({ success: false, error: "Не удалось выдать файл" }, { status: 500 });
  }
}
