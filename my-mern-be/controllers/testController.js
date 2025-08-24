const moment = require('moment');
const PredictionTestLog = require('../models/PredictionTestLog');

// 1️⃣ Nhập external factors cho tuần mới (chưa dự đoán)
exports.addExternalFactorsTest = async (req, res) => {
  try {
    const {
      weekStartDate,
      holidayFlag,
      temperature,
      fuelPrice,
      cpi,
      unemployment
    } = req.body;

    if (!weekStartDate || holidayFlag === undefined || temperature === undefined ||
        fuelPrice === undefined || cpi === undefined || unemployment === undefined) {
      return res.status(400).json({ error: 'Thiếu trường dữ liệu bắt buộc' });
    }

    const weekStart = moment(weekStartDate).startOf('isoWeek').toDate();
    const weekMoment = moment(weekStart);

    const log = await PredictionTestLog.findOneAndUpdate(
      { weekStart },
      {
        $set: {
          weekStart,
          weekOfYear: weekMoment.isoWeek(),
          year: weekMoment.isoWeekYear(),
          externalFactorsCurrent: {
            holidayFlag,
            temperature,
            fuelPrice,
            cpi,
            unemployment,
            month: weekMoment.month() + 1,
            weekOfYear: weekMoment.isoWeek(),
            year: weekMoment.isoWeekYear(),
            dayOfWeek: weekMoment.isoWeekday(),
            isWeekend: [6,7].includes(weekMoment.isoWeekday()) ? 1 : 0
          }
        }
      },
      { upsert: true, new: true }
    );

    return res.json({ message: 'Lưu external factors thành công', data: log });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Lỗi server khi lưu external factors' });
  }
};

// 2️⃣ Nhập actual weekly sales (đã xong tuần, đánh giá accuracy)
exports.updateActualSalesTest = async (req, res) => {
  try {
    const { weekStartDate, actualWeeklySales } = req.body;
    if (!weekStartDate || actualWeeklySales === undefined) {
      return res.status(400).json({ error: 'weekStartDate và actualWeeklySales là bắt buộc' });
    }

    const weekStart = moment(weekStartDate).startOf('isoWeek').toDate();
    const log = await PredictionTestLog.findOne({ weekStart });

    if (!log) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi tuần này' });
    }

    log.actualWeeklySales = actualWeeklySales;
    await log.save();

    return res.json({ message: 'Cập nhật actual sales thành công', data: log });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Lỗi server khi cập nhật actual sales' });
  }
};
