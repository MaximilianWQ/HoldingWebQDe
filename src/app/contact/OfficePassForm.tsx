"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import Icon from "@/components/pixel/Icon";
import { OFFICE, VISITOR_ROLES, VISITOR_DOCS } from "@/lib/contacts";

/**
 * Заявка на пропуск в бизнес-центр (владелец, 20.09.2026: «для визита
 * в офис необходимо оформить пропуск, сделай форму»).
 *
 * ПОЧЕМУ НЕ СПРАШИВАЕМ НОМЕР ДОКУМЕНТА. Номер паспорта или HKID —
 * чувствительные данные: их хранение пришлось бы объявлять в Политике,
 * защищать и удалять по сроку, а утечка такой таблицы стоит дороже
 * любой другой на сайте. Бизнес-центру номер заранее не нужен —
 * документ смотрят на стойке. Заранее нужно одно: чтобы ИМЯ В ПРОПУСКЕ
 * совпало с именем в документе. Поэтому просим имя латиницей и тип
 * документа, и говорим об этом прямо.
 *
 * Проверка полей — как во всех формах корпуса: по полю, ошибка рядом со
 * своим полем, фокус уходит на первое неверное.
 */
type Status = "idle" | "sending" | "sent";
type Field = "fullName" | "email" | "role" | "docType" | "purpose" | "visitAt" | "consent" | "form";
type Errors = Partial<Record<Field, string>>;

