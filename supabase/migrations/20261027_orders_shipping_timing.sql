-- Заміри строків відправки: постачальник, час подачі, час появи ТТН, мітка сповіщення про затримку.
alter table market.orders add column if not exists mydrop_vendor text;
alter table market.orders add column if not exists mydrop_submitted_at timestamptz;
alter table market.orders add column if not exists ttn_at timestamptz;
alter table market.orders add column if not exists delay_alerted_at timestamptz;
