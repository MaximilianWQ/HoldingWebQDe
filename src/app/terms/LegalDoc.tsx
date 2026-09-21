import VShell from "@/components/vps/VShell";
import type { Locale } from "@/lib/locale";
import "./legal-vps.css";

/**
 * Дата редакции словами на языке страницы. Источник даты один — ISO в
 * файле документа, формат выбирает язык: «19 сентября 2026» против
 * «19 September 2026». Хвост «г.», который приписывает русская
 * локаль, здесь лишний — в пилюле рядом с «Обновлено» он не нужен.
 */
export function legalDate(iso: string, locale: Locale): string {
  const f = new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return f.format(new Date(`${iso}T00:00:00Z`)).replace(/\s*г\.$/, "");
}

/**
 * Правовая страница на корпусе Atlas Secure VPS — общий каркас /terms и
 * /privacy. Текст разделов приходит со страницы и здесь не меняется.
 *
 * Заголовок и лид по центру, дата и версия — компактными пилюлями,
 * оглавление — горизонтальный ряд чипов (а не боковая колонка прежней
 * версии), текст читается в колонке ~720px, кегль 17px.
 *
 * `notice` — оговорка о языке (21.09.2026). Русский текст согласован и
 * имеет силу, английский дан для удобства, и английская версия обязана
 * сказать это первой строкой. На русской странице строка пустая, и
 * тогда её нет вовсе.
 */
export type LegalSection = { n: string; t: string; body: React.ReactNode };

export default function LegalDoc({
  sheetTitle,
  title,
  meta,
  notice,
  tocLabel,
  tocHead,
  sections,
}: {
  sheetTitle: string;
  title: string;
  meta: React.ReactNode[];
  /** Пустая строка — оговорки нет (русская версия). */
  notice: string;
  tocLabel: string;
  tocHead: string;
  sections: LegalSection[];
}) {
  return (
    <VShell>
      {/* 01 · заголовок */}
      <section className="v-section v-center" aria-labelledby="vl-title">
        <div className="v-wrap v-narrow v-stagger">
          <span className="v-chip" style={{ marginBottom: 20 }}>{sheetTitle}</span>
          <h1 id="vl-title" className="v-h1" style={{ fontSize: "clamp(32px, 5.4vw, 52px)" }}>{title}</h1>
          <ul className="vl-meta">
            {meta.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          {notice && <p className="vl-notice">{notice}</p>}
        </div>
      </section>

      {/* 02 · оглавление + текст */}
      <section className="v-section" aria-label={tocLabel} style={{ paddingTop: 0 }}>
        <div className="v-wrap">
          <nav className="vl-toc" aria-label={tocLabel}>
            <p className="v-small vl-toc-head">{tocHead}</p>
            <ol>
              {sections.map((s) => (
                <li key={s.n}>
                  <a href={`#s-${s.n}`}><b>{s.n}</b> {s.t}</a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="vl-text">
            {sections.map((s) => (
              <section key={s.n} id={`s-${s.n}`} className="vl-sec v-reveal" aria-labelledby={`s-${s.n}-t`}>
                <span className="vl-no" aria-hidden>{s.n}</span>
                <h2 id={`s-${s.n}-t`} className="vl-h2">{s.t}</h2>
                {s.body}
              </section>
            ))}
          </div>
        </div>
      </section>
    </VShell>
  );
}
