// Класифікує весь каталог «група → тип» за назвою, категорією й ОПИСОМ (market.product_details) і пише data/classification.json.
// Запуск: node --env-file=../.env scripts/classify.mjs   (з папки shop). Перезапускати після оновлення каталогу.
import { readFileSync, writeFileSync } from 'node:fs';
import { legacyGroupOf, legacyTypeOf } from '../lib/groups-legacy.mjs';
import { classifyRest } from '../lib/taxonomy.mjs';

const MAIN = new Set(['Військовий і тактичний одяг', 'Тактичне спорядження і захист', 'Акумуляторні станції та енергія']);
const data = JSON.parse(readFileSync(new URL('../data/products.json', import.meta.url), 'utf8'));

const SB = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const desc = new Map();
if (SB && KEY) {
  for (let off = 0; off < 6000; off += 1000) {
    const res = await fetch(`${SB}/rest/v1/product_details?select=id,description&order=id&limit=1000&offset=${off}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Accept-Profile': 'market' },
    });
    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) break;
    for (const r of rows) desc.set(r.id, r.description || '');
    if (rows.length < 1000) break;
  }
}
console.log(`описів завантажено: ${desc.size}`);

const out = {};
const stat = {};
for (const p of data.products) {
  const d = desc.get(p.id) || '';
  const lg = legacyGroupOf(p);
  let g, t;
  if (MAIN.has(lg)) {
    g = lg;
    t = legacyTypeOf(p, g);
    // якщо за назвою/категорією тип не визначено — пробуємо за описом
    if (t === 'Інше') {
      const t2 = legacyTypeOf({ category: p.category, title: `${p.title} ${d.slice(0, 300)}` }, g);
      if (t2 !== 'Інше') t = t2;
    }
  } else {
    ({ g, t } = classifyRest(p, d, lg));
  }
  out[p.id] = [g, t];
  const k = `${g} / ${t}`;
  stat[k] = (stat[k] || 0) + 1;
}
// компактний формат: словники груп і типів + індекси (файл у ~6 разів менший)
const gl = [];
const tl = [];
const idx = (arr, v) => (arr.includes(v) ? arr.indexOf(v) : arr.push(v) - 1);
const m = {};
for (const [id, [g, t]] of Object.entries(out)) m[id] = [idx(gl, g), idx(tl, t)];
writeFileSync(new URL('../data/classification.json', import.meta.url), JSON.stringify({ g: gl, t: tl, m }));
const byGroup = {};
for (const [k, n] of Object.entries(stat)) { const [g] = k.split(' / '); (byGroup[g] ||= []).push([k.split(' / ').slice(1).join(' / '), n]); }
for (const [g, arr] of Object.entries(byGroup)) {
  const tot = arr.reduce((a, [, n]) => a + n, 0);
  console.log(`\n== ${g} (${tot})`);
  console.log('  ' + arr.sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} (${n})`).join(' | '));
}
