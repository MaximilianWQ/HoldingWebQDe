import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import BusinessView from "./BusinessView";
import { dict } from "@/i18n";
import { getLocale } from "@/lib/locale-server";

/**
 * /business — серверная обёртка, корпус Atlas Secure VPS (владелец,
 * 17.09.2026). Метаданные — здесь; тело с формой — клиентское
 * (`BusinessView.tsx`).
 */
export async function generateMetadata(): Promise<Metadata> {
  const m = dict(await getLocale()).business.meta;
  return {
    // Шаблон корневого layout добавит « — Atlas Secure VPS» сам.
    title: m.title,
    description: m.description,
    keywords: [...m.keywords],
    openGraph: { title: m.ogTitle, description: m.ogDescription, type: "website" },
  };
}

export default async function BusinessPage() {
  const locale = await getLocale();
  return (
    <VShell>
      <BusinessView locale={locale} t={dict(locale).business} />
    </VShell>
  );
}
