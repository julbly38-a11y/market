// Повні дані товару (опис, фото, розміри) з market.product_details; наповнюється scripts/sync-details.mjs.
import { sb } from './orders';

export async function getProductDetails(id, { fresh = false } = {}) {
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/product_details?id=eq.${encodeURIComponent(id)}&select=description,images,sizes,size_chart`,
      { headers: sb(), ...(fresh ? { cache: 'no-store' } : { next: { revalidate: 600 } }) }
    );
    const rows = await res.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch {
    return null;
  }
}
