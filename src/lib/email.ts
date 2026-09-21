import { randomInt } from "crypto";
import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || "");
}

/** Код входа из письма — криптостойкий генератор: Math.random()
 *  предсказуем, а код даёт доступ к аккаунту. */
export function generateCode(): string {
  return randomInt(100000, 1000000).toString();
}

export async function sendVerificationEmail(
  email: string,
  code: string
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    // A sign-in code is a credential: it goes to the log only in
    // development. In production a missing key is an outage, not a
    // reason to leak codes into the logs.
    if (process.env.NODE_ENV === "production") {
      console.error("[EMAIL] RESEND_API_KEY is not set — verification email NOT sent");
      return false;
    }
    console.log(`[DEV] Verification code for ${email}: ${code}`);
    return true;
  }

  try {
    const { error } = await getResend().emails.send({
      from: "Atlas Secure <noreply@qodev.dev>",
      to: email,
      subject: `Ваш код: ${code}`,
      html: `
<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:480px;">
          <tr>
            <td style="padding-bottom:24px;text-align:center;">
              <span style="font-size:18px;font-weight:bold;color:#111111;">Atlas Secure</span>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;text-align:center;color:#333333;font-size:15px;">
              Ваш код подтверждения:
            </td>
          </tr>
          <tr>
            <td style="text-align:center;padding-bottom:24px;">
              <div style="display:inline-block;background-color:#f4f4f5;border-radius:8px;padding:16px 32px;">
                <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111111;">${code}</span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="text-align:center;color:#888888;font-size:13px;line-height:1.5;padding-bottom:24px;">
              Код действителен 10 минут.<br>
              Если вы не запрашивали код, просто проигнорируйте это письмо.
            </td>
          </tr>
          <tr>
            <td style="text-align:center;border-top:1px solid #eeeeee;padding-top:16px;color:#aaaaaa;font-size:12px;">
              Atlas Secure
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `,
    });

    if (error) {
      console.error("[EMAIL] Resend error:", error);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[EMAIL] Failed to send:", error);
    return false;
  }
}

const escHtml = (v: string) => v.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/**
 * Code for linking a Telegram account to Atlas Secure (bot → site,
 * docs/bot/TZ_BOT_EMAIL_LINK.md). Separate text from the sign-in code:
 * the person must understand that confirming binds THIS mailbox to a
 * Telegram account. Only the 6 digits are interpolated (escaped anyway).
 */
export async function sendTelegramLinkCodeEmail(email: string, code: string): Promise<boolean> {
  const safeCode = escHtml(code);
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "production") {
      console.error("[EMAIL] RESEND_API_KEY is not set — Telegram link code NOT sent");
      return false;
    }
    console.log(`[DEV] Telegram link code for ${email}: ${code}`);
    return true;
  }
  return sendTransactional(
    email,
    "Код для привязки Telegram к Atlas Secure",
    wrapHtml(
      "Привязка Telegram к Atlas Secure",
      `<p>Кто-то (надеемся, вы) хочет привязать эту почту к Telegram-аккаунту в боте Atlas Secure. Введите код в боте:</p>
       <p style="margin:20px 0;text-align:center"><span style="display:inline-block;background:#f4f4f5;border-radius:8px;padding:16px 32px;font-size:32px;font-weight:bold;letter-spacing:8px;color:#111">${safeCode}</span></p>
       <p>Код действует 10 минут. После привязки у бота и сайта будет одна подписка и один ключ.</p>
       <p style="color:#666">Если вы ничего не запрашивали — просто проигнорируйте письмо: без кода почта никуда не привяжется.</p>`
    )
  );
}

// ─── Generic transactional sender (plain HTML body) ───────────────

