/**
 * Разметка schema.org для всего сайта.
 *
 * Один источник структурированных данных на весь проект: если
 * описание организации завести на каждой странице отдельно, поисковые
 * системы получат несколько расходящихся карточек одной компании.
 *
 * Что здесь есть и почему:
 *  - Organization — сама компания, с указанием родительской (QoDev).
 *    Принадлежность к группе объявлена машиночитаемо, а не только
 *    строкой в футере.
 *  - WebSite — сайт как отдельная сущность, чтобы поиск связал
 *    домен с организацией.
 *
 * Значения, требующие подтверждения документами (юридический адрес,
 * официальное наименование группы, реквизиты), перечислены в
 * COMPLIANCE-CHECK.md. Здесь они намеренно оставлены минимальными:
 * лучше не заявить, чем заявить неподтверждённое.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://qodev.dev";

/** Родительская организация группы. Название дано брифом; сайт и
 *  реквизиты группы подставить, когда будут подтверждены. */
const PARENT_ORG = {
  "@type": "Organization",
  name: "QoDev",
  // url: "https://qodev.example", // ПОДСТАВИТЬ: официальный домен группы
};

const ORGANIZATION = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": SITE_URL + "/#organization",
  name: "Atlas Secure",
  url: SITE_URL,
  logo: SITE_URL + "/icon-512",
  // Ребрендинг 2027: описание называет продукт прямо. Эвфемизм
  // «ускоритель интернета» убран — он вводил в заблуждение и
  // поисковую выдачу тоже.
  alternateName: "Atlas",
  description:
    "Atlas — VPS для телефона и компьютера. Шифрует трафик, меняет страну и открывает то, что перестало открываться. 19 стран, 14 устройств на одной подписке, историю подключений не хранит.",
  parentOrganization: PARENT_ORG,
  // Адрес: страна из строки в футере. Полный юридический адрес и
  // регистрационный номер — в COMPLIANCE-CHECK.md, до подтверждения
  // юристом не публикуются.
  address: {
    "@type": "PostalAddress",
    addressCountry: "HK",
  },
  contactPoint: [
    {
      "@type": "ContactPoint",
      contactType: "sales",
      email: "sales@atlas.secure",
      availableLanguage: ["ru", "en"],
    },
    {
      // Поддержка живёт в Telegram, а не в почте: канал и срок ответа
      // совпадают с указанными на /contact.
      "@type": "ContactPoint",
      contactType: "customer support",
      url: "https://t.me/atlas_suppbot",
      availableLanguage: ["ru", "en"],
    },
    {
      "@type": "ContactPoint",
      contactType: "security",
      email: "security@atlas.secure",
      availableLanguage: ["ru", "en"],
    },
    {
      "@type": "ContactPoint",
      contactType: "privacy",
      email: "privacy@atlas.secure",
      availableLanguage: ["ru", "en"],
    },
  ],
  sameAs: ["https://t.me/atlas_suppbot"],
};

const WEBSITE = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": SITE_URL + "/#website",
  url: SITE_URL,
  name: "Atlas Secure",
  inLanguage: "ru-RU",
  publisher: { "@id": SITE_URL + "/#organization" },
};

export default function SiteJsonLd() {
  return (
    <>
      <script
        type="application/ld+json"
        // Содержимое — константа из этого файла, пользовательских
        // данных в ней нет.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE) }}
      />
    </>
  );
}
