import Icon, { type IconName } from "@/components/pixel/Icon";
import { SUPPORT_TG, TRIAL } from "../links";

/**
 * Полоса снятия возражений — сразу под первым экраном.
 *
 * Здесь НЕ числа продукта (они ниже, в бенто), а четыре причины, по
 * которым человек закрывает страницу, не попробовав: «сейчас попросят
 * карту», «потом будут списывать», «это сложно настроить», «не у кого
 * спросить». Каждая закрыта одной строкой — до того, как посетитель
 * начнёт читать про скорость.
 */
const PROOF: { icon: IconName; title: string; note: string }[] = [
  { icon: "check", title: "Карта не нужна", note: `Пробные ${TRIAL} — без платёжных данных` },
  { icon: "refresh", title: "Без автосписаний", note: "Оплата разовая: продлеваете, когда решите" },
  { icon: "bolt", title: "Минута на подключение", note: "Приложение, ключ — и всё работает" },
  { icon: "chat", title: "Живая поддержка", note: `Ответим в Telegram — ${SUPPORT_TG.handle}` },
];

export default function ProofBar() {
  return (
    <ul className="vh-proof">
      {PROOF.map((p, i) => (
        <li key={p.title} className="vh-proof-item" style={{ ["--i" as string]: i }}>
          <span className="vh-proof-icon" aria-hidden><Icon name={p.icon} size={18} /></span>
          <b>{p.title}</b>
          <span>{p.note}</span>
        </li>
      ))}
    </ul>
  );
}
