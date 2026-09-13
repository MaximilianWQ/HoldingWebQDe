# ТЗ синхронизации: Сайт Atlas Secure ↔ Бот ATCbot

## Авторизация

Все запросы к `/api/bot/*` требуют заголовок:
```
X-Bot-Api-Key: <значение BOT_API_KEY из .env>
```

---

## 1. БАЛАНС

### Владелец: БОТ

Сайт хранит баланс в `users.balance` (INTEGER, копейки) только для отображения. Пополнение, оплата, вывод — только через бот. Единственное, что сайт пишет в баланс самостоятельно — **кешбэк рефереру при оплате через YooKassa**.

### `POST /api/bot/sync-balance` — синхронизация баланса

**Когда вызывать:** периодически или после каждого изменения баланса в боте.

**Request:**
```json
{
  "telegramId": "123456789",
  "balance": 100000
}
```
- `balance` — текущий баланс бота в **копейках** (100000 = 1000.00₽)

**Логика сайта:**
1. Ищет все транзакции кешбэка с `synced_to_bot = false` для этого пользователя
2. Считает `unsyncedTotal` = сумма всех неотсинченных транзакций
3. `correctBalance = botBalance + unsyncedTotal`
4. Обновляет `users.balance = correctBalance`
5. Помечает все эти транзакции `synced_to_bot = true`
6. Возвращает `pendingCashback` — бот **ДОЛЖЕН** прибавить эти суммы к своему балансу

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@mail.com",
    "balance": 102990,
    "balanceRubles": 1029.90,
    "previousBalance": 100000,
    "pendingCashback": [
      {
        "id": "tx-uuid-1",
        "amount": 2990,
        "amountRubles": 29.90,
        "description": "Кешбэк 10% от покупки 299₽",
        "relatedUserId": "buyer-uuid",
        "createdAt": "2026-04-11T12:00:00.000Z"
      }
    ],
    "pendingCashbackTotal": 2990,
    "pendingCashbackTotalRubles": 29.90
  }
}
```

**Действие бота после ответа:**
```python
if response["pendingCashback"]:
    for cb in response["pendingCashback"]:
        # Прибавить cb["amount"] (копейки) к балансу бота
        database.increase_balance(
            telegram_id,
            cb["amountRubles"],
            source="site_referral",
            description=cb["description"]
        )
```

Если `pendingCashback` пустой — баланс бота не менялся со стороны сайта, ничего делать не нужно.

### Пример полного цикла синхронизации баланса

```
Бот: баланс = 100000 коп (1000.00₽)

Между синхронизациями на сайте произошло:
  → Реферал оплатил 299₽ через YooKassa
  → Сайт начислил кешбэк 10% = 2990 коп (29.90₽)
  → balance_transactions: { amount: 2990, synced_to_bot: false }
  → users.balance на сайте: 100000 + 2990 = 102990

Бот вызывает POST /api/bot/sync-balance { balance: 100000 }
  → Сайт: botBalance=100000, unsyncedTotal=2990
  → correctBalance = 100000 + 2990 = 102990
  → Помечает транзакцию synced_to_bot = true
  → Response: { balance: 102990, pendingCashback: [{amount: 2990}] }

Бот получает ответ:
  → Прибавляет 2990 коп к своему балансу
  → Бот: баланс = 100000 + 2990 = 102990 коп (1029.90₽)
  → Обе стороны = 102990 ✓
```

### `GET /api/bot/sync-balance?telegram_id=123456789` — проверка баланса

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@mail.com",
    "balance": 102990,
    "balanceRubles": 1029.90,
    "pendingCashbackCount": 0,
    "pendingCashbackTotal": 0,
    "pendingCashbackTotalRubles": 0
  }
}
```

---

## 2. РЕФЕРАЛЬНАЯ СИСТЕМА (кешбэк)

### Уровни лояльности

| Оплативших рефералов | Кешбэк | Уровень       |
|----------------------|--------|---------------|
| 0–24                 | **10%**| Стартовый     |
| 25–49                | **25%**| Продвинутый   |
| 50+                  | **45%**| Партнёр       |

Считается по `paidReferrals` — количеству рефералов, которые хотя бы раз оплатили.

### Когда сайт начисляет кешбэк самостоятельно

При каждом успешном платеже через YooKassa (webhook или polling), если у покупателя есть `referredBy` (реферальный код пригласившего):

