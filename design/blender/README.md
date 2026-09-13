# Сцены Blender

Исходники 3D-рендеров сайта (Blender 5.2). Готовые кадры лежат в `public/media/`.

| Файл | Что внутри | Куда рендерится |
|---|---|---|
| `atlas_iphone.blend` | Сцена «AtlasIphone»: iPhone 17 Pro Max (корень `IP_A`, корпус Deep Blue) | `public/media/ios/shell.webp` — корпус без экрана, см. ниже |
| `atlas_laptop.blend` | Сцена «AtlasLaptop»: MacBook Pro 14" (Silver) раздела 06 главной, крышка открывается за 120 кадров; модель строит `laptop_build.py` | `public/media/laptop/f000–f119.webp`, `poster.jpg` — см. ниже |
| `atlas_globe2_blocks.blend` | Глобус раздела 03 (прежняя видеоверсия; сейчас на сайте глобус реального времени `GlobeGL.tsx`) | `public/media/globe2.jpg` — постер-заглушка |

## iPhone для /install-ios

Страница `/install-ios` показывает телефон так: **корпус — рендер, экран — живой
HTML/CSS** (`src/app/install-ios/IosPhone.tsx`, `ios-phone.css`). Анимация
шагов идёт на CSS, видео и WebGL нет.

Размеры сверены с Apple (support.apple.com/en-us/125091): корпус
163,4 × 78,0 × 8,75 мм; дисплей 6,9" — 2868 × 1320 px при 460 ppi, то есть
активная область 158,37 × 72,89 мм (440 × 956 pt, @3x); алюминиевый
unibody; слева кнопка действия и громкость, справа боковая кнопка и
Camera Control; цвета — Cosmic Orange, Deep Blue, Silver.

### 1. Корпус

Открыть `atlas_iphone.blend`, в Scripting выполнить `iphone_shell.py`. Скрипт:
доводит модель до размеров Apple, поднимает Dynamic Island на ~11 pt от края
экрана, гасит экран, ставит фронтальную ортокамеру `IP_ShellCam` (кадр 80 × 166 мм)
и рендерит 960 × 1992 px, 16 бит, прозрачный фон в `//iphone-screens/shell.png`.

Затем вырезать экран и закодировать (нужны Pillow и numpy):

```bash
python design/blender/iphone_shell_post.py design/blender/iphone-screens/shell.png public/media/ios/shell.webp
```

Скрипт печатает прямоугольник экрана в процентах картинки. Если модель или кадр
менялись — перенести числа в шапку `src/app/install-ios/ios-phone.css`
(`.ios-scr`: left/top/width/height и радиус). Сейчас: x 4,4437 %, y 2,2982 %,
w 91,1125 %, h 95,4036 %, радиус 13,2391 % / 6,0933 %.

### 2. Снимок кабинета на экране

`public/media/ios/dash.webp` — кабинет на ширине iPhone 17 Pro Max (440 × 894
CSS px — экран минус верхний отступ 62 pt, @2x). Снимает `iphone-screens/dash.cjs`
с подменой API (подписка, обход, passkey, согласие), на запущенном сайте:

```bash
node design/blender/iphone-screens/dash.cjs <путь к playwright> design/blender/iphone-screens/dash-440.png http://localhost:3000
```

Скрипт заменяет в снимке слова кабинета на гостевые (`src/lib/key-names.ts`):
страница публичная, «VPN» и «обход» (в любом виде) на ней не показываются.
**Ключ не светится:** поле ключа заменяется точками `••••••••••••` (без домена
и пути), QR-код и блок ручного копирования удаляются из DOM, в подмене API —
заглушка `example.invalid`; скрипт падает, если на странице осталась ссылка, QR
или запретное слово. PNG → WebP (качество ~88, ≤ 70 КБ) —
`public/media/ios/dash.webp`.

## MacBook Pro для раздела 06 главной

Ноутбук на главной — 120 кадров открытия крышки (равный шаг, владелец
13.09.2026: «120 фпс анимации нужны»), их перелистывает прокрутка
(`src/components/atlas/LaptopScrub.tsx`, стили `.h5-laptop` в `home-v5.css`).

Форма сверена с Apple, MacBook Pro 14" (M4 2024 / M5 2025;
support.apple.com/en-us/121552, support.apple.com/en-us/125405,
apple.com/macbook-pro/specs): корпус 31,26 × 22,12 × 1,55 см; дисплей 14,2"
Liquid Retina XDR 3024 × 1964 px при 254 ppi — активная область
302,4 × 196,4 мм, скруглённые верхние углы, вырез с камерой по центру
(188 × 32 pt); узкие чёрные рамки и чёрная полоса у шарнира; 12
полноразмерных функциональных клавиш и Touch ID; чёрные клавиши с узким
зазором в чёрной нише; решётки динамиков по обе стороны клавиатуры; большой
трекпад Force Touch вровень с корпусом; слева MagSafe 3, два Thunderbolt и
разъём наушников, справа HDMI, Thunderbolt и SDXC; цвет — Silver (Space Black
на этом свете читается серым). **Ни логотипа, ни надписей на модели нет**
(товарные знаки) — только форма и материалы.

### 1. Экран — снимок кабинета

`laptop-screen/screen-1512.png` — 3024 × 1964 px (1512 × 982 CSS px @2x):
строка меню 32 pt (высота выреза), панель браузера с адресом `qodev.dev` и
живой `/dashboard` под ними. Снимает `laptop-screen/dash.cjs` на запущенной
production-сборке с подменой API; маскировка ключа, гостевые названия ключей и
проверка — те же, что у iPhone (см. выше):

```bash
node design/blender/laptop-screen/dash.cjs <путь к playwright> design/blender/laptop-screen/screen-1512.png http://localhost:3000
```

### 2. Модель

Открыть `atlas_laptop.blend`, в Scripting выполнить `laptop_build.py`. Скрипт
пересобирает только модель (корень `LT_Root`) в сцене «AtlasLaptop»: свет,
карточка отражения, пол-ловец тени, мир, камера `LT_Cam` и настройки рендера
остаются; снова ставит ключи анимации на `N_FRAMES` = 120 кадров (крышка
0 → 115°, поворот −4°, экран загорается в последней трети) и диапазон сцены
1…120. Экран берёт `//laptop-screen/screen-1512.png`. Перед запуском можно
задать `FINISH = "black"` (Space Black) или другое `N_FRAMES` — тогда поменять
`N` в `LaptopScrub.tsx`.

### 3. Кадры

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b design/blender/atlas_laptop.blend -S AtlasLaptop -a
```

Cycles, 256 сэмплов, 1400 × 900, прозрачный фон, 16-бит PNG → путь из
настроек рендера (`f0001…f0120.png`, ~7 с на кадр на M5 Max). Затем:

```bash
python design/blender/laptop_post.py <папка с f0001…f0120.png> public/media/laptop
```

PNG кладутся на белое (края кадра растворяются в белом), кодируются в WebP
одним качеством на всю серию (кадр ≤ 40 КБ, вся серия ≤ 1,73 МБ) →
`public/media/laptop/f000…f119.webp`, последний кадр — `poster.jpg`
(JPEG 88). Кадры непрозрачные: так их ждут `LaptopScrub` и `home-v5.css`.
