'use client';

import { useRef } from 'react';

// Горизонтальна стрічка карток у випадаючому меню: прокрутка коліщатком/свайпом і стрілками.
export default function MegaScroller({ items }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * 360, behavior: 'smooth' });
  return (
    <div className="mega-side">
      <div className="mega-scroll" ref={ref}>
        {items.map((it) => (
          <a key={it.href} className="mega-card" href={it.href}>
            <span className="mega-img">{it.image ? <img src={it.image} alt="" loading="lazy" /> : null}</span>
            <span className="mega-name">{it.name}</span>
          </a>
        ))}
      </div>
      <button type="button" className="mega-arrow left" aria-label="Назад" onClick={() => scroll(-1)}>←</button>
      <button type="button" className="mega-arrow right" aria-label="Далі" onClick={() => scroll(1)}>→</button>
    </div>
  );
}