```
Покупатель платит 299₽ → YooKassa webhook → creditReferrerOnPayment(buyerId, 299, paymentId)

Расчёт:
  → Реферер: paidReferrals=3, getCashbackPercent(3)=10%
  → rewardKopecks = round(299 * 10 / 100 * 100) = 2990 копеек (29.90₽)

Запись в БД:
  → UPDATE users SET balance = balance + 2990, paid_referrals = paid_referrals + 1
  → INSERT INTO balance_transactions (synced_to_bot = FALSE)
  → INSERT INTO referral_rewards (идемпотентность по buyer_id + purchase_id)
```

**Защиты:**
- Самореферал заблокирован (referrer.id !== buyer.id)
- Кешбэк не дублируется — UNIQUE на `(buyer_id, purchase_id)` в `referral_rewards`
- Без суммы покупки — только инкрементирует `paidReferrals`, кешбэк не начисляет

### `POST /api/bot/sync-referrals` — синхронизация рефералов

**Когда вызывать:** после изменения реферальных данных в боте.

**Request:**
```json
{
  "telegramId": "123456789",
  "referrals": 15,
  "paidReferrals": 5,
  "referralCode": "ABC123"
}
```

**Логика:** берёт MAX от бота и сайта по каждому полю — данные никогда не теряются.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "referrals": 15,
    "paidReferrals": 5,
    "referralCode": "SITE1234",
    "siteReferralCode": "SITE1234",
    "botReferralCode": "ABC123",
    "balance": 102990,
    "balanceRubles": 1029.90,
    "cashbackPercent": 10,
    "loyaltyTier": "Стартовый",
    "nextTier": "Продвинутый",
    "referralsToNextTier": 20
  }
}
```

---

## 3. ПОДПИСКА

### `POST /api/bot/extend` — продление подписки после оплаты в боте

**Request:**
```json
{
  "telegramId": "123456789",
  "days": 30,
  "plan": "basic",
  "amount": 299,
  "paymentId": "bot-payment-uuid-123"
}
```

| Поле         | Тип    | Обязательное | Описание                                                    |
|--------------|--------|--------------|-------------------------------------------------------------|
| `telegramId` | string | Да           | Telegram ID пользователя                                    |
| `days`       | number | Да           | Количество дней продления                                   |
| `plan`       | string | Нет          | "basic" или "plus"                                          |
| `amount`     | number | Нет          | Сумма покупки в **рублях** (для расчёта кешбэка рефереру)   |
| `paymentId`  | string | **Рекомендуется (станет обязательным)** | Уникальный ID платежа — ключ идемпотентности продления и кешбэка |

Вместо `paymentId` можно передать заголовок `Idempotency-Key: <id платежа>` — эффект тот же.

**Идемпотентность (с 12.09.2026):**
- С `paymentId` (или `Idempotency-Key`) вызов полностью идемпотентен: повтор с тем же ключом не продлевает подписку и не начисляет кешбэк повторно, ответ приходит с `duplicate: true`.
- Без `paymentId` сайт считает повтором вызов для того же пользователя с теми же `days`, `plan` и `amount` в течение **120 секунд** после предыдущего: ничего не применяется, ответ `duplicate: true`. Настоящую вторую покупку с теми же параметрами в течение 120 секунд без `paymentId` отличить нельзя — поэтому передавайте `paymentId` всегда. Каждый вызов без него пишется в лог сайта как `bot-extend.no-payment-id`.

**Логика сайта:**
1. Продляет подписку от max(сейчас, текущий конец) — через журнал событий, в одной транзакции с кешбэком
2. Обновляет `subscriptionPlan` (только `basic` / `plus`)
3. Если передан `amount` — начисляет кешбэк рефереру (`synced_to_bot = false`), один раз на покупку
4. Сразу переносит новую дату в панель Remnawave
5. Создаёт уведомление пользователю на сайте

Собственных VPN-ключей (Xray) у сайта больше нет: доступ выдаёт панель Remnawave.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@mail.com",
    "daysLeft": 30,
    "subscriptionEnd": "2026-05-11T12:00:00.000Z",
    "vpnKey": "https://sub.example/AbCdEf0123456789",
    "subscriptionUrl": "https://sub.example/AbCdEf0123456789",
    "subscriptionPlan": "basic",
    "duplicate": false,
    "referralReward": {
      "referrerId": "referrer-uuid",
      "percent": 10,
      "rewardAmount": 29.90
    }
  }
}
```

`referralReward` = `null` если у покупателя нет реферера, если `amount` не передан, или если вызов распознан как повтор (`duplicate: true`).

