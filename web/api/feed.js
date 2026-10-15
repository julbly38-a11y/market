// YML-фід каталогу для Prom.ua (імпорт за посиланням: POST /products/import_url).
// Джерело — web/catalog.json, ціни й залишки ті самі, що на сайті.

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SITE = process.env.SITE_URL || 'https://forpost-shop.vercel.app';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export default function handler(req, res) {
  // на Vercel корінь проєкту = web/, локально (dev-server) cwd = корінь репо
  const file = [join(process.cwd(), 'catalog.json'), join(process.cwd(), 'web', 'catalog.json')].find(existsSync);
  const catalog = JSON.parse(readFileSync(file, 'utf8'));

  const categories = catalog
    .map((c, i) => `      <category id="${i + 1}">${esc(c.title)}</category>`)
    .join('\n');

  const offers = catalog
    .flatMap((c, i) =>
      c.items.map(
        (it) => `      <offer id="${esc(it.sku)}" available="${it.stock > 0}">
        <name>${esc(it.name)}</name>
        <price>${it.price}</price>
        <currencyId>UAH</currencyId>
        <categoryId>${i + 1}</categoryId>
        <picture>${esc(it.img)}</picture>
        <vendor>${esc(c.vendor)}</vendor>
        <vendorCode>${esc(it.sku)}</vendorCode>
        <quantity_in_stock>${it.stock}</quantity_in_stock>
      </offer>`
      )
    )
    .join('\n');

  const date = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<yml_catalog date="${date}">
  <shop>
    <name>Форпост</name>
    <company>Форпост</company>
    <url>${esc(SITE)}</url>
    <currencies>
      <currency id="UAH" rate="1"/>
    </currencies>
    <categories>
${categories}
    </categories>
    <offers>
${offers}
    </offers>
  </shop>
</yml_catalog>
`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.statusCode = 200;
  res.end(xml);
}
