// Фінанси: виписка еквайрингу monobank за період, звірена із замовленнями (market.orders).
// GET /api/finance?days=30   Заголовок X-Finance-Key = FINANCE_KEY. Без ключа в env відповідає 503.
// Суми в гривнях. Прибуток = виручка − комісія − єдиний податок (TAX_PERCENT) − закупівля (supplier_price).

import { getClientInfo, getDetails, getPersonalStatement, getRates, getStatement } from '../../../lib/mono';
import { sbListOrders } from '../../../lib/orders';
import { FEE_PERCENT, MARKUP_PERCENT, TAX_PERCENT, breakEvenMarkupPercent } from '../../../lib/pricing';

const uah = (kop) => Math.round(kop) / 100; // копійки → гривні (для балансу рахунку)

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

    // Прибуток по платежу = виручка − комісія еквайрингу − єдиний податок − закупівля у постачальника.
    // Комісія: з виписки (amount − profitAmount), а коли банк її ще не показав — за MONO_FEE_PERCENT.
    const t = { gross: 0, fee: 0, tax: 0, cost: 0, refunded: 0, profit: 0, unmatched: 0 };
    const rows = paid.map((p) => {
      const order = byRef.get(String(p.reference));
      const cancelled = (p.cancelList || []).reduce((s, c) => s + c.amount, 0);
      const amount = p.amount / 100;
      const feeKnown = p.profitAmount != null;
      const fee = feeKnown ? (p.amount - p.profitAmount) / 100 : (amount * FEE_PERCENT) / 100;
      const tax = (amount * TAX_PERCENT) / 100;
      const cost = order ? (order.supplier_price ?? order.unit_price) * order.qty : null;
      const profit = cost == null ? null : amount - fee - tax - cost;
      t.gross += amount; t.fee += fee; t.tax += tax; t.refunded += cancelled / 100;
      if (cost == null) t.unmatched++; else { t.cost += cost; t.profit += profit; }
      return {
        invoiceId: p.invoiceId,
        date: p.date,
        orderId: order?.id ?? null,
        source: order?.source ?? null,
        product: order?.product_name ?? p.destination,
        amount,
        fee: Math.round(fee * 100) / 100,
        feeFromBank: feeKnown,
        tax: Math.round(tax * 100) / 100,
        supplierCost: cost,
        profit: profit == null ? null : Math.round(profit * 100) / 100,
        refunded: cancelled / 100,
        orderPaymentStatus: order?.payment_status ?? null,
        mismatch: order ? Math.round(order.total * 100) !== p.amount : true,
      };
    });
    const r2 = (n) => Math.round(n * 100) / 100;

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
      pricing: {
        markupPercent: MARKUP_PERCENT,
        taxPercent: TAX_PERCENT,
        feePercent: FEE_PERCENT,
        breakEvenMarkupPercent: breakEvenMarkupPercent(),
      },
      totals: {
        payments: paid.length,
        gross: r2(t.gross),
        fee: r2(t.fee),
        tax: r2(t.tax),
        supplierCost: r2(t.cost),
        profit: r2(t.profit),
        marginPercent: t.gross ? Math.round((t.profit / t.gross) * 1000) / 10 : null,
        refunded: r2(t.refunded),
        withoutOrder: t.unmatched,
      },
      rows,
      paidWithoutStatement, // оплачено за нашою базою, але немає в виписці
    });
  } catch (err) {
    console.error('finance error', err);
    return Response.json({ error: 'finance_failed' }, { status: 502 });
  }
}
