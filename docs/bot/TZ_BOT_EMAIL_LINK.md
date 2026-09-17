# ТЗ для бота: связка с сайтом — одна подписка, один ключ

**17.09.2026 · первая версия для команды бота.** Привязана к коду бота
**ATCbot `main` @ `4b00e79a`** (GitHub `novikovLDN/ATCbot`, 16.09.2026) и
сайта **Atlas Secure @ `8e1905a`** (https://qodev.dev). Все ссылки вида
`файл:строка` — на эти версии бота.

Документ самодостаточен: всё, что бот должен знать о сайте, — здесь.
Модель сущностей панели — `docs/bot/PANEL_USER_MODEL.md`. Справочник
остальных вызовов — `SYNC_TZ.md`; при расхождении главнее этот документ.

### Исходное состояние

- **Бот с сайтом сейчас не связан никак.** Ни одного вызова API сайта, ни
  колонки `site_linked`, ни ключа `SITE_BOT_API_KEY` в окружении. Прежний
  черновик `site_sync` (старый контракт, выключен заглушкой) удалён коммитом
  `c5f2b1e7` и основой не служит. Всё ниже строится с нуля.
- **Сайт свою часть сделал** (раздел 3) и ждёт бота: эндпоинты `/api/bot/*`,
  привязка почты кодом, одноразовая ссылка из кабинета, слияние ключей,
  журнал сроков, пакеты трафика, двухфазный обмен кешбэком.
- **Опора в коде бота:** вся выдача премиума уже идёт через одну очередь
  `provisioning_jobs` (`app/services/provisioning.py`). Поэтому связанный
  человек — одна развилка в `provisioning.apply()` плюс защиты в местах,
  которые трогают панель напрямую (разделы 5–6).
- Расхождения бота и сайта, которые решает владелец, — раздел 13; до его
  решений в ТЗ заложены предложения по умолчанию.

### Вне этого ТЗ

- `/start tglogin_<nonce>` и `POST /api/bot/auth-login` (вход на сайт через
  Telegram): на сайте кнопки нет, в боте не делать. Перед запуском контракт
  будет изменён — подтверждение только после ввода в боте кода с экрана
  сайта.
- `POST /api/bot/register`, `GET /api/bot/user`, `GET /api/bot/user-by-telegram`
  — не вызывать: аккаунт сайта появляется только при связке.
- `POST /api/bot/sync-referrals` — необязателен (раздел 9.3).

---

## 1. Цель и принципы

Цель владельца: **«Один человек — одна подписка — один ключ, в боте и на
сайте; всё единое целое, без лишних проблем с ключами.»**

1. **Один ключ.** У связанного человека премиум — ОДНА сущность панели
   Remnawave. Её `subscriptionUrl` показывают и бот, и сайт. Бот не заводит
   для связанного отдельный `tg_{id}_premium`.
2. **Срок общей подписки ведёт сайт.** Любое изменение срока у связанного
   человека бот проводит через API сайта: продление — `POST /api/bot/extend`,
   отзыв — `POST /api/bot/sync` с `plan: "none"`. Бот не делает PATCH/DELETE
   общей сущности в панели никогда.
3. **Почта — только через код из письма**, которое отправляет сайт. Бот
   почту в панель и в свою БД до успешной связки не пишет.
4. **Слияние при связке делает сайт.** Есть подписка и в боте, и на сайте —
   остаётся сущность с большим сроком, вторая `DISABLED` (срок не трогается,
   дни не складываются).
5. **Бонус +7 дней за связку** — один раз на аккаунт сайта и один раз на
   Telegram ID. Начисляет сайт.
6. **Обход (bypass) — продукт бота**, сущность `{telegram_id}` ведёт бот;
   сайт прибавляет в неё купленные на сайте ГБ (раздел 8).
7. **Баланс — в боте.** Сайт только показывает его и копит кешбэк за оплаты
   на сайте, бот забирает кешбэк двухфазно (раздел 9).
8. **Бот — локальное зеркало.** Строка `subscriptions` связанного человека в
   БД бота хранит копию срока и тарифа с сайта (для напоминаний, экранов,
   автопродления), но источником правды не является (раздел 7).

---

## 2. Состояние бота на 4b00e79a (что есть и чего нет)

| Что | Где | Значение для связки |
|---|---|---|
| Клиента к API сайта, `site_linked`, воркера | — (удалено `c5f2b1e7`) | строится заново |
| Очередь выдачи `provisioning_jobs` | `migrations/082_provisioning_jobs.sql`, `app/services/provisioning.py:116` `enqueue`, `:266` `apply` | точка развилки для связанных |
| Ключи идемпотентности задач | `purchase:{purchase_id}` (`database/subscriptions.py:4416`), `balance:{payment_id}` (`database/admin.py:3099`), `autorenew:{payment_id}` (`auto_renewal.py:223`), `gift:{code}` (`database/admin.py:4316`), `game:{tg}:bowling|dice:{iso}` (`app/handlers/game.py:281,443`), `trial:{tg}` | передаются сайту как `paymentId` |
| Воркер очереди | `app/workers/provisioning_worker.py`, старт `main.py:169` | обслуживает и вызовы сайта |
| Список воркеров | `main.py:118` `start_db_services` → `_start(name, factory)` | сюда — воркер статуса |
| Ретраи | `app/utils/retry.py:51` `retry_async` | параметры по таблице 3.10 |
| `/start` префиксы | `app/handlers/user/start.py`: `bgift_` :115, `gift_` :246, `s-` :336, `p-` :349, `refd_` :365, `ref_` :382 | `link_` не пересекается |
| Профиль | `app/handlers/common/keyboards.py:262` `get_profile_keyboard` | кнопка «Привязать почту» |
| FSM | `app/handlers/common/states.py`; хранилище Redis (`main.py:262`) без TTL | таймауты состояний — вручную |
| Выдача ключей | `app/services/user_subscription_links.py:112` `get_user_premium_url`, `:409` `get_user_bypass_url`, `:563` `get_user_primary_subscription_url` | ветка «связан» |
| Агрегатор (одна ссылка из двух) | `app/services/sub_aggregator.py:44` `is_enabled_for`, `:116` `ensure_pair` | для связанных выключить |
| Миграции | последняя `095_money_read_indexes.sql` | новая — `096_site_link.sql` |
| Лимит устройств премиума | `config.py:299` `PREMIUM_DEVICE_LIMITS` basic 10 / plus 14 | см. раздел 13 |
| Пакеты трафика | `config.py:323,332` | см. раздел 13 |

---

## 3. Эндпоинты сайта

База: `https://qodev.dev`. Все запросы — JSON, заголовок
`X-Bot-Api-Key: <BOT_API_KEY сайта>` (сравнение timing-safe). Неверный
ключ → `401 {success:false, error:"Unauthorized"}`.

Успех `{ "success": true, "data": {…} }`, ошибка
`{ "success": false, "error": "текст", "code": "КОД", …доп. поля }`.
Бот ветвится по HTTP-статусу и `code`, `error` — только в лог.

Админ сайта может выключить синхронизацию — изменяющие вызовы отвечают
`503 {code: "bot_sync_disabled"}`: повторять позже, человеку не показывать
как окончательную ошибку.

### 3.1. `POST /api/bot/email/start`

```json
{ "telegramId": "738398394", "email": "alice@mail.ru" }
```

| Ответ | Когда |
|---|---|
| `200 {sent: true, expiresInSeconds: 600}` | код отправлен (ответ нейтральный: есть ли аккаунт с этой почтой, сайт не сообщает) |
| `200 {sent: false, alreadyLinked: true}` | этот Telegram уже связан с этой почтой |
| `400 VALIDATION` | telegramId не цифры / почта некорректна / служебный адрес `telegram_…@tg.…` |
| `400 DISPOSABLE_EMAIL` | одноразовая почта |
| `409 TELEGRAM_LINKED_OTHER` | Telegram связан с другим аккаунтом сайта |
| `429 RATE_LIMITED` + `retryAfterSeconds`, заголовок `Retry-After` | лимиты |
| `502 EMAIL_SEND_FAILED` | письмо не ушло |

Лимиты: на Telegram ID и на почту — 3 кода за 10 минут и 10 за сутки; на IP
бота — 120 запросов в минуту. Новый `start` заменяет прежний код. Код — 6
цифр, 10 минут, 5 попыток. Тема письма — «Код для привязки Telegram к Atlas Secure».

### 3.2. `POST /api/bot/email/confirm`

```json
{ "telegramId": "738398394", "email": "alice@mail.ru", "code": "123456", "premiumPanelUserId": 4211 }
```

`premiumPanelUserId` — `subscriptions.remnawave_premium_id` бота, если есть
(необязательно: сайт найдёт `tg_{id}_premium` сам).

`200`:
```json
{
  "success": true,
  "data": {
    "linked": true, "alreadyLinked": false, "accountCreated": false,
    "userId": "2b1c…", "email": "alice@mail.ru", "telegramId": "738398394",
    "panelUserId": 4211,
    "subscriptionUrl": "https://sub.atlassecure.ru/AbCd…",
    "subscriptionEnd": "2026-10-20T12:00:00.000Z",
    "plan": "plus", "daysLeft": 37, "isExpired": false,
    "kept": "bot", "keptPanelUserId": 4211,
    "disabledPanelUserId": 1880, "disabledPanelUserIds": [1880],
    "bonusDays": 7, "telegramBonus": { "granted": true, "days": 7 },
    "panelSynced": true,
    "bypassPanelUserId": 4210,
    "subscriptionPlan": "plus", "vpnKey": "https://sub.atlassecure.ru/AbCd…",
    "hasActiveSubscription": true, "hoursLeft": 5, "xrayUuid": null,
    "referralCode": "SITE1234"
  }
}
```

- `kept`: `bot` | `site` | `only-bot` | `only-site` | `none` (раздел 4.3).
- `disabledPanelUserId(s)` — отключённые сайтом сущности (или `null`/`[]`).
- `panelSynced: false` — связка в БД сайта завершена, панель была недоступна;
  сайт досинхронизирует сам (до ~1 ч). Боту ничего делать не надо.
- `bypassPanelUserId` — сущность обхода аккаунта после связки или `null`.
- `subscriptionUrl = null`, если подписка истекла.

| Ошибка | Когда | Код остаётся годным? |
|---|---|---|
| `400 VALIDATION` | формат полей | да |
| `400 CODE_NOT_FOUND` | кода нет или он для другой почты | — |
| `400 CODE_EXPIRED` | прошло 10 минут | нет |
| `400 CODE_INVALID` + `attemptsLeft` | неверный код | да, пока `attemptsLeft > 0` |
| `400 CODE_ATTEMPTS_EXCEEDED` | 5 неверных попыток | нет |
| `409 TELEGRAM_LINKED_OTHER` | Telegram связан с другим аккаунтом | да |
| `409 EMAIL_LINKED_OTHER` | аккаунт с этой почтой связан с другим Telegram | да |
| `429 RATE_LIMITED` | много попыток с IP | да |
| `503 PANEL_UNAVAILABLE` / `503 BUSY` | панель не отвечает / параллельный запрос | **да — повторить тот же запрос** |

Повтор связки той же пары любым путём → `200 alreadyLinked: true`,
`bonusDays: 0`, без повторного слияния.

### 3.3. `GET /api/bot/link?token=…` — предпросмотр

`200 {valid: true, kind: "one_time"|"legacy", maskedEmail, expiresAt, telegramLinked}`
(`expiresAt = null` у legacy); `404 TOKEN_INVALID`, `410 TOKEN_EXPIRED`,
`410 TOKEN_USED`. Токен не тратит. Принимает `link_<token>`, `<token>` и
старый 16-hex.

### 3.4. `POST /api/bot/link`

```json
{ "token": "link_Qw3…", "telegramId": "738398394", "premiumPanelUserId": 4211 }
```

Ответ `200` — как 3.2. Ошибки: `400 VALIDATION`, `404 TOKEN_INVALID`,
`410 TOKEN_EXPIRED`, `410 TOKEN_USED`, `409 TELEGRAM_LINKED_OTHER | EMAIL_LINKED_OTHER`,
`503 PANEL_UNAVAILABLE | BUSY`. Токен тратится только успешной связкой;
повтор тем же Telegram ID → `200 alreadyLinked: true`.

### 3.5. `GET /api/bot/status?telegram_id=…`

`404 {code: "NOT_LINKED", data: {linked: false}}` — не связан.
`200` — связан:
```json
{
  "success": true,
  "data": {
    "linked": true, "telegramLinked": true,
    "userId": "2b1c…", "email": "alice@mail.ru", "telegramId": "738398394",
    "panelUserId": 4211, "linkKept": "bot",
    "subscriptionUrl": "https://sub.atlassecure.ru/AbCd…", "vpnKey": "…", "xrayUuid": null,
    "subscriptionEnd": "2026-10-20T12:00:00.000Z",
    "plan": "plus", "subscriptionPlan": "plus",
    "daysLeft": 37, "hoursLeft": 5, "minutesLeft": 12,
    "isExpired": false, "hasActiveSubscription": true,
    "bypass": {
      "panelUserId": 4210, "subscriptionUrl": "https://sub.atlassecure.ru/Bp…",
      "limitBytes": 10737418240, "usedBytes": 3221225472, "remainingBytes": 7516192768,
      "unlimited": false, "status": "ACTIVE"
    },
    "bypassOrigin": "bot", "bypassTrialGranted": false, "bypassOwedBytes": 0,
    "referralCode": "SITE1234", "referrals": 15, "paidReferrals": 5,
    "balance": 102990, "balanceRubles": 1029.9,
    "cashbackPercent": 10, "loyaltyTier": "Стартовый"
  }
}
```

`bypass = null`, если сущности обхода нет или панель не ответила за ~2,5 с —
тогда бот читает обход из панели сам по `bypassOrigin`/своему кешу.
`bypassOrigin`: `"bot"` — ботовская `{telegram_id}`, `"site"` — сайтовая
`ST…_bp`. `bypassTrialGranted` — сайт уже выдал пробные 500 МБ.
`bypassOwedBytes` — оплачено на сайте, ещё не в панели (сайт прибавит сам).

### 3.6. `POST /api/bot/unlink`

`{telegramId}` → `200 {unlinked: true, userId, email, panelUserId, keyStaysWithAccount: true}`;
`404 NOT_LINKED`. Подписка и ключ остаются у аккаунта сайта; сущность в
панели теряет `telegramId` и получает маркер `atlas-unlinked:<время>`.

### 3.6a. `POST /api/bot/relink`

`{telegramId, premiumPanelUserId?}` — только для УЖЕ связанного Telegram:
повторяет слияние ключей (раздел 12). Идемпотентен. `200` — как 3.2;
`404 NOT_LINKED`; `503 PANEL_UNAVAILABLE | BUSY` — повторить.

### 3.7. `POST /api/bot/extend` — единственный способ продлить связанного

```json
{ "telegramId": "738398394", "days": 30, "plan": "plus", "paymentId": "purchase:6f1c…" }
```

| Поле | Правило для бота |
|---|---|
| `telegramId` | строка из цифр |
| `days` | число `0 < days ≤ 400`, дробное допустимо (минутные выдачи: `minutes / 1440`) |
| `plan` | `"basic"` \| `"plus"`; для подарков, игры и админских дней без смены тарифа — не передавать |
| `paymentId` | **всегда**: `idempotency_key` задачи `provisioning_jobs` без изменений |
| `amount` | **не передавать.** Кешбэк за оплаты в боте платит бот (`process_referral_reward`); с `amount` сайт начислил бы кешбэк второй раз (раздел 9) |

Сайт продлевает от `max(сейчас, конец)` через журнал, сразу переносит срок в
общую сущность панели.

`200`: `{userId, email, daysLeft, subscriptionEnd, subscriptionPlan, subscriptionUrl, vpnKey, duplicate, referralReward}`.
Повтор с тем же `paymentId` → `200 duplicate: true`, ничего не применяется.
`400 days_out_of_range`; `404` — Telegram не связан (разметить у себя
`site_linked = false` и выполнить задачу как для несвязанного, раздел 5.2).

### 3.8. `POST /api/bot/sync` — только отзыв и смена тарифа

```json
{ "telegramId": "738398394", "action": "overwrite_site", "subscriptionEnd": "2026-10-20T12:00:00.000Z", "plan": "basic" }
```

- **Отзыв:** `plan: "none"` (дата любая) — подписка сайта заканчивается сейчас,
  общий ключ `DISABLED`.
- **Смена тарифа без смены срока:** `subscriptionEnd` = текущий
  `status.subscriptionEnd`, `plan` = новый.
- Дата раньше текущего срока сайта → **`409 WOULD_SHORTEN`**,
  `data.subscriptionEnd` — текущий срок. Срок не меняется. Для продлений этот
  вызов не использовать — только `extend`.
- `400 sub_end_too_far` — дата дальше 400 дней.

### 3.9. `POST /api/bot/sync-balance` — двухфазный режим

Фаза 1: `{ "telegramId": "…", "balance": 100000, "twoPhase": true }` —
`balance` в копейках (баланс бота). Ответ: `{balance, previousBalance,
pendingCashback: [{id, amount, amountRubles, description, relatedUserId, createdAt}],
pendingCashbackTotal, twoPhase: true}`. Записи **не** помечаются отданными:
повтор вернёт те же.

Фаза 2: `{ "telegramId": "…", "ack": ["tx-id-1", "tx-id-2"] }` →
`200 {acked: [...], ackedCount}` — помечает отданными ровно эти записи.

Без `twoPhase` — прежний режим (записи забираются сразу); боту не использовать.

### 3.10. Таймауты и ретраи

| Вызов | Таймаут HTTP | Ретраи |
|---|---|---|
| `email/start` | 15 с | нет (иначе второе письмо); сетевая ошибка → «попробуйте ещё раз» |
| `email/confirm`, `POST link`, `relink` | 30 с | на таймаут/5xx/503 — до 3 раз, паузы 2, 5, 10 с, тем же телом |
| `status`, `GET link` | 10 с | до 2 раз |
| `extend`, `sync` | 30 с | внутри задачи очереди: ошибка → `ProvisioningTransient`, повторы по backoff очереди (`provisioning.py:108`) |
| `unlink` | 15 с | до 3 раз (повтор после успеха → `404 NOT_LINKED` = успех) |
| `sync-balance` | 15 с | фаза 1 и фаза 2 — до 3 раз; ack можно повторять |

`429` — ждать `retryAfterSeconds`. `401` — алерт администратору, человеку
«Сервис временно недоступен».

---

## 4. Сценарии связки в боте

### 4.1. Бот первым: «📧 Привязать почту»

1. Кнопка в профиле (`keyboards.py:262`, `callback_data="site_link:start"`) или команда `/email`.
2. `GET status`: `200 linked` → экран 4.4; `404` → дальше.
3. Состояние `SiteLinkState.waiting_email` (10 мин): «Введите почту…».
4. `POST email/start` → `sent: true` → `SiteLinkState.waiting_code` (10 мин);
   `alreadyLinked` → 4.4; `409 TELEGRAM_LINKED_OTHER` → текст + кнопка «Отвязать»;
   `400/429/502` → тексты раздела 11.
5. Ввод кода (`^\d{6}$`, пробелы убрать) → `POST email/confirm` с
   `premiumPanelUserId = subscriptions.remnawave_premium_id`.
6. `200` → «после связки» (4.5) → экран «Готово» (4.3).

Почту держать в данных FSM, в БД бота не писать до успешного confirm.

### 4.2. Сайт первым: `/start link_<token>`

1. Кабинет сайта открывает `https://t.me/atlassecure_bot?start=link_<token>`
   (одноразовый, 15 мин; имя бота на сайте — `atlassecure_bot`, совпадает с
   `config.BOT_USERNAME`).
2. В `cmd_start` **до** ветки `bgift_` (`start.py:115`) узкий разбор:
   ```python
   _LINK_RE = re.compile(r"^link_[A-Za-z0-9_-]{43}$")
   _LEGACY_LINK_RE = re.compile(r"^[0-9a-f]{16}$")
   ```
   Широкий «любой 10–64 символа» (как в удалённом `site_sync`) не
   использовать — он перехватывал `s-`/`p-`/`refd_`.
3. `GET link?token=` → `200 valid` → «Привязать аккаунт {maskedEmail} к этому
   Telegram? После привязки у бота и сайта будет одна подписка и один ключ.»
   [✅ Привязать] [Отмена], состояние `SiteLinkState.confirm_link` (15 мин);
   `404/410` → «Ссылка недействительна или устарела…».
4. «Привязать» → `POST link {token, telegramId, premiumPanelUserId}` → 4.5 → 4.3.
5. «Отмена» → «Хорошо, ничего не меняли.» Токен не тратится.

### 4.3. Экран «Готово» по `kept`

| `kept` | Сообщение |
|---|---|
| `bot` | «Готово! Бот и сайт теперь работают с одной подпиской. Ваш ключ из бота остаётся — ничего перенастраивать не нужно. Подписка до {дата}.» |
| `site` | «Готово! Общая подписка — та, что на сайте, до {дата}. ⚠️ Прежний ключ из бота отключён: обновите подписку в приложении по новой ссылке 👇» + ключ + кнопки приложений |
| `only-bot` | «Готово! Ваша подписка из бота теперь видна и на сайте, ключ тот же. До {дата}.» |
| `only-site` | «Готово! Подписка с сайта до {дата}. Вот ваш ключ 👇» + ключ |
| `none` | «Готово! Аккаунты связаны. Активной подписки пока нет — оформите её в боте или на сайте.» |

`bonusDays > 0` → «🎁 +{bonusDays} дней за привязку!».
`accountCreated` → «Мы создали аккаунт на сайте для {email}: войти можно по коду из письма.»

### 4.4. Уже связан

«Ваш Telegram связан с аккаунтом {email}. Подписка до {subscriptionEnd}.»
[🔑 Мой ключ] [Отвязать].

### 4.5. После успешной связки (confirm / link / relink) — запись в БД бота

Одной транзакцией, без HTTP внутри:

1. `users`: `site_linked = TRUE`, `site_user_id = data.userId`,
   `site_email = data.email`, `site_linked_at = NOW()`,
   `site_panel_user_id = data.panelUserId`, `site_sub_url = data.subscriptionUrl`,
   `site_link_kept = data.kept`, `site_status_checked_at = NOW()`.
2. Зеркало (раздел 7): `subscriptions.expires_at = data.subscriptionEnd`,
   `subscription_type = data.plan` (если `basic|plus`), `status = 'active'`,
   если не `isExpired`.
3. Если `kept = "site"` или `remnawave_premium_id ∈ disabledPanelUserIds` —
   ботовская премиум-сущность отключена сайтом: очистить кеш
   `remnawave_premium_uuid/_sub_url/_short_uuid/_id` в `subscriptions`
   (сущность не удалять и не включать).
4. После коммита: `sub_aggregator` — сбросить пару (`provisioning.py:373`
   `_invalidate_aggregator`), кеш статуса — положить ответ.

### 4.6. Смена почты и отвязка

Смена почты = отвязка + привязка новой (`email/start` с другой почтой у
связанного → `409 TELEGRAM_LINKED_OTHER`).

Отвязка: подтверждение «Отвязать Telegram от {email}? Подписка и ключ
останутся в аккаунте на сайте. Бонус за повторную привязку не начисляется.»
→ `POST unlink` → в БД бота одной транзакцией: `site_linked = FALSE`,
`site_panel_user_id = NULL`, `site_sub_url = NULL`, `site_unlinked_at = NOW()`;
строку `subscriptions` перевести в `status = 'expired'`, `expires_at = NOW()`
(ключ и срок остались у сайта — у бота подписки больше нет). Следующая
покупка в боте создаёт новую сущность (раздел 6.3, правило адопта).

---

## 5. Выдача дней премиума связанному

### 5.1. Все источники дней уже идут через одну очередь

| Источник | Где ставится задача | `paymentId` = ключ задачи |
|---|---|---|
| Карта / СБП / крипта (вебхук, ручная проверка) | `database/subscriptions.py:4416` в `finalize_purchase` | `purchase:{purchase_id}` |
| Telegram Stars / Payments | тот же `finalize_purchase` (`payments_messages.py:468` → сервисы) | `purchase:{purchase_id}` |
| Оплата с баланса бота | `database/admin.py:3099` в `finalize_balance_purchase` | `balance:{payment_id}` |
| Автопродление с баланса | `auto_renewal.py:223` `_autorenew_via_outbox` | `autorenew:{payment_id}` |
| Подарок (получатель активировал) | `database/admin.py:4316` | `gift:{code}` |
| Игра (боулинг, кубик) | `app/handlers/game.py:281,443` | `game:{tg}:…` |
| Пробный период | `app/services/trials/service.py` | `trial:{tg}` (связанному не выдаётся, 6.7) |
| 3 дня за покупку трафика без подписки | `trials/service.py:845` `grant_bypass_purchase_gift` | ключ задачи |
| Админ «выдать N дней / минут» | `database/admin.py:2383`, `:3354` | ключ задачи (`admin:…`) |

Бот продолжает ставить задачу как сейчас — в платёжной транзакции, без HTTP.

### 5.2. Развилка в `provisioning.apply()` (`provisioning.py:266`)

```python
async def apply(job):
    if job.get("premium_until") is not None and await site_link.is_linked(job["telegram_id"]):
        await _apply_premium_via_site(job)      # вместо _apply_premium
        premium = None                          # панель бот не трогает
    elif job.get("premium_until") is not None:
        premium = await _apply_premium(job)
    ...bypass-часть (раздел 8)...
```

`site_link.is_linked(tg)` — **только локальный флаг** `users.site_linked`
(без HTTP), чтобы не зависеть от доступности сайта.

`_apply_premium_via_site(job)`:

1. `days` = `context.premium_days`, если > 0; иначе (минутные выдачи)
   `context.premium_minutes / 1440`. Бот обязан класть `premium_minutes` в
   `context` задачи для минутных админских выдач.
2. `plan` = `context.premium_tier`, если источник меняет тариф (покупка,
   автопродление); для подарка, игры, админских дней — не передавать.
3. `POST /api/bot/extend {telegramId, days, plan?, paymentId: job.idempotency_key}`.
4. `200` (в том числе `duplicate: true`) → записать зеркало:
   `subscriptions.expires_at = subscriptionEnd`, `subscription_type`,
   `status='active'`, `users.site_sub_url = subscriptionUrl`; завершить
   `activation_status='pending'`, если есть (как `_complete_activation_if_pending`).
5. `404` → сайт не считает Telegram связанным: `users.site_linked = FALSE`,
   алерт админу, бросить `ProvisioningTransient` — следующий проход выполнит
   задачу обычным путём (флаг уже снят).
6. `503` / таймаут / 5xx → `ProvisioningTransient` (повтор по backoff очереди).
7. `400` → `ProvisioningPermanent` (dead + алерт).
8. `_verify_delivery` (`provisioning.py:701`) для связанного — не читать
   панель по `tg_{id}_premium`, а сверять `subscriptionEnd` из ответа
   `extend` с целью (или пропустить).

`run_now` (`provisioning.py:144`, таймаут по умолчанию 8 с) для связанного
вызывать с таймаутом **30 с**: сообщение об оплате строится после неё.

### 5.3. Сообщение человеку после оплаты

`_send_confirmation` (`confirmation.py:895`) и ветка Stars
(`payments_messages.py`) для связанного берут срок и ключ из зеркала,
записанного в 5.2.4. Если задача ещё не выполнена (сайт недоступен) —
«Оплата принята. Подписка продлится в течение нескольких минут.»

### 5.4. Устаревший путь без очереди

`purchase_flow.py:364` `sync_renewal_to_remnawave` / `:408` `_sync_renewal_once`
(инлайн-PATCH и **запасное создание сущности** при неудаче) — для связанного
не выполнять: в начале функции `if await site_link.is_linked(tg): return`
с записью в лог. Если флаг очереди (`provisioning_flags.is_on`) для
какого-то источника выключен, связанного всё равно проводить через очередь.

---

## 6. Места бота, которые не должны трогать общий ключ

| # | Место | Сейчас | Для связанного |
|---|---|---|---|
| 6.1 | `provisioning.py:411` `_apply_premium`, `:472` `_ensure_premium_expire` | создаёт/адоптит `tg_{id}_premium`, PATCH `expireAt` | не вызывается (развилка 5.2) |
| 6.2 | `purchase_flow.py:408` `_sync_renewal_once` | PATCH + запасное создание | выход в начале (5.4) |
| 6.3 | `remnawave_premium.py:129` `_is_our_entity` | решает по `telegramId`, маркер сайта не знает | **для всех**: `description` содержит `atlas-site:` → не наша (не адоптить); при создании для несвязанного взять `tg_{id}_premium_2`, `_3`, … |
| 6.4 | `database/admin.py:3565` `admin_revoke_access_atomic` → `:3524` `_disable_premium_after_revoke` | PATCH `DISABLED` по uuid или username | `POST /api/bot/sync {plan:"none"}`; при ошибке — не трогать панель, показать админу ошибку |
| 6.5 | `database/admin.py:4008` `admin_delete_user_complete` → `:3973` `_delete_remnawave_entity` | `DELETE` сущностей в панели по id или username | сначала `POST unlink`; премиум-сущность **не удалять** (она у сайта); свою `{telegram_id}` обхода — только если `bypassOrigin = "bot"` и по решению админа |
| 6.6 | Дашборд «Сверка»: `app/api/dashboard/routes/reconciliation.py:53` + `database/reconciliation.py` | укорачивает `expireAt` по платежам бота | кандидатов с `site_linked` или маркером `atlas-site:` исключить из поиска и из исправления |
| 6.7 | Пробный период (`trials/service.py:526` `grant_trial`) | по `users.trial_used_at` | связанному не выдавать (у аккаунта сайта свой пробный/подписка) |
| 6.8 | `database/subscriptions.py:154` `check_and_disable_expired_subscription` | отключает премиум в панели при истечении | не отключать: истечение общей сущности ведёт сайт/панель; локально — только статус зеркала |
| 6.9 | `auto_renewal.py:517` `process_auto_renewals` | списание по `subscriptions.expires_at` | перед списанием — `GET status` (без транзакции); если сайт уже продлил (срок > порога) — обновить зеркало и не списывать; иначе задача с ключом `autorenew:` пойдёт через 5.2 |
| 6.10 | Дашборд `switch-tariff` (`routes/users.py:512`) → `database/subscriptions.py:552` `admin_switch_tariff` | меняет тариф локально/в панели | `POST /api/bot/sync {subscriptionEnd: status.subscriptionEnd, plan}` |
| 6.11 | Дашборд `grant`, `grant-minutes` (`routes/users.py:363,393`) | задача очереди | идёт через 5.2 автоматически; `premium_minutes` в `context` для минутных |
| 6.12 | `sub-links/refresh`, `sub-links/reissue` (`routes/users.py:466,483`) | перевыпуск ссылок в панели | для связанного — отказ «ключ ведёт сайт» (перевыпуск ссылки — в кабинете сайта) |
| 6.13 | `sub_aggregator.py:44` `is_enabled_for` | склеивает премиум и обход | связанному — `False` (два ключа, раздел 10) |

---

## 7. Зеркало срока в боте

Строка `subscriptions` связанного — копия данных сайта, чтобы работали
напоминания (`database/subscriptions.py:2518`), экраны, автопродление.

Обновляется:
1. после связки (4.5), `extend` (5.2.4), `sync` (6.4, 6.10);
2. **воркером статуса** `site_status_worker` (новый, `main.py:118`
   `start_db_services`): раз в 10 минут для связанных пользователей, у
   которых `site_status_checked_at` старше 10 минут, не больше 5 запросов в
   секунду, `GET status` → зеркало (`expires_at`, `subscription_type`,
   `site_sub_url`, `site_panel_user_id`); `404` → `site_linked = FALSE` + алерт;
3. перед показом ключа и экрана подписки — если кеш статуса старше 60 с.

Сайт недоступен → показывать зеркало, не создавать и не продлевать ничего
«на всякий случай».

---

## 8. Обход (bypass) у связанного

1. Бот ведёт `{telegram_id}` как сейчас (`remnawave_bypass.py`), лимит
   устройств 5, сквад обхода, 2099, `NO_RESET`. Проверить в Railway, что
   `REMNAWAVE_CLIENTS_SQUAD_UUID` бота = `6947418d-83b6-4050-a10c-3829e4cd4b2c`
   (в `config.py:357` значение по умолчанию пустое).
2. **Куда прибавлять ГБ покупки в боте** (`provisioning.py:590` `_apply_bypass`):
   у связанного с `status.bypassOrigin = "site"` — в `status.bypass.panelUserId`
   (сайтовая `ST…_bp`), а не создавать свою `{telegram_id}`. Идентификатор
   брать из `users.site_bypass_panel_user_id` (заполняется из `status`).
3. Сайт тоже прибавляет ГБ в ту же сущность. Защита бота уже подходит:
   CAS-план `base/target` (`provisioning.py:644` `_cas_bypass`); при
   `current ∉ {base, target}` бот не затирает, а останавливает задачу с
   алертом. Для связанного на конфликт: перечитать сущность, пересчитать
   `base = current, target = current + пакет` и повторить **один раз**
   (другая сторона могла прибавить своё); повторный конфликт → dead + алерт.
   Сайт у себя делает то же (`base_limit` в `bypass_traffic_ops`).
4. Остаток показывать живьём из панели (`traffic.py` уже так делает).
   `status.bypassOwedBytes > 0` — «{N} ГБ зачисляются», самому не прибавлять.
5. Пробные 500 МБ: `status.bypassTrialGranted = true` → бот свой пробный
   обход не выдаёт.
6. Пакеты с сайта бот видит опросом `status` (растёт `bypass.limitBytes`).

---

## 9. Баланс и кешбэк

1. **Кешбэк за оплату в боте** платит бот (`process_referral_reward`),
   `amount` в `extend` не передаётся. **Кешбэк за оплату на сайте** сайт
   копит у себя и отдаёт боту через `sync-balance`.
2. **Двухфазный обмен** (3.9), воркер раз в 10 минут для связанных и сразу
   после связки:
   1. `POST sync-balance {telegramId, balance: <копейки бота>, twoPhase: true}`.
   2. Для каждой записи `pendingCashback` — одной транзакцией: вставка
      `site_cashback_applied(site_tx_id PRIMARY KEY, telegram_id, amount_kopecks, applied_at)`
      `ON CONFLICT DO NOTHING`; если вставилась — `increase_balance(telegram_id,
      amount/100, source="site_referral", description, conn=conn)`
      (`database/users.py:97` принимает `conn`).
   3. `POST sync-balance {telegramId, ack: [все id из ответа]}` — и
      зачисленные сейчас, и уже бывшие в `site_cashback_applied`.
   Потерянный ответ, падение бота между фазами, параллельный вызов — деньги
   не теряются и не задваиваются.
3. `sync-referrals` — не обязателен; если использовать — после связки, раз в
   сутки.

---

## 10. Ключи и подписи

1. `get_user_premium_url` (`user_subscription_links.py:112`): связанному —
   `users.site_sub_url` (обновлённый по разделу 7), без чтения
   `remnawave_premium_*` и без ленивого создания (`:186`
   `_try_lazy_provision_entities` не вызывать).
2. `get_user_bypass_url` (`:409`): связанному — `status.bypass.subscriptionUrl`
   (кеш 60 с), при `bypass = null` — как сейчас по `{telegram_id}`.
3. Подписи (владелец, 13.09.2026) — одинаковые на сайте и в боте, в
   `app/i18n/ru.py` (`setup.key_vpn_label` :86, `setup.key_bypass_label` :87,
   `setup.key_vpn_incy_label` :88, `setup.key_bypass_incy_label` :89):

| Ключ | Подпись | Строка |
|---|---|---|
| премиум | «Ключ 1 · Основной VPN» | «Безлимитный трафик, все {N} стран.» |
| обход | «Ключ 2 · Обход» | «Улучшенные серверы для обхода блокировок. Расходует гигабайты пакета.» + «Осталось {remaining} ГБ» |
| подсказка | — | «Если основной VPN не подключается — выберите в приложении ключ «Обход».» |

---

## 11. Тексты

Кнопки: «📧 Привязать почту», «✅ Привязать», «Отмена», «🔑 Мой ключ»,
«Открыть в Happ», «Отвязать», «Отправить код ещё раз», «Изменить почту».

| Ситуация | Текст |
|---|---|
| Запрос почты | «Введите почту, которую используете на сайте qodev.dev (или новую — мы создадим аккаунт). Мы пришлём на неё код.» |
| Почта некорректна | «Похоже, в адресе ошибка. Пример: name@mail.ru» |
| Одноразовая почта | «Одноразовые адреса не подходят. Укажите постоянную почту.» |
| Код отправлен | «Отправили код на {email}. Введите 6 цифр из письма. Код действует 10 минут.» |
| Неверный код | «Неверный код. Осталось попыток: {attemptsLeft}.» |
| Код истёк / попытки кончились | «Код больше не действует. Нажмите «Отправить код ещё раз».» |
| Не формат кода | «Код — это 6 цифр из письма.» |
| Telegram связан с другим | «Ваш Telegram уже связан с другим аккаунтом сайта. Чтобы привязать эту почту, сначала отвяжите текущий.» |
| Почта связана с другим Telegram | «Аккаунт с этой почтой уже связан с другим Telegram. Отвяжите его в личном кабинете на сайте и попробуйте снова.» |
| Слишком часто | «Слишком много попыток, подождите {N} сек.» |
| Сайт/панель недоступны | «Сервис подписок сейчас недоступен. Попробуйте через минуту — код ещё действует.» |
| Подтверждение ссылки | «Привязать аккаунт {maskedEmail} к этому Telegram? После привязки у бота и сайта будет одна подписка и один ключ.» |
| Ссылка недействительна | «Ссылка недействительна или устарела. Получите новую в личном кабинете на сайте.» |
| Отвязка — подтверждение | «Отвязать Telegram от {email}? Подписка и ключ останутся в аккаунте на сайте. Бонус за повторную привязку не начисляется.» |
| Отвязано | «Готово, Telegram отвязан. Подписка осталась в аккаунте {email} на сайте.» |
| Оплата связанного | «Оплата прошла! Подписка до {subscriptionEnd}. Ключ тот же — ничего менять не нужно.» |
| Продление в очереди | «Оплата принята. Подписка продлится в течение нескольких минут.» |
| Пакет трафика | «Готово: +{N} ГБ к ключу «Обход». Осталось {remaining} ГБ — гигабайты без срока, пакеты складываются.» |
| ГБ зачисляются | «Оплата прошла, {N} ГБ зачисляются — обычно пара минут.» |
| Админка бота, действие над связанным | «Подписку этого пользователя ведёт сайт: действие выполнено через сайт» / при ошибке сайта — «Сайт недоступен, действие не выполнено» |

Строки — в `app/i18n/ru.py` и `app/i18n/en.py` одинаковыми ключами
(`site_link.*`).

---

## 12. Реализация в боте

### 12.1. Файлы

Новые:
- `migrations/096_site_link.sql` — 12.2.
- `app/services/site_link/client.py` — HTTP-клиент: `status`, `email_start`,
  `email_confirm`, `link_preview`, `link_confirm`, `unlink`, `relink`,
  `extend`, `sync_overwrite`, `sync_balance_peek`, `sync_balance_ack`.
  Возвращает `(http_status, code, data)`, а не `None` на ошибку. Выключатель
  на `503 bot_sync_disabled` на 5 минут. Ретраи — 3.10 через `retry_async`.
- `app/services/site_link/state.py` — `is_linked(tg)` (локальный флаг),
  `refresh_status(tg, max_age=60)`, `apply_link_result(tg, data)` (4.5),
  `apply_unlink(tg)` (4.6), запись зеркала (7).
- `app/services/site_link/cashback.py` — раздел 9.
- `app/handlers/user/site_link.py` — FSM 4.1, подтверждение 4.2, экраны 4.3–4.6.
- `app/workers/site_link_worker.py` — статус (7) + кешбэк (9); старт в
  `main.py:118` `start_db_services` через `_start("site_link_worker", …)`.
- `tests/services/test_site_link_client.py`, `tests/services/test_site_link_state.py`,
  `tests/handlers/test_site_link.py`, тест развилки `apply()`.

Правятся: `start.py` (4.2), `keyboards.py:262`, `states.py`
(`SiteLinkState`), `provisioning.py` (5.2, 8.2–8.3), `purchase_flow.py`
(5.4), `remnawave_premium.py:129` (6.3), `database/admin.py` (6.4, 6.5),
`reconciliation` (6.6), `trials/service.py` (6.7), `database/subscriptions.py`
(6.8, 6.10), `auto_renewal.py` (6.9), `routes/users.py` (6.10–6.12),
`sub_aggregator.py:44` (6.13), `user_subscription_links.py` (10),
`confirmation.py:895` и `payments_messages.py` (5.3), `config.py`, i18n.

### 12.2. Миграция `096_site_link.sql`

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_linked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_user_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_linked_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_unlinked_at TIMESTAMP;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_link_kept TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_panel_user_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_sub_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_bypass_panel_user_id BIGINT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_bypass_origin TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS site_status_checked_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_users_site_linked ON users (site_status_checked_at) WHERE site_linked;

CREATE TABLE IF NOT EXISTS site_cashback_applied (
    site_tx_id      TEXT PRIMARY KEY,
    telegram_id     BIGINT NOT NULL,
    amount_kopecks  INTEGER NOT NULL CHECK (amount_kopecks > 0),
    applied_at      TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'UTC'),
    acked_at        TIMESTAMP NULL
);
```

### 12.3. Конфиг

- `SITE_API_BASE_URL` — по умолчанию `https://qodev.dev` (в коде).
- `SITE_BOT_API_KEY` — секрет, равен `BOT_API_KEY` сайта (Railway).
- `SITE_LINK_ENABLED` — выключатель, по умолчанию `false`. Выключен → кнопки
  нет, `/start link_` отвечает «Скоро», воркер не стартует, развилка 5.2 **не
  отключается** для уже связанных (иначе бот начнёт трогать общий ключ).

