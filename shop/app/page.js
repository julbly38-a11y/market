import data from '../data/products.json';
import Catalog from './Catalog';
import { groupOf } from '../lib/groups';
import { retailPrice } from '../lib/pricing';

const products = data.products.map((p) => ({ ...p, price: retailPrice(p.price), group: groupOf(p) }));

export default function Page() {
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
