'use client';

import { useEffect, useRef, useState } from 'react';

const href = (g, c) => `/?g=${encodeURIComponent(g)}${c ? `&c=${encodeURIComponent(c)}` : ''}#catalog`;

// Чорне поле на всю ширину, фото категорій майже на всю його висоту (відступ ~5 мм від країв).
// Клік по категорії: решта зникає, праворуч від вибраної зʼявляються фото підкатегорій. Повторний клік по ній
// або кнопка «Усі категорії» повертають усі категорії; у каталог веде картка «Усі товари розділу» і кліки по підкатегоріях.
export default function HeroCategories({ items }) {
  const [active, setActive] = useState(null);
  const [shown, setShown] = useState(null); // підкатегорії лишаються в DOM на час плавного закриття
  const timer = useRef(null);
  const strip = useRef(null);
  const sub = useRef(null);
  const by = (dir) => {
    const el = active ? sub.current : strip.current;
    el?.scrollBy({ left: dir * Math.max(el.clientWidth * 0.6, 240), behavior: 'smooth' });
  };

  const close = () => {
    setActive(null);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setShown(null), 700);
  };
  const open = (g) => {
    clearTimeout(timer.current);
    setActive(g);
    setShown(g);
  };
  const toggle = (e, g) => {
    e.preventDefault();
    if (active === g) close();
    else open(g);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const cur = items.find((c) => c.group === active);

  return (
    <div className="hero-field">
      <div className="hero-ctrl">
        {cur && <button type="button" className="hero-back" onClick={close}>Усі категорії</button>}
        <button type="button" aria-label="Назад" onClick={() => by(-1)}>←</button>
        <button type="button" aria-label="Далі" onClick={() => by(1)}>→</button>
      </div>

      <div className={`hero-scroll${cur ? ' has-active' : ''}`} ref={strip}>
        {items.map((c) => {
          const isOpen = active === c.group;
          const showSub = shown === c.group;
          return (
            <div key={c.group} className={`cat-group${isOpen ? ' open' : ''}${active && !isOpen ? ' gone' : ''}${showSub && !active ? ' closing' : ''}`}>
              <a className="cat-card" href={href(c.group)} aria-expanded={isOpen} onClick={(e) => toggle(e, c.group)}>
                <img src={c.image} alt="" loading="lazy" />
                <span className="cat-info">
                  <span className="cat-name">{c.group}</span>
                  <span className="cat-count">{c.count}</span>
                </span>
              </a>
              {showSub && (
                <div className={`sub-scroll${active ? '' : ' out'}`} ref={sub}>
                  {c.types.map((t, n) => (
                    <a key={t.name} className="cat-card sub" style={{ gridRow: t.row, '--i': n }} href={href(c.group, t.name)}>
                      <img src={t.image} alt="" />
                      <span className="cat-info">
                        <span className="cat-name">{t.name}</span>
                        <span className="cat-count">{t.count}</span>
                      </span>
                    </a>
                  ))}
                  <a className="cat-card sub more-card" style={{ gridRow: 2, '--i': c.types.length }} href={href(c.group)}>
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
