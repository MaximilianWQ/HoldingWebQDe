import Icon from "@/components/pixel/Icon";
import { COUNTRY_COUNT } from "@/lib/locations";

/**
 * «Что происходит, когда вы нажимаете «Подключить»» — схема из трёх
 * узлов и двух линий между ними.
 *
 * Зачем блок. Главное возражение к такому продукту — не цена, а
 * непонимание: человек не знает, что именно меняется в его интернете,
 * и достраивает картину сам («наверное, что-то сложное и, наверное,
 * медленное»). Схема отвечает на это за один взгляд.
 *
 * Как устроено движение. Ни одной холостой анимации: линии заполняются
 * и пакеты едут по ним ровно настолько, насколько прокручен раздел
 * (`animation-timeline: view()` в home-vps.css, раздел 5). Читатель сам
 * прогоняет пакет по туннелю — это его действие, а не мигание на
 * странице. Без поддержки шкалы прокрутки и при `reduced-motion` схема
 * отрисована в конечном виде: заполненные линии, пакеты на местах.
 */
export default function TunnelFlow() {
  return (
    <div className="vh-flow">
      <div className="vh-flow-node vh-flow-a">
        <span className="vh-flow-icon" aria-hidden><Icon name="devices" size={22} /></span>
        <b>Ваше устройство</b>
        <span>Приложение шифрует трафик прямо здесь — до того, как он ушёл в сеть</span>
      </div>

      <div className="vh-flow-link vh-flow-link-1" aria-hidden>
        <i className="vh-flow-rail" />
        <i className="vh-flow-fill" />
        <i className="vh-flow-pk" />
        <span className="vh-flow-tag"><Icon name="lock" size={14} /> закрытый канал</span>
      </div>

      <div className="vh-flow-node vh-flow-b">
        <span className="vh-flow-icon" aria-hidden><Icon name="globe" size={22} /></span>
        <b>Сервер Atlas</b>
        <span>Страна на выбор из {COUNTRY_COUNT} — меняется в приложении одним касанием</span>
      </div>

      <div className="vh-flow-link vh-flow-link-2" aria-hidden>
        <i className="vh-flow-rail" />
        <i className="vh-flow-fill" />
        <i className="vh-flow-pk" />
        <span className="vh-flow-tag">полная скорость</span>
      </div>

      <div className="vh-flow-node vh-flow-c">
        <span className="vh-flow-icon" aria-hidden><Icon name="bolt" size={22} /></span>
        <b>Сайт или сервис</b>
        <span>Видит адрес выбранной страны и отдаёт контент без ограничений</span>
      </div>
    </div>
  );
}
