// Приймає відгук покупця за персональним посиланням. Відгук потрапляє на модерацію (approved = false).
import { createHash } from 'node:crypto';
import { PRODUCTS, parseReviewRef, sb, sbGetOrder } from '../../../lib/orders';
import { sendMail } from '../../../lib/notify';

const bad = (error, status = 400) => Response.json({ ok: false, error }, { status });

export async function POST(req) {
  let b;
  try { b = await req.json(); } catch { return bad('invalid_json'); }
  if (b.website) return Response.json({ ok: true }); // honeypot
  const rating = Number(b.rating);
  const name = String(b.name || '').trim().slice(0, 60);
  const text = String(b.text || '').trim().slice(0, 1500);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return bad('bad_rating');
  if (name.length < 2) return bad('bad_name');

  // Два шляхи: за персональним посиланням із замовлення (підтверджена покупка) або відкрита форма на сторінці товару.
  let order = null;
  let product = null;
  let ipHash = null;
  if (b.ref) {
    const id = parseReviewRef(b.ref);
    if (!id) return bad('bad_link', 404);
    order = await sbGetOrder(id);
    if (!order || order.payment_status !== 'paid') return bad('bad_link', 404);
    product = [...PRODUCTS.values()].find((p) => p.sku === order.sku && p.title === order.product_name);
  } else {
    product = PRODUCTS.get(String(b.productId || ''));
    if (!product) return bad('unknown_product');
    if (text.length < 10) return bad('bad_text');
    // анти-спам: не більше 3 відгуків за годину з однієї адреси
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
    ipHash = createHash('sha256').update(`${ip}:${process.env.CRON_SECRET || ''}`).digest('hex').slice(0, 32);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reviews?ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(since)}&select=id`, { headers: sb(), cache: 'no-store' });
    if (((await r.json().catch(() => [])) || []).length >= 3) return bad('too_many', 429);
  }

  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/reviews`, {
    method: 'POST',
    headers: sb({ Prefer: 'return=minimal' }),
    body: JSON.stringify([{ order_id: order?.id ?? null, product_id: product?.id ?? null, rating, name, text: text || null, verified: !!order, ip_hash: ipHash }]),
  });
  if (res.status === 409) return bad('already_reviewed', 409);
  if (!res.ok) { console.error('review insert failed', res.status, await res.text()); return bad('not_saved', 502); }

  await sendMail(`Новий відгук (${rating}/5) — ${order ? `замовлення №${order.id}` : 'з сайту'}`,
    `<p>${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} — ${name.replace(/[<>&]/g, '')}</p><p>${text.replace(/[<>&]/g, '')}</p>` +
    `<p>${order ? '' : 'Покупку НЕ підтверджено. '}Товар: ${(product?.title || order?.product_name || '').replace(/[<>&]/g, '')}. Щоб показати на сайті: Supabase → market.reviews → approved = true.</p>`);
  return Response.json({ ok: true });
}
