// Фід товарів для Google Merchant Center (RSS 2.0, простір імен g:). Лише товари в наявності, ціна — жива (market.supplier_prices).
// У Merchant Center: Продукти → Фіди → додати фід за URL <сайт>/feed/google.xml, країна Україна, мова українська.
import data from '../../../data/products.json';
import { retailPrice } from '../../../lib/pricing';
import { getFreshPrices } from '../../../lib/prices';
import { sb } from '../../../lib/orders';

export const revalidate = 3600;

const esc = (s) => String(s ?? '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]);

async function loadDetails() {
  const map = new Map();
  try {
    for (let from = 0; ; from += 1000) {
      const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/product_details?select=id,description,images&order=id&limit=1000&offset=${from}`, { headers: sb(), next: { revalidate: 3600 } });
      const rows = await res.json();
      if (!Array.isArray(rows)) break;
      for (const r of rows) map.set(r.id, r);
      if (rows.length < 1000) break;
    }
  } catch {}
  return map;
}

export async function GET() {
  const base = (process.env.SITE_URL || 'https://forpost-shop.vercel.app').replace(/\/$/, '');
  const [fresh, details] = await Promise.all([getFreshPrices(), loadDetails()]);
  const items = [];
  for (const p of data.products) {
    const f = fresh.get(p.id);
    const stock = f ? f.stock : p.stock;
    if (stock < 1) continue;
    const price = retailPrice(f?.price || p.price);
    const d = details.get(p.id);
    const images = d?.images?.length ? d.images : [p.image];
    const desc = (d?.description || p.title).replace(/\s+/g, ' ').trim().slice(0, 4900);
    items.push(`<item>
<g:id>${esc(p.id)}</g:id>
<g:title>${esc(p.title.slice(0, 150))}</g:title>
<g:description>${esc(desc)}</g:description>
<g:link>${base}/p/${esc(p.id)}</g:link>
<g:image_link>${esc(images[0])}</g:image_link>
${images.slice(1, 6).map((u) => `<g:additional_image_link>${esc(u)}</g:additional_image_link>`).join('\n')}
<g:availability>in_stock</g:availability>
<g:price>${price}.00 UAH</g:price>
<g:condition>new</g:condition>
<g:identifier_exists>no</g:identifier_exists>
<g:product_type>${esc(p.category.trim())}</g:product_type>
</item>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Форпост</title>
<link>${base}</link>
<description>Товари напряму зі складів постачальників</description>
${items.join('\n')}
</channel>
</rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
