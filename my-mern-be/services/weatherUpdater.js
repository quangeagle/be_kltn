  // services/weatherUpdater.js
  require('dotenv').config(); // ✅ Phải nằm đầu tiên

  const axios = require('axios');
  const moment = require('moment');
  const WeeklySalesInput = require('../models/WeeklySalesInput');
  const PredictionLog = require('../models/PredictionLog');
  const Supplier = require('../models/Supplier');
  const now = moment();
  const weekOfYear = now.isoWeek();
  const year = now.isoWeekYear();
  async function fetchTemperature(city = 'ho chi minh') {
    try {
      const apiKey = process.env.API_KEY;

      // Log để chắc chắn dotenv đã load đúng
      console.log("🔑 API KEY đang dùng:", apiKey);
      console.log("🏙️ CITY đang dùng:", city);

      const url = `https://api.openweathermap.org/data/2.5/weather?q=${city},vn&appid=${apiKey}&units=metric`;
      const res = await axios.get(url);

      return res.data.main.temp;
    } catch (err) {
      console.error('❌ Không lấy được nhiệt độ:', err.message);
      return null;
    }
  }

  async function updateTemperatureForAll() {
  const now = moment();
  const currentWeek = now.isoWeek();
  const currentYear = now.isoWeekYear();
  const city = 'ho chi minh';

  const temperature = await fetchTemperature(city);
  if (temperature == null) return;

  // Cập nhật vào PredictionLog để người dùng có thể dự đoán ngay lập tức
  const result = await PredictionLog.updateMany(
    {
      weekOfYear: currentWeek,
      year: currentYear
    },
    {
      $set: {
        'externalFactorsCurrent.temperature': temperature
      }
    }
  );

  console.log(`✅ Đã cập nhật nhiệt độ vào PredictionLog cho ${result.modifiedCount} bản ghi tuần ${currentWeek}/${currentYear}: ${temperature}°C`);
}

// Hàm cập nhật nhiệt độ cho tuần mới (chỉ chạy vào thứ 2)
async function updateTemperatureForNewWeek() {
  const now = moment();
  const currentWeek = now.isoWeek();
  const currentYear = now.isoWeekYear();
  const currentDay = now.day(); // 0 = Chủ nhật, 1 = Thứ 2
  const city = 'ho chi minh';
  
  // Chỉ cập nhật vào thứ 2 (day = 1)
  if (currentDay !== 1) {
    console.log('📅 Không phải thứ 2, bỏ qua cập nhật tuần mới');
    return;
  }

  const temperature = await fetchTemperature(city);
  if (temperature == null) return;

  // Cập nhật vào WeeklySalesInput cho tuần mới (chỉ thứ 2)
  const result = await WeeklySalesInput.updateMany(
    {},
    {
      $set: {
        'items.$[elem].temperature': temperature
      }
    },
    {
      arrayFilters: [
        {
          'elem.weekOfYear': currentWeek,
          'elem.year': currentYear
        }
      ]
    }
  );

  console.log(`🆕 Đã cập nhật nhiệt độ TUẦN MỚI vào WeeklySalesInput cho ${result.modifiedCount} bản ghi tuần ${currentWeek}/${currentYear}: ${temperature}°C`);
}
  
  
  
  module.exports = { updateTemperatureForAll, updateTemperatureForNewWeek };
