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
  devices: {
    title: "How to",
    titleAccent: "connect",
    lead:
      "Pick your device and we will show you what to tap. The app is free, " +
      "one subscription works on {devices}, and the first {trial} cost nothing.",
    deviceGroup: "Device",
    appGroup: "App",
    recommended: "Recommended",
    step1: "Install the app",
    step2: "Add your subscription",
    step3: "Connect",
    openIn: "Open in {app}",
    openStore: "Open {store}",
    newTab: " (opens in a new tab)",
    copy: "Copy link",
    copied: "Copied",
    copiedLive: "Link copied: {what}",
    showQr: "Show QR code",
    hideQr: "Hide QR code",
    qrCaption: "Point the app’s camera at the code — the key adds itself.",
    loadingKey: "One moment, loading your key…",
    checkingKey: "One moment, checking your key…",
    guestKey: "Your key appears as soon as you sign in with your email — along with {trial} free. No card needed.",
    guestCta: "Sign in and get your key",
    left: "Left:",
    leftOf: "of",
    buyGb: "Buy more gigabytes",
    gbPending: "Your gigabytes are paid for and being added — the key will appear here in a couple of minutes.",
    noBypass: "You do not have a “Bypass” key yet. Buy a traffic pack and the key appears right after payment.",
    getBypass: "Get a “Bypass” key",
    boostedSoon: "The boosted key comes with your trial — it holds {mb} MB.",
    trafficPacks: "Traffic packs",
    walkthrough: "See it step by step on a phone screen",
    support: "Support",
    notFoundBefore: "Cannot find your device?",
    notFoundLink: "Write to us",
    notFoundAfter: "— we will help.",
    meta: {
      title: "How to connect on iPhone, Android, Windows, Mac and TV",
      description:
        "Set up in a minute on iPhone, iPad, Android, Mac, Windows and Android TV. " +
        "The app is free, and the key is added with one button or by QR code. " +
        "One subscription covers up to {devices}, with {trial} free.",
    },
  },
  addDevice: {
    back: "Back to account",
    title: "New",
    titleAccent: "device",
    lead: "Pick your device and we will show you what to tap. One subscription works on {devices}.",
    keyNotFound: "No key found — check your subscription in your account.",
    done: "Done — back to account",
    meta: {
      title: "New device",
      description: "Connecting a new device to your Atlas Secure subscription: the app, the QR code and the key.",
    },
  },
  support: {
    title: "How can we",
    titleAccent: "help?",
    lead: "Not connecting, a question about payment — write to us. Telegram gets the fastest reply.",
    writeTg: "Message us on Telegram",
    newTab: " (opens in a new tab)",
    faqLink: "Common questions",
    answering: "Answering right now",
    answeringIn: "on Telegram",
    channelsLabel: "Ways to reach us",
    channels: [
      { name: "Telegram", note: "The fastest reply" },
      { name: "VK", note: "The Atlas Secure community" },
      { name: "Email", note: "Contact form" },
    ],
    faqTitle: "Common questions",
    faq: [
      {
        q: "How do I connect?",
        a: "Open the [[/devices|devices page]], pick yours — three short steps, and your key is waiting in your account.",
      },
      { q: "How many devices can I connect?", a: "One subscription works on {devices}." },
      {
        q: "Can I try it for free?",
        a: "Yes, {trial} with no card — just sign in with your email. There are no auto-charges: if you do not like it, simply do not renew.",
      },
      { q: "How much does it cost?", a: "From {price} ₽ a month. All plans and prices are on the [[/pricing|pricing page]]." },
      {
        q: "A site still will not open",
        a: "Switch to another country in the app — there are {countriesN} of them. If that does not help, message us on Telegram and say which site and which device.",
      },
      {
        q: "How do I move to another device?",
        a: "Install the app on the new device and add the same key from your account.",
      },
    ],
    meta: {
      title: "Support",
      description:
        "Get in touch with {brand}: Telegram gets the fastest reply. " +
        "Answers to common questions — connecting, devices, the free trial, prices.",
    },
  },
  contact: {
    title: "Write",
    titleAccent: "to us",
    lead: "A question about connecting, payments or servers — pick a subject, leave your email, and we will reply.",
    desksTitle: "Our contacts",
    urgent: "Something urgent — Telegram",
    officeTitle: "Office",
    openMap: "Open in maps",
    passNote: "The building requires a pass — order one in advance, or you will be turned away at the desk.",
    passTitle: "Order a pass",
    formLabel: "Contact form",
    interests: [
      { value: "vpn", label: "Accelerator" },
      { value: "vds", label: "Dedicated servers" },
      { value: "enterprise", label: "For a company" },
      { value: "security", label: "Security" },
      { value: "other", label: "Something else" },
    ],
    nameLabel: "What should we call you",
    namePlaceholder: "For example, Alexander",
    nameError: "Tell us what to call you",
    emailLabel: "Email for our reply",
    emailEmpty: "Enter your email — the reply goes there",
    emailBad: "Check the address: it looks like there is a typo",
    topicLabel: "Subject",
    topicPlaceholder: "Pick a subject",
    topicError: "Pick a subject for your message",
    messageLabel: "Message (optional)",
    messagePlaceholder: "What happened, or what you would like to know",
    sending: "Sending…",
    send: "Send message",
    consentBefore: "By sending this message you agree to the",
    consentLink: "privacy policy",
    failServer: "The message did not go through — something broke on our side. Try again or message us on Telegram at {tg}.",
    failNetwork: "No connection to the server. Check your internet or message us on Telegram at {tg}.",
    doneTitle: "Message received",
    doneTextBefore: "We will reply to",
    doneTextAfter: "— usually within four working hours. If there is no reply, check your spam folder.",
    toHome: "Back to home",
    meta: {
      title: "Contact",
      description: "Write to {brand}: pick a subject, leave your email, and we will reply.",
    },
  },
  pass: {
    nameLabel: "First and last name in Latin letters",
    namePlaceholder: "Ivan Petrov",
    nameHint: "Exactly as in your document — security will check the name at the door.",
    nameEmpty: "Enter your first and last name — they go on the pass.",
    nameLatin: "In Latin letters, as in your document: Ivan Petrov.",
    roleLabel: "Who are you visiting as",
    roleError: "Choose who you are visiting as.",
    docLabel: "Document for entry",
    docHint: "No number needed: you show the document at the desk.",
    docError: "Choose the document you will show at the door.",
    choose: "Choose",
    whenLabel: "Date and time of your visit",
    whenError: "Give the date and time of your visit.",
    purposeLabel: "Purpose of the visit",
    purposePlaceholder: "Meeting the team, signing documents, an interview",
    purposeError: "Write the purpose of your visit — security will ask.",
    companyLabel: "Company",
    optional: "— optional",
    emailLabel: "Email",
    emailEmpty: "Without an email we cannot send you a confirmation.",
    emailBad: "Check the address: it looks like there is a typo.",
    contactLabel: "Phone or Telegram",
    consentBefore: "I agree to these details being passed to the building management to issue a pass —",
    consentLink: "how we store them",
    consentError: "Without your consent we cannot issue a pass.",
    submit: "Order a pass",
    sending: "Sending…",
    failGeneric: "The request could not be sent. Please try again.",
    failNetwork: "The request did not go through — the connection seems to have dropped. Try again.",
    doneTitle: "Request received",
    doneText:
      "We will arrange the pass and reply to the email you gave. On the day of your visit bring the " +
      "document you selected — the name will be checked at the desk.",
  },
  vds: {
    title: "Dedicated servers",
    titleAccent: "from {price}",
    lead: "The server is yours entirely: the processor, the memory and the port are shared with nobody.",
    pick: "Find me a server",
    plansLink: "Accelerator plans",
    engineer: "An engineer replies, not a sales department.",
    tiles: { steps: "Tiers in the range", port: "Port up to", entry: "Starting price" },
    speedUnit: "Gbit/s",
    configsTitle: "{count} {word}",
    configWord: ["configuration", "configurations", "configurations"],
    configsLead:
      "The wider the port, the more data the server can send at once — " +
      "so the range grows by port speed, not by core count.",
    carouselLabel: "Dedicated server configurations",
    specsLabel: "Specifications",
    spec: {
      cpu: "Processor",
      ram: "Memory",
      disks: "Disks",
      port: "Port",
      protection: "Attack protection",
    },
    ramUnit: "{n} GB ECC",
    portMetered: "traffic metered",
    portUnmetered: "traffic unmetered",
    confirmPrefix: "Still being confirmed:",
    from: "from",
    perMonth: "a month",
    guaranteeTitle: "What we answer for",
    guaranteeLead:
      "An honestly named boundary is more reassuring than generalities: here is what you get for " +
      "your money, and here is where our stretch of the road ends.",
    weDo: "We answer for",
    notUs: "Not up to us",
    pickTitle: "Just want fast internet?",
    pickLead: "For yourself — VPS accelerator plans from {price} ₽ a month. The first {trial} are free.",
    pickCta: "See pricing",
    meta: {
      title: "Dedicated servers from {price} a month",
      description:
        "{count} {word} of Atlas Secure VPS dedicated servers from {price} a month. " +
        "The server is yours entirely — price, memory, disks and port speed are on the page, before you even ask.",
      metaWord: ["configuration", "configurations", "configurations"],
    },
  },
  business: {
    title: "Internet and servers",
    titleAccent: "for your team",
    lead:
      "Connections for your staff and servers for your workloads — under contract, on one invoice. " +
      "A quote within four working hours.",
    cta: "Get a quote",
    includedLabel: "What is included",
    points: [
      {
        title: "Countries to choose from",
        text: "Staff pick the country themselves, or an administrator assigns it — depending on the services they need.",
      },
      {
        title: "Devices per person",
        text: "Laptop, phone, tablet, work computer — one seat covers all of an employee's devices.",
      },
      {
        title: "One invoice for the whole team",
        text: "Connections live in the company's shared account. Contract, acceptance certificates and invoices by bank transfer.",
      },
      {
        title: "Access management",
        text: "The company administrator grants and revokes access themselves — the same day, across every device.",
      },
    ],
    formTitle: "Tell us about your team",
    formLead: "We will reply by email with a quote and a draft contract.",
    needs: [
      { value: "access", label: "Connections for staff" },
      { value: "servers", label: "Dedicated servers" },
      { value: "both", label: "Both" },
    ],
    sizes: [
      { value: "5-20", label: "5–20 people" },
      { value: "21-100", label: "21–100 people" },
      { value: "101-500", label: "101–500 people" },
      { value: "500+", label: "More than 500 people" },
    ],
    nameLabel: "What should we call you",
    nameError: "Tell us what to call you",
    emailLabel: "Work email",
    emailEmpty: "Enter your work email",
    emailBad: "Check the address: it looks like there is a typo",
    companyLabel: "Company",
    companyError: "Enter the company name",
    sizeLabel: "Team size",
    sizePlaceholder: "Pick a size",
    sizeError: "Pick your team size",
    needLabel: "What you need",
    needPlaceholder: "Pick an option",
    needError: "Pick what you need",
    messageLabel: "Your task (optional)",
    messagePlaceholder: "How many staff and where they work, which services need to open, whether there are deadlines",
    sending: "Sending…",
    submit: "Get a quote",
    consentBefore: "By sending this request you agree to the",
    consentLink: "privacy policy",
    failServer: "The request did not go through — something broke on our side. Try again or write to {mail}",
    failNetwork: "No connection to the server. Check your connection or write to {mail}",
    doneTitle: "Request received",
    doneBefore:
      "We will come back within four working hours to the email you gave — with a quote and a draft " +
      "contract. If it is urgent, write to",
    meta: {
      title: "Internet and servers for companies, under contract",
      description:
        "Connections for staff and server infrastructure under contract, paid by bank transfer. " +
        "One invoice, access management, priority support. " +
        "We answer requests within 4 working hours.",
      keywords: [
        "internet for business",
        "connections for staff",
        "servers for a company",
        "contract with a legal entity",
        "bank transfer",
      ],
      ogTitle: "For business — Atlas Secure VPS",
      ogDescription:
        "Connections for your team and servers under contract. One invoice, access management, " +
        "priority support. Requests answered within 4 working hours.",
    },
  },
  lost: {
    kicker: "Error 404",
    title: "Page",
    titleAccent: "not found",
    lead:
      "There is no such address on this site — most likely a typo, or the page has moved. " +
      "Your connection is fine, by the way — start from the home page.",
    home: "Go to home page",
    pricing: "Pricing",
    noteBefore: "{trial} free, no card. Cannot find what you need —",
    noteLink: "write to support",
    metaTitle: "Page not found",
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
