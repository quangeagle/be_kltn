// services/weatherUpdater.js
require('dotenv').config(); // ✅ load .env trước tiên

const axios = require('axios');
const moment = require('moment');
const WeeklySalesInput = require('../models/WeeklySalesInput');
const PredictionLog = require('../models/PredictionLog');

async function fetchTemperature(city = 'ho chi minh') {
  try {
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      console.error("❌ Không tìm thấy API_KEY trong .env");
      return null;
    }

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
  const city = process.env.CITY || 'ho chi minh';

  const temperature = await fetchTemperature(city);
  if (temperature == null) return;

  // 1️⃣ Cập nhật vào PredictionLog
  const resultPred = await PredictionLog.updateMany(
    { weekOfYear: currentWeek, year: currentYear },
    { $set: { 'externalFactorsCurrent.temperature': temperature } }
  );

  console.log(`✅ PredictionLog: cập nhật ${resultPred.modifiedCount} bản ghi tuần ${currentWeek}/${currentYear} với nhiệt độ ${temperature}°C`);

  // 2️⃣ Cập nhật vào WeeklySalesInput (items trong array)
  const resultWeekly = await WeeklySalesInput.updateMany(
    {},
    { $set: { 'items.$[elem].temperature': temperature } },
    { arrayFilters: [ { 'elem.weekOfYear': currentWeek, 'elem.year': currentYear } ] }
  );

  console.log(`✅ WeeklySalesInput: cập nhật ${resultWeekly.modifiedCount} bản ghi tuần ${currentWeek}/${currentYear} với nhiệt độ ${temperature}°C`);
}

module.exports = { updateTemperatureForAll };
