/**
 * Вакансии — единственный источник (владелец, 18.09.2026; состав и
 * вилки взяты с его макетов).
 *
 * Требования и «будет плюсом» составлены по разбору рынка РФ 2026
 * (Хабр Карьера, обзоры зарплат Slurm и WEB-HH за 2026 год): для
 * DevOps середина рынка — Kubernetes, Terraform/OpenTofu, Ansible,
 * Prometheus и один язык (Go или Python); для ML — Python, классика
 * (scikit-learn, XGBoost/LightGBM), работа с сырыми логами и потоками
 * событий, SQL и метрики бинарной классификации, а облака и MLOps
 * (Docker, Kubernetes, Airflow) идут плюсом. Вилки не выдуманы и не
 * «подтянуты к рынку» — это решение владельца.
 *
 * СЛОВО «VPN» НЕ УПОТРЕБЛЯЕТСЯ И ЗДЕСЬ (владелец, 18.09.2026: «VPN на
 * VPS поменяй для корректности»). Сначала оно осталось в тегах, как на
 * макете, — рассудили, что страница найма разговаривает с инженерами.
 * Владелец решил иначе, и это правильнее: правило витрины не знает
 * исключений, иначе их становится два, потом пять. Там, где речь о
 * продукте, — «VPS-инфраструктура»; там, где о технологии, — точное
 * «туннельные протоколы», а не эвфемизм.
 */

import type { Locale } from "./locale";

export interface Vacancy {
  id: string;
  title: string;
  /** Вилка в тысячах рублей в месяц, как на макете: «180–280k». */
  from: number;
  to: number;
  /** Короткие теги под названием. */
  tags: string[];
  /** Одна фраза: зачем эта роль компании. */
  about: string;
  /** Что делать — глаголами. */
  tasks: string[];
  /** Что ждём. */
  need: string[];
  /** Что будет плюсом. */
  plus: string[];
  /** Формат работы — без единицы: «₽/мес» подписывается к вилке. */
  mode: string;
  /**
   * То же по-английски. Поле ОБЯЗАТЕЛЬНОЕ: вакансия без перевода не
   * соберётся, и на английской странице не окажется русского текста.
   * Вилка, id и порядок — общие: это не слова, а данные.
   */
  en: VacancyText;
}

/** Переводимая часть вакансии. */
export interface VacancyText {
  title: string;
  tags: string[];
  about: string;
  tasks: string[];
  need: string[];
  plus: string[];
  mode: string;
}

