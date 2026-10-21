import { getDetails } from '../../lib/mono';

export const metadata = { title: 'Публічна оферта — Форпост' };
export const dynamic = 'force-dynamic';

// ПІБ і РНОКПП беремо з monobank (дані мерчанта), env SELLER_* має пріоритет.
// Адреса й email — лише з env. Результат кешуємо в памʼяті на годину.
let cached = { at: 0, value: null };
async function getSeller() {
  if (!cached.value || Date.now() - cached.at > 3600_000) {
    const d = await getDetails().catch((err) => {
      console.error('oferta: mono details failed', err);
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

export default async function Page() {
  const seller = await getSeller();
  return (
    <main style={{ maxWidth: 760, lineHeight: 1.6 }}>
      <p><a href="/">← До каталогу</a></p>
      <h1>Публічна оферта</h1>
      <p>Цей документ є публічною пропозицією (офертою) укласти договір купівлі-продажу товарів через сайт.</p>

      <h2>1. Продавець</h2>
      <p>Фізична особа-підприємець {seller.name}, РНОКПП {seller.taxId}, єдиний податок, 3 група. Адреса: {seller.address}. Телефон: +380 75 585 78 41. Ел. пошта: {seller.email}.</p>

      <h2>2. Предмет договору</h2>
      <p>Продавець передає, а Покупець оплачує товар із каталогу сайту за ціною, вказаною на момент оформлення замовлення. Товар відправляється зі складу постачальника.</p>

      <h2>3. Оформлення і оплата</h2>
      <p>Замовлення оформлюється через форму на сайті. Оплата — банківською карткою онлайн через платіжний сервіс monobank (mono pay) у гривнях. Договір вважається укладеним з моменту успішної оплати. Дані картки Продавцю не передаються.</p>

      <h2>4. Доставка</h2>
      <p>Доставка — Новою Поштою у відділення, вказане Покупцем. Вартість доставки сплачується за тарифами перевізника, якщо інше не зазначено в замовленні. Умови — на сторінці <a href="/povernennya">«Повернення і доставка»</a>.</p>

      <h2>5. Повернення</h2>
      <p>Покупець має право повернути товар належної якості протягом 14 днів згідно із Законом України «Про захист прав споживачів». Порядок — на сторінці <a href="/povernennya">«Повернення і доставка»</a>.</p>

      <h2>6. Персональні дані</h2>
      <p>Ім'я, телефон і адреса доставки використовуються лише для виконання замовлення та передаються постачальнику і перевізнику в обсязі, необхідному для доставки.</p>
    </main>
  );
}