async function sendTransactional(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[DEV email → ${to}] ${subject}`);
    return true;
  }
  try {
    // Тема чистится от переводов строк и ограничивается по длине
    // (аудит 19.09.2026). В неё попадает текст из открытых форм, а
    // тема письма — заголовок: перевод строки в заголовке это
    // приглашение дописать свои. Resend такое и сам не пропустит,
    // но полагаться на чужую библиотеку в этом месте незачем.
    const safeSubject = String(subject).replace(/[\r\n]+/g, " ").slice(0, 200);
    const { error } = await getResend().emails.send({
      from: "Atlas Secure <noreply@qodev.dev>",
      to,
      subject: safeSubject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (error) {
      console.error("[EMAIL] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[EMAIL] Failed to send:", err);
    return false;
  }
}

function wrapHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table width="100%" style="max-width:560px;">
<tr><td style="padding-bottom:24px;text-align:center;"><span style="font-size:18px;font-weight:700">Atlas Secure</span></td></tr>
<tr><td style="font-size:18px;font-weight:600;padding-bottom:16px">${title}</td></tr>
<tr><td style="font-size:14px;line-height:1.6;color:#333;padding-bottom:24px">${bodyHtml}</td></tr>
<tr><td style="border-top:1px solid #eee;padding-top:16px;color:#aaa;font-size:12px;text-align:center">Atlas Secure</td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendTrialActivatedEmail(email: string, dashboardUrl: string): Promise<boolean> {
  return sendTransactional(
    email,
    "Пробный период активирован",
    wrapHtml(
      "Пробный период на 3 дня активирован",
      `<p>Ваш доступ к Atlas Secure открыт. В личном кабинете отсканируйте QR-код или нажмите кнопку «Открыть в Happ» / «Открыть в V2RayTun».</p>
       <p style="margin-top:16px"><a href="${dashboardUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Открыть личный кабинет</a></p>
       <p style="margin-top:16px;color:#666">Если кнопки не работают — скопируйте ссылку подписки на странице и добавьте её в приложении вручную.</p>`
    )
  );
}

export async function sendPaymentSucceededEmail(
  email: string,
  planTitle: string,
  expiresAt: Date,
  dashboardUrl: string
): Promise<boolean> {
  const dateLabel = expiresAt.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
  return sendTransactional(
    email,
    "Подписка активирована",
    wrapHtml(
      "Спасибо за покупку",
      `<p>Подписка <b>${planTitle}</b> активирована до <b>${dateLabel}</b>.</p>
       <p style="margin-top:16px"><a href="${dashboardUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Открыть личный кабинет</a></p>`
    )
  );
}

/** Receipt for a «Пакет трафика». packTitle is built by the server (no user input). */
export async function sendTrafficPackEmail(email: string, packTitle: string, dashboardUrl: string): Promise<boolean> {
  return sendTransactional(
    email,
    "Пакет трафика зачислен",
    wrapHtml(
      "Спасибо за покупку",
      `<p><b>${packTitle}</b> оплачен. Гигабайты прибавляются к остатку отдельного ключа: срока у него нет, он работает, пока есть гигабайты.</p>
       <p style="margin-top:16px"><a href="${dashboardUrl}" style="display:inline-block;background:#111;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Открыть личный кабинет</a></p>`
    )
  );
}

export async function sendRefundAdminAlertEmail(params: {
  adminEmail: string;
  orderId: string;
  userEmail: string;
  remnawaveUuid: string | null;
  amountRub: number;
  plan: string;
  yookassaPaymentId: string;
  appliedAt: Date | null;
}): Promise<boolean> {
  const appliedLabel = params.appliedAt ? params.appliedAt.toISOString() : "—";
  // Stored values (the email may come unvalidated from the bot) are
  // escaped: the admin's mail client must not render injected markup.
  const esc = (v: string) => v.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
  return sendTransactional(
    params.adminEmail,
    "[Atlas Secure] Refund получен — требуется решение",
    wrapHtml(
      "Refund получен",
      `<table cellpadding="6" style="font-size:13px"><tbody>
<tr><td><b>Order ID</b></td><td>${esc(params.orderId)}</td></tr>
<tr><td><b>User</b></td><td>${esc(params.userEmail)}</td></tr>
<tr><td><b>Remnawave UUID</b></td><td>${esc(params.remnawaveUuid || "—")}</td></tr>
<tr><td><b>Amount</b></td><td>${params.amountRub.toFixed(2)} ₽</td></tr>
<tr><td><b>Plan</b></td><td>${esc(params.plan)}</td></tr>
<tr><td><b>Applied to Remnawave at</b></td><td>${appliedLabel}</td></tr>
<tr><td><b>YooKassa Payment ID</b></td><td>${esc(params.yookassaPaymentId)}</td></tr>
</tbody></table>
<p style="margin-top:16px;color:#444">Подписка <b>не отозвана автоматически</b>. Решите вручную через панель Remnawave: оставить, сократить expireAt пропорционально или удалить пользователя.</p>`
    )
  );
}

