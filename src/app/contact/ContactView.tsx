"use client";

// Поля бланка — первым импортом: в каскаде они должны стоять до
// atlas.css и contact-atlas.css, как раньше в корневом layout.
import "@/app/px-forms.css";
import Chars from "@/components/atlas/Chars";
import Link from "next/link";
import { useRef, useState } from "react";
import Icon, { type IconName } from "@/components/pixel/Icon";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";
import "./contact-atlas.css";

/**
 * /contact — лист 15 «Атлас-издания»: контакт как объект.
 *
 * Отправка прежняя: POST /api/contact с контрактом
 * { name, email, interest, message }, значения тем (`vpn`, `vds`,
 * `enterprise`, `security`, `other`) не менялись — поменялись только
 * подписи. Обязательные поля те же: имя, почта, тема.
 *
 * Проверка — по правилам форм проекта (CLAUDE.md, образец
 * BusinessRequestForm): ошибка у своего поля, aria-invalid +
 * aria-describedby, фокус на первое неверное, почта проверяется тем же
 * выражением, что и на сервере. Служебные английские строки API
 * («Server error», «Invalid email format») наружу не показываются.
 *
 * После успешного ответа форма сменяется подтверждением, а на
 * маленькой карте листа появляется кобальтовая точка: «получено
 * {время}, ответим на {адрес}». Время — момент ответа сервера на
 * устройстве читателя, адрес — тот, что человек ввёл.
 *
 * Весь моушн — contact-atlas.css, раздел «Движение».
 */

const INTERESTS: Array<{ value: string; label: string; sym: string }> = [
  { value: "vpn",        label: "Ускоритель",         sym: "line" },
  { value: "vds",        label: "Выделенные серверы", sym: "square" },
  { value: "enterprise", label: "Для компаний",       sym: "grid" },
  { value: "security",   label: "Безопасность",       sym: "ring" },
  { value: "other",      label: "Другое",             sym: "dot" },
];

const CHANNELS: { label: string; value: string; href: string; sla: string; external: boolean; icon: IconName }[] = [
  { label: "Поддержка в Telegram", value: "@atlas_suppbot",        href: "https://t.me/atlas_suppbot",   sla: "менее 30 минут", external: true,  icon: "chat" },
  { label: "Продажи",              value: "sales@atlas.secure",    href: "mailto:sales@atlas.secure",    sla: "менее 4 часов",  external: false, icon: "send" },
  { label: "Безопасность",         value: "security@atlas.secure", href: "mailto:security@atlas.secure", sla: "менее 24 часов", external: false, icon: "lock" },
  { label: "Приватность",          value: "privacy@atlas.secure",  href: "mailto:privacy@atlas.secure",  sla: "менее 48 часов", external: false, icon: "shield" },
];

const TRIAL = `${TRIAL_DAYS} ${plural(TRIAL_DAYS, ["день", "дня", "дней"])}`;

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

/** Линии равной глубины на маленькой карте листа. */
const CONTOURS = Array.from({ length: 6 }, (_, k) => {
  const y0 = 34 + k * 40;
  let d = "";
  for (let x = 0; x <= 400; x += 20) {
    const y = y0 + 10 * Math.sin(x / 62 + k * 0.8) + 4 * Math.sin(x / 23 + k);
    d += `${x ? "L" : "M"}${x} ${y.toFixed(1)}`;
  }
  return d;
});

const H1_A = "напишите";
const H1_B = "нам";


/** Переносит длинные адреса только по «@» и «.» — никогда не рвёт слово
 *  посередине («secur|e»), как это делал `overflow-wrap: anywhere» на
 *  узкой карточке телефона (QA 16.09.2026). */
function Breakable({ text }: { text: string }) {
  const parts = text.split(/(?<=[@./])/);
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {p}
          {i < parts.length - 1 ? <wbr /> : null}
        </span>
      ))}
    </>
  );
}

