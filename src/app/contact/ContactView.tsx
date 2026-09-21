"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import Icon from "@/components/pixel/Icon";
import { DESKS, SUPPORT_DESK, TELEGRAM_SUPPORT, OFFICE, deskText } from "@/lib/contacts";
import OfficePassForm from "./OfficePassForm";
import type { Dict } from "@/i18n";
import { fill } from "@/i18n";
import { localeHref, type Locale } from "@/lib/locale";
import "@/app/vps-info.css";

/**
 * /contact — тело страницы, корпус Atlas Secure VPS (владелец,
 * 17.09.2026). Обёртку `VShell` и метаданные держит `page.tsx`.
 *
 * Отправка прежняя: POST /api/contact с контрактом
 * { name, email, interest, message }; значения тем (`vpn`, `vds`,
 * `enterprise`, `security`, `other`) не менялись — поменялись только
 * подписи. Обязательные поля те же: имя, почта, тема.
 *
 * Проверка — по правилам форм проекта: ошибка у своего поля,
 * aria-invalid + aria-describedby, фокус на первое неверное. Служебные
 * английские строки API наружу не показываются.
 *
 * ЗНАЧЕНИЯ ТЕМ (`vpn`, `vds`, …) НЕ ПЕРЕВОДЯТСЯ — переводятся только
 * подписи. На сервер и в админку уезжает значение, и оно обязано быть
 * одним и тем же на обоих языках: иначе обращение с английской
 * страницы не пройдёт проверку.
 */

