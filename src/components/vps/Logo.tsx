import Link from "next/link";
import BrandMark from "@/components/pixel/BrandMark";
import { BRAND } from "./links";

/**
 * Знак Atlas в синей плитке + имя. Формы знака — BrandMark (icon.tsx).
 *
 * `home` — подпись ссылки для экранного диктора. Она переводится, а имя
 * бренда нет: «Atlas Secure VPS» одинаково на обоих языках.
 */
export default function Logo({ href = "/", home = "на главную" }: { href?: string; home?: string }) {
  return (
    <Link href={href} className="v-logo" aria-label={`${BRAND} — ${home}`}>
      <span className="v-logo-mark" aria-hidden>
        <BrandMark size={18} />
      </span>
      <span>{BRAND}</span>
    </Link>
  );
}
