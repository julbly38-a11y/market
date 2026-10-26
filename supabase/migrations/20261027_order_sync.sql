-- Синхронізація статусу замовлення з MyDrop: ТТН, статус постачальника, статус доставки.
alter table market.orders add column if not exists mydrop_status text;
alter table market.orders add column if not exists delivery_status text;
alter table market.orders add column if not exists ttn_notified_at timestamptz;

create or replace function market.run_order_sync()
returns bigint language plpgsql security definer set search_path = '' as $$
declare secret text; req_id bigint;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'price_watch_secret';
  select net.http_get(url := 'https://forpost-shop.com/api/cron/order-sync',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret), timeout_milliseconds := 120000) into req_id;
  return req_id;
end; $$;
revoke all on function market.run_order_sync() from public, anon, authenticated;

select cron.schedule('order-sync', '*/30 * * * *', 'select market.run_order_sync();');
