import Icon, { type IconName } from "@/components/pixel/Icon";
import { SUPPORT_TG } from "../links";
import { dict, fill } from "@/i18n";
import { count } from "@/lib/text/plural";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import type { Locale } from "@/lib/locale";

/**
 * Полоса снятия возражений — сразу под первым экраном.
 *
 * Здесь НЕ числа продукта (они ниже, в бенто), а четыре причины, по
 * которым человек закрывает страницу, не попробовав: «сейчас попросят
 * карту», «потом будут списывать», «это сложно настроить», «не у кого
 * спросить». Каждая закрыта одной строкой — до того, как посетитель
 * начнёт читать про скорость.
 *
 * Значки стоят здесь, а текст — в словаре: значок не переводится, и
 * порядок пунктов задан значками, а не словами.
 */
const ICONS: IconName[] = ["check", "refresh", "bolt", "chat"];

export default function ProofBar({ locale }: { locale: Locale }) {
  const d = dict(locale);
  const vars = { trial: count(locale, TRIAL_DAYS, d.units.day), tg: SUPPORT_TG.handle };
  return (
    <ul className="vh-proof">
      {d.home.proof.map((p, i) => (
        <li key={p.title} className="vh-proof-item" style={{ ["--i" as string]: i }}>
          <span className="vh-proof-icon" aria-hidden><Icon name={ICONS[i]} size={18} /></span>
          <b>{fill(p.title, vars)}</b>
          <span>{fill(p.note, vars)}</span>
        </li>
      ))}
    </ul>
  );
}
