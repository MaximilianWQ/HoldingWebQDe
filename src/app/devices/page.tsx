import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import DevicesView from "./DevicesView";
import { DEVICE_LIMIT } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { getSessionUser } from "@/lib/session";
import { dict, fill } from "@/i18n";
import { count } from "@/i18n/plural";
import { getLocale } from "@/lib/locale-server";

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
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const d = dict(locale);
  const vars = {
    devices: count(locale, DEVICE_LIMIT, d.units.device),
    trial: count(locale, TRIAL_DAYS, d.units.day),
  };
  return {
    title: fill(d.devices.meta.title, vars),
    description: fill(d.devices.meta.description, vars),
  };
}

export default async function DevicesRoute() {
  const [hasSession, locale] = await Promise.all([
    getSessionUser().then(Boolean),
    getLocale(),
  ]);
  return (
    <VShell account={hasSession ? "member" : "guest"}>
      <DevicesView hasSession={hasSession} locale={locale} t={dict(locale).devices} />
    </VShell>
  );
}
