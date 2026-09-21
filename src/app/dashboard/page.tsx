import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import DashboardView from "./DashboardView";
import { dict } from "@/i18n";
import { getLocale } from "@/lib/locale-server";

/**
 * /dashboard — серверная обёртка кабинета: метаданные и оболочка
 * корпуса Atlas Secure VPS (`VShell`). Тело со стейтом подписки —
 * клиентский DashboardView.
 *
 * Кабинет из поиска закрыт: страница личная и без сессии уводит на вход.
 *
 * Подписи отдаются пропсами: экран клиентский, и импортируй он словарь
 * сам — в браузер уехали бы оба языка целиком (21.09.2026).
 */
export async function generateMetadata(): Promise<Metadata> {
  const { meta } = dict(await getLocale()).cabinet;
  return { title: meta.title, description: meta.description, robots: { index: false, follow: false } };
}

export default async function DashboardPage() {
  const locale = await getLocale();
  const d = dict(locale);
  return (
    <VShell work account="member">
      <DashboardView locale={locale} cards={d.cards} units={d.units} t={d.cabinet} />
    </VShell>
  );
}
