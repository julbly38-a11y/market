'use client';

import { useEffect, useState } from 'react';

export const money = new Intl.NumberFormat('uk-UA');

const ERR = {
  bad_name: 'Вкажіть ПІБ повністю',
  bad_phone: 'Невірний номер телефону',
  bad_city: 'Виберіть місто зі списку',
  bad_warehouse: 'Виберіть відділення Нової пошти зі списку',
  bad_qty: 'Невірна кількість',
  bad_size: 'Виберіть розмір, який є в наявності',
  unknown_set: 'Набір не знайдено',
  set_out_of_stock: 'Частини набору зараз немає в наявності',
  cod_limit: 'Накладений платіж доступний для замовлень до 3000 ₴, оплатіть карткою',
  too_many: 'Забагато замовлень з цього номера, спробуйте пізніше',
  unknown_product: 'Товар не знайдено',
  price_unavailable: 'Не вдалося уточнити ціну в постачальника, спробуйте ще раз за хвилину',
  not_saved: 'Не вдалося зберегти замовлення, спробуйте ще раз',
  payment_unavailable: 'Оплата тимчасово недоступна, спробуйте пізніше',
};

// Форма замовлення: у модальному вікні (швидке замовлення з каталогу) або вбудована на сторінці товару.
export function OrderForm({ product, inline = false, onClose, extra = null, blocked = '' }) {
  const [f, setF] = useState({ name: '', phone: '+380', email: '', payment: 'card', city: '', warehouse: '', warehouseText: '', size: '', qty: 1, note: '', website: '' });
  const [state, setState] = useState({ busy: false, error: '' });
  const [cities, setCities] = useState([]); // підказки міст
  const [cityRef, setCityRef] = useState('');
  const [branches, setBranches] = useState([]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const sizes = product.sizes || [];
  const sizeStock = sizes.find((z) => z.title === f.size)?.stock;
  const max = Math.max(sizes.length && sizeStock != null ? sizeStock : product.stock, 1);
  const step = (d) => setF((x) => ({ ...x, qty: Math.min(max, Math.max(1, Number(x.qty) + d)) }));

  // Міста: підказки з довідника НП. Коли введений текст збігається з варіантом — фіксуємо місто.
  useEffect(() => {
    const q = f.city.trim();
    const hit = cities.find((c) => c.present === q);
    if (hit) {
      if (hit.ref !== cityRef) setCityRef(hit.ref);
      return;
    }
    if (cityRef) setCityRef('');
    if (q.length < 2) return setCities([]);
    const t = setTimeout(() => {
      fetch(`/api/np/cities?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((j) => setCities(j.cities || []))
        .catch(() => setCities([]));
    }, 250);
    return () => clearTimeout(t);
  }, [f.city]); // eslint-disable-line react-hooks/exhaustive-deps

  // Відділення вибраного міста.
  useEffect(() => {
    setBranches([]);
    setF((x) => ({ ...x, warehouse: '', warehouseText: '' }));
    if (!cityRef) return;
    let off = false;
    fetch(`/api/np/warehouses?city=${cityRef}`)
      .then((r) => r.json())
      .then((j) => !off && setBranches(j.warehouses || []))
      .catch(() => {});
    return () => { off = true; };
  }, [cityRef]);

  const pickWarehouse = (e) => {
    const text = e.target.value;
    const hit = branches.find((w) => w.name === text);
    setF((x) => ({ ...x, warehouseText: text, warehouse: hit ? hit.number : '' }));
  };

  async function submit(e) {
    e.preventDefault();
    if (blocked) return setState({ busy: false, error: blocked });
    const city = cities.find((c) => c.ref === cityRef);
    if (!city) return setState({ busy: false, error: ERR.bad_city });
    if (!f.warehouse) return setState({ busy: false, error: ERR.bad_warehouse });
    if (sizes.length && !f.size) return setState({ busy: false, error: ERR.bad_size });
    setState({ busy: true, error: '' });
    try {
      const res = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, city: city.name, cityRef, qty: extra ? 1 : Number(f.qty), productId: product.id, ...(extra || {}) }),
      });
      const json = await res.json();
      if (!json.ok || !(json.paymentUrl || json.orderUrl)) throw new Error(ERR[json.error] || 'Помилка, спробуйте ще раз');
      window.location.href = json.paymentUrl || json.orderUrl; // картка: сторінка mono pay; накладений платіж: сторінка статусу
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
      <div className="field">
        <label>Спосіб оплати</label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '1rem' }}>
          <input type="radio" name={`pay-${product.id}`} checked={f.payment === 'card'} onChange={() => setF({ ...f, payment: 'card' })} style={{ width: 18, height: 18 }} /> Карткою онлайн
        </label>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '1rem' }}>
          <input type="radio" name={`pay-${product.id}`} checked={f.payment === 'cod'} onChange={() => setF({ ...f, payment: 'cod' })} style={{ width: 18, height: 18 }} /> Накладений платіж (оплата в Новій Пошті)
        </label>
      </div>
      <div className="field">
        <label htmlFor={`e-${product.id}`}>Email (необовʼязково)</label>
        <input id={`e-${product.id}`} type="email" autoComplete="email" placeholder="Для листа про відгук" value={f.email} onChange={set('email')} />
      </div>
      <div className="field">
        <label htmlFor={`c-${product.id}`}>Місто</label>
        <input id={`c-${product.id}`} required autoComplete="off" list={`cl-${product.id}`} placeholder="Почніть вводити і виберіть зі списку" value={f.city} onChange={set('city')} />
        <datalist id={`cl-${product.id}`}>
          {cities.map((c) => <option key={c.ref} value={c.present} />)}
        </datalist>
      </div>
      <div className="field">
        <label htmlFor={`w-${product.id}`}>Відділення Нової пошти</label>
        <input id={`w-${product.id}`} required autoComplete="off" list={`wl-${product.id}`} disabled={!cityRef} placeholder={cityRef ? (branches.length ? 'Виберіть відділення зі списку' : 'Завантажуємо відділення…') : 'Спочатку виберіть місто'} value={f.warehouseText || ''} onChange={pickWarehouse} />
        <datalist id={`wl-${product.id}`}>
          {branches.map((w) => <option key={w.number} value={w.name} />)}
        </datalist>
      </div>
      {sizes.length > 0 && (
        <div className="field">
          <label>Розмір</label>
          <div className="sizes-row">
            {sizes.map((z) => (
              <button
                key={z.title}
                type="button"
                disabled={z.stock < 1}
                className={`size${f.size === z.title ? ' on' : ''}`}
                onClick={() => setF((x) => ({ ...x, size: z.title, qty: 1 }))}
              >
                {z.title}
              </button>
            ))}
          </div>
        </div>
      )}
      {!extra && <div className="field">
        <label>Кількість</label>
        <div className="stepper">
          <button type="button" onClick={() => step(-1)} disabled={f.qty <= 1} aria-label="Менше">−</button>
          <span>{f.qty}</span>
          <button type="button" onClick={() => step(1)} disabled={f.qty >= max} aria-label="Більше">+</button>
        </div>
      </div>}
      <div className="field">
        <label htmlFor={`m-${product.id}`}>Коментар</label>
        <input id={`m-${product.id}`} placeholder="Необовʼязково" value={f.note} onChange={set('note')} />
      </div>
      <input className="hp" tabIndex="-1" autoComplete="off" name="website" value={f.website} onChange={set('website')} aria-hidden="true" />
      <p className="fine">Натискаючи кнопку, ви погоджуєтесь з <a href="/oferta" target="_blank">офертою</a> і <a href="/konfidentsiynist" target="_blank">політикою конфіденційності</a>. Після покупки ми можемо надіслати SMS або лист із проханням про відгук.</p>
      {state.error && <p className="err" role="alert">{state.error}</p>}
      {inline ? (
        <button className="buy wide" disabled={state.busy || product.stock < 1}>
          {state.busy ? (f.payment === 'cod' ? 'Оформлюємо…' : 'Переходимо до оплати…') : (f.payment === 'cod' ? 'Оформити замовлення' : 'Оплатити карткою')}
        </button>
      ) : (
        <div className="row">
          <button type="button" className="ghost" onClick={onClose}>Скасувати</button>
          <button className="buy" disabled={state.busy}>{state.busy ? (f.payment === 'cod' ? 'Оформлюємо…' : 'Переходимо до оплати…') : (f.payment === 'cod' ? 'Оформити замовлення' : 'Оплатити карткою')}</button>
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
