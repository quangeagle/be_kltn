const axios = require('axios');
const WeeklySalesInput = require('../models/WeeklySalesInput');

exports.predictNextWeekRevenue = async (supplierId) => {
  try {
    const records = await WeeklySalesInput.find({ supplier: supplierId })
      .sort({ weekIndex: -1 })
      .limit(10);

    if (records.length < 10) {
      throw new Error('Không có đủ dữ liệu 10 tuần');
    }

    // Sắp xếp đúng thứ tự tuần từ cũ đến mới
    const sorted = records.sort((a, b) => a.weekIndex - b.weekIndex);

    // Định dạng đầu vào XGBoost: [80 giá trị]
    const xgbFeatures = sorted.flatMap(item => [
      item.weeklySales || 0,
      item.holidayFlag || 0,
      item.temperature || 0,
      item.fuelPrice || 0,
      item.cpi || 0,
      item.unemployment || 0,
      item.weekOfYear || 0,
      item.month || 0
    ]);

    // Định dạng đầu vào GRU: [[8], [8], ..., [8]] (10 dòng)
    const gruData = sorted.map(item => [
      item.weeklySales || 0,
      item.holidayFlag || 0,
      item.temperature || 0,
      item.fuelPrice || 0,
      item.cpi || 0,
      item.unemployment || 0,
      item.weekOfYear || 0,
      item.month || 0
    ]);

    // Gọi song song 2 API
    const [xgbResponse, gruResponse] = await Promise.all([
      axios.post('https://deploy-modelai.onrender.com/predict/xgb', { features: xgbFeatures }),
      axios.post('https://deploy-modelai.onrender.com/predict/gru', { data: gruData })
    ]);

    return {
      xgb: xgbResponse.data.predicted_weekly_sales,
      gru: gruResponse.data.predicted_weekly_sales
    };
  } catch (err) {
    console.error('❌ Dự đoán lỗi:', err.message);
    throw err;
  }
};
