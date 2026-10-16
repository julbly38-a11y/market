// Вебхук mono pay. Тілу запиту не довіряємо: беремо invoiceId і перепитуємо статус
// у monobank із нашим токеном, звіряємо reference і суму. Обробка ідемпотентна.

import { createMydropDraft, sbGetOrder, sbPatchOrder } from '../../../lib/orders';

const json = (body, status = 200) => Response.json(body, { status });

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const invoiceId = body?.invoiceId;
  if (!invoiceId) return json({ error: 'no_invoice' }, 400);

  try {
    const stRes = await fetch(
      `https://api.monobank.ua/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`,
      { headers: { 'X-Token': process.env.MONO_TOKEN } }
    );
    const st = await stRes.json().catch(() => ({}));
    if (!stRes.ok) {
      console.error('mono status failed', stRes.status, st);
      return json({ error: 'status_check_failed' }, 502);
    }

    const order = await sbGetOrder(st.reference);
    if (!order || order.invoice_id !== invoiceId) return json({ error: 'order_not_found' }, 404);
    if (order.payment_status === 'paid') return json({ ok: true, duplicate: true });

    if (['failure', 'expired', 'reversed'].includes(st.status)) {
      await sbPatchOrder(order.id, { payment_status: st.status });
      return json({ ok: true });
    }
    if (st.status !== 'success') return json({ ok: true, pending: true });
    if (st.amount !== Math.round(order.total * 100)) {
      console.error('amount mismatch', st.amount, order.total, order.id);
      await sbPatchOrder(order.id, { payment_status: 'amount_mismatch' });
      return json({ ok: false, error: 'amount_mismatch' });
    }

    await sbPatchOrder(order.id, { payment_status: 'paid', paid_at: new Date().toISOString(), status: 'new' });

    const md = await createMydropDraft(order).catch((err) => ({ id: null, error: String(err) }));
    await sbPatchOrder(order.id, { mydrop_order_id: md.id, mydrop_error: md.error });

    return json({ ok: true });
  } catch (err) {
    console.error('mono webhook error', err);
    return json({ error: 'internal' }, 500);
  }
}
