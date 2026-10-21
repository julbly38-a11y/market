// Моніторинг цін: (1) закупівельні ціни й залишки постачальника (MyDrop) і (2) ціни конкурентів.
// Знімки лежать у market.supplier_prices / price_changes / competitor_prices. Запускається щодоби з
// /api/cron/price-watch. Перший запуск лише фіксує базу, без листа про «зміни».

import { retailPrice } from './pricing';
import { PRODUCTS, getVendorPrices, sb } from './orders';
import { sendMail } from './notify';
import competitors from '../data/competitors.json';

const SIGNIFICANT_PCT = Number(process.env.PRICE_ALERT_PERCENT || 5); // зміна закупівлі, про яку пишемо
const MAX_ROWS_IN_MAIL = 25;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (path) => `${process.env.SUPABASE_URL}/rest/v1/${path}`;
const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

async function loadStored() {
  const map = new Map();
  for (let from = 0; ; from += 1000) {
    const res = await fetch(url(`supplier_prices?select=product_id,price,stock,title&order=product_id&limit=1000&offset=${from}`), {
      headers: sb(),
      cache: 'no-store',
    });
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(`supplier_prices_read_failed: ${JSON.stringify(rows).slice(0, 150)}`);
    for (const r of rows) map.set(r.product_id, { price: Number(r.price), stock: r.stock, hasTitle: !!r.title });
    if (rows.length < 1000) break;
  }
  return map;
}

