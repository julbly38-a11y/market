// Дані продавця (ФОП) для юридичних сторінок. ПІБ і РНОКПП — з monobank (дані мерчанта),
// env SELLER_* має пріоритет; адреса й email — лише з env. Кеш у памʼяті на годину.
import { getDetails } from './mono';

let cached = { at: 0, value: null };

export async function getSeller() {
  if (!cached.value || Date.now() - cached.at > 3600_000) {
    const d = await getDetails().catch((err) => {
      console.error('seller: mono details failed', err);
      return null;
    });
    if (d) cached = { at: Date.now(), value: { name: d.merchantName, taxId: d.edrpou } };
  }
  const fromMono = cached.value || {};
  return {
    name: process.env.SELLER_NAME || fromMono.name,
    taxId: process.env.SELLER_TAXID || fromMono.taxId,
    address: process.env.SELLER_ADDRESS,
    email: process.env.SELLER_EMAIL,
  };
}
