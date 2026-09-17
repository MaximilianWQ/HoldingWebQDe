"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import Icon from "@/components/pixel/Icon";
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
 */

const INTERESTS: Array<{ value: string; label: string }> = [
  { value: "vpn", label: "Ускоритель" },
  { value: "vds", label: "Выделенные серверы" },
  { value: "enterprise", label: "Для компании" },
  { value: "security", label: "Безопасность" },
  { value: "other", label: "Другое" },
];

/** Почта проверяется тем же выражением, что и на сервере
 *  (src/app/api/contact/route.ts). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldName = "name" | "email" | "interest";
type Errors = Partial<Record<FieldName, string>>;

function validate(name: string, email: string, interest: string): Errors {
  const e: Errors = {};
  if (!name.trim()) e.name = "Напишите, как к вам обращаться";
  if (!email.trim()) e.email = "Укажите почту — ответ придёт на неё";
  else if (!EMAIL_RE.test(email.trim())) e.email = "Проверьте адрес: похоже, в нём опечатка";
  if (!interest) e.interest = "Выберите тему письма";
  return e;
}

export default function ContactView() {
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

    const found = validate(name, email, interest);
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
        setFailure("Письмо не ушло — сбой на нашей стороне. Попробуйте ещё раз или напишите в Telegram @atlas_suppbot.");
      }
    } catch {
      setFailure("Нет связи с сервером. Проверьте интернет или напишите в Telegram @atlas_suppbot.");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <section className="v-section v-center v-glow" aria-labelledby="v-contact-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="v-contact-title" className="v-h1">
            Напишите <span className="v-accent">нам</span>
          </h1>
          <p className="v-lead">Вопрос по подключению, оплате или серверам — выберите тему, оставьте почту, ответим письмом.</p>
        </div>
      </section>

      <section className="v-section" style={{ paddingTop: 0 }} aria-label="Форма обращения">
        <div className="v-wrap v-narrow">
          {sent ? (
            <div className="v-card v-card-field vp-done v-fade-in" role="status">
              <span className="vp-done-mark" aria-hidden><Icon name="check" size={26} /></span>
              <h2 ref={doneRef} tabIndex={-1} className="v-h3">Письмо получено</h2>
              <p>
                Ответим на <b>{sent.to}</b> — обычно в течение четырёх рабочих часов. Если ответа
                нет, загляните в папку «Спам».
              </p>
              <div className="v-actions" style={{ marginTop: 24 }}>
                <Link href="/" className="v-btn v-btn-soft">На главную</Link>
              </div>
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} noValidate className="v-form" aria-labelledby="v-contact-title">
              <div className="v-field">
                <label className="v-label" htmlFor="v-ct-name">Как к вам обращаться</label>
                <input
                  id="v-ct-name"
                  data-field="name"
                  className="v-input"
                  type="text"
                  autoComplete="name"
                  placeholder="Например, Александр"
                  value={name}
                  onChange={(e) => { setName(e.target.value); clear("name"); }}
                  aria-invalid={errors.name ? true : undefined}
                  aria-describedby={errors.name ? "v-ct-name-err" : undefined}
                  aria-required="true"
                />
                {errors.name && <p className="v-error" id="v-ct-name-err">{errors.name}</p>}
              </div>

              <div className="v-field">
                <label className="v-label" htmlFor="v-ct-email">Почта для ответа</label>
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
                <label className="v-label" htmlFor="v-ct-interest">Тема</label>
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
                  <option value="" disabled>Выберите тему</option>
                  {INTERESTS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {errors.interest && <p className="v-error" id="v-ct-interest-err">{errors.interest}</p>}
              </div>

              <div className="v-field">
                <label className="v-label" htmlFor="v-ct-message">Сообщение (необязательно)</label>
                <textarea
                  id="v-ct-message"
                  className="v-input"
                  rows={4}
                  style={{ minHeight: 120, paddingBlock: 14, resize: "vertical" }}
                  placeholder="Что случилось или что хотите узнать"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {/* Живая область: без неё чтец экрана не узнает об отказе. */}
              <p role="alert" aria-live="assertive" style={{ margin: 0, color: "var(--v-red)", fontSize: 14 }}>{failure}</p>

              <button type="submit" disabled={sending} className="v-btn v-btn-primary v-btn-block">
                {sending ? "Отправляем…" : "Отправить письмо"}
              </button>
              <p className="v-small" style={{ textAlign: "center" }}>
                Отправляя письмо, вы соглашаетесь с{" "}
                <Link href="/privacy" className="v-link">политикой конфиденциальности</Link>.
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