async function post(path, rows, prefer) {
  for (let i = 0; i < rows.length; i += 500) {
    const res = await fetch(url(path), {
      method: 'POST',
      headers: sb({ Prefer: prefer }),
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
    if (!res.ok) throw new Error(`${path}_${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function watchSupplier(report) {
  const stored = await loadStored();
  const baseline = stored.size === 0;
  const vendors = [...new Set([...PRODUCTS.keys()].map((id) => id.split('-')[0]))];
  const upserts = [];
  const changes = [];

  for (const vendorId of vendors) {
    let live;
    try {
      live = await getVendorPrices(vendorId);
    } catch (err) {
      report.errors.push(`vendor ${vendorId}: ${err.message}`);
      continue;
    }
    for (const [id, p] of PRODUCTS) {
      if (!id.startsWith(`${vendorId}-`)) continue;
      const cur = live.get(id.slice(vendorId.length + 1));
      if (!cur || !cur.price) continue;
      report.checked++;
      const prev = stored.get(id);
      if (prev && prev.price === cur.price && prev.stock === cur.stock && prev.hasTitle) continue;
      upserts.push({ product_id: id, title: p.title, price: cur.price, stock: cur.stock, checked_at: new Date().toISOString() });
      if (prev && !baseline && (prev.price !== cur.price || prev.stock !== cur.stock)) {
        changes.push({
          product_id: id, title: p.title,
          old_price: prev.price, new_price: cur.price, old_stock: prev.stock, new_stock: cur.stock,
        });
      }
    }
  }

  if (upserts.length) await post('supplier_prices?on_conflict=product_id', upserts, 'resolution=merge-duplicates');
  const priceMoves = changes.filter((c) => c.old_price !== c.new_price || (c.old_stock > 0) !== (c.new_stock > 0));
  if (priceMoves.length) await post('price_changes', priceMoves, 'return=minimal');

  Object.assign(report, { baseline, stored: upserts.length, changes: priceMoves.length });
  return priceMoves
    .map((c) => ({ ...c, pct: c.old_price ? ((c.new_price - c.old_price) / c.old_price) * 100 : 0, wentOut: c.old_stock > 0 && c.new_stock === 0, cameBack: c.old_stock === 0 && c.new_stock > 0 }))
    .filter((c) => Math.abs(c.pct) >= SIGNIFICANT_PCT || c.wentOut || c.cameBack)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

// --- ціни конкурентів (сторінки з JSON-LD Product; Rozetka не чіпаємо — їхній robots.txt забороняє ботів)

function extractProduct(html) {
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m; (m = re.exec(html)); ) {
    try {
      const j = JSON.parse(m[1].trim());
      for (const item of Array.isArray(j) ? j : [j]) if (item?.['@type'] === 'Product') return item;
    } catch {}
  }
  return null;
}

async function fetchCompetitor(link) {
  const res = await fetch(link, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'uk-UA,uk;q=0.9',
    },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const product = extractProduct(await res.text());
  if (!product) throw new Error('no_json_ld');
  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
  return {
    price: offer?.price != null ? Number(offer.price) : null,
    availability: String(offer?.availability || '').replace(/^https?:\/\/schema\.org\//, '') || null,
    seller: offer?.seller?.name ?? null,
  };
}

async function watchCompetitors(report) {
  const rows = [];
  const cheaper = [];
  for (const c of competitors.items || []) {
    if (/rozetka\.com\.ua/i.test(c.url)) { report.errors.push(`skip rozetka: ${c.url}`); continue; }
    const p = PRODUCTS.get(c.productId);
    if (!p) { report.errors.push(`unknown product ${c.productId}`); continue; }
    try {
      const vendorId = c.productId.split('-')[0];
      const live = (await getVendorPrices(vendorId).catch(() => null))?.get(c.productId.slice(vendorId.length + 1));
      const ours = retailPrice(live?.price || p.price);
      const r = await fetchCompetitor(c.url);
      rows.push({ product_id: c.productId, url: c.url, seller: r.seller, price: r.price, availability: r.availability, our_price: ours });
      if (r.price && r.price < ours) cheaper.push({ title: p.title, ours, theirs: r.price, seller: r.seller, url: c.url, pct: ((ours - r.price) / ours) * 100 });
      report.competitors++;
    } catch (err) {
      report.errors.push(`competitor ${c.url}: ${err.message}`);
    }
    await sleep(800);
  }
  if (rows.length) await post('competitor_prices', rows, 'return=minimal');
  return cheaper.sort((a, b) => b.pct - a.pct);
}

function buildMail(changes, cheaper, report) {
  const money = (n) => `${Math.round(n * 100) / 100} ₴`;
  let html = '<h3>Моніторинг цін Форпост</h3>';
  if (changes.length) {
    html += `<h4>Постачальник: зміни закупівлі (${changes.length}${changes.length > MAX_ROWS_IN_MAIL ? `, показано ${MAX_ROWS_IN_MAIL}` : ''})</h4><ul>`;
    for (const c of changes.slice(0, MAX_ROWS_IN_MAIL)) {
      const note = c.wentOut ? ' — <b>немає в наявності</b>' : c.cameBack ? ' — знову в наявності' : '';
      html += `<li>${esc(c.title.slice(0, 70))}: ${money(c.old_price)} → <b>${money(c.new_price)}</b> (${c.pct >= 0 ? '+' : ''}${c.pct.toFixed(1)}%), на сайті тепер ${money(retailPrice(c.new_price))}${note}</li>`;
    }
    html += '</ul>';
  }
  if (cheaper.length) {
    html += '<h4>Конкуренти дешевші за нас</h4><ul>';
    for (const c of cheaper) html += `<li>${esc(c.title.slice(0, 70))}: ми ${money(c.ours)}, ${esc(c.seller || 'конкурент')} ${money(c.theirs)} (−${c.pct.toFixed(1)}%) — <a href="${esc(c.url)}">сторінка</a></li>`;
    html += '</ul>';
  }
  if (report.errors.length) html += `<p style="color:#a00">Помилки (${report.errors.length}): ${esc(report.errors.slice(0, 5).join('; '))}</p>`;
  return html;
}

export async function runPriceWatch() {
  const report = { checked: 0, stored: 0, changes: 0, competitors: 0, baseline: false, errors: [], mailed: false };
  const changes = await watchSupplier(report);
  const cheaper = await watchCompetitors(report);
  if (!report.baseline && (changes.length || cheaper.length || report.errors.length)) {
    const subject = `Ціни: ${changes.length} змін закупівлі${cheaper.length ? `, ${cheaper.length} дешевших конкурентів` : ''}`;
    report.mailed = !!(await sendMail(subject, buildMail(changes, cheaper, report))).ok;
  }
  return report;
}
