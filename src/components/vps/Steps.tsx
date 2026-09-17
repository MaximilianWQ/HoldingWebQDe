import Link from "next/link";
import Icon from "@/components/pixel/Icon";
import StoreBadges from "./StoreBadges";

/** Три шага подключения — пунктирная рамка, синие галочки. */
export default function Steps({ keyHref = "/dashboard" }: { keyHref?: string }) {
  return (
    <ol className="v-steps">
      <li className="v-step">
        <div className="v-step-head"><span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span><h3>Установите Happ на своё устройство</h3></div>
        <p>Бесплатное приложение для iPhone, Android, компьютера и телевизора.</p>
        <StoreBadges />
      </li>
      <li className="v-step">
        <div className="v-step-head"><span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span><h3>Добавьте подписку в Happ</h3></div>
        <p>Нажмите кнопку — откроется приложение, и подписка добавится автоматически.</p>
        <Link href={keyHref} prefetch={false} className="v-btn v-btn-outline v-btn-block">Получить подписку</Link>
      </li>
      <li className="v-step">
        <div className="v-step-head"><span className="v-step-check" aria-hidden><Icon name="check" size={18} /></span><h3>Подключитесь и пользуйтесь</h3></div>
        <p>Выберите страну из списка и нажмите кнопку включения на главном экране приложения.</p>
        <Link href="/support" className="v-btn v-btn-primary v-btn-block"><Icon name="chat" size={20} /> Поддержка</Link>
      </li>
    </ol>
  );
}
