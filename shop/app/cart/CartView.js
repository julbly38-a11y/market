'use client';

import { useEffect, useState } from 'react';
import { OrderForm, money } from '../OrderForm';
import { onCartChange, readCart, removeFromCart, removeMany, setQty } from '../cartStore';

const REASON = {
  unknown_product: 'Товар не знайдено',
  no_cost: 'Тимчасово недоступний',
  bad_size: 'Цього розміру більше немає',
  out_of_stock: 'Немає в наявності',
  qty_over: 'Стільки в наявності немає',
  price_unavailable: 'Не вдалося уточнити ціну, оновіть сторінку',
};

// Кошик: товари автоматично розкладені по постачальниках. Кожна група це окрема посилка й окреме замовлення.
export default function CartView() {
  const [items, setItems] = useState(null);
  const [groups, setGroups] = useState([]);
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState(null);

  useEffect(() => {
    const upd = () => setItems(readCart());
    upd();
    return onCartChange(upd);
  }, []);

  useEffect(() => {
    if (items === null) return;
    if (!items.length) return setGroups([]);
    let off = false;
    setBusy(true);
    fetch('/api/cart/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) })
      .then((r) => r.json())
      .then((j) => !off && setGroups(j.groups || []))
      .catch(() => !off && setGroups([]))
      .finally(() => !off && setBusy(false));
    return () => { off = true; };
  }, [items]);

  if (items === null) return <p className="dim">Завантажуємо кошик…</p>;
  if (!items.length) return <p>Кошик порожній. <a href="/">До каталогу</a></p>;

  return (
    <>
      {groups.length > 1 && (
        <p className="dim">Товари від різних постачальників їдуть окремими посилками, тому оформлюються окремо: по одній групі за раз.</p>
      )}
      {groups.map((g) => (
        <section key={g.vendor} className="cart-group">
          <h2>Посилка від {g.vendor}</h2>
          {g.items.map((i) => (
            <div key={`${i.id}|${i.size}`} className={`cart-row${i.ok ? '' : ' bad'}`}>
              {i.image ? <img src={i.image} alt="" width="64" height="64" /> : <span className="cart-ph" />}
              <div className="cart-info">
                <a href={`/p/${i.id}`}>{i.title}</a>
                {i.size && <span className="dim"> · розмір {i.size}</span>}
                {!i.ok && <div className="err">{REASON[i.reason] || 'Недоступно'}</div>}
              </div>
              <div className="stepper">
                <button type="button" onClick={() => setQty(i.id, i.size, i.qty - 1)} disabled={i.qty <= 1} aria-label="Менше">−</button>
                <span>{i.qty}</span>
                <button type="button" onClick={() => setQty(i.id, i.size, i.qty + 1)} disabled={i.ok && i.qty >= i.max} aria-label="Більше">+</button>
              </div>
              <b className="cart-sum">{i.ok ? `${money.format(i.price * i.qty)} ₴` : '—'}</b>
              <button type="button" className="cart-del" onClick={() => removeFromCart(i.id, i.size)} aria-label="Видалити">×</button>
            </div>
          ))}
          <div className="cart-foot">
            <div>
              <b>Разом: {money.format(g.total)} ₴</b>
              {g.short > 0 && <div className="err">Мінімальна сума замовлення {money.format(g.min)} ₴. Не вистачає {money.format(g.short)} ₴: додайте ще товарів цього постачальника.</div>}
            </div>
            <button className="buy" disabled={!g.canCheckout || busy} onClick={() => setCheckout(g)}>Оформити цю посилку</button>
          </div>
        </section>
      ))}
      {checkout && (
        <OrderForm
          product={{ id: `cart-${checkout.vendor}`, title: `Замовлення: ${checkout.vendor}`, vendor: checkout.vendor, price: checkout.total, stock: 1, sizes: [] }}
          extra={{ cartItems: checkout.items.map((i) => ({ productId: i.id, size: i.size, qty: i.qty })) }}
          onClose={() => setCheckout(null)}
          onDone={() => removeMany(checkout.items)}
        />
      )}
    </>
  );
}