function Words({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => (
        <span key={i}>
          <span className="a-word" style={{ ["--i" as string]: i }}>{w}</span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}

export default function ContactView() {
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [interest, setInterest] = useState("");
  const [message, setMessage]   = useState("");
  const [sending, setSending]   = useState(false);
  const [sent, setSent]         = useState<{ at: string; to: string } | null>(null);
  const [errors, setErrors]     = useState<Errors>({});
  const [failure, setFailure]   = useState("");
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
      const res  = await fetch("/api/contact", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name, email, interest, message }),
      });
      const data = await res.json();
      if (data.success) {
        setSent({
          at: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
          to: email.trim(),
        });
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
    <main id="main" className="a-main ac">
      {/* ── 01 · Первый экран ──────────────────────────────────── */}
      <section className="a-sheet ac-cover" data-sheet="15" data-title="Контакты" aria-labelledby="ac-title">
        <div className="a-field">
          <h1 id="ac-title" className="ac-h1" aria-label={`${H1_A} ${H1_B}`}>
            <span className="ac-h1-line" aria-hidden><Chars text={H1_A} /></span>
            <span className="ac-h1-line ac-h1-2" aria-hidden><Chars text={H1_B} start={H1_A.length} /></span>
          </h1>
          <div className="ac-cover-grid">
            <p className="a-lead a-settle" style={{ ["--i" as string]: 2 }}>
              Вопрос по подключению, оплате или выделенным серверам — выберите тему,
              оставьте почту, и мы ответим письмом.
            </p>
            <div className="a-actions a-settle" style={{ ["--i" as string]: 3 }}>
              <a href="#ac-form-title" className="a-btn a-btn-primary">Написать письмо</a>
              <a href="https://t.me/atlas_suppbot" target="_blank" rel="noopener noreferrer" className="a-btn a-btn-quiet">
                Telegram
                <span className="b-sr"> (откроется в новой вкладке)</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── 02 · Адреса ────────────────────────────────────────── */}
      <section className="a-sheet ac-channels-sheet" data-sheet="15" data-title="Адреса" aria-labelledby="ac-ch-title">
        <div className="a-field">
          <h2 id="ac-ch-title" className="a-h2 a-settle">
            <span className="a-no">02</span>адреса
          </h2>
          <ul className="ac-channels">
            {CHANNELS.map((c, i) => (
              <li key={c.value} className="a-slide" style={{ ["--i" as string]: i, ["--dir" as string]: i % 2 ? 1 : -1 }}>
                <a
                  href={c.href}
                  target={c.external ? "_blank" : undefined}
                  rel={c.external ? "noopener noreferrer" : undefined}
                  className="ac-ch"
                >
                  <span className="ac-ch-icon" aria-hidden><Icon name={c.icon} size={20} /></span>
                  <span className="ac-ch-label a-wide">{c.label}</span>
                  <span className="ac-ch-value"><Breakable text={c.value} /></span>
                  <span className="ac-ch-sla">ответ {c.sla}</span>
                  <span className="ac-ch-go" aria-hidden><Icon name="arrow-right" size={22} /></span>
                  {c.external ? <span className="b-sr"> (откроется в новой вкладке)</span> : null}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 03 · Письмо — форма и маленькая карта ──────────────── */}
      <section className="a-sheet ac-form-sheet" data-sheet="15" data-title="Письмо" aria-labelledby="ac-form-title">
        <div className="a-field">
          <h2 id="ac-form-title" className="a-h2 a-settle">
            <span className="a-no">03</span>письмо
          </h2>

          <div className="ac-form-grid">
            <div className="ac-form-col">
              {sent ? (
                <div className="ac-done" role="status">
                  <h3 ref={doneRef} tabIndex={-1} className="ac-done-title">Письмо получено</h3>
                  <p className="a-p">
                    Получено в <b className="a-num">{sent.at}</b>. Ответим на <b>{sent.to}</b> — обычно в
                    течение четырёх рабочих часов. Если ответа нет, загляните в папку «Спам».
                  </p>
                  <Link href="/" className="a-btn a-btn-quiet">На главную</Link>
                </div>
              ) : (
                <form ref={formRef} onSubmit={handleSubmit} noValidate className="ac-form" aria-labelledby="ac-form-title">
                  <div className="px-field a-settle" style={{ ["--i" as string]: 1 }}>
                    <label className="px-label" htmlFor="ac-name">
                      Как к вам обращаться <span className="ac-req" aria-hidden>*</span>
                    </label>
                    <input
                      id="ac-name"
                      data-field="name"
                      className="px-input"
                      type="text"
                      autoComplete="name"
                      placeholder="Например, Александр"
                      value={name}
                      onChange={(e) => { setName(e.target.value); clear("name"); }}
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? "ac-name-err" : undefined}
                      aria-required="true"
                    />
                    {errors.name && <p className="px-field-error" id="ac-name-err">{errors.name}</p>}
                  </div>

                  <div className="px-field a-settle" style={{ ["--i" as string]: 2 }}>
                    <label className="px-label" htmlFor="ac-email">
                      Почта для ответа <span className="ac-req" aria-hidden>*</span>
                    </label>
                    <input
                      id="ac-email"
                      data-field="email"
                      className="px-input"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@mail.ru"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); clear("email"); }}
                      aria-invalid={errors.email ? true : undefined}
                      aria-describedby={errors.email ? "ac-email-err" : undefined}
                      aria-required="true"
                    />
                    {errors.email && <p className="px-field-error" id="ac-email-err">{errors.email}</p>}
                  </div>

                  {/* Тема — группа переключателей, а не выпадающий список:
                      вариантов пять, системное колесо на телефоне лишнее. */}
                  <fieldset
                    className="px-field a-settle"
                    style={{ ["--i" as string]: 3 }}
                    aria-describedby={errors.interest ? "ac-interest-err" : undefined}
                  >
                    <legend className="px-label">
                      Тема <span className="ac-req" aria-hidden>*</span>
                    </legend>
                    <div className="px-choice-row">
                      {INTERESTS.map((opt, i) => (
                        <button
                          key={opt.value}
                          type="button"
                          data-field={i === 0 ? "interest" : undefined}
                          className={`px-choice ac-choice${interest === opt.value ? " px-choice-on" : ""}`}
                          aria-pressed={interest === opt.value}
                          onClick={() => { setInterest(opt.value); clear("interest"); }}
                        >
                          <i className="ac-sym" data-sym={opt.sym} aria-hidden />
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {errors.interest && <p className="px-field-error" id="ac-interest-err">{errors.interest}</p>}
                  </fieldset>

                  <div className="px-field a-settle" style={{ ["--i" as string]: 4 }}>
                    <label className="px-label" htmlFor="ac-message">
                      Сообщение <span className="ac-opt">(необязательно)</span>
                    </label>
                    <textarea
                      id="ac-message"
                      className="px-input px-textarea"
                      rows={4}
                      placeholder="Что случилось или что хотите узнать"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>

                  {/* Живая область: без неё чтец экрана не узнает об отказе. */}
                  <p className="ac-status" role="alert" aria-live="assertive">{failure}</p>

                  <div className="ac-foot a-settle" style={{ ["--i" as string]: 5 }}>
                    <button type="submit" disabled={sending} className="a-btn a-btn-primary">
                      {sending ? "Отправляем…" : "Отправить письмо"}
                    </button>
                    <p className="a-fine">
                      Отправляя письмо, вы соглашаетесь с{" "}
                      <Link href="/privacy" className="ac-inline">политикой конфиденциальности</Link>.
                    </p>
                  </div>
                </form>
              )}
            </div>

            {/* Маленькая карта листа: пустое место ждёт письма, после
                отправки на нём появляется кобальтовая точка. */}
            <figure className="ac-chart a-print" data-sent={sent ? "" : undefined}>
              <svg viewBox="0 0 400 260" aria-hidden focusable="false">
                <g className="ac-contours a-idle">
                  {CONTOURS.map((d, i) => (
                    <path key={i} d={d} vectorEffect="non-scaling-stroke" />
                  ))}
                </g>
                {sent ? (
                  <g className="ac-point">
                    <circle className="ac-point-ring a-idle" cx="200" cy="130" r="16" />
                    <circle className="ac-point-dot" cx="200" cy="130" r="6" />
                  </g>
                ) : (
                  <circle className="ac-spot" cx="200" cy="130" r="18" />
                )}
              </svg>
              <figcaption className="a-wide">
                {sent ? `получено ${sent.at} · ответим на ${sent.to}` : "здесь появится ваше письмо"}
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {/* ── 04 · Финал ─────────────────────────────────────────── */}
      <section className="a-sheet a-plate a-final ac-final" data-sheet="15" data-title="Попробовать" aria-labelledby="ac-final-title">
        <div className="a-field">
          <h2 id="ac-final-title" className="a-h2">
            <span className="a-no">04</span>
            <Words text={`попробуйте ${TRIAL} бесплатно`} />
          </h2>
          <p className="a-p a-settle" style={{ ["--i" as string]: 6 }}>Без карты. Не понравится — просто не продлевайте.</p>
          <div className="a-actions a-settle" style={{ ["--i" as string]: 8 }}>
            <Link href="/auth" className="a-btn a-btn-invert a-idle">Начать бесплатно</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
