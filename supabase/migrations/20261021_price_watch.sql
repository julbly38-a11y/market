-- Моніторинг цін: останній знімок закупівельної ціни/залишку по товару, журнал змін і ціни конкурентів.
create table if not exists market.supplier_prices (
  product_id text primary key,            -- "<id постачальника>-<id товару>"
  price numeric not null,
  stock integer not null,
  checked_at timestamptz not null default now()
);

create table if not exists market.price_changes (
  id bigint generated always as identity primary key,
  product_id text not null,
  title text,
  old_price numeric,
  new_price numeric,
  old_stock integer,
  new_stock integer,
  changed_at timestamptz not null default now()
);
create index if not exists price_changes_changed_at on market.price_changes (changed_at desc);

create table if not exists market.competitor_prices (
  id bigint generated always as identity primary key,
  product_id text not null,               -- наш товар
  url text not null,
  seller text,
  price numeric,
  availability text,
  our_price numeric,                      -- наша роздрібна ціна на момент заміру
  checked_at timestamptz not null default now()
);
create index if not exists competitor_prices_product on market.competitor_prices (product_id, checked_at desc);

alter table market.supplier_prices enable row level security;
alter table market.price_changes enable row level security;
alter table market.competitor_prices enable row level security;

grant select, insert, update, delete on market.supplier_prices, market.price_changes, market.competitor_prices to service_role;
grant usage, select on all sequences in schema market to service_role;
alter table market.supplier_prices add column if not exists title text;
alter table market.supplier_prices add column if not exists drop_price numeric;
