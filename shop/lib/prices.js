// Свіжі закупівельні ціни й залишки з market.supplier_prices (оновлює щодобовий моніторинг).
// Вітрина, сторінки товарів і фід беруть ціну звідси, а не зі знімка data/products.json (він застарілий).
// При збої Supabase повертає порожню мапу — тоді показуємо знімок каталогу.
import { sb } from './orders';

export async function getFreshPrices() {
  const map = new Map();
  if (!process.env.SUPABASE_URL) return map; // збірка/preview без змінних: показуємо знімок каталогу
  try {
    for (let from = 0; ; from += 1000) {
      const res = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/supplier_prices?select=product_id,price,stock&order=product_id&limit=1000&offset=${from}`,
        { headers: sb(), next: { revalidate: 900 } }
      );
      const rows = await res.json();
      if (!Array.isArray(rows)) break;
      for (const r of rows) map.set(r.product_id, { price: Number(r.price), stock: r.stock });
      if (rows.length < 1000) break;
    }
  } catch {}
  return map;
}

// Ціна для покупця й залишок з урахуванням свіжих даних.
export function withFresh(p, fresh, retailPrice) {
  const f = fresh.get(p.id);
  return { ...p, price: retailPrice(f?.price || p.price), stock: f ? f.stock : p.stock };
}
