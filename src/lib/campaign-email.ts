/**
 * Письма рассылок: ограниченный Markdown → безопасный HTML + текст,
 * подстановки и шаблон в стиле писем src/lib/email.ts.
 *
 * Markdown намеренно маленький — ровно то, что нужно письму:
 *   абзацы (пустая строка), перенос строки внутри абзаца,
 *   **жирный**, [текст](https://…), списки «- пункт» и «1. пункт».
 * Всё остальное — текст: любой HTML экранируется и показывается как
 * есть. Ссылки — только http(s) (javascript:, data:, mailto: и прочие
 * превращаются в обычный текст). Подстановки {{…}} разворачиваются ПОСЛЕ
 * разбора разметки и экранируются, поэтому адрес вроде a**b@x.ru не
 * станет жирным, а <b> в имени — тегом.
 */

export const PLACEHOLDERS = ["email", "days_left", "plan", "dashboard_url"] as const;
export type PlaceholderKey = (typeof PLACEHOLDERS)[number];
export type TemplateVars = Record<PlaceholderKey, string>;

const PH_RE = /\{\{\s*([A-Za-z_]+)\s*\}\}/g;

export const PLAN_TITLES: Record<string, string> = { trial: "Пробный", basic: "Basic", plus: "Plus" };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

/** Подстановки, которых нет в списке (для проверки при сохранении). */
export function unknownPlaceholders(...sources: string[]): string[] {
  const bad = new Set<string>();
  for (const src of sources) {
    for (const m of src.matchAll(PH_RE)) {
      if (!(PLACEHOLDERS as readonly string[]).includes(m[1])) bad.add(m[1]);
    }
  }
  return [...bad];
}

export function substitute(s: string, vars: TemplateVars): string {
  return s.replace(PH_RE, (all, key: string) => ((PLACEHOLDERS as readonly string[]).includes(key) ? vars[key as PlaceholderKey] : all));
}

/** http(s)-адрес после подстановок или null. */
export function safeHttpUrl(raw: string, vars: TemplateVars): string | null {
  const href = substitute(raw.trim(), vars);
  if (!/^https?:\/\//i.test(href)) return null;
  try {
    const u = new URL(href);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

interface Out {
  html: string;
  text: string;
}

const LINK_STYLE = "color:#111111;text-decoration:underline";
const INLINE_RE = /\*\*([^*\n](?:[^\n]*?[^*\n])?)\*\*|\[([^\]\n]{1,300})\]\(\s*([^()\s]{1,2000})\s*\)/g;

function plain(s: string, vars: TemplateVars): Out {
  const v = substitute(s, vars);
  return { html: escapeHtml(v), text: v };
}

function inline(src: string, vars: TemplateVars, allowBold: boolean): Out {
  let html = "";
  let text = "";
  let last = 0;
  const re = new RegExp(INLINE_RE.source, "g");
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const before = plain(src.slice(last, m.index), vars);
    html += before.html;
    text += before.text;
    if (m[1] !== undefined) {
      if (allowBold) {
        const inner = inline(m[1], vars, false);
        html += `<strong>${inner.html}</strong>`;
        text += inner.text;
      } else {
        const p = plain(m[0], vars);
        html += p.html;
        text += p.text;
      }
    } else {
      const label = inline(m[2], vars, false);
      const href = safeHttpUrl(m[3], vars);
      if (href) {
        html += `<a href="${escapeHtml(href)}" style="${LINK_STYLE}">${label.html}</a>`;
        text += label.text === href ? href : `${label.text} (${href})`;
      } else {
        // Небезопасная или битая ссылка — остаётся только её текст.
        html += label.html;
        text += label.text;
      }
    }
    last = re.lastIndex;
  }
  const tail = plain(src.slice(last), vars);
  return { html: html + tail.html, text: text + tail.text };
}

type LineKind = "blank" | "ul" | "ol" | "p";
const UL_RE = /^\s*[-*•]\s+(.*)$/;
const OL_RE = /^\s*\d{1,3}[.)]\s+(.*)$/;

