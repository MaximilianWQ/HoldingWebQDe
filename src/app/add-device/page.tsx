import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import AddDeviceView from "./AddDeviceView";

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
export const metadata: Metadata = {
  title: "Новое устройство",
  description: "Подключение нового устройства к подписке Atlas Secure: приложение, QR-код и ключ.",
  robots: { index: false, follow: false },
};

export default function AddDevicePage() {
  return (
    <VShell work account="member">
      <AddDeviceView />
    </VShell>
  );
}