/** Имя для пропуска: латиница, пробелы, дефис и апостроф. */
const LATIN_NAME_RE = /^[A-Za-z][A-Za-z '\-.]{1,118}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OfficePassForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  const focusFirst = (found: Errors) => {
    const order: Field[] = ["fullName", "email", "role", "docType", "visitAt", "purpose", "consent"];
    const first = order.find((k) => found[k]);
    if (!first) return;
    formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`)?.focus();
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => String(fd.get(k) ?? "").trim();

    const payload = {
      fullName: get("fullName"),
      email: get("email"),
      contact: get("contact"),
      company: get("company"),
      role: get("role"),
      docType: get("docType"),
      purpose: get("purpose"),
      visitAt: get("visitAt"),
      consent: fd.get("consent") === "yes" ? "yes" : "",
    };

    const found: Errors = {};
    if (!payload.fullName) found.fullName = "Впишите имя и фамилию — они попадут в пропуск.";
    else if (!LATIN_NAME_RE.test(payload.fullName)) found.fullName = "Латиницей, как в документе: Ivan Petrov.";
    if (!payload.email) found.email = "Без почты мы не сможем прислать подтверждение.";
    else if (!EMAIL_RE.test(payload.email)) found.email = "Проверьте адрес: похоже, есть опечатка.";
    if (!payload.role) found.role = "Выберите, кем вы приходите.";
    if (!payload.docType) found.docType = "Выберите документ, который покажете на входе.";
    if (!payload.visitAt) found.visitAt = "Укажите дату и время визита.";
    if (!payload.purpose) found.purpose = "Напишите цель визита — её спросит охрана.";
    if (!payload.consent) found.consent = "Без согласия мы не вправе оформить пропуск.";

    if (Object.keys(found).length) {
      setErrors(found);
      focusFirst(found);
      return;
    }

    setErrors({});
    setStatus("sending");
    try {
      const res = await fetch("/api/office-pass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setStatus("idle");
        setErrors({ form: json?.error || "Не удалось отправить заявку. Попробуйте ещё раз." });
        return;
      }
      setStatus("sent");
      setTimeout(() => doneRef.current?.focus(), 30);
    } catch {
      setStatus("idle");
      setErrors({ form: "Заявка не ушла — похоже, пропала связь. Попробуйте ещё раз." });
    }
  };

  if (status === "sent") {
    return (
      <div className="v-card v-card-pad" role="status">
        <h3 ref={doneRef} tabIndex={-1} className="v-h3">Заявка принята</h3>
        <p className="v-text">
          Оформим пропуск и ответим на указанную почту. В день визита возьмите с собой документ, который выбрали в
          заявке, — на стойке сверят имя.
        </p>
        <p className="v-small">{OFFICE.line}</p>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="v-form" aria-labelledby="v-pass-h">
      <div className="v-field">
        <label className="v-label" htmlFor="v-pass-name">Имя и фамилия латиницей</label>
        <input
          id="v-pass-name"
          name="fullName"
          data-field="fullName"
          className="v-input"
          type="text"
          placeholder="Ivan Petrov"
          autoComplete="name"
          maxLength={120}
          aria-invalid={errors.fullName ? true : undefined}
          aria-describedby={`v-pass-name-hint${errors.fullName ? " v-pass-name-err" : ""}`}
          aria-required="true"
        />
        <p className="v-small" id="v-pass-name-hint">Ровно как в документе — охрана сверит имя на входе.</p>
        {errors.fullName && <p className="v-error" id="v-pass-name-err">{errors.fullName}</p>}
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="v-pass-role">Кем вы приходите</label>
        <select
          id="v-pass-role"
          name="role"
          data-field="role"
          className="v-input"
          defaultValue=""
          aria-invalid={errors.role ? true : undefined}
          aria-describedby={errors.role ? "v-pass-role-err" : undefined}
          aria-required="true"
        >
          <option value="" disabled>Выберите</option>
          {VISITOR_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        {errors.role && <p className="v-error" id="v-pass-role-err">{errors.role}</p>}
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="v-pass-doc">Документ для входа</label>
        <select
          id="v-pass-doc"
          name="docType"
          data-field="docType"
          className="v-input"
          defaultValue=""
          aria-invalid={errors.docType ? true : undefined}
          aria-describedby={`v-pass-doc-hint${errors.docType ? " v-pass-doc-err" : ""}`}
          aria-required="true"
        >
          <option value="" disabled>Выберите</option>
          {VISITOR_DOCS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <p className="v-small" id="v-pass-doc-hint">Номер вводить не нужно: документ показывают на стойке.</p>
        {errors.docType && <p className="v-error" id="v-pass-doc-err">{errors.docType}</p>}
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="v-pass-when">Дата и время визита</label>
        <input
          id="v-pass-when"
          name="visitAt"
          data-field="visitAt"
          className="v-input"
          type="datetime-local"
          aria-invalid={errors.visitAt ? true : undefined}
          aria-describedby={errors.visitAt ? "v-pass-when-err" : undefined}
          aria-required="true"
        />
        {errors.visitAt && <p className="v-error" id="v-pass-when-err">{errors.visitAt}</p>}
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="v-pass-purpose">Цель визита</label>
        <textarea
          id="v-pass-purpose"
          name="purpose"
          data-field="purpose"
          className="v-input v-textarea"
          rows={3}
          maxLength={1000}
          placeholder="Встреча с командой, подписание документов, собеседование"
          aria-invalid={errors.purpose ? true : undefined}
          aria-describedby={errors.purpose ? "v-pass-purpose-err" : undefined}
          aria-required="true"
        />
        {errors.purpose && <p className="v-error" id="v-pass-purpose-err">{errors.purpose}</p>}
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="v-pass-company">Компания <span className="v-small">— необязательно</span></label>
        <input id="v-pass-company" name="company" className="v-input" type="text" maxLength={160} autoComplete="organization" />
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="v-pass-email">Почта</label>
        <input
          id="v-pass-email"
          name="email"
          data-field="email"
          className="v-input"
          type="email"
          inputMode="email"
          autoComplete="email"
          maxLength={254}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "v-pass-email-err" : undefined}
          aria-required="true"
        />
        {errors.email && <p className="v-error" id="v-pass-email-err">{errors.email}</p>}
      </div>

      <div className="v-field">
        <label className="v-label" htmlFor="v-pass-contact">Телефон или Telegram <span className="v-small">— необязательно</span></label>
        <input id="v-pass-contact" name="contact" className="v-input" type="text" maxLength={120} />
      </div>

      <div className="v-check">
        <input
          id="v-pass-consent"
          name="consent"
          data-field="consent"
          type="checkbox"
          value="yes"
          aria-invalid={errors.consent ? true : undefined}
          aria-describedby={errors.consent ? "v-pass-consent-err" : undefined}
        />
        <label htmlFor="v-pass-consent">
          Согласен на передачу этих данных бизнес-центру для оформления пропуска —{" "}
          <Link href="/privacy" target="_blank" className="v-link">как мы их храним</Link>.
        </label>
      </div>
      {errors.consent && <p className="v-error" id="v-pass-consent-err">{errors.consent}</p>}
      {errors.form && <p className="v-error" role="alert">{errors.form}</p>}

      <button type="submit" className="v-btn v-btn-primary v-btn-block" disabled={status === "sending"}>
        {status === "sending" ? "Отправляем…" : <>Заказать пропуск<Icon name="arrow-right" size={16} /></>}
      </button>
    </form>
  );
}
