// Щодобово просить покупців залишити відгук: SMS (TurboSMS) і/або лист (Resend, верифікований домен).
// Беремо оплачені замовлення старші за REVIEW_REQUEST_DAYS (за замовчуванням 10) без позначки review_requested_at.
// Без жодного налаштованого каналу нічого не відправляє й не позначає. Cron: Authorization: Bearer PRICE_WATCH_SECRET.

import { reviewUrl, sb } from '../../../../lib/orders';
import { customerMailReady, sendCustomerMail } from '../../../../lib/notify';
import { sendSms, smsReady } from '../../../../lib/sms';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const secrets = [process.env.CRON_SECRET, process.env.PRICE_WATCH_SECRET].filter(Boolean);
  if (!secrets.length) return Response.json({ error: 'cron_disabled' }, { status: 503 });
  if (!secrets.some((s) => req.headers.get('authorization') === `Bearer ${s}`)) return Response.json({ error: 'forbidden' }, { status: 403 });

  const report = { channels: { sms: smsReady(), email: customerMailReady() }, due: 0, sent: 0, errors: [] };
  if (!report.channels.sms && !report.channels.email) return Response.json({ ...report, note: 'жоден канал не налаштований' });

  const days = Number(process.env.REVIEW_REQUEST_DAYS || 10);
  const before = new Date(Date.now() - days * 86400_000).toISOString();
  const res = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/orders?payment_status=eq.paid&review_requested_at=is.null&paid_at=lte.${encodeURIComponent(before)}&select=id,phone,email,customer_name&order=id&limit=50`,
    { headers: sb(), cache: 'no-store' }
  );
  const orders = await res.json();
  if (!Array.isArray(orders)) return Response.json({ error: 'orders_read_failed' }, { status: 502 });
  report.due = orders.length;

  for (const o of orders) {
    const link = reviewUrl(o.id);
    let ok = false;
    if (report.channels.sms) ok = !!(await sendSms(o.phone, `Форпост: дякуємо за замовлення №${o.id}! Залиште відгук: ${link}`)).ok || ok;
    if (report.channels.email && o.email) {
      ok = !!(await sendCustomerMail(o.email, `Ваше замовлення №${o.id}: залиште відгук`,
        `<p>Дякуємо за замовлення у Форпост! Нам важлива ваша думка.</p><p><a href="${link}">Залишити відгук</a></p>`)).ok || ok;
    }
    if (!ok) { report.errors.push(`order ${o.id}: нічого не відправлено`); continue; }
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${o.id}`, {
      method: 'PATCH', headers: sb(), body: JSON.stringify({ review_requested_at: new Date().toISOString() }),
    });
    report.sent++;
  }
  return Response.json(report);
}
