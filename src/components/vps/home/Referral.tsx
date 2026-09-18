import Link from "next/link";
import Icon from "@/components/pixel/Icon";
import { LOYALTY_TIERS, CASHBACK_MAX, CASHBACK_START } from "@/lib/loyalty";
import { plural } from "@/lib/ru-words";

/**
 * «Приводите своих — возвращаем деньгами».
 *
 * Проценты и пороги — только из `src/lib/loyalty.ts` (ту же таблицу
 * считает кабинет). Формулировка осторожная: кешбэк приходит на баланс
 * внутри Atlas и тратится на продление — обещать вывод денег нельзя.
 * «+20 дней» не пишем: снято владельцем 12.09.2026.
 */
export default function Referral({ enter }: { enter: string }) {
  return (
    <div className="vh-ref">
      <div className="vh-ref-head">
        <span className="v-tile-icon" aria-hidden><Icon name="coins" size={22} /></span>
        <h2 className="v-h2">
          Возвращаем до {CASHBACK_MAX}% с оплат тех, кого вы привели
        </h2>
        <p className="v-lead" style={{ marginInline: 0 }}>
          Ссылка появляется в кабинете сразу. Друг оплачивает подписку — часть суммы падает на ваш баланс и уходит
          в счёт следующего продления. Кешбэк идёт с каждой его оплаты, а не только с первой.
        </p>
      </div>

      <ol className="vh-ref-steps">
        {LOYALTY_TIERS.map((t, i) => (
          <li key={t.tier} className="vh-ref-step" style={{ ["--i" as string]: i }}>
            <b className="vh-ref-pct">{t.percent}%</b>
            <span className="vh-ref-when">
              {t.from === 0
                ? "с первой же оплаты приглашённого"
                : `с ${t.from} ${plural(t.from, ["оплатившего", "оплативших", "оплативших"])}`}
            </span>
            <span className="vh-ref-tier">{t.tier}</span>
          </li>
        ))}
      </ol>

      <div className="v-actions" style={{ justifyContent: "flex-start" }}>
        <Link href={enter} prefetch={false} className="v-btn v-btn-white">Забрать свою ссылку</Link>
        <span className="vh-ref-note">Старт — {CASHBACK_START}%, дальше ступени открываются сами</span>
      </div>
    </div>
  );
}
