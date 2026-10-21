// Довідник Нової Пошти (офіційний API v2.0, ключ для довідників не потрібен): міста й відділення.
const NP = 'https://api.novaposhta.ua/v2.0/json/';
const POSTOMAT = 'f9316480-5f2d-425d-bc2c-ac7cd29decf0'; // поштомати не беремо: у MyDrop потрібен номер відділення

async function call(modelName, calledMethod, methodProperties) {
  const res = await fetch(NP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: '', modelName, calledMethod, methodProperties }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!json.success) throw new Error(`np_${calledMethod}: ${(json.errors || []).join('; ')}`);
  return json.data;
}

export async function searchCities(q) {
  const data = await call('Address', 'searchSettlements', { CityName: q, Limit: '10' });
  return (data[0]?.Addresses || [])
    .filter((a) => a.DeliveryCity && a.Warehouses > 0)
    .map((a) => ({ ref: a.DeliveryCity, name: a.MainDescription, present: a.Present }));
}

// Відділення міста; кеш у памʼяті на 10 хв (у Києві сотні записів).
const cache = new Map();
export async function getBranches(cityRef) {
  const hit = cache.get(cityRef);
  if (hit && Date.now() - hit.at < 600_000) return hit.rows;
  const data = await call('Address', 'getWarehouses', { CityRef: cityRef, Language: 'UA', Limit: '1000' });
  const rows = data
    .filter((w) => w.TypeOfWarehouse !== POSTOMAT && /^\d{1,5}$/.test(String(w.Number)))
    .map((w) => ({ number: String(w.Number), name: w.Description }));
  cache.set(cityRef, { at: Date.now(), rows });
  return rows;
}
