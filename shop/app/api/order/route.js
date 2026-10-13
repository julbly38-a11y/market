// Приймає замовлення з форми каталогу:
//  1) ціну й постачальника беремо з нашого каталогу (не довіряємо браузеру),
//  2) зберігаємо в Supabase market.orders,
//  3) створюємо чернетку в MyDrop (submitted: false — подає постачальнику власник вручну).

import data from '../../../data/products.json';

const BYID = new Map(data.products.map((p) => [p.id, p]));
const sb = (extra = {}) => ({
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'market',
  'Content-Profile': 'market',
  ...extra,
});

const bad = (error, status = 400) => Response.json({ ok: false, error }, { status });

export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return bad('invalid_json');
  }
  if (b.website) return Response.json({ ok: true }); // honeypot для ботів

  const product = BYID.get(String(b.productId));
  const qty = Number(b.qty);
  const name = String(b.name || '').trim();
  const phone = String(b.phone || '').replace(/[^\d+]/g, '');
  const city = String(b.city || '').trim();
  const warehouse = String(b.warehouse || '').trim();
  const note = String(b.note || '').trim().slice(0, 500);

  if (!product) return bad('unknown_product');
  if (!Number.isInteger(qty) || qty < 1 || qty > Math.max(product.stock, 1)) return bad('bad_qty');
  if (name.length < 3 || name.length > 120) return bad('bad_name');
  if (!/^\+?\d{10,13}$/.test(phone)) return bad('bad_phone');
  if (city.length < 2 || city.length > 120) return bad('bad_city');
  if (!/^\d{1,5}$/.test(warehouse)) return bad('bad_warehouse');

  const total = product.price * qty;

  // 2) Supabase
  let supabaseId = null;
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: sb({ Prefer: 'return=representation' }),
      body: JSON.stringify([
        {
          category: product.category,
          sku: product.sku,
          product_name: product.title,
          unit_price: product.price,
          qty,
          total,
          customer_name: name,
          phone,
          city: `${city}, відділення НП №${warehouse}`,
          note: note || null,
          status: 'new',
        },
      ]),
    });
    const rows = await res.json();
    supabaseId = Array.isArray(rows) ? rows[0]?.id ?? null : null;
  } catch (err) {
    console.error('Supabase insert failed', err);
  }

  // 3) MyDrop (чернетка)
  let mydropOrderId = null;
  let mydropError = null;
  try {
    const res = await fetch('https://backend.mydrop.com.ua/dropshipper/api/orders', {
      method: 'POST',
      headers: { 'X-API-KEY': process.env.MYDROP_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        city,
        warehouse_number: warehouse,
        delivery_service: 'nova_poshta',
        products: [
          { vendor_name: product.vendor, product_title: product.title, sku: product.sku, price: product.price, amount: qty },
        ],
        order_source: 'Форпост (сайт)',
        description: note || undefined,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok) mydropOrderId = json.id ?? null;
    else mydropError = json.message || json.reason || `mydrop_http_${res.status}`;
  } catch (err) {
    mydropError = String(err);
  }

  if (supabaseId && (mydropOrderId || mydropError)) {
    try {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${supabaseId}`, {
        method: 'PATCH',
        headers: sb(),
        body: JSON.stringify({ mydrop_order_id: mydropOrderId, mydrop_error: mydropError }),
      });
    } catch (err) {
      console.error('Supabase update failed', err);
    }
  }

  if (!supabaseId && !mydropOrderId) return bad('not_saved', 502);
  return Response.json({ ok: true, orderId: supabaseId ?? mydropOrderId, mydropOrderId, mydropError });
}
