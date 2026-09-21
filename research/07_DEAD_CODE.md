# 07. Мёртвый код и оптимизация — разбор 21.09.2026

Отчёт-находка, а не правка: **ничего не удалено и не изменено**. Каждая
строка снабжена командой, которой проверялось, и степенью уверенности.

Как считалось. Построен граф импортов всего `src/` (прямые импорты,
`import()`, алиас `@/`, импорты CSS из TS/TSX) и от него посчитана
достижимость от точек входа App Router (`page.tsx`, `layout.tsx`,
`route.ts`, `not-found.tsx`, `icon.tsx`, `opengraph-image.tsx`,
`middleware.ts`). Классы CSS искались по всему `src/` с границами слова
и **с поправкой на сборку из кусков**: из кода вынуты все префиксы вида
``prefix-${`` (43 штуки), и класс с таким префиксом в мёртвые не
записывался. Именно эта поправка сняла с расстрела `.v4-d-blue`,
`.ti-unit-lime`, `.v-row-icon-red` и ещё шесть — они собираются
подстановкой и живы.

Что НЕ считалось мёртвым по условию задачи: `design/blender/**`
(исходники рендеров), `*.md` в корне и `docs/`, `src/lib/__tests__/**`.

---

## Главное в двух абзацах

**`src/app/lab/` не в гите.** Каталог исключён через
`.git/info/exclude` (строка 7) и через `.railwayignore`. Проверка:
`git check-ignore -v src/app/lab/hero/page.tsx` → `.git/info/exclude:7`.
То есть это локальная песочница, которой нет ни в репозитории, ни на
Railway. **Из-за этого 21 файл корпуса «Атлас» (≈2 900 строк) и вся
связка с `three` висят в гите, но в собираемом сайте их не достигает
ничто, кроме этой песочницы.** Это не «мусор», это решение владельца —
поэтому весь блок в части Б, а не А.

**Оба языковых словаря (237 КБ) уезжают в браузер на 12 маршрутах.**
Это прямое нарушение правила из CLAUDE.md («Клиентские компоненты
словарь НЕ импортируют — иначе в браузер уедут оба языка»), и оно
измерено на свежей сборке, а не предположено. Причина — одна строка.
Подробности в части В, находка В-1; это самая дорогая правка отчёта по
отношению «выигрыш / объём работы».

---

# А. Точно мёртвое

Всё в этом разделе: нет ни одного импорта, ни одного упоминания класса
в разметке, ни одной ссылки из конфигов. Удаляется без раздумий.

## А-1. Отладочные PNG в корне репозитория — 12 файлов, 5 374 КБ

```
dash-en-subs.png       164 КБ      hero-dots3.png         620 КБ
devices-375.png        130 КБ      hero-dots4.png         620 КБ
happ-1280.png          385 КБ      home-current-1440.png  503 КБ
hero-clay-1440.png     168 КБ      seam.png               312 КБ
hero-dots.png          605 КБ      stage-a.png            615 КБ
hero-dots2.png         610 КБ      stage-b.png            640 КБ
```

Чем проверено:

```bash
for f in dash-en-subs devices-375 happ-1280 hero-clay-1440 hero-dots \
         hero-dots2 hero-dots3 hero-dots4 home-current-1440 seam stage-a stage-b; do
  grep -rl "$f" --include="*.md" --include="*.ts" --include="*.tsx" \
       --include="*.css" --include="*.json" . | grep -v node_modules | grep -v "^./.next"
done
# вывод: пусто для всех двенадцати
git ls-files "*.png" | grep -c "^[a-z-]*\.png$"   # 0 — ни один не отслеживается
grep -n "png" .gitignore                          # только "qa-*.png"
```

`seam.png` в первом проходе ложно «нашёлся» в `docs/BRIEF.md` —
это было слово «seamless» в тексте, а не ссылка на файл.

**Уверенность: точно мёртвое.** Это снимки Playwright/DevTools, которые
не попали под правило `.gitignore`. В `.gitignore` уже есть `/shots/`,
`qa-*.png` и `.playwright-mcp/` — эти двенадцать просто легли в корень.
Заодно стоит дописать правило, иначе они накопятся снова.

## А-2. `src/app/px-forms.css` — 169 строк, 6 025 Б, файл целиком

Не импортируется ничем, и ни один из его 18 классов не встречается в
разметке.

```bash
grep -rn "px-forms" src --include="*.tsx" --include="*.ts"
# пусто

grep -rn "px-field\|px-label\|px-input\|px-choice\|px-form" src --include="*.tsx"
# единственное попадание — комментарий в layout.tsx:120 про «.px-input»

grep -rn "var(--px-" src --include="*.css" --include="*.tsx" | grep -v px-forms.css
# пусто — токены --px-* тоже никому не нужны
```

Шапка файла утверждает, что он живёт на `/business` и `/contact` и
подключается «их видами первым импортом». Обе страницы сейчас
подключают другое:

```bash
grep -n "css" src/app/business/BusinessView.tsx src/app/contact/ContactView.tsx
# BusinessView.tsx:10:import "@/app/vps-info.css";
# ContactView.tsx:11:import "@/app/vps-info.css";
```

Более того, `business-atlas.css`, на который файл ссылается в
комментарии, в проекте отсутствует (`ls src/app/business/` → только
три `.tsx`).

**Уверенность: точно мёртвое.** Одна оговорка не про код, а про
документацию: CLAUDE.md в разделе Design System всё ещё называет
`px-forms.css` действующим («поля форм — px-forms.css (только
/business и /contact)»). Эту строку надо поправить тем же движением —
иначе следующий заход по описанию заведёт файл заново.

## А-3. Связка «карта серверов» — `Chart.tsx` + `LandLight.tsx`, 166 строк, 7 594 Б

| файл | строк | байт |
|---|---|---|
| `src/components/atlas/Chart.tsx` | 126 | 5 996 |
| `src/components/atlas/LandLight.tsx` | 40 | 1 598 |

```bash
grep -rn "Chart" src --include="*.tsx" --include="*.ts" | grep -v "^src/components/atlas/Chart.tsx"
# пусто (в том числе в src/app/lab)

grep -rn "LandLight" src --include="*.tsx" --include="*.ts"
# только src/components/atlas/Chart.tsx:4 и :62 — то есть держится за мертвеца
```

Шапка `Chart.tsx`: «Карта серверов (/infrastructure)». Но
`/infrastructure` давно рисует другой компонент:

```bash
grep -n "import" src/app/infrastructure/page.tsx | grep -i "map\|chart"
# 6:import NetMap from "./NetMap";
```

Вместе с ними умирают три класса в `atlas.css` — `.a-land-t0`,
`.a-land-t1`, `.a-land-t2` (их ставит только `LandLight` строкой
`` `a-land-t${i}` ``; отдельно они в списке ниже не учтены, чтобы не
считать дважды).

**Уверенность: точно мёртвое.** Оговорка ради честности: `Chart.tsx`
тянет `src/lib/isochrones.ts` и `src/lib/sun.ts`, но их удалять сюда
нельзя — они ещё нужны `AtlasDefs.tsx` из корпуса lab (часть Б).

## А-4. `src/components/atlas/PointerDrift.tsx` — 43 строки, 1 607 Б

```bash
grep -rn "PointerDrift" src --include="*.tsx" --include="*.ts" | grep -v "^src/components/atlas/PointerDrift.tsx"
# пусто — включая lab
```

Единственный компонент корпуса «Атлас», до которого не дотягивается
даже песочница. Параллакс за курсором, который нигде не смонтирован.

**Уверенность: точно мёртвое.**

## А-5. `src/app/api/user/devices/route.ts` — 71 строка, 1 804 Б

Маршрут не вызывается ниоткуда:

```bash
grep -rn "api/user/devices" src --include="*.ts" --include="*.tsx"
# пусто
grep -rn "api/user/devices" --include="*.md" . | grep -v node_modules
# пусто
```

Содержимое — остаток первоначального каркаса: `icon: "🤖"`, `icon:
"🍎"`, `downloadUrl: "#"`, инструкции «Скачайте приложение из Google
Play». Это противоречит сразу двум правилам проекта: «Иконки — только
собственный набор… Никаких сторонних библиотек, эмодзи» и «Числа на
страницах должны быть подтверждены кодом». Список платформ живёт в
`src/app/devices/`, а не здесь.

**Уверенность: точно мёртвое.** Маршрут публичный, так что теоретически
его мог бы дёргать кто-то извне — но отдаёт он выдуманные данные с
`downloadUrl: "#"`, и такой внешний потребитель уже сломан.

## А-6. Мёртвые типы в `src/types/index.ts` — 70 из 121 строки, 1 337 Б

Из файла используются ровно два экспорта: `SubscriptionData` (4 файла)
и `BypassLive` (`src/lib/use-bypass.ts`). Остальные восемь — нет:

```bash
for n in User VerificationCode ApiResponse DeviceInfo InstructionStep \
         XrayUserConfig XrayInboundClient XrayApiRequest; do
  echo -n "$n: "; grep -rn "\b$n\b" src --include="*.ts" --include="*.tsx" | grep -c "@/types"
done
# все: 0 — ни один не импортируется из @/types
```

`User` даёт 92 попадания по `src/`, но ни одного из `@/types`: это
одноимённые локальные типы (`UserRecord` в `store.ts`, `PanelUser` в
`remnawave.ts`) и слово в комментариях. `XrayUserConfig`,
`XrayInboundClient`, `XrayApiRequest` — остатки интеграции Xray,
которой в проекте больше нет (`src/lib/xray.ts` из CLAUDE.md не
существует: `ls src/lib/xray.ts` → нет файла). `ApiResponse` описывает
формат ответа API, но нигде не применён.

**Уверенность: точно мёртвое** (строки 1–29 и 81–121).

## А-7. Мёртвые правила в живых CSS — ~637 строк, ~25 792 Б

Классы, которых нет ни в одной разметке и которые не собираются
шаблоном. Метод: `python3` по всем `.css`, границы слова, фильтр
динамических префиксов. Полный скрипт и вывод воспроизводятся так:

```bash
# для одного класса
grep -rn "(?<![\w-])ak-sheet-veil(?![\w-])" -P src --include="*.tsx" --include="*.ts"
```

| файл | мёртвых классов | правил | ~строк | ~байт |
|---|---|---|---|---|
| `src/app/work-atlas.css` | 88 из 139 | 170 | 472 | 20 127 |
| `src/app/vps.css` | 13 из 173 | 19 | 91 | 3 108 |
| `src/app/atlas.css` | 13 из 96 | 13 | 26 | 1 067 |
| `src/app/tech.css` | 5 | 5 | 21 | 565 |
| `src/app/dashboard/cabinet-vps.css` | 4 | 8 | 19 | 678 |
| `src/app/subscribe/subscribe-vps.css` | 1 | 1 | 4 | 98 |
| `src/app/careers/careers.css` | 1 | 1 | 2 | 73 |
| `src/app/vps-info.css` | 1 | 1 | 2 | 76 |
| **итого** | **126** | **218** | **~637** | **~25 792** |

**`work-atlas.css` — главный склад.** 88 мёртвых классов из 139 — это
весь кабинет до перевода на `cabinet-vps.css` и весь экран входа до
перевода на `auth-v.css`. Конкретно: `.ak-key*`, `.ak-kblock`,
`.ak-kpair`, `.ak-kgb`, `.ak-qr` (ключи), `.ak-sheet*` (девять классов
шторки уведомлений — стили переехали в `cabinet-vps.css`, это прямо
написано в шапке `NotificationsModal.tsx`), `.ak-perk*` (шесть,
«пункты тёмной плиты» экрана входа), `.ak-tier*`, `.ak-rail*`,
`.ak-friends` (шкала кешбэка), `.ak-note*` (семь), `.ak-orb`,
`.ak-has-orb`, `.ak-stat`, `.ak-spark*`, `.dv`, `.asb-dock`.
Файл сейчас подключает **только** админка:

```bash
grep -rn "work-atlas.css" src --include="*.tsx"
# src/app/admin/AdminView.tsx:25:import "@/app/work-atlas.css";
```

**`vps.css`** — `.v-balance`, `.v-balance-plus`, `.v-btn-pill`,
`.v-cab-title`, `.v-divider`, `.v-profile`, `.v-profile-name`,
`.v-skel`, `.v-stack`, `.v-stat`, `.v-stat-card`, `.v-stat-stage`,
`.v-store-link`.

**`atlas.css`** — `.a-index-table`, `.a-sym`, `.a-sym-flow`,
`.a-void-in`, `.a-void-map`, `.a-void-ring`, `.a-void-spot`, плюс
тройка `.ak-enter` / `.ak-kicker-step` / `.ak-perk`, объявленная тут
вторым экземпляром (она же мертва и в `work-atlas.css`), плюс
`.a-land-t0/1/2` из находки А-3.

**`tech.css`** — `.t-cards-3`, `.t-icon`, `.t-num-sm`, `.t-rule`,
`.t-tag`. **`cabinet-vps.css`** — `.vc-balance`, `.vc-hr`, `.vc-kgb`,
`.vc-panel-head`. **`subscribe-vps.css`** — `.vs-carousel-wrap`.
**`careers.css`** — `.tc-mode`. **`vps-info.css`** — `.vp-cols-3`.

**Уверенность: точно мёртвое.** Две оговорки, которые я снял вручную и
которые важны, если кто-то повторит проверку менее аккуратно:

* `.lenis-stopped`, `.lenis-scrolling`, `.lenis-autoToggle` в
  `smooth-scroll.css` выглядят мёртвыми (их нет в разметке), но их
  ставит сама библиотека Lenis на `<html>`. **Не трогать.**
* `.aa-cover`, `.ab-cover`, `.ai-cover`, `.asec-cover`, `.av-cover` в
  `atlas-mobile.css` (строки 209 и 213) — пятёрка внутри `:is()` рядом
  с живым `.a`. Формально мертвы, но правило целиком удалить нельзя, и
  выигрыш — две строки. В таблицу не включены.

### Итог части А

| что | строк | байт |
|---|---|---|
| двенадцать PNG в корне | — | 5 502 804 |
| `px-forms.css` целиком | 169 | 6 025 |
| `Chart.tsx` + `LandLight.tsx` | 166 | 7 594 |
| `PointerDrift.tsx` | 43 | 1 607 |
| `api/user/devices/route.ts` | 71 | 1 804 |
| мёртвые типы в `types/index.ts` | 70 | 1 337 |
| мёртвые правила в живых CSS | ~637 | ~25 792 |
| **всего кода и стилей** | **~1 156** | **~44 159 Б ≈ 43 КБ** |
| **всего с картинками** | **~1 156** | **≈ 5 417 КБ ≈ 5,29 МБ** |

---

# Б. Требует решения

Выглядит мёртвым, но есть причина не спешить. Здесь же — всё, что
живёт ради локальной песочницы и ради возможности вернуть снятое.

## Б-1. Весь корпус «Атлас» держится на одной песочнице вне гита

Это самая крупная находка отчёта и одновременно самая осторожная.

```bash
git check-ignore -v src/app/lab/hero/page.tsx
# .git/info/exclude:7    src/app/lab/hero/page.tsx
git ls-files src/app/lab | wc -l        # 0
grep -n "src/app/lab" .railwayignore    # src/app/lab
```

То есть `src/app/lab/**` (17 файлов, 3 194 строки) не в репозитории и
не на Railway. Достижимость от точек входа даёт ровно один живой вход в
корпус «Атлас» — `src/app/admin/page.tsx` через `AtlasShell`. Всё
остальное достижимо **только** через `lab`:

| файл | строк |
|---|---|
| `src/components/atlas/AtlasHome.tsx` | 645 |
| `src/components/atlas/gl/hero.ts` | 465 |
| `src/components/atlas/gl/stage.ts` | 370 |
| `src/components/atlas/LaptopScrub.tsx` | 285 |
| `src/components/atlas/PresenceSchema.tsx` | 238 |
| `src/components/atlas/gl/orb.ts` | 229 |
| `src/components/atlas/HeroSchema.tsx` | 158 |
| `src/components/atlas/PresenceSchemaMotion.tsx` | 139 |
| `src/components/atlas/HeroGL.tsx` | 110 |
| `src/components/atlas/gl/core.ts` | 106 |
| `src/components/atlas/idle.ts` | 84 |
| `src/components/atlas/OrbGL.tsx` | 80 |
| `src/components/atlas/HeroSchemaMotion.tsx` | 64 |
| `src/components/atlas/Chars.tsx` | 37 |
| `src/components/atlas/AtlasDefs.tsx` | 28 |
| `src/components/atlas/Corner.tsx` | 21 |
| `src/lib/isochrones.ts` | 136 |
| `src/lib/sun.ts` | 57 |
| **итого TS/TSX** | **3 252** |
| `src/app/home-v5.css` | 978 |
| `src/app/home-hero.css` | 477 |
| `src/app/home-map.css` | 280 |
| `src/app/home-mobile.css` | 122 |
| `src/app/orb-atlas.css` | 58 |
| **итого CSS** | **1 915** |

Проверка для любого из них:

```bash
grep -rn "AtlasHome\|HeroGL\|LaptopScrub\|PresenceSchema\|OrbGL\|Corner\|Chars" \
     src --include="*.tsx" --include="*.ts" | grep -v "^src/components/atlas/" | grep -v "^src/app/lab/"
# единственное попадание — комментарий в src/app/layout.tsx:12
```

**Почему не в часть А.** CLAUDE.md описывает этот корпус как
действующий, `Corner.tsx` там назван частью кабинета, `home-v5.css` —
моушном главной. Реально главную давно рисует `src/components/vps/Home.tsx`,
кабинет — `cabinet-vps.css`, карту — `NetMap.tsx`. То есть корпус уже
заменён, но песочница на нём ещё живёт, и решение «песочницу
похоронить» — не моё.

**Что стоит решить одним движением:** либо lab фиксируется как
поддерживаемый стенд (тогда корпус остаётся и CLAUDE.md надо привести
в соответствие), либо lab и корпус уходят вместе — это **3 252 строки
TS + 1 915 строк CSS**. Половинчатый вариант — худший: удалить корпус,
не тронув `lab`, значит сломать локальную песочницу молча.

## Б-2. `three` и `lenis` в зависимостях ради песочницы

```bash
grep -rln "from \"three\|three/webgpu" src
# только src/components/atlas/gl/{core,hero,orb,stage}.ts

grep -rn "lenis" src --include="*.tsx" --include="*.ts" | grep import
# src/components/atlas/SmoothScroll.tsx:101: import("lenis")

du -sh node_modules/three node_modules/@types/three node_modules/lenis
#  22M  node_modules/three
# 4,5M  node_modules/@types/three
# 504K  node_modules/lenis
```

`three` нужен только четырём файлам `gl/`, которые достижимы лишь из
lab. `lenis` грузится из `SmoothScroll`, а `SmoothScroll`
отрисовывается только при `footer="full"` — единственный живой
потребитель `AtlasShell` (`/admin`) ставит `footer="compact"`:

```bash
grep -n "footer" src/app/admin/page.tsx
# <AtlasShell … footer="compact">
grep -n "work ? null : <SmoothScroll" src/components/atlas/AtlasShell.tsx
# 60:      {work ? null : <SmoothScroll />}
```

Следствие: **на боевом сайте мягкой прокрутки нет ни на одной
странице**, хотя CLAUDE.md утверждает, что она «в AtlasShell, то есть
на всех страницах корпуса». Это стоит проверить отдельно — возможно,
прокрутку потеряли при переезде на `VShell`, и это баг, а не мусор.

Локальная сборка подтверждает, что `three` попадает в чанк:
`.next/static/chunks/1qeamrlos_gfm.js` — **1 045 КБ**, внутри
`WebGPURenderer` (46 вхождений). В первой загрузке ни одного маршрута
он не стоит (грузится лениво), и на Railway его не будет вовсе, потому
что lab не выкладывается. Но `npm ci` на каждом деплое ставит 26,5 МБ
ради кода, которого в выкладке нет.

**Уверенность: похоже на мёртвое, сомнение — то же, что в Б-1.** Судьба
`three` и `lenis` решается вместе с судьбой lab, а `lenis` — ещё и
вместе с вопросом «куда делась мягкая прокрутка».

## Б-3. `ServiceMarks.tsx` и стили первого экрана — сняты вчера

```bash
grep -rn "ServiceMarks" src --include="*.tsx"
# только сам src/components/vps/home/ServiceMarks.tsx (131 строка, 5 729 Б)

git log --oneline -S "ServiceMarks" -- src/components/vps/Home.tsx
# 87aaeeb Первый экран главной: плита и матовый предмет      ← убрали
# 497455f Первый экран: знаки сервисов по бокам заголовка    ← добавили
```

Осиротел вчерашним коммитом 87aaeeb вместе с блоком стилей в
`home-vps.css`: `.vh-hero`, `.vh-hero-in`, `.vh-hero-kicker`,
`.vh-hero-note`, `.vh-app-links`, `.vh-app-seg`, `.vh-step-note` плюс
шесть `.vh-mark-gh|ig|nf|tg|tt|yt` — **12 правил, ~90 строк, ~3 682 Б**
(`.vh-mark-*` собираются строкой `` `vh-mark vh-mark-${m.id}` ``, то
есть мертвы ровно постольку, поскольку мёртв сам компонент).

**Уверенность: похоже на мёртвое, сомнение серьёзное.** Вы прямо сейчас
работаете в `src/components/vps/` и `home-clay.css`; знаки сервисов уже
один раз снимали (19.09) и возвращали. К тому же в COMPLIANCE-CHECK.md
§1е зафиксировано право на эти товарные знаки — удаление компонента
осиротит и ту строку.

## Б-4. Картинки, на которые ссылок нет

| файл | КБ | кто ссылался |
|---|---|---|
| `public/media/hero/stage-1720.v3.webp` | 122 | ничто |
| `public/media/hero/stage-860.v3.webp` | 47 | ничто |
| `public/media/laptop/f000…f119.webp` + `poster.jpg` (121 файл) | 2 040 | только `LaptopScrub.tsx` (lab) |
| `public/media/mission-soft-{700,1000,1400}.webp` | 426 | только lab |
| **итого** | **2 635** | |

```bash
grep -rn "stage-1720\|stage-860\|media/hero" src public/*.json next.config.ts
# пусто в src; только design/blender/README.md и hero_post.py

grep -rn "media/laptop\|mission-soft" src --include="*.tsx" --include="*.ts" | grep -v "^src/app/lab"
# src/components/atlas/LaptopScrub.tsx:43,44 — и всё
```

**Уверенность: похоже на мёртвое, сомнение прямо записано в коде.**
`src/app/home-vps.css:76-79`:

> «Сцена первого экрана (кадр из Blender с ноутбуком и телефоном)
> удалена 19.09.2026: владелец — „сами рендеры не к месту“. […] Файлы
> кадра и сборка сцены остались в `design/blender` — **вернуть можно,
> не пересчитывая рендер**.»

Это ровно тот случай, о котором вы предупреждали. Кадры ноутбука
(2 МБ) и `mission-soft` уйдут вместе с решением по Б-1.

## Б-5. `src/lib/platega.ts` — 120 строк, 3 123 Б

```bash
grep -rn "platega\|Platega" src --include="*.ts" --include="*.tsx" | grep -v "^src/lib/platega.ts"
# пусто
grep -n "PLATEGA" .env.example
# 57:PLATEGA_MERCHANT_ID=your-merchant-id
# 58:PLATEGA_SECRET=your-secret-key
```

Второй платёжный шлюз рядом с работающим `yookassa.ts`. Не импортируется
ничем, но переменные окружения под него заведены.

**Уверенность: похоже на мёртвое, сомнение решающее.** В вашей памяти
проекта platega стоит первым пунктом в «Открытые вопросы владельцу
(16–17.09.2026)». Пока вопрос открыт — это заготовка, а не мусор.

## Б-6. Маршруты API без вызывающих

| маршрут | строк | почему под вопросом |
|---|---|---|
| `src/app/api/auth/verify-code/route.ts` | 66 | вход переехал на server action (`src/app/actions.ts`); код сам называет маршрут legacy (`src/lib/auth-flow.ts:5`, `src/lib/trial.ts:7`), но он описан в CLAUDE.md §Auth Flow и в `docs/SOURCE_OF_TRUTH.md:103` |
| `src/app/api/user/referral/route.ts` | 37 | кабинет берёт те же данные из `/api/user/subscription`; вызовов нет нигде, но это публичный контракт, которым мог пользоваться бот |
| `src/app/api/admin/remnawave/verify/route.ts` | 73 | `PanelSyncCard.tsx:21`: «remnawave/verify из интерфейса убран: он повторял „Проверить“» — кнопки нет, маршрут остался |

```bash
grep -rn "api/auth/verify-code\|api/user/referral\|remnawave/verify" src \
     --include="*.tsx" --include="*.ts" | grep -v "^src/app/api/"
# только комментарии, ни одного fetch
```

**Уверенность: похоже на мёртвое.** У всех трёх сомнение одного рода —
внешний потребитель (бот, поддержка, закладка в браузере админа) их не
видно из кода. `SYNC_TZ.md` их не упоминает, так что бот, скорее всего,
ни при чём.

## Б-7. Экспорты, которых никто не использует

Полная проверка (границы слова, исключая объявление):

```bash
for n in REFERRAL_BONUS_DAYS CAREERS_SUBJECT RESUME_HINT SWITCH_HINT \
         sendTrialActivatedEmail citiesLabel cityNames latencyLabel \
         cookieConsentValue disableUser enableUser SERVER_TERMS \
         hasSessionCookie getAuditLogs getUserBalance increaseBalance \
         linkTelegram linkTelegramByToken syncUserToRemnawave \
         localOwnerOfPanelId landPath landPaths positionIn \
         WORLD_BOUNDS EUROPE_BOUNDS MARKETING_CONSENT_SOURCES; do
  echo "$n: $(grep -rn "\b$n\b" src --include='*.ts' --include='*.tsx' | wc -l)"
done
# у всех ровно 1 — то есть только строка объявления
```

| экспорт | файл | примечание |
|---|---|---|
| `REFERRAL_BONUS_DAYS = 20` | `src/lib/brand-facts.ts` | **важно:** «+20 дней» снято владельцем 12.09.2026, это правило прямо записано в CLAUDE.md. Константа — приглашение нарушить его снова |
| `sendTrialActivatedEmail` | `src/lib/email.ts` | письмо «Пробный период активирован» никем не отправляется — либо забыли подключить, либо решили не слать |
| `increaseBalance`, `getUserBalance`, `getAuditLogs`, `linkTelegram`, `linkTelegramByToken` | `src/lib/store.ts` | пять серверных функций с запросами к БД; `increaseBalance` — начисление кешбэка, стоит проверить, чем его заменили |
| `disableUser`, `enableUser` | `src/lib/remnawave.ts` | обёртки над API панели; рядом живут `updateUser`/`revokeUserSubscription` |
| `syncUserToRemnawave` | `src/lib/subscription-sync.ts` | псевдоним, подписанный «Backwards-compatible names used across the codebase» — а в коде не используется |
| `landPath`, `landPaths`, `positionIn`, `WORLD_BOUNDS`, `EUROPE_BOUNDS` | `src/lib/world-map.ts` | пять из одиннадцати экспортов; остальные живы через `NetMap.tsx` |
| `citiesLabel`, `cityNames`, `latencyLabel` | `src/lib/locations.ts` | `latencyLabel` особенно: задержки решено не показывать |
| `CAREERS_SUBJECT`, `RESUME_HINT` | `src/lib/careers.ts` | тексты переехали в словари `src/i18n` |
| `SWITCH_HINT` | `src/lib/key-names.ts` | рядом живёт `switchHint(aud, locale)` |
| `SERVER_TERMS` | `src/lib/servers.ts` | таблица скидок по сроку |
| `hasSessionCookie` | `src/lib/session.ts` | |
| `localOwnerOfPanelId` | `src/lib/telegram-link.ts` | |
| `cookieConsentValue` | `src/lib/overlay-queue.ts` | |
| `MARKETING_CONSENT_SOURCES` | `src/lib/consent.ts` | |

**Уверенность: похоже на мёртвое, сомнение общее.** Это сервисный слой:
часть таких функций — осознанный API модуля «на вырост», часть
покрыта тестами (проверено отдельно — перечисленные здесь тестами **не**
покрыты). Отдельно отмечу: ещё ~150 экспортов «не используются вне
своего файла», но это просто лишнее слово `export` у внутренних
констант — списком не привожу, шума больше пользы.

## Б-8. `design/blender/atlas_globe2_blocks.blend` — 38,5 МБ

По условию задачи исходники Blender мёртвыми не считаются. Одну строку
всё же вынесу, потому что это самый тяжёлый файл репозитория:
`design/blender/README.md` описывает его как «Глобус раздела 03
(прежняя видеоверсия; сейчас на сайте глобус реального времени
`GlobeGL.tsx`)» → `public/media/globe2.jpg`. И `GlobeGL.tsx`, и
`globe2.jpg` из проекта удалены, а глобус заменён векторной схемой
(«глобус — говно, сделай адекватным или другое», 14.09.2026). То есть
это исходник сцены, которой на сайте нет ни в каком виде.
**Решать вам — я только показываю, что рендерить из него больше
некуда.**

Рядом: `design/blender/atlas_laptop.blend1` — 38,5 МБ резервной копии
Blender. Она уже под `.gitignore` (`*.blend1`), в репозиторий не
попадает, но лежит на диске.

## Б-9. Черновики среди документации

`MEGA_PROMPT_agency_redesign_2026-2027.md` (23 КБ) — в корне, не
отслеживается гитом, ни на что не ссылается и ни из чего не
ссылается. Похоже на заготовку промпта, а не на документ проекта.

В `research/` две несмежные серии: `01.md`…`07.md` (31 августа) и
`02_AGENCIES.md`, `03_AGENCY_TEARDOWN.md`, `04_COLOR_2027.md`,
`05_MOTION.md` (8 сентября). На вторую серию ссылается CLAUDE.md, на
первую — ничто. Учтите при чтении этого отчёта: он лёг рядом как
`07_DEAD_CODE.md`, и старый `07.md` — другой документ.

`src/app/lab/NOTES.md` помечен «локально, не коммитить» и
действительно не в гите — всё в порядке.

---

# В. Оптимизация

## В-1. Оба словаря (237 КБ) уезжают в браузер на 12 маршрутах

Самая дорогая находка и самая дешёвая правка.

`src/i18n/index.ts` статически импортирует **оба** словаря:

```ts
import { ru } from "./ru";   // 177 901 Б
import { en } from "./en";   // 113 633 Б
…
export function fill(template, vars) { … }   // 3 строки
```

И пятнадцать клиентских компонентов берут отсюда `fill`:

```bash
for f in $(grep -rl '"use client"' src --include="*.tsx"); do
  grep -l 'import { fill } from "@/i18n"\|import { fill,' $f
done
# auth-page.tsx, AddDeviceView.tsx, ContactView.tsx, BusinessRequestForm.tsx,
# UnsubscribeView.tsx, ApplyForm.tsx, CabinetFriends.tsx, DashboardView.tsx,
# CabinetKey.tsx, SubscribeView.tsx, CabinetPayments.tsx, InstallHappView.tsx,
# HappPhone.tsx, DevicesView.tsx, PlanCards.tsx
```

Импорт типа (`import type { Dict }`) стирается при компиляции и вреда
не делает — вредит именно значение `fill`, которое тянет за собой весь
модуль вместе с обоими словарями.

Измерено на сборке от 21.09.2026 15:22, а не выведено рассуждением:

```bash
grep -l "Соглашение составлено на русском языке" .next/static/chunks/*.js
# .next/static/chunks/1efr_6ipsbjr_.js        (237 КБ)
grep -c "Video, websites and games open right away" .next/static/chunks/1efr_6ipsbjr_.js
# 1   — английский словарь в том же чанке
```

Первая загрузка по маршрутам (`.next/diagnostics/route-bundle-stats.json`):

| маршрут | первая загрузка JS | словарь в ней |
|---|---|---|
| `/dashboard` | 823 КБ | да, +237 КБ |
| `/devices` | 763 КБ | да |
| `/add-device` | 761 КБ | да |
| `/auth` | 758 КБ | да |
| `/careers`, `/subscribe` | 753 КБ | да |
| `/install-happ` | 746 КБ | да |
| `/business`, `/contact` | 743 КБ | да |
| `/` | 741 КБ | да |
| `/pricing` | 740 КБ | да |
| `/unsubscribe` | 726 КБ | да |
| `/about`, `/terms`, `/privacy`, `/security`, `/support`, `/vds`, `/_not-found` | 487 КБ | **нет** |
| `/install-ios` | 498 КБ | нет |
| `/infrastructure` | 499 КБ | нет |
| `/admin` | 684 КБ | нет |

Разрыв 487 против 741 КБ на главной — это он и есть.

**Что сделать:** вынести `fill` (и, если нужно, `count`) в отдельный
модуль без импорта словарей — например `src/i18n/fill.ts` — и
переключить на него пятнадцать клиентских файлов. Правка на полчаса,
выигрыш **≈237 КБ несжатого JS на двенадцати маршрутах**, включая
главную и кабинет. Заодно это возвращает в силу правило CLAUDE.md,
которое сейчас нарушено.

`/install-ios` — доказательство, что схема работает: он импортирует
только `type Dict` и словаря не несёт.

## В-2. `work-atlas.css` — 55 КБ ради одной страницы, 40% из них мертвы

Файл подключает только `AdminView.tsx`, но в нём 1 080 строк, из
которых ~472 (88 классов из 139) — кабинет и вход, переехавшие в
`cabinet-vps.css` и `auth-v.css`. После чистки по части А-7 файл
станет честной таблицей стилей админки.

Туда же: `atlas.css` (1 036 строк, 44 КБ) и `atlas-mobile.css` (268
строк, 11,8 КБ) теперь обслуживают **один** маршрут — `/admin`. Это не
ошибка (CSS привязан к маршруту, на витрину не попадает), но
576 строк корпуса ради админки — повод спросить, не проще ли
перевести `/admin` на `VShell`, как остальные рабочие экраны, и
закрыть корпус «Атлас» целиком (см. Б-1).

## В-3. Кадры ноутбука — 2 040 КБ в `public/`, 121 файл

`public/media/laptop/f000…f119.webp` + `poster.jpg` выкладываются на
боевой сервер, хотя единственный их потребитель (`LaptopScrub.tsx`)
достижим только из песочницы (Б-1, Б-4). В `next.config.ts` им уже
проставлен `Cache-Control: max-age=604800` — то есть место они занимают
на диске и в образе, а не в трафике посетителя. При решении по Б-1 это
самая заметная разовая экономия после PNG в корне.

## В-4. Крупные картинки без `srcSet`

| файл | КБ | где | `srcSet` |
|---|---|---|---|
| `public/media/clay/hero-1400.webp` | 90 | первый экран главной | **есть** (900/1400) — образцово |
| `public/media/ios/dash.webp` | 47 | `/install-ios`, два `<img>` | нет |
| `public/media/ios/shell.webp` | 34 | `/install-ios` и `/install-happ` | нет |
| `public/media/mission-soft-*.webp` | 426 | lab | есть (700/1000/1400) |

Две картинки iOS отдаются одним размером на все экраны, но 47 и 34 КБ —
не тот вес, ради которого стоит заводить три варианта. Отмечаю для
полноты; чинить нечего.

## В-5. Дубли

**Определение iOS написано дважды.** `IosInstallSheet.tsx` экспортирует
`isIosBrowser()`, а `IosInstallBanner.tsx` (строки 29–36) содержит тот
же код вставкой:

```bash
diff src/components/IosInstallBanner.tsx src/components/IosInstallSheet.tsx
# в Banner:  const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
# в Sheet:   export function isIosBrowser() { …тот же код… }
```

Оба файла ровно по 160 строк, общих строк — 50. Компоненты разные
(баннер витрины и лист кабинета), объединять их не надо, а вот
проверку платформы стоит взять из одного места: иначе следующее
устройство Apple придётся учить дважды. `isIosNonSafari` из
`IosInstallSheet.tsx` при этом не используется никем, кроме своего
файла.

**Два макета телефона.** `install-ios/IosPhone.tsx` (334 строки) +
`ios-phone.css` (663) и `install-happ/HappPhone.tsx` (342) +
`happ-phone.css` (817) — один и тот же приём (корпус из Blender
`shell.webp`, живой экран на HTML/CSS, петли по шагам, префиксы
`iosp-` и `happ-`). Замер после нормализации префиксов: различаются
1 122 строки из 1 480, то есть совпадает примерно четверть. **Это не
копипаста — сцены разные.** Общее у них — геометрия корпуса
(`--u = 100cqw / 440`, вырез экрана, кнопки) — и её стоило бы вынести в
один слой, не трогая сцены. Выигрыш небольшой, риск средний: отдельным
делом, не в рамках чистки.

**Ложных дублей не нашлось** там, где их можно было ждать: лестница
кешбэка объявлена один раз (`src/lib/loyalty.ts`, `store.ts` считает по
ней), цены — только `plans.ts`, страны — только `locations.ts`,
`src/app/fonts.ts` и `atlas-fonts.ts` разные по назначению и это
разъяснено в шапках.

## В-6. Локальный мусор вне гита

Не код, но занимает диск и попадается в поиске:
`shots/` 15 МБ, `qa-ed/` 9,3 МБ, `.playwright-mcp/` 4,6 МБ,
`design/blender/atlas_laptop.blend1` 38,5 МБ, `tsconfig.tsbuildinfo`
343 КБ, `.next/cache 2`, `cache 3`, `cache 4`, `dev 2`, `dev 3`,
`trace 2…4` (следы копирования каталога). Всё под `.gitignore` —
трогать не обязательно, но ~70 МБ.

---

# Сводка

**А — можно удалять:** 6 находок.
~1 156 строк кода и стилей (44 159 Б ≈ 43 КБ) плюс 5 374 КБ
отладочных PNG = **≈ 5 417 КБ ≈ 5,29 МБ**.

**Б — требует решения:** 9 находок. Если решить их в пользу удаления,
освободится ещё ~5 200 строк кода и CSS, ~2 635 КБ картинок,
26,5 МБ зависимостей (`three`, `@types/three`, `lenis`) и 38,5 МБ
исходника Blender. Ни одну из них я бы не тронул без вашего слова:
шесть из девяти прямо упомянуты в CLAUDE.md, в комментариях рядом с
кодом или в списке открытых вопросов.

**В — оптимизация:** 6 находок. Главная — В-1: одна правка на полчаса
снимает **237 КБ несжатого JS с двенадцати маршрутов**, включая главную
и кабинет, и возвращает в силу уже записанное правило о словарях.
