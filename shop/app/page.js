import data from '../data/products.json';
import Catalog from './Catalog';
import { GROUPS, groupOf } from '../lib/groups';
import HeroCategories from './HeroCategories';
import { retailPrice } from '../lib/pricing';
import { getFreshPrices, withFresh } from '../lib/prices';

export const revalidate = 900; // ціни й залишки оновлюються щодоби, кеш 15 хв

export default async function Page() {
  const fresh = await getFreshPrices();
  const products = data.products.map((p) => ({ ...withFresh(p, fresh, retailPrice), group: groupOf(p) }));
  const counts = new Map();
  const imageOf = new Map();
  for (const p of products) {
    counts.set(p.group, (counts.get(p.group) || 0) + 1);
    if (!imageOf.has(p.group) && p.stock > 0 && p.image) imageOf.set(p.group, p.image);
  }
  const categories = GROUPS.filter((g) => imageOf.has(g)).map((g) => ({ group: g, image: imageOf.get(g), count: counts.get(g) }));
  return (
    <>
      <section className="hero-dark">
        <div className="wrap hero-in">
          <HeroCategories items={categories} />
        </div>
      </section>

      <main>
        <Catalog products={products} vendors={data.vendors} />
      </main>
    </>
  );
}
