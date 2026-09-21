import type { Metadata } from "next";
import PricingView, { PRICING_FAQ_IDS } from "./PricingView";
import { DEVICE_LIMIT, PLANS, formatRub, planContent } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { COUNTRY_COUNT } from "@/lib/locations";
import { faqByIds } from "@/lib/faq";
import { dict, fill } from "@/i18n";
import { count } from "@/lib/text/plural";
import { getLocale } from "@/lib/locale-server";

/**
 * /pricing — серверная обёртка: метаданные страницы.
 *
 * Числа в описании берутся из кода, а не пишутся руками: иначе
 * поисковая выдача обещает одну цену, а касса берёт другую.
 *
 * Оболочка корпуса Atlas Secure VPS (шапка, футер) живёт в PricingView
 * (VShell) — страница простая и не требует наблюдателя движения.
 */
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const d = dict(locale);
  const c = planContent(locale);
  const vars = {
    a: c.basic.name,
    b: c.plus.name,
    price: formatRub(PLANS.basic[1], locale),
    priceA: formatRub(PLANS.basic[1], locale),
    priceB: formatRub(PLANS.plus[1], locale),
    countries: count(locale, COUNTRY_COUNT, d.units.country),
    devices: count(locale, DEVICE_LIMIT, d.units.device),
    trial: count(locale, TRIAL_DAYS, d.units.day),
  };
  return {
    title: fill(d.pricing.meta.title, vars),
    description: fill(d.pricing.meta.description, vars),
    openGraph: {
      title: fill(d.pricing.meta.ogTitle, vars),
      description: fill(d.pricing.meta.ogDescription, vars),
      type: "website",
    },
  };
}

/**
 * Разметка FAQPage.
 *
 * Практика 2026: ИИ-поиск отвечает пользователю напрямую, и явно
 * размеченные пары «вопрос — ответ» он извлекает и цитирует охотнее
 * всего. Вопросы берутся из того же набора, что показан на странице
 * (PRICING_FAQ_IDS), — текст в выдаче не может разойтись с текстом на
 * сайте. Собирается по языку запроса: английской странице нужна
 * английская разметка, иначе в выдаче она отвечает по-русски.
 */
function faqLd(locale: Awaited<ReturnType<typeof getLocale>>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqByIds(PRICING_FAQ_IDS, locale).map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export default async function PricingRoute() {
  const locale = await getLocale();
  return (
    <>
      <script
        type="application/ld+json"
        // Содержимое собрано из константы в src/lib/faq.ts,
        // пользовательских данных в ней нет.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd(locale)) }}
      />
      <PricingView />
    </>
  );
}
