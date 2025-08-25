const moment = require('moment');
const { predictNextWeekRevenue } = require('../services/predictor');
const PredictionLog = require('../models/PredictionLog');
const WeeklySalesInput = require('../models/WeeklySalesInput');

exports.handlePrediction = async (supplierId) => {
  try {
    // Lấy tuần cuối cùng trong WeeklySalesInput để xác định tuần dự đoán tiếp theo
    const weeklyRecord = await WeeklySalesInput.findOne({ supplier: supplierId });
    if (!weeklyRecord || !weeklyRecord.items || weeklyRecord.items.length === 0) {
      throw new Error('Không có dữ liệu tuần nào trong WeeklySalesInput');
    }

    const sortedItems = weeklyRecord.items.slice().sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart));
    const lastWeek = sortedItems[sortedItems.length - 1];
    const weekToPredictMoment = moment(lastWeek.weekStart).add(1, 'weeks').startOf('isoWeek');
    const weekStart = weekToPredictMoment.toDate();

    // Lấy bản ghi PredictionLog mới nhất (có externalFactorsCurrent) để lấy external factors hiện tại
    const latestPredictionLog = await PredictionLog.findOne({ supplier: supplierId, 'externalFactorsCurrent': { $ne: null } })
      .sort({ weekStart: -1 });

    // Lấy externalFactorsCurrent từ bản ghi log đó (nếu có)
    const externalFactorsCurrentFromLog = latestPredictionLog ? latestPredictionLog.externalFactorsCurrent : null;

    // Gọi hàm dự đoán, truyền externalFactorsCurrent lấy từ log
    const result = await predictNextWeekRevenue(supplierId, externalFactorsCurrentFromLog);

    // Lưu log dự đoán tuần tiếp theo
    await PredictionLog.findOneAndUpdate(
      { supplier: supplierId, weekStart },
      {
        supplier: supplierId,
        weekStart,
        weekOfYear: weekToPredictMoment.isoWeek(),
        year: weekToPredictMoment.isoWeekYear(),
        predictedByXGB: result.gruEnsemblePrediction || null,
        predictedByGRU: result.gruStandalonePrediction || null
      },
      { upsert: true, new: true }
    );

    return {
      predictedByXGB: result.gruEnsemblePrediction || null,
      predictedByGRU: result.gruStandalonePrediction || null,
      gruStandalonePrediction: result.gruStandalonePrediction,
      gruEnsemblePrediction: result.gruEnsemblePrediction,
      confidenceScoreStandalone: result.confidenceScoreStandalone,
      confidenceScoreEnsemble: result.confidenceScoreEnsemble
    };
  } catch (err) {
    console.error('❌ Lỗi khi dự đoán:', err);
    throw new Error('Lỗi khi dự đoán');
  }
};

