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
  /** /install-happ — connecting in the Happ app, step by step. */
  installHapp: {
    kicker: "Happ · iPhone, Android, Mac, Windows · about a minute",
    titleBefore: "Connecting in ",
    titleAccent: "Happ",
    titleAfter: ", step by step",
    lead:
      "Six things to do: copy the link in your account, paste it into the app " +
      "and press the connect button.",
    tourLabel:
      "iPhone 17 Pro Max: every step in turn — copying the link in the account, " +
      "“+” in Happ, importing from the clipboard, the subscription added, " +
      "picking a country and connecting",
    s1: {
      t: "Copy your subscription link",
      d: "In your account, open the “{key}” card and press “Copy” — the link goes to your clipboard.",
      tip:
        "You do not have to copy it by hand: your account also has an “Open in " +
        "the app” button that hands the subscription to Happ itself.",
    },
    s2: { t: "Open Happ and press “+”", d: "The button sits at the top right of the profile list." },
    s3: {
      t: "Choose “Import from clipboard”",
      d:
        "Happ reads the link on its own. Next to it is “Scan QR code” — for when " +
        "the link is open on another device.",
    },
    s4: {
      t: "The subscription adds itself",
      d:
        "An Atlas Secure group appears with the list of countries and the traffic " +
        "left. It refreshes automatically once an hour.",
    },
    s5: {
      t: "Pick a country",
      d:
        "The first row is “Auto”: the app takes the fastest server itself. " +
        "Or pick a country from the list.",
    },
    s6: {
      t: "Press the connect button",
      d:
        "The first time, the system asks for permission to add a configuration — " +
        "allow it. After that connecting takes a couple of seconds.",
    },
    ctaMember: "Open my account",
    ctaGuest: "Get a subscription",
    ctaApps: "Other apps",
    getTitle: "Where to get Happ",
    getLead:
      "The app is free. The steps are the same on every system — only where you " +
      "install it from differs.",
    doneTitle: "Something went wrong?",
    doneText:
      "If nothing appeared after “Import from clipboard”, copy the link again and " +
      "repeat the step: the app reads the clipboard and nothing else. Still stuck — " +
      "write to support and we will connect it together.",
    doneSupport: "Support",
    doneAll: "All guides",
    phone: {
      cabinet: "Account",
      active: "Active",
      copy: "Copy",
      copied: "Copied",
      off: "Not connected",
      on: "Connected",
      profiles: "Profiles",
      group: "Atlas Secure Group",
      groupNote: "Updated today · auto-refresh every hour",
      gb: "GB",
      until: "Valid until {date}",
      auto: "Auto · fastest servers",
      unlimited: "Unlimited traffic",
      sheetTitle: "Add a subscription",
      sheetQr: "Scan QR code",
      sheetManual: "Add manually",
      sheetClipboard: "Import from clipboard",
      sheetFile: "Import from file",
    },
    meta: {
      title: "Connecting in Happ, step by step",
      description:
        "How to connect in the Happ app: copy the subscription link, import it " +
        "from the clipboard, pick a country and press connect.",
    },
  },
  /**
   * /install-ios. Строки `phone` — как их показывает сама iOS
   * по-английски, а не перевод русских: иначе читатель не узнает на
   * своём телефоне то, что видит на рисунке.
   */
  installIos: {
    kicker: "For iPhone and iPad · Safari · about 30 seconds",
    titleBefore: "Atlas on the ",
    titleAccent: "Home Screen",
    titleAfter: "",
    lead: "Five taps and your account opens like an app: full screen, no address bar.",
    tourLabel:
      "iPhone 17 Pro Max: the Atlas account in Safari, all five steps in turn — " +
      "“•••”, “Share”, “Add to Home Screen”, “Add” and the icon on the Home Screen",
    s1: {
      t: "Open the Safari menu",
      d: "Bottom right, next to the address bar, tap “•••”.",
      tip: "On iOS 18 and earlier this step is unnecessary: the Share button sits in Safari’s bottom bar.",
    },
    s2: { t: "Tap “Share”", d: "The first item in the menu — a square with an arrow pointing up." },
    s3: {
      t: "Choose “Add to Home Screen”",
      d: "The item with a plus in a square. Not there — pull the sheet up and scroll the list.",
    },
    s4: {
      t: "Tap “Add”",
      d: "Leave “Open as Web App” switched on — that is what makes Atlas open full screen.",
    },
    s5: {
      t: "Done",
      d: "The Atlas icon is on your Home Screen. Tap it and your account opens straight away.",
    },
    back: "Back to my account",
    doneTitle: "Did not work?",
    doneText:
      "“Add to Home Screen” exists in Safari only. If your account is open in another " +
      "browser, copy the address and open it in Safari. Still stuck — write to support " +
      "and we will help.",
    doneCabinet: "Open my account",
    doneSupport: "Support",
    phone: {
      menuShare: "Share",
      menuBookmark: "Add Bookmark",
      menuFavorite: "Add to Favorites",
      menuFind: "Find on Page",
      menuNewTab: "New Tab",
      shareTitle: "Account — Atlas Secure",
      shareOptions: "Options ›",
      shareCopy: "Copy",
      shareReading: "Add to Reading List",
      shareHome: "Add to Home Screen",
      shareMarkup: "Markup",
      sharePrint: "Print",
      addCancel: "Cancel",
      addTitle: "Add to Home Screen",
      addConfirm: "Add",
      addToggle: "Open as Web App",
      addNote: "An icon will be added to your Home Screen so you can quickly access this website.",
      homeSearch: "Search",
    },
    meta: {
      title: "Atlas on your iPhone",
      description: "How to add your Atlas account to the Home Screen of an iPhone or iPad — five taps in Safari.",
    },
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
  security: {
    title: "What do we know about you?",
    titleAccent: "Your email. That is all.",
    lead:
      "Below are both lists in full: what sits in the {brand} database and what does not. " +
      "What we do not have cannot be stolen or handed over.",
    listsHeading: "What we keep and what we do not",
    stored: "We keep",
    notStored: "We do not keep",
    storedList: [
      "Your email address",
      "The date your subscription ends",
      "An internal number the key is issued against",
      "Your referral code, if you use one",
    ],
    notStoredList: [
      "The sites you visit",
      "Your requests for site addresses (DNS requests)",
      "Connection history: when, from where, for how long",
      "The IP address you connect from",
      "Your first, middle or last name",
      "Your phone number",
      "Your postal address",
      "Your card details — they stay with the payment provider",
      "The contents of your traffic",
    ],
    seeTitle: "What your provider sees",
    seeText:
      "Without {brand}, your provider sees which site you opened and what you asked for there. " +
      "With {brand} it sees only a connection to our server — not what is inside it.",
    seenList: ["Which site you opened", "What you asked for there"],
    hidden: "hidden",
    factsHeading: "In numbers",
    facts: {
      stored: "fields about you in the database",
      notStored: "things that are not there",
      trial: "{word} free, no card",
      devices: "{word} on one subscription",
      countries: "{word} to choose from",
    },
    noCerts:
      "There are no names of standards, audits or certifications on this page — " +
      "they will appear together with the documents themselves.",
    finalTitle: "All you need to sign in is an email",
    finalLead: "{trial} free, no card. If you do not like it, simply do not renew.",
    tryFree: "Try it free",
    privacyLink: "Privacy policy",
    meta: {
      title: "Security: what we keep about you",
      description:
        "All you need to sign in is an email. We keep no visited sites, no DNS requests, " +
        "no connection history and no IP address. Both lists — what we keep and what we do not — are on the page in full.",
    },
  },
  infra: {
    kicker: "Infrastructure",
    title: "The network everything rests on",
    lead: "Nodes in {countries} and {cities}, the panel, billing and an on-call rota. Below — how it is built, and what of it you can check.",
    vacancies: "Jobs",
    figuresTitle: "By the numbers",
    figures: [
      "{word} to choose from — the country changes in the app, it is not bought separately",
      "{word} with nodes: the closer the node, the shorter the road to the service",
      "Gbit/s — what the connection carries on Plus, {basic} Gbit/s on Basic",
      "{word} on one subscription, each with its own key",
    ],
    mapTitle: "Map of nodes",
    mapText1:
      "The cities come from the same list the app uses to show countries. " +
      "The arcs are not decoration: that is what traffic between the hub and the distant sites looks like.",
    mapText2:
      "We do not print per-city latency here: right now it is calculated from distance, not measured. " +
      "When there is a measurement, there will be a number.",
    mapHint: "hover over a node",
    rackTitle: "What sits behind a connection",
    rackText:
      "Hover over a unit to see what it does. This is a diagram of what the system is made of, not a " +
      "photograph of a room: we do not publish pictures of our sites, and showing someone else's would be dishonest.",
    rackUnits: [
      { name: "Edge node", note: "Accepts the connection and holds the tunnel to your device" },
      { name: "Load balancing", note: "Spreads connections across the machines at the site" },
      { name: "Control panel", note: "Keys, dates, devices — the state of every subscription" },
      { name: "Database and ledger", note: "The source of truth for dates and payments; events are written once" },
      { name: "Observability", note: "Metrics, logs, alerts — the on-call engineer sees an incident before you do" },
      { name: "Redundancy", note: "Spare routes and copies: a site drops out, access stays" },
    ],
    layersTitle: "What it is built from",
    layers: [
      { t: "Attack protection", d: "" },
      { t: "Network", d: "Nodes in different countries, balancing inside each site and backup routes between them." },
      { t: "Keys and access", d: "Every device gets its own key. Revoke one and the rest keep working." },
      { t: "Billing", d: "A subscription's end date is an event in a ledger, not a field in a table: the whole history can be traced." },
      { t: "Observability", d: "Metrics and alerts at every step: an incident is seen by the on-call engineer, not by the user." },
    ],
    vdsTitle: "Need a whole server?",
    vdsLead: "{count} {word} by bandwidth, from {price} a month. The hardware is shared with nobody.",
    vdsCta: "Dedicated servers",
    careersCta: "Come and work with us",
    footNote: "{countries} · {cities} · up to {speed} Gbit/s",
    meta: {
      title: "Infrastructure: nodes in {countriesIn}",
      description:
        "How the {brand} network is built: nodes in {countries} and {cities}, carrying up to {speed} Gbit/s, " +
        "with backup routes and observability. The numbers come from the service's own code.",
    },
  },
  about: {
    title: "Internet that",
    titleAccent: "simply works",
    lead:
      "{brand} is a VPS accelerator for your phone and computer, and dedicated servers for projects. " +
      "Here is what we believe and what we can back up.",
    storyTitle: "How Atlas Secure came about",
    story: [
      "There are two of us. One finished the Department of Information Engineering at the Chinese University " +
        "of Hong Kong (CUHK); the other read Information Technology in International Business at MGIMO. " +
        "One saw networks as an engineering problem, the other as a market. It turned out to be the same problem.",
      "In the autumn of {year}, while one of us was studying in Hong Kong, it became clear what that problem " +
        "was made of. On 28 September mainland China blocked Instagram — because of photographs from Hong Kong " +
        "streets. And a week and a half earlier a link to a “coordination app” called Code4HK had spread " +
        "through messengers: for those who installed it, strangers were reading their messages, their contact " +
        "list and their call history, and watching a dot on a map. People were cut off from the world in one " +
        "move — and read in the same moment.",
      "That is not where we started. First there was a small shop: network hardware and digital goods. " +
        "It fed two people and taught us what no specification does — people pay for a thing they understand, " +
        "one that works without a manual. Only later, for ourselves and for friends, did we put together our " +
        "first protected connection. It turned out to be needed more than the shop.",
      "Then came investment, several attempts that came to nothing, and one more round. For that round we came " +
        "back to that same thought from {year} — and in {founded} we registered Atlas Secure in Hong Kong. " +
        "Today it is part of the QoDev group: an internet accelerator, dedicated servers and traffic packs.",
    ],
    sources: "What this was:",
    source1: "Instagram blocked, 28 September 2014",
    source2: "the HKCERT bulletin on the fake Code4HK app",
    timeline: [
      { b: "{year}", t: "Hong Kong. Sites are blocked, phones are read. The thing everything else came from." },
      { b: "The shop", t: "Network hardware and digital goods — the first thing the two of us did together." },
      { b: "The first connection", t: "Built for ourselves and for friends — a protected channel instead of someone else's Wi-Fi. Demand turned out to be bigger." },
      { b: "{founded}", t: "Investment, attempts that failed, a new round — and a company in Hong Kong." },
      {
        b: "Today",
        t: "Part of the QoDev group: servers in {countriesIn}, up to {devices} on one subscription, dedicated servers and traffic packs.",
      },
    ],
    missionKicker: "Mission",
    missionTitle: "To make protected internet",
    missionAccent: "an ordinary thing",
    missionLead:
      "Not a skill, not a separate purchase, not a reason to learn settings. You open the app and everything " +
      "works the way it should by default: sites open, video plays, and what you do online stays your business.",
    missionList: [
      {
        b: "Freedom and protection come as a pair",
        t: "Access is what lets you use the internet. Encryption is what keeps that use yours. We do not sell them separately.",
      },
      {
        b: "By default, not for an extra fee",
        t: "Encryption is in every plan and on every device. There is no “security” line on the invoice, and there never will be.",
      },
      {
        b: "We promise only what we can show",
        t: "The numbers on this site come from the same code the service runs on. What we do not have, we keep quiet about.",
      },
    ],
    factsHeading: "Atlas in numbers",
    facts: {
      countries: "{word} to choose from",
      devices: "{word} on one subscription",
      cities: "{word} with servers",
      speed: "Gbit/s on the Plus plan",
      trial: "{word} free",
    },
    makeTitle: "What we do",
    makeVps: "VPS accelerator",
    makeVpsText: "For your phone and computer: sites, video and apps run at full speed.",
    makeVds: "Dedicated servers",
    makeVdsText: "A whole server: the hardware is shared with nobody, and you choose the bandwidth.",
    from: "from",
    perMonth: "a month",
    forTeamBefore: "For a team —",
    forTeamLink: "connections under contract",
    dataBefore: ". How we handle data —",
    dataLink: "security",
    finalTitle: "Choose your plan",
    finalLead: "Two plans, up to {devices} and all {countries} in each.",
    seePlans: "See pricing",
    meta: {
      title: "About us",
      description:
        "{brand} is a VPS accelerator for your phone and computer, plus dedicated servers. " +
        "{countries}, up to {devices} on one subscription. What we believe and what we can back up.",
    },
  },
  careers: {
    kicker: "Atlas Secure · jobs",
    title1: "Join",
    title2: "the team",
    heroText:
      "We run the network across {countriesIn} and {citiesIn}, plus the panel, billing and support. " +
      "The team is distributed, we work remotely and we pay in roubles.",
    openRolesLabel: "Open roles:",
    workTitle: "What we work on",
    work: [
      "Nodes and routes",
      "Protection and anti-fraud",
      "Billing and payments",
      "Apps",
      "Support",
      "Panel and admin",
    ],
    offerTitle: "What we offer",
    offer: [
      { t: "Remote, paid in roubles", d: "The team has been distributed since {founded}. You choose where you work." },
      { t: "The range on the first call", d: "We name it before any tasks or tests, so nobody wastes their time." },
      { t: "A whole area of your own", d: "The team is small: every area has one owner, not half a role." },
      { t: "Decisions without committees", d: "From an idea to production is days, not quarters. You can see it in the change history." },
    ],
    openTitle: "Open roles",
    howTitle: "How to join us",
    steps: [
      { t: "Apply", d: "The form on this page: your name, your email and your CV as a file." },
      { t: "Getting to know you", d: "A half-hour call: what we do, and what you would like to do." },
      { t: "Technical interview", d: "Working through real problems from the area, with no riddles." },
      { t: "Offer", d: "The range is discussed on the first call, so there is no surprise at the end." },
    ],
    barLabel: "Go to the roles",
    barText: "All {count} {word} are above",
    roleWord: ["role", "roles", "roles"],
    goToRoles: "Go to the roles",
    finalTitle: "Cannot find your role?",
    finalLead:
      "Apply for the closest one and write a couple of words about what you would like to do. " +
      "If you do networks, data or product better than we manage today, a role will be found.",
    pickRole: "Pick a role",
    infraLink: "What you would be working with",
    list: {
      payUnit: "₽/month",
      tasks: "What you will do",
      need: "What we expect",
      plus: "Nice to have",
      apply: "Apply",
      telegram: "Message us on Telegram",
    },
    form: {
      title: "Apply for this role",
      name: "Name",
      nameError: "What should we call you?",
      email: "Email",
      emailEmpty: "Without an email we cannot reply.",
      emailBad: "Check the address: it looks like there is a typo.",
      contact: "Telegram or phone",
      contactOpt: "— if that suits you better",
      resume: "CV",
      resumeEmpty: "Attach your CV as a file.",
      resumeBad: "We do not accept that format. PDF or DOCX will do.",
      pickFile: "Choose a file",
      replaceFile: "Replace the file",
      noFile: "No file chosen",
      about: "A couple of words about yourself",
      aboutOpt: "— optional",
      aboutPlaceholder: "What you have worked on, and what came out best",
      consentBefore: "I agree to my CV being processed so it can be considered for this role —",
      consentLink: "how we store it",
      consentError: "Without your consent we may not store a CV.",
      failGeneric: "The application could not be sent. Please try again.",
      failNetwork: "The application did not go through — the connection seems to have dropped. Try again.",
      sending: "Sending…",
      submit: "Send application",
      doneTitle: "We have got it",
      doneText: "Your CV for the “{vacancy}” role has arrived. We will read it and reply to the email you gave. If you would like it sooner —",
      doneLink: "message us on Telegram",
      hint: "PDF, DOC, DOCX, RTF, ODT, TXT or a screenshot — up to {mb} MB",
    },
    meta: {
      title: "Jobs",
      description:
        "Atlas Secure is hiring engineers and more: {count} open {word}, remote work, paid in roubles. " +
        "Infrastructure across {countriesIn}.",
      metaWord: ["role", "roles", "roles"],
    },
  },
  unsubscribe: {
    badge: "Mailing list",
    readyTitle: "Unsubscribe from the mailing list?",
    readyText: "We will stop sending news and offers to {email}.",
    busyTitle: "Unsubscribing…",
    busyText: "One moment.",
    doneTitle: "Done, you are unsubscribed",
    doneText: "News and offers will no longer arrive at {email}.",
    alreadyTitle: "You are already unsubscribed",
    alreadyText: "News and offers do not go to {email}. If you change your mind, write to support.",
    invalidTitle: "This link does not work",
    invalidText:
      "It looks like the link from the email did not open in full. " +
      "Open it from the email again, or write to support — we will unsubscribe you by hand.",
    errorTitle: "That did not work",
    errorText: "The server did not answer. Try again in a minute.",
    yourAddress: "your address",
    unsubscribe: "Unsubscribe",
    stay: "Stay subscribed",
    retry: "Try again",
    home: "Go to home page",
    support: "Support",
    serverSaid: "The server replied {status}",
    noConnection: "No connection to the server",
    fine:
      "Service emails — about credits, payments and changes to the terms — go to everyone: " +
      "unsubscribing does not apply to them.",
    metaTitle: "Unsubscribe from the mailing list",
    metaDescription: "Unsubscribe from Atlas Secure news and offers.",
  },
  auth: {
    back: "Back",
    show: "Show",
    hide: "Hide",
    showPassword: "Show password",
    hidePassword: "Hide password",
    invited: "By invitation",
    title: "Sign in to {brand}",
    lead: "Enter your email and password. No account — a code sent to your email will create one and start {trial} free.",
    email: "Email",
    password: "Password",
    forgot: "Forgot your password?",
    signingIn: "Signing in…",
    signIn: "Sign in",
    or: "or",
    consentBefore: "I agree to the",
    consentPrivacy: "Personal Data Processing Policy",
    consentAnd: "and the",
    consentTerms: "Terms of Service",
    consentRequired: "Tick the Policy consent to continue",
    marketing: "I would like to receive news and special offers",
    sendingCode: "Sending the code…",
    getCodeByMail: "Email me a code",
    checking: "Checking…",
    passkey: "Sign in with a passkey",
    openingBot: "Opening the bot…",
    telegram: "Sign in with Telegram",
    tgConfirmTitle: "Confirm the sign-in in the bot",
    tgConfirmCode: "Confirmation code {code}",
    tgConfirmText: "The bot will show these same four digits. If they match, press “Confirm” there and you will be signed in here.",
    tgOpenAgain: "Open the bot again",
    tgManualBefore: "Open the bot and send it:",
    codeTitle: "Enter the code",
    codeLabel: "The 6-digit code from the email",
    codeSentBefore: "We sent an email to",
    codeSentAfter: ". Cannot see it — check your spam folder.",
    confirm: "Confirm",
    resendIn: "Send again in",
    sending: "Sending…",
    resend: "Send the code again",
    setPwTitle: "Choose a password",
    setPwLead: "Next time you will sign in with your email and password — no waiting for an email. You can skip this step.",
    pwHint: "At least 6 characters",
    repeatPassword: "Repeat the password",
    saving: "Saving…",
    savePassword: "Save password",
    skip: "Skip",
    resetTitle: "Let us get you back in",
    resetLead: "Give us the account email — we will send a code for a new password.",
    getCode: "Get a code",
    newPassword: "New password",
    newPasswordLead: "You will sign in with it and your email from now on.",
    changedTitle: "Password changed",
    changedLead: "Now sign in with the new password.",
    errors: {
      noServer: "Could not reach the server. Refresh the page and try again.",
      keyNotRecognised: "The key was not recognised",
      passkeyFailed: "Signing in with a passkey did not work. Sign in with a code from an email instead.",
      tgStart: "Could not start the sign-in. Please try again.",
      tgTimeout: "Time ran out. Start the sign-in again.",
      tgStale: "This link is no longer valid. Start the sign-in again.",
      tgNetwork: "Could not start the sign-in. Check your connection.",
      hasPassword: "This email already has a password — enter it below.",
      badLogin: "Could not sign you in. Check your email and password.",
      noConnection: "No connection to the server. Check your internet and try again.",
      shortPassword: "The password must be at least 6 characters",
      mismatch: "The passwords do not match",
      savePassword: "Could not save the password",
      server: "Server error. Please try later.",
      sendCode: "Could not send the code",
      sixDigits: "Enter the 6-digit code",
      badCode: "Wrong code",
      noConnectionShort: "No connection to the server. Please try again.",
      changePassword: "Could not change the password",
    },
    meta: {
      title: "Sign in",
      description: "Sign in to or register with Atlas Secure using a code from an email or a password.",
    },
  },
  subscribe: {
    loading: "Loading the payment…",
    gb: "GB",
    stepsSubscription: ["Plan", "Term", "Payment"],
    stepsTraffic: ["Pack", "Payment"],
    productLabel: "What you are paying for",
    productPlan: "Subscription",
    productTraffic: "Traffic pack",
    safe: "Secure payment through a protected payment gateway",
    stepsLabel: "Payment steps",
    backToPlans: "Back to plans",
    backToPacks: "Back to the packs",
    back: "Back",
    backToCabinet: "Back to account",
    titlePlans: "Choose a plan",
    titlePeriods: "Choose a term",
    titlePacks: "Choose a traffic pack",
    titleCheck: "Check and pay",
    titlePaidTraffic: "Traffic pack payment",
    titlePaidPlan: "Subscription payment",
    nextPeriod: "Next — the term",
    nextPayment: "Next — payment",
    creating: "Creating the payment…",
    payNow: "Pay {sum} ₽",
    planStep: "Step 1 · Plan",
    planStepText: "Two plans on the same infrastructure — they differ only in speed.",
    planLabel: "Plan",
    fromPerMonth: "from",
    perMonthShort: "₽/mo",
    periodStep: "Step 2 · Term",
    periodStepText: "The longer the term, the lower the monthly price. You pay once, with no auto-charges.",
    periodLabel: "Term",
    payNote: "Payment through a secure payment provider · 15 minutes to pay",
    packStep: "Step 1 · Pack",
    packStepText: "Gigabytes for the separate “Bypass” key — with no expiry date. A new pack adds to what is left.",
    packsLabel: "Traffic packs",
    perGb: "₽/GB",
    packNoExpiry: "No expiry date — packs add up",
    payStep: "Step {n} · Payment method",
    methodTitle: "Card or SBP",
    methodNote: "Visa, Mastercard, MIR, SBP",
    next1: "The payment provider's page will open — you have 15 minutes to pay.",
    next2: "After paying you will come back here and we will check the payment.",
    next3Traffic: "The gigabytes will be added to your “Bypass” key — you can see it in your account.",
    next3Plan: "Your subscription will be extended — the date is in your account.",
    orderTitle: "Your order",
    rowPack: "Traffic pack",
    rowTerm: "Term",
    rowNoExpiry: "no expiry date",
    rowPerGb: "Per gigabyte",
    rowPlan: "Plan",
    rowPerMonth: "A month",
    rowSaving: "You save",
    toPay: "to pay",
    fineTraffic: "No expiry date — it adds to your “Bypass” key. You pay once, with no auto-charges.",
    finePlans: "You can change the term on the next step. You pay for the whole term at once.",
    finePeriods: "You pay for the whole term at once; the monthly price is there for comparison.",
    dockLabel: "Total and payment",
    errCreate: "The payment could not be created",
    errConnection: "Connection error. Please try later.",
    waitBadge: "Waiting for the payment provider",
    waitTitle: "Checking the payment",
    waitText: "Please wait. We are checking the status of your payment.",
    waitHint: "If the status does not change for a while, open your account and press “Check subscription” — the payment will be picked up.",
    paidBadge: "Paid",
    paidTitle: "Payment accepted",
    paidPlanText: "The subscription has been extended. Your key is active and ready to use.",
    toCabinet: "Go to your account",
    trafficApplied: "{volume} credited — the gigabytes have been added to your “Bypass” key.",
    trafficAppliedNoVolume: "The gigabytes have been credited — they have been added to your “Bypass” key.",
    trafficConflict: "The pack is paid for. Support is checking the credit — the balance will appear in your account; there is no need to write to anyone.",
    trafficPending: "{volume} paid for. We will credit them within a few minutes — the balance will show in your account.",
    trafficPendingNoVolume: "The pack is paid for. We will credit the gigabytes within a few minutes — the balance will show in your account.",
    failedBadge: "Payment declined",
    expiredBadge: "Payment cancelled",
    failedTitle: "The payment did not go through",
    expiredTitle: "Time ran out",
    failedText: "The payment was declined or cancelled. Try again or use another card.",
    expiredText: "The payment was not made within 15 minutes and was cancelled. Create a new one.",
    retry: "Try again",
    createNew: "Create a new payment",
    backCabinet: "Back to your account",
    meta: {
      title: "Payment",
      description: "Paying for an Atlas Secure subscription or traffic pack.",
    },
  },
  /**
   * Подписи правового каркаса. `notice` у английской версии — та самая
   * оговорка: перевод дан для удобства, силу имеет русский текст.
   */
  legal: {
    toc: "Contents",
    notice: "This is a translation provided for convenience. The Russian version is the binding one.",
    updated: "Updated {date}",
    effective: "Effective {date}",
    version: "Version {v}",
  },
  /** /terms — Terms of Use. Ключи названы по номеру пункта оригинала. */
  terms: {
    sheetTitle: "Terms",
    title: "Terms of Use",
    tocLabel: "Sections of the Agreement",
    meta: {
      title: "Terms of Use",
      description:
        "Terms of use for Atlas Secure: account, plans and bonuses, payment and refunds, prohibited use, " +
        "the personal nature of the subscription, suspension, service quality, liability of the parties.",
    },
    deviceForms: [
      "simultaneously connected device",
      "simultaneously connected devices",
      "simultaneously connected devices",
    ],
    s01: {
      t: "General provisions",
      p11:
        "1.1. These Terms of Use (the “Agreement”) govern the relationship between Atlas Secure (the “Service”) and " +
        "any person using the Service (the “User”).",
      p12:
        "1.2. The Agreement is a public offer. Registration, use of the Service, activation of the trial period or " +
        "payment for a subscription constitute full and unconditional acceptance of the Agreement. A User who does " +
        "not agree with any condition must stop using the Service.",
      p13:
        "1.3. The User confirms that they are 18 years old, or of the age of full legal capacity under the law of " +
        "their jurisdiction, and are entitled to enter into the Agreement.",
      p14: "1.4. Terms used in the Agreement:",
      defs: [
        { term: "Account", def: "the User’s record in the Service, including a linked Telegram profile." },
        {
          term: "Subscription",
          def:
            "the right of access to the Service for a defined period under a plan, either paid for or granted free " +
            "of charge.",
        },
        {
          term: "Access key",
          def:
            "a configuration, subscription link, QR code, token or other data that makes it possible to connect to " +
            "the Service’s infrastructure.",
        },
        {
          term: "Traffic pack",
          def: "a separately paid volume of data for the reinforced-server key, with no expiry date.",
        },
        { term: "Device", def: "any equipment from which the User connects to the Service." },
        {
          term: "Balance",
          def:
            "an internal account ledger to which bonuses, referral credits and compensation are added. The Balance " +
            "is not money, an electronic wallet or a payment instrument.",
        },
      ],
      p15:
        "1.5. The [[/privacy|Privacy Policy]], the [[/pricing|Pricing]] page and the Referral programme rules " +
        "published in the Service form an integral part of the Agreement.",
      p16:
        "1.6. The Agreement is drawn up in Russian. Any translation is provided for convenience; in the event of " +
        "any discrepancy the Russian text prevails.",
    },
    s02: {
      t: "Subject of the Agreement",
      p21:
        "2.1. The Service provides the User with access to a secure network connection technology intended to ensure " +
        "the confidentiality and security of transmitted data, including when working in public and untrusted " +
        "networks.",
      p22: "2.2. The services comprise:",
      l22: [
        "encryption of network traffic using the VLESS/Reality, VMess and Trojan protocols;",
        "protection of the User’s network address from disclosure to third parties;",
        "access to the Service’s server infrastructure located in various jurisdictions;",
        "technical support within the limits of the chosen plan.",
      ],
      p23:
        "2.3. The Service is a technical data-protection tool. The Service does not provide access to any content, " +
        "does not host, store or moderate third-party content, does not control or determine which resources the " +
        "User visits, and is not a means of committing unlawful acts.",
      p24:
        "2.4. The User alone determines the purposes for which the Service is used and must make sure that such use " +
        "complies with the law of the country where they are located. All responsibility for compliance with " +
        "applicable law rests with the User.",
      p25:
        "2.5. The Service may at any time change the set of servers, locations, protocols and features, provided " +
        "this does not materially degrade the service already paid for.",
    },
    s03: {
      t: "Registration and Account",
      p31:
        "3.1. To access the Service the User registers with a valid email address and/or through a Telegram account. " +
        "The User must provide accurate information.",
      p32:
        "3.2. One User may hold one Account. Creating several Accounts, including in order to obtain the trial " +
        "period, bonuses or referral credits again, is prohibited.",
      p33:
        "3.3. The User is responsible for keeping their credentials and Access keys safe. Every action taken using " +
        "the Account or the Access keys is deemed to have been taken by the User.",
      p34:
        "3.4. If credentials or Access keys are suspected to have leaked, the User must notify support immediately " +
        "and reissue the Access key in their account.",
      p35:
        "3.5. The Service may request confirmation that an Account or a payment belongs to the User. Access may be " +
        "suspended until such confirmation is received.",
      p36:
        "3.6. An Account may not be sold, given away or otherwise transferred to a third party without the Service’s " +
        "written consent.",
      p37:
        "3.7. The User may stop using the Service at any time and request deletion of the Account through support. " +
        "Deleting the Account terminates the Subscription, the Balance and all credits; money for the unused period " +
        "is not refunded, unless section 05 provides otherwise.",
    },
    s04: {
      t: "Plans, devices, bonuses and the Referral programme",
      p41:
        "4.1. The price, term, limit on simultaneously connected Devices and other characteristics of the plans are " +
        "published on the [[/pricing|Pricing]] page. The Service may change prices at any time; changes do not " +
        "affect periods already paid for.",
      p42:
        "4.2. One Subscription is intended for no more than {devices}. The Service may limit the number of " +
        "connections and unlink Devices above the limit.",
      p43b: "There is no automatic renewal and no recurring charge.",
      p43:
        "Payment is a one-off charge for the chosen term; once it expires, access stops until the next payment. The " +
        "Service does not store payment details for repeat charges.",
      p44: "4.4. Free access and bonuses:",
      l44: [
        "trial period — {trial} free of charge, once per User, including {mb} MB of traffic for the reinforced-server key;",
        "bonus for linking Telegram — {tg}, once per User.",
      ],
      p45: "4.5. Referral programme — cashback to the Balance from every payment made by an invited User:",
      loyaltyFirst: "from the first payment of an invited User",
      loyaltyFrom: "from {n} or more invited Users who have paid",
      p46:
        "4.6. Funds on the Balance may only be used to pay for the Service. They cannot be withdrawn, exchanged for " +
        "money or transferred to other Users, unless the Referral programme rules expressly provide otherwise.",
      p47:
        "4.7. Abuse of bonuses and of the Referral programme is prohibited: self-invitation, multiple accounts, " +
        "fake registrations, use of bots, inflating numbers, paying and then charging back, misleading advertising " +
        "and spamming a referral link.",
      p48:
        "4.8. Where abuse is found, the Service may cancel bonuses, the trial period and credits, write off any " +
        "Balance obtained improperly, and block all connected Accounts.",
      p49:
        "4.9. The Service may change or discontinue bonuses and the Referral programme at any time, giving notice " +
        "within the Service.",
    },
    s05: {
      t: "Traffic packs",
      p51:
        "5.1. A traffic pack is a separate product: a paid volume of data for the reinforced-server key. A pack does " +
        "not replace a Subscription and does not extend its term.",
      p52:
        "5.2. The volume of a pack has no expiry date and does not burn out. Packs that are bought add up to the " +
        "volume already held.",
      p53:
        "5.3. Gigabytes are used up as data is transferred. Volume that has been used up is neither refunded nor " +
        "restored; the remaining volume is not exchanged for money.",
      p54:
        "5.4. Paid volume is credited automatically; if the infrastructure is unavailable, it is credited once the " +
        "infrastructure is restored. A delay in crediting is not grounds for a refund.",
      p55:
        "5.5. When a website Account is linked to the Service’s Telegram bot, the remaining traffic is added " +
        "together, and of the two Subscriptions the longer one is kept. The bonus for linking is granted once.",
    },
    s06: {
      t: "Payment and refunds",
      p61:
        "6.1. Payment is made through an authorised payment operator. The Service neither stores nor processes " +
        "payment card details.",
      p62: "6.2. The payment window is 15 minutes from the creation of the payment session. After that the session is cancelled.",
      p63:
        "6.3. The Subscription is activated automatically once the operator confirms the payment. Payment system and " +
        "bank fees are borne by the User.",
      p64:
        "6.4. A refund is possible within 14 days of payment if the service has been terminated or was not provided " +
        "through the fault of the Service. The request is submitted through support from the same contact the " +
        "Account is linked to. Refunds are handled manually.",
      p65:
        "6.5. A refund is made by the same method as the payment, less the payment operator’s fees where applicable " +
        "law permits. Where the paid term has been partly used, the value of the unused whole days is refunded.",
      p66: "6.6. No refund is made:",
      l66: [
        "where the Account is blocked for a breach of the Agreement (sections 07–09);",
        "for free and bonus periods, or for funds on the Balance;",
        "for the volume of traffic packs already used up;",
        "where unavailability is caused by the User, their provider, their device or third parties;",
        "where the User gives up the Subscription after the period stated in clause 6.4 has expired.",
      ],
      p67:
        "6.7. A chargeback initiated by the User without first contacting support is treated as a breach of the " +
        "Agreement and results in immediate blocking of the Account. Paying with someone else’s or stolen payment " +
        "instruments is prohibited. The Service may claim reimbursement of the costs incurred by an unjustified " +
        "chargeback.",
    },
    s07: {
      t: "Prohibited use",
      p71:
        "7.1. The User is prohibited from using the Service for any unlawful act, including but not limited to " +
        "those listed below.",
      p72: "7.2. Fraud and financial crime:",
      l72: [
        "fraud in any form, including phishing, social engineering, fake websites and deception in sales;",
        "carding, use of stolen payment details, accounts and personal data;",
        "money laundering, evasion of financial controls, running pyramid schemes;",
        "identity theft, forgery of documents, creating accounts in someone else’s name.",
      ],
      p73: "7.3. Attacks and malicious activity:",
      l73: [
        "unauthorised access to other people’s systems, networks, devices and accounts;",
        "DoS/DDoS attacks, exploitation of vulnerabilities, brute force, credential stuffing;",
        "scanning ports and networks without their owners’ permission;",
        "creating, distributing and operating malware, botnets and ransomware, hosting command-and-control servers;",
        "intercepting other people’s traffic and data.",
      ],
      p74: "7.4. Prohibited content and violence:",
      l74: [
        "distributing, storing and obtaining child sexual abuse material and any sexual exploitation of minors;",
        "promotion of terrorism and extremism, recruitment, financing such activity;",
        "threats, blackmail, extortion, stalking, harassment, publishing other people’s personal data;",
        "human trafficking, illegal trade in drugs, weapons and other prohibited goods and services.",
      ],
      p75: "7.5. Spam and unfair automation:",
      l75: [
        "bulk sending of spam and unsolicited advertising through any channel;",
        "inflating metrics, click fraud, advertising fraud, mass registration of accounts;",
        "automated data collection in breach of third-party resources’ rules;",
        "buying up tickets and goods with bots, manipulating votes and reviews.",
      ],
      p76: "7.6. Infringement of third-party rights:",
      l76: [
        "infringement of copyright and related rights, distribution of pirated content;",
        "impersonating another person or organisation;",
        "breaching the rules and terms of use of third-party services where this causes them harm.",
      ],
      p77: "7.7. Abuse of the Service’s infrastructure:",
      l77: [
        "excessive load that degrades the Service for other Users;",
        "cryptocurrency mining, running public proxies, exit nodes of anonymity networks, relays and servers through the Service’s infrastructure;",
        "attempts to break into, penetration-test, reverse-engineer or circumvent the limits and technical restrictions of the Service;",
        "acts that lead to the Service’s addresses being blocked or blacklisted.",
      ],
      p78:
        "7.8. Any other use that breaches the law of the User’s jurisdiction, the law of the jurisdiction where the " +
        "server is located, or applicable international rules, is prohibited.",
      p79: "7.9. The Service alone assesses whether an act is a breach. The list is not exhaustive.",
    },
    s08: {
      t: "The personal nature of the Subscription",
      p81:
        "8.1. A Subscription is granted for personal, non-commercial use by one User on the number of Devices set by " +
        "the plan.",
      p82: "8.2. The User is prohibited from:",
      l82: [
        "passing Access keys and credentials to third parties, including free of charge, beyond the Device limit of their plan;",
        "publishing Access keys, subscription links and QR codes in open sources: in channels and chats, on forums, in social networks, in code repositories, in aggregators and “giveaways”;",
        "reselling, renting out or sublicensing the Subscription or access to the Service, or including them in their own paid or free products;",
        "organising shared use of one Subscription by a group of people (“whip-rounds”, shared accounts);",
        "exceeding the limit on simultaneously connected Devices, including by technical means that hide their actual number;",
        "using the name, logo and materials of the Service to sell access in their own name.",
      ],
      p83: "8.3. Resale and partner distribution are permitted only under a separate written contract with the Service.",
      p84:
        "8.4. The Service may apply automatic controls: analysis of the number of simultaneous connections, Devices, " +
        "network addresses and the geography of connections, as well as monitoring of open sources for published " +
        "Access keys.",
      p85:
        "8.5. Where a breach of this section is found, the Service may without warning revoke and reissue the Access " +
        "key, limit the number of connections, block the Account without a refund, and claim damages equal to the " +
        "price of a Subscription for each person who obtained access improperly.",
    },
    s09: {
      t: "Suspension and blocking of access",
      p91:
        "9.1. The Service may at any time, without prior notice, suspend, restrict or terminate the User’s access to " +
        "the Service and block the Account if the Service has grounds to believe that:",
      l91: [
        "the User is committing fraudulent or other unlawful acts listed in section 07;",
        "the User has breached section 08 on the personal nature of the Subscription;",
        "the payment was made using someone else’s or stolen payment instruments, or a chargeback has been initiated on it;",
        "abuse of the trial period, bonuses or the Referral programme has been found;",
        "the User has provided inaccurate information or has refused to confirm that the Account belongs to them;",
        "the Account’s activity threatens the security, stability or reputation of the Service or of other Users;",
        "a complaint has been received from a rights holder, a hosting provider or a payment operator, or a demand from a competent authority;",
        "the User insults support staff, threatens them or spreads knowingly false information about the Service.",
      ],
      p92:
        "9.2. The Service is not obliged to disclose how breaches are detected, the evidence or the sources of " +
        "information. The data of the Service’s automatic control systems is accepted as sufficient grounds for " +
        "taking measures.",
      p93:
        "9.3. The Service chooses the measure at its own discretion: a warning, reissue of the Access key, a limit " +
        "on speed or on the number of connections, temporary suspension, final blocking of the Account and of all " +
        "Accounts connected to it.",
      p94:
        "9.4. Where the Account is blocked for a breach of the Agreement, the money paid is not refunded, and the " +
        "unused Subscription term, the Balance, bonuses, referral credits and the remaining volume of traffic packs " +
        "are cancelled.",
      p95:
        "9.5. Where access is terminated for reasons unrelated to a breach by the User, the Service refunds the " +
        "value of the unused paid period.",
      p96:
        "9.6. The User may appeal against blocking through support within 14 days. The Service considers the appeal " +
        "within 10 working days. The Service’s decision on the appeal is final.",
      p97:
        "9.7. A blocked User is prohibited from registering new Accounts. The Service may refuse registration or " +
        "service to any person.",
      p98:
        "9.8. The Service may pass information about unlawful acts to competent authorities and payment operators to " +
        "the extent provided for by law and by the [[/privacy|Privacy Policy]].",
    },
    s10: {
      t: "Quality of service",
      p101:
        "10.1. The Service is provided “as is” and “as available”. The target availability of the infrastructure is " +
        "99.98% per calendar month.",
      p102:
        "10.2. The Service makes reasonable efforts to ensure continuity, but does not guarantee uninterrupted " +
        "operation, any particular speed, the availability of specific servers and locations, or that the Service " +
        "will work in a particular network, country or with a particular third-party resource.",
      p103:
        "10.3. Unavailability means the complete impossibility of connecting to all servers of the plan, confirmed " +
        "by the Service’s monitoring data. If the target is missed, the User may within 30 days contact support for " +
        "compensation in the form of Subscription days or funds on the Balance. Such compensation is the User’s sole " +
        "remedy in connection with unavailability of the Service.",
      p104:
        "10.4. The availability calculation excludes: planned works announced in advance; restrictions and blocks by " +
        "telecom operators, providers and state authorities; failures at hosting providers and backbone operators; " +
        "faults in the User’s device, software and network; events of force majeure.",
      p105:
        "10.5. The Service may carry out technical works, replace servers and addresses, and limit speed during " +
        "abnormal load in order to protect the infrastructure.",
    },
    s11: {
      t: "Liability of the parties",
      p111:
        "11.1. The Service’s aggregate liability on any claim is limited to the amount paid by the User for the " +
        "current Subscription period.",
      p112: "11.2. The Service is not liable for:",
      l112: [
        "the User’s acts committed using the Service and their consequences;",
        "indirect losses, lost profit, loss of data, reputation and business opportunities;",
        "the blocking or restriction of the User’s accounts on third-party resources;",
        "the operation of third-party services, client applications, payment operators and telecom operators;",
        "an inability to use the Service because of restrictions in the User’s country or network;",
        "the consequences of credentials and Access keys leaking through the User’s fault.",
      ],
      p113:
        "11.3. The User undertakes to reimburse the Service for losses, including fines, legal costs and the costs of " +
        "servers and addresses being blocked, arising from the User’s breach of the Agreement or of the law.",
      p114:
        "11.4. If third parties bring claims against the Service because of the User’s acts, the User must settle " +
        "them independently and at their own expense.",
      p115:
        "11.5. The parties are released from liability in events of force majeure: acts and instruments of state " +
        "authorities, blocking and restriction of communication networks, failures at providers and in data centres, " +
        "cyberattacks, natural disasters, military action.",
      p116:
        "11.6. The Service is not a telecom operator. The Service may suspend or cease operation in a particular " +
        "country or region where the law or the security of the infrastructure requires it.",
      p117:
        "11.7. The limitations in this section apply to the fullest extent permitted by applicable law and do not " +
        "affect consumer rights that cannot be waived by law.",
    },
    s12: {
      t: "Intellectual property",
      p121:
        "12.1. All rights in the software, the website, the bot, the design, the name and the Atlas Secure logo " +
        "belong to the Service. The User is granted a limited, non-exclusive, non-transferable right of use for the " +
        "term of the Subscription.",
      p122:
        "12.2. Copying, modifying, decompiling and reverse-engineering the Service’s software is prohibited, as is " +
        "creating derivative products and clone services using its materials.",
    },
    s13: {
      t: "Changes to the terms and final provisions",
      p131:
        "13.1. The Service may amend the Agreement unilaterally. A new version takes effect from the date stated on " +
        "publication. Continued use of the Service after that date means agreement with the changes.",
      p132:
        "13.2. The User agrees to receive legally significant notices by email, in Telegram and in the Service’s " +
        "interface. A notice is deemed received on the day it is sent.",
      p133: "13.3. Data is processed in accordance with the [[/privacy|Privacy Policy]].",
      p134:
        "13.4. A pre-action complaint procedure is mandatory before going to court: the complaint is sent to the " +
        "support address and answered within 30 calendar days.",
      p135:
        "13.5. The Agreement is governed by the law of the Hong Kong Special Administrative Region of the PRC. " +
        "Disputes are heard by the courts of Hong Kong, unless mandatory consumer-protection rules of the User’s " +
        "country of residence provide otherwise.",
      p136:
        "13.6. The invalidity of an individual provision of the Agreement does not render the rest invalid. The " +
        "Service’s failure to apply any measure is not a waiver of the right to apply it later.",
      p137:
        "13.7. The Service may assign its rights and obligations under the Agreement to a third party upon " +
        "reorganisation or transfer of the business. The User may not assign their rights without the Service’s " +
        "consent.",
    },
    s14: {
      t: "Contacts",
      p141: "For any question: the support Telegram bot [[{tgHref}|{tgHandle}]] and email [[mailto:{email}|{email}]].",
    },
  },
  /** /privacy — Privacy Policy. Ключи названы по номеру пункта оригинала. */
  privacy: {
    sheetTitle: "Privacy",
    title: "Privacy Policy",
    tocLabel: "Sections of the Policy",
    meta: {
      title: "Privacy Policy",
      description:
        "What data Atlas Secure collects, why and on what legal basis, how long it is kept, who it is shared with " +
        "and how to exercise your rights. The Service keeps no logs of network activity.",
    },
    s01: {
      t: "Introduction",
      p11:
        "1.1. This Policy sets out how information about the Users of the Atlas Secure secure-connection service " +
        "(the “Service”) is collected, processed, stored and protected.",
      p12:
        "1.2. The Service works on the principle of data minimisation: only what is indispensable for providing the " +
        "service, accepting payment and protecting the Service from abuse is collected.",
      p13:
        "1.3. The Policy is an integral part of the [[/terms|Terms of Use]]. The terms “Account”, “Subscription”, " +
        "“Access key”, “Traffic pack”, “Device” and “Balance” are used with the meanings given in the Agreement.",
      p14:
        "1.4. The User confirms their agreement with the Policy on registration. Where registration is through " +
        "Telegram, starting the bot and beginning to use the Service counts as agreement. A User who does not agree " +
        "with the Policy must stop using the Service.",
      p15:
        "1.5. The Policy applies on the website, in the account area, in the Service’s Telegram bot and when " +
        "connecting to the Service’s infrastructure. It does not extend to third-party websites, client " +
        "applications and payment services, which have their own data processing rules.",
    },
    s02: {
      t: "No logs of network activity are kept",
      p21: "2.1. The Service does not record, store or track:",
      l21: [
        "the content of internet traffic and destination addresses;",
        "information about the resources visited;",
        "DNS queries and their resolution logs;",
        "browsing history linked to a User.",
      ],
      p22:
        "2.2. The Service is technically unable to reconstruct a User’s browsing history and cannot provide it to " +
        "anyone, because no such data exists — including in response to a mandatory request (clause 7.4).",
      p23:
        "2.3. This does not remove the processing of the operational and account data without which the service " +
        "does not work. Sections 03 and 05 list it in full and without omissions: the state of the connection and " +
        "the node it was made to; the volume of a Traffic pack used up; the address from which registration and " +
        "sign-in were made; events in the Account.",
    },
    s03: {
      t: "What data the Service processes",
      p31: "3.1. Account credentials:",
      l31: [
        {
          term: "Email address",
          def: "identifying the Account, sign-in codes, service notices. Kept for as long as the Account exists.",
          dash: true,
        },
        {
          term: "Password, if the User has set one, and passkeys",
          def:
            "signing in without a code. A password is stored only as an irreversible hash (bcrypt); signing in with " +
            "a code from an email works without a password.",
          dash: true,
        },
        {
          term: "Telegram ID and username",
          def: "on registration through the bot or when claiming the bonus for linking.",
          dash: true,
        },
        {
          term: "Subscription term and plan, Device limit, Access key identifiers",
          def: "provision of the service.",
          dash: true,
        },
        {
          term: "Referral code, the “inviter — invited” link, Balance operations",
          def: "running the Referral programme.",
          dash: true,
        },
        {
          term: "The address from which registration was made",
          def:
            "protection against obtaining the trial period repeatedly through the same channel and against mass " +
            "registration of Accounts.",
          dash: true,
        },
      ],
      p32: "3.2. Payment and operational data:",
      l32: [
        {
          term: "Payment metadata",
          def:
            "transaction identifier, amount, date, status, payment method. Kept for the period set by law for " +
            "financial documents.",
          dash: false,
        },
        {
          term: "Account event log",
          def:
            "sign-in, issue and change of an Access key, payment, change of plan, blocking — with the date and the " +
            "network address the action was taken from. Needed to resolve disputes and investigate fraud, kept for " +
            "no longer than 12 months.",
          dash: false,
        },
        {
          term: "Support requests",
          def: "the text of the correspondence and attachments — up to 2 years from the closure of the request.",
          dash: false,
        },
        {
          term: "Records of consents and of opting out of mailings",
          def: "evidence that processing is lawful.",
          dash: true,
        },
        {
          term: "Information about breaches and blocking",
          def: "up to 3 years from the blocking, so that a blocked User does not register again.",
          dash: true,
        },
      ],
      p33: "3.3. The Service neither receives nor stores bank card details — they are processed by the payment operator.",
      p34:
        "3.4. The Service does not ask for a name, postal address, identity documents or phone number. The exception " +
        "is verifying that a payment belongs to the User where fraud is suspected: in that case the Service may ask " +
        "for confirmation, which is deleted after the check.",
      p35: "3.5. The User may use a separate email address created only for the Service.",
      p37a:
        "3.7. Office pass request. By submitting the form on the “Contacts” page, a visitor provides their first and " +
        "last name in Latin script, an email address, the date and purpose of the visit, the type of document they " +
        "will show at the entrance and, optionally, their company and a contact. This information is passed to the " +
        "management company of the business centre: without it no pass is issued. The legal basis is the visitor’s " +
        "consent, given by a separate tick in the form.",
      p37b: "The Service neither asks for nor stores the document number",
      p37c:
        "the document is checked at the desk on entry. The request is kept for no longer than 6 months from the " +
        "date of the visit, after which it is deleted.",
      p36:
        "3.6. Job application. By submitting the form on the “Careers” page, a candidate provides their name, an " +
        "email address, optionally a contact and a covering message, and a CV file. The basis for processing is the " +
        "candidate’s consent, given by a separate tick in the form and withdrawn by writing to the support address. " +
        "The data is used only to consider the application, is available to the staff making the hiring decision, " +
        "and is kept for no longer than 6 months from the date of the application, after which it is deleted " +
        "together with the file. A candidate is not a User of the Service, and an application does not create an " +
        "Account.",
    },
    s04: {
      t: "Purposes and legal bases of processing",
      p41: "4.1. The Service processes data on the following bases:",
      l41: [
        {
          term: "Performance of the Agreement",
          def:
            "providing the services, signing in to the Account, managing Subscriptions and Traffic packs, support, " +
            "running the Referral programme, service notices.",
        },
        {
          term: "Performance of the Agreement and legal requirements",
          def: "processing payments, refunds, accounting.",
        },
        {
          term: "Legitimate interest of the Service",
          def:
            "preventing fraud, abuse and breaches of the Agreement, protecting the infrastructure, defending the " +
            "Service’s rights in disputes.",
        },
        { term: "Separate voluntary consent", def: "news and special offers." },
      ],
      p42: "4.2. Service notices are not advertising and are sent regardless of consent to mailings.",
      p43:
        "4.3. The Service sends news and special offers only with separate consent. Consent is not a condition of " +
        "using the Service and can be withdrawn at any time: through the “Unsubscribe” link in every email or in " +
        "the account area.",
      p44:
        "4.4. The Service does not sell data, does not use it for advertising profiling and does not pass it to " +
        "third parties for their advertising.",
      p45:
        "4.5. The Service does not take decisions producing legal effects on the basis of automated processing, " +
        "except for the technical protection measures under section 05. The User may appeal against such measures " +
        "through support.",
    },
    s05: {
      t: "Connection data and protection against abuse",
      p51:
        "5.1. So that the connection works and the plan’s Device limit is observed, the Service’s infrastructure " +
        "processes operational data about the connection:",
      l51: [
        "the identifier of the Access key and of the Account;",
        "the state of the connection and the node it was made to;",
        "the network address the connection was established from, and the technical identifier of the Device if the client application sends it;",
        "the time the session status last changed.",
      ],
      p52:
        "5.2. This data relates to the current and the last connection and does not add up to a browsing history: " +
        "it cannot establish which resources the User opened. It contains no information about the content of " +
        "traffic or about DNS queries.",
      p53:
        "5.3. For Traffic packs the Service keeps a counter of the volume used up per Access key: without it there " +
        "is no way to show the remaining gigabytes and to stop service once they run out. The counter holds only " +
        "the volume, with no information about where that volume went.",
      p54:
        "5.4. From the operational data the Service determines the number of Devices using one Access key at the " +
        "same time. Where the limit is exceeded, a new connection may be rejected automatically.",
      p55:
        "5.5. If the system records signs of a breach of section 08 of the Terms of Use — simultaneous connections " +
        "from many addresses, publication of an Access key in open sources, resale — a note of the breach is kept " +
        "in the Account: its type, the date and the number of simultaneous connections.",
      p56:
        "5.6. To protect against unjustified chargebacks, the Service stores a flag of whether the Subscription was " +
        "used during the paid period.",
      p57:
        "5.7. The Service monitors open sources — channels, chats, forums, repositories — for published Access " +
        "keys. What is processed there is the published key itself and the address of the publication, not data " +
        "about the User’s network activity.",
    },
    s06: {
      t: "Storage and protection",
      p61:
        "6.1. Account credentials are held on protected servers with encryption in transit and at rest. Access to " +
        "them is given only to staff who need it for their work, on confidential terms.",
      p62:
        "6.2. Passwords are stored solely as irreversible hashes. The account session is a random token in a cookie " +
        "with the httpOnly, Secure and SameSite=Lax flags; only its hash is stored on the server. The session is " +
        "revoked on sign-out and on a password change.",
      p63:
        "6.3. The credentials database is separated from the servers that carry Users’ connections. The connection " +
        "servers store no credentials and no payment data.",
      p64:
        "6.4. Retention periods are set out in section 03. Once the period expires, the data is deleted or " +
        "anonymised. Backups are overwritten within 30 days.",
      p65:
        "6.5. After an Account is deleted, the Service may keep the minimum of data required by law or needed to " +
        "protect against abuse: payment metadata, a record of blocking and a hash of the identifier, so that the " +
        "trial period and bonuses are not obtained again.",
      p66:
        "6.6. The Service’s servers are located in different jurisdictions. By using the Service, the User agrees " +
        "that their data may be processed outside their country of residence.",
      p67:
        "6.7. No method of storing and transmitting data gives an absolute guarantee. In the event of an incident " +
        "affecting User data, the Service will notify the affected Users and the competent authority within the " +
        "periods set by applicable law.",
      p68:
        "6.8. The User is responsible for keeping their password, Access keys and access to their email and " +
        "Telegram account safe.",
    },
    s07: {
      t: "Disclosure to third parties",
      p71: "7.1. The Service does not sell, rent out or pass information to third parties for commercial purposes.",
      p72: "7.2. Disclosure is possible only to the following recipients and only to the extent stated:",
      l72: [
        {
          term: "Payment operator",
          def: "the amount, the order identifier, the email address for the receipt: processing the transaction, refunds, payment disputes.",
        },
        {
          term: "Email delivery service",
          def: "the email address and the text of the message: delivery of sign-in codes and notices.",
        },
        { term: "Telegram", def: "the messages the User sends to the bot themselves: operation of the bot and of support." },
        { term: "Hosting providers and data centres", def: "hosting the infrastructure." },
        {
          term: "Competent authorities",
          def: "only the data the Service actually holds, and only on a mandatory request.",
        },
        {
          term: "The Service’s successor",
          def: "Account data upon reorganisation or transfer of the business, on terms no worse than this Policy.",
        },
      ],
      p73:
        "7.3. The Service answers only requests that are mandatory for it under the law of the jurisdiction of its " +
        "registration and that are made in the established form. Unofficial and improperly made requests are " +
        "rejected.",
      p74:
        "7.4. Because no logs of network activity are kept (section 02), the Service cannot provide information " +
        "about the resources visited, the content of traffic or DNS queries — even on a mandatory request. Only the " +
        "data listed in sections 03 and 05 can be provided.",
      p75:
        "7.5. The Service may disclose Account data to the payment operator and to competent authorities where this " +
        "is necessary to protect against fraud, to contest an unjustified chargeback or to defend the Service’s " +
        "rights in a dispute with the User.",
      p76:
        "7.6. Third-party client applications, app stores and payment services process data under their own rules. " +
        "The Service is not responsible for their actions.",
    },
    s08: {
      t: "Cookies",
      p81:
        "8.1. The Service uses functional cookies only: the session cookie (signing in to the account area) and " +
        "operational ones needed to protect forms and confirm an email address. Signing in is impossible without " +
        "them, so separate consent for them is not requested.",
      p82:
        "8.2. Analytics, advertising and cross-site tracking cookies, third-party trackers and pixels are not used.",
    },
    s09: {
      t: "The User’s rights",
      p91: "9.1. The User may at any time:",
      l91: [
        "request a copy of all data connected with the Account;",
        "receive the data in a machine-readable format;",
        "correct inaccurate data;",
        "demand deletion of the Account and connected data;",
        "withdraw consent to the processing of data;",
        "opt out of news and offers — through the link in an email or in the account area;",
        "object to processing based on the Service’s legitimate interest;",
        "lodge a complaint with the competent data protection authority.",
      ],
      p92:
        "9.2. The request is sent from the email address or Telegram account linked to the Account. The Service may " +
        "ask for confirmation that the Account belongs to the requester and reject the request where this is not " +
        "confirmed.",
      p93:
        "9.3. The response time is up to 30 days. The first request for a copy of the data is free; for manifestly " +
        "unfounded or repetitive requests the Service may charge a reasonable fee or refuse.",
      p94:
        "9.4. Deleting the Account and withdrawing consent to processing make it impossible to provide the " +
        "services. The Subscription then terminates, money for the unused period is not refunded, and the Balance, " +
        "bonuses and the remaining volume of Traffic packs are cancelled.",
      p95:
        "9.5. The Service may refuse deletion or postpone it for the data it is obliged to keep by law, or which is " +
        "needed to resolve a dispute, contest a payment or prevent a blocked infringer from registering again " +
        "(clause 6.5).",
    },
    s10: {
      t: "Age",
      p101:
        "The Service is intended for persons aged 18 and over. The Service does not knowingly collect data about " +
        "minors; a minor’s Account is deleted once identified. The {trial} trial period and payment are likewise " +
        "available only to adults.",
    },
    s11: {
      t: "Changes to the Policy",
      p111:
        "11.1. The Service may amend the Policy. A new version is published in the Service stating its version " +
        "number and the date it takes effect.",
      p112:
        "11.2. The Service gives notice of material changes — new categories of data, purposes or recipients — by " +
        "email or in Telegram at least 7 days before they take effect. Continued use of the Service after that date " +
        "means agreement with the new version.",
    },
    s12: {
      t: "Contacts",
      p121:
        "The data controller is Atlas Secure, part of the QoDev group, Hong Kong Special Administrative Region of " +
        "the PRC. For questions about data processing and the exercise of rights: [[mailto:{email}|{email}]] and " +
        "the Telegram bot [[{tgHref}|{tgHandle}]].",
    },
  },
  /**
   * /dashboard. Экран только для вошедших, поэтому «VPN» и «Bypass»
   * здесь допустимы (на витрине их нет ни на одном языке).
   */
  cabinet: {
    meta: {
      title: "My account",
      description: "Subscription, connection keys, payments and profile for Atlas Secure VPS.",
    },
    loading: "Loading your account…",
    tabs: { subs: "Home", payments: "Payments", buy: "Buy", profile: "Profile" },
    tabsLabel: "Account sections",
    factSub: "Subscription",
    factBypass: "Bypass",
    subEnded: "expired",
    subUntil: "until {date}",
    noLimit: "no limit",
    tgLinked: "Telegram linked",
    tgOpening: "Opening the bot…",
    tgLink: "Link Telegram",
    tgLinkFail: "Could not get the link. Please try again.",
    netFail: "No connection to the server. Please try again.",
    bell: "Notifications",
    bellNew: "Notifications: {n} new",
    resyncOne: "Payment picked up — the subscription is active.",
    resyncMany: "Payments picked up: {n}. The subscription is active.",
    resyncChanged: "Subscription updated — recalculated from the latest payment.",
    resyncPanel: "Check complete — your data and the panel are up to date.",
    resyncOk: "Check complete — your data is up to date.",
    resyncFail: "Could not update.",
    resyncNet: "Network error.",
    outTitle: "Log out of your account?",
    outText: "To log in again you will need a code from an email.",
    outStay: "Stay",
    outBusy: "Logging out…",
    outGo: "Log out",
    buy: {
      title: "Buy",
      expired: "Your subscription is not active — pick a plan to turn access back on.",
      trial: "You are on the trial period, {days} left — take a plan so you do not lose access.",
      plan: "You are on the {plan} plan, valid until {date} — renew it or switch.",
      tabsLabel: "What to buy",
      tabPlan: "Subscription",
      tabTraffic: "Traffic",
    },
    profile: {
      title: "Profile",
      tgBadge: "Linked",
      tgTextOn: "One subscription and one key — in the bot and on the website.",
      tgTextOff: "One subscription for the bot and the website. Test mode.",
      tgPreparing: "Preparing the link…",
      tgNewLink: "New link",
      tgLink: "Link Telegram",
      unlink: "Unlink",
      cancel: "Cancel",
      unlinkTitle: "Where do you want to keep the subscription?",
      unlinkText:
        "Your key keeps working either way — nothing has to be set up again. Choose where it suits you to pay and " +
        "to see the term.",
      unlinkBusy: "Unlinking…",
      keepSite: "Keep it on the website",
      keepBot: "Keep it in the bot",
      unlinkFine:
        "Bypass gigabytes take no part in this choice — they stay in the bot. No bonus is given for linking again.",
      tgFineMobile:
        "If Telegram did not open — [[{url}|open the bot with this link]]. The link is single-use and valid for " +
        "15 minutes.",
      tgFineQr:
        "The bot has opened in a new tab. You can also use your phone — point the camera at the QR code or " +
        "[[{url}|open the link]]. The link is single-use and valid for 15 minutes.",
      tgNoBot: "The bot link is not configured. Open the Atlas Secure bot and send it this command:",
      notifTitle: "Notifications",
      notifNew: "New: {n}",
      notifNone: "Nothing new",
      admin: "Admin panel",
      logout: "Log out of your account",
      logoutNote: "You will need a code from an email to log in again",
    },
    friends: {
      title: "Invite your friends",
      cashbackCap: "cashback from every payment a friend makes",
      statInvited: "Invited",
      statPaid: "Paid",
      statTo: "To {percent}%",
      statLevel: "Tier",
      statMax: "max",
      share: "Share",
      shareText: "Join Atlas Secure VPS — {percent}% cashback for invitations.",
      copied: "Copied",
      copyLink: "Copy the link",
      copiedToast: "Link copied",
    },
    payments: {
      title: "Payment history",
      loadFail: "Could not load the history. Please refresh the page.",
      empty: "No payments yet — the history will appear here after your first payment.",
      traffic: "Traffic pack",
      trafficGb: "Traffic pack, {gb} GB",
      subscription: "Subscription",
      subscriptionPlan: "{plan} subscription · {months} mo",
      confirmed: "Paid",
      pending: "Processing",
      refunded: "Refunded",
      canceled: "Cancelled",
      expired: "Expired",
    },
    settings: {
      title: "Notifications and sign-in",
      push: "Push notifications",
      pushNo: "This browser does not support them",
      pushOn: "On — we will remind you to renew",
      pushOff: "Off",
      news: "News and offers",
      newsLoading: "Loading…",
      newsOn: "We send deals and news by email",
      newsOff: "Off — only emails about your subscription",
      saveFail: "Could not save. Please try again.",
      iosTitle: "Atlas on the Home Screen",
      iosNote: "Your account as an app, plus renewal reminders",
      install: "Install",
      fast: "Fast sign-in",
      fastOn: "Set up",
      fastHas: "Face ID or Touch ID instead of a code",
      fastNo: "Sign in without a code from an email",
      fastFail: "That did not work. Please try later.",
      no: "No",
      unlink: "Remove",
      setup: "Set up",
    },
    key: {
      lessHour: "less than an hour",
      ringLtHour: "hour",
      subLink: "subscription link",
      appLabel: "App to connect with",
      qrHint: "Point the camera of the phone that has {app} on it.",
      copyManual: "Copy it by hand:",
      openIn: "Open in {app}",
      copy: "Copy",
      copied: "Copied",
      qr: "QR code",
      hideQr: "Hide the QR",
      copiedLive: "Link copied: {what}",
      more: "Details",
      planSub: "Subscription",
      planTrial: "Trial period",
      planNamed: "{plan} plan",
      badgeSub: "Subscription",
      badgeTrial: "Trial",
      expired: "Expired",
      active: "Active",
      until: "until {date}",
      expiredFrom: "The subscription has not been active since {date}. Renew it and the key works again.",
      renewSub: "Renew the subscription",
      keySoon: "The key is almost ready — refresh the page in a few seconds.",
      checking: "Checking",
      crediting: "Crediting",
      noPack: "No pack",
      unlimited: "No limit",
      leftX: "{size} left",
      ready: "Ready",
      used: "{size} used",
      outOf: "of {size}",
      creditingNote: "The {size} you paid for is being credited — usually a couple of minutes.",
      buyMoreGb: "Buy more gigabytes",
      buyPack: "Buy a traffic pack",
      keyAfterCredit: "The key will appear here as soon as the gigabytes are credited.",
      noKeyYet:
        "There is no key yet. Buy a traffic pack and the key appears right after payment. Packs add up and have " +
        "no expiry date.",
      checkTerm: "Check the term against the server",
      checkingNow: "Checking…",
      subInactive: "Subscription is not active",
      left: "left",
      closedFrom: "Access closed since {date}",
      untilLong: "Until {date}",
      buySub: "Buy a subscription",
      renew: "Renew",
      addDevice: "Connect a device",
      balance: "Balance",
      balanceCap: "goes towards your next renewal",
      cashback: "Cashback",
      cashbackVal: "{percent}% from the payments of those you invited",
      invited: "Invited",
      invitedPaid: ", {n} paid",
      invite: "Invite",
      quickDevice: "Connect a device",
      quickGb: "Buy GB",
      quickFriend: "Invite a friend",
      quickSupport: "Support",
      firstTitle: "First steps",
      firstLive: "First steps: {done} of {total} done.",
      firstDone: "Every step done — a great start!",
      stepDeviceShort: "Device",
      stepDeviceTitle: "Connect a device",
      stepDeviceText: "A phone, a computer or a TV — up to {devices} on one subscription.",
      stepDeviceAct: "Connect",
      stepTgShort: "Telegram",
      stepTgTitle: "Link Telegram",
      stepTgText: "+{days} on your subscription for linking the bot.",
      stepTgAct: "Link",
      stepFriendShort: "Friend",
      stepFriendTitle: "Invite a friend",
      stepFriendText: "{percent}% cashback from every payment a friend makes.",
      stepFriendAct: "Invite",
      keysTitle: "Connection keys",
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
    hour: ["hour", "hours", "hours"],
    year: ["year", "years", "years"],
    month: ["month", "months", "months"],
    person: ["person", "people", "people"],
    cityIn: ["city", "cities", "cities"],
    day: ["day", "days", "days"],
    country: ["country", "countries", "countries"],
    device: ["device", "devices", "devices"],
    countryIn: ["country", "countries", "countries"],
    city: ["city", "cities", "cities"],
  },
};