**Ссылка подписки (изменено 12.09.2026):** `vpnKey` теперь содержит ссылку подписки Remnawave — ту же, что новое поле `subscriptionUrl` (оба поля сохранены для совместимости; переходите на `subscriptionUrl`). `xrayUuid` во всех ответах сайта теперь всегда `null`. Это касается `/api/bot/extend`, `/status`, `/link`, `/register`, `/user`, `/user-by-telegram`.

**Важно:** кешбэк, начисленный здесь, появится в `pendingCashback` при следующем вызове `POST /api/bot/sync-balance`. Бот должен забрать его оттуда.

### `POST /api/bot/sync` — перезапись подписки

**Request:**
```json
{
  "telegramId": "123456789",
  "action": "overwrite_site",
  "subscriptionEnd": "2026-05-11T12:00:00.000Z",
  "plan": "basic"
}
```

Перезаписывает `subscriptionEnd` и `subscriptionPlan` на сайте значениями из бота. VPN-ключи **не трогает**.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@mail.com",
    "subscriptionEnd": "2026-05-11T12:00:00.000Z",
    "subscriptionPlan": "basic",
    "telegramLinked": true
  }
}
```

---

## 4. СТАТУС

### `GET /api/bot/status?telegram_id=123456789` — полный статус пользователя

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userId": "uuid",
    "email": "user@mail.com",
    "telegramId": "123456789",
    "telegramLinked": true,
    "daysLeft": 25,
    "hoursLeft": 14,
    "minutesLeft": 32,
    "isExpired": false,
    "hasActiveSubscription": true,
    "subscriptionEnd": "2026-05-11T12:00:00.000Z",
    "subscriptionPlan": "basic",
    "vpnKey": "https://sub.example/AbCdEf0123456789",
    "subscriptionUrl": "https://sub.example/AbCdEf0123456789",
    "xrayUuid": null,
    "referralCode": "SITE1234",
    "referrals": 15,
    "paidReferrals": 5,
    "balance": 102990,
    "balanceRubles": 1029.90,
    "cashbackPercent": 10,
    "loyaltyTier": "Стартовый"
  }
}
```

`vpnKey` и `subscriptionUrl` — ссылка подписки Remnawave (одно и то же значение). Если подписка истекла или ссылка ещё не выдана панелью — оба `null`. `xrayUuid` всегда `null`.

**Новые поля (13.09.2026):** `linked: true`, `panelUserId` (id ОБЩЕЙ сущности панели — бот не создаёт и не продлевает свою `tg_{id}_premium` для связанного), `linkKept`, `plan` (= `subscriptionPlan`), `bypass: {panelUserId, subscriptionUrl, limitBytes, usedBytes, remainingBytes, unlimited, status} | null`. Не связан → `404 {code: "NOT_LINKED", data: {linked: false}}`. Подробности — раздел 9.

---

## 5. ЧТО НЕ СИНХРОНИЗИРУЕТСЯ

| Данные                             | Причина                          |
|------------------------------------|----------------------------------|
| **VPN-ключи**                      | Своих ключей у сайта нет; `vpnKey`/`subscriptionUrl` — ссылка Remnawave, выдаёт панель |
| **Пароль**                         | Только на сайте                  |
| **Оплата с баланса на сайте**      | Не реализована, только через бот |

---

## 6. ПОРЯДОК ВЫЗОВОВ ДЛЯ БОТА

### При оплате подписки в боте:
```
1. Активировать подписку в боте
2. POST /api/bot/extend { telegramId, days, plan, amount, paymentId }
3. POST /api/bot/sync-balance { telegramId, balance }
   → Забрать pendingCashback если есть
```

### Периодическая синхронизация:
```
1. POST /api/bot/sync-balance { telegramId, balance }
   → Забрать pendingCashback
2. POST /api/bot/sync-referrals { telegramId, referrals, paidReferrals }
```

### Проверка статуса:
```
GET /api/bot/status?telegram_id=123456789
```

---

## 7. ОШИБКИ

Все эндпоинты возвращают ошибки в формате:
```json
{ "success": false, "error": "Описание ошибки" }
```

| HTTP | Когда                                        |
|------|----------------------------------------------|
| 401  | Неверный или отсутствующий `X-Bot-Api-Key`   |
| 400  | Не переданы обязательные поля                |
| 404  | Пользователь не найден по `telegramId`       |
| 500  | Внутренняя ошибка сервера                    |

---

## 8. СХЕМА БД (релевантные таблицы)

