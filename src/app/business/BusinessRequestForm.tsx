"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import Icon from "@/components/pixel/Icon";
import { SALES_DESK } from "@/lib/contacts";
import type { Dict } from "@/i18n";
import { fill } from "@/i18n";
import { localeHref, type Locale } from "@/lib/locale";

/**
 * Форма корпоративной заявки — корпус Atlas Secure VPS (владелец,
 * 17.09.2026). Логика и контракт запроса не менялись, поменялась
 * только разметка (поля `.v-input`, одна синяя кнопка).
 *
 * Проверка на клиенте — до отправки и по каждому полю отдельно:
 * ошибка живёт рядом со своим полем, связана с ним через
 * aria-describedby, поле помечается aria-invalid, фокус переводится
 * на первое неверное. Браузерная проверка отключена (noValidate)
 * намеренно.
 *
 * Заявка уходит в POST /api/contact (src/app/api/contact/route.ts):
 * запись в contact_requests и уведомление администратору. Контракт —
 * { name, email, interest, message } — не менялся, поэтому
 * корпоративные поля (компания, размер команды, что нужно)
 * складываются в message структурированными строками (buildMessage).
 *
 * В ЗАЯВКУ УХОДЯТ РУССКИЕ ПОДПИСИ, даже если форму заполнили на
 * английской странице: её читает администратор, а админка русская.
 * Значения (`access`, `both`, `5-20`) при этом одни на обоих языках —
 * переводится только то, что человек видит на экране.
 */
const NEEDS: Array<{ value: string; label: string }> = [
  { value: "access", label: "Подключения для сотрудников" },
  { value: "servers", label: "Выделенные серверы" },
  { value: "both", label: "И то, и другое" },
];

const SIZES: Array<{ value: string; label: string }> = [
  { value: "5-20", label: "5–20 человек" },
  { value: "21-100", label: "21–100 человек" },
  { value: "101-500", label: "101–500 человек" },
  { value: "500+", label: "Больше 500 человек" },
];

/** Почта проверяется тем же выражением, что и на сервере
 *  (src/app/api/contact/route.ts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldName = "name" | "email" | "company" | "size" | "need";
type Errors = Partial<Record<FieldName, string>>;

interface FormState {
  name: string;
  email: string;
  company: string;
  size: string;
  need: string;
  message: string;
}

const EMPTY: FormState = { name: "", email: "", company: "", size: "", need: "", message: "" };

function validate(v: FormState, t: Dict["business"]): Errors {
  const e: Errors = {};
  if (!v.name.trim()) e.name = t.nameError;
  if (!v.email.trim()) e.email = t.emailEmpty;
  else if (!EMAIL_RE.test(v.email.trim())) e.email = t.emailBad;
  if (!v.company.trim()) e.company = t.companyError;
  if (!v.size) e.size = t.sizeError;
  if (!v.need) e.need = t.needError;
  return e;
}

/** Корпоративные поля складываются в message: контракт /api/contact
 *  их пока не знает. Формат — строки «ключ: значение». */
