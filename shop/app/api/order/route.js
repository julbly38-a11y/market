// Приймає замовлення з форми (один товар або набір):
//  1) ціну й постачальника беремо з нашого каталогу й живих даних MyDrop (не довіряємо браузеру),
//  2) зберігаємо в Supabase market.orders,
//  3) картка: створюємо рахунок mono pay; накладений платіж: одразу чернетка MyDrop і лист власнику.
// Чернетка MyDrop для оплати карткою створюється лише після підтвердженої оплати (див. /api/mono-webhook).

import { retailPrice } from '../../../lib/pricing';
import { getBranches } from '../../../lib/np';
import { notifyCodOrder } from '../../../lib/notify';
import { getProductDetails } from '../../../lib/details';
import { SET_SLOTS, getSetRow, salePrice } from '../../../lib/sets';
import { PRODUCTS, SITE, createMydropDraft, getLiveSupplierPrice, orderUrl, sb, sbInsertOrder, sbPatchOrder } from '../../../lib/orders';

const bad = (error, status = 400) => Response.json({ ok: false, error }, { status });
const fail = (error, status) => ({ error: Response.json({ ok: false, error }, { status: status || 400 }) });

// Один товар: перевіряє наявність, розмір, кількість. Повертає поля замовлення й позиції для рахунку.
async function buildSingle(b) {
  const catalogItem = PRODUCTS.get(String(b.productId));
  const qty = Number(b.qty);
  if (!catalogItem) return fail('unknown_product');
  let live;
  try {
    live = await getLiveSupplierPrice(catalogItem.id);
  } catch (err) {
    console.error('supplier price failed', err);
    return fail('price_unavailable', 502);
  }
  if (!live || !live.price) return fail('price_unavailable', 502);
  const price = retailPrice(live.price);
  if (!Number.isInteger(qty) || qty < 1 || qty > Math.max(live.stock, 1)) return fail('bad_qty');

  const details = await getProductDetails(catalogItem.id, { fresh: true });
  const sizes = details?.sizes || [];
  const size = String(b.size || '').trim();
  if (sizes.length) {
    const z = sizes.find((x) => x.title === size);
    if (!z || z.stock < qty) return fail('bad_size');
  }
  const total = price * qty;
  return {
    total,
    record: {
      category: catalogItem.category, sku: catalogItem.sku, product_name: catalogItem.title,
      unit_price: price, supplier_price: live.price, qty, size: size || null,
    },
    basket: [{ name: catalogItem.title, qty, sum: price * 100, code: String(catalogItem.sku) }],
  };
}

// Набір: усі речі з market.sets, ціна кожної з урахуванням знижки на набір, розмір для кожної речі, одне замовлення.
async function buildSet(b) {
  const row = await getSetRow(String(b.setSlug));
  if (!row) return fail('unknown_set');
  const chosen = b.setSizes && typeof b.setSizes === 'object' ? b.setSizes : {};
  const items = [];
  let supplier = 0;
  for (const [slot, label] of SET_SLOTS) {
    const id = row[slot];
    if (!id) continue;
    const p = PRODUCTS.get(id);
    if (!p) return fail('unknown_product');
    let live;
    try {
      live = await getLiveSupplierPrice(id);
    } catch (err) {
      console.error('supplier price failed', err);
      return fail('price_unavailable', 502);
    }
    if (!live || !live.price) return fail('price_unavailable', 502);
    if (live.stock < 1) return fail('set_out_of_stock');
    const details = await getProductDetails(id, { fresh: true });
    const sizes = details?.sizes || [];
    const size = String(chosen[slot] || '').trim();
    if (sizes.length) {
      const z = sizes.find((x) => x.title === size);
      if (!z || z.stock < 1) return fail('bad_size');
    }
    const price = salePrice(retailPrice(live.price), row.discount_percent);
    supplier += live.price;
    items.push({ slot, label, id, title: p.title, sku: p.sku, vendor: p.vendor, size: size || null, price, supplier_price: live.price });
  }
  if (!items.length) return fail('unknown_set');
  const total = items.reduce((s, i) => s + i.price, 0);
  return {
    total,
    record: {
      category: 'Набір', sku: `SET-${row.id}`, product_name: row.title,
      unit_price: total, supplier_price: supplier, qty: 1, size: null, items, set_id: row.id,
    },
    basket: items.map((i) => ({ name: `${i.title}${i.size ? ` (${i.size})` : ''}`.slice(0, 120), qty: 1, sum: i.price * 100, code: String(i.sku) })),
  };
}

export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return bad('invalid_json');
  }
  if (b.website) return Response.json({ ok: true }); // honeypot для ботів

  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').replace(/[^\d+]/g, '');
  const city = String(b.city || '').trim();
  const warehouse = String(b.warehouse || '').trim();
  const note = String(b.note || '').trim().slice(0, 500);
  const emailRaw = String(b.email || '').trim().slice(0, 120);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;

  const built = b.setSlug ? await buildSet(b) : await buildSingle(b);
  if (built.error) return built.error;
  const { total, record, basket } = built;

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
      ...record,
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
          basketOrder: basket,
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
