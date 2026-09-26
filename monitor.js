// Price monitor: fetches product pages and extracts price/rating from schema.org JSON-LD.
// Works on any site that publishes Product JSON-LD (Prom.ua, Rozetka.com.ua, etc.)
//
// Usage:
//   node monitor.js <url1> <url2> ...
//   node monitor.js --file urls.txt        (one URL per line)
//   node monitor.js --watchlist            (uses watchlist.json, labeled benchmark set)

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const HISTORY_FILE = path.join(__dirname, 'price-history.json');
const WATCHLIST_FILE = path.join(__dirname, 'watchlist.json');

const supabase =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
        db: { schema: 'market' },
        auth: { persistSession: false },
      })
    : null;

async function syncToSupabase(data) {
  if (!supabase) return;

  const { data: product, error: upsertErr } = await supabase
    .from('products')
    .upsert(
      { url: data.url, label: data.label, name: data.name, sku: data.sku },
      { onConflict: 'url' }
    )
    .select('id')
    .single();
  if (upsertErr) throw upsertErr;

  const { error: snapshotErr } = await supabase.from('price_snapshots').insert({
    product_id: product.id,
    price: data.price,
    old_price: data.oldPrice,
    currency: data.currency,
    availability: data.availability,
    seller: data.seller,
    rating: data.rating,
    review_count: data.reviewCount,
    checked_at: data.checkedAt,
  });
  if (snapshotErr) throw snapshotErr;
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch {
      // skip malformed block
    }
  }
  return blocks;
}

function findProduct(blocks) {
  for (const b of blocks) {
    const items = Array.isArray(b) ? b : [b];
    for (const item of items) {
      if (item['@type'] === 'Product') return item;
    }
  }
  return null;
}

function cleanSchemaValue(v) {
  return v?.replace('http://schema.org/', '').replace('https://schema.org/', '') ?? null;
}

async function fetchProduct(url, label) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'Accept-Language': 'uk-UA,uk;q=0.9',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      Referer: `https://${new URL(url).host}/`,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const html = await res.text();
  const product = findProduct(extractJsonLd(html));
  if (!product) throw new Error(`No Product JSON-LD found at ${url}`);

  const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;

  // Rozetka-style priceSpecification carries the "old"/strikethrough price
  let oldPrice = null;
  if (Array.isArray(offer?.priceSpecification)) {
    const strike = offer.priceSpecification.find((p) => /Strikethrough/i.test(p.priceType ?? ''));
    if (strike) oldPrice = Number(strike.price);
  }

  return {
    url,
    label: label ?? null,
    name: product.name,
    sku: product.sku ?? null,
    price: offer?.price != null ? Number(offer.price) : null,
    oldPrice,
    currency: offer?.priceCurrency ?? null,
    availability: cleanSchemaValue(offer?.availability),
    seller: offer?.seller?.name ?? null,
    rating: product.aggregateRating?.ratingValue ?? null,
    reviewCount: product.aggregateRating?.ratingCount ?? null,
    checkedAt: new Date().toISOString(),
  };
}

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf8');
}

function loadWatchlist() {
  if (!fs.existsSync(WATCHLIST_FILE)) {
    throw new Error(`Watchlist file not found: ${WATCHLIST_FILE}`);
  }
  return JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
}

async function main() {
  const args = process.argv.slice(2);
  let targets = []; // [{url, label}]

  if (args.includes('--watchlist')) {
    targets = loadWatchlist();
  } else {
    const fileIdx = args.indexOf('--file');
    if (fileIdx !== -1) {
      const filePath = args[fileIdx + 1];
      targets = fs
        .readFileSync(filePath, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((url) => ({ url, label: null }));
    } else {
      targets = args.map((url) => ({ url, label: null }));
    }
  }

  if (targets.length === 0) {
    console.error(
      'Usage: node monitor.js <url1> <url2> ...\n' +
        '   OR: node monitor.js --file urls.txt\n' +
        '   OR: node monitor.js --watchlist'
    );
    process.exit(1);
  }

  if (!supabase) {
    console.log('ℹ Supabase не налаштовано (SUPABASE_URL / SUPABASE_SERVICE_KEY відсутні в .env) — пишу лише в price-history.json\n');
  }

  const history = loadHistory();
  const results = [];

  for (const { url, label } of targets) {
    try {
      const data = await fetchProduct(url, label);
      results.push(data);
      history.push(data);

      const prior = history
        .filter((h) => h.url === url && h.checkedAt !== data.checkedAt)
        .sort((a, b) => new Date(b.checkedAt) - new Date(a.checkedAt))[0];

      let change = '';
      if (prior && prior.price != null && data.price != null && prior.price !== data.price) {
        const diff = data.price - prior.price;
        change = `  [${diff > 0 ? '+' : ''}${diff} ₴ від ${prior.price} ₴]`;
      }

      const tag = label ? `[${label}] ` : '';
      const ratingStr = data.reviewCount ? ` | ★${data.rating} (${data.reviewCount} відгуків)` : '';
      console.log(`✔ ${tag}${data.name}`);
      console.log(`  ${data.price} ${data.currency} | ${data.availability} | ${data.seller}${ratingStr}${change}`);

      try {
        await syncToSupabase(data);
      } catch (dbErr) {
        console.error(`  ⚠ Supabase: ${dbErr.message}`);
      }
    } catch (err) {
      console.error(`✘ ${label ? `[${label}] ` : ''}${url}\n  ${err.message}`);
    }
    // small delay to be polite to the server
    await new Promise((r) => setTimeout(r, 800));
  }

  saveHistory(history);
  console.log(`\nЗбережено в ${HISTORY_FILE} (${history.length} записів всього)`);
}

main();
