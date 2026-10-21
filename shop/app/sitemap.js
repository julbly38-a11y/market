import data from '../data/products.json';
import { getFreshPrices } from '../lib/prices';
import { listSetRows } from '../lib/sets';

import { SITE_BASE as SITE } from '../lib/site';

export const revalidate = 3600;

// Каталог, юридичні сторінки й усі товари в наявності (без застарілих).
export default async function sitemap() {
  const fresh = await getFreshPrices();
  const now = new Date();
  const pages = ['', '/povernennya', '/oferta', '/konfidentsiynist'].map((p) => ({ url: `${SITE}${p}`, lastModified: now }));
  const products = data.products
    .filter((p) => (fresh.get(p.id)?.stock ?? p.stock) > 0)
    .map((p) => ({ url: `${SITE}/p/${p.id}`, lastModified: now }));
  const sets = (await listSetRows()).map((x) => ({ url: `${SITE}/nabir/${x.slug}`, lastModified: now }));
  return [...pages, ...sets, ...products];
}