function kindOf(line: string): LineKind {
  if (/^\s*$/.test(line)) return "blank";
  if (UL_RE.test(line)) return "ul";
  if (OL_RE.test(line)) return "ol";
  return "p";
}

export function renderMarkdown(src: string, vars: TemplateVars): Out {
  const lines = src.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  const text: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const k = kindOf(lines[i]);
    if (k === "blank") {
      i += 1;
      continue;
    }
    const group: string[] = [];
    while (i < lines.length && kindOf(lines[i]) === k) group.push(lines[i++]);
    if (k === "p") {
      const parts = group.map((l) => inline(l.trim(), vars, true));
      html.push(`<p style="margin:0 0 16px">${parts.map((p) => p.html).join("<br>")}</p>`);
      text.push(parts.map((p) => p.text).join("\n"));
    } else {
      const re = k === "ul" ? UL_RE : OL_RE;
      const items = group.map((l) => inline((re.exec(l)?.[1] ?? "").trim(), vars, true));
      const tag = k;
      html.push(
        `<${tag} style="margin:0 0 16px;padding-left:22px">${items.map((it) => `<li style="margin:0 0 6px">${it.html}</li>`).join("")}</${tag}>`
      );
      text.push(items.map((it, n) => (k === "ul" ? `• ${it.text}` : `${n + 1}. ${it.text}`)).join("\n"));
    }
  }
  return { html: html.join("\n"), text: text.join("\n\n") };
}

/** Тема письма: подстановки, без переводов строк (заголовок письма). */
export function renderSubject(subject: string, vars: TemplateVars): string {
  return substitute(subject, vars).replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 200);
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function recipientVars(
  r: { email: string; subscriptionEnd: Date | string | null; plan: string | null },
  now: Date,
  baseUrl: string
): TemplateVars {
  const end = r.subscriptionEnd ? new Date(r.subscriptionEnd).getTime() : 0;
  const days = end > now.getTime() ? Math.ceil((end - now.getTime()) / DAY_MS) : 0;
  return {
    email: r.email,
    days_left: String(days),
    plan: PLAN_TITLES[r.plan ?? ""] ?? (r.plan || "—"),
    dashboard_url: `${baseUrl}/dashboard`,
  };
}

export interface CampaignEmail {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

const FOOTER_REASON: Record<"service" | "marketing", string> = {
  service: "Служебное письмо Atlas Secure — о вашей подписке и условиях сервиса. Такие письма приходят и после отписки от рассылки.",
  marketing: "Вы получили это письмо, потому что согласились получать новости и предложения Atlas Secure.",
};

/**
 * Письмо одному получателю. В подвале — ссылка «Отписаться от рассылки»,
 * в заголовках — List-Unsubscribe (адрес one-click) и
 * List-Unsubscribe-Post: List-Unsubscribe=One-Click (RFC 8058).
 */
export function buildCampaignEmail(p: {
  subject: string;
  bodyMd: string;
  kind: "service" | "marketing";
  vars: TemplateVars;
  links: { page: string; oneClick: string };
}): CampaignEmail {
  const subject = renderSubject(p.subject, p.vars);
  const body = renderMarkdown(p.bodyMd, p.vars);
  const reason = FOOTER_REASON[p.kind];
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#fff;font-family:Arial,Helvetica,sans-serif;color:#111">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;"><tr><td align="center">
<table width="100%" style="max-width:560px;">
<tr><td style="padding-bottom:24px;text-align:center;"><span style="font-size:18px;font-weight:700">Atlas Secure</span></td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#333;padding-bottom:8px">${body.html}</td></tr>
<tr><td style="border-top:1px solid #eee;padding-top:16px;color:#888;font-size:12px;line-height:1.5;text-align:center">${escapeHtml(reason)}<br><a href="${escapeHtml(p.links.page)}" style="color:#888;text-decoration:underline">Отписаться от рассылки</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${body.text}\n\n—\nAtlas Secure\n${reason}\nОтписаться от рассылки: ${p.links.page}\n`;
  return {
    subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${p.links.oneClick}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
