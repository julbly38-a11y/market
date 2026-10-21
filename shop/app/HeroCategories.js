'use client';

import { useRef, useState } from 'react';

const href = (g, c) => `/?g=${encodeURIComponent(g)}${c ? `&c=${encodeURIComponent(c)}` : ''}#catalog`;

// Чорне поле на всю ширину, фото категорій майже на всю його висоту (відступ ~5 мм від країв).
// Наведення на категорію: решта зникає, праворуч від вибраної зʼявляються фото підкатегорій.
// Курсор пішов з поля — повертаються всі категорії. На сенсорних екранах перший дотик відкриває підкатегорії, другий веде в каталог.
export default function HeroCategories({ items }) {
  const [active, setActive] = useState(null);
  const strip = useRef(null);
  const sub = useRef(null);
  const by = (dir) => {
    const el = active ? sub.current : strip.current;
    el?.scrollBy({ left: dir * Math.max(el.clientWidth * 0.6, 240), behavior: 'smooth' });
  };

  const tap = (e, g) => {
    if (window.matchMedia('(hover: none)').matches && active !== g) {
      e.preventDefault();
      setActive(g);
    }
  };

  const cur = items.find((c) => c.group === active);

  return (
    <div className="hero-field" onMouseLeave={() => setActive(null)}>
      <div className="hero-ctrl">
        {cur && <button type="button" className="hero-back" onClick={() => setActive(null)}>Усі категорії</button>}
        <button type="button" aria-label="Назад" onClick={() => by(-1)}>←</button>
        <button type="button" aria-label="Далі" onClick={() => by(1)}>→</button>
      </div>

      <div className={`hero-scroll${cur ? ' has-active' : ''}`} ref={strip}>
        {items.map((c) => {
          const open = active === c.group;
          return (
            <div key={c.group} className={`cat-group${open ? ' open' : ''}${active && !open ? ' gone' : ''}`} onMouseEnter={() => setActive(c.group)}>
              <a className="cat-card" href={href(c.group)} onFocus={() => setActive(c.group)} onClick={(e) => tap(e, c.group)}>
                <img src={c.image} alt="" loading="lazy" />
                <span className="cat-info">
                  <span className="cat-name">{c.group}</span>
                  <span className="cat-count">{c.count}</span>
                </span>
              </a>
              {open && (
                <div className="sub-scroll" ref={sub}>
                  {c.types.map((t) => (
                    <a key={t.name} className="cat-card sub" style={{ gridRow: t.row }} href={href(c.group, t.name)}>
                      <img src={t.image} alt="" />
                      <span className="cat-info">
                        <span className="cat-name">{t.name}</span>
                        <span className="cat-count">{t.count}</span>
                      </span>
                    </a>
                  ))}
                  <a className="cat-card sub more-card" style={{ gridRow: 2 }} href={href(c.group)}>
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