exports.updateActualSales = async (req, res) => {
  try {
    const { supplierId, actualWeeklySales, weekStartDate } = req.body;

    if (!supplierId || !actualWeeklySales || !weekStartDate) {
      return res.status(400).json({ error: 'supplierId, actualWeeklySales và weekStartDate là bắt buộc' });
    }

    const weekStart = moment(weekStartDate).startOf('isoWeek').toDate();

    // Tìm bản ghi log theo supplier + tuần
    const log = await PredictionLog.findOne({ supplier: supplierId, weekStart });

    if (!log) {
      return res.status(404).json({ error: 'Không tìm thấy bản ghi dự đoán tuần này' });
    }

    log.actualWeeklySales = actualWeeklySales;
    await log.save();

    return res.json({ message: 'Cập nhật doanh thu thực tế thành công', data: log });
  } catch (error) {
    console.error('Lỗi khi cập nhật doanh thu thực tế:', error);
    return res.status(500).json({ error: 'Lỗi server khi cập nhật doanh thu thực tế' });
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

    // Validate bắt buộc
    if (
      holidayFlag === undefined ||
      temperature === undefined ||
      fuelPrice === undefined ||
      cpi === undefined ||
      unemployment === undefined
    ) {
      return res.status(400).json({ error: 'Thiếu trường dữ liệu ngoại cảnh' });
    }

    // Lấy bản ghi WeeklySalesInput của supplier
    const weeklyRecord = await WeeklySalesInput.findOne({ supplier: supplierId });

    let baseWeekStart, baseWeekMoment;
    if (!weeklyRecord || weeklyRecord.items.length === 0) {
      // Nếu không có tuần nào thì lấy tuần hiện tại
      baseWeekMoment = moment().startOf('isoWeek');
    } else {
      // Lấy tuần lớn nhất (gần nhất)
      const lastWeek = weeklyRecord.items.reduce((a, b) => (a.weekStart > b.weekStart ? a : b));
      baseWeekMoment = moment(lastWeek.weekStart).add(1, 'weeks'); // tuần tiếp theo
    }
    baseWeekStart = baseWeekMoment.toDate();

    // Tạo hoặc cập nhật bản ghi PredictionLog tuần mới đó
    const predictionLog = await PredictionLog.findOneAndUpdate(
      { supplier: supplierId, weekStart: baseWeekStart },
      {
        $set: {
          weekStart: baseWeekStart,
          weekOfYear: baseWeekMoment.isoWeek(),
          year: baseWeekMoment.isoWeekYear(),
          externalFactorsCurrent: {
            holidayFlag,
            temperature,
            fuelPrice,
            cpi,
            unemployment,
            month: baseWeekMoment.month() + 1,
            weekOfYear: baseWeekMoment.isoWeek(),
            year: baseWeekMoment.isoWeekYear(),
            dayOfWeek: baseWeekMoment.isoWeekday(),
            isWeekend: [6, 7].includes(baseWeekMoment.isoWeekday()) ? 1 : 0
          }
        }
      },
      { upsert: true, new: true }
    );

    res.json({ message: 'Cập nhật external factors thành công', predictionLog });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server khi cập nhật external factors' });
  }
};

// Helper tính % sai số tuyệt đối giữa actual và predicted
function calcAccuracy(actual, predicted) {
  if (actual === 0) return null; // tránh chia cho 0
  return 100 * (1 - Math.abs(actual - predicted) / actual);
}

// Controller cho admin xem các kết quả dự đoán theo supplier và năm/tuần (có phân trang)
exports.getPredictionLogs = async (req, res) => {
  try {
    const {  year, weekOfYear, page = 1, limit = 20 } = req.query;
    const supplierId = req.params.supplierId;
    if (!supplierId) {
      return res.status(400).json({ message: 'supplierId is required' });
    }

    // Build filter object
    let filter = { supplier: supplierId };
    if (year) filter.year = parseInt(year);
    if (weekOfYear) filter.weekOfYear = parseInt(weekOfYear);

    const skip = (page - 1) * limit;

    // Query dữ liệu có phân trang và sort tuần tăng dần
    const predictionLogs = await PredictionLog.find(filter)
      .sort({ year: 1, weekOfYear: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Tính độ chính xác (accuracy) theo từng mô hình
    const data = predictionLogs.map(item => ({
      weekStart: item.weekStart,
      weekOfYear: item.weekOfYear,
      year: item.year,
      actualWeeklySales: item.actualWeeklySales,
      predictedByGRU: item.predictedByGRU,
      predictedByXGB: item.predictedByXGB,
      accuracyGRU: calcAccuracy(item.actualWeeklySales, item.predictedByGRU),
      accuracyXGB: calcAccuracy(item.actualWeeklySales, item.predictedByXGB),
    }));

    return res.json({
      page: parseInt(page),
      limit: parseInt(limit),
      data,
    });
  } catch (error) {
    console.error('Error fetching prediction logs:', error);
    return res.status(500).json({ message: 'Server error' });
  }
}

