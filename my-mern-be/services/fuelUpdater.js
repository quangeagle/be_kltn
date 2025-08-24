const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment');
const WeeklySalesInput = require('../models/WeeklySalesInput');
const PredictionLog = require('../models/PredictionLog');

async function fetchRateUSD() {
  console.log("⚠️ Sử dụng tỷ giá giả để test");
  return 0.000039; // ~1 VND = 0.000039 USD
}

async function fetchFuelPriceUSD(province = 'ho-chi-minh') {
  try {
    console.log(`🌍 Đang lấy giá xăng từ: ${province}`);
    const { data } = await axios.get(`https://giaxanghomnay.com/tinh-tp/${province}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    const $ = cheerio.load(data);
    const usdRate = await fetchRateUSD();
    if (!usdRate) {
      console.warn("⚠️ Không thể lấy tỷ giá USD. Dừng lại.");
      return null;
    }

    const tds = $('table tbody tr').first().find('td');
    const priceVND = parseFloat($(tds[2]).text().replace(/[.,]/g, ''));
    const usdPerGallon = priceVND * usdRate * 3.78541;

    console.log(`✅ Giá xăng: ${priceVND} VND/L = ${usdPerGallon.toFixed(2)} USD/Gallon`);

    return parseFloat(usdPerGallon.toFixed(2)); // Làm tròn 2 chữ số
  } catch (err) {
    console.error(`❌ Không lấy được giá xăng tỉnh ${province}:`, err.message);
    return null;
  }
}

async function updateFuelPriceForAll() {
  const now = moment();
  const currentWeek = now.isoWeek();
  const currentYear = now.isoWeekYear();
  const province = 'ho-chi-minh';

  const fuelPriceUSD = await fetchFuelPriceUSD(province);
  if (!fuelPriceUSD) return;

  // Cập nhật vào PredictionLog để người dùng có thể dự đoán ngay lập tức
  const result = await PredictionLog.updateMany(
    {
      weekOfYear: currentWeek,
      year: currentYear
    },
    {
      $set: {
        'externalFactorsCurrent.fuelPrice': fuelPriceUSD
      }
    }
  );

  console.log(`✅ Đã cập nhật giá xăng vào PredictionLog cho ${result.modifiedCount} bản ghi tuần ${currentWeek}/${currentYear}: ${fuelPriceUSD} USD/gallon`);
}

// Hàm cập nhật giá xăng cho tuần mới (chỉ chạy vào thứ 2)
async function updateFuelPriceForNewWeek() {
  const now = moment();
  const currentWeek = now.isoWeek();
  const currentYear = now.isoWeekYear();
  const currentDay = now.day(); // 0 = Chủ nhật, 1 = Thứ 2
  
  // Chỉ cập nhật vào thứ 2 (day = 1)
  if (currentDay !== 1) {
    console.log('📅 Không phải thứ 2, bỏ qua cập nhật tuần mới');
    return;
  }

  const province = 'ho-chi-minh';
  const fuelPriceUSD = await fetchFuelPriceUSD(province);
  if (!fuelPriceUSD) return;

  // Cập nhật vào WeeklySalesInput cho tuần mới (chỉ thứ 2)
  const result = await WeeklySalesInput.updateMany(
    {},
    {
      $set: {
        'items.$[elem].fuelPrice': fuelPriceUSD
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

  console.log(`🆕 Đã cập nhật giá xăng TUẦN MỚI vào WeeklySalesInput cho ${result.modifiedCount} bản ghi tuần ${currentWeek}/${currentYear}: ${fuelPriceUSD} USD/gallon`);
}

module.exports = { updateFuelPriceForAll, updateFuelPriceForNewWeek };