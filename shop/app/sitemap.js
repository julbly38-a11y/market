import data from '../data/products.json';
import { getFreshPrices } from '../lib/prices';

const SITE = (process.env.SITE_URL || 'https://forpost-shop.vercel.app').replace(/\/$/, '');

export const revalidate = 3600;

// Каталог, юридичні сторінки й усі товари в наявності (без застарілих).
export default async function sitemap() {
  const fresh = await getFreshPrices();
  const now = new Date();
  const pages = ['', '/povernennya', '/oferta', '/konfidentsiynist'].map((p) => ({ url: `${SITE}${p}`, lastModified: now }));
  const products = data.products
    .filter((p) => (fresh.get(p.id)?.stock ?? p.stock) > 0)
    .map((p) => ({ url: `${SITE}/p/${p.id}`, lastModified: now }));
  return [...pages, ...products];
}
