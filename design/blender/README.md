# Сцены Blender

Исходники 3D-рендеров сайта (Blender 5.2). Готовые кадры лежат в `public/media/`.

| Файл | Что внутри | Куда рендерится |
|---|---|---|
| `atlas_iphone.blend` | Сцена «AtlasIphone»: iPhone 17 Pro Max (корень `IP_A`, корпус Deep Blue) | `public/media/ios/shell.webp` — корпус без экрана, см. ниже |
| `atlas_laptop.blend` | Ноутбук раздела 06 главной, крышка открывается за 60 кадров | `public/media/laptop/f00–f59.webp`, `poster.jpg` |
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
страница публичная, «VPN» и «Обход» на ней не показываются. PNG → WebP
(качество ~84, ≤ 120 КБ) — `public/media/ios/dash.webp`.
