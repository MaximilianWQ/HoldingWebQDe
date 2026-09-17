import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import SubscribeView from "./SubscribeView";

/**
 * /subscribe — серверная обёртка оплаты: метаданные и оболочка VShell
 * (рабочий экран — короткий подвал, в шапке «Кабинет»). Тело с машиной
 * состояний оплаты — клиентский SubscribeView (Suspense вокруг
 * useSearchParams живёт там же). Два продукта: подписка и пакет
 * трафика (`?product=traffic&pack=…`), предвыбор тарифа и срока —
 * `?plan=basic|plus&period=1|3|6|12`.
 *
 * Страница личная (оплата под сессией, возврат из кассы с id платежа),
 * поэтому из поиска закрыта. Без сессии SubscribeView сам уводит на
 * /auth?next=<этот адрес>.
 */
export const metadata: Metadata = {
  title: "Оплата",
  description: "Оплата подписки или пакета трафика Atlas Secure.",
  robots: { index: false, follow: false },
};

export default function SubscribePage() {
  return (
    <VShell work account="member">
      <SubscribeView />
    </VShell>
  );
}
