// Тягне з MyDrop повні дані товарів (опис, усі фото, розміри із залишками, таблиця розмірів)
// і пише їх у Supabase market.product_details. Запуск: node --env-file=../.env scripts/sync-details.mjs

const BASE = 'https://backend.mydrop.com.ua/dropshipper/api';
const KEY = process.env.MYDROP_API_KEY;
const SB = process.env.SUPABASE_URL;
const SBKEY = process.env.SUPABASE_SERVICE_KEY;
if (!KEY || !SB || !SBKEY) throw new Error('Потрібні MYDROP_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY');

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-API-KEY': KEY } });
  return res.ok ? res.json() : null;
};

const clean = (s) =>
  String(s || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 4000);

const vendors = (await get('/dropshipper_vendors')).results;
let total = 0;
for (const dv of vendors) {
  const json = await get(`/export/dropshipper_vendors/${dv.id}/products/json`);
  if (!json) { console.log(`${dv.vendor.name}: каталог не готовий, пропуск`); continue; }
  const rows = json.products
    .filter((p) => p.price && p.images?.length)
    .map((p) => ({
      id: `${dv.id}-${p.id}`,
      description: clean(p.description) || null,
      images: p.images.slice(0, 10).map((i) => i.full_url),
      // «-» у MyDrop означає товар без розмірів
      sizes: (p.sizes || [])
        .filter((z) => (z.title || '-') !== '-')
        .map((z) => ({ title: z.title, stock: z.real_count_dropshipper || 0 })),
      size_chart: p.size_chart_image?.full_url || (typeof p.size_chart_image === 'string' ? p.size_chart_image : null),
      updated_at: new Date().toISOString(),
    }));
  for (let i = 0; i < rows.length; i += 300) {
    const res = await fetch(`${SB}/rest/v1/product_details?on_conflict=id`, {
      method: 'POST',
      headers: { apikey: SBKEY, Authorization: `Bearer ${SBKEY}`, 'Content-Type': 'application/json', 'Content-Profile': 'market', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows.slice(i, i + 300)),
    });
    if (!res.ok) throw new Error(`${dv.vendor.name}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  total += rows.length;
  console.log(`${dv.vendor.name}: ${rows.length}`);
}
console.log(`Разом записано: ${total}`);
