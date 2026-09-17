import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import DashboardView from "./DashboardView";

/**
 * /dashboard — серверная обёртка кабинета: метаданные и оболочка
 * корпуса Atlas Secure VPS (`VShell`). Тело со стейтом подписки —
 * клиентский DashboardView.
 *
 * Кабинет из поиска закрыт: страница личная и без сессии уводит на вход.
 */
export const metadata: Metadata = {
  title: "Кабинет",
  description: "Подписка, ключи подключения, платежи и профиль Atlas Secure VPS.",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return (
    <VShell work account="member">
      <DashboardView />
    </VShell>
  );
}
