const moment = require('moment');
const PredictionLog = require('../models/PredictionLog');

exports.generateWeeklyReport = async () => {
  try {
    const now = moment();
    const weekStart = now.startOf('isoWeek').toDate();

    // Lấy toàn bộ bản ghi tuần hiện tại
    const logs = await PredictionLog.find({ weekStart });

    if (!logs.length) {
      console.log('❗Không có bản ghi nào để tổng kết cho tuần này.');
      return;
    }

    console.log(`📊 BÁO CÁO DỰ ĐOÁN TUẦN ${now.isoWeek()} (${weekStart.toISOString().slice(0, 10)}):`);
    logs.forEach(log => {
      const diffXGB = log.actualWeeklySales - log.predictedByXGB;
      const diffGRU = log.actualWeeklySales - log.predictedByGRU;

      console.log(`- Supplier: ${log.supplier}`);
      console.log(`  → XGB: Dự đoán ${log.predictedByXGB}, Thực tế ${log.actualWeeklySales}, Sai lệch ${diffXGB}`);
      console.log(`  → GRU: Dự đoán ${log.predictedByGRU}, Thực tế ${log.actualWeeklySales}, Sai lệch ${diffGRU}`);
    });

  } catch (err) {
    console.error('❌ Lỗi khi tổng kết tuần:', err);
  }
};
