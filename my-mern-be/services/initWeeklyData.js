// services/initWeeklyData.js
const WeeklySalesInput = require('../models/WeeklySalesInput');
const Supplier = require('../models/Supplier');
const moment = require('moment');

async function createEmptyWeekIfMissing() {
  const suppliers = await Supplier.find();
  const currentWeekStart = moment().startOf('isoWeek');

  for (let sup of suppliers) {
    const createdAt = moment(sup.createdAt).startOf('day');
    let record = await WeeklySalesInput.findOne({ supplier: sup._id });
  
    const weekIndex = currentWeekStart.diff(createdAt, 'weeks');
    const weekStart = currentWeekStart.clone(); // ✅ đồng bộ với các update khác
  
    const weekOfYear = weekStart.isoWeek();
    const year = weekStart.isoWeekYear();
    const month = weekStart.month() + 1;
  
    const alreadyExists = record?.items?.some(item =>
      moment(item.weekStart).isSame(weekStart, 'day')
    );
  
    if (!alreadyExists) {
      const newItem = {
        weekIndex,
        weekStart: weekStart.toDate(),
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
        record = new WeeklySalesInput({
          supplier: sup._id,
          items: [newItem]
        });
      } else {
        if (record.items.length >= 10) {
          record.items.shift(); // Xoá tuần cũ nhất
        }
        record.items.push(newItem);
      }
  
      await record.save();
      console.log(`🟢 Tạo bản ghi tuần mới cho ${sup.storeName} (tuần ${weekIndex})`);
    }
  }
}

module.exports = { createEmptyWeekIfMissing };
