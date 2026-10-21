import { notFound } from 'next/navigation';
import { parseOrderRef, sbGetOrder } from '../../../lib/orders';
import AutoRefresh from './AutoRefresh';

export const metadata = { title: 'Статус замовлення — Форпост', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const FAILED = ['failure', 'expired', 'reversed', 'failed', 'amount_mismatch'];

function stage(o) {
  if (o.payment_status === 'cod') {
    if (o.ttn) return { key: 'shipped', title: 'Замовлення відправлено', text: `Номер ТТН Нової Пошти: ${o.ttn}. Оплата при отриманні у відділенні.` };
    return { key: 'cod', title: 'Замовлення прийнято', text: 'Оплата при отриманні в Новій Пошті. Ми зв’яжемось з вами за телефоном для підтвердження перед відправкою.' };
  }
  if (o.payment_status === 'paid') {
    if (o.ttn) return { key: 'shipped', title: 'Замовлення відправлено', text: `Номер ТТН Нової Пошти: ${o.ttn}. Відстежити посилку можна на сайті Нової Пошти.` };
    return { key: 'paid', title: 'Оплачено, готуємо до відправки', text: 'Ми передали замовлення постачальнику. Номер ТТН надішлемо за вказаним телефоном, зазвичай протягом 1–3 робочих днів.' };
  }
  if (FAILED.includes(o.payment_status)) {
    return { key: 'failed', title: 'Оплата не пройшла', text: 'Кошти не списано або їх повернуто. Оформіть замовлення ще раз.' };
  }
  return { key: 'pending', title: 'Очікуємо оплату', text: 'Сторінка оновиться сама, щойно оплата підтвердиться.' };
}

const STEPS = [
  ['pending', 'Оформлення'],
  ['paid', 'Підготовка'],
  ['shipped', 'Відправлено'],
];

export default async function Page({ params }) {
  const { ref } = await params;
  const id = parseOrderRef(ref);
  if (!id) notFound();
  const order = await sbGetOrder(id);
  if (!order) notFound();
  const st = stage(order);
  const at = st.key === 'cod' ? 0 : STEPS.findIndex(([k]) => k === st.key);

  return (
    <main style={{ maxWidth: 640, lineHeight: 1.6, margin: '0 auto', padding: '32px 20px' }}>
      <p><a href="/">← До каталогу</a></p>
      <h1>Замовлення №{order.id}</h1>
      <p style={{ fontSize: 18 }}><b>{st.title}</b></p>
      <p>{st.text}</p>

      {st.key !== 'failed' && (
        <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: '24px 0' }}>
          {STEPS.map(([k, label], i) => (
            <li key={k} style={{ flex: 1, padding: '8px 10px', borderRadius: 8, textAlign: 'center', background: i <= at ? '#1f1f1f' : '#ececec', color: i <= at ? '#fff' : '#777' }}>
              {label}
            </li>
          ))}
        </ol>
      )}

      <h2>Склад замовлення</h2>
      <p>{order.product_name}{order.size ? `, розмір ${order.size}` : ''} × {order.qty} — <b>{order.total} ₴</b></p>
      <p>Доставка: {order.city}</p>
      <p>Питання за замовленням: <a href="/povernennya">доставка і повернення</a>. Збережіть це посилання.</p>

      {st.key === 'pending' && <AutoRefresh />}
    </main>
  );
}
