'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { GROUPS, typeRank } from '../lib/groups';
import { money } from './OrderForm';

const PAGE = 48;

export default function Catalog({ products, vendors }) {
  const [q, setQ] = useState('');
  const [vendor, setVendor] = useState('all');
  const [group, setGroup] = useState('all');
  const [category, setCategory] = useState('all');
  const [inStock, setInStock] = useState(true);
  const [sort, setSort] = useState('category');
  const [minP, setMinP] = useState('');
  const [maxP, setMaxP] = useState('');
  const [limit, setLimit] = useState(PAGE);

  const categories = useMemo(() => {
    const pool = products.filter((p) => (vendor === 'all' || p.vendor === vendor) && (group === 'all' || p.group === group));
    const counts = new Map();
    for (const p of pool) counts.set(p.type, (counts.get(p.type) || 0) + 1);
    return [...counts]
      .sort((a, b) => typeRank(group, a[0]) - typeRank(group, b[0]) || b[1] - a[1] || a[0].localeCompare(b[0], 'uk'))
      .map(([name, count]) => ({ name, count }));
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
          (category === 'all' || p.type === category) &&
          (!inStock || p.stock > 0) &&
          (!minP || p.price >= Number(minP)) &&
          (!maxP || p.price <= Number(maxP)) &&
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
  }, [products, q, vendor, group, category, inStock, sort, minP, maxP]);

  const reset = (fn) => (e) => {
    fn(e.target.type === 'checkbox' ? e.target.checked : e.target.value);
    setLimit(PAGE);
  };
  const pickGroup = (g) => {
    setGroup(g);
    setCategory('all');
    setLimit(PAGE);
  };

  // ?g=<тип товарів> з меню шапки
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const g = sp.get('g');
    if (g && GROUPS.includes(g)) {
      setGroup(g);
      const c = sp.get('c');
      setCategory(c && products.some((p) => p.group === g && p.type === c) ? c : 'all');
    }
  }, []);

  const groupBtn = (g, label, n) => (
    <Fragment key={g}>
      <button className={`side-link${group === g && category === 'all' ? ' on' : group === g ? ' open' : ''}`} onClick={() => pickGroup(g)}>
        <span>{label}</span>
        <em>{n}</em>
      </button>
      {group === g && g !== 'all' && categories.length > 1 && (
        <div className="side-sub">
          {categories.map((c) => (
            <button key={c.name} className={`side-sub-link${category === c.name ? ' on' : ''}`} onClick={() => { setCategory(c.name); setLimit(PAGE); }}>
              <span>{c.name}</span>
              <em>{c.count}</em>
            </button>
          ))}
        </div>
      )}
    </Fragment>
  );

  return (
    <>
      <div id="catalog" className="shop">
        <aside className="side">
          <h2 className="side-title">Категорії</h2>
          <nav className="side-groups" aria-label="Типи товарів">
            {groupBtn('all', 'Усі товари', money.format(products.length))}
            {GROUPS.filter((g) => groupCounts.has(g)).map((g) => groupBtn(g, g, groupCounts.get(g)))}
          </nav>

          <h2 className="side-title">Фільтри</h2>
          <section className="filters">
            <input type="search" placeholder="Пошук за назвою або артикулом" value={q} onChange={reset(setQ)} aria-label="Пошук" />
            <select value={vendor} onChange={(e) => { setVendor(e.target.value); setCategory('all'); setLimit(PAGE); }} aria-label="Постачальник">
              <option value="all">Усі постачальники</option>
              {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
            <select className="sel-type" value={category} onChange={reset(setCategory)} aria-label="Тип товару">
              <option value="all">Усі типи товарів</option>
              {categories.map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
            </select>
            <div className="price-range">
              <input type="number" min="0" inputMode="numeric" placeholder="Ціна від" value={minP} onChange={reset(setMinP)} aria-label="Ціна від" />
              <input type="number" min="0" inputMode="numeric" placeholder="до" value={maxP} onChange={reset(setMaxP)} aria-label="Ціна до" />
            </div>
            <label className="check">
              <input type="checkbox" checked={inStock} onChange={reset(setInStock)} /> Лише в наявності
            </label>
          </section>
        </aside>

        <div className="results">
          <div className="chips" role="tablist" aria-label="Типи товарів">
            <button className={`chip${group === 'all' ? ' on' : ''}`} onClick={() => pickGroup('all')}>
              Усі <em>{money.format(products.length)}</em>
            </button>
            {GROUPS.filter((g) => groupCounts.has(g)).map((g) => (
              <button key={g} className={`chip${group === g ? ' on' : ''}`} onClick={() => pickGroup(g)}>
                {g} <em>{groupCounts.get(g)}</em>
              </button>
            ))}
          </div>

          <div className="toolbar">
            <p className="count">Товарів: {money.format(filtered.length)}</p>
            <label className="sort">
              <span>Сортування</span>
              <select value={sort} onChange={reset(setSort)} aria-label="Сортування">
                <option value="category">За типами товарів</option>
                <option value="price_asc">Ціна: від дешевих</option>
                <option value="price_desc">Ціна: від дорогих</option>
              </select>
            </label>
          </div>

          <section className="grid">
            {filtered.length === 0 && <p className="empty">Нічого не знайдено. Спробуйте змінити пошук або фільтри.</p>}
            {filtered.slice(0, limit).map((p, i, list) => (
              <Fragment key={p.id}>
                {sort === 'category' && group === 'all' && (i === 0 || list[i - 1].group !== p.group) && <h3 className="cat-head">{p.group}</h3>}
                <article className="card">
                  <a className="media" href={`/p/${p.id}`} aria-label={p.title}>
                    <img src={p.image} alt="" loading="lazy" />
                    {p.stock < 1 && <span className="tag out">&gt; Немає в наявності</span>}
                    {p.stock > 0 && p.stock <= 3 && <span className="tag">&gt; Залишилось {p.stock}</span>}
                  </a>
                  <div className="body">
                    <h2><a href={`/p/${p.id}`}>{p.title}</a></h2>
                    <div className="vendor">{p.type}</div>
                    <div className="price">{money.format(p.price)} ₴</div>
                  </div>
                </article>
              </Fragment>
            ))}
          </section>

          {limit < filtered.length && (
            <div className="more">
              <button onClick={() => setLimit(limit + PAGE)}>Показати ще</button>
            </div>
          )}
        </div>
      </div>

      <PaidNotice />
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
