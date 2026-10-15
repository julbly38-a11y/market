-- Оплата mono pay: статус оплати, id рахунку, час оплати.
alter table market.orders
  add column if not exists payment_status text not null default 'pending',
  add column if not exists invoice_id text,
  add column if not exists paid_at timestamptz;

create index if not exists orders_invoice_id_idx on market.orders (invoice_id);
