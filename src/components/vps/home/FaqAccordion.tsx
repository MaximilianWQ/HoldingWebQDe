"use client";

import { useState, type ReactNode } from "react";
import Icon from "@/components/pixel/Icon";

/**
 * Возражения перед покупкой — шесть штук, в том порядке, в котором они
 * приходят в голову: «сколько в итоге», «сложно ли», «а на моём
 * устройстве», «а страна», «а что вы видите», «а если не подойдёт».
 *
 * Это не справка, а последний разговор перед кнопкой: каждый ответ
 * заканчивается тем, что человеку делать дальше. Про данные отвечаем
 * ссылкой на политику, а не обещанием «мы ничего не храним» — такое
 * утверждение нечем подтвердить (COMPLIANCE-CHECK.md).
 *
 * Сами вопросы и ответы живут в словаре (`home.faq.items`) и приходят
 * готовыми: компонент клиентский — здесь только раскрытие. Ссылки
 * внутри ответов проставляет `rich()` на стороне сервера, поэтому
 * переводчик волен ставить их в любое место фразы.
 */
export default function FaqAccordion({ items }: { items: { q: string; a: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="vh-faq">
      {items.map((f, i) => {
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
