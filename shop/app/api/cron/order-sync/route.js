// Кожні 30 хв підтягує з MyDrop ТТН, статус постачальника й статус доставки відкритих замовлень.
// Коли зʼявляється ТТН, надсилає покупцю лист (якщо є верифікований домен) і власнику сповіщення.
// Cron: Authorization: Bearer PRICE_WATCH_SECRET.

import { sb } from '../../../../lib/orders';
import { applyMydropOrder } from '../../../../lib/ordersync';

export const dynamic = 'force-dynamic';

const MYDROP = 'https://backend.mydrop.com.ua/dropshipper/api';

export async function GET(req) {
  const secrets = [process.env.CRON_SECRET, process.env.PRICE_WATCH_SECRET].filter(Boolean);
  if (!secrets.length) return Response.json({ error: 'cron_disabled' }, { status: 503 });
  if (!secrets.some((s) => req.headers.get('authorization') === `Bearer ${s}`)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const since = new Date(Date.now() - 45 * 86400_000).toISOString();
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/orders?mydrop_order_id=not.is.null&created_at=gte.${encodeURIComponent(since)}&or=(ttn.is.null,delivery_status.is.null,delivery_status.neq.delivered)&select=id,email,customer_name,ttn,mydrop_status,delivery_status,ttn_notified_at,mydrop_submitted,mydrop_order_id&order=id&limit=100`,
    { headers: sb(), cache: 'no-store' }
  );
  const orders = await res.json();
  if (!Array.isArray(orders)) return Response.json({ error: 'orders_read_failed' }, { status: 502 });

  const report = { checked: 0, updated: 0, ttn: 0, errors: [] };
  for (const o of orders) {
    try {
      const r = await fetch(`${MYDROP}/orders/${o.mydrop_order_id}`, { headers: { 'X-API-KEY': process.env.MYDROP_API_KEY }, cache: 'no-store' });
      if (!r.ok) { report.errors.push(`order ${o.id}: mydrop_http_${r.status}`); continue; }
      const m = await r.json();
      report.checked++;
      const r2 = await applyMydropOrder(o, m);
      if (r2.updated) report.updated++;
      if (r2.ttn) report.ttn++;
    } catch (err) {
      report.errors.push(`order ${o.id}: ${err.message}`);
    }
  }
  return Response.json(report);
}
