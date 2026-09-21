import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import InstallIosView from "./InstallIosView";
import { dict } from "@/i18n";
import { getLocale } from "@/lib/locale-server";
import "./install-ios.css";
import "./ios-phone.css";

/**
 * /install-ios — как добавить кабинет Atlas на экран «Домой» iPhone и
 * iPad (владелец, 11.09.2026: «инструкция шаг за шагом, iPhone 17 Pro Max
 * — наш дашборд в Safari, куда нажимать, текстом рядом»; 13.09.2026:
 * «рендеры плавные, чтобы постепенно анимировалось, что делать»;
 * 17.09.2026 — переведено на корпус Atlas Secure VPS; доработка того же
 * дня — один живой телефон (сцена "tour") рядом с чек-листом шагов,
 * подсветка текущего шага в такт анимации, тело — клиентский
 * InstallIosView (метаданные остаются здесь, на сервере)).
 *
 * Сюда ведёт нижний лист из кабинета (IosInstallSheet) и подсказка
 * IosInstallBanner. Шаги — для Safari в iOS 26 («•••» → «Поделиться» →
 * «На экран «Домой»» → «Добавить»), с оговоркой для iOS 18 и раньше.
 * Страница не только для iPhone: тем, кто открыл её с компьютера или
 * Android, финальная плита честно объясняет, что пункт есть только в
 * Safari, и ведёт в кабинет / поддержку — ничего невозможного не обещаем.
 *
 * Телефон — IosPhone: корпус iPhone 17 Pro Max из Blender
 * (public/media/ios/shell.webp, design/blender/iphone_shell.py) и живой
 * экран на HTML/CSS поверх снимка кабинета (public/media/ios/dash.webp).
 */
export async function generateMetadata(): Promise<Metadata> {
  const { meta } = dict(await getLocale()).installIos;
  return { title: meta.title, description: meta.description };
}

export default async function InstallIosPage() {
  const locale = await getLocale();
  return (
    <VShell work account="member">
      <InstallIosView locale={locale} t={dict(locale).installIos} />
    </VShell>
  );
}
