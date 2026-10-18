// Фінанси: виписка еквайрингу monobank за період, звірена із замовленнями (market.orders).
// GET /api/finance?days=30   Заголовок X-Finance-Key = FINANCE_KEY. Без ключа в env відповідає 503.
// Суми в гривнях. Комісія = amount − profitAmount (з виписки), валова виручка = amount.

import { getClientInfo, getDetails, getPersonalStatement, getRates, getStatement } from '../../../lib/mono';
import { sbListOrders } from '../../../lib/orders';

const uah = (kop) => Math.round(kop) / 100;

export async function GET(req) {
  const key = process.env.FINANCE_KEY;
  if (!key) return Response.json({ error: 'finance_disabled' }, { status: 503 });
  if (req.headers.get('x-finance-key') !== key) return Response.json({ error: 'forbidden' }, { status: 403 });

  const days = Math.min(Math.max(Number(new URL(req.url).searchParams.get('days')) || 30, 1), 31);
  const to = Math.floor(Date.now() / 1000);
  const from = to - days * 86400;

  try {
    const [merchant, statement, orders, rates] = await Promise.all([
      getDetails(),
      getStatement(from, to),
      sbListOrders(new Date(from * 1000).toISOString()),
      getRates().catch(() => null),
    ]);

    const byRef = new Map(orders.map((o) => [String(o.id), o]));
    const paid = statement.filter((p) => p.status === 'success');

    let gross = 0;
    let net = 0;
    let refunded = 0;
    const rows = paid.map((p) => {
      const order = byRef.get(String(p.reference));
      const cancelled = (p.cancelList || []).reduce((s, c) => s + c.amount, 0);
      gross += p.amount;
      net += p.profitAmount ?? p.amount;
      refunded += cancelled;
      return {
        invoiceId: p.invoiceId,
        date: p.date,
        orderId: order?.id ?? null,
        product: order?.product_name ?? p.destination,
        amount: uah(p.amount),
        fee: uah(p.amount - (p.profitAmount ?? p.amount)),
        net: uah(p.profitAmount ?? p.amount),
        refunded: uah(cancelled),
        // закупівля = ціна постачальника на момент замовлення (supplier_price, а якщо її немає — ціна продажу)
        supplierCost: order ? (order.supplier_price ?? order.unit_price) * order.qty : null,
        orderPaymentStatus: order?.payment_status ?? null,
        mismatch: order ? Math.round(order.total * 100) !== p.amount : true,
      };
    });

    const stmtRefs = new Set(paid.map((p) => String(p.reference)));
    const paidWithoutStatement = orders
      .filter((o) => o.payment_status === 'paid' && !stmtRefs.has(String(o.id)))
      .map((o) => ({ orderId: o.id, total: o.total }));

    // Витрати зі свого рахунку (напр. оплата постачальнику): лише якщо задано особистий токен.
    let account = null;
    if (process.env.MONO_PERSONAL_TOKEN) {
      try {
        const info = await getClientInfo();
        const acc = info.accounts?.[0];
        const items = await getPersonalStatement(from, to, acc?.id ?? '0');
        const spent = items.filter((t) => t.amount < 0);
        account = {
          balance: acc ? uah(acc.balance) : null,
          spent: uah(-spent.reduce((x, t) => x + t.amount, 0)),
          income: uah(items.filter((t) => t.amount > 0).reduce((x, t) => x + t.amount, 0)),
          expenses: spent.map((t) => ({ date: new Date(t.time * 1000).toISOString(), description: t.description, amount: uah(-t.amount) })),
        };
      } catch (err) {
        console.error('personal account failed', err);
        account = { error: 'personal_unavailable' }; // напр. ліміт 1 запит/60 с
      }
    }

    return Response.json({
      account,
      merchant: { id: merchant.merchantId, name: merchant.merchantName },
      periodDays: days,
      rates,
      totals: {
        payments: paid.length,
        gross: uah(gross),
        fee: uah(gross - net),
        net: uah(net),
        refunded: uah(refunded),
      },
      rows,
      paidWithoutStatement, // оплачено за нашою базою, але немає в виписці
    });
  } catch (err) {
    console.error('finance error', err);
    return Response.json({ error: 'finance_failed' }, { status: 502 });
  }
}
