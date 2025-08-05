require('dotenv').config();
const mongoose = require('mongoose');
const { updateFuelPriceForAll } = require('../services/fuelUpdater');
const { updateTemperatureForAll } = require('../services/weatherUpdater');

async function runUpdate() {
  try {
    console.log('🚀 Bắt đầu kết nối MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Kết nối MongoDB thành công!');

    console.log('🚀 Bắt đầu cập nhật dữ liệu hàng tuần...');
    await updateFuelPriceForAll();
    await updateTemperatureForAll();
    console.log('✅ Hoàn tất cập nhật dữ liệu!');
  } catch (err) {
    console.error('❌ Lỗi trong quá trình cập nhật:', err);
    process.exit(1);
  } finally {
    mongoose.connection.close(); // Đóng kết nối sau khi xong
  }
}

runUpdate();
