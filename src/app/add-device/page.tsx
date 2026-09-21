import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import AddDeviceView from "./AddDeviceView";
import { DEVICE_LIMIT } from "@/lib/plans";
import { dict, fill } from "@/i18n";
import { count } from "@/lib/text/plural";
import { getLocale } from "@/lib/locale-server";

/**
 * /add-device — серверная обёртка мастера подключения: только
 * метаданные и оболочка (VShell, рабочий экран — короткий подвал).
 *
 * Оболочка стоит ЗДЕСЬ, а не внутри клиентского AddDeviceView
 * (21.09.2026): она определяет язык запроса и потому обязана быть
 * серверной.
 *
 * Экран личный: ключ подписки на нём свой у каждого аккаунта, поэтому
 * из поиска закрыт.
 */
export async function generateMetadata(): Promise<Metadata> {
  const d = dict(await getLocale());
  return {
    title: d.addDevice.meta.title,
    description: d.addDevice.meta.description,
    robots: { index: false, follow: false },
  };
}

export default async function AddDevicePage() {
  const locale = await getLocale();
  const d = dict(locale);
  return (
    <VShell work account="member">
      <AddDeviceView
        locale={locale}
        t={d.addDevice}
        td={d.devices}
        lead={fill(d.addDevice.lead, { devices: count(locale, DEVICE_LIMIT, d.units.device) })}
      />
    </VShell>
  );
}
