const axios = require('axios');
const cheerio = require('cheerio');
const moment = require('moment');
const WeeklySalesInput = require('../models/WeeklySalesInput');
const Supplier = require('../models/Supplier');

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

async function updateFuelPriceForSuppliers() {
  const suppliers = await Supplier.find();
  const now = moment();
  const weekStart = now.startOf('isoWeek').toDate();

  for (let sup of suppliers) {
    const province = 'ho-chi-minh'; // (có thể extract từ sup.storeAddress sau)
    const fuelPriceUSD = await fetchFuelPriceUSD(province);
    if (!fuelPriceUSD) continue;

    const record = await WeeklySalesInput.findOne({
      supplier: sup._id,
      weekStart
    });

    if (record) {
      record.fuelPrice = fuelPriceUSD;
      await record.save();
      console.log(`✅ Đã cập nhật giá xăng cho ${sup.storeName}: ${fuelPriceUSD} USD/Gallon`);
    } else {
      console.warn(`⚠️ Không tìm thấy bản ghi doanh thu tuần này cho ${sup.storeName}`);
    }
  }
}

module.exports = { updateFuelPriceForSuppliers };