### users (ключевые поля)
```sql
balance INTEGER NOT NULL DEFAULT 0          -- Копейки
referral_code TEXT UNIQUE NOT NULL          -- 8-символьный код
referred_by TEXT                            -- Код пригласившего
referrals INTEGER NOT NULL DEFAULT 0       -- Сколько пригласил
paid_referrals INTEGER NOT NULL DEFAULT 0  -- Сколько из них оплатили
subscription_end TIMESTAMPTZ NOT NULL      -- Конец подписки
subscription_plan TEXT DEFAULT 'trial'     -- trial|basic|plus
```

### balance_transactions
```sql
id TEXT PRIMARY KEY
user_id TEXT NOT NULL
amount INTEGER NOT NULL                    -- Копейки
type TEXT NOT NULL                         -- 'cashback'
source TEXT                                -- 'referral'
description TEXT                           -- 'Кешбэк 10% от покупки 299₽'
related_user_id TEXT                       -- ID покупателя
synced_to_bot BOOLEAN NOT NULL DEFAULT TRUE -- FALSE = ещё не забрал бот
created_at TIMESTAMPTZ DEFAULT NOW()
```

### referral_rewards
```sql
id TEXT PRIMARY KEY
referrer_id TEXT NOT NULL                  -- Кто получил кешбэк
buyer_id TEXT NOT NULL                     -- Кто купил
purchase_id TEXT                           -- ID платежа (идемпотентность)
purchase_amount INTEGER NOT NULL           -- Сумма покупки (копейки)
percent INTEGER NOT NULL                   -- 10, 25 или 45
reward_amount INTEGER NOT NULL             -- Сумма кешбэка (копейки)
created_at TIMESTAMPTZ DEFAULT NOW()

UNIQUE INDEX (buyer_id, purchase_id)       -- Защита от дубликатов
```

---

## 9. СВЯЗКА БОТ ↔ САЙТ: ОДИН ЧЕЛОВЕК — ОДНА ПОДПИСКА — ОДИН КЛЮЧ (13.09.2026)

Полное ТЗ для бота — `docs/bot/TZ_BOT_EMAIL_LINK.md`; модель сущностей бота — `docs/bot/PANEL_USER_MODEL.md`.

| Метод и путь | Назначение |
|---|---|
| `POST /api/bot/email/start {telegramId, email}` | бот первым: код 6 цифр на почту (10 мин, 5 попыток). Ответ нейтральный. `200 {sent}` · `400 VALIDATION/DISPOSABLE_EMAIL` · `409 TELEGRAM_LINKED_OTHER` · `429` · `502` |
| `POST /api/bot/email/confirm {telegramId, email, code, premiumPanelUserId?}` | проверка кода → связка. `200 {linked, userId, email, subscriptionUrl, panelUserId, subscriptionEnd, plan, kept, disabledPanelUserId, bonusDays, …}` · `400 CODE_*` · `409 TELEGRAM_LINKED_OTHER/EMAIL_LINKED_OTHER` · `503 PANEL_UNAVAILABLE` (код остаётся годным) |
| `GET /api/bot/link?token=` | превью одноразовой ссылки из кабинета: `{valid, maskedEmail, expiresAt}` · `404/410` |
| `POST /api/bot/link {token, telegramId, premiumPanelUserId?}` | сайт первым: `/start link_<token>` (одноразовый, 15 мин). Старые постоянные токены принимаются и сразу заменяются. Ответ как у confirm |
| `POST /api/bot/unlink {telegramId}` | отвязка: подписка и ключ остаются у аккаунта сайта; бонус повторно не выдаётся |
| `POST /api/bot/relink {telegramId, premiumPanelUserId?}` | миграция связанных до 13.09.2026: повторить слияние ключей для УЖЕ связанного Telegram (идемпотентно) |
| `POST /api/bot/extend` | для связанных — ЕДИНСТВЕННЫЙ способ продления после оплаты в боте (с `paymentId`); PATCH `expireAt` общей сущности бот не делает |

**Слияние при связке:** есть подписки и в боте, и на сайте → остаётся сущность с большим сроком (её ключ общий), вторая `DISABLED`, срок её не трогаем, дни не складываются. `kept`: `bot | site | only-bot | only-site | none`. Бонус +7 дней — один раз на аккаунт и на Telegram ID.

**Обход (bypass `{telegram_id}`):** ведёт бот; сайт запоминает его за аккаунтом, показывает остаток и никогда не трогает его срок/сквад/лимиты. Трафик — только read-modify-write `trafficLimitBytes` (в следующей фазе сайт тоже будет добавлять трафик в ту же сущность).

**Страховка «общий ключ не укорачивать»:** если у общей сущности в панели срок позже, чем в БД сайта, и его изменил не сайт, сайт подтягивает срок к себе (событие журнала `panel_pull`), а не перезаписывает.
