-- Відгуки покупців (модерація: approved = false до схвалення), email у замовленні, запит на відгук і його розклад.
create table if not exists market.reviews (
  id bigint generated always as identity primary key,
  order_id bigint not null unique references market.orders (id),
  product_id text,
  rating integer not null check (rating between 1 and 5),
  name text not null,
  text text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reviews_product on market.reviews (product_id) where approved;
alter table market.reviews enable row level security;
grant select, insert, update, delete on market.reviews to service_role;
grant usage, select on all sequences in schema market to service_role;

alter table market.orders add column if not exists review_requested_at timestamptz;
alter table market.orders add column if not exists email text;

create or replace function market.run_review_requests()
returns bigint language plpgsql security definer set search_path = '' as $$
declare secret text; req_id bigint;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'price_watch_secret';
  select net.http_get(url := 'https://forpost-shop.vercel.app/api/cron/review-requests',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret), timeout_milliseconds := 120000) into req_id;
  return req_id;
end; $$;
revoke all on function market.run_review_requests() from public, anon, authenticated;
select cron.schedule('review-requests-daily', '0 7 * * *', 'select market.run_review_requests();');
