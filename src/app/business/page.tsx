import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import BusinessView from "./BusinessView";

/**
 * /business — серверная обёртка, корпус Atlas Secure VPS (владелец,
 * 17.09.2026). Метаданные — здесь; тело с формой — клиентское
 * (`BusinessView.tsx`).
 */
export const metadata: Metadata = {
  // Шаблон корневого layout добавит « — Atlas Secure VPS» сам.
  title: "Интернет и серверы для компаний по договору",
  description:
    "Подключения для сотрудников и серверная инфраструктура по договору и безналичному расчёту. Единый счёт, управление доступами, приоритетная поддержка. Ответ на заявку — в течение 4 рабочих часов.",
  keywords: [
    "интернет для бизнеса",
    "подключение для сотрудников",
    "серверы для компании",
    "договор с юридическим лицом",
    "безналичный расчёт",
  ],
  openGraph: {
    title: "Для бизнеса — Atlas Secure VPS",
    description:
      "Подключения для команды и серверы по договору. Единый счёт, управление доступами, приоритетная поддержка. Ответ на заявку за 4 рабочих часа.",
    type: "website",
    url: "/business",
  },
};

export default function BusinessPage() {
  return (
    <VShell>
      <BusinessView />
    </VShell>
  );
}