/** Почта проверяется тем же выражением, что и на сервере
 *  (src/app/api/contact/route.ts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldName = "name" | "email" | "interest";
type Errors = Partial<Record<FieldName, string>>;

function validate(name: string, email: string, interest: string, t: Dict["contact"]): Errors {
  const e: Errors = {};
  if (!name.trim()) e.name = t.nameError;
  if (!email.trim()) e.email = t.emailEmpty;
  else if (!EMAIL_RE.test(email.trim())) e.email = t.emailBad;
  if (!interest) e.interest = t.topicError;
  return e;
}

export default function ContactView({
  locale,
  t,
  tp,
}: {
  locale: Locale;
  t: Dict["contact"];
  /** Заявка на пропуск — своя форма ниже на той же странице. */
  tp: Dict["pass"];
}) {
  const to = (href: string) => localeHref(href, locale);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ to: string } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);

  /** Ошибка снимается по мере исправления, а не по повторной отправке. */
  const clear = (field: FieldName) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFailure("");

    const found = validate(name, email, interest, t);
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
        body: JSON.stringify({ name, email, interest, message }),
      });
      const data = await res.json();
      if (data.success) {
        setSent({ to: email.trim() });
        setTimeout(() => doneRef.current?.focus(), 30);
      } else {
        // Текст ошибки API — служебный английский, наружу не выводим.
        setFailure(fill(t.failServer, { tg: TELEGRAM_SUPPORT.handle }));
      }
    } catch {
      setFailure(fill(t.failNetwork, { tg: TELEGRAM_SUPPORT.handle }));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <section className="v-section v-center v-glow" aria-labelledby="v-contact-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="v-contact-title" className="v-h1">
            {t.title} <span className="v-accent">{t.titleAccent}</span>
          </h1>
          <p className="v-lead">{t.lead}</p>
        </div>
      </section>

      {/* Наши адреса — до формы: часть людей пишет напрямую, и заставлять
          их заполнять форму, когда нужен просто адрес, незачем. */}
      <section className="v-section v-reveal" style={{ paddingTop: 0 }} aria-labelledby="v-ct-desks">
        <div className="v-wrap v-narrow">
          <h2 id="v-ct-desks" className="v-h3" style={{ textAlign: "center" }}>{t.desksTitle}</h2>
          <div className="vc-desks">
            {DESKS.map((d) => (
              <a key={d.email} href={`mailto:${d.email}`} className="v-card v-card-pad v-lift vc-desk">
                <span className="vc-desk-icon" aria-hidden>
                  <Icon name={d === SUPPORT_DESK ? "chat" : "bag"} size={22} />
                </span>
                <span className="vc-desk-title">{deskText(d, locale).title}</span>
                <span className="vc-desk-mail">{d.email}</span>
                <span className="vc-desk-note">{deskText(d, locale).note}</span>
              </a>
            ))}
          </div>
          <p className="v-car-note">
            {t.urgent}{" "}
            <a href={TELEGRAM_SUPPORT.href} target="_blank" rel="noopener noreferrer" className="v-link">
              {TELEGRAM_SUPPORT.handle}
            </a>
          </p>
        </div>
      </section>

      {/* Офис и пропуск — после контактов, до формы обращения: человек,
          которому нужен адрес, не должен пролистывать форму письма. */}
      <section className="v-section v-reveal" style={{ paddingTop: 0 }} aria-labelledby="v-office-h">
        <div className="v-wrap v-narrow">
          <h2 id="v-office-h" className="v-h3" style={{ textAlign: "center" }}>{t.officeTitle}</h2>
          <div className="v-card v-card-pad vc-office">
            <address className="vc-office-addr">
              {OFFICE.parts.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </address>
            <p className="v-small">{OFFICE.metro}</p>
            <a className="v-btn v-btn-soft v-btn-sm" href={OFFICE.mapUrl} target="_blank" rel="noopener noreferrer">
              {t.openMap}
            </a>
          </div>
          <p className="v-car-note">
            {t.passNote}
          </p>
          <div id="pass" className="vc-office-form">
            <h3 id="v-pass-h" className="v-h3">{t.passTitle}</h3>
            <OfficePassForm locale={locale} t={tp} />
          </div>
        </div>
      </section>

      <section className="v-section" style={{ paddingTop: 0 }} aria-label={t.formLabel}>
        <div className="v-wrap v-narrow">
          {sent ? (
            <div className="v-card v-card-field vp-done v-fade-in" role="status">
              <span className="vp-done-mark" aria-hidden><Icon name="check" size={26} /></span>
              <h2 ref={doneRef} tabIndex={-1} className="v-h3">{t.doneTitle}</h2>
              <p>
                {t.doneTextBefore} <b>{sent.to}</b> {t.doneTextAfter}
              </p>
              <div className="v-actions" style={{ marginTop: 24 }}>
                <Link href={to("/")} className="v-btn v-btn-soft">{t.toHome}</Link>
              </div>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="v-form" aria-labelledby="v-contact-title">
              <div className="v-field">
                <label className="v-label" htmlFor="v-ct-name">{t.nameLabel}</label>
                <input
                  id="v-ct-name"
                  data-field="name"
                  className="v-input"
                  type="text"
                  autoComplete="name"
                  placeholder={t.namePlaceholder}
                  value={name}
                  onChange={(e) => { setName(e.target.value); clear("name"); }}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? "v-ct-name-err" : undefined}
                  aria-required="true"
                />
                {errors.name && <p className="v-error" id="v-ct-name-err">{errors.name}</p>}
              </div>

              <div className="v-field">
                <label className="v-label" htmlFor="v-ct-email">{t.emailLabel}</label>
                <input
                  id="v-ct-email"
                  data-field="email"
                  className="v-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@mail.ru"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clear("email"); }}
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? "v-ct-email-err" : undefined}
                  aria-required="true"
                />
                {errors.email && <p className="v-error" id="v-ct-email-err">{errors.email}</p>}
              </div>

              <div className="v-field">
                <label className="v-label" htmlFor="v-ct-interest">{t.topicLabel}</label>
                <select
                  id="v-ct-interest"
                  data-field="interest"
                  className="v-input"
                  value={interest}
                  onChange={(e) => { setInterest(e.target.value); clear("interest"); }}
                  aria-invalid={errors.interest ? true : undefined}
                  aria-describedby={errors.interest ? "v-ct-interest-err" : undefined}
                  aria-required="true"
                >
                  <option value="" disabled>{t.topicPlaceholder}</option>
                  {t.interests.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.interest && <p className="v-error" id="v-ct-interest-err">{errors.interest}</p>}
              </div>

              <div className="v-field">
                <label className="v-label" htmlFor="v-ct-message">{t.messageLabel}</label>
                <textarea
                  id="v-ct-message"
                  className="v-input"
                  rows={4}
                  style={{ minHeight: 120, paddingBlock: 14, resize: "vertical" }}
                  placeholder={t.messagePlaceholder}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {/* Живая область: без неё чтец экрана не узнает об отказе. */}
              <p role="alert" aria-live="assertive" style={{ margin: 0, color: "var(--v-red)", fontSize: 14 }}>{failure}</p>

              <button type="submit" disabled={sending} className="v-btn v-btn-primary v-btn-block">
                {sending ? t.sending : t.send}
              </button>
              <p className="v-small" style={{ textAlign: "center" }}>
                {t.consentBefore}{" "}
                <Link href={to("/privacy")} className="v-link">{t.consentLink}</Link>.
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
