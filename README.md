# Форпост — інтернет-магазин на дропшипінгу

Магазин без складу: каталог постачальників MyDrop, власна вітрина на Next.js, оплата карткою (monobank) або накладеним платежем, замовлення передаються постачальнику через MyDrop.

Сайт: https://forpost-shop.com

## Стек

| Частина | Що використовуємо |
|---|---|
| Вітрина й API | Next.js 16 (App Router), React 19, папка [`shop/`](shop/) |
| Хостинг | Vercel (проєкт `forpost-shop`, домен `forpost-shop.com`) |
| База даних | Supabase (Postgres), схема `market` |
| Постачальник | MyDrop (каталог, ціни, залишки, чернетки замовлень) |
| Оплата | monobank mono pay (еквайринг), накладений платіж Нової Пошти |
| Довідник доставки | API Нової Пошти (міста й відділення) |
| Листи | Resend (відправник `noreply@forpost-shop.com`) |
| Розклад | Supabase `pg_cron` + `pg_net` |

> Це не звична версія Next.js: перед правками читайте [`shop/AGENTS.md`](shop/AGENTS.md) і документацію в `shop/node_modules/next/dist/docs/`.

## Як це працює

1. **Каталог.** Базовий знімок товарів лежить у `shop/data/products.json` (скрипт `npm run sync`). Свіжі ціни й залишки вітрина бере з `market.supplier_prices`, повні описи, фото й розміри з `market.product_details`.
2. **Ціна.** Собівартість = `drop_price` MyDrop. Ціна на сайті = max(рекомендована ціна постачальника RRP, drop_price + мінімальний чистий прибуток `MIN_PROFIT_PERCENT` після податку, ВЗ і комісії): `sellPrice` у `lib/pricing.js`. Товари без drop_price не продаються.
3. **Замовлення** (`/api/order`):
   - перевіряє товар, жива ціна й залишок у MyDrop, розмір, місто й відділення НП;
   - **картка:** створює рахунок mono, покупця перекидає на оплату; після оплати вебхук (`/api/mono-webhook`, перевірка підпису X-Sign) створює чернетку в MyDrop і надсилає лист власнику;
   - **накладений платіж** (до `COD_MAX_AMOUNT`, за замовчуванням 3000 ₴): одразу створює чернетку й лист власнику «підтвердити по телефону».
4. **Подача постачальнику.** Накладений платіж для Oasis_Drop, Товарного Синдикату й Secret Shop (`AUTO_SUBMIT_VENDORS`) подається автоматично через `POST /orders/<id>/submit`, ТТН створює постачальник, а cron `order-sync` підтягує її й надсилає листи. Оплата карткою й решта постачальників (BEZET вимагає скриншот оплати) лишаються чернеткою, яку власник подає вручну. У чернетці вказано спосіб оплати (оплачено карткою або накладений платіж).
5. **Статус замовлення** для покупця: `/order/<id>-<токен>` (токен HMAC, чужі замовлення не перебрати).
6. **Відгуки:** відкрита форма на сторінці товару й персональне посилання `/review/<токен>`. Усі відгуки проходять модерацію (`market.reviews.approved = true`), блок на сайті показується лише коли є схвалені відгуки.
7. **Моніторинг цін** (щодоби 05:30 UTC, `/api/cron/price-watch`): оновлює закупівельні ціни, залишки, описи й розміри, пише зміни в `market.price_changes`, листом повідомляє про зміни від 5% і товари, що зникли.
8. **Запити відгуків** (щодоби 07:00 UTC, `/api/cron/review-requests`): SMS і/або лист покупцям через 10 днів після оплати, коли налаштовані канали.
9. **Фінанси:** `GET /api/finance?days=30` із заголовком `X-Finance-Key`: по кожному платежу комісія, податок, закупівля, прибуток.
10. **SEO:** `sitemap.xml`, `robots.txt`, canonical, мікророзмітка `Product`, фід Google Merchant `/feed/google.xml`.

## Структура