### 12.4. Сверка после первого включения

Бот раньше не связывал аккаунты, но у части аккаунтов сайта `telegram_id`
может уже стоять (связка из кабинета при прежнем боте). У таких людей в боте
своя `tg_{id}_premium`, и ключей два. Одноразовый проход сразу после
включения:

```
для каждого telegram_id с subscriptions.remnawave_premium_id или активной подпиской:
    st = GET /api/bot/status?telegram_id=ID          # не чаще 5 запросов/с
    если 200 linked:
        r = POST /api/bot/relink {telegramId: ID, premiumPanelUserId: remnawave_premium_id}
        apply_link_result(ID, r.data)                  # 4.5
        если r.data.kept == "site": отправить сообщение из 4.3
```

Проход идемпотентен. До прохода сайт страхует общий ключ правилом «не
укорачивать» (срок из панели позже, чем в БД сайта, подтягивается к себе).

---

## 13. Решения владельца (нужны до разработки)

| # | Вопрос | Факт | Предложение по умолчанию в этом ТЗ |
|---|---|---|---|
| 1 | Шкала кешбэка | бот: 10/20/30/40/45% при 0/25/50/75/100 оплативших (`app/constants/loyalty.py`); сайт: 10/25/45% при 0/25/50 | каждая сторона платит за оплаты на своей стороне; шкалу сайта привести к шкале бота (баланс живёт в боте) |
| 2 | Пакеты трафика | бот: 1200 ГБ / 4 399 ₽, 2200 ГБ / 7 899 ₽, 8000 ГБ / 28 799 ₽; сайт: 1000 / 4 399, 2000 / 7 899, пакета 8000 нет | привести сайт к боту |
| 3 | Лимит устройств премиума | бот: Basic 10, Plus 14; сайт: 14 для всех | общая сущность `kept=site` получает лимит сайта, `kept=bot` — свой; единое правило выбрать |
| 4 | Админка бота над связанным | отзыв, удаление, сверка, тариф — сейчас трогают панель напрямую | через сайт (раздел 6), удаление — сначала отвязка |
| 5 | Автопродление с баланса бота у связанного | работает по локальному сроку | оставить, со сверкой статуса перед списанием (6.9) |
| 6 | Агрегатор ключей | сейчас только для админов | связанным — два отдельных ключа |
| 7 | Пробный период бота у связанного | выдаётся по `trial_used_at` | не выдавать |
| 8 | Реферальные ссылки | коды бота и сайта разные, `?ref=` сайта в бот не доходит | каждая сторона — свои ссылки |

