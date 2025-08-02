// services/weatherUpdater.js
require('dotenv').config(); // ✅ Phải nằm đầu tiên

const axios = require('axios');
const moment = require('moment');
const WeeklySalesInput = require('../models/WeeklySalesInput');
const Supplier = require('../models/Supplier');

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

async function updateTemperatureForSuppliers() {
  const suppliers = await Supplier.find();
  const now = moment();
  const weekStart = now.startOf('isoWeek').toDate();

  for (let sup of suppliers) {
    const city = 'ho chi minh'; // ❗ Bạn có thể thay bằng sup.city nếu bạn đã lưu thành phố trong DB

    const temperature = await fetchTemperature(city);
    if (temperature == null) continue;

    const record = await WeeklySalesInput.findOne({
      supplier: sup._id,
      weekStart
    });

    if (record) {
      record.temperature = temperature;
      await record.save();
      console.log(`✅ Cập nhật nhiệt độ cho supplier ${sup.storeName}: ${temperature}°C`);
    } else {
      console.log(`⚠️ Không tìm thấy bản ghi tuần hiện tại cho supplier ${sup.storeName}`);
    }
  }
}

module.exports = { updateTemperatureForSuppliers };
