// Вебхук mono pay. Тілу запиту не довіряємо: беремо invoiceId і перепитуємо статус
// у monobank із нашим токеном, звіряємо reference і суму. Обробка ідемпотентна.
// Додатково перевіряємо підпис X-Sign (ECDSA) — чужі запити відсіюються до будь-яких викликів.

import { createMydropDraft, generateTtnVendors, prepayBalanceVendors, sbGetOrder, sbPatchOrder, submitMydropOrder } from '../../../lib/orders';
import { notifyPaidOrder } from '../../../lib/notify';
import { getInvoiceStatus, verifyWebhookSign } from '../../../lib/mono';

const json = (body, status = 200) => Response.json(body, { status });

export async function POST(req) {
  const raw = await req.text();
  if (!(await verifyWebhookSign(raw, req.headers.get('x-sign')))) return json({ error: 'bad_signature' }, 401);
  let body = {};
  try {
    body = JSON.parse(raw);
  } catch {}
  const invoiceId = body?.invoiceId;
  if (!invoiceId) return json({ error: 'no_invoice' }, 400);

  try {
    const st = await getInvoiceStatus(invoiceId);

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

    const paidOrder = { ...order, payment_status: 'paid' }; // order прочитано до оплати
    const md = await createMydropDraft(paidOrder).catch((err) => ({ id: null, error: String(err) }));
    // Оплачено карткою: подаємо постачальнику з передоплатою з балансу MyDrop (покупець уже заплатив нам повну суму).
    if (md.id && !Array.isArray(order.items) && prepayBalanceVendors().includes(md.vendor)) {
      const sub = await submitMydropOrder(md.id, { prepay_amount: Number(order.total), prepay_from_balance: true, ...(generateTtnVendors().includes(md.vendor) ? { generate_ttn: true } : {}) })
        .catch((err) => ({ submitted: false, error: `submit: ${err}` }));
      md.submitted = sub.submitted;
      if (sub.error) md.error = sub.error;
      if (sub.ttn) md.ttn = sub.ttn;
    }
    await sbPatchOrder(order.id, { mydrop_order_id: md.id, mydrop_error: md.error, mydrop_submitted: !!md.submitted, mydrop_vendor: md.vendor || null, ...(md.submitted ? { mydrop_submitted_at: new Date().toISOString() } : {}), ...(md.ttn ? { ttn: md.ttn, ttn_at: new Date().toISOString() } : {}) });
    await notifyPaidOrder(paidOrder, md);

    return json({ ok: true });
  } catch (err) {
    console.error('mono webhook error', err);
    return json({ error: 'internal' }, 500);
  }
}
