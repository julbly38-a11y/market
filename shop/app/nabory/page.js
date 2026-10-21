import { listSets } from '../../lib/sets';
import SetCards from '../SetCards';

export const revalidate = 300;
export const metadata = { title: 'Військові набори — Форпост', description: 'Готові комплекти одягу й спорядження: взуття, штани, ремінь, фліска, куртка, головний убір, окуляри, рукавиці.', alternates: { canonical: '/nabory' } };

export default async function Page() {
  const sets = (await listSets()).filter((x) => x.items.length);
  const open = sets.filter((x) => x.available);
  const closed = sets.filter((x) => !x.available);
  return (
    <main>
      <nav className="crumbs" aria-label="Навігація"><a href="/">Каталог</a><span>/</span><span>Набори</span></nav>
      <h1 style={{ margin: '0 0 6px' }}>Військові набори</h1>
      <p className="dim">Готові комплекти: усе потрібне одним замовленням, розмір вибираєте для кожної речі окремо.</p>
      {open.length ? <SetCards sets={open} /> : <p className="empty">Зараз немає доступних наборів.</p>}
      {closed.length > 0 && (
        <>
          <h2 className="sets-title" style={{ marginTop: 36 }}>Тимчасово недоступні</h2>
          <SetCards sets={closed} />
        </>
      )}
    </main>
  );
}
