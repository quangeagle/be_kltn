require('dotenv').config();
const mongoose = require('mongoose');
const moment = require('moment');
const Supplier = require('../models/Supplier');
const WeeklySalesInput = require('../models/WeeklySalesInput');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/your-db-name';

const fixedData = [
  [1643690.90, 0, 42.31, 2.572, 211.0963582, 8.106],
  [1641957.44, 1, 38.51, 2.548, 211.2421698, 8.106],
  [1611968.17, 0, 39.93, 2.514, 211.2891429, 8.106],
  [1409727.59, 0, 46.63, 2.561, 211.3196429, 8.106],
  [1554806.68, 0, 46.5, 2.625, 211.3501429, 8.106],
  [1439541.59, 0, 57.79, 2.667, 211.3806429, 8.106],
  [1472515.79, 0, 54.58, 2.72, 211.215635, 8.106],
  [1404429.92, 0, 51.45, 2.732, 211.0180424, 8.106],
  [1594968.28, 0, 62.27, 2.719, 210.8204499, 7.808],
  [1545418.53, 0, 65.86, 2.77, 210.6228574, 7.808]
];

async function createFixedSupplierAndData() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Kết nối MongoDB thành công');

  const supplier = new Supplier({
    storeName: 'Shop Test Cố Định',
    email: 'testshop@example.com',
    phone: '0909009000',
    password: 'testpassword' // Mặc định thôi, không cần bảo mật ở đây
  });

  await supplier.save();
  console.log(`✅ Tạo supplier: ${supplier.storeName}`);

  const today = moment();
  const items = [];

  fixedData.forEach((row, index) => {
    const weekMoment = today.clone().subtract(9 - index, 'weeks').startOf('isoWeek');
    items.push({
      weekIndex: index,
      weekStart: weekMoment.toDate(),
      year: weekMoment.isoWeekYear(),
      weekOfYear: weekMoment.isoWeek(),
      month: weekMoment.month() + 1,
      weeklySales: row[0],
      holidayFlag: row[1],
      temperature: row[2],
      fuelPrice: row[3],
      cpi: row[4],
      unemployment: row[5]
    });
  });

  const record = new WeeklySalesInput({
    supplier: supplier._id,
    items
  });

  await record.save();
  console.log('📊 Đã tạo dữ liệu 10 tuần cố định');

  await mongoose.disconnect();
  console.log('✅ Hoàn tất!');
}

createFixedSupplierAndData();
