'use client';

import { useRef, useState } from 'react';

const href = (g, c) => `/?g=${encodeURIComponent(g)}${c ? `&c=${encodeURIComponent(c)}` : ''}#catalog`;

// Чорний банер: стрічка категорій. При наведенні на категорію решта зникає, а праворуч від вибраної
// на тому ж місці зʼявляються фото її підкатегорій (власна горизонтальна прокрутка).
// Курсор пішов із банера — повертаються всі категорії. На сенсорних екранах перший дотик відкриває підкатегорії, другий веде в каталог.
export default function HeroCategories({ items }) {
  const [active, setActive] = useState(null);
  const strip = useRef(null);
  const sub = useRef(null);
  const by = (dir) => {
    const el = active ? sub.current : strip.current;
    el?.scrollBy({ left: dir * Math.max(el.clientWidth * 0.7, 240), behavior: 'smooth' });
  };

  const tap = (e, g) => {
    if (window.matchMedia('(hover: none)').matches && active !== g) {
      e.preventDefault();
      setActive(g);
    }
  };

  const cur = items.find((c) => c.group === active);

  return (
    <div className="hero-cats" onMouseLeave={() => setActive(null)}>
      <div className="hero-cats-head">
        <span className="hero-eyebrow">{cur ? cur.group : 'Категорії'}</span>
        <span className="hero-arrows">
          {cur && <button type="button" className="hero-back" aria-label="Усі категорії" onClick={() => setActive(null)}>Усі категорії</button>}
          <button type="button" aria-label="Назад" onClick={() => by(-1)}>←</button>
          <button type="button" aria-label="Далі" onClick={() => by(1)}>→</button>
        </span>
      </div>

      <div className={`hero-scroll${cur ? ' has-active' : ''}`} ref={strip}>
        {items.map((c) => {
          const open = active === c.group;
          return (
            <div key={c.group} className={`cat-group${open ? ' open' : ''}${active && !open ? ' gone' : ''}`} onMouseEnter={() => setActive(c.group)}>
              <a className="cat-card" href={href(c.group)} onFocus={() => setActive(c.group)} onClick={(e) => tap(e, c.group)}>
                <span className="cat-img"><img src={c.image} alt="" loading="lazy" /></span>
                <span className="cat-name">{c.group}</span>
                <span className="cat-count">{c.count}</span>
              </a>
              {open && (
                <div className="sub-scroll" ref={sub}>
                  {c.types.map((t) => (
                    <a key={t.name} className="cat-card sub" href={href(c.group, t.name)}>
                      <span className="cat-img"><img src={t.image} alt="" loading="lazy" /></span>
                      <span className="cat-name">{t.name}</span>
                      <span className="cat-count">{t.count}</span>
                    </a>
                  ))}
                  <a className="cat-card sub more-card" href={href(c.group)}>
                    <span className="more-arrow">→</span>
                    <span className="cat-name">Усі товари розділу</span>
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
