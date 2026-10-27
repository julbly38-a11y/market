// Розрахунок кошика на сервері: живі ціни й залишки з MyDrop, групи по постачальниках, мінімальна сума.
// Тіло: { items: [{ id, size, qty }] }. Нічого не створює.

import { PRODUCTS, getLiveSupplierPrice, minOrderFor } from '../../../../lib/orders';
import { getProductDetails } from '../../../../lib/details';
import { sellPrice } from '../../../../lib/pricing';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const list = Array.isArray(body?.items) ? body.items.slice(0, 40) : [];
  const groups = new Map();
  for (const x of list) {
    const id = String(x?.id || '');
    const size = String(x?.size || '').trim();
    const qty = Math.min(99, Math.max(1, Number(x?.qty) || 1));
    const p = PRODUCTS.get(id);
    const vendor = p?.vendor || 'невідомо';
    const g = groups.get(vendor) || { vendor, items: [], total: 0, min: minOrderFor(vendor) };
    let row = { id, size, qty, title: p?.title || 'Товар не знайдено', image: p?.image || null, price: 0, ok: false, reason: 'unknown_product', max: 1 };
    if (p) {
      try {
        const live = await getLiveSupplierPrice(id);
        const price = live?.price ? sellPrice(live.price, live.drop) : null;
        const details = await getProductDetails(id);
        const sizes = details?.sizes || [];
        const z = sizes.find((s) => s.title === size);
        const max = sizes.length ? z?.stock || 0 : live?.stock || 0;
        row = { ...row, price: price || 0, max, ok: false, reason: '' };
        if (price == null) row.reason = 'no_cost';
        else if (sizes.length && !z) row.reason = 'bad_size';
        else if (max < 1) row.reason = 'out_of_stock';
        else if (qty > max) row.reason = 'qty_over';
        else row.ok = true;
      } catch {
        row.reason = 'price_unavailable';
      }
    }
    g.items.push(row);
    if (row.ok) g.total += row.price * qty;
    groups.set(vendor, g);
  }
  const out = [...groups.values()].map((g) => ({
    ...g,
    short: Math.max(0, g.min - g.total),
    canCheckout: g.items.length > 0 && g.items.every((i) => i.ok) && g.total >= g.min,
  }));
  return Response.json({ groups: out });
}
