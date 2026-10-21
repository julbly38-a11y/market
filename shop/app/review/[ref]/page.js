import { notFound } from 'next/navigation';
import { parseReviewRef, sb, sbGetOrder } from '../../../lib/orders';
import ReviewForm from './ReviewForm';

export const metadata = { title: 'Відгук про замовлення — Форпост', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function Page({ params }) {
  const { ref } = await params;
  const id = parseReviewRef(ref);
  if (!id) notFound();
  const order = await sbGetOrder(id);
  if (!order || order.payment_status !== 'paid') notFound();
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reviews?order_id=eq.${id}&select=id`, { headers: sb(), cache: 'no-store' });
  const done = ((await r.json().catch(() => [])) || []).length > 0;
  const firstName = String(order.customer_name || '').trim().split(/\s+/)[1] || String(order.customer_name || '').split(/\s+/)[0] || '';

  return (
    <main style={{ maxWidth: 560, lineHeight: 1.6, margin: '0 auto', padding: '32px 20px' }}>
      <h1>Ваш відгук</h1>
      <p>{order.product_name}</p>
      {done ? <p><b>Дякуємо, відгук уже отримано.</b></p> : <ReviewForm reviewRef={ref} defaultName={firstName} />}
    </main>
  );
}
