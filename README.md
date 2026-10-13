# market

Дропшипінг без складу: моніторинг цін, власна вітрина «Форпост» і зв'язок замовлень із постачальником (MyDrop) та Prom.ua.

Що в репо:

| Частина | Файли |
|---|---|
| Моніторинг цін (Prom.ua, Rozetka) | `monitor.js`, `watchlist.json`, `price-history.json` |
| Вітрина «Форпост» | `web/index.html`, `web/catalog.json`, `web/api/order.js`, `web/api/feed.js`, `dev-server.js` |
| Клієнт MyDrop | `mydrop.js`, `test-mydrop.js` |
| Замовлення з Prom.ua → MyDrop | `prom-orders.js` |

## Моніторинг цін

Витягує ціну/наявність/продавця/рейтинг зі сторінок товарів через їхню публічну JSON-LD розмітку (schema.org `Product`), без API-ключів і логіну.

## Як користуватись

```bash
npm run monitor
# або
node monitor.js --watchlist
```

Товари для стеження — у [watchlist.json](watchlist.json) (масив `{ "label", "url" }`). Результати друкуються в консоль і дописуються в [price-history.json](price-history.json) з таймстемпом — так накопичується історія цін і видно зміни між замірами.

Разові перевірки без watchlist:

```bash
node monitor.js <url1> <url2> ...
node monitor.js --file urls.txt
```

## Що перевірено і працює

- **Prom.ua** — працює повністю (ціна, наявність, продавець, рейтинг/відгуки)
- **Rozetka.com.ua** — блокує прості HTTP-запити (403), потрібен ручний перегляд через браузер; сюди автоматизацію свідомо не тягнемо (їхній `robots.txt` явно забороняє ботів)

## Важливо

- Не використовувати для товарів, які видають себе за чужий бренд за ціною, що на порядок нижча за оригінал (типова ознака контрафакту) — на Prom.ua це трапляється часто, особливо під запитами "Apple", "AirPods", "Samsung" тощо
- Затримка 800мс між запитами — не наростити навантаження на чужий сервер

## Supabase (опційно)

Якщо в `.env` (скопіювати з `.env.example`) є `SUPABASE_URL` і `SUPABASE_SERVICE_KEY`, кожен замір додатково пишеться в схему `market` (таблиці `products`, `price_snapshots`). Без `.env` скрипт працює як раніше — тільки `price-history.json`.

Перед першим запуском із Supabase:

1. Supabase Dashboard → проєкт **LSMD** → Settings → API → Data API Settings → Exposed schemas → додати `market` → Save (без цього кроку PostgREST відповідає `PGRST106 Invalid schema: market`)
2. Скопіювати **service_role** ключ (не anon/publishable!) із Settings → API в `.env` як `SUPABASE_SERVICE_KEY`
3. `.env` вже в `.gitignore` — ніколи не комітити

## MyDrop — дропшипінг без складу

[MyDrop](https://mydrop.com.ua/) — українська дропшип-CRM з реальним API для ролі "дропшипер": каталог постачальників з гуртовими (не роздрібними) цінами + створення й подача замовлення постачальнику програмно, без ручного чекауту чи бота.

Клієнт — [mydrop.js](mydrop.js), тестовий прогін — [test-mydrop.js](test-mydrop.js) (`npm run test:mydrop`). Без `MYDROP_API_KEY` в `.env` скрипт просто друкує структуру запитів на мок-даних (dry-run); з ключем — реально тягне підключених постачальників і їхній каталог.

## Вітрина «Форпост»

Статичний сайт із каталогом і формою замовлення, `web/` — окремий проєкт для Vercel (своя `web/vercel.json`).

- [web/index.html](web/index.html) — сторінка «Форпост — товари напряму зі складу».
- [web/catalog.json](web/catalog.json) — каталог для фіду й `prom-orders.js` (сам `index.html` має свою вбудовану копію): 2 категорії («Одяг та взуття» — постачальник BEZET, 4 товари; «Автономна енергія та побут» — Товарний Синдикат, 6 товарів); у кожного товару `sku`, назва, ціна, залишок, фото з MyDrop.
- [web/api/order.js](web/api/order.js) — приймає замовлення з форми: зберігає в Supabase (`market.orders`) і створює **чернетку** замовлення в MyDrop (`submitted: false`, постачальник її ще не бачить — власник подає вручну з кабінету MyDrop).
- [web/api/feed.js](web/api/feed.js) — YML-фід каталогу для імпорту в Prom.ua за посиланням (`SITE_URL` — адреса сайту, за замовчуванням заглушка `https://forpost.example`).

Локальний перегляд:

```bash
node dev-server.js    # http://localhost:3000, віддає web/ і виконує web/api/* як Vercel
```

## Замовлення з Prom.ua → MyDrop

[prom-orders.js](prom-orders.js) бере замовлення з Prom.ua, знаходить за `sku` постачальника в `web/catalog.json`, створює чернетку в MyDrop і ставить у Prom статус «Прийнято».

```bash
node prom-orders.js            # перегляд: що було б зроблено, нічого не змінює
node prom-orders.js --apply    # створює чернетки в MyDrop і ставить статус у Prom
```

Оброблені замовлення запам'ятовуються в `prom-orders-state.json` (у `.gitignore`), щоб не дублювати. Потрібен `PROM_API_TOKEN` у `.env`.

## Змінні середовища

Назви беруться з коду; значення живуть лише в `.env` / `.env.local` (обидва не комітити).

| Змінна | Для чого |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | запис замовлень і заміри цін |
| `MYDROP_API_KEY` | клієнт MyDrop |
| `PROM_API_TOKEN` | `prom-orders.js` |
| `SITE_URL` | адреса сайту для YML-фіду |
| `PORT` | порт `dev-server.js` (за замовчуванням 3000) |

У `.env.example` поки є лише Supabase і MyDrop; `PROM_API_TOKEN` і `SITE_URL` варто додати.

## Що не перевірено

- Чи зареєстрований акаунт дропшипера, чи підключений постачальник і чи є справжній `MYDROP_API_KEY` — залежить від вашого `.env`, у README не фіксується.
- Для Supabase вище названо проєкт **LSMD**; поточна база в роботі — `nobodyjul`. Перевірте, в якому проєкті справді створена схема `market`.
- Каталог у `web/index.html` зашитий прямо в код (`const CATALOG = [...]`), а не читається з `web/catalog.json`. `catalog.json` використовують `web/api/feed.js` і `prom-orders.js`, тож дві копії каталогу можуть розійтися — при зміні товарів правте обидві. Автоматичного оновлення цін/залишків із MyDrop у каталог поки немає.
