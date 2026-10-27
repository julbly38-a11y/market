// Вебхук MyDrop «Зміна замовлення»: ТТН, статус постачальника й статус доставки приходять одразу.
// Налаштовується в кабінеті MyDrop → API → Webhooks → «Webhook URL при змінах у замовленні»:
//   https://forpost-shop.com/api/webhooks/mydrop
// Підпис: X-MyDrop-Signature = HMAC-SHA256 у hex від "<X-MyDrop-Timestamp>.<тіло>", ключ MYDROP_API_KEY;
// мітка часу не старша за 5 хвилин. Відповідати треба за 15 с, повторів немає: cron order-sync лишається страховкою.

import { createHmac, timingSafeEqual } from 'node:crypto';
import { sb } from '../../../../lib/orders';
import { applyMydropOrder } from '../../../../lib/ordersync';

export const dynamic = 'force-dynamic';

const ok = (body = { ok: true }) => Response.json(body);

function validSignature(req, raw) {
  const key = process.env.MYDROP_API_KEY;
  const ts = req.headers.get('x-mydrop-timestamp') || '';
  const sig = req.headers.get('x-mydrop-signature') || '';
  if (!key || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const want = createHmac('sha256', key).update(`${ts}.${raw}`).digest('hex');
  const a = Buffer.from(want);
  const b = Buffer.from(sig.toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req) {
  const raw = await req.text();
  if (!validSignature(req, raw)) return Response.json({ error: 'bad_signature' }, { status: 403 });

  let m;
  try {
    m = JSON.parse(raw);
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!m?.id) return ok({ ok: true, skipped: 'no_id' });

  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/orders?mydrop_order_id=eq.${encodeURIComponent(String(m.id))}&select=id,email,customer_name,ttn,mydrop_status,delivery_status,ttn_notified_at,mydrop_submitted&limit=1`,
      { headers: sb(), cache: 'no-store' }
    );
    const rows = await res.json();
    const o = Array.isArray(rows) ? rows[0] : null;
    if (!o) return ok({ ok: true, skipped: 'not_our_order' }); // замовлення створене не сайтом
    const r = await applyMydropOrder(o, m);
    return ok({ ok: true, updated: r.updated, ttn: r.ttn });
  } catch (err) {
    console.error('mydrop webhook failed', err);
    return Response.json({ error: 'processing_failed' }, { status: 500 });
  }
}