export const VACANCIES: Vacancy[] = [
  {
    id: "ml-lead",
    title: "Руководитель ML-направления",
    from: 350,
    to: 450,
    tags: ["команда с нуля", "антифрод", "роадмап"],
    about: "Собрать ML-направление с чистого листа: от первой модели до команды, которая её содержит.",
    tasks: [
      "Собрать команду и выстроить процесс: от гипотезы до модели в проде",
      "Определить роадмап: антифрод на оплатах, аномалии в трафике, автоподбор узла для пользователя",
      "Отвечать за метрики направления перед владельцем, а не за количество экспериментов",
      "Выбрать инфраструктуру обучения и выката и не дать ей превратиться в зоопарк",
    ],
    need: [
      "Опыт руководства ML-командой от двух лет и собственный сильный инженерный бэкграунд",
      "Продовые ML-системы, которые вы довели до эксплуатации, а не остановили на ноутбуке",
      "Python и классический стек (scikit-learn, XGBoost/LightGBM), понимание метрик бинарной классификации",
      "Умение объяснить бизнесу, почему модель ошибается, и что это стоит в деньгах",
    ],
    plus: [
      "Антифрод или скоринг платежей",
      "Потоковые данные: Kafka, оконные агрегации, real-time инференс",
      "MLOps: Docker, Kubernetes, Airflow, MLflow",
      "Опыт найма и наставничества",
    ],
    mode: "удалённо",
    en: {
      title: "Head of ML",
      tags: [
        "a team from scratch",
        "anti-fraud",
        "roadmap",
      ],
      about: "Build the ML function from a blank page: from the first model to the team that maintains it.",
      tasks: [
        "Build the team and set up the process: from hypothesis to a model in production",
        "Set the roadmap: anti-fraud on payments, anomalies in traffic, automatic node selection for users",
        "Answer to the owner for the function's metrics, not for the number of experiments",
        "Choose the training and deployment infrastructure and keep it from turning into a zoo",
      ],
      need: [
        "Two years or more leading an ML team, with a strong engineering background of your own",
        "Production ML systems you took all the way into operation, not ones that stopped on a laptop",
        "Python and the classic stack (scikit-learn, XGBoost/LightGBM), a grasp of binary classification metrics",
        "The ability to explain to the business why a model is wrong, and what that costs in money",
      ],
      plus: [
        "Anti-fraud or payment scoring",
        "Streaming data: Kafka, windowed aggregation, real-time inference",
        "MLOps: Docker, Kubernetes, Airflow, MLflow",
        "Experience hiring and mentoring",
      ],
      mode: "remote",
    },
  },
  {
    id: "ml",
    title: "ML-инженер",
    from: 200,
    to: 300,
    tags: ["детекция аномалий", "автоподбор серверов"],
    about: "Научить сервис замечать странное в трафике и сам выбирать пользователю лучший узел.",
    tasks: [
      "Строить модели детекции аномалий на логах подключений и платежей",
      "Собрать автоподбор сервера: предсказывать, где человеку будет быстрее",
      "Довести модель до продакшена и следить за её деградацией, а не сдать в архив",
      "Готовить данные: витрины, признаки, разметка",
    ],
    need: [
      "Python и ML-стек: scikit-learn, XGBoost/LightGBM; PyTorch — по желанию задачи",
      "Уверенный SQL и опыт с большими объёмами неструктурированных данных: сырые логи, потоки событий",
      "Понимание метрик качества и умение выбрать порог под бизнес-цену ошибки",
      "Git, код-ревью, воспроизводимые эксперименты",
    ],
    plus: [
      "Опыт с сетевыми или платёжными данными",
      "Airflow и оркестрация пайплайнов",
      "Docker и выкат моделей сервисом",
      "Публикации, Kaggle, открытый код",
    ],
    mode: "удалённо",
    en: {
      title: "ML engineer",
      tags: [
        "anomaly detection",
        "automatic server selection",
      ],
      about: "Teach the service to spot the odd thing in traffic and pick the best node for a user by itself.",
      tasks: [
        "Build anomaly detection models on connection and payment logs",
        "Build automatic server selection: predict where a person will be faster",
        "Take a model all the way to production and watch it degrade, rather than filing it away",
        "Prepare the data: marts, features, labelling",
      ],
      need: [
        "Python and the ML stack: scikit-learn, XGBoost/LightGBM; PyTorch where the task calls for it",
        "Confident SQL and experience with large volumes of unstructured data: raw logs, event streams",
        "A grasp of quality metrics and the ability to pick a threshold against the business cost of an error",
        "Git, code review, reproducible experiments",
      ],
      plus: [
        "Experience with network or payment data",
        "Airflow and pipeline orchestration",
        "Docker and shipping models as a service",
        "Publications, Kaggle, open source",
      ],
      mode: "remote",
    },
  },
  {
    id: "devops",
    title: "DevOps-инженер",
    from: 180,
    to: 280,
    tags: ["хостинг и VPS-инфраструктура", "CI/CD", "мониторинг"],
    about: "Держать инфраструктуру, на которой живут узлы в 19 странах, панель и сайт.",
    tasks: [
      "Разворачивать и обслуживать узлы: конфигурация, обновления, автоматизация рутины",
      "Вести CI/CD: сборка, выкат, откат без ручных шагов и без ночных подвигов",
      "Настроить наблюдаемость — метрики, логи, алерты, дежурства по инцидентам",
      "Считать стоимость инфраструктуры и уменьшать её, не теряя запас прочности",
    ],
    need: [
      "Linux на уровне «сам разберу инцидент», сети — на уровне понимания маршрутов и NAT",
      "Kubernetes и контейнеры в проде, Terraform или OpenTofu, Ansible",
      "Prometheus и Grafana (или VictoriaMetrics), внятные алерты вместо стены графиков",
      "Один язык для автоматизации: Go или Python",
    ],
    plus: [
      "Опыт с туннельными протоколами и сетевыми сервисами под нагрузкой",
      "Несколько облаков и bare-metal одновременно",
      "Безопасность: секреты, доступы, аудит",
      "Опыт дежурств и постмортемов",
    ],
    mode: "удалённо",
    en: {
      title: "DevOps engineer",
      tags: [
        "hosting and VPS infrastructure",
        "CI/CD",
        "monitoring",
      ],
      about: "Keep running the infrastructure the nodes in 19 countries, the panel and the site all live on.",
      tasks: [
        "Deploy and maintain nodes: configuration, updates, automating the routine",
        "Run CI/CD: build, deploy, roll back with no manual steps and no heroics at night",
        "Set up observability — metrics, logs, alerts, incident on-call",
        "Count what the infrastructure costs and bring it down without losing headroom",
      ],
      need: [
        "Linux at the level of “I will work the incident out myself”, networks at the level of routes and NAT",
        "Kubernetes and containers in production, Terraform or OpenTofu, Ansible",
        "Prometheus and Grafana (or VictoriaMetrics), sensible alerts instead of a wall of graphs",
        "One language for automation: Go or Python",
      ],
      plus: [
        "Experience with tunnelling protocols and network services under load",
        "Several clouds and bare metal at the same time",
        "Security: secrets, access, audit",
        "Experience with on-call rotas and postmortems",
      ],
      mode: "remote",
    },
  },
  {
    id: "network",
    title: "Сетевой инженер",
    from: 150,
    to: 220,
    tags: ["WireGuard", "балансировка", "дата-центры"],
    about: "Отвечать за то, ради чего люди платят: скорость и стабильность соединения.",
    tasks: [
      "Настраивать и держать узлы: маршрутизация, балансировка, отказоустойчивость",
      "Разбирать деградации: где потерялись пакеты и почему выросла задержка",
      "Работать с площадками: подключения, каналы, планы расширения",
      "Мерить и документировать — чтобы обещания на сайте были подтверждены замером",
    ],
    need: [
      "Сети всерьёз: TCP/IP, BGP, маршрутизация, NAT, MTU и всё, что ломается на практике",
      "WireGuard и туннельные протоколы, iptables/nftables",
      "Linux, автоматизация конфигураций, tcpdump и чтение трафика",
      "Готовность дежурить по графику вместе с командой",
    ],
    plus: [
      "Опыт эксплуатации сети в нескольких дата-центрах и странах",
      "Anycast, балансировщики L4/L7",
      "Опыт с высоконагруженными прокси-сервисами",
      "Скрипты и автоматика на Python или Go",
    ],
    mode: "удалённо",
    en: {
      title: "Network engineer",
      tags: [
        "WireGuard",
        "load balancing",
        "data centres",
      ],
      about: "Own the thing people actually pay for: the speed and stability of the connection.",
      tasks: [
        "Configure and maintain nodes: routing, balancing, fault tolerance",
        "Work out degradations: where packets were lost and why latency grew",
        "Work with the sites: connections, links, expansion plans",
        "Measure and document — so that the promises on the site are backed by a measurement",
      ],
      need: [
        "Networks in earnest: TCP/IP, BGP, routing, NAT, MTU and everything that breaks in practice",
        "WireGuard and tunnelling protocols, iptables/nftables",
        "Linux, configuration automation, tcpdump and reading traffic",
        "Willingness to take on-call shifts along with the team",
      ],
      plus: [
        "Experience running a network across several data centres and countries",
        "Anycast, L4/L7 load balancers",
        "Experience with high-load proxy services",
        "Scripts and automation in Python or Go",
      ],
      mode: "remote",
    },
  },
  {
    id: "support",
    title: "Инженер техподдержки",
    from: 70,
    to: 100,
    tags: ["помощь пользователям", "посменно", "удалёнка"],
    about: "Быть тем человеком, к которому приходят, когда «не подключается», — и решать это за одно обращение.",
    tasks: [
      "Отвечать в Telegram и на почте: разбирать подключение, оплату, устройства",
      "Воспроизводить проблему и передавать инженерам понятный отчёт, а не «у клиента не работает»",
      "Писать и поддерживать инструкции, чтобы следующий такой вопрос не пришёл",
      "Замечать повторяющиеся обращения и приносить их как задачу продукту",
    ],
    need: [
      "Русский письменный, спокойный и человеческий — без канцелярита",
      "Понимание, как устроены интернет и сети на бытовом уровне: IP, DNS, роутер, Wi-Fi",
      "Опыт поддержки пользователей или сильное желание в неё вникнуть",
      "Готовность работать по сменам, включая выходные по графику",
    ],
    plus: [
      "Опыт с клиентами туннельных подключений и настройкой сетевых приложений",
      "Английский для переписки с вендорами",
      "Опыт в поддержке SaaS или хостинга",
      "Умение писать инструкции так, чтобы по ним делали",
    ],
    mode: "сменный график, удалённо",
    en: {
      title: "Support engineer",
      tags: [
        "helping users",
        "shift work",
        "remote",
      ],
      about: "Be the person people come to when “it will not connect” — and solve it in one conversation.",
      tasks: [
        "Answer on Telegram and by email: work through connections, payments, devices",
        "Reproduce the problem and hand engineers a clear report, not “it does not work for a customer”",
        "Write and maintain guides, so the next question like it never arrives",
        "Notice repeat requests and bring them to the product as a task",
      ],
      need: [
        "Written Russian that is calm and human — no officialese",
        "An everyday understanding of how the internet and networks work: IP, DNS, router, Wi-Fi",
        "Experience supporting users, or a strong wish to get into it",
        "Willingness to work shifts, including weekends on a rota",
      ],
      plus: [
        "Experience with tunnelling clients and configuring network applications",
        "English for correspondence with vendors",
        "Experience in SaaS or hosting support",
        "The knack of writing instructions people actually follow",
      ],
      mode: "shift work, remote",
    },
  },
  {
    id: "hr",
    title: "HR-менеджер",
    from: 90,
    to: 120,
    tags: ["найм в IT", "онбординг", "HR-бренд"],
    about: "Закрывать инженерные роли и делать так, чтобы к нам хотели приходить.",
    tasks: [
      "Вести найм от заявки до оффера: поиск, скрининг, координация собеседований",
      "Держать онбординг: первый день, первый месяц, обратная связь",
      "Развивать HR-бренд: тексты вакансий, каналы, присутствие в профильных сообществах",
      "Считать воронку найма и говорить о ней числами",
    ],
    need: [
      "Опыт найма в IT и понимание разницы между DevOps, ML и поддержкой",
      "Умение писать вакансии, которые читают, и отказы, после которых остаются хорошие отношения",
      "Самостоятельность: команда распределённая, над вами не стоят",
      "Аккуратность в данных: ATS, сроки, статусы кандидатов",
    ],
    plus: [
      "Опыт работы в распределённой команде",
      "Знание рынка удалёнки и грейдов",
      "Английский для работы с кандидатами вне РФ",
      "Опыт построения HR-процессов с нуля",
    ],
    mode: "удалённо",
    en: {
      title: "HR manager",
      tags: [
        "hiring in IT",
        "onboarding",
        "employer brand",
      ],
      about: "Fill engineering roles and make this a place people want to come to.",
      tasks: [
        "Run hiring from request to offer: sourcing, screening, coordinating interviews",
        "Own onboarding: the first day, the first month, feedback",
        "Grow the employer brand: job texts, channels, presence in the right communities",
        "Measure the hiring funnel and talk about it in numbers",
      ],
      need: [
        "Experience hiring in IT and an understanding of the difference between DevOps, ML and support",
        "The ability to write job posts people read, and rejections that leave the relationship intact",
        "Self-direction: the team is distributed and nobody stands over you",
        "Care with data: ATS, deadlines, candidate statuses",
      ],
      plus: [
        "Experience in a distributed team",
        "Knowledge of the remote market and its grades",
        "English for working with candidates outside Russia",
        "Experience building HR processes from scratch",
      ],
      mode: "remote",
    },
  },
];

