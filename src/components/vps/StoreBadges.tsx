import { STORE } from "./links";
import Icon from "@/components/pixel/Icon";

/** Значки App Store и Google Play (приложение Happ) + ссылка для Windows. */
export default function StoreBadges({ windows = true }: { windows?: boolean }) {
  return (
    <div className="v-stores">
      <div className="v-store-row">
        <a className="v-store" href={STORE.googlePlay} target="_blank" rel="noopener noreferrer">
          <svg width="30" height="32" viewBox="0 0 30 32" aria-hidden>
            <path d="M1.2 1.1 16.8 16 1.2 30.9c-.5-.3-.8-.9-.8-1.6V2.7c0-.7.3-1.3.8-1.6z" fill="#00D7FE" />
            <path d="M21.9 11.1 16.8 16 1.2 1.1c.3-.2.8-.3 1.2-.2.3 0 .5.1.8.3z" fill="#00F076" />
            <path d="M21.9 20.9 3.2 31.3c-.3.2-.6.3-.8.3-.4 0-.8-.1-1.2-.3L16.8 16z" fill="#FF3A44" />
            <path d="m28.2 14.4-6.3-3.3-5.1 4.9 5.1 4.9 6.3-3.3c1.3-.7 1.3-2.5 0-3.2z" fill="#FFD400" />
          </svg>
          <span><small>Доступно в</small><b>Google Play</b></span>
        </a>
        <a className="v-store" href={STORE.appStore} target="_blank" rel="noopener noreferrer">
          <svg width="28" height="34" viewBox="0 0 28 34" fill="#FFFFFF" aria-hidden>
            <path d="M23.3 18.1c0-4.3 3.5-6.4 3.7-6.5-2-2.9-5.2-3.4-6.3-3.4-2.7-.3-5.2 1.6-6.6 1.6-1.4 0-3.5-1.5-5.7-1.5-2.9 0-5.6 1.7-7.1 4.4-3 5.3-.8 13.1 2.2 17.4 1.4 2.1 3.1 4.4 5.4 4.3 2.2-.1 3-1.4 5.6-1.4s3.4 1.4 5.7 1.4c2.4 0 3.9-2.1 5.3-4.2 1.7-2.4 2.4-4.8 2.4-4.9-.1 0-4.6-1.8-4.6-7.2zM19 5.4c1.2-1.4 2-3.4 1.8-5.4-1.7.1-3.8 1.2-5 2.6-1.1 1.3-2.1 3.3-1.8 5.3 1.9.1 3.8-1 5-2.5z" />
          </svg>
          <span><small>Загрузите в</small><b>App Store</b></span>
        </a>
      </div>
      {windows ? (
        <a className="v-store-link v-link" href={STORE.windows} target="_blank" rel="noopener noreferrer">
          <Icon name="windows" size={22} /> Скачать для компьютера
        </a>
      ) : null}
    </div>
  );
}
