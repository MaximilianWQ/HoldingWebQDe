"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import Icon from "@/components/pixel/Icon";
import { RESUME_ACCEPT, RESUME_EXTENSIONS, RESUME_HINT, RESUME_MAX_BYTES, RESUME_MAX_MB } from "@/lib/careers";
import { TELEGRAM_SUPPORT } from "@/lib/contacts";

/**
 * Форма отклика на вакансию (владелец, 19.09.2026: «форма обратной
 * связи с загрузкой файлов резюме»).
 *
 * Форма живёт ВНУТРИ раскрытой вакансии, а не в отдельном окне.
 * Человек только что прочитал требования — ответ он пишет там же, где
 * читал, и может свериться с текстом, не закрывая форму. Окно поверх
 * страницы пришлось бы ещё и удерживать фокус, и закрывать по Esc, и
 * возвращать прокрутку: три источника ошибок ради того же результата.
 *
 * ПРОВЕРКА — ПОЛЕ ЗА ПОЛЕМ, у своего поля (правило корпуса). Браузерную
 * проверку выключаем (`noValidate`): её подсказка всплывает по-английски
 * и исчезает сама. Фокус уходит на первое неверное поле — иначе на
 * телефоне человек видит «исправьте» и не понимает, где.
 *
 * ФАЙЛ. Родное поле выбора файла спрятано (`.tc-f-file input`), кнопкой
 * служит его же `<label>`: вид у родного поля свой в каждом браузере, а
 * вокруг — тёмный корпус. Само поле остаётся в разметке и остаётся
 * доступным с клавиатуры, имя выбранного файла печатается рядом.
 *
 * РАЗМЕР ПРОВЕРЯЕТСЯ ЗДЕСЬ ТОЖЕ, хотя сервер проверит ещё раз: отдавать
 * пять мегабайт по мобильной сети, чтобы получить «слишком большой», —
 * это минута ожидания впустую.
 */
type Status = "idle" | "sending" | "sent";
type Errors = Partial<Record<"name" | "email" | "resume" | "consent" | "form", string>>;

const MAX_MESSAGE = 2000;

