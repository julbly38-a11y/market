import data from '../data/products.json';
import Catalog from './Catalog';
import { GROUPS, groupOf, typeOf, typeRank } from '../lib/groups';
import HeroCategories from './HeroCategories';
import { retailPrice } from '../lib/pricing';
import { getFreshPrices, withFresh } from '../lib/prices';

export const revalidate = 900; // ціни й залишки оновлюються щодоби, кеш 15 хв

export default async function Page() {
  const fresh = await getFreshPrices();
  const products = data.products.map((p) => {
    const group = groupOf(p);
    return { ...withFresh(p, fresh, retailPrice), group, type: typeOf(p, group) };
  });
  const counts = new Map();
  const imageOf = new Map();
  const typesOf = new Map(); // група → тип → { count, image } (лише товари в наявності)
  for (const p of products) {
    counts.set(p.group, (counts.get(p.group) || 0) + 1);
    if (p.stock < 1 || !p.image) continue;
    if (!imageOf.has(p.group)) imageOf.set(p.group, p.image);
    const m = typesOf.get(p.group) || new Map();
    const t = m.get(p.type) || { count: 0, image: p.image };
    t.count++;
    m.set(p.type, t);
    typesOf.set(p.group, m);
  }
  const categories = GROUPS.filter((g) => imageOf.has(g)).map((g) => ({
    group: g,
    image: imageOf.get(g),
    count: counts.get(g),
    types: [...(typesOf.get(g) || [])]
      .sort((a, b) => typeRank(g, a[0]) - typeRank(g, b[0]) || b[1].count - a[1].count)
      .slice(0, 24)
      .map(([name, t]) => ({ name, image: t.image, count: t.count })),
  }));
  return (
    <>
      <section className="hero-dark">
        <HeroCategories items={categories} />
      </section>

      <main>
        <Catalog products={products} vendors={data.vendors} />
      </main>
    </>
  );
}
