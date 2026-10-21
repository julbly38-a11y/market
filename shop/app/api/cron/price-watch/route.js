// Щодобовий моніторинг цін (закупівля постачальника + конкуренти). Cron Vercel: Authorization: Bearer CRON_SECRET.
// Вручну: curl -H "Authorization: Bearer $CRON_SECRET" https://<сайт>/api/cron/price-watch

import { runPriceWatch } from '../../../../lib/pricewatch';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'cron_disabled' }, { status: 503 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'forbidden' }, { status: 403 });
  try {
    return Response.json(await runPriceWatch());
  } catch (err) {
    console.error('price-watch failed', err);
    return Response.json({ error: String(err.message || err) }, { status: 500 });
  }
}
