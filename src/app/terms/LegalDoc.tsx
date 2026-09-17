import VShell from "@/components/vps/VShell";
import "./legal-vps.css";

/**
 * Правовая страница на корпусе Atlas Secure VPS — общий каркас /terms и
 * /privacy. Текст разделов приходит со страницы и здесь не меняется.
 *
 * Заголовок и лид по центру, дата и версия — компактными пилюлями,
 * оглавление — горизонтальный ряд чипов (а не боковая колонка прежней
 * версии), текст читается в колонке ~720px, кегль 17px.
 */
export type LegalSection = { n: string; t: string; body: React.ReactNode };

export default function LegalDoc({
  sheetTitle,
  title,
  meta,
  tocLabel,
  sections,
}: {
  sheetTitle: string;
  title: string;
  meta: React.ReactNode[];
  tocLabel: string;
  sections: LegalSection[];
}) {
  return (
    <VShell>
      {/* 01 · заголовок */}
      <section className="v-section v-center" aria-labelledby="vl-title">
        <div className="v-wrap v-narrow">
          <span className="v-chip" style={{ marginBottom: 20 }}>{sheetTitle}</span>
          <h1 id="vl-title" className="v-h1" style={{ fontSize: "clamp(32px, 5.4vw, 52px)" }}>{title}</h1>
          <ul className="vl-meta">
            {meta.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 02 · оглавление + текст */}
      <section className="v-section" aria-label={tocLabel} style={{ paddingTop: 0 }}>
        <div className="v-wrap">
          <nav className="vl-toc" aria-label={tocLabel}>
            <p className="v-small vl-toc-head">Содержание</p>
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
              <section key={s.n} id={`s-${s.n}`} className="vl-sec" aria-labelledby={`s-${s.n}-t`}>
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
