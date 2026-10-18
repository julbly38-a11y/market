// Спільні хелпери для /api/order і /api/mono-webhook: Supabase (схема market) і чернетка MyDrop.

import data from '../data/products.json';

export const SITE = (process.env.SITE_URL || 'https://forpost-shop.vercel.app').replace(/\/$/, '');

export const PRODUCTS = new Map(data.products.map((p) => [p.id, p]));

// Актуальна ціна й наявність у постачальника (MyDrop). Окремого запиту на один товар немає,
// тому тягнемо каталог постачальника; Next кешує відповідь на кілька хвилин.
// id товару має вигляд "<id постачальника>-<id товару>". Без націнки: ціна = ціна постачальника.
const MYDROP_BASE = 'https://backend.mydrop.com.ua/dropshipper/api';

export async function getLiveSupplierPrice(productId) {
  const [vendorId, itemId] = String(productId).split('-');
  const res = await fetch(`${MYDROP_BASE}/export/dropshipper_vendors/${vendorId}/products/json`, {
    headers: { 'X-API-KEY': process.env.MYDROP_API_KEY },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`mydrop_http_${res.status}`);
  const json = await res.json();
  const p = (json.products || []).find((x) => String(x.id) === itemId);
  if (!p) return null;
  const stock = (p.sizes || []).reduce((s, z) => s + (z.real_count_dropshipper || 0), 0);
  return { price: p.price, stock };
}

const sb = (extra = {}) => ({
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'market',
  'Content-Profile': 'market',
  ...extra,
});

export async function sbInsertOrder(record) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: sb({ Prefer: 'return=representation' }),
    body: JSON.stringify([record]),
  });
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function sbGetOrder(id) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*`, {
    headers: sb(),
  });
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

export async function sbListOrders(sinceIso) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/orders?created_at=gte.${encodeURIComponent(sinceIso)}&select=*&order=id.desc&limit=1000`,
    { headers: sb(), cache: 'no-store' }
  );
  const rows = await res.json();
  return Array.isArray(rows) ? rows : [];
}

export async function sbPatchOrder(id, fields) {
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: sb(),
    body: JSON.stringify(fields),
  });
}

// Чернетка в MyDrop (submitted: false — постачальник її ще не бачить, власник подає вручну).
// Місто і відділення в замовленні зберігаються одним рядком "Місто, відділення НП №N".
export async function createMydropDraft(order) {
  const m = /^(.*), відділення НП №(\d+)$/.exec(order.city || '');
  const city = m ? m[1] : order.city;
  const warehouse = m ? m[2] : undefined;
  const product = [...PRODUCTS.values()].find((p) => p.sku === order.sku && p.title === order.product_name);

  const res = await fetch('https://backend.mydrop.com.ua/dropshipper/api/orders', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.MYDROP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: order.customer_name,
      phone: order.phone,
      city,
      warehouse_number: warehouse,
      delivery_service: 'nova_poshta',
      products: [
        {
          vendor_name: product?.vendor,
          product_title: order.product_name,
          sku: order.sku,
          price: order.unit_price,
          amount: order.qty,
        },
      ],
      order_source: 'Форпост (сайт)',
      description: order.note || undefined,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok) return { id: json.id ?? null, error: null };
  return { id: null, error: json.message || json.reason || `mydrop_http_${res.status}` };
}
