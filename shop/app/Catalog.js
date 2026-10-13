'use client';

import { useMemo, useState } from 'react';

const PAGE = 48;
const money = new Intl.NumberFormat('uk-UA');

export default function Catalog({ products, vendors }) {
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState('all');
  const [category, setCategory] = useState('all');
  const [inStock, setInStock] = useState(true);
  const [limit, setLimit] = useState(PAGE);

  const categories = useMemo(() => {
    const pool = vendor === 'all' ? products : products.filter((p) => p.vendor === vendor);
    return [...new Set(pool.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'uk'));
  }, [products, vendor]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return products.filter(
      (p) =>
        (vendor === 'all' || p.vendor === vendor) &&
        (category === 'all' || p.category === category) &&
        (!inStock || p.stock > 0) &&
        (!needle || p.title.toLowerCase().includes(needle) || String(p.sku).toLowerCase().includes(needle))
    );
  }, [products, q, vendor, category, inStock]);

  const reset = (fn) => (e) => {
    fn(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
    setLimit(PAGE);
  };

  return (
    <>
      <section className="filters">
        <input type="search" placeholder="Пошук за назвою або артикулом" value={q} onChange={reset(setQ)} />
        <select value={vendor} onChange={(e) => { setVendor(e.target.value); setCategory('all'); setLimit(PAGE); }}>
          <option value="all">Усі постачальники</option>
          {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={category} onChange={reset(setCategory)}>
          <option value="all">Усі категорії</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={inStock} onChange={reset(setInStock)} /> Лише в наявності
        </label>
      </section>

      <p className="count">Знайдено: {money.format(filtered.length)}</p>

      <section className="grid">
        {filtered.slice(0, limit).map((p) => (
          <article className="card" key={p.id}>
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
            </div>
          </article>
        ))}
      </section>

      {limit < filtered.length && (
        <div className="more">
          <button onClick={() => setLimit(limit + PAGE)}>Показати ще</button>
        </div>
      )}
    </>
  );
}
