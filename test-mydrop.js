// Демонстрація потоку "клієнт купив на моєму сайті → замовлення в MyDrop → подати постачальнику".
// Без MYDROP_API_KEY в .env просто друкує структуру запитів на мок-даних (dry-run, без реальних викликів).
// З ключем — реально тягне твоїх підключених постачальників і їхній каталог.

require('dotenv').config();
const mydrop = require('./mydrop');

const MOCK_ORDER = {
  name: 'Тест Клієнт',
  phone: '+380960000001',
  city: 'Київ',
  warehouse_number: '1',
  delivery_service: 'nova_poshta',
  products: [
    {
      vendor_name: 'ТестПостачальник',
      product_title: 'Бездротові навушники i12 TWS',
      sku: 'i12-tws',
      price: 350,
      amount: 1,
    },
  ],
};

async function dryRun() {
  console.log('ℹ MYDROP_API_KEY не задано в .env — показую структуру запитів на мок-даних (реальних викликів API не буде)\n');
  console.log('1) GET  /dropshipper/api/dropshipper_vendors');
  console.log('   → список постачальників, підключених до кабінету\n');
  console.log('2) GET  /dropshipper/api/export/dropshipper_vendors/<id>/products/json');
  console.log('   → каталог постачальника: товари + дропшип-ціни (гуртові, не роздрібні)\n');
  console.log('3) POST /dropshipper/api/orders  — створити замовлення:');
  console.log(JSON.stringify(MOCK_ORDER, null, 2));
  console.log();
  console.log('4) POST /dropshipper/api/orders/<id>/submit');
  console.log('   → подати замовлення постачальнику (це і є фактична "закупка" — без ручного чекауту)');
}

async function liveRun() {
  console.log('Підключені постачальники:');
  const vendors = await mydrop.getVendors();
  console.log(vendors);

  const vendorList = Array.isArray(vendors) ? vendors : vendors?.data;
  if (Array.isArray(vendorList) && vendorList.length > 0) {
    const first = vendorList[0];
    console.log(`\nКаталог постачальника "${first.name ?? first.id}" (перші записи):`);
    const catalog = await mydrop.getVendorCatalog(first.id);
    const items = Array.isArray(catalog) ? catalog : catalog?.products ?? catalog;
    console.log(Array.isArray(items) ? items.slice(0, 3) : items);
  } else {
    console.log('\nПостачальників поки не підключено в кабінеті MyDrop.');
  }
}

async function main() {
  if (!process.env.MYDROP_API_KEY) {
    await dryRun();
    return;
  }
  await liveRun();
}

main().catch((err) => {
  console.error('Помилка:', err.message);
  process.exit(1);
});
