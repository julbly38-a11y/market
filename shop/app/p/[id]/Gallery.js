'use client';

import { useState } from 'react';

export default function Gallery({ images, alt }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <img src={images[i]} alt={alt} />
      {images.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {images.map((src, n) => (
            <button
              key={src}
              type="button"
              onClick={() => setI(n)}
              aria-label={`Фото ${n + 1}`}
              style={{ width: 64, height: 64, padding: 0, border: n === i ? '2px solid #1f1f1f' : '1px solid #ddd', borderRadius: 8, overflow: 'hidden', background: '#fff', cursor: 'pointer' }}
            >
              <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