// ─── Подарок от администратора ───────────────────────────────────

/**
 * Письмо о выданной подписке (владелец, 21.09.2026: «админ выдаёт
 * пользователю подписку — пусть приходит оповещение, что вам выдан
 * подарок, перейдите в кабинет установить ключ»).
 *
 * ОФОРМЛЕНИЕ — вариант «Плита», выбранный владельцем из трёх макетов:
 * лавандовая плита с перфорацией, крупное число дней, синяя кнопка,
 * капсулы фактов и три шага. Тот же язык, что на первом экране сайта,
 * — письмо и сайт должны читаться одним продуктом.
 *
 * ПОЧЕМУ ТАБЛИЦАМИ, А НЕ FLEX. Outlook на Windows рисует письма
 * движком Word: он не знает ни flex, ни grid, ни `border-radius`, ни
 * `gap`. Разметка на них разваливается в колонку. Таблицы с
 * `role="presentation"` — единственное, что держится во всех клиентах;
 * скругления и капсулы там, где их нет, просто станут прямыми углами,
 * и письмо останется читаемым.
 *
 * ПОЧЕМУ КЛЮЧА В ПИСЬМЕ НЕТ. Письмо пересылают, письма лежат в
 * архивах и в чужих почтовых клиентах. Ключ — это доступ; его место в
 * кабинете, за входом. Отсюда единственное действие письма — кнопка
 * «Открыть кабинет».
 *
 * ЯЗЫК берётся из `users.locale` — того, на котором человек
 * зарегистрировался. Спросить его в момент выдачи негде: выдаёт
 * администратор, а письмо уходит само.
 */
export interface GiftEmailParams {
  email: string;
  /**
   * Сколько минут добавлено. Именно минуты, а не дни: у выдачи есть
   * пресеты короче суток, и «+0 дней» в письме было бы враньём.
   */
  minutes: number;
  /** До какого числа теперь работает подписка. */
  until: Date;
  dashboardUrl: string;
  locale: "ru" | "en";
  /** Сколько устройств на подписке и сколько стран — из src/lib. */
  devices: number;
  countries: number;
}

/** Форма слова после числа: русскому нужно три, английскому хватает двух. */
/**
 * Срок словами.
 *
 * У выдачи есть пресеты короче суток («30m», «1h», «12h»). Раньше
 * письмо показало бы их как есть — «Вам подарили 30m Atlas Secure
 * VPS»: это не по-русски и не по-английски. Поэтому минуты
 * переводятся в слова на языке письма.
 */
function spellDuration(minutes: number, locale: "ru" | "en"): string {
  const word = (n: number, ru: [string, string, string], en: [string, string]) => {
    if (locale === "en") return n === 1 ? en[0] : en[1];
    const m10 = n % 10;
    const m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return ru[0];
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return ru[1];
    return ru[2];
  };
  const days = Math.floor(minutes / (24 * 60));
  if (days >= 1) return `${days} ${word(days, ["день", "дня", "дней"], ["day", "days"])}`;
  const hours = Math.floor(minutes / 60);
  if (hours >= 1) return `${hours} ${word(hours, ["час", "часа", "часов"], ["hour", "hours"])}`;
  return `${minutes} ${word(minutes, ["минута", "минуты", "минут"], ["minute", "minutes"])}`;
}

