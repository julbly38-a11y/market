import CartView from './CartView';

export const metadata = { title: 'Кошик — Форпост', robots: { index: false, follow: false } };

export default function CartPage() {
  return (
    <main className="wrap" style={{ padding: '32px 20px', maxWidth: 860 }}>
      <h1>Кошик</h1>
      <CartView />
    </main>
  );
}
