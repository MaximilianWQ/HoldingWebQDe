import Icon from "@/components/pixel/Icon";
import { COUNTRY_COUNT } from "@/lib/locations";
import { DEVICE_LIMIT, PLAN_SPEED } from "@/lib/plans";
import { TRIAL_DAYS } from "@/lib/brand-facts";
import { plural } from "@/lib/ru-words";

/**
 * Бенто «Почему Atlas Secure VPS» — шесть плиток, числа только из
 * src/lib. Появление — `.v-reveal`, приподнимание под курсором —
 * `.v-lift` (оба приёма уже есть в vps.css, раздел 13a).
 */
export default function WhyBento() {
  return (
    <div className="v-bento vh-bento">
      <article className="v-span-2 v-tile v-tile-blue v-lift">
        <span className="v-tile-icon"><Icon name="globe" size={22} /></span>
        <h3>Серверы по всему миру</h3>
        <p>Выбирайте ближайшую страну в приложении</p>
        <div className="vh-tile-fig"><b>{COUNTRY_COUNT}</b><span>{plural(COUNTRY_COUNT, ["страна", "страны", "стран"])}</span></div>
      </article>
      <article className="v-span-2 v-tile v-lift">
        <span className="v-tile-icon"><Icon name="devices" size={22} /></span>
        <h3>Все устройства сразу</h3>
        <p>Телефон, ноутбук и телевизор — одной подпиской</p>
        <div className="vh-tile-fig"><b>{DEVICE_LIMIT}</b><span>{plural(DEVICE_LIMIT, ["устройство", "устройства", "устройств"])}</span></div>
      </article>
      <article className="v-span-2 v-tile v-tile-dark v-lift">
        <span className="v-tile-icon"><Icon name="bolt" size={22} /></span>
        <h3>Высокая скорость</h3>
        <p>Канал Basic и Plus</p>
        <div className="vh-tile-fig"><b>{PLAN_SPEED.basic}–{PLAN_SPEED.plus}</b><span>Гбит/с</span></div>
      </article>
      <article className="v-span-2 v-tile v-lift">
        <span className="v-tile-icon"><Icon name="clock" size={22} /></span>
        <h3>Пробный доступ</h3>
        <p>Без карты и без обязательств</p>
        <div className="vh-tile-fig"><b>{TRIAL_DAYS}</b><span>{plural(TRIAL_DAYS, ["день", "дня", "дней"])} бесплатно</span></div>
      </article>
      <article className="v-span-2 v-tile v-lift">
        <span className="v-tile-icon"><Icon name="check" size={22} /></span>
        <h3>Без автосписаний</h3>
        <p>Оплата разовая — продлеваете, когда сами решите.</p>
      </article>
      <article className="v-span-2 v-tile v-tile-blue v-lift">
        <span className="v-tile-icon"><Icon name="lock" size={22} /></span>
        <h3>Шифрование трафика</h3>
        <p>Данные защищены на всём пути от устройства до сервера.</p>
      </article>
    </div>
  );
}
