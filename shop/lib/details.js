// Повні дані товару (опис, фото, розміри) з market.product_details; щодоби оновлює моніторинг цін (lib/pricewatch.js).
import { sb } from './orders';

export async function getProductDetails(id, { fresh = false } = {}) {
  if (!process.env.SUPABASE_URL) return null;
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

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', laquo: '«', raquo: '»', hellip: '…', deg: '°', times: '×', copy: '©' };
const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

export const cleanDescription = (s) =>
  decode(decode(
    String(s || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  ))
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000);

// Рядок для market.product_details з даних постачальника; «-» у MyDrop означає товар без розмірів.
export function detailsRow(id, item) {
  return {
    id,
    description: cleanDescription(item.description) || null,
    images: item.images.slice(0, 10),
    sizes: item.sizes.filter((z) => (z.title || '-') !== '-'),
    size_chart: item.sizeChart || null,
    updated_at: new Date().toISOString(),
  };
}

// Схвалені відгуки товару (market.reviews, approved = true). Порожній масив, якщо відгуків нема.
export async function getApprovedReviews(productId) {
  if (!process.env.SUPABASE_URL) return [];
  try {
    const res = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/reviews?product_id=eq.${encodeURIComponent(productId)}&approved=is.true&select=rating,name,text,verified,created_at&order=created_at.desc&limit=50`,
      { headers: sb(), next: { revalidate: 300 } }
    );
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}
