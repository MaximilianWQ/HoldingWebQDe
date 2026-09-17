"use client";

import { useState } from "react";
import Icon from "@/components/pixel/Icon";
import { formatRub, PLANS, DEVICE_LIMIT } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";

const FAQ: { q: string; a: string }[] = [
  {
    q: "Это сложно настроить?",
    a: "Нет. Войдите по почте, поставьте приложение и добавьте подписку — вручную ничего настраивать не нужно.",
  },
  {
    q: "Что будет, когда пробные дни закончатся?",
    a: `Ничего не спишется: карту для пробного периода мы не просим. Понравится — выберите тариф от ${formatRub(PLANS.basic[1])} ₽, нет — просто не продлевайте.`,
  },
  {
    q: "Заработает на моём устройстве?",
    a: `iPhone и iPad, Android, Windows, macOS и телевизор. Одна подписка — до ${DEVICE_LIMIT} ${plural(DEVICE_LIMIT, ["устройства", "устройств", "устройств"])}.`,
  },
  {
    q: "Можно выбрать страну?",
    a: `Да, все ${COUNTRY_COUNT} стран входят в любой тариф. Страна меняется в приложении в один тап.`,
  },
];

/** Короткий FAQ раскрывающимися карточками — плавная высота через
 *  `grid-template-rows: 0fr → 1fr` (vh-faq-panel), а не `<details>`:
 *  так закрытие анимируется так же гладко, как открытие. */
export default function FaqAccordion() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="vh-faq">
      {FAQ.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="vh-faq-item" data-open={isOpen ? "" : undefined}>
            <h3 style={{ margin: 0 }}>
              <button
                type="button"
                className="vh-faq-btn"
                aria-expanded={isOpen}
                aria-controls={`vh-faq-panel-${i}`}
                onClick={() => setOpen(isOpen ? null : i)}
              >
                <span>{f.q}</span>
                <span className="vh-faq-mark" aria-hidden><Icon name="chevron-down" size={16} /></span>
              </button>
            </h3>
            <div className="vh-faq-panel" id={`vh-faq-panel-${i}`} role="region">
              <div className="vh-faq-panel-in"><p>{f.a}</p></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
