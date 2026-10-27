-- Чи подано замовлення постачальнику в MyDrop (автоподачею або вручну). Потрібно сторінці статусу для покупця.
alter table market.orders add column if not exists mydrop_submitted boolean not null default false;
