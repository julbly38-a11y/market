'use client';

import { useState } from 'react';

export const money = new Intl.NumberFormat('uk-UA');

const ERR = {
  bad_name: 'Вкажіть ПІБ повністю',
  bad_phone: 'Невірний номер телефону',
  bad_city: 'Вкажіть місто',
  bad_warehouse: 'Номер відділення Нової пошти — лише цифри',
  bad_qty: 'Невірна кількість',
  unknown_product: 'Товар не знайдено',
  price_unavailable: 'Не вдалося уточнити ціну в постачальника, спробуйте ще раз за хвилину',
  not_saved: 'Не вдалося зберегти замовлення, спробуйте ще раз',
  payment_unavailable: 'Оплата тимчасово недоступна, спробуйте пізніше',
};

// Форма замовлення: у модальному вікні (швидке замовлення з каталогу) або вбудована на сторінці товару.
export function OrderForm({ product, inline = false, onClose }) {
  const [f, setF] = useState({ name: '', phone: '+380', city: '', warehouse: '', qty: 1, note: '', website: '' });
  const [state, setState] = useState({ busy: false, error: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const max = Math.max(product.stock, 1);
  const step = (d) => setF((x) => ({ ...x, qty: Math.min(max, Math.max(1, Number(x.qty) + d)) }));

  async function submit(e) {
    e.preventDefault();
    setState({ busy: true, error: '' });
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, qty: Number(f.qty), productId: product.id }),
      });
      const json = await res.json();
      if (!json.ok || !json.paymentUrl) throw new Error(ERR[json.error] || 'Помилка, спробуйте ще раз');
      window.location.href = json.paymentUrl; // оплата карткою на сторінці mono pay
      setState({ busy: true, error: '' });
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  }

  const form = (
    <form className="order" onSubmit={submit}>
      {!inline && (
        <div>
          <h3>{product.title}</h3>
          <p className="dim">{product.vendor}</p>
        </div>
      )}
      <div className="sum">
        <span>До сплати</span>
        <b>{money.format(product.price * f.qty)} ₴</b>
      </div>
      <div className="field">
        <label htmlFor={`n-${product.id}`}>ПІБ отримувача</label>
        <input id={`n-${product.id}`} required autoComplete="name" placeholder="Прізвище Імʼя" value={f.name} onChange={set('name')} />
      </div>
      <div className="field">
        <label htmlFor={`p-${product.id}`}>Телефон</label>
        <input id={`p-${product.id}`} required autoComplete="tel" inputMode="tel" value={f.phone} onChange={set('phone')} />
      </div>
      <div className="two">
        <div className="field">
          <label htmlFor={`c-${product.id}`}>Місто</label>
          <input id={`c-${product.id}`} required autoComplete="address-level2" value={f.city} onChange={set('city')} />
        </div>
        <div className="field">
          <label htmlFor={`w-${product.id}`}>Відділення НП №</label>
          <input id={`w-${product.id}`} required inputMode="numeric" value={f.warehouse} onChange={set('warehouse')} />
        </div>
      </div>
      <div className="field">
        <label>Кількість</label>
        <div className="stepper">
          <button type="button" onClick={() => step(-1)} disabled={f.qty <= 1} aria-label="Менше">−</button>
          <span>{f.qty}</span>
          <button type="button" onClick={() => step(1)} disabled={f.qty >= max} aria-label="Більше">+</button>
        </div>
      </div>
      <div className="field">
        <label htmlFor={`m-${product.id}`}>Коментар</label>
        <input id={`m-${product.id}`} placeholder="Необовʼязково" value={f.note} onChange={set('note')} />
      </div>
      <input className="hp" tabIndex="-1" autoComplete="off" name="website" value={f.website} onChange={set('website')} aria-hidden="true" />
      <p className="fine">Натискаючи кнопку, ви погоджуєтесь з <a href="/oferta" target="_blank">офертою</a>.</p>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {inline ? (
        <button className="buy wide" disabled={state.busy || product.stock < 1}>
          {state.busy ? 'Переходимо до оплати…' : 'Оплатити карткою'}
        </button>
      ) : (
        <div className="row">
          <button type="button" className="ghost" onClick={onClose}>Скасувати</button>
          <button className="buy" disabled={state.busy}>{state.busy ? 'Переходимо до оплати…' : 'Оплатити карткою'}</button>
        </div>
      )}
    </form>
  );

  if (inline) return form;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {form}
      </div>
    </div>
  );
}
