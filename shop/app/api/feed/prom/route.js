// YML-фід для імпорту в Prom.ua за посиланням: GET /api/feed/prom?key=PROM_FEED_KEY
// Товари беремо з каталогу (data/products.json), ціну й наявність підміняємо живими даними MyDrop
// (якщо MyDrop недоступний — лишаємо знімок каталогу). Групи, які йдуть на Prom, задає PROM_GROUPS
// (через ';', за замовчуванням — «Акумуляторні станції та енергія»). Націнка: PROM_MARKUP_PERCENT (за замовчуванням 0).

import data from '../../../../data/products.json';
import { groupOf } from '../../../../lib/groups';
import { getVendorPrices, SITE } from '../../../../lib/orders';

// Відповідність підкатегорій постачальника категоріям порталу Prom (portal_id). Для решти категорію
// у Prom призначають вручну після імпорту.
const PORTAL_ID = {
  'Генератори': 410402, // Электрогенераторы
  'Інвентори': 5140401, // Инверторы
  'Акумулятори': 52809, // Тяговые аккумуляторы
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function GET(req) {
  const key = process.env.PROM_FEED_KEY;
  if (!key) return Response.json({ error: 'feed_disabled' }, { status: 503 });
  if (new URL(req.url).searchParams.get('key') !== key) return Response.json({ error: 'forbidden' }, { status: 403 });

  const groups = new Set((process.env.PROM_GROUPS || 'Акумуляторні станції та енергія').split(';').map((g) => g.trim()));
  const markup = 1 + (Number(process.env.PROM_MARKUP_PERCENT) || 0) / 100;
  const items = data.products.filter((p) => groups.has(groupOf(p)));

  // живі ціни по кожному постачальнику, що потрапив у вибірку
  const live = new Map();
  await Promise.all(
    [...new Set(items.map((p) => p.id.split('-')[0]))].map(async (vendorId) => {
      try {
        live.set(vendorId, await getVendorPrices(vendorId));
      } catch (err) {
        console.error('feed: live prices failed', vendorId, err);
      }
    })
  );

  const cats = [...new Set(items.map((p) => p.category.trim()))];
  const catId = new Map(cats.map((c, i) => [c, i + 1]));

  const offers = items.map((p) => {
    const [vendorId, itemId] = p.id.split('-');
    const fresh = live.get(vendorId)?.get(itemId);
    const price = Math.ceil((fresh?.price ?? p.price) * markup);
    const stock = fresh?.stock ?? p.stock;
    return `<offer id="${esc(p.id)}" available="${stock > 0}">
<name>${esc(p.title)}</name>
<categoryId>${catId.get(p.category.trim())}</categoryId>
<price>${price}</price>
<currencyId>UAH</currencyId>
<picture>${esc(p.image)}</picture>
<vendor>${esc(p.vendor)}</vendor>
<vendorCode>${esc(p.sku ?? p.id)}</vendorCode>
<description><![CDATA[${p.title}]]></description>
<stock_quantity>${stock}</stock_quantity>
</offer>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${new Date().toISOString().slice(0, 16).replace('T', ' ')}">
<shop>
<name>Форпост</name>
<company>Форпост</company>
<url>${esc(SITE)}</url>
<currencies><currency id="UAH" rate="1"/></currencies>
<categories>
${cats.map((c) => `<category id="${catId.get(c)}"${PORTAL_ID[c] ? ` portal_id="${PORTAL_ID[c]}"` : ''}>${esc(c)}</category>`).join('\n')}
</categories>
<offers>
${offers.join('\n')}
</offers>
</shop>
</yml_catalog>`;

  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}
