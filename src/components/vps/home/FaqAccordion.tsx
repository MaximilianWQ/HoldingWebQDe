"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import Icon from "@/components/pixel/Icon";
import { formatRub, PLANS, pricePerMonth, DEVICE_LIMIT } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";
import { POPULAR } from "../PlanCards";
import { SUPPORT_TG } from "../links";

/**
 * Возражения перед покупкой — шесть штук, в том порядке, в котором они
 * приходят в голову: «сколько в итоге», «сложно ли», «а на моём
 * устройстве», «а страна», «а что вы видите», «а если не подойдёт».
 *
 * Это не справка, а последний разговор перед кнопкой: каждый ответ
 * заканчивается тем, что человеку делать дальше. Про данные отвечаем
 * ссылкой на политику, а не обещанием «мы ничего не храним» — такое
 * утверждение нечем подтвердить (COMPLIANCE-CHECK.md).
 */
const FAQ: { q: string; a: ReactNode }[] = [
  {
    q: "Сколько это стоит, когда пробные дни закончатся?",
    a: (
      <>
        Ничего не спишется само: карту для пробного периода мы не просим. Понравится — тариф от{" "}
        {formatRub(PLANS.basic[1])} ₽ в месяц, а при оплате за полгода выходит{" "}
        {formatRub(pricePerMonth("basic", POPULAR))} ₽ в месяц. Не понравится — просто не продлевайте.
      </>
    ),
  },
  {
    q: "Это сложно настроить?",
    a: (
      <>
        Нет. Вход по почте, установка приложения, одна кнопка «Добавить подписку» — обычно минута. Ничего
        прописывать руками не нужно, пошагово всё показано в <Link href="/devices">инструкциях</Link>.
      </>
    ),
  },
  {
    q: "Заработает на моём устройстве?",
    a: (
      <>
        iPhone и iPad, Android, Windows, macOS и телевизор. Одна подписка работает на {DEVICE_LIMIT}{" "}
        {plural(DEVICE_LIMIT, ["устройстве", "устройствах", "устройствах"])} сразу — телефон, ноутбук и телевизор
        не придётся выбирать.
      </>
    ),
  },
  {
    q: "Можно выбрать страну?",
    a: (
      <>
        Да, все {COUNTRY_COUNT} стран входят в любой тариф, менять можно сколько угодно раз — это список в
        приложении, а не отдельная покупка.
      </>
    ),
  },
  {
    q: "Что видно из моего трафика?",
    a: (
      <>
        Соединение шифруется на вашем устройстве и расшифровывается только на нашем сервере: провайдер и
        публичный Wi-Fi видят зашифрованный поток, а не адреса сайтов. Что мы храним для работы сервиса и
        сколько — в <Link href="/privacy">политике конфиденциальности</Link>.
      </>
    ),
  },
  {
    q: "А если не подойдёт?",
    a: (
      <>
        Для этого и есть {TRIAL_DAYS} {plural(TRIAL_DAYS, ["день", "дня", "дней"])} без карты — проверьте скорость
        на своих сервисах. Если уже оплатили и что-то пошло не так, напишите в поддержку{" "}
        <a href={SUPPORT_TG.href} target="_blank" rel="noopener noreferrer">{SUPPORT_TG.handle}</a> — разберёмся
        и вернём деньги.
      </>
    ),
  },
];

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
