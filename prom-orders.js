// Замовлення з Prom.ua → чернетка в MyDrop → статус "Прийнято" назад у Prom.
//
//   node prom-orders.js            перегляд: що було б зроблено, нічого не змінює
//   node prom-orders.js --apply    створює чернетки в MyDrop і ставить у Prom статус received
//
// Чернетка MyDrop лишається неподаною (submitted: false) — подаєте постачальнику вручну з кабінету MyDrop.
// Вже оброблені замовлення запам'ятовуються в prom-orders-state.json, щоб не дублювати.

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mydrop = require('./mydrop');

const PROM = 'https://my.prom.ua/api/v1';
const STATE_FILE = path.join(__dirname, 'prom-orders-state.json');
const CATALOG = JSON.parse(fs.readFileSync(path.join(__dirname, 'web', 'catalog.json'), 'utf8'));

// sku товару → { vendor, title }, щоб знати, у якого постачальника замовляти
const VENDOR_BY_SKU = new Map(
  CATALOG.flatMap((c) => c.items.map((it) => [it.sku, { vendor: c.vendor, title: it.name }]))
);

async function prom(method, p, body) {
  const token = process.env.PROM_API_TOKEN;
  if (!token) throw new Error('PROM_API_TOKEN не задано в .env');
  const res = await fetch(`${PROM}${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`Prom ${method} ${p} → HTTP ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

// Замовлення Prom → тіло замовлення MyDrop. Кидає помилку, якщо товару немає в каталозі.
function buildMydropOrder(o) {
  const products = o.products.map((p) => {
    const key = p.external_id || p.sku;
    const known = VENDOR_BY_SKU.get(key);
    if (!known) throw new Error(`товар "${p.name}" (${key}) відсутній у web/catalog.json`);
    return {
      vendor_name: known.vendor,
      product_title: known.title,
      sku: key,
      price: Number(p.price),
      amount: Number(p.quantity),
    };
  });

  const dp = o.delivery_provider_data || {};
  const notes = [
    `Prom.ua #${o.id}`,
    o.client_notes,
    o.delivery_address && `Адреса: ${o.delivery_address}`,
    dp.recipient_warehouse_id && `НП відділення (ref): ${dp.recipient_warehouse_id}`,
    o.payment_option?.name && `Оплата: ${o.payment_option.name}`,
  ].filter(Boolean);

  return {
    name: [o.client_first_name, o.client_second_name, o.client_last_name].filter(Boolean).join(' '),
    phone: o.phone,
    city: o.delivery_address || '—',
    delivery_service: 'nova_poshta',
    products,
    order_source: `Prom.ua #${o.id}`,
    description: notes.join(' | '),
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const state = loadState();
  const { orders = [] } = await prom('GET', '/orders/list?status=pending&limit=100');
  const fresh = orders.filter((o) => !state[o.id]);

  console.log(`${apply ? 'РЕЖИМ APPLY' : 'Перегляд (без змін)'}: нових замовлень Prom — ${fresh.length}`);
  for (const o of fresh) {
    let md;
    try {
      md = buildMydropOrder(o);
    } catch (err) {
      console.error(`#${o.id}: пропущено — ${err.message}`);
      continue;
    }
    console.log(`#${o.id}: ${md.name}, ${md.phone}, ${md.products.map((p) => `${p.product_title} ×${p.amount}`).join('; ')}`);
    if (!apply) continue;

    const created = await mydrop.createOrder(md);
    state[o.id] = { mydrop_order_id: created.id ?? null, at: new Date().toISOString() };
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    await prom('POST', '/orders/set_status', { status: 'received', ids: [o.id] });
    console.log(`  → MyDrop чернетка ${created.id}, у Prom статус "received"`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

module.exports = { buildMydropOrder };
