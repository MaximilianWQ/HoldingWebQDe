import type { Dict } from "./index";

/**
 * English dictionary. Its shape must match `ru` exactly — TypeScript
 * enforces it, so a forgotten key breaks the build rather than the page.
 *
 * TRANSLATION RULES for this site:
 *   — «VPS-ускоритель» → "VPS accelerator". The showcase never says
 *     "VPN" in either language (CLAUDE.md, «Два языка продукта»). The
 *     signed-in screens are the only place that word belongs.
 *   — Plain words over jargon. The Russian copy avoids engineering
 *     terms on purpose («ширина канала», not «магистраль»), and the
 *     English has to earn the same reading: "how much the connection
 *     can carry", not "backbone capacity".
 *   — Prices, counts and dates are substituted from `src/lib`, never
 *     written out here. A number typed into a dictionary is a number
 *     that will quietly disagree with the other language.
 *   — British or American spelling: American, because the audience
 *     reads American software. Kept consistent.
 */
export const en: Dict = {
  links: {
    home: "Home",
    pricing: "Pricing",
    traffic: "Traffic packs",
    devices: "Devices",
    devicesApps: "Devices and apps",
    guides: "Setup guides",
    vds: "Dedicated servers",
    support: "Support",
    faq: "Common questions",
    installIos: "Install on iPhone",
    contact: "Contact",
    about: "About us",
    infrastructure: "Infrastructure",
    careers: "Careers",
    security: "Security",
    business: "For business",
    terms: "Terms",
    termsFull: "Terms of Service",
    privacy: "Privacy",
    privacyFull: "Privacy Policy",
    cabinet: "Account",
    login: "Log in",
  },
  groups: {
    product: "Product",
    help: "Help",
    company: "Company",
    docs: "Legal",
  },
  a11y: {
    mainNav: "Main navigation",
    siteSections: "Site sections",
    menuOpen: "Open menu",
    menuClose: "Close menu",
    toHome: "go to home page",
    skip: "Skip to content",
    toEnglish: "Switch to English",
    toRussian: "Переключиться на русский",
  },
  meta: {
    title: "Atlas Secure VPS — fast, private internet",
    description:
      "Atlas Secure VPS — fast, private internet on your phone, computer and TV. " +
      "Encrypted traffic, a different country, traffic packs. " +
      "{countries}, {devices} on one subscription, {price} ₽ a month. {trial} free, no card.",
    ogDescription:
      "Encrypts your traffic, changes your country, opens what stopped opening. " +
      "{countries}, {devices}, {price} ₽ a month. {trial} free, no card.",
    ogLocale: "en_US",
    keywords: [
      "Atlas Secure VPS",
      "Atlas VPS",
      "VPS",
      "VPS for phone",
      "fast VPS",
      "encrypted VPS",
      "VPS subscription",
    ],
  },
  common: {
    tryFree: "Try it free for {trial}",
    pricingFrom: "Plans from {price} ₽",
  },
  footer: {
    pitch: "An internet accelerator for your phone, computer and TV.",
    claim: "Video, websites and games open right away.",
    askBefore: "A question before you buy? Message us on Telegram",
    orMail: "or email",
    worksIn: "Works with",
    serversIn: "servers in {countries}, {cities}",
    rights: "part of the QoDev group, Hong Kong (SAR)",
  },
  units: {
    day: ["day", "days", "days"],
    country: ["country", "countries", "countries"],
    device: ["device", "devices", "devices"],
    countryIn: ["country", "countries", "countries"],
    city: ["city", "cities", "cities"],
  },
};