---

## 14. Порядок выкладки

1. **Сайт** (`8e1905a`) — уже на https://qodev.dev. Со стороны сайта перед
   стартом: выдать команде бота `BOT_API_KEY` (секрет из Railway сайта).
2. **Бот, шаг 1 — защита** (без связки, `SITE_LINK_ENABLED=false`):
   миграция 096, 6.3 (`atlas-site:` в `_is_our_entity`), развилка 5.2 и
   все защиты раздела 6 по флагу `site_linked`. Флаг ни у кого не стоит —
   поведение не меняется.
3. **Бот, шаг 2 — клиент и сценарии** (раздел 4), воркер (7, 9), ключи (10).
   Проверка на тестовом аккаунте, затем `SITE_LINK_ENABLED=true`.
4. **Проход 12.4** для уже связанных.
5. После выкладки проверить:
   - журнал админки сайта — события `telegram.link` с `kept=…`;
   - в панели у связанных одна живая премиум-сущность, вторая `DISABLED`;
   - покупка в боте связанного → событие «Продление ботом» у пользователя
     на сайте, новый `expireAt` на общей сущности, в очереди бота задача `done`;
   - нет событий «Срок из панели (общий ключ)» после новых покупок (их
     появление значит, что бот где-то сам PATCH-ит срок).

