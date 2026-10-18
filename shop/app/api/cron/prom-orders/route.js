// Забирає нові замовлення Prom.ua → market.orders (source = 'prom') → чернетка в MyDrop → у Prom статус «Прийнято».
// Викликається cron-ом Vercel (shop/vercel.json) із заголовком Authorization: Bearer CRON_SECRET.
// Ідемпотентно: prom_order_id унікальний, повторний виклик не створює дублів.

import {
  PRODUCTS,
  createMydropDraft,
  getLiveSupplierPrice,
  sbFindByPromId,
  sbInsertOrder,
  sbPatchOrder,
} from '../../../../lib/orders';

const PROM = 'https://my.prom.ua/api/v1';

async function prom(method, path, body) {
  const res = await fetch(`${PROM}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.PROM_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`prom_${method}_${path}_${res.status}`);
  return json;
}

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'cron_disabled' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'forbidden' }, { status: 403 });

  const report = { checked: 0, created: 0, skipped: [], errors: [] };
  try {
    const { orders = [] } = await prom('GET', '/orders/list?status=pending&limit=100');
    report.checked = orders.length;

    for (const o of orders) {
      try {
        const dp = o.delivery_provider_data || {};
        const customer = [o.client_first_name, o.client_second_name, o.client_last_name].filter(Boolean).join(' ') || '—';
        const city = o.delivery_address || '—';
        const note = [
          `Prom.ua #${o.id}`,
          o.client_notes,
          dp.recipient_warehouse_id && `НП відділення (ref): ${dp.recipient_warehouse_id}`,
          o.payment_option?.name && `Оплата: ${o.payment_option.name}`,
        ].filter(Boolean).join(' | ').slice(0, 500);

        const lines = o.products || [];
        const unknown = lines.filter((p) => !PRODUCTS.get(String(p.external_id)));
        if (!lines.length || unknown.length) {
          report.skipped.push({ promOrder: o.id, reason: 'unknown_product', items: unknown.map((p) => p.name) });
          continue;
        }

        let allDone = true;
        for (const [i, p] of lines.entries()) {
          const item = PRODUCTS.get(String(p.external_id));
          const key = `${o.id}:${i}`;
          let row = await sbFindByPromId(key);
          if (!row) {
            const live = await getLiveSupplierPrice(item.id).catch(() => null);
            const qty = Number(p.quantity);
            const unit = Number(String(p.price).replace(/[^\d.]/g, ''));
            row = await sbInsertOrder({
              category: item.category,
              sku: item.sku,
              product_name: item.title,
              unit_price: unit,
              supplier_price: live?.price ?? item.price,
              qty,
              total: unit * qty,
              customer_name: customer,
              phone: o.phone || '—',
              city,
              note,
              status: 'new',
              payment_status: 'prom',
              source: 'prom',
              prom_order_id: key,
            });
            if (!row) throw new Error('not_saved');
            report.created++;
          }
          if (!row.mydrop_order_id) {
            const md = await createMydropDraft(row).catch((err) => ({ id: null, error: String(err) }));
            await sbPatchOrder(row.id, { mydrop_order_id: md.id, mydrop_error: md.error });
            if (!md.id) allDone = false;
          }
        }
        if (allDone) await prom('POST', '/orders/set_status', { status: 'received', ids: [o.id] });
      } catch (err) {
        console.error('prom order failed', o.id, err);
        report.errors.push({ promOrder: o.id, error: String(err.message || err) });
      }
    }
    return Response.json({ ok: true, ...report });
  } catch (err) {
    console.error('prom cron failed', err);
    return Response.json({ ok: false, error: String(err.message || err), ...report }, { status: 502 });
  }
}
