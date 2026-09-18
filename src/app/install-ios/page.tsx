import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import InstallIosView from "./InstallIosView";
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
export const metadata: Metadata = {
  title: "Atlas на iPhone",
  description: "Как добавить кабинет Atlas на экран «Домой» iPhone и iPad — пять касаний в Safari.",
  alternates: { canonical: "/install-ios" },
};

export default function InstallIosPage() {
  return (
    <VShell work account="member">
      <InstallIosView />
    </VShell>
  );
}
