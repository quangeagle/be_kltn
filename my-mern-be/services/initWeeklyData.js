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

    // Tính weekIndex từ ngày thành lập đến tuần hiện tại
    const weekIndex = currentWeekStart.diff(createdAt, 'weeks');

    // Nếu chưa đủ 1 tuần từ ngày thành lập → vẫn tính là tuần đầu tiên
    const isFirstWeek = weekIndex === 0;

    // Tuần mới bắt đầu từ createdAt (nếu tuần đầu) hoặc từ thứ 2 tuần hiện tại
    const weekStart = isFirstWeek
      ? createdAt
      : currentWeekStart.clone();

    const weekOfYear = weekStart.isoWeek();
    const year = weekStart.isoWeekYear();
    const month = weekStart.month() + 1;

    // Kiểm tra nếu tuần này đã được tạo
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
