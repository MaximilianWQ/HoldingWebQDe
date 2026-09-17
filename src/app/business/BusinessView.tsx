"use client";

import Icon, { type IconName } from "@/components/pixel/Icon";
import BusinessRequestForm from "./BusinessRequestForm";
import { DEVICE_LIMIT } from "@/lib/plans";
import { COUNTRY_COUNT } from "@/lib/locations";
import { plural } from "@/lib/ru-words";
import "@/app/vps-info.css";

/**
 * /business — тело страницы, корпус Atlas Secure VPS (владелец,
 * 17.09.2026: «очень простой, очень приятный сайт стилистики Apple»).
 * Обёртку `VShell` и метаданные держит `page.tsx`.
 *
 * Короткое предложение, четыре пункта пользы, одна форма заявки.
 * Цен на странице нет — корпоративный расчёт зависит от числа мест.
 * Форма и есть финальное действие страницы.
 */
const POINTS: Array<{ icon: IconName; title: string; text: string }> = [
  {
    icon: "receipt",
    title: "Один счёт на всю команду",
    text: "Подключения — в общем аккаунте компании. Договор, акты и счета-фактуры по безналичному расчёту.",
  },
  {
    icon: "key",
    title: "Управление доступами",
    text: "Администратор компании выдаёт и отзывает доступ сам — в тот же день, вместе со всеми устройствами.",
  },
  {
    icon: "devices",
    title: `До ${DEVICE_LIMIT} ${plural(DEVICE_LIMIT, ["устройства", "устройств", "устройств"])} на человека`,
    text: "Ноутбук, телефон, планшет, рабочий компьютер — одно место закрывает все устройства сотрудника.",
  },
  {
    icon: "globe",
    title: `${COUNTRY_COUNT} ${plural(COUNTRY_COUNT, ["страна", "страны", "стран"])} на выбор`,
    text: "Страну выбирает сотрудник или назначает администратор — в зависимости от нужных сервисов.",
  },
];

export default function BusinessView() {
  return (
    <>
      <section className="v-section v-center" aria-labelledby="v-business-title">
        <div className="v-wrap v-narrow">
          <h1 id="v-business-title" className="v-h1">
            Интернет и серверы <span className="v-accent">для команды</span>
          </h1>
          <p className="v-lead">
            Подключения для сотрудников и серверы под задачи — по договору, на одном счёте. Расчёт —
            в течение четырёх рабочих часов.
          </p>
          <div className="v-actions">
            <a href="#request" className="v-btn v-btn-primary">Получить расчёт</a>
            <a href="mailto:sales@atlas.secure" className="v-btn v-btn-soft">sales@atlas.secure</a>
          </div>
        </div>
      </section>

      <section className="v-section" style={{ paddingTop: 0 }} aria-label="Что входит">
        <div className="v-wrap v-narrow">
          <div className="vp-points">
            {POINTS.map((p) => (
              <div key={p.title} className="vp-point">
                <span className="vp-point-mark" aria-hidden><Icon name={p.icon} size={20} /></span>
                <div>
                  <b>{p.title}</b>
                  <p>{p.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="v-section v-center" id="request" aria-labelledby="request-title">
        <div className="v-wrap v-narrow">
          <h2 id="request-title" className="v-h2">Расскажите про команду</h2>
          <p className="v-lead" style={{ marginBottom: 8 }}>Ответим письмом с расчётом и проектом договора.</p>
          <div style={{ marginTop: 32, textAlign: "left" }}>
            <BusinessRequestForm />
          </div>
        </div>
      </section>
    </>
  );
}
