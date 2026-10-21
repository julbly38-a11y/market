-- Щодобовий моніторинг цін: pg_cron викликає /api/cron/price-watch через pg_net.
-- Секрет лежить у Vault (name = price_watch_secret) і збігається зі змінною PRICE_WATCH_SECRET на Vercel.
-- Створити його: select vault.create_secret('<значення>', 'price_watch_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function market.run_price_watch()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  secret text;
  req_id bigint;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'price_watch_secret';
  select net.http_get(
    url := 'https://forpost-shop.vercel.app/api/cron/price-watch',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret),
    timeout_milliseconds := 300000
  ) into req_id;
  return req_id;
end;
$$;

revoke all on function market.run_price_watch() from public, anon, authenticated;

select cron.schedule('price-watch-daily', '30 5 * * *', 'select market.run_price_watch();');

-- Після підключення домену forpost-shop.com розклад викликає його (старий адрес vercel.app теж працює).
create or replace function market.run_price_watch()
returns bigint language plpgsql security definer set search_path = '' as $$
declare secret text; req_id bigint;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'price_watch_secret';
  select net.http_get(url := 'https://forpost-shop.com/api/cron/price-watch',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret), timeout_milliseconds := 300000) into req_id;
  return req_id;
end; $$;
