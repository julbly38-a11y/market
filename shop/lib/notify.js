// Сповіщення власнику про нове оплачене замовлення (email через Resend).
// Потрібні RESEND_API_KEY і NOTIFY_EMAIL; без них нічого не робить. Помилка сповіщення не ламає вебхук.
// NOTIFY_FROM — відправник (за замовчуванням тестовий onboarding@resend.dev; для свого домену треба верифікація в Resend).

import { orderUrl } from './orders';

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export async function notifyPaidOrder(order, mydrop) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return { skipped: true };
  const draft = mydrop?.id ? `чернетка MyDrop №${mydrop.id}` : `⚠️ чернетку MyDrop не створено: ${mydrop?.error || 'невідомо'}`;
  const html = `<h3>Оплачене замовлення №${esc(order.id)}</h3>
<p>${esc(order.product_name)} (арт. ${esc(order.sku)}) × ${esc(order.qty)} = <b>${esc(order.total)} ₴</b></p>
<p>${esc(order.customer_name)}, ${esc(order.phone)}<br>${esc(order.city)}</p>
<p>${esc(draft)}. Подайте її постачальнику в кабінеті MyDrop.</p>
<p>Сторінка статусу для покупця: <a href="${esc(orderUrl(order.id))}">${esc(orderUrl(order.id))}</a></p>`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM || 'Форпост <onboarding@resend.dev>',
        to: [to],
        subject: `Нове замовлення №${order.id} — ${order.total} ₴`,
        html,
      }),
    });
    if (!res.ok) console.error('notify failed', res.status, await res.text());
    return { ok: res.ok };
  } catch (err) {
    console.error('notify error', err);
    return { ok: false };
  }
}
