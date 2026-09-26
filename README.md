# market

Моніторинг цін для дропшипінгу: витягує ціну/наявність/продавця/рейтинг зі сторінок товарів через їхню публічну JSON-LD розмітку (schema.org `Product`), без API-ключів і логіну.

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
