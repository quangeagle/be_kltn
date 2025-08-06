// services/initWeeklyData.js
const WeeklySalesInput = require('../models/WeeklySalesInput');
const Supplier = require('../models/Supplier');
const moment = require('moment');

async function createEmptyWeekIfMissing() {
  const suppliers = await Supplier.find();
  const weekStart = moment().startOf('isoWeek').toDate();
  const weekOfYear = moment().isoWeek();
  const year = moment().isoWeekYear();
  const month = weekStart.getMonth() + 1;

  for (let sup of suppliers) {
    let record = await WeeklySalesInput.findOne({ supplier: sup._id });

    const alreadyExists = record?.items?.some(item =>
      moment(item.weekStart).isSame(weekStart, 'day')
    );

    if (!alreadyExists) {
      const newItem = {
        weekIndex: moment().diff(moment('2024-01-01'), 'weeks'), // Hoặc countDocuments
        weekStart,
        weekOfYear,
        year,
        month,
        weeklySales: 0,
        holidayFlag: 0,
        temperature: null,
        fuelPrice: null,
        cpi: 100,
        unemployment: 5
      };

      if (!record) {
        // Chưa từng có bản ghi nào cho supplier
        record = new WeeklySalesInput({
          supplier: sup._id,
          items: [newItem]
        });
      } else {
        if (record.items.length >= 10) {
          record.items.shift(); // Xoá tuần cũ nhất nếu đã đủ 10
        }
        record.items.push(newItem);
      }

      await record.save();
      console.log(`🟢 Tạo bản ghi tuần mới cho ${sup.storeName}`);
    }
  }
}

module.exports = { createEmptyWeekIfMissing };
