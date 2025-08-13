const WeeklySalesInput = require('../models/WeeklySalesInput');
const mongoose = require('mongoose');
const moment = require('moment');
exports.createSampleData = async (req, res) => {
  try {
    const { supplierId, sampleItems } = req.body;

    if (!supplierId) {
      return res.status(400).json({ error: 'supplierId là bắt buộc' });
    }

    if (!sampleItems || !Array.isArray(sampleItems) || sampleItems.length === 0) {
      return res.status(400).json({ error: 'sampleItems phải là mảng không rỗng' });
    }

    // Kiểm tra supplierId có phải ObjectId hợp lệ không
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({ error: 'supplierId không hợp lệ' });
    }

    // Kiểm tra xem supplier đã có dữ liệu chưa, nếu có thì update, không thì tạo mới
    let record = await WeeklySalesInput.findOne({ supplier: supplierId });

    if (record) {
      // Nếu muốn ghi đè dữ liệu mẫu, bạn có thể xóa rồi tạo mới, hoặc update
      record.items = sampleItems;
      record.createdAt = new Date();
      await record.save();
      return res.json({ message: 'Dữ liệu mẫu đã được cập nhật thành công', data: record });
    } else {
      // Tạo mới
      record = new WeeklySalesInput({
        supplier: supplierId,
        items: sampleItems
      });
      await record.save();
      return res.status(201).json({ message: 'Dữ liệu mẫu đã được tạo thành công', data: record });
    }
  } catch (error) {
    console.error('Lỗi khi tạo dữ liệu mẫu:', error);
    return res.status(500).json({ error: 'Lỗi server khi tạo dữ liệu mẫu' });
  }
};
exports.addOrUpdateWeeklyExternalFactors2 = async (req, res) => {
    try {
      const { supplierId } = req.params;
      const {
        holidayFlag,
        temperature,
        fuelPrice,
        cpi,
        unemployment
      } = req.body;
  
      // Validate required
      if (
        holidayFlag === undefined ||
        temperature === undefined ||
        fuelPrice === undefined ||
        cpi === undefined ||
        unemployment === undefined
      ) {
        return res.status(400).json({ error: 'Thiếu trường dữ liệu ngoại cảnh' });
      }
  
      // Tìm bản ghi WeeklySalesInput cho supplier
      let record = await WeeklySalesInput.findOne({ supplier: supplierId });
  
      // Xác định tuần mới
      let newWeekStart, newWeekOfYear, newYear, newMonth;
      if (!record || record.items.length === 0) {
        // Nếu chưa có dữ liệu tuần nào, bắt đầu từ tuần hiện tại
        newWeekStart = moment().startOf('isoWeek');
      } else {
        // Tính tuần mới = tuần kế tiếp tuần cuối cùng trong items
        const lastWeek = record.items.reduce((a, b) => (a.weekStart > b.weekStart ? a : b));
        newWeekStart = moment(lastWeek.weekStart).add(1, 'weeks');
      }
      newWeekOfYear = newWeekStart.isoWeek();
      newYear = newWeekStart.isoWeekYear();
      newMonth = newWeekStart.month() + 1; // Tháng bắt đầu từ 0
  
      const newWeekData = {
        weekIndex: record && record.items.length ? record.items.length : 0,
        weekStart: newWeekStart.toDate(),
        year: newYear,
        weekOfYear: newWeekOfYear,
        month: newMonth,
        weeklySales: 0, // placeholder, thực tế không lưu ở đây
        holidayFlag,
        temperature,
        fuelPrice,
        cpi,
        unemployment
      };
  
      if (!record) {
        // Tạo mới nếu chưa có
        record = new WeeklySalesInput({
          supplier: supplierId,
          items: [newWeekData]
        });
      } else {
        // Thêm tuần mới, nếu > 10 tuần xóa tuần cũ nhất
        record.items.push(newWeekData);
        if (record.items.length > 10) {
          record.items.shift();
        }
      }
  
      await record.save();
  
      res.json({ message: 'Đã thêm dữ liệu tuần mới', weekData: newWeekData });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Lỗi server khi thêm dữ liệu tuần' });
    }
  };