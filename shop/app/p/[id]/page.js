import { notFound } from 'next/navigation';
import data from '../../../data/products.json';
import { groupOf } from '../../../lib/groups';
import ProductBuy from './ProductBuy';
import { retailPrice } from '../../../lib/pricing';

const find = (id) => {
  const p = data.products.find((x) => x.id === id);
  return p && { ...p, price: retailPrice(p.price) };
};

export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = find(id);
  if (!p) return { title: 'Товар не знайдено — Форпост' };
  return {
    title: `${p.title} — Форпост`,
    description: `${p.title}. ${p.price} ₴. Оплата карткою, доставка Новою Поштою.`,
    openGraph: { images: [p.image] },
  };
}

export default async function Page({ params }) {
  const { id } = await params;
  const p = find(id);
  if (!p) notFound();
  const group = groupOf(p);
  const money = new Intl.NumberFormat('uk-UA');

  return (
    <main>
      <nav className="crumbs" aria-label="Навігація">
        <a href="/">Каталог</a><span>/</span>
        <span>{group}</span><span>/</span>
        <span>{p.category.trim()}</span>
      </nav>

      <div className="product">
        <div className="p-media">
          <img src={p.image} alt={p.title} />
        </div>

        <div className="p-info">
          <div className="p-meta">
            <span>{p.vendor}</span>
            {p.sku && <span>Арт. {p.sku}</span>}
            <span className={p.stock > 0 ? 'stock ok' : 'stock'}>{p.stock > 0 ? `в наявності: ${p.stock}` : 'немає в наявності'}</span>
          </div>
          <h1>{p.title}</h1>
          <div className="p-price">{money.format(p.price)} ₴</div>

          <div className="p-card">
            <h2>Оформити замовлення</h2>
            <ProductBuy product={{ id: p.id, title: p.title, price: p.price, stock: p.stock, vendor: p.vendor }} />
          </div>

          <ul className="trust">
            <li><i>₴</i><div><b>Оплата карткою онлайн</b>Через monobank. Дані картки нам не передаються.</div></li>
            <li><i>→</i><div><b>Доставка Новою Поштою</b>Відправляємо зі складу постачальника після підтвердження оплати.</div></li>
            <li><i>↺</i><div><b>Повернення 14 днів</b>Товар належної якості можна повернути за законом. <a href="/povernennya">Умови</a></div></li>
          </ul>
        </div>
      </div>
    </main>
  );
}