const GIFT_COPY = {
  ru: {
    subject: (amount: string) => `Вам подарили ${amount} Atlas Secure VPS`,
    badge: "Подарок от Atlas",
    lead: (amount: string) =>
      `Мы продлили вашу подписку на&nbsp;${amount}. Ключ уже готов — осталось вставить его в приложение, и VPN заработает.`,
    cta: "Открыть кабинет и забрать ключ",
    note: "Вход по той же почте, на которую пришло письмо. Карта не нужна.",
    until: (date: string) => `Подписка работает до ${date}`,
    pills: (devices: number, countries: number) => ["Ключ готов", `${devices} устройств`, `${countries} стран`],
    steps: [
      ["Откройте кабинет", "ключ лежит там, копируется одной кнопкой."],
      ["Поставьте приложение", "Happ или Incy, бесплатно, ссылки в кабинете."],
      ["Вставьте ключ", "и нажмите подключение. Обычно это минута."],
    ] as [string, string][],
    footer:
      "Письмо служебное — оно про вашу подписку, и отписка на такие не действует.<br>" +
      "Atlas Secure VPS · часть группы QoDev, Гонконг (SAR)",
  },
  en: {
    subject: (amount: string) => `You have been given ${amount} of Atlas Secure VPS`,
    badge: "A gift from Atlas",
    lead: (amount: string) =>
      `We have extended your subscription by&nbsp;${amount}. Your key is ready — add it to the app and the VPN starts working.`,
    cta: "Open your account and get the key",
    note: "Sign in with the same email this letter came to. No card needed.",
    until: (date: string) => `Your subscription runs until ${date}`,
    pills: (devices: number, countries: number) => ["Key ready", `${devices} devices`, `${countries} countries`],
    steps: [
      ["Open your account", "the key is there, copied with one button."],
      ["Install the app", "Happ or Incy, free, links are in your account."],
      ["Add the key", "and press connect. It usually takes a minute."],
    ] as [string, string][],
    footer:
      "This is a service email about your subscription; unsubscribing does not apply to it.<br>" +
      "Atlas Secure VPS · part of the QoDev group, Hong Kong (SAR)",
  },
} as const;

/**
 * Разметка письма отдельно от отправки — чтобы её можно было собрать и
 * посмотреть, ничего не отправляя (`scripts/preview-gift-email.ts`).
 */
