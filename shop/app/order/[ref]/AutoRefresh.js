'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Поки чекаємо підтвердження оплати від mono, перечитуємо сторінку кожні 5 с (до ~3 хв).
export default function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => (++n > 36 ? clearInterval(t) : router.refresh()), 5000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
