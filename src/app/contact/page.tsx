import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import { BRAND } from "@/components/vps/links";
import ContactView from "./ContactView";

/**
 * /contact — серверная обёртка, корпус Atlas Secure VPS (владелец,
 * 17.09.2026). Метаданные — здесь, форма и её состояние — в клиентском
 * `ContactView.tsx`.
 */
export const metadata: Metadata = {
  title: "Контакты",
  description: `Напишите ${BRAND}: выберите тему, оставьте почту — ответим письмом.`,
};

export default function ContactRoute() {
  return (
    <VShell>
      <ContactView />
    </VShell>
  );
}
