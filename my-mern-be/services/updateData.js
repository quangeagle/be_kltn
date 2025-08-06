require('dotenv').config();
const mongoose = require('mongoose');
const { updateFuelPriceForAll } = require('../services/fuelUpdater');
const { updateTemperatureForAll } = require('../services/weatherUpdater');
const { createEmptyWeekIfMissing } = require('../services/initWeeklyData'); // 👈 Thêm hàm này

async function runUpdate() {
  try {
    console.log('🚀 Bắt đầu kết nối MongoDB...');
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Kết nối MongoDB thành công!');

    console.log('🟡 Tạo bản ghi tuần mới cho các nhà cung cấp (nếu chưa có)...');
    await createEmptyWeekIfMissing(); // 👈 Bước tạo bản ghi

    console.log('⛽ Cập nhật giá xăng...');
    await updateFuelPriceForAll();

    console.log('🌡️ Cập nhật nhiệt độ...');
    await updateTemperatureForAll();

    console.log('✅ Hoàn tất cập nhật dữ liệu hàng tuần!');
  } catch (err) {
    console.error('❌ Lỗi trong quá trình cập nhật:', err);
    process.exit(1);
  } finally {
    mongoose.connection.close(); // Đóng kết nối sau khi xong
  }
}

runUpdate();
