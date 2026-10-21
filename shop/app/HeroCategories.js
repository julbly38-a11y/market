'use client';

import { useRef } from 'react';

// Стрічка категорій у чорному банері: горизонтальна прокрутка (свайп, коліщатко, стрілки).
export default function HeroCategories({ items }) {
  const ref = useRef(null);
  const scroll = (dir) => ref.current?.scrollBy({ left: dir * Math.max(ref.current.clientWidth * 0.8, 240), behavior: 'smooth' });
  return (
    <div className="hero-cats">
      <div className="hero-cats-head">
        <span className="hero-eyebrow">Категорії</span>
        <span className="hero-arrows">
          <button type="button" aria-label="Назад" onClick={() => scroll(-1)}>←</button>
          <button type="button" aria-label="Далі" onClick={() => scroll(1)}>→</button>
        </span>
      </div>
      <div className="hero-scroll" ref={ref}>
        {items.map((c) => (
          <a key={c.group} className="cat-card" href={`/?g=${encodeURIComponent(c.group)}#catalog`}>
            <span className="cat-img"><img src={c.image} alt="" loading="lazy" /></span>
            <span className="cat-name">{c.group}</span>
            <span className="cat-count">{c.count}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
