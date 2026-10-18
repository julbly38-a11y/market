'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { GROUPS } from '../lib/groups';
import { OrderForm, money } from './OrderForm';

const PAGE = 48;

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
    return [...new Set(pool.map((p) => p.category.trim()))].sort((a, b) => a.localeCompare(b, 'uk'));
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
          (category === 'all' || p.category.trim() === category) &&
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
  const pickGroup = (g) => {
    setGroup(g);
    setCategory('all');
    setLimit(PAGE);
  };

  return (
    <>
      <div className="chips" role="tablist" aria-label="Типи товарів">
        <button className={`chip${group === 'all' ? ' on' : ''}`} onClick={() => pickGroup('all')}>
          Усі товари <em>{money.format(products.length)}</em>
        </button>
        {GROUPS.filter((g) => groupCounts.has(g)).map((g) => (
          <button key={g} className={`chip${group === g ? ' on' : ''}`} onClick={() => pickGroup(g)}>
            {g} <em>{groupCounts.get(g)}</em>
          </button>
        ))}
      </div>

      <section className="filters">
        <input type="search" placeholder="Пошук за назвою або артикулом" value={q} onChange={reset(setQ)} aria-label="Пошук" />
        <select value={vendor} onChange={(e) => { setVendor(e.target.value); setCategory('all'); setLimit(PAGE); }} aria-label="Постачальник">
          <option value="all">Усі постачальники</option>
          {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={category} onChange={reset(setCategory)} aria-label="Підкатегорія">
          <option value="all">Усі підкатегорії</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={sort} onChange={reset(setSort)} aria-label="Сортування">
          <option value="category">За типами товарів</option>
          <option value="price_asc">Ціна: від дешевих</option>
          <option value="price_desc">Ціна: від дорогих</option>
        </select>
        <label className="check">
          <input type="checkbox" checked={inStock} onChange={reset(setInStock)} /> Лише в наявності
        </label>
      </section>

      <p className="count">{money.format(filtered.length)} {filtered.length === 1 ? 'товар' : 'товарів'}</p>

      <section className="grid">
        {filtered.length === 0 && <p className="empty">Нічого не знайдено. Спробуйте змінити пошук або фільтри.</p>}
        {filtered.slice(0, limit).map((p, i, list) => (
          <Fragment key={p.id}>
            {sort === 'category' && group === 'all' && (i === 0 || list[i - 1].group !== p.group) && <h3 className="cat-head">{p.group}</h3>}
            <article className="card">
              <a className="media" href={`/p/${p.id}`} aria-label={p.title}>
                <img src={p.image} alt="" loading="lazy" />
                {p.stock < 1 && <span className="badge">Немає в наявності</span>}
              </a>
              <div className="body">
                <div className="vendor">{p.category.trim()}</div>
                <h2><a href={`/p/${p.id}`}>{p.title}</a></h2>
                <div className="foot">
                  <span className="price">{money.format(p.price)} ₴</span>
                  <span className={p.stock > 0 ? 'stock ok' : 'stock'}>{p.stock > 0 ? 'в наявності' : 'немає'}</span>
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
