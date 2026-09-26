// Приймає замовлення з форми на сайті: зберігає в Supabase (market.orders)
// і одразу створює чернетку замовлення в MyDrop (submitted: false —
// постачальник її ще не бачить, власник подає вручну з кабінету MyDrop).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const { category, vendor, sku, productName, unitPrice, qty, total, customerName, phone, city, note } =
    req.body || {};

  if (!vendor || !productName || !unitPrice || !qty || !customerName || !phone || !city) {
    res.status(400).json({ error: 'missing_fields' });
    return;
  }

  const record = {
    category: category ?? null,
    sku: sku ?? null,
    product_name: productName,
    unit_price: unitPrice,
    qty,
    total: total ?? unitPrice * qty,
    customer_name: customerName,
    phone,
    city,
    note: note ?? null,
    status: 'new',
  };

  let supabaseId = null;
  try {
    const sbRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Accept-Profile': 'market',
        'Content-Profile': 'market',
        Prefer: 'return=representation',
      },
      body: JSON.stringify([record]),
    });
    const sbJson = await sbRes.json();
    supabaseId = Array.isArray(sbJson) ? sbJson[0]?.id ?? null : null;
  } catch (err) {
    console.error('Supabase insert failed', err);
  }

  let mydropOrderId = null;
  let mydropError = null;
  try {
    const mdRes = await fetch('https://backend.mydrop.com.ua/dropshipper/api/orders', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.MYDROP_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: customerName,
        phone,
        delivery_service: 'nova_poshta',
        city,
        products: [
          {
            vendor_name: vendor,
            product_title: productName,
            sku: sku || undefined,
            price: unitPrice,
            amount: qty,
          },
        ],
        order_source: 'Форпост (сайт)',
        description: note || undefined,
      }),
    });
    const mdJson = await mdRes.json();
    if (mdRes.ok) {
      mydropOrderId = mdJson.id;
    } else {
      mydropError = mdJson.message || mdJson.reason || 'mydrop_error';
    }
  } catch (err) {
    mydropError = String(err);
  }

  if (supabaseId && (mydropOrderId || mydropError)) {
    try {
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/orders?id=eq.${supabaseId}`, {
        method: 'PATCH',
        headers: {
          apikey: process.env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Accept-Profile': 'market',
          'Content-Profile': 'market',
        },
        body: JSON.stringify({ mydrop_order_id: mydropOrderId, mydrop_error: mydropError }),
      });
    } catch (err) {
      console.error('Supabase update failed', err);
    }
  }

  res.status(200).json({
    ok: true,
    orderId: supabaseId ?? mydropOrderId ?? 'N/A',
    mydropOrderId,
    mydropError,
  });
}
