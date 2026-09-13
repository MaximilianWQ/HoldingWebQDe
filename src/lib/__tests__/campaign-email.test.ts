/**
 * Письма рассылок: ограниченный Markdown без XSS, подстановки,
 * заголовки отписки.
 */

import { describe, it, expect } from "vitest";
import { buildCampaignEmail, renderMarkdown, renderSubject, safeHttpUrl, unknownPlaceholders, type TemplateVars } from "../campaign-email";

const vars: TemplateVars = { email: "a<b>@x.ru", days_left: "12", plan: "Plus", dashboard_url: "https://qodev.dev/dashboard" };
const links = { page: "https://qodev.dev/unsubscribe?t=TOKEN", oneClick: "https://qodev.dev/api/unsubscribe?t=TOKEN" };

describe("Markdown → безопасный HTML", () => {
  it("любой HTML экранируется и показывается текстом", () => {
    const { html } = renderMarkdown(`<script>alert(1)</script> <img src=x onerror=alert(1)> <a href="javascript:x">y</a>`, vars);
    expect(html).not.toMatch(/<script|<img|<a href="javascript/i);
    expect(html).toContain("&#60;script&#62;");
  });

  it("ссылки — только http(s): javascript:, data:, vbscript:, //host становятся текстом", () => {
    for (const bad of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "javascript:void", "data:text/html;base64,PHNjcmlwdD4=", "vbscript:msgbox", "//evil.example", "mailto:x@y.ru", "ftp://x.ru"]) {
      const { html } = renderMarkdown(`[жми](${bad})`, vars);
      expect(html).not.toContain("href");
      expect(html).toContain("жми");
    }
    // Разобранная, но небезопасная ссылка — остаётся только её текст.
    expect(renderMarkdown("[жми](javascript:void)", vars).text).toBe("жми");
  });

  it("кавычки в адресе не выходят из атрибута", () => {
    const { html } = renderMarkdown('[x](https://ok.example/"onmouseover="alert(1))', vars);
    expect(html).not.toMatch(/"onmouseover=/);
    expect(safeHttpUrl('https://ok.example/"x', vars)).toBe("https://ok.example/%22x");
  });

  it("{{dashboard_url}} в ссылке разрешён, {{email}} как адрес ссылки — нет", () => {
    expect(renderMarkdown("[Кабинет]({{dashboard_url}})", vars).html).toContain('href="https://qodev.dev/dashboard"');
    expect(renderMarkdown("[x]({{email}})", vars).html).not.toContain("href");
  });

  it("жирный, абзацы, переносы и списки", () => {
    const { html, text } = renderMarkdown("Привет, **друг**!\nВторая строка\n\n- раз\n- два\n\n1. первый\n2. второй", vars);
    expect(html).toContain("<strong>друг</strong>");
    expect(html).toContain("<br>");
    expect(html).toMatch(/<ul[^>]*><li[^>]*>раз<\/li><li[^>]*>два<\/li><\/ul>/);
    expect(html).toMatch(/<ol[^>]*>.*первый.*второй.*<\/ol>/);
    expect(text).toBe("Привет, друг!\nВторая строка\n\n• раз\n• два\n\n1. первый\n2. второй");
  });

  it("подстановки экранируются и не превращаются в разметку", () => {
    expect(renderMarkdown("Адрес: {{email}}", vars).html).toContain("a&#60;b&#62;@x.ru");
    const tricky = { ...vars, email: "a**b**@x.ru" };
    expect(renderMarkdown("{{email}}", tricky).html).not.toContain("<strong>");
    expect(renderMarkdown("Осталось {{days_left}} дн. на {{plan}}", vars).text).toBe("Осталось 12 дн. на Plus");
  });

  it("текстовая часть: ссылка — «текст (адрес)»", () => {
    expect(renderMarkdown("[Кабинет](https://qodev.dev/dashboard)", vars).text).toBe("Кабинет (https://qodev.dev/dashboard)");
  });

  it("неизвестные подстановки находятся, тема — одной строкой", () => {
    expect(unknownPlaceholders("{{email}} {{name}}", "{{ promo }}")).toEqual(["name", "promo"]);
    expect(renderSubject("Подарок\r\nдля {{email}}", vars)).toBe("Подарок для a<b>@x.ru");
  });
});

describe("шаблон письма", () => {
  it("в подвале — ссылка «Отписаться», в заголовках — List-Unsubscribe one-click", () => {
    const m = buildCampaignEmail({ subject: "Тема", bodyMd: "Текст", kind: "marketing", vars, links });
    expect(m.headers["List-Unsubscribe"]).toBe(`<${links.oneClick}>`);
    expect(m.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(m.html).toContain(`href="${links.page}"`);
    expect(m.html).toContain("Отписаться от рассылки");
    expect(m.text).toContain(`Отписаться от рассылки: ${links.page}`);
    expect(m.html).toContain("согласились получать");
  });

  it("служебное письмо говорит, что приходит и после отписки", () => {
    const m = buildCampaignEmail({ subject: "Тема", bodyMd: "Текст", kind: "service", vars, links });
    expect(m.text).toContain("приходят и после отписки");
    expect(m.html).toContain("Отписаться от рассылки");
  });
});