export default function ApplyForm({ vacancyId, vacancyTitle }: { vacancyId: string; vacancyTitle: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Errors>({});
  const [fileName, setFileName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const uid = vacancyId;

  const focusFirst = (keys: Array<keyof Errors>, found: Errors) => {
    const first = keys.find((k) => found[k]);
    if (!first) return;
    const el = formRef.current?.querySelector<HTMLElement>(`[data-field="${first}"]`);
    el?.focus();
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;

    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const file = data.get("resume");
    const consent = data.get("consent") === "yes";

    const found: Errors = {};
    if (!name) found.name = "Как к вам обращаться?";
    if (!email) found.email = "Без почты мы не сможем ответить.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) found.email = "Проверьте адрес: похоже, есть опечатка.";

    if (!(file instanceof File) || file.size === 0) {
      found.resume = "Приложите резюме файлом.";
    } else if (file.size > RESUME_MAX_BYTES) {
      found.resume = `Файл больше ${RESUME_MAX_MB} МБ. Сохраните резюме в PDF — станет легче.`;
    } else {
      const dot = file.name.lastIndexOf(".");
      const ext = dot === -1 ? "" : file.name.slice(dot).toLowerCase();
      if (!(RESUME_EXTENSIONS as readonly string[]).includes(ext)) {
        found.resume = "Такой формат мы не принимаем. Подойдёт PDF или DOCX.";
      }
    }
    if (!consent) found.consent = "Без согласия мы не вправе хранить резюме.";

    if (Object.keys(found).length) {
      setErrors(found);
      focusFirst(["name", "email", "resume", "consent"], found);
      return;
    }

    setErrors({});
    setStatus("sending");
    data.set("vacancyId", vacancyId);

    try {
      const res = await fetch("/api/careers/apply", { method: "POST", body: data });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setStatus("idle");
        setErrors({ form: json?.error || "Не удалось отправить отклик. Попробуйте ещё раз." });
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("idle");
      setErrors({ form: "Отклик не ушёл — похоже, пропала связь. Попробуйте ещё раз." });
    }
  };

  if (status === "sent") {
    return (
      <div className="tc-f-done" role="status">
        <span className="tc-f-done-mark" aria-hidden><Icon name="check" size={20} /></span>
        <p className="tc-f-done-h">Отклик у нас</p>
        <p className="tc-f-done-t">
          Резюме на вакансию «{vacancyTitle}» доставлено. Прочитаем и ответим на указанную почту. Если
          хочется быстрее —{" "}
          <a href={TELEGRAM_SUPPORT.href} target="_blank" rel="noopener noreferrer">напишите в Telegram</a>.
        </p>
      </div>
    );
  }

  return (
    <form ref={formRef} className="tc-form" onSubmit={onSubmit} noValidate>
      <p className="t-label">Отклик на вакансию</p>

      <div className="tc-f-grid">
        <div className="tc-f">
          <label className="tc-f-label" htmlFor={`f-name-${uid}`}>Имя</label>
          <input
            id={`f-name-${uid}`}
            name="name"
            data-field="name"
            className="tc-f-input"
            type="text"
            autoComplete="name"
            maxLength={120}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? `e-name-${uid}` : undefined}
          />
          {errors.name && <p className="tc-f-err" id={`e-name-${uid}`}>{errors.name}</p>}
        </div>

        <div className="tc-f">
          <label className="tc-f-label" htmlFor={`f-email-${uid}`}>Почта</label>
          <input
            id={`f-email-${uid}`}
            name="email"
            data-field="email"
            className="tc-f-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? `e-email-${uid}` : undefined}
          />
          {errors.email && <p className="tc-f-err" id={`e-email-${uid}`}>{errors.email}</p>}
        </div>

        <div className="tc-f">
          <label className="tc-f-label" htmlFor={`f-contact-${uid}`}>
            Telegram или телефон <span className="tc-f-opt">— если так удобнее</span>
          </label>
          <input
            id={`f-contact-${uid}`}
            name="contact"
            className="tc-f-input"
            type="text"
            maxLength={120}
            autoComplete="off"
          />
        </div>

        <div className="tc-f tc-f-wide">
          <span className="tc-f-label" id={`l-resume-${uid}`}>Резюме</span>
          <div className="tc-f-file">
            <input
              id={`f-resume-${uid}`}
              name="resume"
              data-field="resume"
              type="file"
              accept={RESUME_ACCEPT}
              aria-labelledby={`l-resume-${uid}`}
              aria-invalid={errors.resume ? true : undefined}
              aria-describedby={`h-resume-${uid}${errors.resume ? ` e-resume-${uid}` : ""}`}
              onChange={(e) => {
                const f = e.currentTarget.files?.[0];
                setFileName(f ? f.name : null);
                if (errors.resume) setErrors((p) => ({ ...p, resume: undefined }));
              }}
            />
            <label className="tc-f-file-btn" htmlFor={`f-resume-${uid}`}>
              <Icon name="download" size={16} />
              {fileName ? "Заменить файл" : "Выбрать файл"}
            </label>
            <span className="tc-f-file-name">{fileName ?? "Файл не выбран"}</span>
          </div>
          <p className="tc-f-hint" id={`h-resume-${uid}`}>{RESUME_HINT}</p>
          {errors.resume && <p className="tc-f-err" id={`e-resume-${uid}`}>{errors.resume}</p>}
        </div>

        <div className="tc-f tc-f-wide">
          <label className="tc-f-label" htmlFor={`f-msg-${uid}`}>
            Пара слов о себе <span className="tc-f-opt">— необязательно</span>
          </label>
          <textarea
            id={`f-msg-${uid}`}
            name="message"
            className="tc-f-input tc-f-area"
            rows={4}
            maxLength={MAX_MESSAGE}
            placeholder="Над чем работали, что получилось лучше всего"
          />
        </div>
      </div>

      <div className="tc-f-consent">
        <input
          id={`f-consent-${uid}`}
          name="consent"
          data-field="consent"
          type="checkbox"
          value="yes"
          aria-invalid={errors.consent ? true : undefined}
          aria-describedby={errors.consent ? `e-consent-${uid}` : undefined}
          onChange={() => errors.consent && setErrors((p) => ({ ...p, consent: undefined }))}
        />
        <label htmlFor={`f-consent-${uid}`}>
          Согласен на обработку данных резюме для рассмотрения на эту вакансию —{" "}
          <Link href="/privacy" target="_blank">как мы их храним</Link>.
        </label>
      </div>
      {errors.consent && <p className="tc-f-err" id={`e-consent-${uid}`}>{errors.consent}</p>}

      {errors.form && <p className="tc-f-err tc-f-err-form" role="alert">{errors.form}</p>}

      <div className="t-actions">
        <button type="submit" className="t-btn" disabled={status === "sending"}>
          {status === "sending" ? "Отправляем…" : "Отправить отклик"}
          {status === "sending" ? null : <Icon name="arrow-right" size={16} />}
        </button>
      </div>
    </form>
  );
}
