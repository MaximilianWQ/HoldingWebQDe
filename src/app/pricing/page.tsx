import type { Metadata } from "next";
import PricingView, { PRICING_FAQ } from "./PricingView";
import { DEVICE_LIMIT, PLANS, formatRub } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { COUNTRY_COUNT } from "@/lib/locations";

/**
 * /pricing — серверная обёртка: метаданные страницы.
 *
 * Числа в описании берутся из кода, а не пишутся руками: иначе
 * поисковая выдача обещает одну цену, а касса берёт другую.
 *
 * Оболочка корпуса Atlas Secure VPS (шапка, футер) живёт в PricingView
 * (VShell) — страница простая и не требует наблюдателя движения.
 */
export const metadata: Metadata = {
  title: `Тарифы VPS-ускорителя от ${formatRub(PLANS.basic[1])} ₽ в месяц`,
  description:
    `Basic за ${formatRub(PLANS.basic[1])} ₽ и Plus за ${formatRub(PLANS.plus[1])} ₽ в месяц, за год дешевле. ` +
    `Отличаются только шириной канала: ${COUNTRY_COUNT} стран и до ${DEVICE_LIMIT} устройств есть в обоих. ` +
    `${TRIAL_DAYS} дня бесплатно без карты, без автосписаний.`,
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: `Тарифы Atlas — от ${formatRub(PLANS.basic[1])} ₽ в месяц`,
    description: `Два тарифа, отличаются только шириной канала. ${TRIAL_DAYS} дня бесплатно, без карты и без автосписаний.`,
    type: "website",
    url: "/pricing",
  },
};

/**
 * Разметка FAQPage.
 *
 * Практика 2026: ИИ-поиск отвечает пользователю напрямую, и явно
 * размеченные пары «вопрос — ответ» он извлекает и цитирует охотнее
 * всего. Вопросы берутся из того же набора, что показан на странице
 * (PRICING_FAQ), — текст в выдаче не может разойтись с текстом на сайте.
 */
const FAQ_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: PRICING_FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function PricingRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        // Содержимое собрано из константы в src/lib/faq.ts,
        // пользовательских данных в ней нет.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_LD) }}
      />
      <PricingView />
    </>
  );
}
