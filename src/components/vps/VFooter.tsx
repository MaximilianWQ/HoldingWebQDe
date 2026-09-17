import Link from "next/link";
import Logo from "./Logo";
import { FOOT_LINKS, FOOT_APPS, BRAND } from "./links";
import { COUNTRY_COUNT } from "@/lib/locations";
import { FOUNDED } from "@/lib/nav";

/**
 * Подвал — чёрная плита: знак, одна фраза о продукте, реквизиты,
 * ссылки. `slim` — рабочие экраны (кабинет, оплата, вход): только
 * реквизиты и документы.
 */
export default function VFooter({ slim = false }: { slim?: boolean }) {
  const year = new Date().getFullYear();
  const span = year > FOUNDED ? `${FOUNDED}–${year}` : String(FOUNDED);
  if (slim) {
    return (
      <footer className="v-foot v-foot-slim">
        <div className="v-wrap">
          <p className="v-foot-copy" style={{ margin: 0 }}>
            © {span} {BRAND} · часть группы QoDev · <Link href="/terms" style={{ color: "inherit" }}>Соглашение</Link> ·{" "}
            <Link href="/privacy" style={{ color: "inherit" }}>Конфиденциальность</Link>
          </p>
        </div>
      </footer>
    );
  }
  return (
    <footer className="v-foot">
      <div className="v-wrap v-foot-grid">
        <div className="v-foot-brand">
          <Logo />
          <p className="v-foot-about">
            {BRAND} — быстрый и приватный интернет на телефоне, компьютере и телевизоре: серверы в {COUNTRY_COUNT} странах,
            шифрование трафика и пакеты трафика.
          </p>
          <p className="v-foot-apps">Приложения: <b>{FOOT_APPS}</b></p>
          <p className="v-foot-org">
            <b>Atlas Secure · группа QoDev</b>
            Гонконг (SAR)
          </p>
        </div>
        {FOOT_LINKS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <p className="v-foot-group-title">{group.title}</p>
            <ul className="v-foot-links">
              {group.links.map((l) => (
                <li key={l.href}><Link href={l.href} prefetch={false}>{l.label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="v-wrap">
        <p className="v-foot-copy">© {span} {BRAND}</p>
      </div>
    </footer>
  );
}
