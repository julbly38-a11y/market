// Приймає відгук покупця за персональним посиланням. Відгук потрапляє на модерацію (approved = false).
import { PRODUCTS, parseReviewRef, sb, sbGetOrder } from '../../../lib/orders';
import { sendMail } from '../../../lib/notify';

const bad = (error, status = 400) => Response.json({ ok: false, error }, { status });

export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return bad('invalid_json'); }
  if (b.website) return Response.json({ ok: true }); // honeypot
  const id = parseReviewRef(b.ref);
  if (!id) return bad('bad_link', 404);
  const rating = Number(b.rating);
  const name = String(b.name || '').trim().slice(0, 60);
  const text = String(b.text || '').trim().slice(0, 1500);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad('bad_rating');
  if (name.length < 2) return bad('bad_name');

  const order = await sbGetOrder(id);
  if (!order || order.payment_status !== 'paid') return bad('bad_link', 404);
  const product = [...PRODUCTS.values()].find((p) => p.sku === order.sku && p.title === order.product_name);

  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reviews`, {
    method: 'POST',
    headers: sb({ Prefer: 'return=minimal' }),
    body: JSON.stringify([{ order_id: order.id, product_id: product?.id ?? null, rating, name, text: text || null }]),
  });
  if (res.status === 409) return bad('already_reviewed', 409);
  if (!res.ok) { console.error('review insert failed', res.status, await res.text()); return bad('not_saved', 502); }

  await sendMail(`Новий відгук (${rating}/5) — замовлення №${order.id}`,
    `<p>${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} — ${name.replace(/[<>&]/g, '')}</p><p>${text.replace(/[<>&]/g, '')}</p>` +
    `<p>Товар: ${(order.product_name || '').replace(/[<>&]/g, '')}. Щоб показати на сайті: Supabase → market.reviews → approved = true.</p>`);
  return Response.json({ ok: true });
}
