// Вебхук mono pay. Тілу запиту не довіряємо: беремо invoiceId і перепитуємо статус
// у monobank із нашим токеном, звіряємо reference і суму. Обробка ідемпотентна.

import { createMydropDraft, findItem, sbGetOrder, sbPatchOrder } from './_shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const invoiceId = req.body?.invoiceId;
  if (!invoiceId) {
    res.status(400).json({ error: 'no_invoice' });
    return;
  }

  try {
    const stRes = await fetch(
      `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
      { headers: { 'X-Token': process.env.MONO_TOKEN } }
    );
    const st = await stRes.json();
    if (!stRes.ok) {
      console.error('mono status failed', stRes.status, st);
      res.status(502).json({ error: 'status_check_failed' });
      return;
    }

    const order = await sbGetOrder(st.reference);
    if (!order || order.invoice_id !== invoiceId) {
      res.status(404).json({ error: 'order_not_found' });
      return;
    }
    if (order.payment_status === 'paid') {
      res.status(200).json({ ok: true, duplicate: true });
      return;
    }

    if (st.status === 'failure' || st.status === 'expired' || st.status === 'reversed') {
      await sbPatchOrder(order.id, { payment_status: st.status });
      res.status(200).json({ ok: true });
      return;
    }
    if (st.status !== 'success') {
      // created / processing / hold — чекаємо наступного вебхука
      res.status(200).json({ ok: true, pending: true });
      return;
    }
    if (st.amount !== Math.round(order.total * 100)) {
      console.error('amount mismatch', st.amount, order.total, order.id);
      await sbPatchOrder(order.id, { payment_status: 'amount_mismatch' });
      res.status(200).json({ ok: false, error: 'amount_mismatch' });
      return;
    }

    await sbPatchOrder(order.id, {
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      status: 'new',
    });

    const vendor = findItem(order.sku)?.vendor;
    const md = await createMydropDraft(order, vendor).catch((err) => ({ id: null, error: String(err) }));
    await sbPatchOrder(order.id, { mydrop_order_id: md.id, mydrop_error: md.error });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('mono webhook error', err);
    res.status(500).json({ error: 'internal' });
  }
}
