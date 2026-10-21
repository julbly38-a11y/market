// Щодобовий моніторинг цін (закупівля постачальника + конкуренти). Cron Vercel: Authorization: Bearer CRON_SECRET.
// Вручну: curl -H "Authorization: Bearer $CRON_SECRET" https://<сайт>/api/cron/price-watch

import { runPriceWatch } from '../../../../lib/pricewatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req) {
  // CRON_SECRET — для cron Vercel, PRICE_WATCH_SECRET — для розкладу в Supabase (pg_cron).
  const secrets = [process.env.CRON_SECRET, process.env.PRICE_WATCH_SECRET].filter(Boolean);
  if (!secrets.length) return Response.json({ error: 'cron_disabled' }, { status: 503 });
  if (!secrets.some((s) => req.headers.get('authorization') === `Bearer ${s}`)) return Response.json({ error: 'forbidden' }, { status: 403 });
  try {
    return Response.json(await runPriceWatch());
  } catch (err) {
    console.error('price-watch failed', err);
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
