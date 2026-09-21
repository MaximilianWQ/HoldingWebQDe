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
  home: {
    hero: {
      kicker: "Servers in {countries} · {trial} free trial",
      title: "Everything you watch,",
      titleAccent: "at full speed",
      lead:
        "Video without pauses, games without stutter, websites that open right away — " +
        "on your phone, your computer and your TV.",
      note: "No card needed. Sign in with your email, get your key straight away — setup takes a minute.",
    },
    proofLabel: "Free trial terms",
    proof: [
      { title: "No card needed", note: "{trial} free — no payment details" },
      { title: "No auto-charges", note: "You pay once and renew when you decide" },
      { title: "A minute to set up", note: "Install the app, add the key, done" },
      { title: "Real people on support", note: "We answer on Telegram — {tg}" },
    ],
    countries: {
      section: "Countries in the network",
      label: "Servers in {countries}",
    },
    why: {
      title: "Everything you need,",
      titleAccent: "in one subscription",
      lead:
        "Speed, countries and devices are in every plan — there is nothing extra to pay for.",
      tiles: [
        { h: "Servers around the world", p: "Pick the closest country in the app with one tap" },
        { h: "All your devices at once", p: "Phone, laptop and TV on one subscription, no extra fees" },
        { h: "High speed", p: "How much the connection can carry on Basic and Plus" },
        { h: "Free trial", p: "Try it on the services you actually use — no card needed" },
        { h: "Traffic packs", p: "Reinforced servers for difficult networks — gigabytes never expire" },
        { h: "Encrypted traffic", p: "Sealed the whole way from your device to our server" },
      ],
      freeSuffix: "free",
      fromPrice: "from {price} ₽",
    },
    plans: {
      title: "The longer the term, the cheaper the month",
      lead:
        "We suggest six months: {best} ₽ a month instead of {month} ₽ — and it is not a year up front. " +
        "The {trial} trial comes with both plans.",
      tryFirst: "Try {trial} free first",
      haveAccount: "Already have an account — log in",
    },
    traffic: {
      stickerNew: "new",
      stickerGb: "GB",
      title: "When an ordinary connection is not enough",
      lead:
        "Traffic packs are a separate key to reinforced servers for difficult networks: office Wi-Fi, " +
        "hotels, roaming. From {price} ₽, and the gigabytes never expire — they add up.",
      all: "All {count} packs — up to {max} GB",
      note: "A pack works alongside your subscription; it does not replace it.",
    },
    faq: {
      title: "What people ask before they buy",
      lead: "If your question is not here, write to support — we answer before you pay.",
      items: [
        {
          q: "What does it cost once the trial ends?",
          a:
            "Nothing is charged automatically: we do not ask for a card for the trial. If you like it, " +
            "plans start at {month} ₽ a month, and paying for six months works out to {best} ₽ a month. " +
            "If you do not, simply do not renew.",
        },
        {
          q: "Is it hard to set up?",
          a:
            "No. Sign in with your email, install the app, press “Add subscription” — usually a minute. " +
            "There is nothing to type in by hand, and every step is shown in the [[/devices|setup guides]].",
        },
        {
          q: "Will it work on my device?",
          a:
            "iPhone and iPad, Android, Windows, macOS and your TV. One subscription works on {devices} " +
            "at once, so you do not have to choose between your phone, your laptop and your TV.",
        },
        {
          q: "Can I choose the country?",
          a:
            "Yes — all {countries} are in every plan, and you can switch as often as you like. " +
            "It is a list in the app, not a separate purchase.",
        },
        {
          q: "What can be seen of my traffic?",
          a:
            "The connection is encrypted on your device and decrypted only on our server: your provider " +
            "and public Wi-Fi see an encrypted stream, not the addresses you visit. What we keep to run " +
            "the service, and for how long, is in the [[/privacy|privacy policy]].",
        },
        {
          q: "What if it does not suit me?",
          a:
            "That is what the {trial} without a card are for — check the speed on the services you use. " +
            "If you have already paid and something went wrong, write to support at [[{tgHref}|{tg}]] — " +
            "we will sort it out and refund you.",
        },
      ],
    },
    final: {
      title: "{trial} cost you nothing",
      text:
        "Try {brand} on the services you actually use: no card, no auto-charges, {devices} at once. " +
        "If it does not suit you, simply do not renew.",
      start: "Start for free",
      seePlans: "See pricing · {a} and {b}",
    },
  },
  pricing: {
    title: "Choose your plan",
    lead: "{a} is enough for video and work, {b} is for games and streaming. {trial} free, no card.",
    plansHeading: "Plans",
    compare: {
      title: "How the plans differ",
      lead: "Devices, countries and reliability are the same. The only difference is speed.",
      faster: "{times}× faster",
      fromMonth: "a month when you pay for a year",
      from: "from",
      choose: "Choose {plan}",
    },
    included: {
      title: "In every plan",
      lead: "The same on {a} and {b} — the only difference is speed.",
      tiles: [
        { h: "Servers around the world", p: "Switch country in the app with one tap." },
        { h: "All your devices", p: "Phone, laptop and TV on a single subscription." },
        { h: "Free trial", p: "All we need is your email — no card." },
        { h: "Pay when you decide to", p: "One payment for the term you choose." },
      ],
      freeSuffix: "free",
      noCharges: "auto-charges",
    },
    traffic: {
      title: "Traffic packs",
      lead: "A separate key with a store of gigabytes — no expiry date, and packs add up.",
    },
    faqTitle: "Questions before you pay",
    final: {
      title: "Try it before you pay",
      text: "All we need is your email. We do not ask for a card — nothing will be charged.",
    },
    meta: {
      title: "VPS accelerator plans from {price} ₽ a month",
      description:
        "{a} at {priceA} ₽ and {b} at {priceB} ₽ a month, cheaper by the year. " +
        "They differ only in speed: {countries} and up to {devices} come with both. " +
        "{trial} free, no card and no auto-charges.",
      ogTitle: "Atlas plans — from {price} ₽ a month",
      ogDescription:
        "Two plans, differing only in speed. {trial} free, no card and no auto-charges.",
    },
  },
  compare: {
    caption: "{a} and {b} plans compared",
    property: "Feature",
    rows: [
      { label: "Best for", basic: "Video, social, work, studying", plus: "Games, streaming, calls, heavy downloads" },
      { label: "How much it carries", basic: "{basicSpeed} Gbit/s", plus: "{plusSpeed} Gbit/s — priority" },
      { label: "Countries", basic: "All {countries}", plus: "All {countries} + dedicated servers" },
      { label: "Devices", basic: "Up to {devices}", plus: "Up to {devices}" },
      { label: "Backup routes", basic: "—", plus: "Yes: access keeps working" },
      { label: "Price from", basic: "{basicPrice} ₽", plus: "{plusPrice} ₽" },
    ],
    note:
      "Not sure — start with {a}: the trial is the same on both plans, " +
      "and you can still choose when you first pay.",
  },
  referral: {
    title: "Get up to {max}% back on what the people you invite pay",
    lead:
      "Your link appears in your account straight away. A friend pays for a subscription — part of " +
      "that sum lands on your balance and goes towards your next renewal. You get it on every payment " +
      "they make, not just the first.",
    fromFirst: "from their very first payment",
    fromN: "from {n} {word}",
    payerWord: ["paying invite", "paying invites", "paying invites"],
    cta: "Get your link",
    note: "Starts at {start}%, and the next steps open up on their own",
  },
  cards: {
    stickerGbShort: "GB",
    speedUnit: "Gbit/s",
    planTab: "Plan",
    periods: "{plan} terms",
    recommended: "recommended",
    connect: "Get started",
    perMonth: "a month",
    forPeriod: "{sum} ₽ for {period} · ≈ {day} ₽ a day",
    saving: "month by month for the same term —",
    savingBold: "you save {amount} ₽",
    oneOff: "One payment for one month — try it with no commitment",
    planChecks: [
      "Up to {devices} on one subscription",
      "All {countries} — switch country in the app",
      "Carries {speed} Gbit/s",
      "No auto-charges — you renew yourself",
    ],
    tagTry: "Try it",
    tagShort: "Short term",
    tagBest: "Good value",
    tagMax: "Best value",
    trafficLabel: "Traffic packs",
    trafficBuy: "Buy",
    trafficTitle: "{gb} GB of traffic",
    trafficOnce: "one-off",
    trafficPerGb: "{price} ₽ per gigabyte",
    trafficCheaper: " · {off}% cheaper than the starter pack",
    trafficAria: "{gb} GB for {price} ₽",
    tagBestGb: "Best price per GB",
    tagStart: "To start with",
    tagSuper: "Great value · −{off}%",
    tagGood: "Good value · −{off}%",
    tagPack: "Pack",
    trafficChecks: [
      "Gigabytes with no expiry date",
      "Packs add up with each other",
      "Reinforced servers for difficult networks",
    ],
  },
  store: { availableIn: "Available on" },
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
