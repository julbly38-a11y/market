// Приймає замовлення з форми каталогу:
//  1) ціну й постачальника беремо з нашого каталогу (не довіряємо браузеру),
//  2) зберігаємо в Supabase market.orders зі статусом pending_payment,
//  3) створюємо рахунок mono pay і віддаємо посилання на оплату.
// Чернетка MyDrop створюється лише після підтвердженої оплати (див. /api/mono-webhook).

import { retailPrice } from '../../../lib/pricing';
import { getBranches } from '../../../lib/np';
import { getProductDetails } from '../../../lib/details';
import { PRODUCTS, SITE, getLiveSupplierPrice, orderUrl, sbInsertOrder, sbPatchOrder } from '../../../lib/orders';

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
      status: 'pending_payment',
      payment_status: 'pending',
    });
  } catch (err) {
    console.error('Supabase insert failed', err);
  }
  if (!order) return bad('not_saved', 502);

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
