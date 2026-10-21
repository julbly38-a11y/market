import { notFound } from 'next/navigation';
import { getSetRow, resolveSet } from '../../../lib/sets';
import { getProductDetails } from '../../../lib/details';
import SetBuy from './SetBuy';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const row = await getSetRow(slug);
  if (!row) return { title: 'Набір не знайдено — Форпост' };
  return { title: `${row.title} — Форпост`, description: row.description || row.title, alternates: { canonical: `/nabir/${slug}` } };
}

export default async function Page({ params }) {
  const { slug } = await params;
  const row = await getSetRow(slug);
  if (!row) notFound();
  const set = await resolveSet(row);
  if (!set.items.length) notFound();
  const sizes = await Promise.all(set.items.map(async (i) => (await getProductDetails(i.id))?.sizes || []));
  const items = set.items.map((i, n) => ({ ...i, sizes: sizes[n] }));
  const saved = set.fullPrice - set.total;

  return (
    <main>
      <nav className="crumbs" aria-label="Навігація">
        <a href="/">Каталог</a><span>/</span><span>Набори</span><span>/</span><span>{set.title}</span>
      </nav>
      <h1 style={{ margin: '0 0 6px' }}>{set.title}</h1>
      {set.description && <p className="dim">{set.description}</p>}
      <SetBuy
        slug={slug}
        title={set.title}
        vendor={set.vendor}
        discount={Number(set.discount_percent) || 0}
        fullPrice={set.fullPrice}
        total={set.total}
        saved={saved}
        available={set.available}
        items={items}
      />
    </main>
  );
}
