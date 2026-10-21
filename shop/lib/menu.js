// Дані для випадаючого меню шапки: у кожній групі найбільші підкатегорії (за кількістю товарів у наявності).
import data from '../data/products.json';
import { GROUPS, groupOf } from './groups';

export const MENU_GROUPS = [
  { group: 'Військовий і тактичний одяг', label: 'Одяг' },
  { group: 'Тактичне спорядження і захист', label: 'Спорядження' },
  { group: 'Акумуляторні станції та енергія', label: 'Енергія' },
];

let cache;
export function getMenu() {
  if (cache) return cache;
  const byGroup = new Map();
  const totals = new Map();
  for (const p of data.products) {
    const g = groupOf(p);
    totals.set(g, (totals.get(g) || 0) + 1);
    if (p.stock < 1) continue;
    const m = byGroup.get(g) || new Map();
    const c = p.category.trim();
    m.set(c, (m.get(c) || 0) + 1);
    byGroup.set(g, m);
  }
  const sections = MENU_GROUPS.map(({ group, label }) => ({
    group,
    label,
    categories: [...(byGroup.get(group) || new Map())]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 18)
      .map(([name, count]) => ({ name, count })),
  }));
  const groups = GROUPS.filter((g) => totals.has(g)).map((g) => ({ group: g, total: totals.get(g) }));
  cache = { sections, groups, total: data.products.length };
  return cache;
}
