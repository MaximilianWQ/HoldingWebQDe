import type { Metadata } from "next";
import AtlasShell from "@/components/atlas/AtlasShell";
import SubscribeView from "./SubscribeView";

/**
 * /subscribe — серверная обёртка оплаты: метаданные и оболочка
 * «Атлас-издания». Тело с машиной состояний оплаты — клиентский
 * SubscribeView (Suspense вокруг useSearchParams живёт там же).
 * Два продукта: подписка и пакет трафика (`?product=traffic&pack=…`).
 *
 * Страница личная (оплата под сессией, возврат из кассы с id платежа),
 * поэтому из поиска закрыта.
 */
export const metadata: Metadata = {
  title: "Оплата",
  description: "Оплата подписки или пакета трафика Atlas Secure.",
  robots: { index: false, follow: false },
};

export default function SubscribePage() {
  return (
    <AtlasShell sheetNo="22" sheetTitle="Оплата" headCta={{ href: "/dashboard", label: "Кабинет" }} footer="compact">
      <SubscribeView />
    </AtlasShell>
  );
}
