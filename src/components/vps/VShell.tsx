import type { ReactNode } from "react";
import VHeader from "./VHeader";
import VFooter from "./VFooter";
import ToastProvider from "./Toast";
import "@/app/vps.css";

/**
 * Оболочка страницы корпуса Atlas Secure VPS.
 * `work` — рабочие экраны (вход, кабинет, оплата): короткий подвал,
 * в шапке «Кабинет» вместо «Войти», если человек внутри.
 */
export default function VShell({
  children,
  work = false,
  account = "guest",
}: {
  children: ReactNode;
  work?: boolean;
  account?: "guest" | "member";
}) {
  return (
    <div className="v">
      <ToastProvider>
        <a href="#main" className="b-skip">К содержимому</a>
        <VHeader account={account} />
        <main id="main">{children}</main>
        <VFooter slim={work} />
      </ToastProvider>
    </div>
  );
}
