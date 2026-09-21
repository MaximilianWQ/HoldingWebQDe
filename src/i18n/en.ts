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
    toTop: "Back to the top of the page",
    toTopShort: "top",
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
  cookie: {
    region: "Cookie use",
    short:
      "We only use the cookies the site needs — for signing in and keeping your account safe. " +
      "No advertising or analytics cookies.",
    accept: "Accept",
    decline: "Decline",
    more: "Details",
    close: "Close",
    title: "Cookie policy",
    whatH: "What we process",
    whatP:
      "Atlas Secure uses functional cookies only — the ones the service needs to work. We do " +
      "not collect or process data for advertising or marketing purposes.",
    typesH: "Cookies we use",
    neverH: "What we never do",
    legalH: "Legal basis",
    legalP:
      "Processing is based on the operator's legitimate interest in keeping the service running " +
      "(Article 6(1)(f) GDPR). The cookies we use are strictly necessary to deliver the service " +
      "you asked for and do not require separate consent under the ePrivacy Directive. We ask " +
      "for your consent for transparency, so that you know what is being processed.",
    manageH: "Managing cookies",
    manageP:
      "You can delete cookies at any time in your browser settings. Note that deleting the " +
      "session cookie will sign you out, and you will need to sign in again.",
    acceptClose: "Accept and close",
    types: [
      {
        name: "Session cookie",
        tag: "Required",
        text:
          "Identifies your signed-in session. Without it you cannot open your account. Stored " +
          "for 3 hours, then deleted automatically. Sent over HTTPS only.",
      },
      {
        name: "Verification cookie",
        tag: "Required",
        text:
          "A temporary cookie used while confirming your email address. Stored for 10 minutes " +
          "and deleted as soon as verification finishes.",
      },
      {
        name: "Cookie consent",
        tag: "Local",
        text:
          "Kept in your browser's sessionStorage until you close it — we will ask again on your " +
          "next visit. Never sent to the server.",
      },
    ],
    never: [
      "No advertising or analytics cookies",
      "No tracking of how you use the site",
      "No sharing of data with third parties or ad networks",
      "No tracking pixels and no fingerprinting",
    ],
  },
  install: {
    onHome: "Atlas on your Home Screen",
    title: "How to install",
    shareIconBefore: "The square with an arrow pointing up",
    shareIconAfter: "in the Safari toolbar.",
    step3done: "Atlas will sit next to your other apps and open without the address bar.",
    later: "Not now",
    close: "Close",
    done: "Got it",
    step1: "Tap Share",
    step2: "Choose “Add to Home Screen”",
    step2note: "It is the item with a plus — scroll the menu if you cannot see it.",
    step3: "Tap Add",
    step3note: "Opens with one tap, like any other app.",
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
