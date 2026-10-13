import data from '../data/products.json';
import Catalog from './Catalog';

export default function Page() {
  return (
    <main>
      <header className="top">
        <h1>Форпост</h1>
        <p>Товари напряму зі складу постачальників · оновлено {new Date(data.updated).toLocaleDateString('uk-UA')}</p>
      </header>
      <Catalog products={data.products} vendors={data.vendors} />
    </main>
  );
}
