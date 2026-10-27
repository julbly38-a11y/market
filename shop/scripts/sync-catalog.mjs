// Тягне каталоги підключених постачальників MyDrop і зберігає легкий data/products.json для сайту.
// Запуск: npm run sync   (ключ береться з ../.env, на сайт він не потрапляє)

import { writeFileSync } from 'node:fs';
import { inAssortment } from '../lib/assortment.mjs';

const BASE = 'https://backend.mydrop.com.ua/dropshipper/api';
const KEY = process.env.MYDROP_API_KEY;
if (!KEY) throw new Error('MYDROP_API_KEY не задано в ../.env');

const get = async (path) => {
  const res = await fetch(`${BASE}${path}`, { headers: { 'X-API-KEY': KEY } });
  return { status: res.status, json: res.status === 200 ? await res.json() : null };
};

const { json: vendorsJson } = await get('/dropshipper_vendors');
const products = [];
const vendors = [];

for (const dv of vendorsJson.results) {
  const name = dv.vendor.name;
  const { status, json } = await get(`/export/dropshipper_vendors/${dv.id}/products/json`);
  if (!json) {
    console.log(`${name}: каталог ще не готовий (HTTP ${status}), пропускаю`);
    continue;
  }
  const cats = new Map(json.categories.map((c) => [c.id, c.title]));
  let kept = 0;
  for (const p of json.products) {
    if (!p.price || !p.images?.length) continue;
    if (!inAssortment(name, cats.get(p.category_id))) continue; // лише військова тема й енергетика
    const stock = (p.sizes || []).reduce((s, z) => s + (z.real_count_dropshipper || 0), 0);
    products.push({
      id: `${dv.id}-${p.id}`,
      sku: p.sku,
      title: p.title,
      price: p.price, // рекомендована роздрібна ціна (RRP)
      drop: p.drop_price || null, // ціна закупівлі для дропшипера; порожня = собівартість невідома
      image: p.images[0].full_url,
      category: cats.get(p.category_id) || 'Інше',
      vendor: name,
      stock,
    });
    kept++;
  }
  vendors.push(name);
  console.log(`${name}: ${kept} з ${json.products.length} товарів (з ціною і фото)`);
}

writeFileSync(new URL('../data/products.json', import.meta.url), JSON.stringify({ updated: new Date().toISOString(), vendors, products }));
console.log(`Разом: ${products.length} товарів → data/products.json`);
