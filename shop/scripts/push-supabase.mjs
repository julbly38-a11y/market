// Кладе data/products.json у існуючі таблиці схеми market:
//   products        — один рядок на товар (url = ідентифікатор https://mydrop.com.ua/catalog/<постачальник>/<id>; source у БД обчислюється з хосту)
//   price_snapshots — запис ціни/наявності на момент запуску (історія накопичується)
// Запуск: npm run push   (після npm run sync)

import { readFileSync } from 'node:fs';

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SB || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY не задано в ../.env');

const { products } = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));
const dryRun = process.argv.includes('--dry');

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'market',
  'Content-Profile': 'market',
};

async function post(path, rows, prefer) {
  const res = await fetch(`${SB}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...headers, Prefer: prefer },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));

const keyOf = (p) => `https://mydrop.com.ua/catalog/${p.id.replace('-', '/')}`;

const rows = products.map((p) => ({
  url: keyOf(p),
  label: `${p.vendor} · ${p.category}`,
  name: p.title,
  sku: String(p.sku ?? ''),
}));

if (dryRun) {
  console.log(`dry-run: було б записано ${rows.length} товарів і ${rows.length} знімків ціни`);
  process.exit(0);
}

const idByUrl = new Map();
for (const part of chunks(rows, 500)) {
  const saved = await post('products?on_conflict=url', part, 'resolution=merge-duplicates,return=representation');
  for (const r of saved) idByUrl.set(r.url, r.id);
  process.stdout.write(`products: ${idByUrl.size}/${rows.length}\r`);
}
console.log();

const checkedAt = new Date().toISOString();
const snaps = products.map((p) => ({
  product_id: idByUrl.get(keyOf(p)),
  price: p.price,
  currency: 'UAH',
  availability: p.stock > 0 ? 'InStock' : 'OutOfStock',
  seller: p.vendor,
  checked_at: checkedAt,
}));
let n = 0;
for (const part of chunks(snaps, 500)) {
  await post('price_snapshots', part, 'return=minimal');
  n += part.length;
  process.stdout.write(`price_snapshots: ${n}/${snaps.length}\r`);
}
console.log(`\nГотово: ${idByUrl.size} товарів, ${n} знімків ціни`);
