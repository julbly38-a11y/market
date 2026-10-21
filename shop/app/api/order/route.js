// Приймає замовлення з форми каталогу:
//  1) ціну й постачальника беремо з нашого каталогу (не довіряємо браузеру),
//  2) зберігаємо в Supabase market.orders зі статусом pending_payment,
//  3) створюємо рахунок mono pay і віддаємо посилання на оплату.
// Чернетка MyDrop створюється лише після підтвердженої оплати (див. /api/mono-webhook).

import { retailPrice } from '../../../lib/pricing';
import { getBranches } from '../../../lib/np';
import { notifyCodOrder } from '../../../lib/notify';
import { getProductDetails } from '../../../lib/details';
import { PRODUCTS, SITE, createMydropDraft, getLiveSupplierPrice, orderUrl, sb, sbInsertOrder, sbPatchOrder } from '../../../lib/orders';

const bad = (error, status = 400) => Response.json({ ok: false, error }, { status });

export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return bad('invalid_json');
  }
  if (b.website) return Response.json({ ok: true }); // honeypot для ботів

  const catalogItem = PRODUCTS.get(String(b.productId));
  const qty = Number(b.qty);
  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').replace(/[^\d+]/g, '');
  const city = String(b.city || '').trim();
  const warehouse = String(b.warehouse || '').trim();
  const note = String(b.note || '').trim().slice(0, 500);
  const emailRaw = String(b.email || '').trim().slice(0, 120);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;

  if (!catalogItem) return bad('unknown_product');

  // Ціну й наявність беремо в постачальника наживо; знімок каталогу може бути застарілим.
  let live;
  try {
    live = await getLiveSupplierPrice(catalogItem.id);
  } catch (err) {
    console.error('supplier price failed', err);
    return bad('price_unavailable', 502);
  }
  if (!live || !live.price) return bad('price_unavailable', 502);
  const product = { ...catalogItem, price: retailPrice(live.price), stock: live.stock };

  if (!Number.isInteger(qty) || qty < 1 || qty > Math.max(product.stock, 1)) return bad('bad_qty');
  if (name.length < 3 || name.length > 120) return bad('bad_name');
  if (!/^\+?\d{10,13}$/.test(phone)) return bad('bad_phone');
  if (city.length < 2 || city.length > 120) return bad('bad_city');
  if (!/^\d{1,5}$/.test(warehouse)) return bad('bad_warehouse');

  // Місто й відділення вибираються зі списку НП: звіряємо, що такий номер справді є в місті.
  const cityRef = String(b.cityRef || '');
  if (/^[0-9a-f-]{36}$/i.test(cityRef)) {
    try {
      const branches = await getBranches(cityRef);
      if (!branches.some((w) => w.number === warehouse)) return bad('bad_warehouse');
    } catch (err) {
      console.error('np check failed, пропускаємо перевірку', err);
    }
  }

  // Розмір: якщо у товару є розміри, він обовʼязковий і має бути в наявності.
  const details = await getProductDetails(catalogItem.id, { fresh: true });
  const sizes = details?.sizes || [];
  const size = String(b.size || '').trim();
  if (sizes.length) {
    const z = sizes.find((x) => x.title === size);
    if (!z || z.stock < qty) return bad('bad_size');
  }

  const total = product.price * qty;

  // Накладений платіж: ліміт суми й не більше 3 таких замовлень на добу з одного номера.
  const cod = b.payment === 'cod';
  if (cod) {
    if (total > Number(process.env.COD_MAX_AMOUNT || 3000)) return bad('cod_limit');
    const since = new Date(Date.now() - 86400_000).toISOString();
    const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?phone=eq.${encodeURIComponent(phone)}&payment_status=eq.cod&created_at=gte.${encodeURIComponent(since)}&select=id`, { headers: sb(), cache: 'no-store' });
    if (((await r.json().catch(() => [])) || []).length >= 3) return bad('too_many', 429);
  }

  let order = null;
  try {
    order = await sbInsertOrder({
      category: product.category,
      sku: product.sku,
      product_name: product.title,
      unit_price: product.price,
      supplier_price: live.price,
      qty,
      size: size || null,
      email,
      total,
      customer_name: name,
      phone,
      city: `${city}, відділення НП №${warehouse}`,
      note: note || null,
      status: cod ? 'new' : 'pending_payment',
      payment_status: cod ? 'cod' : 'pending',
    });
  } catch (err) {
    console.error('Supabase insert failed', err);
  }
  if (!order) return bad('not_saved', 502);

  if (cod) {
    const md = await createMydropDraft(order).catch((err) => ({ id: null, error: String(err) }));
    await sbPatchOrder(order.id, { mydrop_order_id: md.id, mydrop_error: md.error });
    await notifyCodOrder(order, md);
    return Response.json({ ok: true, orderId: order.id, orderUrl: orderUrl(order.id) });
  }

  try {
    const res = await fetch('https://api.monobank.ua/api/merchant/invoice/create', {
      method: 'POST',
      headers: { 'X-Token': process.env.MONO_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: total * 100,
        ccy: 980,
        merchantPaymInfo: {
          reference: String(order.id),
          destination: `Замовлення №${order.id}`,
          basketOrder: [{ name: product.title, qty, sum: product.price * 100, code: String(product.sku) }],
        },
        redirectUrl: orderUrl(order.id),
        webHookUrl: `${SITE}/api/mono-webhook`,
      }),
    });
    const mono = await res.json().catch(() => ({}));
    if (!res.ok || !mono.pageUrl) {
      console.error('mono invoice failed', res.status, mono);
      await sbPatchOrder(order.id, { payment_status: 'failed' });
      return bad('payment_unavailable', 502);
    }
    await sbPatchOrder(order.id, { invoice_id: mono.invoiceId });
    return Response.json({ ok: true, orderId: order.id, paymentUrl: mono.pageUrl });
  } catch (err) {
    console.error('mono invoice error', err);
    await sbPatchOrder(order.id, { payment_status: 'failed' });
    return bad('payment_unavailable', 502);
  }
}
