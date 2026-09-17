import type { Metadata } from "next";
import AddDeviceView from "./AddDeviceView";

/**
 * /add-device — серверная обёртка мастера подключения: только
 * метаданные. Оболочка (VShell, рабочий экран) собирается внутри
 * клиентского AddDeviceView — корпус Atlas Secure VPS.
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
  return <AddDeviceView />;
}
