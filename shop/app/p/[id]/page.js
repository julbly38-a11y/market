import { notFound } from 'next/navigation';
import data from '../../../data/products.json';
import { groupOf, typeOf } from '../../../lib/groups';
import ProductBuy from './ProductBuy';
import { minOrderFor } from '../../../lib/orders';
import Gallery from './Gallery';
import ReviewBox from './ReviewBox';
import { getApprovedReviews, getProductDetails } from '../../../lib/details';
import { retailPrice } from '../../../lib/pricing';
import { getFreshPrices, withFresh } from '../../../lib/prices';

const find = async (id) => {
  const p = data.products.find((x) => x.id === id);
  return p && withFresh(p, await getFreshPrices(), retailPrice);
};

export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = await find(id);
  if (!p) return { title: 'Товар не знайдено — Форпост' };
  return {
    title: `${p.title} — Форпост`,
    description: `${p.title}. ${p.price} ₴. Оплата карткою, доставка Новою Поштою.`,
    alternates: { canonical: `/p/${p.id}` },
    openGraph: { images: [p.image], title: p.title, type: 'website' },
  };
}

export default async function Page({ params }) {
  const { id } = await params;
  const p = await find(id);
  if (!p) notFound();
  const details = await getProductDetails(p.id);
  const reviews = await getApprovedReviews(p.id);
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const images = details?.images?.length ? details.images : [p.image];
  const sizes = details?.sizes || [];
  const group = groupOf(p);
  const money = new Intl.NumberFormat('uk-UA');

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: p.title,
            image: images,
            description: (details?.description || p.title).slice(0, 500),
            sku: String(p.sku || p.id),
            offers: {
              '@type': 'Offer',
              url: `/p/${p.id}`,
              priceCurrency: 'UAH',
              price: String(p.price),
              itemCondition: 'https://schema.org/NewCondition',
              availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            },
            ...(reviews.length ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: avg.toFixed(1), reviewCount: reviews.length } } : {}),
          }),
        }}
      />
      <nav className="crumbs" aria-label="Навігація">
        <a href="/">Каталог</a><span>/</span>
        <span>{group}</span><span>/</span>
        <span>{typeOf(p, group)}</span>
      </nav>

      <div className="product">
        <div className="p-media">
          <Gallery images={images} alt={p.title} />
        </div>

        <div className="p-info">
          <div className="p-meta">
            <span>{p.vendor}</span>
            {p.sku && <span>Арт. {p.sku}</span>}
            <span className={p.stock > 0 ? 'stock ok' : 'stock'}>{p.stock > 0 ? `в наявності: ${p.stock}` : 'немає в наявності'}</span>
          </div>
          <h1>{p.title}</h1>
          <div className="p-price">{money.format(p.price)} ₴</div>

          <ul className="trust compact">
            <li><i>₴</i><div><b>Оплата карткою або при отриманні</b>Через monobank, дані картки нам не передаються</div></li>
            <li><i>→</i><div><b>Нова Пошта</b>Відправляємо після підтвердження замовлення</div></li>
            <li><i>↺</i><div><b>Повернення 14 днів</b><a href="/povernennya">Умови</a></div></li>
          </ul>

          <div className="p-card">
            <h2>Оформити замовлення</h2>
            <ProductBuy product={{ id: p.id, title: p.title, price: p.price, stock: p.stock, vendor: p.vendor, sizes, minOrder: minOrderFor(p.vendor) }} />
          </div>
        </div>
      </div>

      <div className="p-extra">
        {details?.description && (
          <section className="p-sec">
            <h2>Опис</h2>
            <p className="p-text">{details.description}</p>
          </section>
        )}
        {details?.size_chart && (
          <section className="p-sec">
            <h2>Таблиця розмірів</h2>
            <img src={details.size_chart} alt="Таблиця розмірів" style={{ maxWidth: '100%' }} />
          </section>
        )}
        {reviews.length > 0 && (
          <section className="p-sec">
            <h2>Відгуки <span className="stars">★</span> {avg.toFixed(1)} <span className="dim-count">({reviews.length})</span></h2>
            {reviews.map((r, i) => (
              <div key={i} className="review">
                <div><span className="stars">{'★'.repeat(r.rating)}</span><span className="stars off">{'★'.repeat(5 - r.rating)}</span> <b>{r.name}</b> {r.verified && <small className="verified">підтверджена покупка</small>}</div>
                {r.text && <p>{r.text}</p>}
              </div>
            ))}
          </section>
        )}
        <section className="p-sec">
          <ReviewBox productId={p.id} />
        </section>
      </div>
    </main>
  );
}
