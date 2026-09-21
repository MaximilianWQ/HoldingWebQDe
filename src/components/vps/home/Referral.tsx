import Link from "next/link";
import Icon from "@/components/pixel/Icon";
import { LOYALTY_TIERS, CASHBACK_MAX, CASHBACK_START, tierName } from "@/lib/loyalty";
import { dict, fill } from "@/i18n";
import { pluralize } from "@/i18n/plural";
import type { Locale } from "@/lib/locale";

/**
 * «Приводите своих — возвращаем деньгами».
 *
 * Проценты и пороги — только из `src/lib/loyalty.ts` (ту же таблицу
 * считает кабинет). Формулировка осторожная: кешбэк приходит на баланс
 * внутри Atlas и тратится на продление — обещать вывод денег нельзя.
 * «+20 дней» не пишем: снято владельцем 12.09.2026.
 */
export default function Referral({ enter, locale }: { enter: string; locale: Locale }) {
  const d = dict(locale);
  const t = d.referral;
  return (
    <div className="vh-ref">
      <div className="vh-ref-head">
        <span className="v-tile-icon" aria-hidden><Icon name="coins" size={22} /></span>
        <h2 className="v-h2">{fill(t.title, { max: CASHBACK_MAX })}</h2>
        <p className="v-lead" style={{ marginInline: 0 }}>{t.lead}</p>
      </div>

      <ol className="vh-ref-steps">
        {LOYALTY_TIERS.map((tier, i) => (
          <li key={tier.tier} className="vh-ref-step" style={{ ["--i" as string]: i }}>
            <b className="vh-ref-pct">{tier.percent}%</b>
            <span className="vh-ref-when">
              {tier.from === 0
                ? t.fromFirst
                : fill(t.fromN, { n: tier.from, word: pluralize(locale, tier.from, t.payerWord) })}
            </span>
            <span className="vh-ref-tier">{tierName(tier, locale)}</span>
          </li>
        ))}
      </ol>

      <div className="v-actions" style={{ justifyContent: "flex-start" }}>
        <Link href={enter} prefetch={false} className="v-btn v-btn-white">{t.cta}</Link>
        <span className="vh-ref-note">{fill(t.note, { start: CASHBACK_START })}</span>
      </div>
    </div>
  );
}
