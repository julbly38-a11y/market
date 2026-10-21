-- Набори (комплекти) одягу: один слот = один стовпець з id товару з каталогу (market/products.json), усі від одного постачальника.
create table if not exists market.sets (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  title text not null,
  slug text unique,
  description text,
  active boolean not null default true,
  vendor text,
  discount_percent numeric not null default 0,
  boots_id text,
  pants_id text,
  top_id text,
  headwear_id text,
  gloves_id text,
  armor_id text
);
alter table market.sets enable row level security;
grant select, insert, update, delete on market.sets to service_role;
grant usage, select on all sequences in schema market to service_role;
