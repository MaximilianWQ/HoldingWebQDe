/**
 * PNG из Blender → WebP с прозрачностью для сайта.
 *
 * Запуск:  node design/blender/rack_post.mjs <каталог с PNG> [версия]
 *
 * ПОЧЕМУ УМЕНЬШАЕМ ЗДЕСЬ, А НЕ ВТОРЫМ ПРОГОНОМ BLENDER. У прозрачного
 * кадра наивное уменьшение темнит край — замер даёт до −14,5 из 255 на
 * кромке, и объект получает грязную каёмку. Причина в том, что цвет
 * складывают, не взвесив на альфу. sharp взвешивает (premultiply) сам,
 * поэтому уменьшение безопасно и второй прогон рендера не нужен.
 *
 * КАЧЕСТВО 90, А НЕ 80. У WebP свой пол сглаживания около 0,22 из 255:
 * всё, что слабее ~0,5, из файла исчезает бесследно. Зерно на корпусе
 * рассчитано так, чтобы дожить до браузера, и при 80 оно бы умерло —
 * ровно то, за что мы платили временем счёта.
 *
 * ВЕРСИЯ В ИМЕНИ ФАЙЛА обязательна: /media отдаётся с max-age на
 * неделю, а файлы в public не хешируются. Перерисовали модуль — подняли
 * версию, иначе неделю будет висеть старый кадр.
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import sharp from "sharp";

const src = process.argv[2];
const ver = process.argv[3] || "v1";
const dst = join(process.cwd(), "public", "media", "rack");

if (!src) {
  console.error("нужен каталог с PNG");
  process.exit(1);
}

await mkdir(dst, { recursive: true });

const names = (await readdir(src)).filter((f) => f.endsWith(".png"));
const manifest = JSON.parse(await readFile(join(src, "manifest.json"), "utf8"));
const byId = new Map(manifest.modules.map((m) => [m.id, m]));

let total = 0;
for (const name of names.sort()) {
  const id = basename(name, ".png");
  if (!byId.has(id)) continue;
  const meta = byId.get(id);
  const input = join(src, name);
  const out = [];
  for (const w of [meta.w, Math.round(meta.w / 2)]) {
    const file = `${id}.${ver}-${w}.webp`;
    const buf = await sharp(input)
      .resize({ width: w, fit: "fill" })
      .webp({ quality: 90, alphaQuality: 100, effort: 6 })
      .toBuffer();
    await writeFile(join(dst, file), buf);
    out.push({ w, file, kb: +(buf.length / 1024).toFixed(1) });
    total += buf.length;
  }
  meta.files = out;
  console.log(
    `${id.padEnd(11)} ${out.map((o) => `${o.w}px ${o.kb}кб`).join("  ")}`
  );
}

manifest.version = ver;
await writeFile(join(dst, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`\nвсего ${(total / 1024).toFixed(0)} кб в ${names.length} кадрах × 2 размера`);
