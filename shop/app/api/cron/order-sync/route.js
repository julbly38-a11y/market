// Кожні 30 хв підтягує з MyDrop ТТН, статус постачальника й статус доставки відкритих замовлень.
// Коли зʼявляється ТТН, надсилає покупцю лист (якщо є верифікований домен) і власнику сповіщення.
// Cron: Authorization: Bearer PRICE_WATCH_SECRET.

import { sb } from '../../../../lib/orders';
import { applyMydropOrder } from '../../../../lib/ordersync';
import { sendMail } from '../../../../lib/notify';

export const dynamic = 'force-dynamic';

const MYDROP = 'https://backend.mydrop.com.ua/dropshipper/api';

export async function GET(req) {
  const secrets = [process.env.CRON_SECRET, process.env.PRICE_WATCH_SECRET].filter(Boolean);
  if (!secrets.length) return Response.json({ error: 'cron_disabled' }, { status: 503 });
  if (!secrets.some((s) => req.headers.get('authorization') === `Bearer ${s}`)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const since = new Date(Date.now() - 45 * 86400_000).toISOString();
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/orders?mydrop_order_id=not.is.null&created_at=gte.${encodeURIComponent(since)}&or=(ttn.is.null,delivery_status.is.null,delivery_status.neq.delivered)&select=id,email,customer_name,ttn,mydrop_status,delivery_status,ttn_notified_at,mydrop_submitted,mydrop_submitted_at,ttn_at,mydrop_order_id&order=id&limit=100`,
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

  // Сповіщення про затримку: подано, а ТТН немає довше за TTN_DELAY_ALERT_HOURS (за замовчуванням 24 год). Один лист на замовлення.
  try {
    const hours = Number(process.env.TTN_DELAY_ALERT_HOURS || 24);
    const before = new Date(Date.now() - hours * 3600_000).toISOString();
    const lr = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/orders?mydrop_submitted=is.true&ttn=is.null&delay_alerted_at=is.null&mydrop_submitted_at=lte.${encodeURIComponent(before)}&mydrop_status=neq.${encodeURIComponent('Отмена')}&select=id,mydrop_vendor,mydrop_order_id,mydrop_submitted_at&order=id&limit=50`,
      { headers: sb(), cache: 'no-store' }
    );
    const late = await lr.json();
    if (Array.isArray(late) && late.length) {
      const rows = late.map((o) => `<li>№${o.id} (MyDrop ${o.mydrop_order_id}), ${o.mydrop_vendor || 'постачальник невідомий'}: подано ${new Date(o.mydrop_submitted_at).toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' })}</li>`).join('');
      await sendMail(`ТТН затримується: ${late.length} замовл. без ТТН понад ${hours} год`, `<p>Ці замовлення подані постачальникам, але ТТН досі немає. Нагадайте постачальнику:</p><ul>${rows}</ul>`);
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?id=in.(${late.map((o) => o.id).join(',')})`, { method: 'PATCH', headers: sb(), body: JSON.stringify({ delay_alerted_at: new Date().toISOString() }) });
      report.delayAlerts = late.length;
    }
  } catch (err) {
    report.errors.push(`delay-alert: ${err.message}`);
  }
  return Response.json(report);
}
