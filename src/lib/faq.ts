import type { Locale } from "./locale";
import { DEVICE_LIMIT } from "./plans";
import { TRIAL_DAYS } from "./brand-facts";
import { plural } from "./ru-words";
import { pluralize } from "@/lib/text/plural";

/**
 * Вопросы и ответы — единственный источник.
 *
 * Живут отдельно от страницы, потому что читателей у них двое:
 * человек на /pricing и поисковая система. Разметка FAQPage
 * собирается из этого же массива, поэтому текст в выдаче не может
 * разойтись с текстом на странице.
 *
 * Практика 2026: ИИ-поиск отвечает пользователю напрямую, и явно
 * размеченные пары «вопрос — ответ» он извлекает и цитирует охотнее
 * всего. Формулировки поэтому самодостаточны: ответ понятен без
 * окружающего контекста страницы.
 *
 * Порядок — по частоте возражения перед оплатой: сначала «сложно ли»
 * и «что будет потом», затем устройства, оплата, возврат, приватность.
 *
 * У КАЖДОГО ВОПРОСА ЕСТЬ `id` (21.09.2026). Раньше страница выбирала
 * нужные вопросы по их русскому тексту, и английская версия осталась
 * бы с пустым списком: сравнение строк перестало бы совпадать. Теперь
 * выбирают по id, а текст свободно переводится.
 */
export interface FaqEntry {
  id: string;
  q: string;
  a: string;
  /** То же по-английски. Поля обязательные — забыть перевод нельзя. */
  qEn: string;
  aEn: string;
}

const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;
const TRIAL_EN = `${TRIAL_DAYS} ${pluralize("en", TRIAL_DAYS, ["day", "days", "days"])}`;

export const FAQ: FaqEntry[] = [
  {
    id: "setup",
    q: "Сложно ли настроить?",
    a: "Нет. Установите бесплатное приложение и добавьте ключ из личного кабинета — одной кнопкой или по QR-коду. Пошаговая инструкция для каждого устройства есть на странице «Устройства».",
    qEn: "Is it hard to set up?",
    aEn: "No. Install the free app and add the key from your account — with one button or by scanning a QR code. There is a step-by-step guide for every device on the Devices page.",
  },
  {
    id: "after-trial",
    q: "Что будет, когда закончатся бесплатные дни?",
    a: `Доступ просто остановится. Для пробных ${TRIAL} карта не нужна, поэтому деньги не спишутся. Понравится — выберите тариф в личном кабинете, и всё заработает снова.`,
    qEn: "What happens when the free days run out?",
    aEn: `Access simply stops. The ${TRIAL_EN} trial does not need a card, so nothing is charged. If you liked it, pick a plan in your account and everything starts working again.`,
  },
  {
    id: "after-payment",
    q: "Как быстро подключусь после оплаты?",
    a: "Сразу. Подписка включается автоматически, как только платёжный оператор подтвердит оплату. Ключ и QR-код появятся в личном кабинете, там же ссылка на приложение для вашего устройства.",
    qEn: "How soon can I connect after paying?",
    aEn: "Straight away. The subscription switches on automatically as soon as the payment provider confirms the payment. Your key and QR code appear in your account, along with a link to the app for your device.",
  },
  {
    id: "devices",
    q: "На каких устройствах работает Atlas?",
    a: `iPhone и iPad, Android, macOS, Windows и Android TV. Одна подписка работает на ${DEVICE_LIMIT} устройствах одновременно — их можно менять в любой момент.`,
    qEn: "Which devices does Atlas work on?",
    aEn: `iPhone and iPad, Android, macOS, Windows and Android TV. One subscription works on ${DEVICE_LIMIT} devices at the same time, and you can swap them whenever you like.`,
  },
  {
    id: "auto-charge",
    q: "Будут ли списывать деньги автоматически?",
    a: "Нет. Вы платите один раз за выбранный срок: месяц, три месяца, полгода или год. Когда срок закончится, подписка остановится, а продлить её можно в личном кабинете.",
    qEn: "Will I be charged automatically?",
    aEn: "No. You pay once for the term you choose: one month, three months, six months or a year. When the term ends the subscription stops, and you can renew it in your account.",
  },
  {
    id: "payment",
    q: "Как проходит оплата?",
    a: "Через платёжного оператора: данные карты к нам не попадают. На оплату отводится 15 минут с момента создания платежа. После подтверждения подписка включается автоматически.",
    qEn: "How does payment work?",
    aEn: "Through a payment provider — your card details never reach us. You have 15 minutes to complete a payment once it is created. Once it is confirmed, the subscription switches on automatically.",
  },
  {
    id: "refund",
    q: "Можно ли вернуть деньги?",
    a: `Если сервис не работал по нашей вине — да, в течение 14 дней с момента платежа. Порядок описан в Условиях использования. Чтобы не рисковать, начните с ${TRIAL} бесплатно.`,
    qEn: "Can I get a refund?",
    aEn: `If the service did not work through our fault — yes, within 14 days of the payment. The procedure is set out in the Terms of Service. To avoid the risk altogether, start with the ${TRIAL_EN} free trial.`,
  },
  {
    id: "logs",
    q: "Хранит ли Atlas историю подключений?",
    a: "Нет. Ни посещённые сайты, ни DNS-запросы, ни история подключений не записываются и не хранятся. Хранить нечего — значит нечего и передать.",
    qEn: "Does Atlas keep a history of connections?",
    aEn: "No. The sites you visit, your DNS requests and your connection history are not recorded or stored. If there is nothing kept, there is nothing to hand over.",
  },
];

/** Вопрос и ответ на языке страницы. */
export function faqText(item: FaqEntry, locale: Locale): { q: string; a: string } {
  return locale === "ru" ? { q: item.q, a: item.a } : { q: item.qEn, a: item.aEn };
}

/** Выбранные вопросы в заданном порядке — по id, не по тексту. */
export function faqByIds(ids: readonly string[], locale: Locale): { id: string; q: string; a: string }[] {
  return ids
    .map((id) => FAQ.find((f) => f.id === id))
    .filter((f): f is FaqEntry => Boolean(f))
    .map((f) => ({ id: f.id, ...faqText(f, locale) }));
}
