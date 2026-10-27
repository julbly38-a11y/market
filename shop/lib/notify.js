// Сповіщення власнику про нове оплачене замовлення (email через Resend).
// Потрібні RESEND_API_KEY і NOTIFY_EMAIL; без них нічого не робить. Помилка сповіщення не ламає вебхук.
// NOTIFY_FROM — відправник (за замовчуванням тестовий onboarding@resend.dev; для свого домену треба верифікація в Resend).

import { orderUrl, submitErrorHint, vendorPaymentInfo } from './orders';

// Причина невдалої автоподачі для листа власнику: код помилки й що з цим робити.
const submitFailure = (error) => {
  const hint = submitErrorHint(error);
  return `⚠️ автоподача не вдалась: ${error}${hint ? ` (${hint})` : ''}`;
};

const itemsHtml = (order) =>
  Array.isArray(order.items) && order.items.length
    ? `<p><b>${esc(order.product_name)}</b> = <b>${esc(order.total)} ₴</b></p><ul>${order.items.map((i) => `<li>${esc(i.label)}: ${esc(i.title)}${i.size ? `, розмір ${esc(i.size)}` : ''} (арт. ${esc(i.sku)}) — ${esc(i.price)} ₴</li>`).join('')}</ul>`
    : `<p>${esc(order.product_name)} (арт. ${esc(order.sku)})${order.size ? `, розмір ${esc(order.size)}` : ''} × ${esc(order.qty)} = <b>${esc(order.total)} ₴</b></p>`;

// Скільки переказати постачальнику (сума закупівлі, drop_price) і нагадування про фото оплати.
// Ручна подача оплаченого карткою замовлення: що переказати, куди, і що прикріпити (скриншот оплати).
const manualPaymentHtml = async (order, mydrop) => {
  if (!mydrop?.id) return '';
  const info = await vendorPaymentInfo(mydrop.vendor);
  const draftLink = `https://mydrop.com.ua/dropshipper/orders/${mydrop.id}/edit`;
  const unit = Number(order.supplier_price) || 0;
  const sum = Array.isArray(order.items) && order.items.length ? unit : unit * (Number(order.qty) || 1);
  return `<h4>Ручна подача${mydrop.vendor ? `: ${esc(mydrop.vendor)}` : ''}</h4>
<ol>
<li>Перекажіть постачальнику <b>${esc(sum)} ₴</b> (drop-ціна)${info?.alert ? `. Реквізити з кабінету MyDrop: <i>${esc(info.alert)}</i>` : ''}.</li>
<li>${info?.imageRequired === false ? 'Скриншот оплати цей постачальник не вимагає, але прикріпити його можна.' : 'Зробіть скриншот переказу й прикріпіть його в полі «Прикріпити скриншот оплати».'}</li>
<li>Відкрийте <a href="${esc(draftLink)}">чернетку №${esc(mydrop.id)}</a>, поставте «Повна передплата» (накладений платіж 0), додайте скриншот і натисніть «Подати замовлення».</li>
</ol>`;
};

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

export async function sendMail(subject, html) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!key || !to) return { skipped: true };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM || 'Форпост <onboarding@resend.dev>', to: [to], subject, html }),
    });
    if (!res.ok) console.error('notify failed', res.status, await res.text());
    return { ok: res.ok };
  } catch (err) {
    console.error('notify error', err);
    return { ok: false };
  }
}

export async function notifyPaidOrder(order, mydrop) {
  const draft = mydrop?.id
    ? `${mydrop.submitted ? 'замовлення MyDrop' : 'чернетка MyDrop'} №${mydrop.id}${!mydrop.submitted && mydrop.error ? `, ${submitFailure(mydrop.error)}` : ''}`
    : `⚠️ чернетку MyDrop не створено: ${mydrop?.error || 'невідомо'}`;
  const next = mydrop?.submitted
    ? 'Замовлення подано постачальнику автоматично, оплата списана з балансу MyDrop. ТТН створить постачальник.'
    : 'Подайте її постачальнику в кабінеті MyDrop.';
  const html = `<h3>Оплачене замовлення №${esc(order.id)}</h3>
${itemsHtml(order)}
<p>${esc(order.customer_name)}, ${esc(order.phone)}<br>${esc(order.city)}</p>
<p>${esc(draft)}. ${next}</p>
${mydrop?.submitted ? '' : await manualPaymentHtml(order, mydrop)}
<p>Сторінка статусу для покупця: <a href="${esc(orderUrl(order.id))}">${esc(orderUrl(order.id))}</a></p>`;
  return sendMail(`Нове замовлення №${order.id} — ${order.total} ₴${mydrop?.submitted ? '' : ' (потрібна ручна подача)'}`, html);
}

// Лист покупцю: працює лише з верифікованого домену (NOTIFY_FROM не resend.dev), інакше Resend шле тільки власнику.
export const customerMailReady = () => !!process.env.RESEND_API_KEY && !!process.env.NOTIFY_FROM && !/resend\.dev/i.test(process.env.NOTIFY_FROM);

export async function sendCustomerMail(to, subject, html) {
  if (!customerMailReady()) return { skipped: true };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.NOTIFY_FROM, to: [to], subject, html }),
    });
    if (!res.ok) console.error('customer mail failed', res.status, await res.text());
    return { ok: res.ok };
  } catch (err) {
    console.error('customer mail error', err);
    return { ok: false };
  }
}

export async function notifyCodOrder(order, mydrop) {
  const draft = mydrop?.id
    ? `${mydrop.submitted ? 'замовлення MyDrop' : 'чернетка MyDrop'} №${mydrop.id}${!mydrop.submitted && mydrop.error ? `, ${submitFailure(mydrop.error)}` : ''}`
    : `⚠️ чернетку MyDrop не створено: ${mydrop?.error || 'невідомо'}`;
  const action = mydrop?.submitted
    ? `<b>Не оплачено.</b> Замовлення вже <b>подано постачальнику автоматично</b> (накладений платіж <b>${esc(order.total)} ₴</b>). Зателефонуйте покупцеві; якщо він не підтвердить, скасуйте замовлення в MyDrop до відправки.`
    : `<b>Не оплачено.</b> Зателефонуйте покупцеві й підтвердіть замовлення, потім подайте чернетку постачальнику з накладеним платежем <b>${esc(order.total)} ₴</b> без передоплати.`;
  const html = `<h3>Замовлення НАКЛАДЕНИМ ПЛАТЕЖЕМ №${esc(order.id)}</h3>
<p>${action}</p>
${itemsHtml(order)}
<p>${esc(order.customer_name)}, ${esc(order.phone)}<br>${esc(order.city)}</p>
<p>${esc(draft)}. Переказ постачальнику не потрібен: гроші збере він при отриманні, а вашу різницю виплатить через розділ «Виплати».</p>
<p>Сторінка статусу для покупця: <a href="${esc(orderUrl(order.id))}">${esc(orderUrl(order.id))}</a></p>`;
  return sendMail(`Накладений платіж №${order.id} — ${order.total} ₴ (підтвердити)`, html);
}
