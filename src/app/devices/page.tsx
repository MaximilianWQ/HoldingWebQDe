import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import DevicesView from "./DevicesView";
import { DEVICE_LIMIT } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";
import { getSessionUser } from "@/lib/session";

/**
 * /devices — серверная обёртка.
 *
 * Нужна ради двух вещей. Первая: собственные метаданные — до этого
 * страница отдавалась поиску под общим заголовком сайта. Вторая: факт
 * наличия сессии. Куку сессии нельзя прочитать из браузера (она
 * httpOnly), поэтому клиент спрашивал подписку у всех подряд и
 * получал 401 — обработанный, но всё равно записанный браузером в
 * консоль как ошибка на каждом открытии страницы гостем.
 *
 * Оболочка (VShell) стоит ЗДЕСЬ, а не внутри клиентского DevicesView
 * (21.09.2026): она определяет язык запроса, то есть обязана быть
 * серверной, а клиентский компонент серверный внутри себя отрисовать
 * не может. Тот же порядок на /contact, /business и /subscribe.
 */
export const metadata: Metadata = {
  title: "Как подключить на iPhone, Android, Windows, Mac и ТВ",
  description:
    `Настройка за минуту на iPhone, iPad, Android, Mac, Windows и Android TV. Приложение бесплатное, ключ добавляется одной кнопкой или по QR-коду. ` +
    `Одна подписка — до ${DEVICE_LIMIT} устройств, ${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])} бесплатно.`,
};

export default async function DevicesRoute() {
  const hasSession = Boolean(await getSessionUser());
  return (
    <VShell account={hasSession ? "member" : "guest"}>
      <DevicesView hasSession={hasSession} />
    </VShell>
  );
}
