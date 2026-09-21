import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import { BRAND } from "@/components/vps/links";
import ContactView from "./ContactView";
import { dict, fill } from "@/i18n";
import { getLocale } from "@/lib/locale-server";

/**
 * /contact — серверная обёртка, корпус Atlas Secure VPS (владелец,
 * 17.09.2026). Метаданные — здесь, форма и её состояние — в клиентском
 * `ContactView.tsx`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const d = dict(await getLocale());
  return {
    title: d.contact.meta.title,
    description: fill(d.contact.meta.description, { brand: BRAND }),
  };
}

export default async function ContactRoute() {
  const locale = await getLocale();
  const d = dict(locale);
  return (
    <VShell>
      <ContactView locale={locale} t={d.contact} tp={d.pass} />
    </VShell>
  );
}
