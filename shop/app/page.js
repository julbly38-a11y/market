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
      <footer className="dim" style={{ marginTop: 32 }}>
        Оплата карткою онлайн (monobank). Відправка Новою Поштою після підтвердження оплати.{' '}
        <a href="/oferta">Публічна оферта</a> · <a href="/povernennya">Повернення і доставка</a>
      </footer>
    </main>
  );
}
