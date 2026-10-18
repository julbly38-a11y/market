'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { GROUPS } from '../lib/groups';

const PAGE = 48;
const money = new Intl.NumberFormat('uk-UA');

export default function Catalog({ products, vendors }) {
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState('all');
  const [group, setGroup] = useState('all');
  const [category, setCategory] = useState('all');
  const [inStock, setInStock] = useState(true);
  const [sort, setSort] = useState('category');
  const [limit, setLimit] = useState(PAGE);
  const [order, setOrder] = useState(null);

  const categories = useMemo(() => {
    const pool = products.filter((p) => (vendor === 'all' || p.vendor === vendor) && (group === 'all' || p.group === group));
    return [...new Set(pool.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'uk'));
  }, [products, vendor, group]);

  const groupCounts = useMemo(() => {
    const m = new Map();
    for (const p of products) m.set(p.group, (m.get(p.group) || 0) + 1);
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products
      .filter(
        (p) =>
          (vendor === 'all' || p.vendor === vendor) &&
          (group === 'all' || p.group === group) &&
          (category === 'all' || p.category === category) &&
          (!inStock || p.stock > 0) &&
          (!needle || p.title.toLowerCase().includes(needle) || String(p.sku).toLowerCase().includes(needle))
      )
      .sort((a, b) => {
        if (sort === 'price_asc') return a.price - b.price || a.title.localeCompare(b.title, 'uk');
        if (sort === 'price_desc') return b.price - a.price || a.title.localeCompare(b.title, 'uk');
        // за замовчуванням: по групах (типах товарів) у заданому порядку, далі категорія і назва
        return (
          GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) ||
          a.category.localeCompare(b.category, 'uk') ||
          a.title.localeCompare(b.title, 'uk')
        );
      });
  }, [products, q, vendor, group, category, inStock, sort]);

  const reset = (fn) => (e) => {
    fn(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
    setLimit(PAGE);
  };

  return (
    <>
      <section className="filters">
        <input type="search" placeholder="Пошук за назвою або артикулом" value={q} onChange={reset(setQ)} />
        <select value={group} onChange={(e) => { setGroup(e.target.value); setCategory('all'); setLimit(PAGE); }}>
          <option value="all">Усі типи товарів</option>
          {GROUPS.filter((g) => groupCounts.has(g)).map((g) => <option key={g} value={g}>{g} ({groupCounts.get(g)})</option>)}
        </select>
        <select value={vendor} onChange={(e) => { setVendor(e.target.value); setCategory('all'); setLimit(PAGE); }}>
          <option value="all">Усі постачальники</option>
          {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={category} onChange={reset(setCategory)}>
          <option value="all">Усі підкатегорії</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={reset(setSort)}>
          <option value="category">За типами товарів</option>
          <option value="price_asc">Ціна: від дешевих</option>
          <option value="price_desc">Ціна: від дорогих</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={inStock} onChange={reset(setInStock)} /> Лише в наявності
        </label>
      </section>

      <p className="count">Знайдено: {money.format(filtered.length)}</p>

      <section className="grid">
        {filtered.slice(0, limit).map((p, i, list) => (
          <Fragment key={p.id}>
          {sort === 'category' && (i === 0 || list[i - 1].group !== p.group) && <h3 className="cat-head">{p.group}</h3>}
          <article className="card">
            <div className="media">
              <img src={p.image} alt={p.title} loading="lazy" />
            </div>
            <div className="body">
              <div className="vendor">{p.vendor} · {p.category}</div>
              <h2>{p.title}</h2>
              <div className="sku">Арт. {p.sku}</div>
              <div className="foot">
                <span className="price">{money.format(p.price)} ₴</span>
                <span className={p.stock > 0 ? 'stock ok' : 'stock'}>{p.stock > 0 ? `в наявності: ${p.stock}` : 'немає'}</span>
              </div>
              <button className="buy" disabled={p.stock < 1} onClick={() => setOrder(p)}>Замовити</button>
            </div>
          </article>
          </Fragment>
        ))}
      </section>

      <PaidNotice />

      {order && <OrderForm product={order} onClose={() => setOrder(null)} />}

      {limit < filtered.length && (
        <div className="more">
          <button onClick={() => setLimit(limit + PAGE)}>Показати ще</button>
        </div>
      )}
    </>
  );
}

function OrderForm({ product, onClose }) {
  const [f, setF] = useState({ name: '', phone: '+380', city: '', warehouse: '', qty: 1, note: '', website: '' });
  const [state, setState] = useState({ busy: false, error: '', done: null });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const ERR = {
    bad_name: 'Вкажіть ПІБ повністю',
    bad_phone: 'Невірний номер телефону',
    bad_city: 'Вкажіть місто',
    bad_warehouse: 'Номер відділення Нової пошти — лише цифри',
    bad_qty: 'Невірна кількість',
    unknown_product: 'Товар не знайдено',
    not_saved: 'Не вдалося зберегти замовлення, спробуйте ще раз',
    payment_unavailable: 'Оплата тимчасово недоступна, спробуйте пізніше',
  };

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, error: '', done: null });
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, qty: Number(f.qty), productId: product.id }),
      });
      const json = await res.json();
      if (!json.ok || !json.paymentUrl) throw new Error(ERR[json.error] || 'Помилка, спробуйте ще раз');
      window.location.href = json.paymentUrl; // оплата карткою на сторінці mono pay
      setState({ busy: true, error: '', done: null });
    } catch (err) {
      setState({ busy: false, error: err.message, done: null });
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {state.done ? (
          <>
            <h3>Замовлення прийнято</h3>
            <p>Номер: <b>{state.done.orderId}</b>. Ми зв'яжемось для підтвердження.</p>
            <button className="buy" onClick={onClose}>Закрити</button>
          </>
        ) : (
          <form onSubmit={submit}>
            <h3>{product.title}</h3>
            <p className="dim">{money.format(product.price * f.qty)} ₴ · {product.vendor}</p>
            <input required placeholder="ПІБ" value={f.name} onChange={set('name')} />
            <input required placeholder="Телефон" value={f.phone} onChange={set('phone')} inputMode="tel" />
            <input required placeholder="Місто" value={f.city} onChange={set('city')} />
            <input required placeholder="№ відділення Нової пошти" value={f.warehouse} onChange={set('warehouse')} inputMode="numeric" />
            <input required type="number" min="1" max={Math.max(product.stock, 1)} value={f.qty} onChange={set('qty')} />
            <input placeholder="Коментар (необов'язково)" value={f.note} onChange={set('note')} />
            <input className="hp" tabIndex="-1" autoComplete="off" name="website" value={f.website} onChange={set('website')} aria-hidden="true" />
            <p className="dim">Натискаючи кнопку, ви погоджуєтесь з <a href="/oferta" target="_blank">офертою</a>.</p>
            {state.error && <p className="err">{state.error}</p>}
            <div className="row">
              <button type="button" className="ghost" onClick={onClose}>Скасувати</button>
              <button className="buy" disabled={state.busy}>{state.busy ? 'Переходимо до оплати…' : 'Оплатити карткою'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// Після повернення з mono pay (?order=<id>) показуємо подяку. Чи пройшла оплата — підтверджує вебхук.
function PaidNotice() {
  const [id, setId] = useState(null);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get('order');
    if (v) {
      setId(v);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);
  if (!id) return null;
  return (
    <div className="overlay" onClick={() => setId(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Дякуємо за замовлення</h3>
        <p>Номер: <b>{id}</b>. Якщо оплата пройшла, ми передамо замовлення на відправку і зв'яжемось з вами.</p>
        <button className="buy" onClick={() => setId(null)}>Закрити</button>
      </div>
    </div>
  );
}
