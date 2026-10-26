// Групи й типи товарів. Основне джерело — data/classification.json (її рахує scripts/classify.mjs за назвою, категорією й описом),
// запасний варіант — старі правила з groups-legacy.mjs.
import data from '../data/classification.json';
import { LEGACY_GROUP } from './taxonomy.mjs';
import { legacyGroupOf, legacyTypeOf } from './groups-legacy.mjs';

export { GROUPS, TYPE_RULES, typeRank, typeRow, legacyGroupOf, legacyTypeOf } from './groups-legacy.mjs';

const GL = data.g || [];
const TL = data.t || [];
const MAP = data.m || {};

export function groupOf(p) {
  const c = MAP[p.id];
  if (c) return GL[c[0]];
  const g = legacyGroupOf(p);
  return LEGACY_GROUP[g] || g;
}

export function typeOf(p, group) {
  const c = MAP[p.id];
  if (c) return TL[c[1]];
  const old = group ? Object.keys(LEGACY_GROUP).find((k) => LEGACY_GROUP[k] === group) || group : undefined;
  return legacyTypeOf(p, old);
}
