// Клієнт для MyDrop API (роль dropshipper) — https://api.mydrop.com.ua/
// Дозволяє: тягнути каталог/ціни постачальників і створювати+подавати замовлення
// без власного складу (постачальник сам комплектує й відправляє клієнту).

require('dotenv').config();

const BASE_URL = 'https://backend.mydrop.com.ua';

function apiKey() {
  const key = process.env.MYDROP_API_KEY;
  if (!key) {
    throw new Error('MYDROP_API_KEY не задано в .env (див. .env.example)');
  }
  return key;
}

async function request(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!res.ok) {
    const detail = typeof json === 'string' ? json : JSON.stringify(json);
    throw new Error(`MyDrop API ${method} ${path} → HTTP ${res.status}: ${detail}`);
  }
  return json;
}

// Список постачальників, підключених до твого кабінету дропшипера
function getVendors() {
  return request('GET', '/dropshipper/api/dropshipper_vendors');
}

// Каталог конкретного постачальника: товари + дропшип-ціни (не роздрібні!)
function getVendorCatalog(vendorId) {
  return request('GET', `/dropshipper/api/export/dropshipper_vendors/${vendorId}/products/json`);
}

// Власні замовлення (пагінація через params, напр. { page: 1 })
function listOrders(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request('GET', `/dropshipper/api/orders${qs ? `?${qs}` : ''}`);
}

function getOrder(orderId) {
  return request('GET', `/dropshipper/api/orders/${orderId}`);
}

// Створити замовлення (ще не подане постачальнику — можна перевірити/відредагувати)
// order: { name, phone, city, warehouse_number, delivery_service, products: [{ vendor_name, product_title, sku, price, amount, size_title? }] }
function createOrder(order) {
  return request('POST', '/dropshipper/api/orders', order);
}

// Подати вже створене замовлення постачальнику — це і є фактична "закупка"
function submitOrder(orderId) {
  return request('POST', `/dropshipper/api/orders/${orderId}/submit`);
}

function updateOrder(orderId, data) {
  return request('PUT', `/dropshipper/api/orders/${orderId}`, data);
}

module.exports = {
  getVendors,
  getVendorCatalog,
  listOrders,
  getOrder,
  createOrder,
  submitOrder,
  updateOrder,
};
