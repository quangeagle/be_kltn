const PredictionLog = require('../models/PredictionLog');

exports.getActualRevenue = async (req, res) => {
  const supplierId = req.params.supplierId;

  try {
    const logs = await PredictionLog.find({
      supplier: supplierId,
      actualWeeklySales: { $ne: null } // Chỉ lấy bản ghi có dữ liệu thực tế
    }).sort({ weekStart: 1 });

    const result = logs.map(log => ({
      weekOfYear: log.weekOfYear,
      year: log.year,
      weekStart: log.weekStart,
      actualWeeklySales: log.actualWeeklySales,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Lỗi khi lấy doanh thu thực tế.' });
  }
};
