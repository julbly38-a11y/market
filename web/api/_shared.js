// Спільні хелпери для order.js і mono-webhook.js (файли з "_" Vercel не публікує як ендпоінти).

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const SITE = (process.env.SITE_URL || 'https://forpost.example').replace(/\/$/, '');

// Ціни беремо з каталогу на сервері, а не з запиту клієнта.
export function findItem(sku) {
  const file = [join(process.cwd(), 'catalog.json'), join(process.cwd(), 'web', 'catalog.json')].find(existsSync);
  const catalog = JSON.parse(readFileSync(file, 'utf8'));
  for (const cat of catalog) {
    const item = cat.items.find((it) => it.sku === sku);
    if (item) return { ...item, category: cat.title, vendor: cat.vendor };
  }
  return null;
}

const sbHeaders = () => ({
  apikey: process.env.SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Accept-Profile': 'market',
  'Content-Profile': 'market',
});

export async function sbInsertOrder(record) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
    method: 'POST',
    headers: { ...sbHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify([record]),
  });
  const json = await r.json();
  return Array.isArray(json) ? json[0] ?? null : null;
}

export async function sbGetOrder(id) {
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*`, {
    headers: sbHeaders(),
  });
  const json = await r.json();
  return Array.isArray(json) ? json[0] ?? null : null;
}

export async function sbPatchOrder(id, fields) {
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: sbHeaders(),
    body: JSON.stringify(fields),
  });
}

// Чернетка замовлення в MyDrop (submitted: false — постачальник її ще не бачить).
export async function createMydropDraft(order, vendor) {
  const r = await fetch('https://backend.mydrop.com.ua/dropshipper/api/orders', {
    method: 'POST',
    headers: { 'X-API-KEY': process.env.MYDROP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: order.customer_name,
      phone: order.phone,
      delivery_service: 'nova_poshta',
      city: order.city,
      products: [
        {
          vendor_name: vendor,
          product_title: order.product_name,
          sku: order.sku || undefined,
          price: order.unit_price,
          amount: order.qty,
        },
      ],
      order_source: 'Форпост (сайт)',
      description: order.note || undefined,
    }),
  });
  const json = await r.json();
  if (r.ok) return { id: json.id, error: null };
  return { id: null, error: json.message || json.reason || 'mydrop_error' };
}
