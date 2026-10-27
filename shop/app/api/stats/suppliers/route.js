// Строки відправки по постачальниках: скільки замовлень подано, скільки отримали ТТН, середній і найдовший час від подачі до ТТН.
// Доступ: заголовок X-Finance-Key (той самий, що в /api/finance).

import { sb } from '../../../../lib/orders';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const key = process.env.FINANCE_KEY;
  if (!key || req.headers.get('x-finance-key') !== key) return Response.json({ error: 'forbidden' }, { status: 403 });

  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/orders?mydrop_submitted=is.true&select=id,mydrop_vendor,mydrop_status,mydrop_submitted_at,ttn,ttn_at&order=id&limit=1000`,
    { headers: sb(), cache: 'no-store' }
  );
  const rows = await res.json();
  if (!Array.isArray(rows)) return Response.json({ error: 'read_failed' }, { status: 502 });

  const by = new Map();
  for (const o of rows) {
    const v = o.mydrop_vendor || 'невідомо';
    const s = by.get(v) || { vendor: v, submitted: 0, shipped: 0, cancelled: 0, waiting: 0, hours: [] };
    s.submitted++;
    if (o.mydrop_status === 'Отмена') s.cancelled++;
    else if (o.ttn) {
      s.shipped++;
      if (o.mydrop_submitted_at && o.ttn_at) s.hours.push((new Date(o.ttn_at) - new Date(o.mydrop_submitted_at)) / 3600_000);
    } else s.waiting++;
    by.set(v, s);
  }
  const out = [...by.values()].map(({ hours, ...s }) => ({
    ...s,
    avgHoursToTtn: hours.length ? Math.round((hours.reduce((a, b) => a + b, 0) / hours.length) * 10) / 10 : null,
    maxHoursToTtn: hours.length ? Math.round(Math.max(...hours) * 10) / 10 : null,
  }));
  return Response.json({ suppliers: out });
}
