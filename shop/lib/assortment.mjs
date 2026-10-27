// Асортимент магазину: військова тема й енергетика. Застосовується в scripts/sync-catalog.mjs,
// тож до data/products.json (а значить, на сайт, у фід і в мапу сайту) потрапляє тільки це.
// Інші постачальники (Oasis_Drop, Secret Shop) вимкнені; зі змішаного Товарного Синдикату беремо лише енергію.

const FULL_VENDORS = new Set(['BEZET', 'Fortex Military']);

const ENERGY_CATEGORIES = new Set([
  'генератори',
  'автономні обігрівачі',
  'зарядні станції',
  'акумулятори',
  'інвентори', // гібридні інвертори й комплекти ДБЖ
  'автономне живлення та обігрів',
]);
const ENERGY_VENDORS = new Set(['Товарний Синдикат']);

export function inAssortment(vendor, category) {
  if (FULL_VENDORS.has(vendor)) return true;
  if (ENERGY_VENDORS.has(vendor)) return ENERGY_CATEGORIES.has(String(category || '').trim().toLowerCase());
  return false;
}
