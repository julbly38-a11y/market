'use client';

import { useEffect, useState } from 'react';
import { onCartChange, readCart } from './cartStore';

// Посилання на кошик у шапці з лічильником позицій.
export default function CartLink() {
  const [n, setN] = useState(0);
  useEffect(() => {
    const upd = () => setN(readCart().reduce((s, x) => s + x.qty, 0));
    upd();
    return onCartChange(upd);
  }, []);
  return (
    <a className="cart-link" href="/cart" aria-label={`Кошик${n ? `, товарів: ${n}` : ''}`}>
      Кошик{n > 0 && <span className="cart-count">{n}</span>}
    </a>
  );
}
