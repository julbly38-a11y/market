// Набори (комплекти) одягу: market.sets, слот = стовпець з id товару. Усі речі одного набору — від одного постачальника.
import data from '../data/products.json';
import { retailPrice } from './pricing';
import { sb } from './orders';
import { getFreshPrices } from './prices';

export const SET_SLOTS = [
  ['boots_id', 'Взуття'],
  ['pants_id', 'Штани'],
  ['belt_id', 'Ремінь'],
  ['top_id', 'Фліска / кофта'],
  ['base_id', 'Байка (базовий шар)'],
  ['jacket_id', 'Куртка'],
  ['headwear_id', 'Головний убір'],
  ['glasses_id', 'Окуляри'],
  ['gloves_id', 'Рукавиці'],
  ['armor_id', 'Бронезахист'],
];

const byId = new Map(data.products.map((p) => [p.id, p]));
export const salePrice = (retail, discount) => Math.ceil(retail * (1 - (Number(discount) || 0) / 100));

async function rest(path) {
  if (!process.env.SUPABASE_URL) return [];
  try {
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { headers: sb(), next: { revalidate: 300 } });
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export const listSetRows = () => rest('sets?active=is.true&select=*&order=id');
export async function getSetRow(slug) {
  const rows = await rest(`sets?active=is.true&slug=eq.${encodeURIComponent(slug)}&select=*`);
  return rows[0] || null;
}

// Збирає набір зі свіжими цінами й залишками (знімок каталогу, якщо свіжих нема).
export async function resolveSet(row, fresh) {
  fresh = fresh || (await getFreshPrices());
  const items = [];
  for (const [slot, label] of SET_SLOTS) {
    const id = row[slot];
    if (!id) continue;
    const p = byId.get(id);
    if (!p) return { ...row, items: [], total: 0, available: false };
    const f = fresh.get(id);
    const retail = retailPrice(f?.price || p.price);
    items.push({
      slot, label, id, title: p.title, image: p.image, sku: p.sku, vendor: p.vendor,
      retail, price: salePrice(retail, row.discount_percent), stock: f ? f.stock : p.stock,
    });
  }
  const fullPrice = items.reduce((s, i) => s + i.retail, 0);
  const total = items.reduce((s, i) => s + i.price, 0);
  return { ...row, items, fullPrice, total, available: items.length > 0 && items.every((i) => i.stock > 0) };
}

export async function listSets() {
  const [rows, fresh] = await Promise.all([listSetRows(), getFreshPrices()]);
  return Promise.all(rows.map((r) => resolveSet(r, fresh)));
}