export function renderGiftEmail(p: GiftEmailParams): { subject: string; html: string } {
  const t = GIFT_COPY[p.locale];
  // Срок словами: «7 дней», «12 часов», «30 минут». Крупная строка
  // письма разбирается на число и слово — число набрано вдвое крупнее.
  const amount = spellDuration(p.minutes, p.locale);
  const [bigNumber, ...restWords] = amount.split(" ");
  const big = `+${bigNumber}`;
  const bigUnit = restWords.join(" ");
  const date = p.until.toLocaleDateString(p.locale === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const url = escHtml(p.dashboardUrl);
  // Знак картинкой, а не SVG: Gmail вырезает встроенный SVG из письма,
  // и на его месте остаётся пустота. PNG отдаёт сам сайт (`/icon-192`),
  // поэтому знак не может разойтись с иконкой приложения.
  const site = url.replace(/\/dashboard\/?$/, "");
  const mark = `${site}/icon-192`;

  // Перфорация по верхней кромке плиты — та деталь, ради которой
  // владелец и выбрал этот вариант. Нарисована ячейками: белый кружок
  // в каждой. Outlook на Windows не знает скруглений и покажет
  // квадратики — рисунок «отрывного листа» при этом сохраняется.
  const punch =
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    Array.from({ length: 9 })
      .map(
        () =>
          `<td align="center" style="padding:0 0 22px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
          `<td width="18" height="18" style="background:#ffffff;border-radius:999px;font-size:0;line-height:0">&nbsp;</td>` +
          `</tr></table></td>`
      )
      .join("") +
    `</tr></table>`;

  const pill = (text: string) =>
    `<td style="padding:0 8px 0 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td style="background:#EFF1F7;border-radius:999px;padding:12px 18px;font:700 11px/1 Arial,Helvetica,sans-serif;` +
    `letter-spacing:0.07em;text-transform:uppercase;color:#0B0B0F;white-space:nowrap">${escHtml(text)}</td>` +
    `</tr></table></td>`;

  const step = (n: number, [head, tail]: [string, string]) =>
    `<tr><td width="26" valign="top" style="padding:0 14px 12px 0">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td width="26" height="26" align="center" style="background:#0B0B0F;border-radius:999px;` +
    `font:700 13px/26px Arial,Helvetica,sans-serif;color:#ffffff">${n}</td></tr></table></td>` +
    `<td valign="top" style="padding:0 0 12px;font:15px/1.45 Arial,Helvetica,sans-serif;color:#3A3A42">` +
    `<b style="color:#0B0B0F">${escHtml(head)}</b> — ${escHtml(tail)}</td></tr>`;

  const html = `<!DOCTYPE html>
<html lang="${p.locale}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>${escHtml(t.subject(amount))}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<!-- Строка предпросмотра: её показывает список входящих рядом с темой.
     Скрыта от глаз, но не от клиента — иначе туда попадает начало
     разметки. -->
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escHtml(t.note)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff">
<tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">

  <tr><td style="padding:0 0 22px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td width="30"><img src="${mark}" width="30" height="30" alt=""
        style="display:block;width:30px;height:30px;border:0;border-radius:9px"></td>
      <td style="padding-left:10px;font:600 16px/1 Arial,Helvetica,sans-serif;color:#0B0B0F">Atlas Secure VPS</td>
    </tr></table>
  </td></tr>

  <tr><td style="background:#EFF1F7;border-radius:26px;padding:22px 32px 32px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td>${punch}</td></tr>
      <tr><td style="padding:0 0 20px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:#ffffff;border-radius:999px;padding:8px 15px;font:700 11px/1 Arial,Helvetica,sans-serif;
            letter-spacing:0.09em;text-transform:uppercase;color:#0B0B0F">${escHtml(t.badge)}</td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:0 0 4px;font:800 76px/0.9 Arial,Helvetica,sans-serif;letter-spacing:-0.04em;color:#0B0B0F">
        ${escHtml(big)}${bigUnit ? ` <span style="font:700 28px/1 Arial,Helvetica,sans-serif;color:#3A85F0">${escHtml(bigUnit)}</span>` : ""}
      </td></tr>
      <tr><td style="padding:14px 0 0;font:17px/1.45 Arial,Helvetica,sans-serif;color:#5A6177">${t.lead(amount)}</td></tr>
      <tr><td style="padding:10px 0 0;font:14px/1.5 Arial,Helvetica,sans-serif;color:#6B7284">${escHtml(t.until(date))}</td></tr>
      <tr><td style="padding:26px 0 0">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:#3A85F0;border-radius:999px">
            <a href="${url}" style="display:block;padding:17px 30px;font:600 16px/1 Arial,Helvetica,sans-serif;
              color:#ffffff;text-decoration:none">${escHtml(t.cta)}</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:14px 0 0;font:13px/1.5 Arial,Helvetica,sans-serif;color:#6B7284">${escHtml(t.note)}</td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:22px 0 0">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      ${t.pills(p.devices, p.countries).map(pill).join("")}
    </tr></table>
  </td></tr>

  <tr><td style="padding:24px 0 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${t.steps.map((s, i) => step(i + 1, s)).join("")}
    </table>
  </td></tr>

  <tr><td style="padding:20px 0 0;border-top:1px solid #E4E7EC;
    font:12px/1.6 Arial,Helvetica,sans-serif;color:#7D8390">${t.footer}</td></tr>

</table>
</td></tr></table>
</body></html>`;

  return { subject: t.subject(amount), html };
}

export async function sendGiftGrantedEmail(p: GiftEmailParams): Promise<boolean> {
  const { subject, html } = renderGiftEmail(p);
  return sendTransactional(p.email, subject, html);
}
