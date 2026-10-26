'use client';

import { useState } from 'react';

// Галерея товару: велике фото й мініатюри збоку (на телефоні під фото).
export default function Gallery({ images, alt }) {
  const [i, setI] = useState(0);
  return (
    <div className={`gal${images.length > 1 ? ' multi' : ''}`}>
      {images.length > 1 && (
        <div className="gal-thumbs">
          {images.map((src, n) => (
            <button key={src} type="button" onClick={() => setI(n)} aria-label={`Фото ${n + 1}`} className={n === i ? 'on' : ''}>
              <img src={src} alt="" />
            </button>
          ))}
        </div>
      )}
      <div className="gal-main"><img src={images[i]} alt={alt} /></div>
    </div>
  );
}
