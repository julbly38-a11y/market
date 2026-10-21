import data from '../data/products.json';
import Catalog from './Catalog';
import { groupOf } from '../lib/groups';
import { retailPrice } from '../lib/pricing';
import { getFreshPrices, withFresh } from '../lib/prices';

export const revalidate = 900; // ціни й залишки оновлюються щодоби, кеш 15 хв

export default async function Page() {
  const fresh = await getFreshPrices();
  const products = data.products.map((p) => ({ ...withFresh(p, fresh, retailPrice), group: groupOf(p) }));
  const tileGroups = ['Військовий і тактичний одяг', 'Тактичне спорядження і захист', 'Акумуляторні станції та енергія', 'Прикраси та аксесуари'];
  const tiles = tileGroups
    .map((g) => ({ g, p: products.find((x) => x.group === g && x.stock > 0 && x.image) }))
    .filter((t) => t.p);
  return (
    <>
      <section className="hero-dark">
        <div className="wrap hero-in">
          <p className="hero-eyebrow">Форпост</p>
          <h1>Усе потрібне — напряму зі складу</h1>
          <p className="hero-sub">Одяг, спорядження й енергія від перевірених постачальників. Оплата карткою або накладеним платежем, відправка Новою Поштою.</p>
          <a className="btn-outline" href="#catalog">До каталогу</a>
        </div>
      </section>

      <section className="wrap tiles" aria-label="Категорії">
        {tiles.map(({ g, p }) => (
          <a key={g} className="tile" href={`/?g=${encodeURIComponent(g)}#catalog`}>
            <img src={p.image} alt="" loading="lazy" />
            <span>{g}</span>
          </a>
        ))}
      </section>

      <main>
        <Catalog products={products} vendors={data.vendors} />
      </main>
    </>
  );
}
