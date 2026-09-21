import type { Metadata } from "next";
import VShell from "@/components/vps/VShell";
import Lost404 from "@/components/vps/Lost404";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { dict, fill } from "@/i18n";
import { count } from "@/lib/text/plural";
import { getLocale } from "@/lib/locale-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: dict(await getLocale()).lost.metaTitle, robots: { index: false } };
}

/**
 * 404 — корпус Atlas Secure VPS. Разворот «текст слева, объёмные цифры
 * справа» (владелец, 19.09.2026, с референсом-заставкой). Сама сцена и
 * решения по ней — `Lost404.tsx`: там же написано, что взято у
 * референса, а что намеренно нет.
 *
 * Страница остаётся серверной ради metadata; клиентская часть — только
 * сцена, которой нужен курсор.
 */
export default async function NotFound() {
  const locale = await getLocale();
  const d = dict(locale);
  return (
    <VShell>
      <Lost404
        locale={locale}
        t={d.lost}
        note={fill(d.lost.noteBefore, { trial: count(locale, TRIAL_DAYS, d.units.day) })}
      />
    </VShell>
  );
}
