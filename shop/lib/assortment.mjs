// Асортимент магазину. Застосовується в scripts/sync-catalog.mjs,
// тож до data/products.json (а значить, на сайт, у фід і в мапу сайту) потрапляє тільки це.
// 27.10 було звужено до військової теми й енергетики, того ж дня власник повернув усіх постачальників.

// Усі підключені постачальники в каталозі. Повернено 27.10 після короткого звуження до Товарного Синдикату.
const VENDORS = new Set(['BEZET', 'Fortex Military', 'Oasis_Drop', 'Товарний Синдикат', 'Secret Shop']);

export function inAssortment(vendor) {
  return VENDORS.has(vendor);
}