function buildMessage(v: FormState): string {
  const need = NEEDS.find((n) => n.value === v.need)?.label ?? v.need;
  const size = SIZES.find((s) => s.value === v.size)?.label ?? v.size;
  return [
    `Компания: ${v.company.trim()}`,
    `Размер команды: ${size}`,
    `Что нужно: ${need}`,
    v.message.trim() ? `Задача: ${v.message.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export default function BusinessRequestForm({ locale, t }: { locale: Locale; t: Dict["business"] }) {
  const [v, setV] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  const set = (field: keyof FormState) => (value: string) => {
    setV((prev) => ({ ...prev, [field]: value }));
    // Ошибка снимается по мере исправления, а не по повторной отправке.
    setErrors((prev) => (prev[field as FieldName] ? { ...prev, [field]: undefined } : prev));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailure("");

    const found = validate(v, t);
    setErrors(found);
    const first = (Object.keys(found) as FieldName[])[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          email: v.email,
          interest: "enterprise",
          message: buildMessage(v),
        }),
      });
      const data = await res.json();
      // Текст ошибки от API наружу не показываем — там служебный
      // английский для журнала, а не для человека на сайте.
      if (data.success) {
        setSent(true);
        setTimeout(() => doneRef.current?.focus(), 30);
      } else {
        setFailure(fill(t.failServer, { mail: SALES_DESK.email }));
      }
    } catch {
      setFailure(fill(t.failNetwork, { mail: SALES_DESK.email }));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="v-card v-card-field vp-done" role="status">
        <span className="vp-done-mark" aria-hidden><Icon name="check" size={26} /></span>
        <h3 ref={doneRef} tabIndex={-1} className="v-h3">{t.doneTitle}</h3>
        <p>
          {t.doneBefore}{" "}
          <a href={`mailto:${SALES_DESK.email}`} className="v-link">{SALES_DESK.email}</a>.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="v-form" aria-labelledby="request-title">
      <div className="v-field">
        <label className="v-label" htmlFor="rq-name">{t.nameLabel}</label>
        <input
          id="rq-name"
          data-field="name"
          className="v-input"
          type="text"
          autoComplete="name"
          value={v.name}
          onChange={(e) => set("name")(e.target.value)}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "rq-name-err" : undefined}
          aria-required="true"
        />
        {errors.name && <p className="v-error" id="rq-name-err">{errors.name}</p>}
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="rq-email">{t.emailLabel}</label>
        <input
          id="rq-email"
          data-field="email"
          className="v-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={v.email}
          onChange={(e) => set("email")(e.target.value)}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "rq-email-err" : undefined}
          aria-required="true"
        />
        {errors.email && <p className="v-error" id="rq-email-err">{errors.email}</p>}
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="rq-company">{t.companyLabel}</label>
        <input
          id="rq-company"
          data-field="company"
          className="v-input"
          type="text"
          autoComplete="organization"
          value={v.company}
          onChange={(e) => set("company")(e.target.value)}
          aria-invalid={errors.company ? true : undefined}
          aria-describedby={errors.company ? "rq-company-err" : undefined}
          aria-required="true"
        />
        {errors.company && <p className="v-error" id="rq-company-err">{errors.company}</p>}
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="rq-size">{t.sizeLabel}</label>
        <select
          id="rq-size"
          data-field="size"
          className="v-input"
          value={v.size}
          onChange={(e) => set("size")(e.target.value)}
          aria-invalid={errors.size ? true : undefined}
          aria-describedby={errors.size ? "rq-size-err" : undefined}
          aria-required="true"
        >
          <option value="" disabled>{t.sizePlaceholder}</option>
          {t.sizes.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {errors.size && <p className="v-error" id="rq-size-err">{errors.size}</p>}
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="rq-need">{t.needLabel}</label>
        <select
          id="rq-need"
          data-field="need"
          className="v-input"
          value={v.need}
          onChange={(e) => set("need")(e.target.value)}
          aria-invalid={errors.need ? true : undefined}
          aria-describedby={errors.need ? "rq-need-err" : undefined}
          aria-required="true"
        >
          <option value="" disabled>{t.needPlaceholder}</option>
          {t.needs.map((n) => (
            <option key={n.value} value={n.value}>{n.label}</option>
          ))}
        </select>
        {errors.need && <p className="v-error" id="rq-need-err">{errors.need}</p>}
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="rq-message">{t.messageLabel}</label>
        <textarea
          id="rq-message"
          className="v-input"
          rows={4}
          style={{ minHeight: 120, paddingBlock: 14, resize: "vertical" }}
          value={v.message}
          onChange={(e) => set("message")(e.target.value)}
          placeholder={t.messagePlaceholder}
        />
      </div>

      {/* Живая область: без неё экранный диктор не узнает об отказе. */}
      <p role="alert" aria-live="assertive" style={{ margin: 0, color: "var(--v-red)", fontSize: 14 }}>{failure}</p>

      <button type="submit" className="v-btn v-btn-primary v-btn-block" disabled={sending}>
        {sending ? t.sending : t.submit}
      </button>
      <p className="v-small" style={{ textAlign: "center" }}>
        {t.consentBefore}{" "}
        <Link href={localeHref("/privacy", locale)} className="v-link">{t.consentLink}</Link>.
      </p>
    </form>
  );
}
