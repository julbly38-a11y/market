// Клієнт monobank: еквайринг (mono pay) і публічні курси. Токен лише на сервері.
// Документація: https://api.monobank.ua/docs/acquiring.html

import { createVerify } from 'node:crypto';

const BASE = 'https://api.monobank.ua';

async function mono(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'X-Token': process.env.MONO_TOKEN, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`mono_http_${res.status}: ${json.errText || json.errCode || ''}`);
  return json;
}

export const getDetails = () => mono('/api/merchant/details');
export const getInvoiceStatus = (invoiceId) =>
  mono(`/api/merchant/invoice/status?invoiceId=${encodeURIComponent(invoiceId)}`);
export const cancelInvoice = (invoiceId, extRef) =>
  mono('/api/merchant/invoice/cancel', { method: 'POST', body: { invoiceId, extRef } });

// Виписка платежів за період (unix-секунди). amount і profitAmount — в копійках.
export async function getStatement(from, to) {
  const q = new URLSearchParams({ from: String(from), ...(to ? { to: String(to) } : {}) });
  const json = await mono(`/api/merchant/statement?${q}`);
  return json.list || [];
}

// Публічний ключ для перевірки підпису вебхука. Кешуємо на процес.
let pubkeyPem;
async function getPubkeyPem() {
  if (!pubkeyPem) {
    const { key } = await mono('/api/merchant/pubkey');
    pubkeyPem = Buffer.from(key, 'base64').toString('utf8');
  }
  return pubkeyPem;
}

// X-Sign — ECDSA-підпис (SHA-256) сирого тіла вебхука, base64.
export async function verifyWebhookSign(rawBody, xSign) {
  if (!xSign) return false;
  try {
    return createVerify('SHA256').update(rawBody).verify(await getPubkeyPem(), xSign, 'base64');
  } catch {
    return false;
  }
}

// Публічні курси (без токена): UAH за 1 USD / EUR, продаж.
export async function getRates() {
  const res = await fetch(`${BASE}/bank/currency`, { next: { revalidate: 300 } });
  if (!res.ok) return null;
  const list = await res.json();
  const sell = (a) => list.find((r) => r.currencyCodeA === a && r.currencyCodeB === 980)?.rateSell ?? null;
  return { usd: sell(840), eur: sell(978) };
}

// ---- Особистий Open API (токен з https://api.monobank.ua, змінна MONO_PERSONAL_TOKEN) ----
// Ліміт банку: виписка не частіше 1 разу на 60 с і не більше ~31 доби за запит, тому кешуємо на 60 с.
async function personal(path, revalidate = 60) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'X-Token': process.env.MONO_PERSONAL_TOKEN },
    next: { revalidate },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`mono_personal_http_${res.status}: ${json.errorDescription || ''}`);
  return json;
}

// Рахунки клієнта (id, тип, валюта, баланс у копійках).
export const getClientInfo = () => personal('/personal/client-info');

// Виписка рахунку ('0' = перший рахунок). amount < 0 — витрата. Суми в копійках.
export const getPersonalStatement = (from, to, account = '0') =>
  personal(`/personal/statement/${encodeURIComponent(account)}/${from}/${to}`);
