// Спільні хелпери для /api/order і /api/mono-webhook: Supabase (схема market) і чернетка MyDrop.

import data from '../data/products.json';

import { createHmac, timingSafeEqual } from 'node:crypto';

export const SITE = (process.env.SITE_URL || 'https://forpost-shop.vercel.app').replace(/\/$/, '');

export const PRODUCTS = new Map(data.products.map((p) => [p.id, p]));

// Актуальна ціна й наявність у постачальника (MyDrop). Окремого запиту на один товар немає,
// тому тягнемо каталог постачальника (~13 МБ, у кеш Next він не влазить) і зберігаємо в памʼяті
// процесу лише {id: {price, stock}} на 5 хвилин. Одночасні запити ділять один завантажений каталог.
// id товару має вигляд "<id постачальника>-<id товару>". Без націнки: ціна = ціна постачальника.
const MYDROP_BASE = 'https://backend.mydrop.com.ua/dropshipper/api';
const PRICE_TTL_MS = 5 * 60 * 1000;
const vendorPrices = new Map(); // vendorId -> { at, promise }

function loadVendorPrices(vendorId) {
  const promise = (async () => {
    const res = await fetch(`${MYDROP_BASE}/export/dropshipper_vendors/${vendorId}/products/json`, {
      headers: { 'X-API-KEY': process.env.MYDROP_API_KEY },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`mydrop_http_${res.status}`);
    const json = await res.json();
    const items = new Map();
    for (const p of json.products || []) {
      const stock = (p.sizes || []).reduce((sum, z) => sum + (z.real_count_dropshipper || 0), 0);
      items.set(String(p.id), {
        price: p.price, // RRP
        drop: p.drop_price || null, // закупівля
        stock,
        // повні дані для market.product_details (їх оновлює моніторинг цін)
        description: p.description,
        images: (p.images || []).map((i) => i.full_url).filter(Boolean),
        sizes: (p.sizes || []).map((z) => ({ title: z.title, stock: z.real_count_dropshipper || 0 })),
        sizeChart: p.size_chart_image?.full_url || (typeof p.size_chart_image === 'string' ? p.size_chart_image : null),
      });
    }
    return items;
  })();
  vendorPrices.set(vendorId, { at: Date.now(), promise });
  // невдалий запит не кешуємо, щоб наступне замовлення спробувало знову
  promise.catch(() => vendorPrices.get(vendorId)?.promise === promise && vendorPrices.delete(vendorId));
  return promise;
}

// Живі {id: {price, stock}} усього каталогу постачальника (той самий кеш на 5 хв).
export async function getVendorPrices(vendorId) {
  const hit = vendorPrices.get(vendorId);
  return hit && Date.now() - hit.at < PRICE_TTL_MS ? hit.promise : loadVendorPrices(vendorId);
}

export async function getLiveSupplierPrice(productId) {
  const [vendorId, itemId] = String(productId).split('-');
  const hit = vendorPrices.get(vendorId);
  const items = await (hit && Date.now() - hit.at < PRICE_TTL_MS ? hit.promise : loadVendorPrices(vendorId));
  return items.get(itemId) ?? null;
}

export const sb = (extra = {}) => ({
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

export async function sbFindByPromId(promOrderId) {
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/orders?prom_order_id=eq.${encodeURIComponent(promOrderId)}&select=*`,
    { headers: sb(), cache: 'no-store' }
  );
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
      products: Array.isArray(order.items) && order.items.length
        ? order.items.map((i) => ({
            vendor_name: i.vendor,
            product_title: i.title,
            sku: i.sku,
            price: i.price,
            amount: 1,
            ...(i.size ? { size_title: i.size } : {}),
          }))
        : [
            {
              vendor_name: product?.vendor,
              product_title: order.product_name,
              sku: order.sku,
              price: order.unit_price,
              amount: order.qty,
              ...(order.size ? { size_title: order.size } : {}),
            },
          ],
      order_source: 'Форпост (сайт)',
      // Платіжні поля (накладений платіж, передоплата) у MyDrop задаються при подачі замовлення — це робить власник.
      // Тому в чернетці чітко пишемо, як оплачено, щоб не стягнути гроші вдруге.
      description:
        [
          order.payment_status === 'paid'
            ? 'ОПЛАЧЕНО карткою (mono). Накладений платіж НЕ стягувати.'
            : `НАКЛАДЕНИЙ ПЛАТІЖ: стягнути ${order.total} ₴ при отриманні.`,
          order.note,
        ].filter(Boolean).join(' | '),
      private_description: `Форпост №${order.id}, ${order.payment_status === 'paid' ? 'оплачено карткою' : 'накладений платіж'}`,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok) return { id: json.id ?? null, error: null };
  return { id: null, error: json.message || json.reason || `mydrop_http_${res.status}` };
}

// Посилання на статус замовлення: /order/<id>-<токен>. Токен — HMAC від id, тож чужі замовлення не перебрати.
const tokenSecret = () => process.env.ORDER_TOKEN_SECRET || process.env.CRON_SECRET || '';
export const orderToken = (id) => createHmac('sha256', tokenSecret()).update(String(id)).digest('hex').slice(0, 20);
export const orderUrl = (id) => `${SITE}/order/${id}-${orderToken(id)}`;
export function parseOrderRef(ref) {
  const m = /^(\d{1,12})-([0-9a-f]{20})$/.exec(String(ref || ''));
  if (!m || !tokenSecret()) return null;
  const a = Buffer.from(orderToken(m[1]));
  const b = Buffer.from(m[2]);
  return a.length === b.length && timingSafeEqual(a, b) ? m[1] : null;
}

// Посилання на відгук: /review/<id>-<токен> (окремий токен від сторінки статусу).
export const reviewToken = (id) => createHmac('sha256', tokenSecret()).update(`review:${id}`).digest('hex').slice(0, 20);
export const reviewUrl = (id) => `${SITE}/review/${id}-${reviewToken(id)}`;
export function parseReviewRef(ref) {
  const m = /^(\d{1,12})-([0-9a-f]{20})$/.exec(String(ref || ''));
  if (!m || !tokenSecret()) return null;
  const a = Buffer.from(reviewToken(m[1]));
  const b = Buffer.from(m[2]);
  return a.length === b.length && timingSafeEqual(a, b) ? m[1] : null;
}
