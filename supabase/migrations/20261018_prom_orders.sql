-- Замовлення з Prom.ua: джерело, ідентифікатор у Prom (унікальний, захист від дублів) і закупівельна ціна.
alter table market.orders add column if not exists source text not null default 'site';
alter table market.orders add column if not exists prom_order_id text;
alter table market.orders add column if not exists supplier_price numeric;
create unique index if not exists orders_prom_order_id_uniq on market.orders (prom_order_id) where prom_order_id is not null;
