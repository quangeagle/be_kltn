require('dotenv').config();
const { updateFuelPriceForSuppliers } = require('../services/fuelUpdater');
const { updateTemperatureForSuppliers } = require('../services/weatherUpdater');

async function runUpdate() {
  console.log('🚀 Bắt đầu cập nhật dữ liệu hàng tuần...');
  await updateFuelPriceForSuppliers();
  await updateTemperatureForSuppliers();
  console.log('✅ Hoàn tất cập nhật dữ liệu!');
  process.exit(0);
}

runUpdate().catch((err) => {
  console.error('❌ Lỗi trong quá trình cập nhật:', err);
  process.exit(1);
});