/** Переводимая часть вакансии на языке страницы. */
export function vacancyText(v: Vacancy, locale: Locale): VacancyText {
  return locale === "ru"
    ? { title: v.title, tags: v.tags, about: v.about, tasks: v.tasks, need: v.need, plus: v.plus, mode: v.mode }
    : v.en;
}

/** Куда писать откликом. Почта — из единого источника контактов. */
export const CAREERS_SUBJECT = "Вакансия";

/**
 * Отклик на вакансию — границы формы. Единственный источник и для
 * страницы, и для обработчика: проверка на клиенте нужна, чтобы
 * человек узнал об ошибке сразу, но решает всё равно сервер.
 *
 * ПОЧЕМУ 5 МБ. Резюме — это документ, а не портфолио: PDF на пару
 * страниц весит сотни килобайт. Пять мегабайт с запасом хватает и на
 * скан, и не даёт превратить форму в файлообменник. Тот же предел
 * держит письмо в границах Resend (вложение уезжает в base64,
 * прибавляя треть объёма).
 *
 * ПОЧЕМУ СПИСОК РАСШИРЕНИЙ, А НЕ MIME. Браузеры зовут .doc то
 * `application/msword`, то `application/octet-stream`, а Safari на
 * iPhone иногда не присылает тип вовсе. Расширение — то, что видит
 * человек, и то, по чему файл всё равно будет открываться.
 */
export const RESUME_MAX_MB = 5;
export const RESUME_MAX_BYTES = RESUME_MAX_MB * 1024 * 1024;

export const RESUME_EXTENSIONS = [".pdf", ".doc", ".docx", ".rtf", ".odt", ".txt", ".png", ".jpg", ".jpeg"] as const;

/** Для атрибута accept — он же подсказка в проводнике. */
export const RESUME_ACCEPT = RESUME_EXTENSIONS.join(",");

/** Человеческая подпись под полем. */
export const RESUME_HINT = `PDF, DOC, DOCX, RTF, ODT, TXT или снимок экрана — до ${RESUME_MAX_MB} МБ`;

/**
 * Сколько храним отклик. Срок назван в Политике конфиденциальности, и
 * его соблюдает уборщик `src/lib/retention.ts`, а не обещание.
 */
export const APPLICATION_RETENTION_MONTHS = 6;
