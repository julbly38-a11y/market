// Спільна логіка оновлення нашого замовлення з даних замовлення MyDrop (ТТН, статус постачальника, статус доставки).
// Використовують cron /api/cron/order-sync (опитування) і вебхук /api/webhooks/mydrop (миттєво).

import { orderUrl, sb } from './orders';
import { customerMailReady, sendCustomerMail, sendMail } from './notify';

// o: рядок market.orders {id,email,ttn,mydrop_status,delivery_status,ttn_notified_at}, m: замовлення MyDrop.
// Повертає { updated, ttn }: чи змінено запис і чи зʼявилась нова ТТН (тоді надіслано листи).
export async function applyMydropOrder(o, m) {
  const ttn = m.ttn ? String(m.ttn) : null;
  const patch = {};
  if (ttn && ttn !== o.ttn) patch.ttn = ttn;
  const status = m.orderStatus?.title || null;
  if (status && status !== o.mydrop_status) patch.mydrop_status = status;
  const delivery = m.ttnTextStatus || m.deliveryStatus || null;
  if (delivery && delivery !== o.delivery_status) patch.delivery_status = String(delivery);
  if (m.submitted === true && !o.mydrop_submitted) patch.mydrop_submitted = true; // подано вручну в кабінеті або автоподачею
  if (!Object.keys(patch).length) return { updated: false, ttn: false };

  let newTtn = false;
  if (patch.ttn && !o.ttn_notified_at) {
    let sent = false;
    const link = orderUrl(o.id);
    if (customerMailReady() && o.email) {
      sent = !!(await sendCustomerMail(o.email, `Замовлення №${o.id} відправлено`,
        `<p>Ваше замовлення відправлено Новою Поштою.</p><p>Номер ТТН: <b>${ttn}</b></p><p><a href="${link}">Статус замовлення</a></p>`)).ok;
    }
    await sendMail(`ТТН по замовленню №${o.id}: ${ttn}`, `<p>Постачальник відправив замовлення №${o.id}. ТТН: <b>${ttn}</b>.${sent ? ' Покупцю надіслано лист.' : ' Лист покупцю не надіслано (немає email або домену).'}</p>`);
    patch.ttn_notified_at = new Date().toISOString();
    newTtn = true;
  }
  await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${o.id}`, { method: 'PATCH', headers: sb(), body: JSON.stringify(patch) });
  return { updated: true, ttn: newTtn };
}