## 15. Чек-лист тестов бота

- [ ] Бот первым, подписка только в боте → `kept: only-bot`, ключ не изменился, +7 дней, зеркало = сайт.
- [ ] Подписки в обоих местах, у бота срок больше → `kept: bot`; у сайта больше → `kept: site`, новый ключ показан, кеш ботовской сущности очищен.
- [ ] Сайт первым: `/start link_<43>` → превью → «Привязать» → «Готово»; `/start s-…`, `p-…`, `refd_…` не попадают в разбор ссылки.
- [ ] Повтор «Привязать» → `alreadyLinked`, бонус 0.
- [ ] Неверный код ×5, истёкший код, чужая почта (`CODE_NOT_FOUND`).
- [ ] `503` при confirm → повтор тем же кодом проходит.
- [ ] Покупка связанного (карта, Stars, баланс, автопродление, подарок, игра, админ-дни, минуты): одна задача, один `extend` с ключом задачи, без `amount`, нет PATCH в панель; повтор задачи → `duplicate: true`.
- [ ] Сайт недоступен при оплате → «продлится в течение нескольких минут», задача ретраится и завершается.
- [ ] `extend` → `404` → флаг снят, задача выполнена обычным путём.
- [ ] Отзыв в админке бота → `sync plan:none`; удаление → `unlink`, премиум-сущность не удалена; «Сверка» не видит связанного; смена тарифа → `sync` с текущим сроком.
- [ ] Истечение у связанного → панель не трогается.
- [ ] Отвязка → следующая покупка создаёт `tg_{id}_premium_2`, сущность с `atlas-site:` не адоптирована.
- [ ] Обход: покупка в боте у `bypassOrigin=site` → ГБ в `ST…_bp`; одновременная прибавка сайтом → конфликт CAS → перечитать и повторить один раз.
- [ ] Кешбэк: потеря ответа фазы 1, падение между фазами, два параллельных воркера → каждая запись зачислена ровно один раз, все подтверждены.