```
shop/
  app/                 сторінки й API (Next App Router)
    p/[id]/            сторінка товару (галерея, розміри, відгуки, форма)
    order/[ref]/       статус замовлення
    review/[ref]/      форма відгуку за посиланням
    oferta, povernennya, konfidentsiynist/   юридичні сторінки
    api/               order, mono-webhook, np, review, finance, cron/*
    feed/google.xml/   фід для Google Merchant
  lib/                 pricing, orders, mono, np, notify, sms, pricewatch, details, prices, seller, site
  scripts/             sync-catalog, sync-details, push-supabase
  data/                products.json (знімок каталогу), competitors.json
supabase/migrations/   SQL-схема й розклади
```

Старі інструменти (не частина сайту): `monitor.js` (моніторинг цін конкурентів), `mydrop.js`, `prom-orders.js`, `web/`, `dev-server.js`. Інтеграцію Prom.ua прибрано.

## Змінні середовища

Зразок у [`.env.example`](.env.example). Локально ключі лежать у кореневому `.env` (його читає `shop/next.config.mjs`, на Vercel не читається). **`.env` у git не потрапляє.**

| Змінна | Призначення |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | база даних (service key лише на сервері) |
| `MYDROP_API_KEY` | API MyDrop |
| `MONO_TOKEN`, `MONO_PERSONAL_TOKEN` | еквайринг і виписка monobank |
| `SITE_URL`, `PUBLIC_SITE_URL` | адреса сайту (оплата/посилання) і адреса для SEO |
| `FINANCE_KEY` | доступ до `/api/finance` |
| `CRON_SECRET`, `PRICE_WATCH_SECRET` | авторизація cron-запитів і HMAC-токенів посилань |
| `SITE_MARKUP_PERCENT`, `TAX_PERCENT`, `MONO_FEE_PERCENT` | націнка, податок, комісія |
| `COD_MAX_AMOUNT` | ліміт накладеного платежу |
| `SELLER_NAME`, `SELLER_TAXID`, `SELLER_ADDRESS`, `SELLER_EMAIL` | дані ФОП для оферти (імʼя й РНОКПП за замовчуванням з mono) |
| `RESEND_API_KEY`, `NOTIFY_EMAIL`, `NOTIFY_FROM` | листи власнику й покупцям |
| `TURBOSMS_TOKEN`, `TURBOSMS_SENDER`, `REVIEW_REQUEST_DAYS` | SMS і строк запиту відгуку |

## Локальний запуск

```bash
cd shop
npm install
npm run dev        # http://localhost:3020
```

Класифікація товарів (група → тип) рахується за назвою, категорією й **описом**: `node --env-file=../.env scripts/classify.mjs` пише `shop/data/classification.json`; правила в `shop/lib/taxonomy.mjs` (поза військовими групами) і `shop/lib/groups-legacy.mjs` (військові групи). Перезапускати після оновлення каталогу.

Команди: `npm run build`, `npm run start`, `npm run sync` (оновити знімок каталогу), `node --env-file=../.env scripts/sync-details.mjs` (описи, фото, розміри).

## Деплой

```bash
vercel --prod
```

Змінні задаються в Vercel → Settings → Environment Variables. Після зміни змінної потрібен новий деплой.

## База даних

SQL-міграції лежать у [`supabase/migrations/`](supabase/migrations/). Схема `market`: `orders`, `reviews`, `supplier_prices`, `price_changes`, `product_details`, `competitor_prices`, а також `products` і `price_snapshots` (старий моніторинг). Розклад `price-watch-daily` і `review-requests-daily` налаштований через `pg_cron`, секрет викликів лежить у Supabase Vault (`price_watch_secret`).

## Важливо знати

- Оплачені карткою замовлення в чернетці MyDrop мають позначку «ОПЛАЧЕНО, накладений платіж не стягувати». Платіжні поля (передоплата, накладений платіж) задаються при подачі замовлення постачальнику, тобто вручну.
- Єдиний податок 3 групи (5%) рахується від усієї виручки на рахунок, тому беззбиткова націнка 6,7%.
- Розсилка відгуків і листи покупцям потребують налаштованих каналів (SMS або лист з верифікованого домену).
- Тестові замовлення №1–13 лишились у базі; їх можна видалити SQL-запитами.
