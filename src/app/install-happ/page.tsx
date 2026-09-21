import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import { getSessionUser } from "@/lib/session";
import InstallHappView from "./InstallHappView";
import { getLocale } from "@/lib/locale-server";
import "./install-happ.css";
import "./happ-phone.css";

/**
 * /install-happ — подключение в приложении Happ по шагам (владелец,
 * 17.09.2026: «анимированная инструкция, такая же по технике и
 * качеству, как /install-ios»).
 *
 * Серверная обёртка нужна ради двух вещей: собственные метаданные и
 * факт сессии — кука httpOnly, из браузера её не прочитать. Сессия
 * решает слова: гостю «Основной», вошедшему «Основной VPN» (витрина —
 * без «VPN», src/lib/key-names.ts). Тело — клиентский InstallHappView:
 * он держит текущий шаг тура, который показывает живой телефон.
 *
 * Телефон — HappPhone: тот же корпус iPhone 17 Pro Max из Blender, что
 * у /install-ios (public/media/ios/shell.webp), экран — HTML/CSS
 * (happ-phone.css). Сюда ведёт /devices, когда выбрано приложение Happ.
 */
export const metadata: Metadata = {
  title: "Подключение в Happ по шагам",
  description:
    "Как подключиться в приложении Happ: скопировать ссылку подписки, импортировать её из буфера обмена, выбрать страну и нажать подключение.",
};

export default async function InstallHappRoute() {
  const [member, locale] = await Promise.all([getSessionUser().then(Boolean), getLocale()]);
  return (
    <VShell account={member ? "member" : "guest"}>
      <InstallHappView aud={member ? "member" : "guest"} locale={locale} />
    </VShell>
  );
}
