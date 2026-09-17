import Link from "next/link";
import BrandMark from "@/components/pixel/BrandMark";
import { BRAND } from "./links";

/** Знак Atlas в синей плитке + имя. Формы знака — BrandMark (icon.tsx). */
export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="v-logo" aria-label={`${BRAND} — на главную`}>
      <span className="v-logo-mark" aria-hidden>
        <BrandMark size={18} />
      </span>
      <span>{BRAND}</span>
    </Link>
  );
}
