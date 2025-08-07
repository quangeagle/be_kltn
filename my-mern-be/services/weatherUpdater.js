  // services/weatherUpdater.js
  require('dotenv').config(); // ✅ Phải nằm đầu tiên

  const axios = require('axios');
  const moment = require('moment');
  const WeeklySalesInput = require('../models/WeeklySalesInput');
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
    const city = 'ho chi minh';
    const temperature = await fetchTemperature(city);
    if (temperature == null) return;
  
    const now = moment();
    const weekStart = now.startOf('isoWeek').toDate();
  
    const result = await WeeklySalesInput.updateMany(
      { 'items.weekStart': weekStart },
      {
        $set: {
          'items.$[elem].temperature': temperature
        }
      },
      {
        arrayFilters: [{ 'elem.weekStart': weekStart }]
      }
    );
  
    console.log(`✅ Cập nhật nhiệt độ cho ${result.modifiedCount} bản ghi tuần ${weekStart}: ${temperature}°C`);
  }
  
  
  
  module.exports = { updateTemperatureForAll };
