-- Схема market для вітрини «Форпост»: замовлення (з оплатою mono pay) і моніторинг цін.
-- Доступ лише для service_role (ключ тільки на сервері), RLS увімкнено без політик.
create schema if not exists market;

create table if not exists market.orders (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  category text,
  sku text,
  product_name text not null,
  unit_price numeric not null,
  qty integer not null check (qty > 0),
  total numeric not null,
  customer_name text not null,
  phone text not null,
  city text not null,
  note text,
  status text not null default 'new',
  payment_status text not null default 'pending',
  invoice_id text,
  paid_at timestamptz,
  mydrop_order_id text,
  mydrop_error text
);
create index if not exists orders_invoice_id_idx on market.orders (invoice_id);

create table if not exists market.products (
  id bigint generated always as identity primary key,
  url text not null unique,
  label text,
  name text,
  sku text,
  created_at timestamptz not null default now()
);

create table if not exists market.price_snapshots (
  id bigint generated always as identity primary key,
  product_id bigint not null references market.products (id) on delete cascade,
  price numeric,
  old_price numeric,
  currency text,
  availability text,
  seller text,
  rating numeric,
  review_count integer,
  checked_at timestamptz not null default now()
);
create index if not exists price_snapshots_product_idx on market.price_snapshots (product_id, checked_at desc);

alter table market.orders enable row level security;
alter table market.products enable row level security;
alter table market.price_snapshots enable row level security;

grant usage on schema market to service_role;
grant all on all tables in schema market to service_role;
grant all on all sequences in schema market to service_role;
