-- Номер ТТН Нової Пошти: власник заповнює вручну, показується на сторінці статусу замовлення.
alter table market.orders add column if not exists ttn text;
