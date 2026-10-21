'use client';

import { useState } from 'react';

const ERR = {
  bad_rating: 'Поставте оцінку від 1 до 5',
  bad_name: 'Вкажіть імʼя',
  already_reviewed: 'Відгук уже отримано, дякуємо',
  not_saved: 'Не вдалося зберегти, спробуйте ще раз',
};

export default function ReviewForm({ reviewRef, defaultName }) {
  const [f, setF] = useState({ rating: 0, name: defaultName, text: '', website: '' });
  const [st, setSt] = useState({ busy: false, error: '', done: false });

  async function submit(e) {
    e.preventDefault();
    setSt({ busy: true, error: '', done: false });
    try {
      const res = await fetch('/api/review', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, ref: reviewRef }) });
      const j = await res.json();
      if (!j.ok) throw new Error(ERR[j.error] || 'Помилка, спробуйте ще раз');
      setSt({ busy: false, error: '', done: true });
    } catch (err) {
      setSt({ busy: false, error: err.message, done: false });
    }
  }

  if (st.done) return <p><b>Дякуємо за відгук!</b> Він зʼявиться на сайті після перевірки.</p>;
  return (
    <form className="order" onSubmit={submit}>
      <div className="field">
        <label>Оцінка</label>
        <div style={{ display: 'flex', gap: 6 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" aria-label={`${n} з 5`} onClick={() => setF({ ...f, rating: n })}
              style={{ fontSize: 32, lineHeight: 1, background: 'none', border: 0, cursor: 'pointer', color: n <= f.rating ? '#e8a400' : '#ccc' }}>★</button>
          ))}
        </div>
      </div>
      <div className="field">
        <label htmlFor="rn">Імʼя</label>
        <input id="rn" required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="rt">Відгук</label>
        <textarea id="rt" rows={5} maxLength={1500} placeholder="Що сподобалось, що ні (необовʼязково)" value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })}
          style={{ width: '100%', padding: 12, border: '1px solid #ccc', borderRadius: 8, font: 'inherit' }} />
      </div>
      <input className="hp" tabIndex="-1" autoComplete="off" name="website" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} aria-hidden="true" />
      {st.error && <p className="err" role="alert">{st.error}</p>}
      <button className="buy wide" disabled={st.busy || !f.rating}>{st.busy ? 'Надсилаємо…' : 'Надіслати відгук'}</button>
    </form>
  );
}
