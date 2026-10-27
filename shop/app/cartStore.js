'use client';

// Кошик у браузері (localStorage). Позиція: { id, size, qty }. Ціни й залишки рахує сервер (/api/cart/quote).
const KEY = 'forpost_cart_v1';
const EVENT = 'forpost-cart';

export function readCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((x) => x && x.id && Number(x.qty) >= 1) : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart({ id, size = '', qty = 1 }) {
  const items = readCart();
  const hit = items.find((x) => x.id === id && (x.size || '') === (size || ''));
  if (hit) hit.qty = Math.min(99, hit.qty + qty);
  else items.push({ id, size: size || '', qty });
  write(items);
}

export function setQty(id, size, qty) {
  write(readCart().map((x) => (x.id === id && (x.size || '') === (size || '') ? { ...x, qty: Math.max(1, Math.min(99, qty)) } : x)));
}

export function removeFromCart(id, size) {
  write(readCart().filter((x) => !(x.id === id && (x.size || '') === (size || ''))));
}

export function removeMany(rows) {
  const drop = new Set(rows.map((r) => `${r.id}|${r.size || ''}`));
  write(readCart().filter((x) => !drop.has(`${x.id}|${x.size || ''}`)));
}

export function onCartChange(fn) {
  window.addEventListener(EVENT, fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener('storage', fn);
  };
}
