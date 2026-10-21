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

-- Замовлення набору: список позицій (id, назва, артикул, розмір, ціна) і посилання на набір.
alter table market.orders add column if not exists items jsonb;
alter table market.orders add column if not exists set_id bigint;

-- Повні військові набори: ще слоти (ремінь, байка/базовий шар, куртка, окуляри) і набори BEZET.
alter table market.sets add column if not exists belt_id text;
alter table market.sets add column if not exists base_id text;
alter table market.sets add column if not exists jacket_id text;
alter table market.sets add column if not exists glasses_id text;

insert into market.sets (title, slug, description, vendor, discount_percent, boots_id, pants_id, belt_id, top_id, base_id, jacket_id, headwear_id, glasses_id, gloves_id) values
('BEZET Хакі: повний комплект', 'bezet-khaki-full', 'Черевики, карго-штани Ranger, ремінь, флісова кофта, термобілизна, куртка Quest, шапка, окуляри й рукавиці в кольорі хакі.', 'BEZET', 0,
  '519817-3798251', '519817-4178194', '519817-3208641', '519817-5416673', '519817-3855117', '519817-5456543', '519817-3855121', '519817-4139956', '519817-4239953'),
('BEZET Чорний: повний комплект', 'bezet-black-full', 'Черевики, карго-штани TactDry, ремінь, флісова кофта, термобілизна, куртка Quest, шапка, окуляри й рукавиці в чорному.', 'BEZET', 0,
  '519817-3798250', '519817-4444383', '519817-3208545', '519817-5416671', '519817-3855117', '519817-5456546', '519817-3855122', '519817-4139957', '519817-4239953'),
('BEZET Базовий: чорний', 'bezet-black-basic', 'Бюджетний комплект: штани TactDry, ремінь, флісова кофта Frostline, шапка й рукавиці.', 'BEZET', 0,
  null, '519817-4444383', '519817-3208545', '519817-4441676', null, null, '519817-3855122', null, '519817-3816209')
on conflict (slug) do nothing;
