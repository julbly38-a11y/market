import data from '../data/products.json';
import Catalog from './Catalog';
import { groupOf } from '../lib/groups';
import { retailPrice } from '../lib/pricing';
import { getFreshPrices, withFresh } from '../lib/prices';

export const revalidate = 900; // ціни й залишки оновлюються щодоби, кеш 15 хв

export default async function Page() {
  const fresh = await getFreshPrices();
  const products = data.products.map((p) => ({ ...withFresh(p, fresh, retailPrice), group: groupOf(p) }));
  return (
    <main>
      <section className="hero">
        <h1>Усе потрібне — напряму зі складу</h1>
        <p>Одяг, спорядження, енергія та інше від перевірених постачальників. Оплата карткою, відправка Новою Поштою.</p>
      </section>
      <Catalog products={products} vendors={data.vendors} />
    </main>
  );
}
