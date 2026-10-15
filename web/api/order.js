// Приймає замовлення з форми: рахує суму на сервері за каталогом, зберігає в Supabase
// (market.orders, статус pending_payment) і створює рахунок mono pay.
// Чернетка в MyDrop створюється лише після підтвердження оплати (див. mono-webhook.js).

import { SITE, findItem, sbInsertOrder, sbPatchOrder } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const { sku, qty, customerName, phone, city, note } = req.body || {};
  const quantity = Number(qty);

  if (!sku || !customerName || !phone || !city || !Number.isInteger(quantity) || quantity < 1) {
    res.status(400).json({ error: 'missing_fields' });
    return;
  }

  const item = findItem(sku);
  if (!item) {
    res.status(400).json({ error: 'unknown_sku' });
    return;
  }
  if (quantity > item.stock) {
    res.status(400).json({ error: 'not_enough_stock' });
    return;
  }

  const total = item.price * quantity;

  let order = null;
  try {
    order = await sbInsertOrder({
      category: item.category,
      sku: item.sku,
      product_name: item.name,
      unit_price: item.price,
      qty: quantity,
      total,
      customer_name: customerName,
      phone,
      city,
      note: note ?? null,
      status: 'pending_payment',
      payment_status: 'pending',
    });
  } catch (err) {
    console.error('Supabase insert failed', err);
  }
  if (!order) {
    res.status(500).json({ error: 'order_not_saved' });
    return;
  }

  try {
    const monoRes = await fetch('https://api.monobank.ua/api/merchant/invoice/create', {
      method: 'POST',
      headers: { 'X-Token': process.env.MONO_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total * 100,
        ccy: 980,
        merchantPaymInfo: {
          reference: String(order.id),
          destination: `Замовлення №${order.id}`,
          basketOrder: [{ name: item.name, qty: quantity, sum: item.price * 100, code: item.sku }],
        },
        redirectUrl: `${SITE}/?order=${encodeURIComponent(order.id)}`,
        webHookUrl: `${SITE}/api/mono-webhook`,
      }),
    });
    const mono = await monoRes.json();
    if (!monoRes.ok || !mono.pageUrl) {
      console.error('mono invoice failed', monoRes.status, mono);
      await sbPatchOrder(order.id, { payment_status: 'failed' });
      res.status(502).json({ error: 'payment_unavailable' });
      return;
    }
    await sbPatchOrder(order.id, { invoice_id: mono.invoiceId });
    res.status(200).json({ ok: true, orderId: order.id, paymentUrl: mono.pageUrl });
  } catch (err) {
    console.error('mono invoice error', err);
    await sbPatchOrder(order.id, { payment_status: 'failed' });
    res.status(502).json({ error: 'payment_unavailable' });
  }
}
