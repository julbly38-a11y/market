'use client';

import { useState } from 'react';

const ERR = {
  bad_rating: 'Поставте оцінку від 1 до 5',
  bad_name: 'Вкажіть імʼя',
  bad_text: 'Напишіть хоча б кілька слів (від 10 символів)',
  too_many: 'Забагато спроб, спробуйте пізніше',
  not_saved: 'Не вдалося зберегти, спробуйте ще раз',
};

// Відкрита форма відгуку на сторінці товару. Відгук іде на модерацію й без позначки «підтверджена покупка».
export default function ReviewBox({ productId }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ rating: 0, name: '', text: '', website: '' });
  const [st, setSt] = useState({ busy: false, error: '', done: false });

  async function submit(e) {
    e.preventDefault();
    setSt({ busy: true, error: '', done: false });
    try {
      const res = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, productId }) });
      const j = await res.json();
      if (!j.ok) throw new Error(ERR[j.error] || 'Помилка, спробуйте ще раз');
      setSt({ busy: false, error: '', done: true });
    } catch (err) {
      setSt({ busy: false, error: err.message, done: false });
    }
  }

  if (st.done) return <p style={{ margin: '16px 0' }}><b>Дякуємо за відгук!</b> Він зʼявиться на сайті після перевірки.</p>;
  if (!open) return <p style={{ margin: '16px 0' }}><button type="button" className="ghost" onClick={() => setOpen(true)}>Залишити відгук</button></p>;
  return (
    <form className="order" onSubmit={submit} style={{ margin: '16px 0' }}>
      <div className="field">
        <label>Оцінка</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} з 5`} onClick={() => setF({ ...f, rating: n })}
              style={{ fontSize: 30, lineHeight: 1, background: 'none', border: 0, cursor: 'pointer', color: n <= f.rating ? '#e8a400' : '#ccc' }}>★</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="rvn">Імʼя</label>
        <input id="rvn" required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="rvt">Відгук</label>
        <textarea id="rvt" rows={4} required minLength={10} maxLength={1500} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })}
          style={{ width: '100%', padding: 12, border: '1px solid #ccc', borderRadius: 8, font: 'inherit' }} />
      </div>
      <input className="hp" tabIndex="-1" autoComplete="off" name="website" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} aria-hidden="true" />
      {st.error && <p className="err" role="alert">{st.error}</p>}
      <button className="buy wide" disabled={st.busy || !f.rating}>{st.busy ? 'Надсилаємо…' : 'Надіслати відгук'}</button>
    </form>
  );
}
