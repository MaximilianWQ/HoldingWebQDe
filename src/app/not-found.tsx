import Link from "next/link";
import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import { TRIAL } from "@/components/vps/links";

export const metadata: Metadata = {
  title: "Страница не найдена",
  robots: { index: false },
};

/**
 * 404 — корпус Atlas Secure VPS. Простой экран: заголовок, короткая
 * фраза, кнопка на главную. Декоративная карта прежней версии («белое
 * пятно» на «Атлас-издании») снята при переводе — брифом для этого
 * экрана явно просит «просто экран „Страница не найдена“».
 */
export default function NotFound() {
  return (
    <VShell>
      <section className="v-section v-center v-glow" aria-labelledby="v-404-title">
        <div className="v-wrap v-narrow v-stagger">
          <h1 id="v-404-title" className="v-h1">
            Страница <span className="v-accent">не найдена</span>
          </h1>
          <p className="v-lead">
            Возможно, в адресе опечатка или страница переехала. Начните с главной — первые {TRIAL}{" "}
            бесплатно, без карты.
          </p>
          <div className="v-actions">
            <Link href="/" className="v-btn v-btn-primary">На главную</Link>
            <Link href="/pricing" className="v-btn v-btn-soft">Тарифы</Link>
          </div>
        </div>
      </section>
    </VShell>
  );
}
