/** «Работает в приложениях Happ и Incy» — текстовые логотипы-пилюли
 *  (своя типографика, без сторонних SVG-логотипов). */
export default function AppsRow() {
  return (
    <div className="vh-apps">
      <p className="vh-apps-label">Работает в приложениях</p>
      <div className="vh-apps-row">
        <span className="vh-apps-pill"><i aria-hidden />Happ</span>
        <span className="vh-apps-pill"><i aria-hidden />Incy</span>
      </div>
    </div>
  );
}
