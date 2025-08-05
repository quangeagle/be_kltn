require('dotenv').config();
const mongoose = require('mongoose');
const moment = require('moment');
const WeeklySalesInput = require('../models/WeeklySalesInput');

// Thay ID này bằng ID thật của supplier (ví dụ: Quang2)
const supplierId = '688dc4c3ccd0c9e7f9913070';

// Kết nối MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Đã kết nối MongoDB');
    return seedData();
  })
  .then(() => {
    console.log('✅ Đã chèn dữ liệu giả lập!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Lỗi:', err);
    process.exit(1);
  });

async function seedData() {
  const baseDate = moment().startOf('isoWeek'); // tuần hiện tại
  for (let i = 0; i < 9; i++) {
    const weekStart = baseDate.clone().subtract(9 - i, 'weeks').toDate();
    const weekOfYear = parseInt(moment(weekStart).format('W'));
    const month = moment(weekStart).month() + 1;

    const newRecord = new WeeklySalesInput({
      supplier: supplierId,
      weekIndex: i + 2, // Tuần 2 đến 10 (đã có tuần 1)
      weekStart,
      year: 2025,
      weekOfYear,
      month,
      weeklySales: 100000 + i * 5000,
      holidayFlag: 0,
      temperature: 28 + i * 0.2,
      fuelPrice: 2.9 + i * 0.01,
      cpi: 210 + i,
      unemployment: 7.5 - i * 0.1,
    });

    await newRecord.save();
    console.log(`📦 Đã chèn tuần ${i + 2}: ${moment(weekStart).format('YYYY-MM-DD')}`);
  }
}
