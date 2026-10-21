'use client';

import { useState } from 'react';
import { OrderForm, money } from '../../OrderForm';

// Сторінка набору: речі набору з вибором розміру кожної й форма замовлення на весь набір (одне замовлення).
export default function SetBuy({ slug, title, vendor, discount, fullPrice, total, saved, available, items }) {
  const [sizes, setSizes] = useState({});
  const missing = items.filter((i) => i.sizes.length && !sizes[i.slot]).map((i) => i.label);
  const stockOf = (i) => (i.sizes.length && sizes[i.slot] ? i.sizes.find((z) => z.title === sizes[i.slot])?.stock : i.stock);
  const short = items.filter((i) => (stockOf(i) ?? 0) < 1 && (!i.sizes.length || sizes[i.slot])).map((i) => i.label);

  return (
    <div className="set-layout">
      <div className="set-items">
        {items.map((i) => (
          <article key={i.slot} className="set-item">
            <a className="set-img" href={`/p/${i.id}`}><img src={i.image} alt={i.title} /></a>
            <div className="set-info">
              <span className="set-label">{i.label}</span>
              <a className="set-title" href={`/p/${i.id}`}>{i.title}</a>
              <span className="set-price">{money.format(i.price)} ₴</span>
              {i.sizes.length > 0 && (
                <div className="set-sizes" role="group" aria-label={`Розмір: ${i.label}`}>
                  {i.sizes.map((z) => (
                    <button key={z.title} type="button" disabled={z.stock < 1} className={`size${sizes[i.slot] === z.title ? ' on' : ''}`} onClick={() => setSizes({ ...sizes, [i.slot]: z.title })}>
                      {z.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="set-buy">
        <div className="p-card">
          <div className="set-total">
            {saved > 0 && <s>{money.format(fullPrice)} ₴</s>}
            <b>{money.format(total)} ₴</b>
            {discount > 0 && <span className="set-save">−{discount}% на набір, економія {money.format(saved)} ₴</span>}
          </div>
          <h2>Оформити набір</h2>
          {!available && <p className="err">Частини набору зараз немає в наявності.</p>}
          {short.length > 0 && <p className="err">Немає в наявності: {short.join(', ')}. Виберіть інший розмір.</p>}
          <OrderForm
            inline
            product={{ id: `set-${slug}`, title, price: total, stock: available ? 1 : 0, vendor, sizes: [] }}
            extra={{ setSlug: slug, setSizes: sizes }}
            blocked={!available ? 'Набір недоступний' : missing.length ? `Виберіть розмір: ${missing.join(', ')}` : short.length ? `Немає в наявності: ${short.join(', ')}` : ''}
          />
        </div>
      </div>
    </div>
  );
}
