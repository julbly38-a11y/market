import data from '../data/products.json';
import Catalog from './Catalog';
import { GROUPS, groupOf, typeOf, typeRank, typeRow } from '../lib/groups';
import HeroCategories from './HeroCategories';
import { listSets } from '../lib/sets';
import SetCards from './SetCards';
import { retailPrice } from '../lib/pricing';
import { getFreshPrices, withFresh } from '../lib/prices';

export const revalidate = 900; // ціни й залишки оновлюються щодоби, кеш 15 хв

export default async function Page() {
  const fresh = await getFreshPrices();
  const products = data.products.map((p) => {
    const group = groupOf(p);
    return { ...withFresh(p, fresh, retailPrice), group, type: typeOf(p, group) };
  });
  const sets = (await listSets()).filter((x) => x.items.length && x.available);
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
    types: (() => {
      const list = [...(typesOf.get(g) || [])]
        .sort((a, b) => typeRank(g, a[0]) - typeRank(g, b[0]) || b[1].count - a[1].count)
        .slice(0, 24);
      return list.map(([name, t], i) => ({ name, image: t.image, count: t.count, row: typeRow(g, name, i, list.length) }));
    })(),
  }));
  return (
    <>
      <section className="hero-dark">
        <HeroCategories items={categories} />
      </section>

      <main>
        {sets.length > 0 && (
          <section className="sets-block" aria-label="Набори">
            <h2 className="sets-title">Військові набори <a href="/nabory" className="sets-all">Усі набори →</a></h2>
            <SetCards sets={sets} />
          </section>
        )}
        <Catalog products={products} vendors={data.vendors} />
      </main>
    </>
  );
}
